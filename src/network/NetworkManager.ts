import * as THREE from 'three';
import { P2PConnection } from './P2PConnection';
import {
  GameMode,
  TeamId,
  PlayerSlot,
  NetworkMessage,
  StateSnapshotPayload,
  UnitSnapshot,
  TEAM_COLORS,
  MERCENARY_DEFINITIONS,
  MercenaryDef
} from './NetworkTypes';
import { GridCoord } from '../grid/Grid';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS } from '../towers/TowerData';
import { EnemyClass } from '../units/UnitData';
import { audio } from '../engine/AudioSystem';

export class NetworkManager {
  public conn: P2PConnection;
  public mode: GameMode = 'COOP';
  public localTeam: TeamId = 'SUN';
  public players: Map<string, PlayerSlot> = new Map();
  public localName: string = 'Commander';

  // Teammate 3D cursors
  private scene: THREE.Scene | null = null;
  private remoteCursors: Map<string, THREE.Group> = new Map();
  private cursorMaterials: Map<string, THREE.MeshBasicMaterial> = new Map();

  // Callbacks hooked by GameApp
  public onLobbyUpdated: (players: PlayerSlot[], mode: GameMode) => void = () => {};
  public onMatchStarted: (mode: GameMode, missionId: number, startingGold: number) => void = () => {};
  public onRemoteBuildTower: (peerId: string, team: TeamId, coord: GridCoord, towerType: TowerType) => void = () => {};
  public onRemoteUpgradeTower: (peerId: string, towerId: number, branch: UpgradeBranch) => void = () => {};
  public onRemoteSellTower: (peerId: string, towerId: number) => void = () => {};
  public onRemoteBuyRecruit: (peerId: string, team: TeamId) => void = () => {};
  public onRemoteMercenarySend: (peerId: string, team: TeamId, enemyClass: EnemyClass) => void = () => {};
  public onRemoteTowerBuilt: (id: number, team: TeamId, ownerPeerId: string, towerType: TowerType, coord: GridCoord) => void = () => {};
  public onRemoteTowerUpgraded: (id: number, ownerPeerId: string, branch: UpgradeBranch, level: number) => void = () => {};
  public onRemoteTowerSold: (id: number, ownerPeerId: string, refundGold: number) => void = () => {};
  public onMercenarySummoned: (senderPeerId: string, senderTeam: TeamId, enemyClass: EnemyClass) => void = () => {};
  public onSnapshotReceived: (snapshot: StateSnapshotPayload) => void = () => {};
  public onWaveCountdown: (secondsLeft: number) => void = () => {};
  public onMatchEnd: (winningTeam: TeamId, isCoopVictory?: boolean) => void = () => {};

  constructor() {
    this.conn = new P2PConnection();
    this.setupConnectionListeners();
  }

  public setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  public get isMultiplayer(): boolean {
    return this.conn.state === 'CONNECTED' || (this.conn.isHost && this.conn.getConnectedPeerCount() > 0);
  }

  public get isConnected(): boolean {
    return this.isMultiplayer;
  }

  public get isHost(): boolean {
    return this.conn.isHost;
  }

  public get localPeerId(): string {
    return this.conn.localPeerId;
  }

  private setupConnectionListeners() {
    this.conn.onPeerJoined = (peerId) => {
      if (this.isHost) {
        // Assign new guest to team with fewer players
        const sunCount = Array.from(this.players.values()).filter(p => p.team === 'SUN').length;
        const moonCount = Array.from(this.players.values()).filter(p => p.team === 'MOON').length;
        const assignedTeam: TeamId = this.mode === 'COOP' ? 'SUN' : (sunCount <= moonCount ? 'SUN' : 'MOON');
        const teamSlot = this.getNextAvailableSlot(assignedTeam);

        const newPlayer: PlayerSlot = {
          peerId,
          name: `Challenger ${this.players.size + 1}`,
          team: assignedTeam,
          slotIndex: teamSlot,
          isHost: false,
          isReady: false,
          pingMs: 25,
          gold: 250,
          income: 0
        };

        this.players.set(peerId, newPlayer);
        this.broadcastLobbyState();
        audio.playUpgrade();
      }
    };

    this.conn.onPeerLeft = (peerId) => {
      this.players.delete(peerId);
      this.removeRemoteCursor(peerId);
      if (this.isHost) {
        this.broadcastLobbyState();
      }
      this.onLobbyUpdated(this.getPlayerList(), this.mode);
    };

    this.conn.onMessage = (msg, senderPeerId) => {
      this.handleNetworkMessage(msg, senderPeerId);
    };
  }

  private getNextAvailableSlot(team: TeamId): number {
    const existingSlots = Array.from(this.players.values())
      .filter(p => p.team === team)
      .map(p => p.slotIndex);
    for (let i = 0; i < 4; i++) {
      if (!existingSlots.includes(i)) return i;
    }
    return 0;
  }

  public initHostPlayer(name: string, mode: GameMode = 'COOP') {
    this.localName = name;
    this.mode = mode;
    this.localTeam = 'SUN';
    this.players.clear();

    const hostSlot: PlayerSlot = {
      peerId: this.conn.localPeerId,
      name,
      team: 'SUN',
      slotIndex: 0,
      isHost: true,
      isReady: true,
      pingMs: 0,
      gold: 250,
      income: 0
    };
    this.players.set(this.conn.localPeerId, hostSlot);
    this.onLobbyUpdated(this.getPlayerList(), this.mode);
  }

  public initClientPlayer(name: string) {
    this.localName = name;
    this.conn.sendToHost({ type: 'ACTION_JOIN_LOBBY', name });
  }

  public setLocalTeam(team: TeamId) {
    this.localTeam = team;
    if (this.isHost) {
      const host = this.players.get(this.conn.localPeerId);
      if (host) {
        host.team = team;
        host.slotIndex = this.getNextAvailableSlot(team);
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
    if (!this.isHost) return;
    this.mode = mode;
    if (mode === 'COOP') {
      // In Co-op, all players move to Team Sun
      let slot = 0;
      for (const p of this.players.values()) {
        p.team = 'SUN';
        p.slotIndex = slot++;
      }
    }
    this.broadcastLobbyState();
  }

  public startMatch(missionId: number, startingGold: number) {
    if (!this.isHost) return;
    // Set initial gold for all players
    for (const p of this.players.values()) {
      p.gold = startingGold;
      p.income = 0;
    }
    const msg: NetworkMessage = {
      type: 'MATCH_START',
      mode: this.mode,
      missionId,
      players: this.getPlayerList(),
      startingGold
    };
    this.conn.broadcast(msg);
    this.onMatchStarted(this.mode, missionId, startingGold);
  }

  private broadcastLobbyState() {
    if (!this.isHost) return;
    const msg: NetworkMessage = {
      type: 'LOBBY_STATE',
      mode: this.mode,
      missionId: 1,
      players: this.getPlayerList()
    };
    this.conn.broadcast(msg);
    this.onLobbyUpdated(this.getPlayerList(), this.mode);
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

  // --- Option C Economy Handlers ---

  /**
   * Distributes a kill bounty equally among all players on a given team.
   */
  public awardTeamBounty(team: TeamId, totalBounty: number) {
    if (!this.isHost) return;
    const teamPlayers = Array.from(this.players.values()).filter(p => p.team === team);
    if (teamPlayers.length === 0) return;

    // Option C: Equal split
    const splitGold = Math.max(1, Math.floor(totalBounty / teamPlayers.length));
    for (const p of teamPlayers) {
      p.gold += splitGold;
    }
  }

  /**
   * Pays round income to all players at the end of a wave.
   */
  public payoutRoundIncome() {
    if (!this.isHost) return;
    for (const p of this.players.values()) {
      if (p.income > 0) {
        p.gold += p.income;
      }
    }
  }

  // --- Remote Player Action Senders (Client -> Host or Host local) ---

  public sendBuildTower(team: TeamId, coord: GridCoord, towerType: TowerType) {
    if (this.isHost) {
      this.onRemoteBuildTower(this.conn.localPeerId, team, coord, towerType);
    } else {
      this.conn.sendToHost({ type: 'ACTION_BUILD_TOWER', team, coord, towerType });
    }
  }

  public sendUpgradeTower(towerId: number, branch: UpgradeBranch) {
    if (this.isHost) {
      this.onRemoteUpgradeTower(this.conn.localPeerId, towerId, branch);
    } else {
      this.conn.sendToHost({ type: 'ACTION_UPGRADE_TOWER', towerId, branch });
    }
  }

  public sendSellTower(towerId: number) {
    if (this.isHost) {
      this.onRemoteSellTower(this.conn.localPeerId, towerId);
    } else {
      this.conn.sendToHost({ type: 'ACTION_SELL_TOWER', towerId });
    }
  }

  public sendBuyRecruit(team: TeamId) {
    if (this.isHost) {
      this.onRemoteBuyRecruit(this.conn.localPeerId, team);
    } else {
      this.conn.sendToHost({ type: 'ACTION_BUY_RECRUIT', team });
    }
  }

  public sendMercenary(enemyClass: EnemyClass) {
    if (this.isHost) {
      this.handleMercenarySendAuthoritative(this.conn.localPeerId, enemyClass);
    } else {
      this.conn.sendToHost({ type: 'ACTION_SEND_MERCENARY', enemyClass });
    }
  }

  public sendCursorMove(worldX: number, worldZ: number, selectedTower?: TowerType | null) {
    const msg: NetworkMessage = { type: 'ACTION_CURSOR_MOVE', worldX, worldZ, selectedTower };
    if (this.isHost) {
      this.conn.broadcast({
        type: 'EVENT_CURSOR_BROADCAST',
        peerId: this.conn.localPeerId,
        team: this.localTeam,
        worldX,
        worldZ,
        selectedTower
      });
    } else {
      this.conn.sendToHost(msg);
    }
  }

  public sendMapPing(worldX: number, worldZ: number) {
    const msg: NetworkMessage = { type: 'ACTION_PING_MAP', worldX, worldZ };
    if (this.isHost) {
      this.conn.broadcast({
        type: 'EVENT_PING_BROADCAST',
        peerId: this.conn.localPeerId,
        team: this.localTeam,
        worldX,
        worldZ
      });
      this.show3DPing(worldX, worldZ, this.localTeam);
    } else {
      this.conn.sendToHost(msg);
    }
  }

  // --- Network Message Dispatcher ---

  private handleNetworkMessage(msg: NetworkMessage, senderPeerId: string) {
    switch (msg.type) {
      case 'ACTION_JOIN_LOBBY': {
        if (!this.isHost) break;
        const p = this.players.get(senderPeerId);
        if (p) {
          p.name = msg.name || p.name;
          this.broadcastLobbyState();
        }
        break;
      }

      case 'ACTION_SELECT_TEAM': {
        if (!this.isHost) break;
        const p = this.players.get(senderPeerId);
        if (p && this.mode === 'PVP') {
          p.team = msg.team;
          p.slotIndex = this.getNextAvailableSlot(msg.team);
          this.broadcastLobbyState();
        }
        break;
      }

      case 'ACTION_SET_READY': {
        if (!this.isHost) break;
        const p = this.players.get(senderPeerId);
        if (p) {
          p.isReady = msg.ready;
          this.broadcastLobbyState();
        }
        break;
      }

      case 'ACTION_SELECT_MODE': {
        if (!this.isHost) break;
        this.setGameMode(msg.mode);
        break;
      }

      case 'LOBBY_STATE': {
        this.mode = msg.mode;
        this.players.clear();
        for (const p of msg.players) {
          this.players.set(p.peerId, p);
          if (p.peerId === this.conn.localPeerId) {
            this.localTeam = p.team;
          }
        }
        this.onLobbyUpdated(msg.players, msg.mode);
        break;
      }

      case 'MATCH_START': {
        this.mode = msg.mode;
        this.players.clear();
        for (const p of msg.players) {
          this.players.set(p.peerId, p);
          if (p.peerId === this.conn.localPeerId) {
            this.localTeam = p.team;
          }
        }
        this.onMatchStarted(msg.mode, msg.missionId, msg.startingGold);
        break;
      }

      case 'ACTION_BUILD_TOWER': {
        if (this.isHost) {
          this.onRemoteBuildTower(senderPeerId, msg.team, msg.coord, msg.towerType);
        }
        break;
      }

      case 'ACTION_UPGRADE_TOWER': {
        if (this.isHost) {
          this.onRemoteUpgradeTower(senderPeerId, msg.towerId, msg.branch);
        }
        break;
      }

      case 'ACTION_SELL_TOWER': {
        if (this.isHost) {
          this.onRemoteSellTower(senderPeerId, msg.towerId);
        }
        break;
      }

      case 'ACTION_BUY_RECRUIT': {
        if (this.isHost) {
          this.onRemoteBuyRecruit(senderPeerId, msg.team);
        }
        break;
      }

      case 'ACTION_SEND_MERCENARY': {
        if (this.isHost) {
          this.handleMercenarySendAuthoritative(senderPeerId, msg.enemyClass);
        }
        break;
      }

      case 'ACTION_CURSOR_MOVE': {
        if (this.isHost) {
          const sender = this.players.get(senderPeerId);
          const team = sender ? sender.team : 'SUN';
          this.conn.broadcast({
            type: 'EVENT_CURSOR_BROADCAST',
            peerId: senderPeerId,
            team,
            worldX: msg.worldX,
            worldZ: msg.worldZ,
            selectedTower: msg.selectedTower
          });
          this.updateRemoteCursor(senderPeerId, team, msg.worldX, msg.worldZ, msg.selectedTower);
        }
        break;
      }

      case 'EVENT_CURSOR_BROADCAST': {
        if (msg.peerId !== this.conn.localPeerId) {
          this.updateRemoteCursor(msg.peerId, msg.team, msg.worldX, msg.worldZ, msg.selectedTower);
        }
        break;
      }

      case 'ACTION_PING_MAP': {
        if (this.isHost) {
          const sender = this.players.get(senderPeerId);
          const team = sender ? sender.team : 'SUN';
          this.conn.broadcast({
            type: 'EVENT_PING_BROADCAST',
            peerId: senderPeerId,
            team,
            worldX: msg.worldX,
            worldZ: msg.worldZ
          });
          this.show3DPing(msg.worldX, msg.worldZ, team);
        }
        break;
      }

      case 'EVENT_PING_BROADCAST': {
        this.show3DPing(msg.worldX, msg.worldZ, msg.team);
        break;
      }

      case 'STATE_SNAPSHOT': {
        this.onSnapshotReceived(msg.snapshot);
        // Sync local gold balance
        const mySlot = this.players.get(this.conn.localPeerId);
        if (mySlot && msg.snapshot.playerGolds[this.conn.localPeerId] !== undefined) {
          mySlot.gold = msg.snapshot.playerGolds[this.conn.localPeerId];
        }
        break;
      }

      case 'EVENT_TOWER_BUILT': {
        this.onRemoteTowerBuilt(msg.id, msg.team, msg.ownerPeerId, msg.towerType, msg.coord);
        break;
      }

      case 'EVENT_TOWER_UPGRADED': {
        this.onRemoteTowerUpgraded(msg.id, msg.ownerPeerId, msg.branch, msg.level);
        break;
      }

      case 'EVENT_TOWER_SOLD': {
        this.onRemoteTowerSold(msg.id, msg.ownerPeerId, msg.refundGold);
        break;
      }

      case 'EVENT_MERCENARY_SUMMONED': {
        this.onMercenarySummoned(msg.senderPeerId, msg.senderTeam, msg.enemyClass);
        break;
      }

      case 'EVENT_WAVE_COUNTDOWN': {
        this.onWaveCountdown(msg.secondsLeft);
        break;
      }

      case 'EVENT_MATCH_END': {
        this.onMatchEnd(msg.winningTeam, msg.isCoopVictory);
        break;
      }
    }
  }

  private handleMercenarySendAuthoritative(senderPeerId: string, enemyClass: EnemyClass) {
    const sender = this.players.get(senderPeerId);
    if (!sender) return;

    const def = MERCENARY_DEFINITIONS[enemyClass];
    if (!def) return;

    if (sender.gold >= def.cost) {
      sender.gold -= def.cost;
      sender.income += def.incomeBonus;

      this.onRemoteMercenarySend(senderPeerId, sender.team, enemyClass);

      this.conn.broadcast({
        type: 'EVENT_MERCENARY_SUMMONED',
        senderPeerId,
        senderTeam: sender.team,
        enemyClass
      });
    }
  }

  // --- 3D Visual Cursors & Map Pings ---

  private updateRemoteCursor(
    peerId: string,
    team: TeamId,
    x: number,
    z: number,
    selectedTower?: TowerType | null
  ) {
    if (!this.scene) return;

    let group = this.remoteCursors.get(peerId);
    if (!group) {
      group = new THREE.Group();

      const pSlot = this.players.get(peerId);
      const slotIdx = pSlot ? pSlot.slotIndex : 0;
      const hexColor = TEAM_COLORS[team][slotIdx % 4];

      // Ground indicator ring
      const ringGeom = new THREE.RingGeometry(0.7, 0.85, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexColor),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.name = 'cursorRing';
      group.add(ring);

      // Overhead pointer cone
      const coneGeom = new THREE.ConeGeometry(0.2, 0.45, 4);
      coneGeom.rotateX(Math.PI);
      const coneMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexColor),
        side: THREE.DoubleSide
      });
      const cone = new THREE.Mesh(coneGeom, coneMat);
      cone.position.y = 1.2;
      group.add(cone);

      this.scene.add(group);
      this.remoteCursors.set(peerId, group);
    }

    group.position.set(x, 0.14, z);
  }

  private removeRemoteCursor(peerId: string) {
    const group = this.remoteCursors.get(peerId);
    if (group && this.scene) {
      this.scene.remove(group);
      this.remoteCursors.delete(peerId);
    }
  }

  private show3DPing(x: number, z: number, team: TeamId) {
    if (!this.scene) return;
    audio.playAlert();

    const hexColor = team === 'SUN' ? 0xfacc15 : 0xef4444;
    const ringGeom = new THREE.RingGeometry(0.2, 0.4, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const pingMesh = new THREE.Mesh(ringGeom, ringMat);
    pingMesh.position.set(x, 0.2, z);
    this.scene.add(pingMesh);

    // Expand & fade out animation
    let elapsed = 0;
    const animatePing = () => {
      elapsed += 0.03;
      const scale = 1.0 + elapsed * 5.0;
      pingMesh.scale.set(scale, 1, scale);
      ringMat.opacity = Math.max(0, 0.9 - elapsed * 1.5);
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

  public cleanup() {
    for (const group of this.remoteCursors.values()) {
      if (this.scene) this.scene.remove(group);
    }
    this.remoteCursors.clear();
    this.conn.disconnect();
  }
}
