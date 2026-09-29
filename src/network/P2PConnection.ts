import Peer, { DataConnection } from 'peerjs';
import { NetworkMessage } from './NetworkTypes';

export type ConnectionState = 'DISCONNECTED' | 'INITIALIZING' | 'WAITING_FOR_PEERS' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export class P2PConnection {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map(); // For Host: peerId -> conn
  private hostConnection: DataConnection | null = null; // For Client: conn to Host

  public isHost: boolean = false;
  public localPeerId: string = '';
  public roomCode: string = '';
  public state: ConnectionState = 'DISCONNECTED';
  public pingMs: number = 0;

  // Event callbacks
  public onStateChange: (state: ConnectionState, detail?: string) => void = () => {};
  public onPeerJoined: (peerId: string) => void = () => {};
  public onPeerLeft: (peerId: string) => void = () => {};
  public onMessage: (msg: NetworkMessage, senderPeerId: string) => void = () => {};
  public onError: (err: string) => void = () => {};

  private pingInterval: any = null;
  private readonly PEER_PREFIX = 'forgebound-td-v1-';

  private getPeerConfig() {
    return {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    };
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `FORGE-${code}`;
  }

  /**
   * Host a new multiplayer room.
   */
  public hostRoom(customCode?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.isHost = true;
      this.roomCode = customCode || this.generateRoomCode();
      const fullId = `${this.PEER_PREFIX}${this.roomCode.toLowerCase()}`;

      this.setState('INITIALIZING', 'Registering room on P2P signaling network...');

      try {
        this.peer = new Peer(fullId, this.getPeerConfig());

        this.peer.on('open', (id) => {
          this.localPeerId = id;
          this.setState('WAITING_FOR_PEERS', `Room ${this.roomCode} opened. Waiting for challengers...`);
          this.startHeartbeat();
          resolve(this.roomCode);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingGuestConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          const msg = err.type === 'unavailable-id'
            ? `Room code ${this.roomCode} is already active! Please try hosting again.`
            : `P2P Error: ${err.message || err.type}`;
          this.setState('ERROR', msg);
          this.onError(msg);
          reject(new Error(msg));
        });
      } catch (e: any) {
        this.setState('ERROR', e.message);
        reject(e);
      }
    });
  }

  /**
   * Join an existing multiplayer room as a guest.
   */
  public joinRoom(roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.isHost = false;
      let code = roomCode.trim().toUpperCase();
      if (!code.startsWith('FORGE-') && !code.startsWith('PYRO-')) {
        code = `FORGE-${code}`;
      }
      this.roomCode = code;
      const hostFullId = `${this.PEER_PREFIX}${this.roomCode.toLowerCase()}`;

      this.setState('INITIALIZING', 'Connecting to P2P network...');

      try {
        this.peer = new Peer(this.getPeerConfig());

        this.peer.on('open', (id) => {
          this.localPeerId = id;
          this.setState('CONNECTING', `Connecting directly to Host in room ${this.roomCode}...`);

          const conn = this.peer!.connect(hostFullId, { reliable: true });
          this.hostConnection = conn;

          let connectionTimeout = setTimeout(() => {
            if (this.state !== 'CONNECTED') {
              conn.close();
              const err = `Could not connect to room ${this.roomCode}. Room may not exist or host is offline.`;
              this.setState('ERROR', err);
              this.onError(err);
              reject(new Error(err));
            }
          }, 8000);

          conn.on('open', () => {
            clearTimeout(connectionTimeout);
            this.setState('CONNECTED', `Connected to Host in ${this.roomCode}!`);
            this.startHeartbeat();
            resolve();
          });

          conn.on('data', (data: any) => {
            this.handleData(data, hostFullId);
          });

          conn.on('close', () => {
            this.setState('DISCONNECTED', 'Connection to Host closed.');
            this.onPeerLeft(hostFullId);
          });

          conn.on('error', (err) => {
            clearTimeout(connectionTimeout);
            this.setState('ERROR', `Host connection error: ${err}`);
            this.onError(String(err));
            reject(err);
          });
        });

        this.peer.on('error', (err: any) => {
          const msg = `P2P Signaling Error: ${err.message || err.type}`;
          this.setState('ERROR', msg);
          this.onError(msg);
          reject(new Error(msg));
        });
      } catch (e: any) {
        this.setState('ERROR', e.message);
        reject(e);
      }
    });
  }

  private handleIncomingGuestConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.onPeerJoined(conn.peer);
    });

    conn.on('data', (data: any) => {
      this.handleData(data, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.onPeerLeft(conn.peer);
    });

    conn.on('error', (err) => {
      console.warn(`Connection error with guest ${conn.peer}:`, err);
      this.connections.delete(conn.peer);
      this.onPeerLeft(conn.peer);
    });
  }

  private handleData(data: any, senderPeerId: string) {
    if (!data || typeof data !== 'object' || !data.type) return;
    const msg = data as NetworkMessage;

    // Handle ping/pong for latency
    if (msg.type === 'PING') {
      this.sendToPeer(senderPeerId, { type: 'PONG', timestamp: msg.timestamp });
      return;
    }
    if (msg.type === 'PONG') {
      this.pingMs = Math.max(1, Math.round(performance.now() - msg.timestamp));
      return;
    }

    this.onMessage(msg, senderPeerId);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      const now = performance.now();
      if (this.isHost) {
        this.broadcast({ type: 'PING', timestamp: now });
      } else if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({ type: 'PING', timestamp: now });
      }
    }, 2500);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Broadcast message to all connected peers (Host only)
   */
  public broadcast(msg: NetworkMessage) {
    if (!this.isHost) return;
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  /**
   * Send message to a specific peer (Host only)
   */
  public sendToPeer(peerId: string, msg: NetworkMessage) {
    if (this.isHost) {
      const conn = this.connections.get(peerId);
      if (conn && conn.open) {
        conn.send(msg);
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(msg);
    }
  }

  /**
   * Send message from Client to Host
   */
  public sendToHost(msg: NetworkMessage) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(msg);
    }
  }

  public getConnectedPeerCount(): number {
    return this.isHost ? this.connections.size : (this.hostConnection && this.hostConnection.open ? 1 : 0);
  }

  private setState(newState: ConnectionState, detail?: string) {
    this.state = newState;
    this.onStateChange(newState, detail);
  }

  public disconnect() {
    this.stopHeartbeat();
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();

    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.isHost = false;
    this.localPeerId = '';
    this.roomCode = '';
    this.pingMs = 0;
    this.setState('DISCONNECTED');
  }
}
