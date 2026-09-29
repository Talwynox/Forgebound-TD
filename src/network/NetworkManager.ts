import * as THREE from 'three';
import { P2PConnection } from './P2PConnection';
import {
  GameMode,
  TeamId,
  PlayerSlot,
  NetworkMessage,
  StateSnapshot,
  GameAction,
  HostEvent,
  TEAM_COLORS,
  MAX_PLAYERS_PER_TEAM,
  MAX_NAME_LENGTH
} from './NetworkTypes';
import { audio } from '../engine/AudioSystem';

export type SessionEndReason = 'left' | 'host-lost' | 'rejected';

const STARTING_GOLD = 250;
const CURSOR_SEND_INTERVAL_MS = 50;

export function sanitizePlayerName(raw: unknown, fallback: string): string {
  const name = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NAME_LENGTH) : '';
  return name || fallback;
}

export class NetworkManager {
  public conn: P2PConnection;
  public mode: GameMode = 'COOP';
  public localTeam: TeamId = 'SUN';
  public players: Map<string, PlayerSlot> = new Map();
  public localName: string = 'Commander';

  /** True between MATCH_START and the match ending / leaving the room. Gates all gameplay networking. */
  public inMatch: boolean = false;

  // Teammate 3D cursors
  private scene: THREE.Scene | null = null;
  private remoteCursors: Map<string, THREE.Group> = new Map();
  private lastCursorSendTime = 0;

  // Callbacks hooked by GameApp / UI
  public onLobbyUpdated: () => void = () => {};
  public onMatchStarted: (mode: GameMode, missionId: number) => void = () => {};
  /** Host only: a gameplay action to validate and execute (from a guest or the host itself). */
  public onGameAction: (peerId: string, action: GameAction) => void = () => {};
  /** Clients only: a discrete world event broadcast by the host. */
  public onHostEvent: (event: HostEvent) => void = () => {};
  /** Clients only: the latest authoritative state. */
  public onSnapshot: (snapshot: StateSnapshot) => void = () => {};
  public onSessionEnded: (reason: SessionEndReason, detail?: string) => void = () => {};

  constructor() {
    this.conn = new P2PConnection();
    this.setupConnectionListeners();
  }

  public setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  public get isHost(): boolean {
    return this.conn.isHost;
  }

  public get localPeerId(): string {
    return this.conn.localPeerId;
  }

  /** In a match and receiving (not producing) the authoritative simulation. */
  public get isClientInMatch(): boolean {
    return this.inMatch && !this.isHost;
  }

  /** In a match and running the authoritative simulation. */
  public get isHostInMatch(): boolean {
    return this.inMatch && this.isHost;
  }

  public get isInRoom(): boolean {
    const s = this.conn.state;
    return s === 'CONNECTED' || s === 'WAITING_FOR_PEERS';
  }

  private setupConnectionListeners() {
    this.conn.onPeerJoined = (peerId) => {
      if (!this.isHost) return;

      if (this.inMatch) {
        this.conn.kickPeer(peerId, { type: 'LOBBY_REJECTED', reason: 'A match is already in progress in this room. Try again once it ends.' });
        return;
      }

      const team = this.pickTeamForNewPlayer();
      if (!team) {
        this.conn.kickPeer(peerId, { type: 'LOBBY_REJECTED', reason: 'This room is full.' });
        return;
      }

      this.players.set(peerId, {
        peerId,
        name: `Challenger ${this.players.size + 1}`,
        team,
        slotIndex: this.getNextAvailableSlot(team),
        isHost: false,
        isReady: false,
        gold: STARTING_GOLD
      });
      this.broadcastLobbyState();
      audio.playUpgrade();
    };

    this.conn.onPeerLeft = (peerId) => {
      this.removeRemoteCursor(peerId);

      if (!this.isHost) {
        // The only peer a client talks to is the host.
        this.endSession('host-lost', 'Connection to the host was lost.');
        return;
      }

      // Keep a departed player's slot during a match so their gold/towers stay consistent;
      // their towers become manageable by the remaining players.
      if (this.inMatch) {
        const p = this.players.get(peerId);
        if (p) p.disconnected = true;
      } else {
        this.players.delete(peerId);
      }
      this.broadcastLobbyState();
    };

    this.conn.onMessage = (msg, senderPeerId) => {
      this.handleNetworkMessage(msg, senderPeerId);
    };
  }

  private pickTeamForNewPlayer(): TeamId | null {
    const count = (team: TeamId) => Array.from(this.players.values()).filter(p => p.team === team).length;
    const sun = count('SUN');
    const moon = count('MOON');
    if (this.mode === 'COOP') {
      return sun < MAX_PLAYERS_PER_TEAM ? 'SUN' : null;
    }
    if (sun >= MAX_PLAYERS_PER_TEAM && moon >= MAX_PLAYERS_PER_TEAM) return null;
    if (sun >= MAX_PLAYERS_PER_TEAM) return 'MOON';
    if (moon >= MAX_PLAYERS_PER_TEAM) return 'SUN';
    return sun <= moon ? 'SUN' : 'MOON';
  }

  private getNextAvailableSlot(team: TeamId, excludePeerId?: string): number {
    const taken = Array.from(this.players.values())
      .filter(p => p.team === team && p.peerId !== excludePeerId)
      .map(p => p.slotIndex);
    for (let i = 0; i < MAX_PLAYERS_PER_TEAM; i++) {
      if (!taken.includes(i)) return i;
    }
    return 0;
  }

  private isTeamFull(team: TeamId, excludePeerId?: string): boolean {
    return Array.from(this.players.values()).filter(p => p.team === team && p.peerId !== excludePeerId).length >= MAX_PLAYERS_PER_TEAM;
  }

  // --- Lobby ---

  public initHostPlayer(name: string, mode: GameMode = 'COOP') {
    this.localName = sanitizePlayerName(name, 'Host Commander');
    this.mode = mode;
    this.localTeam = 'SUN';
    this.inMatch = false;
    this.players.clear();
    this.players.set(this.conn.localPeerId, {
      peerId: this.conn.localPeerId,
      name: this.localName,
      team: 'SUN',
      slotIndex: 0,
      isHost: true,
      isReady: true,
      gold: STARTING_GOLD
    });
    this.onLobbyUpdated();
  }

  public initClientPlayer(name: string) {
    this.localName = sanitizePlayerName(name, 'Challenger');
    this.inMatch = false;
    this.conn.sendToHost({ type: 'ACTION_JOIN_LOBBY', name: this.localName });
  }

  public setLocalTeam(team: TeamId) {
    if (this.isHost) {
      const host = this.players.get(this.conn.localPeerId);
      if (host && host.team !== team && !this.isTeamFull(team, host.peerId)) {
        host.slotIndex = this.getNextAvailableSlot(team, host.peerId);
        host.team = team;
        this.localTeam = team;
        this.broadcastLobbyState();
      }
    } else {
      this.conn.sendToHost({ type: 'ACTION_SELECT_TEAM', team });
    }
  }

  public setLocalReady(ready: boolean) {
    if (this.isHost) {
      const host = this.players.get(this.conn.localPeerId);
      if (host) host.isReady = ready;
      this.broadcastLobbyState();
    } else {
      this.conn.sendToHost({ type: 'ACTION_SET_READY', ready });
    }
  }

  public setGameMode(mode: GameMode) {
    if (this.isInRoom && !this.isHost) return;
    this.mode = mode;
    if (mode === 'COOP') {
      // In Co-op, all players move to Team Sun
      let slot = 0;
      for (const p of this.players.values()) {
        p.team = 'SUN';
        p.slotIndex = slot++;
      }
      this.localTeam = 'SUN';
    }
    this.broadcastLobbyState();
  }

  public getUnreadyPlayers(): PlayerSlot[] {
    return this.getPlayerList().filter(p => !p.isReady);
  }

  public startMatch(missionId: number) {
    if (!this.isHost) return;
    for (const p of this.players.values()) {
      p.gold = STARTING_GOLD;
    }
    this.inMatch = true;
    this.conn.broadcast({ type: 'MATCH_START', mode: this.mode, missionId, players: this.getPlayerList() });
    this.onMatchStarted(this.mode, missionId);
  }

  /** Match is over (victory/defeat) but everyone stays in the room for a rematch. */
  public endMatch() {
    this.inMatch = false;
    this.clearRemoteCursors();
    if (this.isHost) {
      // Drop players that disconnected during the match and require a fresh ready-up.
      for (const [peerId, p] of Array.from(this.players)) {
        if (p.isHost) continue;
        if (p.disconnected || !this.conn.hasPeer(peerId)) this.players.delete(peerId);
        else p.isReady = false;
      }
      this.broadcastLobbyState();
    }
  }

  /** Leave the room entirely. */
  public leave() {
    this.endSession('left');
  }

  private endSession(reason: SessionEndReason, detail?: string) {
    this.inMatch = false;
    this.players.clear();
    this.clearRemoteCursors();
    this.conn.disconnect();
    this.onSessionEnded(reason, detail);
    this.onLobbyUpdated();
  }

  private broadcastLobbyState() {
    if (!this.isHost) return;
    this.conn.broadcast({ type: 'LOBBY_STATE', mode: this.mode, players: this.getPlayerList() });
    this.onLobbyUpdated();
  }

  public getPlayerList(): PlayerSlot[] {
    return Array.from(this.players.values());
  }

  public getPlayer(peerId: string): PlayerSlot | undefined {
    return this.players.get(peerId);
  }

  public getLocalPlayer(): PlayerSlot | undefined {
    return this.players.get(this.conn.localPeerId);
  }

  /** Whether the player is still connected to the room. */
  public isPlayerPresent(peerId: string): boolean {
    if (peerId === this.localPeerId) return true;
    const p = this.players.get(peerId);
    return Boolean(p && !p.disconnected);
  }

  // --- Economy (Host authoritative) ---

  /**
   * Distributes gold equally among all players on a given team.
   */
  public awardTeamGold(team: TeamId, totalGold: number) {
    if (!this.isHost) return;
    const teamPlayers = Array.from(this.players.values()).filter(p => p.team === team);
    if (teamPlayers.length === 0) return;
    const split = Math.max(1, Math.floor(totalGold / teamPlayers.length));
    for (const p of teamPlayers) {
      p.gold += split;
    }
  }

  // --- Gameplay messaging ---

  /** Executes on the host directly, or forwards to the host from a client. */
  public sendAction(action: GameAction) {
    if (!this.inMatch) return;
    if (this.isHost) {
      this.onGameAction(this.conn.localPeerId, action);
    } else {
      this.conn.sendToHost({ type: 'GAME_ACTION', action });
    }
  }

  public broadcastEvent(event: HostEvent) {
    if (this.isHostInMatch) this.conn.broadcast({ type: 'HOST_EVENT', event });
  }

  public sendEventTo(peerId: string, event: HostEvent) {
    if (this.isHostInMatch) this.conn.sendToPeer(peerId, { type: 'HOST_EVENT', event });
  }

  public broadcastSnapshot(snapshot: StateSnapshot) {
    if (this.isHostInMatch) this.conn.broadcast({ type: 'STATE_SNAPSHOT', snapshot });
  }

  public sendCursorMove(worldX: number, worldZ: number) {
    if (!this.inMatch) return;
    const now = performance.now();
    if (now - this.lastCursorSendTime < CURSOR_SEND_INTERVAL_MS) return;
    this.lastCursorSendTime = now;

    if (this.isHost) {
      this.conn.broadcast({ type: 'EVENT_CURSOR_BROADCAST', peerId: this.conn.localPeerId, team: this.localTeam, worldX, worldZ });
    } else {
      this.conn.sendToHost({ type: 'ACTION_CURSOR_MOVE', worldX, worldZ });
    }
  }

  public sendMapPing(worldX: number, worldZ: number) {
    if (!this.inMatch) return;
    if (this.isHost) {
      this.conn.broadcast({ type: 'EVENT_PING_BROADCAST', peerId: this.conn.localPeerId, team: this.localTeam, worldX, worldZ });
      this.show3DPing(worldX, worldZ, this.localTeam);
    } else {
      this.conn.sendToHost({ type: 'ACTION_PING_MAP', worldX, worldZ });
    }
  }

  // --- Network Message Dispatcher ---

  private handleNetworkMessage(msg: NetworkMessage, senderPeerId: string) {
    if (this.isHost) {
      this.handleMessageAsHost(msg, senderPeerId);
    } else {
      this.handleMessageAsClient(msg);
    }
  }

  private handleMessageAsHost(msg: NetworkMessage, senderPeerId: string) {
    const sender = this.players.get(senderPeerId);
    if (!sender) return;

    switch (msg.type) {
      case 'ACTION_JOIN_LOBBY':
        sender.name = sanitizePlayerName(msg.name, sender.name);
        this.broadcastLobbyState();
        break;

      case 'ACTION_SELECT_TEAM':
        if (this.inMatch || this.mode !== 'PVP') break;
        if (msg.team !== 'SUN' && msg.team !== 'MOON') break;
        if (sender.team === msg.team || this.isTeamFull(msg.team, senderPeerId)) break;
        sender.slotIndex = this.getNextAvailableSlot(msg.team, senderPeerId);
        sender.team = msg.team;
        this.broadcastLobbyState();
        break;

      case 'ACTION_SET_READY':
        if (this.inMatch) break;
        sender.isReady = Boolean(msg.ready);
        this.broadcastLobbyState();
        break;

      case 'GAME_ACTION':
        if (this.inMatch && msg.action && typeof msg.action === 'object') {
          this.onGameAction(senderPeerId, msg.action);
        }
        break;

      case 'ACTION_CURSOR_MOVE':
        if (!this.inMatch || !isFiniteXZ(msg.worldX, msg.worldZ)) break;
        this.conn.broadcast({ type: 'EVENT_CURSOR_BROADCAST', peerId: senderPeerId, team: sender.team, worldX: msg.worldX, worldZ: msg.worldZ });
        this.updateRemoteCursor(senderPeerId, sender.team, msg.worldX, msg.worldZ);
        break;

      case 'ACTION_PING_MAP':
        if (!this.inMatch || !isFiniteXZ(msg.worldX, msg.worldZ)) break;
        this.conn.broadcast({ type: 'EVENT_PING_BROADCAST', peerId: senderPeerId, team: sender.team, worldX: msg.worldX, worldZ: msg.worldZ });
        this.show3DPing(msg.worldX, msg.worldZ, sender.team);
        break;
    }
  }

  private handleMessageAsClient(msg: NetworkMessage) {
    switch (msg.type) {
      case 'LOBBY_STATE':
        this.mode = msg.mode;
        this.applyPlayerList(msg.players);
        this.onLobbyUpdated();
        break;

      case 'LOBBY_REJECTED':
        this.endSession('rejected', msg.reason);
        break;

      case 'MATCH_START':
        this.mode = msg.mode;
        this.applyPlayerList(msg.players);
        this.inMatch = true;
        this.onMatchStarted(msg.mode, msg.missionId);
        break;

      case 'STATE_SNAPSHOT': {
        if (!this.inMatch) break;
        for (const [peerId, gold] of Object.entries(msg.snapshot.economy)) {
          const p = this.players.get(peerId);
          if (p) p.gold = gold;
        }
        this.onSnapshot(msg.snapshot);
        break;
      }

      case 'HOST_EVENT':
        if (!this.inMatch) break;
        if (msg.event.kind === 'MATCH_END') {
          this.inMatch = false;
          this.clearRemoteCursors();
        }
        this.onHostEvent(msg.event);
        break;

      case 'EVENT_CURSOR_BROADCAST':
        if (this.inMatch && msg.peerId !== this.conn.localPeerId) {
          this.updateRemoteCursor(msg.peerId, msg.team, msg.worldX, msg.worldZ);
        }
        break;

      case 'EVENT_PING_BROADCAST':
        if (this.inMatch) this.show3DPing(msg.worldX, msg.worldZ, msg.team);
        break;
    }
  }

  private applyPlayerList(players: PlayerSlot[]) {
    this.players.clear();
    for (const p of players) {
      this.players.set(p.peerId, p);
      if (p.peerId === this.conn.localPeerId) {
        this.localTeam = p.team;
      }
    }
  }

  // --- 3D Visual Cursors & Map Pings ---

  private updateRemoteCursor(peerId: string, team: TeamId, x: number, z: number) {
    if (!this.scene) return;

    let group = this.remoteCursors.get(peerId);
    if (!group) {
      group = new THREE.Group();

      const pSlot = this.players.get(peerId);
      const slotIdx = pSlot ? pSlot.slotIndex : 0;
      const color = new THREE.Color(TEAM_COLORS[team][slotIdx % TEAM_COLORS[team].length]);

      // Ground indicator ring
      const ringGeom = new THREE.RingGeometry(0.7, 0.85, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      }));
      group.add(ring);

      // Overhead pointer cone
      const coneGeom = new THREE.ConeGeometry(0.2, 0.45, 4);
      coneGeom.rotateX(Math.PI);
      const cone = new THREE.Mesh(coneGeom, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      cone.position.y = 1.2;
      group.add(cone);

      this.scene.add(group);
      this.remoteCursors.set(peerId, group);
    }

    group.position.set(x, 0.14, z);
  }

  private removeRemoteCursor(peerId: string) {
    const group = this.remoteCursors.get(peerId);
    if (!group) return;
    this.scene?.remove(group);
    disposeObject(group);
    this.remoteCursors.delete(peerId);
  }

  private clearRemoteCursors() {
    for (const peerId of Array.from(this.remoteCursors.keys())) {
      this.removeRemoteCursor(peerId);
    }
  }

  private show3DPing(x: number, z: number, team: TeamId) {
    if (!this.scene) return;
    audio.playAlert();

    const ringGeom = new THREE.RingGeometry(0.2, 0.4, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: team === 'SUN' ? 0xfacc15 : 0xef4444,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const pingMesh = new THREE.Mesh(ringGeom, ringMat);
    pingMesh.position.set(x, 0.2, z);
    this.scene.add(pingMesh);

    // Expand & fade out animation (time-based so it is framerate independent)
    const start = performance.now();
    const animatePing = () => {
      const elapsed = (performance.now() - start) / 1000;
      const scale = 1.0 + elapsed * 3.0;
      pingMesh.scale.set(scale, 1, scale);
      ringMat.opacity = Math.max(0, 0.9 - elapsed * 0.9);
      if (ringMat.opacity > 0) {
        requestAnimationFrame(animatePing);
      } else {
        this.scene?.remove(pingMesh);
        ringGeom.dispose();
        ringMat.dispose();
      }
    };
    animatePing();
  }
}

function isFiniteXZ(x: unknown, z: unknown): x is number {
  return typeof x === 'number' && typeof z === 'number' && Number.isFinite(x) && Number.isFinite(z);
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
}
