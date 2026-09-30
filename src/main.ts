import * as THREE from 'three';
import { SceneRenderer } from './engine/Renderer';
import { CameraController } from './engine/Camera';
import { audio } from './engine/AudioSystem';
import { Grid, TileType, GridCoord } from './grid/Grid';
import { Pathfinder } from './grid/Pathfinder';
import { VFXManager } from './vfx/VFXManager';
import { TowerInstance, TowerManager } from './towers/TowerManager';
import { Unit, UnitManager } from './units/UnitManager';
import { TechTreeManager } from './campaign/TechTree';
import { UIManager } from './ui/UIManager';
import { CAMPAIGN_MISSIONS, CampaignMission } from './campaign/CampaignData';
import { FriendlyClass, EnemyClass } from './units/UnitData';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS } from './towers/TowerData';
import { PortalGuardian, PortalGuardianManager } from './towers/PortalGuardianManager';
import { AchievementManager } from './achievements/AchievementManager';
import { ArenaCastle } from './engine/ArenaCastle';
import { NetworkManager, SessionEndReason } from './network/NetworkManager';
import {
  GameAction,
  GameMode,
  HostEvent,
  PlayerSlot,
  StateSnapshot,
  WavePhase
} from './network/NetworkTypes';
import { FxRelay } from './network/FxRelay';
import {
  applyCastleState,
  applyGuardianStates,
  applyTowerStates,
  applyUnitStates,
  encodeCastle,
  encodeGuardians,
  encodeTowers,
  encodeUnit
} from './network/StateSync';
import { TeamId, TEAM_NAMES, ARENA_MIRROR_X, mirrorX, opponentOf, sideX } from './game/Teams';

/** Whoever performs a gameplay action: the solo player, or a player slot in a multiplayer match. */
interface Actor {
  peerId: string;
  name: string;
  team: TeamId;
  wallet: { gold: number };
  slot: PlayerSlot | null;
}

/** null on success, otherwise the reason the action was rejected. */
type ActionResult = string | null;

const TEAMS: TeamId[] = ['SUN', 'MOON'];
const SOLO_ACTOR_ID = 'local';
const SNAPSHOT_INTERVAL_MS = 100;
const GAME_SPEEDS = [1, 2, 4, 0];
const ARENA_MSG_POS = new THREE.Vector3(ARENA_MIRROR_X, 3, 0);
const MAZE_ORIGIN_X = -22;
const DEFAULT_CAMERA_X = -6;
const CAMERA_MIN_X = -45;
const CAMERA_MAX_X_SOLO = 44;

// PvP round flow
const PVP_FIRST_BUILD_TIME = 45;
const PVP_BUILD_TIME = 30;
/** Arena escalation: a clash still running after this many seconds deals double damage... */
const ESCALATION_START = 45;
/** ...and the multiplier doubles again every this many seconds. */
const ESCALATION_STEP = 15;
const PVP_STORM_TIME = 30;
const PVP_CASTLE_HP = 1500;
const pvpRoundReward = (roundIndex: number) => 75 + roundIndex * 15;

/** Barracks area of a team's maze island (recruit hiring feedback). */
const recruitMsgPos = (team: TeamId) => new THREE.Vector3(sideX(team, -34), 4, -12);

class GameApp {
  private container: HTMLElement;
  private renderer: SceneRenderer;
  private cameraCtrl: CameraController;
  private grids: Record<TeamId, Grid>;
  private pathfinders: Record<TeamId, Pathfinder>;
  private vfx: VFXManager;
  private fx: FxRelay;
  private towerManager: TowerManager;
  private unitManager: UnitManager;
  private arenaCastle: ArenaCastle;
  private moonCastle: ArenaCastle | null = null;
  private techTree: TechTreeManager;
  private ui: UIManager;
  private portalGuardianManager: PortalGuardianManager;
  public achievementManager: AchievementManager;
  public networkManager: NetworkManager;

  // Multiplayer sync
  private lastSnapshotTime: number = 0;
  private lastClientHudKey: string = '';
  private lastHostHudKey: string = '';
  private lastGuardianLevelsKey: string = '';
  /** The board currently holds a multiplayer match (possibly finished, awaiting "Back to Lobby"). */
  private multiplayerBoardActive: boolean = false;
  /** The board is laid out for PvP: mirrored Moon maze, two castles, army-vs-army rounds. */
  private pvpActive: boolean = false;

  // Game State
  private currentMission: CampaignMission;
  private currentWaveIndex: number = 0;
  private soloWallet = { gold: 250 };
  private castleHp: number = 800;
  private castleMaxHp: number = 800;
  private castleHpAtWaveStart: number = 3000;

  private gameSpeed: number = 1;
  private waveInProgress: boolean = false;
  private waveCleared: boolean = false;
  private recruitsToSpawn: Record<TeamId, number> = { SUN: 0, MOON: 0 };
  private recruitSpawnTimer: number = 0;

  // PvP timers (seconds of game time); null when not running
  private buildTimer: number | null = null;
  private stormTimer: number | null = null;
  /** Seconds the current arena clash has lasted, and the escalation tier reached (0 = none). */
  private clashTime: number = 0;
  private escalationLevel: number = 0;
  /** PvP round 1: players who voted to start before the build timer runs out. */
  private readyVotes = new Set<string>();

  // Army recruitment
  private readonly BASE_RECRUITS_PER_WAVE = 10;
  private extraPurchasedRecruits: Record<TeamId, number> = { SUN: 0, MOON: 0 };

  private getRecruitCost(team: TeamId): number {
    return Math.round(25 * Math.pow(1.8, this.extraPurchasedRecruits[team]));
  }

  // Phase and Mission lifecycle
  private wavePhase: WavePhase = 'IDLE';
  private missionEnded: boolean = false;

  // Raycasting & Mouse Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private lastPointerWorld = new THREE.Vector3();
  private placementGhost: THREE.Mesh | null = null;
  private ghostRangeRing: THREE.Group | null = null;
  private ghostBorderMesh: THREE.Mesh | null = null;
  private ghostFillMesh: THREE.Mesh | null = null;

  // Timing
  private lastFrameTime = performance.now();
  private bossSlowMoTimer: number = 0;

  // Focus Fire State (the local team's target)
  private isFocusFireMode: boolean = false;
  private focusTarget: Unit | null = null;
  private focusTargetReticle: THREE.Group | null = null;

  constructor() {
    this.container = document.getElementById('canvas-container')!;
    this.renderer = new SceneRenderer(this.container);
    this.cameraCtrl = new CameraController(this.container);
    this.grids = {
      SUN: new Grid(11, 15, 2, MAZE_ORIGIN_X, 0),
      MOON: new Grid(11, 15, 2, mirrorX(MAZE_ORIGIN_X), 0, true)
    };
    this.pathfinders = { SUN: new Pathfinder(this.grids.SUN), MOON: new Pathfinder(this.grids.MOON) };
    this.vfx = new VFXManager(this.renderer.scene, this.cameraCtrl.camera, this.container);
    this.fx = new FxRelay(this.vfx, audio);
    this.towerManager = new TowerManager(this.grids.SUN, this.grids.MOON, this.renderer.scene, this.vfx);
    this.unitManager = new UnitManager(this.renderer.scene, this.vfx, this.cameraCtrl.camera);
    this.arenaCastle = new ArenaCastle(this.renderer.scene, this.vfx, this.castleMaxHp);
    this.unitManager.setCastle('SUN', this.arenaCastle, () => this.handleCastleFallen('SUN'));
    this.portalGuardianManager = new PortalGuardianManager(this.renderer.scene, this.vfx, this.unitManager);
    this.techTree = new TechTreeManager();
    this.achievementManager = new AchievementManager();
    this.ui = new UIManager(document.getElementById('app')!);
    this.ui.init(this.towerManager, this.unitManager, this.techTree, this.achievementManager);

    this.networkManager = new NetworkManager();
    this.networkManager.setScene(this.renderer.scene);
    this.ui.initMultiplayer(this.networkManager);
    this.setupNetworkHandlers();

    this.towerManager.onChampionEvolved = () => {
      this.achievementManager.recordChampionEvolved();
    };

    this.achievementManager.onAchievementUnlocked = (ach, tier) => {
      this.ui.showAchievementToast(ach, tier);
      this.updateHUD();
    };
    this.achievementManager.recordCampaignStars(this.techTree.getTotalStarsEarned());

    this.currentMission = CAMPAIGN_MISSIONS[0];

    this.cameraCtrl.isPlacementMode = () => Boolean(this.ui.selectedTowerTypeForPlacement || this.isFocusFireMode);

    this.loadMission(this.currentMission);
    this.setupUIHandlers();
    this.setupPlacementGhost();
    this.setupMouseEvents();
    this.setupKeyboardEvents();

    // Check for auto-join room URL (?room=FORGE-XXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const autoJoinRoom = urlParams.get('room') || urlParams.get('join');
    if (autoJoinRoom) {
      this.ui.multiplayerModal.open('join', autoJoinRoom.toUpperCase());
    } else {
      this.ui.showTutorialModal();
    }

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  // --- Multiplayer role helpers ---

  /** Receiving the host's simulation; must not simulate or mutate authoritative state locally. */
  private get isClient(): boolean {
    return this.networkManager.isClientInMatch;
  }

  private get isHostInMatch(): boolean {
    return this.networkManager.isHostInMatch;
  }

  /** The team the local player commands (always Sun outside PvP). */
  private get localTeam(): TeamId {
    return this.networkManager.inMatch ? this.networkManager.localTeam : 'SUN';
  }

  /** Teams fielding a maze army this match. */
  private get armyTeams(): TeamId[] {
    return this.pvpActive ? TEAMS : ['SUN'];
  }

  /** PvP: the first round can be started early once every commander votes ready. */
  private get canVoteReady(): boolean {
    return this.pvpActive && this.currentWaveIndex === 0 && !this.waveInProgress && !this.missionEnded;
  }

  /** Players still in the match who get a ready vote. */
  private readyVoters(): string[] {
    return this.networkManager.getPlayerList().filter(p => !p.disconnected).map(p => p.peerId);
  }

  /** Host: start round 1 early once everyone still connected has voted ready. */
  private checkReadyVote() {
    if (!this.canVoteReady) return;
    const voters = this.readyVoters();
    if (voters.length > 0 && voters.every(id => this.readyVotes.has(id))) {
      this.vfx.spawnFloatingText(ARENA_MSG_POS.clone().add(new THREE.Vector3(0, 1, 0)), '✋ ALL COMMANDERS READY!', '#34d399', 2.0);
      this.startWave();
    }
  }

  /** Space / wave button: release the wave, or in PvP round 1 toggle the ready vote. */
  private requestPrimaryAction() {
    if (this.pvpActive) {
      if (this.canVoteReady) {
        this.requestAction({ kind: 'VOTE_READY', ready: !this.readyVotes.has(this.networkManager.localPeerId) });
      }
      return;
    }
    if (!this.waveInProgress) this.requestAction({ kind: 'START_WAVE' });
  }

  /** The local player's gold: the solo wallet, or this player's slot in a multiplayer match. */
  private get playerGold(): number {
    return this.getLocalActor()?.wallet.gold ?? 0;
  }

  private getActor(peerId: string): Actor | null {
    if (!this.networkManager.inMatch) {
      return { peerId: SOLO_ACTOR_ID, name: 'Commander', team: 'SUN', wallet: this.soloWallet, slot: null };
    }
    const slot = this.networkManager.getPlayer(peerId);
    if (!slot) return null;
    return { peerId, name: slot.name, team: slot.team, wallet: slot, slot };
  }

  private getLocalActor(): Actor | null {
    return this.getActor(this.networkManager.inMatch ? this.networkManager.localPeerId : SOLO_ACTOR_ID);
  }

  private isLocalActor(actor: Actor): boolean {
    return actor.peerId === SOLO_ACTOR_ID || actor.peerId === this.networkManager.localPeerId;
  }

  /**
   * Players manage their own towers; towers of teammates who left can be managed by the rest of the team.
   * The opposing team's towers are view-only.
   */
  private canManageTower(actor: Actor, tower: TowerInstance): boolean {
    if (!this.networkManager.inMatch) return true;
    if (tower.team !== actor.team) return false;
    if (!tower.ownerPeerId || tower.ownerPeerId === actor.peerId) return true;
    return !this.networkManager.isPlayerPresent(tower.ownerPeerId);
  }

  /** UI feedback for the local player only; never replicated to other peers. */
  private localToast(pos: THREE.Vector3, text: string, color: string = '#ef4444', duration: number = 1.5, errorSound: boolean = false) {
    this.fx.local(() => {
      if (errorSound) audio.playDefeat();
      this.vfx.spawnFloatingText(pos, text, color, duration);
    });
  }

  private showActionError(reason: string, action: GameAction) {
    this.localToast(this.feedbackPosFor(action), reason, '#ef4444', 1.6, true);
  }

  /** Where to show feedback about an action: at the tower/guardian involved, else where the player pointed. */
  private feedbackPosFor(action: GameAction): THREE.Vector3 {
    switch (action.kind) {
      case 'UPGRADE_TOWER':
      case 'EVO_UPGRADE':
      case 'SELL_TOWER': {
        const tower = this.towerManager.towers.get(action.towerId);
        if (tower) return tower.worldPos.clone().add(new THREE.Vector3(0, 1.5, 0));
        break;
      }
      case 'UPGRADE_GUARDIAN': {
        const guardian = this.portalGuardianManager.getGuardian(action.guardianId);
        if (guardian) return guardian.position.clone().add(new THREE.Vector3(0, 3.5, 0));
        break;
      }
      case 'BUY_RECRUIT':
        return recruitMsgPos(this.localTeam);
      case 'START_WAVE':
      case 'SET_GAME_SPEED':
        return ARENA_MSG_POS.clone();
      case 'VOTE_READY':
        return ARENA_MSG_POS.clone();
    }
    return this.lastPointerWorld.clone().add(new THREE.Vector3(0, 1.5, 0));
  }

  // --- Action pipeline ---

  /**
   * Entry point for every gameplay action the local player performs. Solo play executes immediately;
   * in a match the action goes to the host (directly if we are the host) for validation.
   */
  private requestAction(action: GameAction) {
    if (this.networkManager.inMatch) {
      this.networkManager.sendAction(action);
      return;
    }
    const actor = this.getLocalActor();
    if (!actor) return;
    const rejection = this.executeAction(actor, action);
    if (rejection) this.showActionError(rejection, action);
  }

  /**
   * Validates and applies an action. Runs in solo play and on the multiplayer host (for every player);
   * never on multiplayer clients. Action payloads from peers are untrusted.
   */
  private executeAction(actor: Actor, action: GameAction): ActionResult {
    if (this.missionEnded) return 'The battle is over.';

    switch (action.kind) {
      case 'BUILD_TOWER': {
        const { coord, towerType } = action;
        const def = TOWER_DEFINITIONS[towerType];
        if (!def || !isGridCoord(coord)) return 'Invalid tower placement.';
        const check = this.towerManager.canBuild(coord, towerType, actor.wallet.gold, actor.team);
        if (!check.allowed) return check.reason || 'Cannot build here!';

        const tower = this.towerManager.buildTower(coord, towerType, undefined, actor.peerId, actor.name, actor.team);
        if (!tower) return 'Cannot build here!';
        actor.wallet.gold -= def.cost;

        if (this.isHostInMatch) {
          this.vfx.spawnFloatingText(tower.worldPos.clone(), `🏗️ ${actor.name} BUILT ${def.name}!`, '#38bdf8', 1.8);
          this.networkManager.broadcastEvent({ kind: 'TOWER_BUILT', id: tower.id, team: actor.team, ownerPeerId: actor.peerId, towerType, coord });
        }
        this.updatePlacementGhost();
        this.updateHUD();
        return null;
      }

      case 'UPGRADE_TOWER': {
        const tower = this.towerManager.towers.get(action.towerId);
        if (!tower) return 'Tower not found.';
        if (!isUpgradeBranch(action.branch)) return 'Invalid upgrade.';
        if (!this.canManageTower(actor, tower)) return '⛔ Only the builder can upgrade this tower!';

        const res = this.towerManager.upgradeTower(tower.id, action.branch, actor.wallet.gold);
        if (!res.success) return res.reason || 'Cannot upgrade this tower.';
        actor.wallet.gold -= res.cost;
        if (tower.level >= 10 && this.isLocalActor(actor)) {
          this.achievementManager.recordTowerMaxed(tower.type);
        }

        this.networkManager.broadcastEvent({ kind: 'TOWER_UPGRADED', id: tower.id, branch: action.branch });
        this.refreshTowerCardIfOpen(tower);
        this.updateHUD();
        return null;
      }

      case 'EVO_UPGRADE': {
        const tower = this.towerManager.towers.get(action.towerId);
        if (!tower) return 'Tower not found.';
        if (![1, 2, 3, 4].includes(action.abilityIndex)) return 'Invalid ability.';
        if (!this.canManageTower(actor, tower)) return '⛔ Only the builder can evolve this tower!';

        const res = this.towerManager.upgradeEvoAbility(tower.id, action.abilityIndex, actor.wallet.gold);
        if (!res.success) return res.reason || 'Cannot upgrade this ability.';
        actor.wallet.gold -= res.cost;
        if (this.isLocalActor(actor) && tower.ability1Level >= 10 && tower.ability2Level >= 10 && tower.ability3Level >= 10 && tower.ability4Level >= 10) {
          this.achievementManager.recordTowerMaxed(TowerType.EVOLUTION);
        }

        this.networkManager.broadcastEvent({ kind: 'EVO_UPGRADED', id: tower.id, abilityIndex: action.abilityIndex });
        this.refreshTowerCardIfOpen(tower);
        this.updateHUD();
        return null;
      }

      case 'SELL_TOWER': {
        const tower = this.towerManager.towers.get(action.towerId);
        if (!tower) return 'Tower not found.';
        if (!this.canManageTower(actor, tower)) return '⛔ Only the builder can sell this tower!';

        const pos = tower.worldPos.clone();
        const refund = this.removeTower(tower.id);
        actor.wallet.gold += refund;
        if (this.isHostInMatch) {
          this.vfx.spawnFloatingText(pos, `💰 ${actor.name} SOLD TOWER (+${refund}g)`, '#94a3b8', 1.8);
        }
        this.networkManager.broadcastEvent({ kind: 'TOWER_SOLD', id: tower.id });
        this.updateHUD();
        return null;
      }

      case 'BUY_RECRUIT': {
        if (this.wavePhase === 'ARENA_CLASH') return 'Cannot recruit during Arena Clash!';
        const team = actor.team;
        const cost = this.getRecruitCost(team);
        if (actor.wallet.gold < cost) return `Need 🪙${cost}g for Recruit!`;

        actor.wallet.gold -= cost;
        this.extraPurchasedRecruits[team]++;
        const totalRecruits = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits[team];
        const nextCost = this.getRecruitCost(team);
        const hirer = this.networkManager.inMatch ? `${actor.name}: ` : '';
        const msgPos = recruitMsgPos(team);
        audio.playBuild();

        if (this.wavePhase === 'MAZE_RUN') {
          this.recruitsToSpawn[team]++;
          this.vfx.spawnFloatingText(msgPos, `🛡️ ${hirer}RECRUIT REINFORCEMENT! (${totalRecruits} total, next 🪙${nextCost}g)`, '#38bdf8', 2.0);
        } else {
          this.vfx.spawnFloatingText(msgPos, `🛡️ ${hirer}+1 RECRUIT HIRED! (${totalRecruits} total, next 🪙${nextCost}g)`, '#38bdf8', 2.0);
        }
        this.vfx.spawnAscensionPillar(new THREE.Vector3(msgPos.x, 0, msgPos.z), 0x38bdf8);
        this.updateHUD();
        return null;
      }

      case 'START_WAVE':
        if (this.pvpActive) return 'Rounds start automatically when the build timer runs out.';
        this.startWave(this.networkManager.inMatch ? actor.name : undefined);
        return null;

      case 'VOTE_READY': {
        if (!this.canVoteReady) return 'Ready votes only apply before the first round.';
        const wasReady = this.readyVotes.has(actor.peerId);
        if (action.ready === wasReady) return null;
        if (action.ready) this.readyVotes.add(actor.peerId);
        else this.readyVotes.delete(actor.peerId);

        const count = this.readyVoters().filter(id => this.readyVotes.has(id)).length;
        this.vfx.spawnFloatingText(
          ARENA_MSG_POS.clone(),
          `${action.ready ? '✋' : '⏸️'} ${actor.name} ${action.ready ? 'IS READY' : 'NEEDS MORE TIME'} (${count}/${this.readyVoters().length})`,
          action.ready ? '#34d399' : '#94a3b8',
          1.8
        );
        this.updateHUD();
        this.checkReadyVote();
        return null;
      }

      case 'UPGRADE_GUARDIAN': {
        const guardian = this.portalGuardianManager.getGuardian(action.guardianId);
        if (!guardian || !guardian.group.visible) return 'Unknown guardian.';
        if (action.upgradeType !== 'damage' && action.upgradeType !== 'range') return 'Invalid upgrade.';
        if (guardian.team !== actor.team) return "You can only upgrade your own team's ballistae.";
        return this.upgradeGuardian(actor, guardian, action.upgradeType);
      }

      case 'SET_FOCUS': {
        if (action.unitId === null) {
          this.setFocusTarget(null, actor.team);
          return null;
        }
        const target = this.unitManager.units.find(u => u.id === action.unitId && u.team !== actor.team && !u.isDead && !u.isDying);
        if (target) this.setFocusTarget(target, actor.team);
        return null;
      }

      case 'TOGGLE_SMART_FOCUS': {
        const active = this.towerManager.toggleSmartFocus(actor.team);
        audio.playUpgrade();
        this.vfx.spawnFloatingText(
          new THREE.Vector3(sideX(actor.team, 0), 3, 0),
          `🎯 ${this.pvpActive ? `${TEAM_NAMES[actor.team].toUpperCase()} ` : ''}SMART FOCUS: ${active ? 'ON (Champions First)' : 'OFF (Lead Recruits)'}`,
          active ? '#a5b4fc' : '#94a3b8',
          1.4
        );
        this.updateHUD();
        if (this.towerManager.selectedTower) this.refreshTowerCardIfOpen(this.towerManager.selectedTower);
        return null;
      }

      case 'SET_GAME_SPEED': {
        if (this.networkManager.inMatch && actor.peerId !== this.networkManager.localPeerId) {
          return 'Only the host can change the game speed.';
        }
        if (!GAME_SPEEDS.includes(action.speed)) return 'Invalid game speed.';
        this.gameSpeed = action.speed;
        this.updateHUD();
        return null;
      }
    }
    return 'Unknown action.';
  }

  // --- UI & network wiring ---

  private setupUIHandlers() {
    this.ui.onStartWave = () => this.requestPrimaryAction();
    this.ui.onBuyRecruit = () => this.requestAction({ kind: 'BUY_RECRUIT' });
    this.ui.onToggleFocusFire = () => this.toggleFocusFireMode();
    this.ui.onClearFocusTarget = () => this.requestAction({ kind: 'SET_FOCUS', unitId: null });
    this.ui.onToggleSmartFocus = () => this.requestAction({ kind: 'TOGGLE_SMART_FOCUS' });
    this.ui.onSelectTowerPlacement = (type) => {
      if (type) {
        if (this.towerManager.selectedTower) {
          this.towerManager.selectTower(null);
          this.ui.hideTowerCard();
        }
        if (this.unitManager.selectedUnit) {
          this.unitManager.selectUnit(null);
          this.ui.hideUnitCard();
        }
      }
      this.updatePlacementGhost();
    };
    this.ui.onSetGameSpeed = (speed: number) => this.requestAction({ kind: 'SET_GAME_SPEED', speed });
    this.ui.onSelectMission = (mission: CampaignMission) => {
      if (this.multiplayerBoardActive) {
        this.localToast(ARENA_MSG_POS, 'Leave the multiplayer match before starting a campaign mission.', '#f87171', 2.0, true);
        return;
      }
      this.loadMission(mission);
    };
  }

  private setupNetworkHandlers() {
    const nm = this.networkManager;

    nm.onMatchStarted = (mode, missionId) => this.startMultiplayerMatch(mode, missionId);

    // Host: validate & execute actions from any player (including itself); replicate their VFX.
    nm.onGameAction = (peerId, action) => {
      const actor = this.getActor(peerId);
      if (!actor) return;
      const rejection = this.fx.record(() => this.executeAction(actor, action));
      if (!rejection) return;
      if (peerId === nm.localPeerId) {
        this.showActionError(rejection, action);
      } else {
        nm.sendEventTo(peerId, { kind: 'ACTION_REJECTED', reason: rejection, action });
      }
    };

    nm.onHostEvent = (event) => this.applyHostEvent(event);
    nm.onSnapshot = (snapshot) => this.applySnapshot(snapshot);
    nm.onSessionEnded = (reason, detail) => this.handleSessionEnded(reason, detail);
  }

  /** Client: apply a discrete world change made by the host. Its VFX arrive via FX replay, so they are muted here. */
  private applyHostEvent(event: HostEvent) {
    switch (event.kind) {
      case 'TOWER_BUILT': {
        const owner = this.networkManager.getPlayer(event.ownerPeerId);
        this.fx.mute(() => this.towerManager.buildTower(event.coord, event.towerType, event.id, event.ownerPeerId, owner?.name ?? 'Teammate', event.team));
        this.updatePlacementGhost();
        this.updateHUD();
        break;
      }

      case 'TOWER_UPGRADED': {
        const tower = this.towerManager.towers.get(event.id);
        if (!tower) break;
        this.fx.mute(() => this.towerManager.upgradeTower(event.id, event.branch, Infinity));
        this.refreshTowerCardIfOpen(tower);
        break;
      }

      case 'EVO_UPGRADED': {
        const tower = this.towerManager.towers.get(event.id);
        if (!tower) break;
        this.fx.mute(() => this.towerManager.upgradeEvoAbility(event.id, event.abilityIndex, Infinity));
        this.refreshTowerCardIfOpen(tower);
        break;
      }

      case 'TOWER_SOLD':
        this.fx.mute(() => this.removeTower(event.id));
        this.updatePlacementGhost();
        this.updateHUD();
        break;

      case 'ACTION_REJECTED':
        this.showActionError(event.reason, event.action);
        break;

      case 'MATCH_END':
        this.missionEnded = true;
        this.waveInProgress = false;
        this.showMatchResult(event.winningTeam, event.isCoopVictory);
        break;
    }
  }

  private startMultiplayerMatch(mode: GameMode, missionId: number) {
    this.ui.multiplayerModal.close();
    this.ui.hideResultModals();
    this.fx.clear();
    this.multiplayerBoardActive = true;
    this.gameSpeed = 1;
    this.lastClientHudKey = '';
    this.lastGuardianLevelsKey = '';
    this.toggleFocusFireMode(false);
    this.setPvpLayout(mode === 'PVP');

    const mission = CAMPAIGN_MISSIONS.find(m => m.id === missionId) || CAMPAIGN_MISSIONS[0];
    this.loadMission(mission);

    if (this.pvpActive) {
      this.vfx.spawnFloatingText(ARENA_MSG_POS, '⚔️ CLASH OF STRONGHOLDS! BUILD YOUR MAZE! ⚔️', '#ef4444', 3.0);
    } else {
      this.vfx.spawnFloatingText(ARENA_MSG_POS, '🤝 CO-OP ALLIED BASTION DEFENSE! 🤝', '#38bdf8', 3.0);
    }

    this.updateHUD();
  }

  /** Switches the battlefield between the solo/co-op layout and the mirrored PvP layout. */
  private setPvpLayout(enabled: boolean) {
    this.pvpActive = enabled;
    this.unitManager.pvpMode = enabled;
    this.portalGuardianManager.setPvpMode(enabled);
    this.renderer.setPvpLayout(enabled, this.grids.SUN);
    this.towerManager.viewTeam = this.localTeam;

    if (enabled) {
      if (!this.moonCastle) {
        this.moonCastle = new ArenaCastle(this.renderer.scene, this.vfx, PVP_CASTLE_HP, new THREE.Vector3(mirrorX(-0.4), 0, 0), true);
      }
      this.moonCastle.group.visible = true;
      this.unitManager.setCastle('MOON', this.moonCastle, () => this.handleCastleFallen('MOON'));
      this.cameraCtrl.setPanRange(CAMERA_MIN_X, mirrorX(CAMERA_MIN_X));
      this.cameraCtrl.focusOn(sideX(this.localTeam, DEFAULT_CAMERA_X));
    } else {
      this.unitManager.setCastle('MOON', null);
      if (this.moonCastle) this.moonCastle.group.visible = false;
      this.cameraCtrl.setPanRange(CAMERA_MIN_X, CAMERA_MAX_X_SOLO);
      this.cameraCtrl.focusOn(DEFAULT_CAMERA_X);
    }
  }

  /** Restores a clean solo board after a multiplayer match. */
  private resetToSoloBoard() {
    if (!this.multiplayerBoardActive) return;
    this.multiplayerBoardActive = false;
    this.ui.hideResultModals();
    this.fx.clear();
    this.gameSpeed = 1;
    this.toggleFocusFireMode(false);
    this.setPvpLayout(false);
    this.loadMission(this.currentMission);
  }

  private returnToLobby() {
    this.resetToSoloBoard();
    if (this.networkManager.isInRoom) {
      this.ui.multiplayerModal.open(this.networkManager.isHost ? 'host' : 'join');
    }
  }

  private handleSessionEnded(reason: SessionEndReason, detail?: string) {
    this.resetToSoloBoard();
    if (reason === 'left') return;
    this.ui.multiplayerModal.setStatusMessage(detail ?? 'Disconnected from the room.');
    if (!this.ui.multiplayerModal.isOpen()) {
      this.ui.multiplayerModal.open(reason === 'rejected' ? 'join' : 'host');
    }
  }

  /** Host: ends the match for everyone. */
  private finishMultiplayerMatch(winningTeam: TeamId, isCoopVictory: boolean) {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.waveInProgress = false;
    this.wavePhase = 'IDLE';
    this.buildTimer = null;
    this.stormTimer = null;

    if (!isCoopVictory) {
      const losingCastle = winningTeam === 'SUN' ? this.moonCastle : this.arenaCastle;
      if (losingCastle && !losingCastle.isDestroyed) losingCastle.triggerDestruction();
    }

    // Flush the final state (including the destruction VFX) before announcing the result.
    this.broadcastStateSnapshot();
    this.networkManager.broadcastEvent({ kind: 'MATCH_END', winningTeam, isCoopVictory });
    this.networkManager.endMatch();
    this.showMatchResult(winningTeam, isCoopVictory);
  }

  private showMatchResult(winningTeam: TeamId, isCoopVictory: boolean) {
    const isCoop = this.networkManager.mode === 'COOP';
    const won = isCoop ? isCoopVictory : this.networkManager.localTeam === winningTeam;
    const winnerName = TEAM_NAMES[winningTeam];

    setTimeout(() => {
      if (won) {
        this.ui.showVictory(3, () => this.returnToLobby(), null, {
          next: 'Back to Lobby',
          message: isCoop ? 'Your alliance held the line against every wave!' : `Team ${winnerName} razed the enemy stronghold!`
        });
      } else {
        this.ui.showDefeat(() => this.returnToLobby(), {
          retry: 'Back to Lobby',
          message: isCoop ? 'The allied stronghold was overrun!' : `Team ${winnerName} razed your stronghold!`
        });
      }
    }, 1200);
  }

  // --- State snapshots ---

  private broadcastStateSnapshot() {
    if (!this.isHostInMatch) return;

    const economy: StateSnapshot['economy'] = {};
    for (const p of this.networkManager.players.values()) {
      economy[p.peerId] = p.gold;
    }
    const aliveFocus = (team: TeamId) => {
      const t = this.unitManager.focusTargets[team];
      return t && !t.isDead ? t.id : null;
    };

    this.networkManager.broadcastSnapshot({
      waveIndex: this.currentWaveIndex,
      wavePhase: this.wavePhase,
      waveInProgress: this.waveInProgress,
      extraRecruits: [this.extraPurchasedRecruits.SUN, this.extraPurchasedRecruits.MOON],
      gameSpeed: this.gameSpeed,
      smartFocus: [this.towerManager.isSmartFocus('SUN'), this.towerManager.isSmartFocus('MOON')],
      focusUnitIds: [aliveFocus('SUN'), aliveFocus('MOON')],
      buildTimer: this.buildTimer,
      stormTimer: this.stormTimer,
      readyVotes: Array.from(this.readyVotes),
      sunCastle: encodeCastle(this.arenaCastle),
      moonCastle: this.pvpActive && this.moonCastle ? encodeCastle(this.moonCastle) : null,
      economy,
      units: this.unitManager.units.filter(u => !u.isDead).map(encodeUnit),
      towers: encodeTowers(this.towerManager),
      guardians: encodeGuardians(this.portalGuardianManager),
      fx: this.fx.flush()
    });
  }

  /** Client: mirror the host's authoritative state. */
  private applySnapshot(s: StateSnapshot) {
    this.fx.replay(s.fx);

    const waveChanged = s.waveIndex !== this.currentWaveIndex;
    this.currentWaveIndex = s.waveIndex;
    this.wavePhase = s.wavePhase;
    this.waveInProgress = s.waveInProgress;
    this.extraPurchasedRecruits = { SUN: s.extraRecruits[0], MOON: s.extraRecruits[1] };
    this.gameSpeed = s.gameSpeed;
    this.buildTimer = s.buildTimer;
    this.stormTimer = s.stormTimer;
    this.readyVotes = new Set(s.readyVotes);
    this.towerManager.setSmartFocus('SUN', s.smartFocus[0]);
    this.towerManager.setSmartFocus('MOON', s.smartFocus[1]);
    if (waveChanged) this.toggleFocusFireMode(false);

    applyCastleState(this.arenaCastle, s.sunCastle);
    this.castleHp = this.arenaCastle.currentHp;
    this.castleMaxHp = this.arenaCastle.maxHp;
    if (s.moonCastle && this.moonCastle) applyCastleState(this.moonCastle, s.moonCastle);

    applyUnitStates(this.unitManager, s.units, (unit) => {
      if (!unit.isFriendly) this.achievementManager.recordKill(unit.unitClass as EnemyClass, unit.isBoss);
    });
    applyTowerStates(this.towerManager, s.towers);
    applyGuardianStates(this.portalGuardianManager, s.guardians);

    // Guardian levels changed (someone upgraded): refresh an open guardian card
    const guardianKey = s.guardians.map(g => `${g[0]}:${g[1]}:${g[2]}`).join('|');
    if (guardianKey !== this.lastGuardianLevelsKey) {
      this.lastGuardianLevelsKey = guardianKey;
      const selected = this.portalGuardianManager.getSelectedGuardian();
      if (selected && this.ui.isGuardianCardOpen()) this.openGuardianCard(selected);
    }

    // The local team's shared focus-fire target
    const focusId = s.focusUnitIds[this.localTeam === 'SUN' ? 0 : 1];
    if ((this.focusTarget?.id ?? null) !== focusId) {
      const target = focusId === null ? null : this.unitManager.units.find(u => u.id === focusId && !u.isDying) ?? null;
      this.focusTarget = target;
      this.portalGuardianManager.setFocusTarget(target, this.localTeam);
      this.updateFocusVisuals();
    }

    // Re-rendering the HUD rebuilds its buttons, so only do it when something visible changed
    const hudKey = [this.hudKey(), s.moonCastle?.[0]].join(',');
    if (hudKey !== this.lastClientHudKey) {
      this.lastClientHudKey = hudKey;
      this.updateHUD();
    }
  }

  /** Summary of everything the top bar shows that changes during play. */
  private hudKey(): string {
    return [
      this.playerGold, this.castleHp, this.castleMaxHp, this.moonCastle?.currentHp,
      this.currentWaveIndex, this.wavePhase, this.waveInProgress, this.gameSpeed,
      this.extraPurchasedRecruits.SUN, this.extraPurchasedRecruits.MOON,
      this.towerManager.smartFocusEnabled,
      this.countAssembledRecruits('SUN'), this.countAssembledRecruits('MOON'),
      this.buildTimer === null ? '' : Math.ceil(this.buildTimer),
      this.stormTimer === null ? '' : Math.ceil(this.stormTimer),
      Array.from(this.readyVotes).sort().join('+'), this.canVoteReady
    ].join(',');
  }

  // --- Economy helpers (solo player / multiplayer host) ---

  private towerOwnerSlot(tower: TowerInstance): PlayerSlot | null {
    if (!this.networkManager.inMatch || !tower.ownerPeerId) return null;
    const owner = this.networkManager.getPlayer(tower.ownerPeerId);
    return owner && !owner.disconnected ? owner : null;
  }

  /** Pays a tower's gold output to its owner (or splits it across the owner's team if they left). */
  private creditTowerGold(tower: TowerInstance, amount: number) {
    if (!this.networkManager.inMatch) {
      this.soloWallet.gold += amount;
      this.achievementManager.recordGold(amount);
      return;
    }
    const owner = this.towerOwnerSlot(tower);
    if (owner) {
      owner.gold += amount;
    } else {
      this.networkManager.awardTeamGold(tower.team, amount);
    }
    if (tower.ownerPeerId === this.networkManager.localPeerId) {
      this.achievementManager.recordGold(amount);
    }
  }

  /** A bounty for a slain unit goes to the opposing team. */
  private awardKillBounty(bounty: number, killed: Unit) {
    const killerTeam = opponentOf(killed.team);
    if (this.networkManager.inMatch) {
      this.networkManager.awardTeamGold(killerTeam, bounty);
    } else {
      this.soloWallet.gold += bounty;
    }
    if (killerTeam === this.localTeam) {
      this.achievementManager.recordGold(bounty);
      if (!killed.isFriendly) {
        this.achievementManager.recordKill(killed.unitClass as EnemyClass, killed.isBoss);
      }
    }
    this.updateHUD();
  }

  private setupPlacementGhost() {
    const geom = new THREE.CylinderGeometry(0.85, 0.95, 0.4, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      roughness: 0.3
    });
    this.placementGhost = new THREE.Mesh(geom, mat);
    this.placementGhost.visible = false;
    this.renderer.scene.add(this.placementGhost);

    this.ghostRangeRing = new THREE.Group();
    this.ghostRangeRing.position.y = 0.14;
    this.ghostRangeRing.renderOrder = 30;

    const fillGeom = new THREE.CircleGeometry(1, 48);
    fillGeom.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x15803d,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide
    });
    this.ghostFillMesh = new THREE.Mesh(fillGeom, fillMat);
    this.ghostFillMesh.renderOrder = 29;
    this.ghostRangeRing.add(this.ghostFillMesh);

    const ringGeom = new THREE.RingGeometry(0.85, 1, 48);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide
    });
    this.ghostBorderMesh = new THREE.Mesh(ringGeom, ringMat);
    this.ghostBorderMesh.renderOrder = 30;
    this.ghostRangeRing.add(this.ghostBorderMesh);

    this.ghostRangeRing.visible = false;
    this.renderer.scene.add(this.ghostRangeRing);
  }

  private loadMission(mission: CampaignMission) {
    this.currentMission = mission;
    this.currentWaveIndex = 0;
    this.waveInProgress = false;
    this.waveCleared = false;
    this.missionEnded = false;
    this.wavePhase = 'IDLE';
    this.extraPurchasedRecruits = { SUN: 0, MOON: 0 };
    this.recruitsToSpawn = { SUN: 0, MOON: 0 };
    this.resetEscalation();
    this.stormTimer = null;
    this.buildTimer = this.pvpActive ? PVP_FIRST_BUILD_TIME : null;
    this.readyVotes.clear();
    this.setFocusTarget(null, 'SUN');
    this.setFocusTarget(null, 'MOON');

    // Multiplayer starting gold is set per player by the host
    if (!this.networkManager.inMatch) {
      this.soloWallet.gold = mission.startingGold + this.techTree.getBonusStartingGold();
    }
    const castleHp = this.pvpActive ? PVP_CASTLE_HP : mission.castleMaxHp;
    this.castleHp = castleHp;
    this.castleMaxHp = castleHp;
    this.arenaCastle.reset(castleHp);
    if (this.pvpActive && this.moonCastle) this.moonCastle.reset(castleHp);

    this.unitManager.clearAll();
    this.portalGuardianManager.resetAll();
    this.ui.hideGuardianCard();
    this.ui.hideTowerCard();
    this.ui.hideUnitCard();
    for (const id of Array.from(this.towerManager.towers.keys())) {
      this.towerManager.sellTower(id);
    }
    this.grids.SUN.resetGrid();
    this.grids.MOON.resetGrid();
    this.renderer.buildRoadVisuals(this.grids.SUN);

    this.prepareWaveEnemiesInArena();
    this.updateHUD();
  }

  private prepareWaveEnemiesInArena() {
    // Multiplayer clients receive the host's enemies through snapshots; PvP has no AI waves
    if (this.isClient || this.pvpActive) return;

    for (const u of this.unitManager.units.filter(u => !u.isFriendly)) {
      this.unitManager.despawnUnit(u);
    }

    const currentWave = this.currentMission.waves[this.currentWaveIndex];
    if (!currentWave) return;

    let col = 0;
    let row = 0;

    for (const group of currentWave.enemies) {
      for (let count = 0; count < group.count; count++) {
        const x = 20.5 - col * 1.6;
        const z = -3.5 + row * 2.3;
        const spawnPos = new THREE.Vector3(x, 0.4, z);

        const enemy = this.unitManager.spawnEnemy(group.enemyClass, spawnPos, false, this.currentWaveIndex);
        if (enemy) {
          enemy.isWaitingInArena = true;
          enemy.inCombat = false;
        }

        row++;
        if (row >= 4) {
          row = 0;
          col++;
        }
      }
    }
  }

  /** Releases the maze armies (the wave in solo/co-op, both teams' recruits in a PvP round). */
  private startWave(starterName?: string) {
    if (this.waveInProgress || this.missionEnded) return;
    if (!this.pvpActive && this.currentWaveIndex >= this.currentMission.waves.length) return;

    this.waveInProgress = true;
    this.waveCleared = false;
    this.wavePhase = 'MAZE_RUN';
    this.buildTimer = null;
    this.stormTimer = null;
    this.readyVotes.clear();
    this.towerManager.resetWaveEvolutions();

    for (const team of this.armyTeams) {
      this.recruitsToSpawn[team] = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits[team];
    }
    this.recruitSpawnTimer = 0;
    this.castleHpAtWaveStart = this.castleHp;

    audio.playBuild();
    if (this.pvpActive) {
      this.vfx.spawnFloatingText(ARENA_MSG_POS, `⚔️ ROUND ${this.currentWaveIndex + 1}: ARMIES MARCH! ⚔️`, '#facc15', 2.2);
    } else if (starterName) {
      this.vfx.spawnFloatingText(ARENA_MSG_POS, `⚔️ ${starterName} RELEASED WAVE ${this.currentWaveIndex + 1}! ⚔️`, '#facc15', 2.0);
    }
    this.updateHUD();
  }

  private triggerArenaClash() {
    this.wavePhase = 'ARENA_CLASH';
    this.resetEscalation();
    audio.playEvolution();
    this.vfx.spawnFloatingText(ARENA_MSG_POS, '⚔️ THE ARENA CLASH BEGINS! CHARGE! ⚔️', '#facc15', 3.0);
    this.vfx.spawnAscensionPillar(new THREE.Vector3(2, 0, 0), 0x38bdf8);
    this.vfx.spawnAscensionPillar(new THREE.Vector3(this.pvpActive ? mirrorX(2) : 22, 0, 0), 0xef4444);

    for (const u of this.unitManager.units) {
      if (u.isDead) continue;
      u.inCombat = true;
      u.stagingPos = null;
      u.isWaitingInArena = false;
    }

    this.updateHUD();
  }

  private resetEscalation() {
    this.clashTime = 0;
    this.escalationLevel = 0;
    this.unitManager.damageMultiplier = 1;
  }

  /** Long clashes escalate: x2 unit damage at 45s, doubling every 15s after, so no fight stalls forever. */
  private updateEscalation(dt: number) {
    this.clashTime += dt;
    if (this.clashTime < ESCALATION_START) return;
    const level = 1 + Math.floor((this.clashTime - ESCALATION_START) / ESCALATION_STEP);
    if (level === this.escalationLevel) return;
    this.escalationLevel = level;
    const mult = 2 ** level;
    this.unitManager.damageMultiplier = mult;
    audio.playBossSlam();
    this.vfx.spawnFloatingText(ARENA_MSG_POS, `🔥 ESCALATION! ALL UNIT DAMAGE x${mult} 🔥`, '#f97316', 2.5);
  }

  private spawnFriendlyRecruit(team: TeamId) {
    const grid = this.grids[team];
    const spawnWorld = grid.gridToWorld(grid.spawnCoord.x, grid.spawnCoord.z);
    const startPos = new THREE.Vector3(spawnWorld.x, 0.4, spawnWorld.z);
    const waypoints = this.pathfinders[team].getWorldPath();

    const unit = this.unitManager.spawnFriendly(FriendlyClass.RECRUIT, startPos, waypoints, team);

    // Warrior Heritage Tech Tree bonus (the host's campaign progress; skipped in PvP to keep it fair)
    if (!this.pvpActive) {
      const bonusHp = this.techTree.getBonusRecruitHp();
      unit.maxHp += bonusHp;
      unit.currentHp += bonusHp;
      unit.armor += this.techTree.getBonusRecruitArmor();
    }
  }

  /** Round-end income shared by all modes: Vault interest, stacking towers, evolution recharge. */
  private applyRoundEndTowerEffects() {
    // Vault Reserve Gold Spires pay interest on their owner's reserve
    for (const tower of this.towerManager.towers.values()) {
      if (tower.type === TowerType.GOLD && tower.currentBranch === UpgradeBranch.BRANCH_B) {
        const curUpg = this.towerManager.getCurrentUpgrade(tower) || TOWER_DEFINITIONS[TowerType.GOLD].branchB[0];
        const ownerGold = this.networkManager.inMatch ? (this.towerOwnerSlot(tower)?.gold ?? 0) : this.soloWallet.gold;
        const interest = Math.min(
          curUpg.roundInterestCap ?? Infinity,
          Math.round(ownerGold * (curUpg.roundInterestPercent ?? 0.05))
        );
        const payout = Math.max(curUpg.roundFlatGold ?? 10, interest);
        this.creditTowerGold(tower, payout);
        tower.totalBuffApplied += payout;
        audio.playGoldGain();
        this.vfx.spawnFloatingText(tower.worldPos.clone().add(new THREE.Vector3(0, 2, 0)), `VAULT INTEREST: +${payout}g`, '#facc15', 2.0);
      }
    }

    for (const ev of this.towerManager.applyRoundEndStacking()) {
      audio.playUpgrade();
      this.vfx.spawnAscensionPillar(ev.pos, 0x22c55e);
      this.vfx.spawnFloatingText(ev.pos, ev.message, ev.color, 2.5);
    }
    if (this.towerManager.selectedTower) {
      this.refreshTowerCardIfOpen(this.towerManager.selectedTower);
    }
    this.towerManager.resetWaveEvolutions();
  }

  /** Clears round state shared by all modes and moves to the next wave/round. */
  private advanceRound() {
    this.currentWaveIndex++;
    this.resetEscalation();
    this.extraPurchasedRecruits = { SUN: 0, MOON: 0 };
    this.setFocusTarget(null, 'SUN');
    this.setFocusTarget(null, 'MOON');
    this.toggleFocusFireMode(false);

    for (const u of this.unitManager.units.filter(u => u.isFriendly)) {
      this.unitManager.despawnUnit(u);
    }
  }

  private resolveWaveVictory() {
    this.waveInProgress = false;
    this.waveCleared = true;
    this.wavePhase = 'IDLE';

    const waveDef = this.currentMission.waves[this.currentWaveIndex];
    if (this.networkManager.inMatch) {
      this.networkManager.awardTeamGold('SUN', waveDef.rewardGold);
    } else {
      this.soloWallet.gold += waveDef.rewardGold;
    }
    this.achievementManager.recordGold(waveDef.rewardGold);

    this.applyRoundEndTowerEffects();

    if (this.castleHp >= this.castleHpAtWaveStart) {
      this.achievementManager.recordFlawlessWave();
    }

    this.advanceRound();

    if (this.currentWaveIndex >= this.currentMission.waves.length) {
      if (this.networkManager.inMatch) {
        this.finishMultiplayerMatch('SUN', true);
      } else {
        this.resolveMissionVictory();
      }
    } else {
      const bonusHp = this.currentMission.castleHpPerWave ?? 150;
      this.arenaCastle.addWaveFortification(bonusHp);
      this.castleHp = this.arenaCastle.currentHp;
      this.castleMaxHp = this.arenaCastle.maxHp;
      this.prepareWaveEnemiesInArena();
    }

    this.updateHUD();
  }

  /** PvP: the clash (and any castle storm) is over; pay out and start the next build phase. */
  private resolvePvpRound() {
    this.waveInProgress = false;
    this.waveCleared = true;
    this.wavePhase = 'IDLE';
    this.stormTimer = null;

    const reward = pvpRoundReward(this.currentWaveIndex);
    for (const team of TEAMS) {
      this.networkManager.awardTeamGold(team, reward);
    }
    audio.playGoldGain();
    this.vfx.spawnFloatingText(ARENA_MSG_POS, `🏁 ROUND ${this.currentWaveIndex + 1} OVER! +${reward}g PER TEAM`, '#facc15', 2.5);

    this.applyRoundEndTowerEffects();
    this.advanceRound();
    this.buildTimer = PVP_BUILD_TIME;
    this.updateHUD();
  }

  private resolveMissionVictory() {
    this.missionEnded = true;
    this.waveInProgress = false;
    this.wavePhase = 'IDLE';

    audio.playVictory();
    this.vfx.spawnAscensionPillar(new THREE.Vector3(ARENA_MIRROR_X, 0, 0), 0xfacc15);

    let earnedStars = 1;
    if (this.castleHp >= this.castleMaxHp * 0.75) earnedStars = 3;
    else if (this.castleHp >= this.castleMaxHp * 0.4) earnedStars = 2;

    this.techTree.recordMissionCompletion(this.currentMission.id, earnedStars);
    this.achievementManager.recordCampaignStars(this.techTree.getTotalStarsEarned());

    this.ui.showVictory(
      earnedStars,
      () => {
        const nextM = CAMPAIGN_MISSIONS.find(m => m.id === this.currentMission.id + 1);
        if (nextM) this.loadMission(nextM);
        else this.ui.showCampaignMap();
      },
      () => {
        this.loadMission(this.currentMission);
      }
    );
  }

  private resolveMissionDefeat() {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.waveInProgress = false;
    this.wavePhase = 'IDLE';

    if (!this.arenaCastle.isDestroyed) {
      this.arenaCastle.triggerDestruction();
    }

    setTimeout(() => {
      this.ui.showDefeat(() => this.loadMission(this.currentMission));
    }, 1200);
  }

  private handleCastleFallen(team: TeamId) {
    if (this.isClient || this.missionEnded) return;
    if (this.isHostInMatch) {
      this.finishMultiplayerMatch(opponentOf(team), false);
    } else if (team === 'SUN') {
      this.resolveMissionDefeat();
    }
  }

  private checkCastleDamage() {
    if (this.missionEnded || this.isClient) return;

    this.castleHp = this.arenaCastle.currentHp;
    if (this.arenaCastle.isDestroyed || this.castleHp <= 0) {
      this.handleCastleFallen('SUN');
      return;
    }

    if (this.pvpActive && this.moonCastle && (this.moonCastle.isDestroyed || this.moonCastle.currentHp <= 0)) {
      this.handleCastleFallen('MOON');
    }
  }

  /** A team's recruits that have reached the arena. */
  private countAssembledRecruits(team: TeamId): number {
    return this.unitManager.units.filter(u => u.isFriendly && u.team === team && !u.isDead && u.hasCompletedMaze).length;
  }

  private updateHUD() {
    const team = this.localTeam;
    const totalRecruits = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits[team];
    const currentRecruitCost = this.getRecruitCost(team);
    const gold = this.playerGold;

    let phaseText = 'Prepare Maze';
    if (this.pvpActive) {
      phaseText = this.pvpPhaseText();
    } else if (this.waveInProgress) {
      if (this.wavePhase === 'MAZE_RUN') {
        phaseText = `🏃 Maze (${this.countAssembledRecruits('SUN')}/${totalRecruits})`;
      } else {
        phaseText = '⚔️ Arena Clash!';
      }
    }

    const canBuyRecruit = this.wavePhase !== 'ARENA_CLASH';

    this.ui.renderTopBar(
      this.currentMission,
      Math.min(this.currentWaveIndex + 1, this.currentMission.waves.length),
      this.currentMission.waves.length,
      gold,
      this.castleHp,
      this.castleMaxHp,
      this.gameSpeed,
      this.waveInProgress,
      phaseText,
      totalRecruits,
      currentRecruitCost,
      canBuyRecruit,
      this.castleHp,
      this.pvpActive && this.moonCastle ? this.moonCastle.currentHp : undefined,
      this.pvpActive ? `Round ${this.currentWaveIndex + 1}` : undefined,
      this.canVoteReady
        ? {
            voted: this.readyVotes.has(this.networkManager.localPeerId),
            count: this.readyVoters().filter(id => this.readyVotes.has(id)).length,
            total: this.readyVoters().length
          }
        : undefined
    );

    this.ui.renderTowerPalette(gold, totalRecruits, currentRecruitCost, canBuyRecruit);

    if (this.towerManager.selectedTower && this.ui.isTowerCardOpen()) {
      this.ui.updateTowerCardLiveStats(this.towerManager.selectedTower, gold);
    }
  }

  private pvpPhaseText(): string {
    if (this.wavePhase === 'IDLE') {
      return this.buildTimer !== null ? `⏳ Build: ${Math.ceil(this.buildTimer)}s` : 'Prepare Maze';
    }
    if (this.wavePhase === 'MAZE_RUN') {
      const count = (t: TeamId) => `${this.countAssembledRecruits(t)}/${this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits[t]}`;
      return `🏃 ☀️ ${count('SUN')} · 🌙 ${count('MOON')}`;
    }
    if (this.stormTimer !== null) {
      const stormers = this.unitManager.units.find(u => u.isFriendly && !u.isDead && !u.isDying);
      const who = stormers ? `${TEAM_NAMES[stormers.team]} storms` : 'Storm';
      return `🏰 ${who}! ${Math.ceil(this.stormTimer)}s`;
    }
    return '⚔️ Arena Clash!';
  }

  private raycastGround(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);
    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, point) ? point : null;
  }

  /** The maze the local player builds on. */
  private get localGrid(): Grid {
    return this.grids[this.localTeam];
  }

  private pickEnemyUnderCursor(): Unit | null {
    this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);
    const enemyUnits = this.unitManager.units.filter(u => u.team !== this.localTeam && !u.isDead && !u.isDying);
    for (const enemy of enemyUnits) {
      if (this.raycaster.intersectObjects(enemy.mesh.children, true).length > 0) {
        return enemy;
      }
    }
    return null;
  }

  private setPointer(clientX: number, clientY: number) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private setupMouseEvents() {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      this.setPointer(e.clientX, e.clientY);
      this.updatePlacementGhost();

      const point = this.raycastGround();
      if (point) {
        this.lastPointerWorld.copy(point);
        this.networkManager.sendCursorMove(point.x, point.z);
      }
    });

    this.container.addEventListener('click', (e: MouseEvent) => {
      if (e.button !== 0) return;
      // The click that ends a touch pan/pinch is not a tap on the battlefield
      if (this.cameraCtrl.consumeDragGesture()) return;

      // Touch devices have no hover, so take the position from the tap itself
      this.setPointer(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);

      if (this.isFocusFireMode) {
        const clickedEnemy = this.pickEnemyUnderCursor();
        if (clickedEnemy) {
          this.requestAction({ kind: 'SET_FOCUS', unitId: clickedEnemy.id });
        }
        this.toggleFocusFireMode(false);
        return;
      }

      if (this.ui.selectedTowerTypeForPlacement) {
        const point = this.raycastGround();
        if (!point) return;
        const grid = this.localGrid;
        const coord = grid.worldToGrid(point.x, point.z);
        if (!coord) {
          if (this.pvpActive) this.localToast(point, 'Build on your own maze island!');
          return;
        }

        if (grid.getTile(coord.x, coord.z) === TileType.ROAD) {
          this.localToast(point, 'Road tile! Build alongside the path.');
          return;
        }

        const currentType = this.ui.selectedTowerTypeForPlacement;
        const check = this.towerManager.canBuild(coord, currentType, this.playerGold, this.localTeam);
        if (!check.allowed) {
          this.localToast(point, check.reason || 'Cannot build here!');
          return;
        }

        this.requestAction({ kind: 'BUILD_TOWER', coord, towerType: currentType });

        // Shift keeps placing the same tower type. Clients can't know the outcome yet; the host will reject if unaffordable.
        const def = TOWER_DEFINITIONS[currentType];
        const isGoldLimit = currentType === TowerType.GOLD && this.towerManager.getTowerCountByType(TowerType.GOLD) >= 4;
        const keepPlacing = e.shiftKey && (this.isClient || (this.playerGold >= def.cost && !isGoldLimit));
        this.ui.selectedTowerTypeForPlacement = keepPlacing ? currentType : null;
        this.ui.renderTowerPalette();
        this.updatePlacementGhost();
        return;
      }

      const clickedGuardian = this.portalGuardianManager.checkClick(this.raycaster);
      if (clickedGuardian) {
        this.openGuardianCard(clickedGuardian);
        return;
      }

      let clickedTower: TowerInstance | null = null;
      for (const tower of this.towerManager.towers.values()) {
        if (this.raycaster.intersectObjects(tower.mesh.children, true).length > 0) {
          clickedTower = tower;
          break;
        }
      }

      if (clickedTower) {
        this.openTowerCard(clickedTower);
        return;
      }

      let clickedUnit: Unit | null = null;
      for (const unit of this.unitManager.units) {
        if (this.raycaster.intersectObjects(unit.mesh.children, true).length > 0) {
          clickedUnit = unit;
          break;
        }
      }

      if (clickedUnit) {
        this.portalGuardianManager.deselect();
        this.ui.hideGuardianCard();
        this.towerManager.selectTower(null);
        this.ui.hideTowerCard();
        this.unitManager.selectUnit(clickedUnit);
        this.ui.showUnitCard(clickedUnit);
        return;
      }

      this.towerManager.selectTower(null);
      this.unitManager.selectUnit(null);
      this.portalGuardianManager.deselect();
      this.ui.hideTowerCard();
      this.ui.hideUnitCard();
      this.ui.hideGuardianCard();
    });

    window.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      if (this.isFocusFireMode) {
        this.toggleFocusFireMode(false);
        return;
      }
      if (this.ui.selectedTowerTypeForPlacement) {
        this.ui.selectedTowerTypeForPlacement = null;
        this.ui.renderTowerPalette();
        this.updatePlacementGhost();
        return;
      }

      const clickedEnemy = this.pickEnemyUnderCursor();
      if (clickedEnemy) {
        this.requestAction({ kind: 'SET_FOCUS', unitId: clickedEnemy.id });
      } else if (this.focusTarget) {
        this.requestAction({ kind: 'SET_FOCUS', unitId: null });
      }
    });
  }

  private selectTowerForPlacement(type: TowerType) {
    const msgPos = new THREE.Vector3(sideX(this.localTeam, 0), 2, 0);
    if (type === TowerType.GOLD && this.towerManager.getTowerCountByType(TowerType.GOLD) >= 4 && this.ui.selectedTowerTypeForPlacement !== type) {
      this.localToast(msgPos, 'Gold Spire limit reached! Maximum 4 allowed.', '#ef4444', 1.5, true);
      return;
    }

    const def = TOWER_DEFINITIONS[type];
    if (this.playerGold < def.cost && this.ui.selectedTowerTypeForPlacement !== type) {
      this.localToast(msgPos, `Need 🪙${def.cost}g for ${def.name}!`, '#ef4444', 1.5, true);
      return;
    }

    if (this.ui.selectedTowerTypeForPlacement === type) {
      this.ui.selectedTowerTypeForPlacement = null;
    } else {
      this.ui.selectedTowerTypeForPlacement = type;
      if (this.towerManager.selectedTower) {
        this.towerManager.selectTower(null);
        this.ui.hideTowerCard();
      }
      if (this.unitManager.selectedUnit) {
        this.unitManager.selectUnit(null);
        this.ui.hideUnitCard();
      }
      this.fx.local(() => audio.playBuild());
    }

    this.ui.renderTowerPalette();
    this.updatePlacementGhost();
  }

  private toggleFocusFireMode(forceState?: boolean) {
    this.isFocusFireMode = forceState !== undefined ? forceState : !this.isFocusFireMode;
    if (this.isFocusFireMode) {
      if (this.ui.selectedTowerTypeForPlacement) {
        this.ui.selectedTowerTypeForPlacement = null;
        this.ui.renderTowerPalette();
        this.updatePlacementGhost();
      }
      this.towerManager.selectTower(null);
      this.ui.hideTowerCard();
      this.unitManager.selectUnit(null);
      this.ui.hideUnitCard();
      this.portalGuardianManager.deselect();
      this.ui.hideGuardianCard();
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'default';
    }
    this.ui.updateFocusFireState(this.isFocusFireMode, this.focusTarget);
  }

  /** Authoritative focus-fire change for a team (solo player / multiplayer host). */
  private setFocusTarget(target: Unit | null, team: TeamId) {
    this.portalGuardianManager.setFocusTarget(target, team);
    this.unitManager.setFocusTarget(target, team);

    if (target && !target.isDead && !target.isDying) {
      audio.playFocusTarget();
      this.vfx.spawnFloatingText(
        target.worldPos.clone().add(new THREE.Vector3(0, 2.0, 0)),
        `🎯 FOCUS FIRE LOCKED: ${target.stats.name.toUpperCase()}!`,
        '#ef4444',
        1.6
      );
    }
    if (team === this.localTeam) {
      this.focusTarget = target;
      this.updateFocusVisuals();
    }
  }

  /** Reticle & banner for the local team's focus target. */
  private updateFocusVisuals() {
    const target = this.focusTarget;
    if (target && !target.isDead && !target.isDying) {
      this.createFocusReticle(target);
    } else {
      this.removeFocusReticle();
    }
    this.ui.updateFocusFireState(this.isFocusFireMode, this.focusTarget);
  }

  private createFocusReticle(target: Unit) {
    this.removeFocusReticle();

    const group = new THREE.Group();
    group.renderOrder = 35;

    const ringGeom = new THREE.RingGeometry(0.7, 0.88, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.name = 'reticleRing';
    group.add(ringMesh);

    const tickGeom = new THREE.BoxGeometry(0.08, 0.02, 0.35);
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.95
    });
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(tickGeom, tickMat);
      tick.rotation.y = (i * Math.PI) / 2;
      tick.position.x = Math.sin((i * Math.PI) / 2) * 0.8;
      tick.position.z = Math.cos((i * Math.PI) / 2) * 0.8;
      group.add(tick);
    }

    const chevronGeom = new THREE.ConeGeometry(0.26, 0.55, 4);
    chevronGeom.rotateX(Math.PI);
    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0xff1e1e,
      emissive: 0xef4444,
      emissiveIntensity: 0.9,
      roughness: 0.3
    });
    const chevron = new THREE.Mesh(chevronGeom, chevronMat);
    chevron.name = 'reticleChevron';
    const targetScale = target.stats.scale || 1.0;
    chevron.position.y = targetScale * 1.8 + 0.8;
    group.add(chevron);

    const light = new THREE.PointLight(0xff2222, 0.7, 4.0);
    light.position.y = 1.0;
    group.add(light);

    group.position.copy(target.worldPos);
    group.position.y = 0.16;

    this.renderer.scene.add(group);
    this.focusTargetReticle = group;
  }

  private updateFocusReticle(dt: number, time: number) {
    if (!this.focusTargetReticle || !this.focusTarget) return;

    this.focusTargetReticle.position.x = this.focusTarget.worldPos.x;
    this.focusTargetReticle.position.z = this.focusTarget.worldPos.z;

    const ring = this.focusTargetReticle.getObjectByName('reticleRing');
    if (ring) {
      ring.rotation.y += dt * 2.2;
    }

    const chevron = this.focusTargetReticle.getObjectByName('reticleChevron');
    if (chevron) {
      const targetScale = this.focusTarget.stats.scale || 1.0;
      const baseHeight = targetScale * 1.8 + 0.8;
      chevron.position.y = baseHeight + Math.sin(time * 0.006) * 0.16;
      chevron.rotation.y += dt * 3.0;
    }
  }

  private removeFocusReticle() {
    if (this.focusTargetReticle) {
      this.renderer.scene.remove(this.focusTargetReticle);
      this.focusTargetReticle.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
        }
      });
      this.focusTargetReticle = null;
    }
  }

  private setupKeyboardEvents() {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFocusFireMode();
        return;
      }

      if (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        this.requestAction({ kind: 'TOGGLE_SMART_FOCUS' });
        return;
      }

      if (e.code === 'KeyY' || e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        if (this.ui.isAchievementsModalOpen()) {
          this.ui.closeAchievementsModal();
        } else {
          this.ui.showAchievementsModal();
        }
        return;
      }

      if (e.code === 'KeyG' || e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        const point = this.raycastGround();
        if (point) {
          this.networkManager.sendMapPing(point.x, point.z);
        }
        return;
      }

      if (this.ui.isGuardianCardOpen()) {
        const guardian = this.portalGuardianManager.getSelectedGuardian();
        if (guardian) {
          if (e.key === '1' || e.code === 'Numpad1') {
            e.preventDefault();
            this.requestAction({ kind: 'UPGRADE_GUARDIAN', guardianId: guardian.id, upgradeType: 'damage' });
            return;
          } else if (e.key === '2' || e.code === 'Numpad2') {
            e.preventDefault();
            this.requestAction({ kind: 'UPGRADE_GUARDIAN', guardianId: guardian.id, upgradeType: 'range' });
            return;
          }
        }
      } else if (this.ui.isTowerCardOpen()) {
        const hotkeys: Record<string, 1 | 2 | 3 | 4> = { '1': 1, '2': 2, '3': 3, '4': 4 };
        const slot = hotkeys[e.key] ?? hotkeys[e.code.replace('Numpad', '')];
        if (slot && this.ui.triggerTowerUpgradeHotkey(slot)) {
          e.preventDefault();
          return;
        }
      } else {
        const placementTypes: TowerType[] = [
          TowerType.SHRINE,
          TowerType.FORGE,
          TowerType.OBELISK,
          TowerType.AURA,
          TowerType.FROST,
          TowerType.RULEBREAKER,
          TowerType.GOLD,
          TowerType.EVOLUTION
        ];

        let targetIndex = -1;
        if (e.key >= '1' && e.key <= '8') {
          targetIndex = parseInt(e.key, 10) - 1;
        } else if (e.code && e.code.startsWith('Numpad')) {
          const num = parseInt(e.code.replace('Numpad', ''), 10);
          if (num >= 1 && num <= 8) {
            targetIndex = num - 1;
          }
        }

        if (targetIndex >= 0 && targetIndex < placementTypes.length) {
          this.selectTowerForPlacement(placementTypes[targetIndex]);
          e.preventDefault();
          return;
        }
      }

      if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === '0' || e.code === 'Numpad0') {
        this.requestAction({ kind: 'BUY_RECRUIT' });
        e.preventDefault();
        return;
      }

      if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter') {
        if (!this.waveInProgress) {
          this.requestPrimaryAction();
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const speeds = [1, 2, 4];
        const curIdx = speeds.indexOf(this.gameSpeed);
        this.requestAction({ kind: 'SET_GAME_SPEED', speed: speeds[(curIdx + 1) % speeds.length] });
        return;
      }

      if (e.code === 'KeyI' || e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        if (!this.pvpActive) this.ui.toggleWaveIntel(this.currentMission, this.currentWaveIndex);
        return;
      }

      if (e.code === 'KeyH' || e.key === 'h' || e.key === 'H' || e.key === '?') {
        e.preventDefault();
        this.ui.showTutorialModal(true);
        return;
      }

      if (e.key === 'Escape') {
        if (this.isFocusFireMode) {
          this.toggleFocusFireMode(false);
          e.preventDefault();
          return;
        } else if (this.focusTarget) {
          this.requestAction({ kind: 'SET_FOCUS', unitId: null });
          e.preventDefault();
          return;
        } else if (this.ui.isAchievementsModalOpen()) {
          this.ui.closeAchievementsModal();
          e.preventDefault();
        } else if (this.ui.tutorialModalEl.style.display === 'flex') {
          this.ui.tutorialModalEl.style.display = 'none';
          e.preventDefault();
        } else if (this.ui.waveIntelModalEl.style.display === 'flex') {
          this.ui.waveIntelModalEl.style.display = 'none';
          e.preventDefault();
        } else if (this.ui.selectedTowerTypeForPlacement) {
          this.ui.selectedTowerTypeForPlacement = null;
          this.ui.renderTowerPalette();
          this.updatePlacementGhost();
          e.preventDefault();
        } else if (this.towerManager.selectedTower) {
          this.towerManager.selectTower(null);
          this.ui.hideTowerCard();
          e.preventDefault();
        } else if (this.unitManager.selectedUnit) {
          this.unitManager.selectUnit(null);
          this.ui.hideUnitCard();
          e.preventDefault();
        } else if (this.ui.isGuardianCardOpen()) {
          this.portalGuardianManager.deselect();
          this.ui.hideGuardianCard();
          e.preventDefault();
        }
      }
    });
  }

  private refreshTowerCardIfOpen(tower: TowerInstance) {
    if (this.towerManager.selectedTower === tower && this.ui.isTowerCardOpen()) {
      this.openTowerCard(tower, false);
    }
  }

  /** Sells a tower, closing its card if it was open. Returns the refund. */
  private removeTower(towerId: number): number {
    const wasSelected = this.towerManager.selectedTower?.id === towerId;
    const refund = this.towerManager.sellTower(towerId);
    if (wasSelected) this.ui.hideTowerCard();
    return refund;
  }

  private openTowerCard(tower: TowerInstance, announceOwnership: boolean = true) {
    this.portalGuardianManager.deselect();
    this.ui.hideGuardianCard();
    this.unitManager.selectUnit(null);
    this.ui.hideUnitCard();
    this.towerManager.selectTower(tower);

    const localActor = this.getLocalActor();
    const isOwner = localActor ? this.canManageTower(localActor, tower) : false;

    if (!isOwner && announceOwnership) {
      const label = localActor && tower.team !== localActor.team ? 'Enemy' : `${tower.ownerName || 'Teammate'}'s`;
      this.localToast(tower.worldPos, `🛡️ ${label} Tower (View Only)`, '#38bdf8', 1.5);
    }

    this.ui.showTowerCard(
      tower,
      this.playerGold,
      (branch: UpgradeBranch) => this.requestAction({ kind: 'UPGRADE_TOWER', towerId: tower.id, branch }),
      () => this.requestAction({ kind: 'SELL_TOWER', towerId: tower.id }),
      (abilityIndex: 1 | 2 | 3 | 4) => this.requestAction({ kind: 'EVO_UPGRADE', towerId: tower.id, abilityIndex }),
      isOwner
    );
  }

  private openGuardianCard(guardian: PortalGuardian) {
    this.towerManager.selectTower(null);
    this.unitManager.selectUnit(null);
    this.ui.hideTowerCard();
    this.ui.hideUnitCard();

    this.portalGuardianManager.select(guardian);
    this.ui.showGuardianCard(
      guardian,
      this.playerGold,
      (upgradeType: 'damage' | 'range') => {
        this.requestAction({ kind: 'UPGRADE_GUARDIAN', guardianId: guardian.id, upgradeType });
      },
      () => {
        this.portalGuardianManager.deselect();
      }
    );
  }

  private upgradeGuardian(actor: Actor, guardian: PortalGuardian, upgradeType: 'damage' | 'range'): ActionResult {
    const isDamage = upgradeType === 'damage';
    const next = isDamage ? guardian.getNextDamage() : guardian.getNextRange();
    if (next === null) return 'Already at maximum level!';

    const cost = isDamage ? guardian.getDamageUpgradeCost() : guardian.getRangeUpgradeCost();
    if (actor.wallet.gold < cost) return `Need 🪙${cost}g!`;

    actor.wallet.gold -= cost;
    const textPos = guardian.position.clone().add(new THREE.Vector3(0, 3.5, 0));
    audio.playUpgrade();
    if (isDamage) {
      guardian.upgradeDamage();
      this.vfx.spawnAscensionPillar(guardian.position, 0x38bdf8);
      this.vfx.spawnBurstParticles(guardian.position.clone().add(new THREE.Vector3(0, 3.2, 0)), 0xfacc15, 14);
      this.vfx.spawnFloatingText(textPos, `⚔️ GREATBOLT DAMAGE LV. ${guardian.damageLevel}! (${guardian.getDamage()} DMG)`, '#38bdf8', 1.6);
    } else {
      guardian.upgradeRange();
      this.vfx.spawnAscensionPillar(guardian.position, 0x06b6d4);
      this.vfx.spawnBurstParticles(guardian.position.clone().add(new THREE.Vector3(0, 3.2, 0)), 0x38bdf8, 14);
      this.vfx.spawnFloatingText(textPos, `🎯 BALLISTA REACH LV. ${guardian.rangeLevel}! (${guardian.getRange().toFixed(1)}M)`, '#06b6d4', 1.6);
    }

    this.updateHUD();
    if (this.portalGuardianManager.getSelectedGuardian() === guardian && this.ui.isGuardianCardOpen()) {
      this.openGuardianCard(guardian);
    }
    return null;
  }

  private updatePlacementGhost() {
    if (!this.placementGhost || !this.ghostRangeRing) return;

    if (!this.ui.selectedTowerTypeForPlacement) {
      this.placementGhost.visible = false;
      this.ghostRangeRing.visible = false;
      return;
    }

    const point = this.raycastGround();
    if (!point) return;

    const grid = this.localGrid;
    const coord = grid.worldToGrid(point.x, point.z);
    if (!coord) {
      this.placementGhost.visible = false;
      this.ghostRangeRing.visible = false;
      return;
    }

    const world = grid.gridToWorld(coord.x, coord.z);
    this.placementGhost.position.set(world.x, 0.2, world.z);
    this.placementGhost.visible = true;

    const def = TOWER_DEFINITIONS[this.ui.selectedTowerTypeForPlacement];
    const canBuild = this.towerManager.canBuild(coord, this.ui.selectedTowerTypeForPlacement, this.playerGold, this.localTeam);

    const ghostMat = this.placementGhost.material as THREE.MeshStandardMaterial;
    ghostMat.color.setHex(canBuild.allowed ? 0x22c55e : 0xef4444);

    const ringColor = canBuild.allowed ? 0x22c55e : 0xef4444;
    const fillColor = canBuild.allowed ? 0x15803d : 0x991b1b;

    this.ghostRangeRing.position.set(world.x, 0.14, world.z);
    if (this.ghostFillMesh) {
      (this.ghostFillMesh.material as THREE.MeshBasicMaterial).color.setHex(fillColor);
      this.ghostFillMesh.scale.setScalar(def.range);
    }
    if (this.ghostBorderMesh) {
      (this.ghostBorderMesh.material as THREE.MeshBasicMaterial).color.setHex(ringColor);
      this.ghostBorderMesh.geometry.dispose();
      const rGeom = new THREE.RingGeometry(Math.max(0.1, def.range - 0.15), def.range, 48);
      rGeom.rotateX(-Math.PI / 2);
      this.ghostBorderMesh.geometry = rGeom;
    }
    this.ghostRangeRing.visible = true;
  }

  private onWindowResize() {
    this.renderer.handleResize();
    this.cameraCtrl.handleResize();
  }

  // --- Frame loop ---

  /** Authoritative simulation step (solo play and multiplayer host). */
  private simulate(dt: number, rawDt: number, now: number) {
    if (dt > 0 && !this.missionEnded) {
      if (this.pvpActive && this.buildTimer !== null && !this.waveInProgress) {
        this.buildTimer -= dt;
        if (this.buildTimer <= 0) this.startWave();
        else this.checkReadyVote();
      }

      if (this.waveInProgress) {
        if (this.wavePhase === 'MAZE_RUN') {
          this.simulateMazeRun(dt);
        } else if (this.wavePhase === 'ARENA_CLASH') {
          this.updateEscalation(dt);
          if (this.pvpActive) {
            this.simulatePvpClash(dt);
          } else if (!this.waveCleared && !this.unitManager.units.some(u => !u.isFriendly && !u.isDead)) {
            this.resolveWaveVictory();
          }
        }
      }
    }

    if (dt > 0) {
      this.towerManager.update(now, this.unitManager.units, (gold, tower) => {
        this.creditTowerGold(tower, gold);
        this.updateHUD();
      });

      this.unitManager.update(dt, now, (bounty, killed) => this.awardKillBounty(bounty, killed));

      this.portalGuardianManager.update(
        dt,
        now,
        (bounty, killed) => this.awardKillBounty(bounty, killed),
        this.wavePhase === 'ARENA_CLASH'
      );

      this.arenaCastle.update(dt, this.cameraCtrl.camera);
      if (this.moonCastle && this.moonCastle.group.visible) {
        this.moonCastle.update(dt, this.cameraCtrl.camera);
      }
      this.checkCastleDamage();
    } else {
      for (const guardian of this.portalGuardianManager.activeGuardians) {
        guardian.updateAnimation(rawDt, now);
      }
      this.arenaCastle.update(0, this.cameraCtrl.camera);
      if (this.moonCastle && this.moonCastle.group.visible) {
        this.moonCastle.update(0, this.cameraCtrl.camera);
      }
    }

    // The HUD re-renders on events; also refresh it when counters/timers it shows change
    const key = this.hudKey();
    if (key !== this.lastHostHudKey) {
      this.lastHostHudKey = key;
      this.updateHUD();
    }
  }

  /** Spawns each army's recruits and starts the clash once every recruit (of both teams in PvP) has arrived. */
  private simulateMazeRun(dt: number) {
    const teams = this.armyTeams;

    if (teams.some(t => this.recruitsToSpawn[t] > 0)) {
      this.recruitSpawnTimer += dt;
      if (this.recruitSpawnTimer >= 1.2) {
        this.recruitSpawnTimer = 0;
        for (const team of teams) {
          if (this.recruitsToSpawn[team] > 0) {
            this.recruitsToSpawn[team]--;
            this.spawnFriendlyRecruit(team);
          }
        }
      }
    }

    let allAssembled = true;
    for (const team of teams) {
      const living = this.unitManager.units.filter(u => u.isFriendly && u.team === team && !u.isDead);
      let assembledCount = 0;
      for (const u of living) {
        if (!u.hasCompletedMaze) continue;
        assembledCount++;
        if (!u.stagingPos) {
          // Orderly battalion formation in front of the team's arena gate
          const row = Math.floor((assembledCount - 1) / 4);
          const col = (assembledCount - 1) % 4;
          u.stagingPos = new THREE.Vector3(sideX(team, 4.5 + row * 1.4), 0.4, -3.5 + col * 2.2);
        }
      }
      if (this.recruitsToSpawn[team] > 0 || assembledCount !== living.length) allAssembled = false;
    }

    if (allAssembled) {
      this.triggerArenaClash();
    }
  }

  /**
   * PvP clash: the armies fight until one is wiped out; the survivors then storm the enemy
   * stronghold (under ballista fire) until they fall or the storm timer runs out.
   */
  private simulatePvpClash(dt: number) {
    const alive = (team: TeamId) => this.unitManager.units.some(u => u.team === team && !u.isDead && !u.isDying);
    const sunAlive = alive('SUN');
    const moonAlive = alive('MOON');

    if (!sunAlive && !moonAlive) {
      this.resolvePvpRound();
      return;
    }

    if (this.stormTimer === null) {
      if (sunAlive && moonAlive) return;
      const stormers: TeamId = sunAlive ? 'SUN' : 'MOON';
      this.stormTimer = PVP_STORM_TIME;
      audio.playBossSlam();
      this.vfx.spawnFloatingText(
        ARENA_MSG_POS,
        `🏰 TEAM ${TEAM_NAMES[stormers].toUpperCase()} STORMS THE ${TEAM_NAMES[opponentOf(stormers)].toUpperCase()} STRONGHOLD!`,
        stormers === 'SUN' ? '#facc15' : '#ef4444',
        2.5
      );
      return;
    }

    this.stormTimer -= dt;
    if (this.stormTimer <= 0) {
      // Time's up: surviving stormers withdraw
      for (const u of this.unitManager.units.filter(u => u.isFriendly && !u.isDying)) {
        this.vfx.spawnBurstParticles(u.worldPos.clone(), 0x38bdf8, 6);
        this.unitManager.despawnUnit(u);
      }
      this.resolvePvpRound();
    }
  }

  /** Multiplayer client frame: the host simulates; only animate the mirrored world. */
  private updateClientFrame(rawDt: number, now: number) {
    this.towerManager.updateVisuals(now);
    this.unitManager.updateRemote(rawDt, now);
    this.portalGuardianManager.update(rawDt, now, () => {}, this.wavePhase === 'ARENA_CLASH', false);
    this.arenaCastle.update(rawDt, this.cameraCtrl.camera);
    if (this.moonCastle && this.moonCastle.group.visible) {
      this.moonCastle.update(rawDt, this.cameraCtrl.camera);
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const rawDt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    const dyingBoss = this.unitManager.units.find(u => u.isBoss && u.isDying);
    if (dyingBoss && this.bossSlowMoTimer <= 0) {
      this.bossSlowMoTimer = 1.8;
    }

    let effectiveSpeed = this.gameSpeed;
    if (this.bossSlowMoTimer > 0) {
      this.bossSlowMoTimer -= rawDt;
      effectiveSpeed = Math.min(this.gameSpeed, 0.35);
      this.cameraCtrl.camera.position.x += (Math.random() - 0.5) * 0.05;
      this.cameraCtrl.camera.position.y += (Math.random() - 0.5) * 0.05;
    }

    const dt = rawDt * effectiveSpeed;

    this.cameraCtrl.update(rawDt);

    if (this.isClient) {
      this.updateClientFrame(rawDt, now);
    } else if (this.isHostInMatch) {
      this.fx.record(() => this.simulate(dt, rawDt, now));
    } else {
      this.simulate(dt, rawDt, now);
    }

    if (this.isHostInMatch && now - this.lastSnapshotTime >= SNAPSHOT_INTERVAL_MS) {
      this.lastSnapshotTime = now;
      this.broadcastStateSnapshot();
    }

    this.vfx.update();

    if (this.towerManager.selectedTower && this.ui.isTowerCardOpen()) {
      this.ui.updateTowerCardLiveStats(this.towerManager.selectedTower, this.playerGold);
    }

    if (this.ui.isGuardianCardOpen()) {
      this.ui.updateGuardianCardLiveStats(this.portalGuardianManager.getSelectedGuardian(), this.playerGold);
    }

    this.ui.updateBossBar(this.unitManager.getBossUnit());

    if (this.unitManager.selectedUnit) {
      if (this.unitManager.selectedUnit.isDead) {
        this.ui.hideUnitCard();
        this.unitManager.selectedUnit = null;
      } else {
        this.ui.showUnitCard(this.unitManager.selectedUnit);
      }
    }

    this.renderer.update(rawDt, now);

    if (this.focusTarget) {
      if (this.focusTarget.isDead || this.focusTarget.isDying) {
        if (this.isClient) {
          this.focusTarget = null;
          this.updateFocusVisuals();
        } else {
          this.setFocusTarget(null, this.localTeam);
        }
      } else {
        this.updateFocusReticle(rawDt, now);
        this.ui.updateFocusFireState(this.isFocusFireMode, this.focusTarget);
      }
    }

    this.renderer.render(this.cameraCtrl.camera, now);
  }
}

function isGridCoord(coord: unknown): coord is GridCoord {
  const c = coord as GridCoord | null;
  return Boolean(c) && Number.isInteger(c!.x) && Number.isInteger(c!.z);
}

function isUpgradeBranch(branch: unknown): branch is UpgradeBranch {
  return branch === UpgradeBranch.BRANCH_A || branch === UpgradeBranch.BRANCH_B || branch === UpgradeBranch.BRANCH_C;
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
