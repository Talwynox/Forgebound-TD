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
  MERCENARY_DEFINITIONS,
  PlayerSlot,
  StateSnapshot,
  TeamId,
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

const SOLO_ACTOR_ID = 'local';
const SNAPSHOT_INTERVAL_MS = 100;
const GAME_SPEEDS = [1, 2, 4, 0];
const RECRUIT_MSG_POS = new THREE.Vector3(-34, 4, -12);
const ARENA_MSG_POS = new THREE.Vector3(12, 3, 0);

class GameApp {
  private container: HTMLElement;
  private renderer: SceneRenderer;
  private cameraCtrl: CameraController;
  private grid: Grid;
  private pathfinder: Pathfinder;
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
  private lastGuardianLevelsKey: string = '';
  private lastAssembledCount: number = 0;
  /** The board currently holds a multiplayer match (possibly finished, awaiting "Back to Lobby"). */
  private multiplayerBoardActive: boolean = false;

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
  private friendlyUnitsToSpawn: number = 0;
  private friendlySpawnTimer: number = 0;

  // Army recruitment
  private readonly BASE_RECRUITS_PER_WAVE = 10;
  private extraPurchasedRecruits: number = 0;

  private getRecruitCost(): number {
    return Math.round(25 * Math.pow(1.8, this.extraPurchasedRecruits));
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

  // Focus Fire State
  private isFocusFireMode: boolean = false;
  private focusTarget: Unit | null = null;
  private focusTargetReticle: THREE.Group | null = null;

  constructor() {
    this.container = document.getElementById('canvas-container')!;
    this.renderer = new SceneRenderer(this.container);
    this.cameraCtrl = new CameraController(this.container);
    this.grid = new Grid(11, 15, 2, -22, 0);
    this.pathfinder = new Pathfinder(this.grid);
    this.pathfinder.setScene(this.renderer.scene);
    this.vfx = new VFXManager(this.renderer.scene, this.cameraCtrl.camera, this.container);
    this.fx = new FxRelay(this.vfx, audio);
    this.towerManager = new TowerManager(this.grid, this.pathfinder, this.renderer.scene, this.vfx);
    this.unitManager = new UnitManager(this.renderer.scene, this.vfx, this.cameraCtrl.camera);
    this.arenaCastle = new ArenaCastle(this.renderer.scene, this.vfx, this.castleMaxHp);
    this.unitManager.setArenaCastle(this.arenaCastle, () => this.handleSunCastleFallen());
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

  /** Owners manage their towers; towers of players who left the match can be managed by anyone. */
  private canManageTower(actor: Actor, tower: TowerInstance): boolean {
    if (!this.networkManager.inMatch) return true;
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
        return RECRUIT_MSG_POS.clone();
      case 'START_WAVE':
      case 'SET_GAME_SPEED':
      case 'SEND_MERCENARY':
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
        const check = this.towerManager.canBuild(coord, towerType, actor.wallet.gold);
        if (!check.allowed) return check.reason || 'Cannot build here!';

        const tower = this.towerManager.buildTower(coord, towerType, undefined, actor.peerId, actor.name, actor.team);
        if (!tower) return 'Cannot build here!';
        actor.wallet.gold -= def.cost;
        this.rerouteActiveUnits();

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
        this.rerouteActiveUnits();
        this.updateHUD();
        return null;
      }

      case 'BUY_RECRUIT': {
        if (this.wavePhase === 'ARENA_CLASH') return 'Cannot recruit during Arena Clash!';
        if (this.networkManager.inMatch && this.networkManager.mode === 'PVP' && actor.team !== 'SUN') {
          return 'Only Team Sun commands the maze army. Send mercenaries instead!';
        }
        const cost = this.getRecruitCost();
        if (actor.wallet.gold < cost) return `Need 🪙${cost}g for Recruit!`;

        actor.wallet.gold -= cost;
        this.extraPurchasedRecruits++;
        const totalRecruits = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits;
        const nextCost = this.getRecruitCost();
        const hirer = this.networkManager.inMatch ? `${actor.name}: ` : '';
        audio.playBuild();

        if (this.wavePhase === 'MAZE_RUN') {
          this.friendlyUnitsToSpawn++;
          this.vfx.spawnFloatingText(RECRUIT_MSG_POS, `🛡️ ${hirer}RECRUIT REINFORCEMENT! (${totalRecruits} total, next 🪙${nextCost}g)`, '#38bdf8', 2.0);
        } else {
          this.vfx.spawnFloatingText(RECRUIT_MSG_POS, `🛡️ ${hirer}+1 RECRUIT HIRED! (${totalRecruits} total, next 🪙${nextCost}g)`, '#38bdf8', 2.0);
        }
        this.vfx.spawnAscensionPillar(new THREE.Vector3(-34, 0, -12), 0x38bdf8);
        this.updateHUD();
        return null;
      }

      case 'SEND_MERCENARY': {
        if (!this.networkManager.inMatch || this.networkManager.mode !== 'PVP' || !actor.slot) {
          return 'Mercenaries are only available in PvP matches.';
        }
        const def = MERCENARY_DEFINITIONS[action.enemyClass];
        if (!def) return 'Unknown mercenary.';
        if (actor.wallet.gold < def.cost) return `Need 🪙${def.cost}g to hire ${def.name}!`;

        actor.wallet.gold -= def.cost;
        actor.slot.income += def.incomeBonus;

        const fightsForSun = actor.team === 'SUN';
        const spawnPos = new THREE.Vector3(fightsForSun ? 3.0 : 21.0, 0.4, (Math.random() - 0.5) * 4.0);
        this.unitManager.spawnMercenary(def.enemyClass, spawnPos, fightsForSun, this.currentWaveIndex);
        this.vfx.spawnFloatingText(spawnPos, `⚔️ ${actor.name} SENT ${def.name.toUpperCase()}!`, fightsForSun ? '#facc15' : '#ef4444', 2.0);
        audio.playEvolution();
        this.updateHUD();
        return null;
      }

      case 'START_WAVE':
        this.startWave(this.networkManager.inMatch ? actor.name : undefined);
        return null;

      case 'UPGRADE_GUARDIAN': {
        const guardian = this.portalGuardianManager.getGuardian(action.guardianId);
        if (!guardian) return 'Unknown guardian.';
        if (action.upgradeType !== 'damage' && action.upgradeType !== 'range') return 'Invalid upgrade.';
        return this.upgradeGuardian(actor, guardian, action.upgradeType);
      }

      case 'SET_FOCUS': {
        if (action.unitId === null) {
          this.setFocusTarget(null);
          return null;
        }
        const target = this.unitManager.units.find(u => u.id === action.unitId && !u.isFriendly && !u.isDead && !u.isDying);
        if (target) this.setFocusTarget(target);
        return null;
      }

      case 'TOGGLE_SMART_FOCUS': {
        const active = this.towerManager.toggleSmartFocus();
        audio.playUpgrade();
        this.vfx.spawnFloatingText(
          new THREE.Vector3(0, 3, 0),
          `🎯 SMART FOCUS: ${active ? 'ON (Champions First)' : 'OFF (Lead Recruits)'}`,
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
    this.ui.onStartWave = () => this.requestAction({ kind: 'START_WAVE' });
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

    const mission = CAMPAIGN_MISSIONS.find(m => m.id === missionId) || CAMPAIGN_MISSIONS[0];
    this.loadMission(mission);

    if (mode === 'PVP') {
      this.ui.mercenaryMenu.show();
      if (!this.moonCastle) {
        this.moonCastle = new ArenaCastle(this.renderer.scene, this.vfx, 1500, new THREE.Vector3(24.5, 0, 0), true);
      } else {
        this.moonCastle.reset(1500);
        this.moonCastle.group.visible = true;
      }
      this.unitManager.setMoonCastle(this.moonCastle, () => this.handleMoonCastleFallen());
      this.vfx.spawnFloatingText(ARENA_MSG_POS, '⚔️ 4V4 CLASH OF STRONGHOLDS BEGINS! ⚔️', '#ef4444', 3.0);
    } else {
      this.ui.mercenaryMenu.hide();
      this.hideMoonCastle();
      this.vfx.spawnFloatingText(ARENA_MSG_POS, '🤝 CO-OP ALLIED BASTION DEFENSE! 🤝', '#38bdf8', 3.0);
    }

    this.updateHUD();
  }

  private hideMoonCastle() {
    this.unitManager.setMoonCastle(null);
    if (this.moonCastle) this.moonCastle.group.visible = false;
  }

  /** Restores a clean solo board after a multiplayer match. */
  private resetToSoloBoard() {
    if (!this.multiplayerBoardActive) return;
    this.multiplayerBoardActive = false;
    this.ui.hideResultModals();
    this.ui.mercenaryMenu.hide();
    this.hideMoonCastle();
    this.fx.clear();
    this.gameSpeed = 1;
    this.toggleFocusFireMode(false);
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
    const winnerName = winningTeam === 'SUN' ? 'Sun' : 'Moon';

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
      economy[p.peerId] = [p.gold, p.income];
    }

    this.networkManager.broadcastSnapshot({
      waveIndex: this.currentWaveIndex,
      wavePhase: this.wavePhase,
      waveInProgress: this.waveInProgress,
      extraRecruits: this.extraPurchasedRecruits,
      gameSpeed: this.gameSpeed,
      smartFocus: this.towerManager.smartFocusEnabled,
      focusUnitId: this.focusTarget && !this.focusTarget.isDead ? this.focusTarget.id : null,
      sunCastle: encodeCastle(this.arenaCastle),
      moonCastle: this.networkManager.mode === 'PVP' && this.moonCastle ? encodeCastle(this.moonCastle) : null,
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
    this.extraPurchasedRecruits = s.extraRecruits;
    this.gameSpeed = s.gameSpeed;
    this.towerManager.smartFocusEnabled = s.smartFocus;
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

    // Shared focus-fire target
    if ((this.focusTarget?.id ?? null) !== s.focusUnitId) {
      const target = s.focusUnitId === null ? null : this.unitManager.units.find(u => u.id === s.focusUnitId && !u.isDying) ?? null;
      this.focusTarget = target;
      this.portalGuardianManager.setFocusTarget(target);
      this.updateFocusVisuals();
    }

    // Re-rendering the HUD rebuilds its buttons, so only do it when something visible changed
    const local = this.networkManager.getLocalPlayer();
    const hudKey = [
      local?.gold, local?.income, this.castleHp, this.castleMaxHp, s.moonCastle?.[0],
      s.waveIndex, s.wavePhase, s.waveInProgress, s.extraRecruits, s.gameSpeed, s.smartFocus,
      this.countAssembledRecruits()
    ].join(',');
    if (hudKey !== this.lastClientHudKey) {
      this.lastClientHudKey = hudKey;
      this.updateHUD();
    }
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
      this.networkManager.awardTeamGold(tower.team ?? 'SUN', amount);
    }
    if (tower.ownerPeerId === this.networkManager.localPeerId) {
      this.achievementManager.recordGold(amount);
    }
  }

  private awardKillBounty(bounty: number, enemyClass?: EnemyClass, isBoss?: boolean) {
    if (this.networkManager.inMatch) {
      this.networkManager.awardTeamGold('SUN', bounty);
    } else {
      this.soloWallet.gold += bounty;
    }
    this.achievementManager.recordGold(bounty);
    if (enemyClass) {
      this.achievementManager.recordKill(enemyClass, isBoss || false);
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
    this.extraPurchasedRecruits = 0;
    this.friendlyUnitsToSpawn = 0;
    this.setFocusTarget(null);

    // Multiplayer starting gold is set per player by the host
    if (!this.networkManager.inMatch) {
      this.soloWallet.gold = mission.startingGold + this.techTree.getBonusStartingGold();
    }
    this.castleHp = mission.castleMaxHp;
    this.castleMaxHp = mission.castleMaxHp;
    this.arenaCastle.reset(this.castleMaxHp);

    this.unitManager.clearAll();
    this.portalGuardianManager.resetAll();
    this.ui.hideGuardianCard();
    this.ui.hideTowerCard();
    this.ui.hideUnitCard();
    for (const id of Array.from(this.towerManager.towers.keys())) {
      this.towerManager.sellTower(id);
    }
    this.grid.resetGrid();
    this.renderer.buildRoadVisuals(this.grid);
    this.pathfinder.updatePathVisual();

    this.prepareWaveEnemiesInArena();
    this.updateHUD();
  }

  private prepareWaveEnemiesInArena() {
    // Multiplayer clients receive the host's enemies through snapshots
    if (this.isClient) return;

    for (const u of this.unitManager.units.filter(u => !u.isFriendly && !u.isMercenary)) {
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

  private startWave(starterName?: string) {
    if (this.waveInProgress || this.missionEnded) return;
    if (this.currentWaveIndex >= this.currentMission.waves.length) return;

    this.waveInProgress = true;
    this.waveCleared = false;
    this.wavePhase = 'MAZE_RUN';
    this.towerManager.resetWaveEvolutions();

    this.friendlyUnitsToSpawn = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits;
    this.friendlySpawnTimer = 0;
    this.castleHpAtWaveStart = this.castleHp;

    audio.playBuild();
    if (starterName) {
      this.vfx.spawnFloatingText(ARENA_MSG_POS, `⚔️ ${starterName} RELEASED WAVE ${this.currentWaveIndex + 1}! ⚔️`, '#facc15', 2.0);
    }
    this.updateHUD();
  }

  private triggerArenaClash() {
    this.wavePhase = 'ARENA_CLASH';
    audio.playEvolution();
    this.vfx.spawnFloatingText(new THREE.Vector3(13, 3, 0), '⚔️ THE ARENA CLASH BEGINS! CHARGE! ⚔️', '#facc15', 3.0);
    this.vfx.spawnAscensionPillar(new THREE.Vector3(2, 0, 0), 0x38bdf8);
    this.vfx.spawnAscensionPillar(new THREE.Vector3(22, 0, 0), 0xef4444);

    for (const u of this.unitManager.units) {
      if (u.isDead) continue;
      if (u.isFriendly) {
        u.inCombat = true;
        u.stagingPos = null;
      } else {
        u.isWaitingInArena = false;
        u.inCombat = true;
      }
    }

    this.updateHUD();
  }

  private spawnFriendlyRecruit() {
    const spawnWorld = this.grid.gridToWorld(this.grid.spawnCoord.x, this.grid.spawnCoord.z);
    const startPos = new THREE.Vector3(spawnWorld.x, 0.4, spawnWorld.z);
    const waypoints = this.pathfinder.getWorldPath();

    const unit = this.unitManager.spawnFriendly(FriendlyClass.RECRUIT, startPos, waypoints);

    // Apply Warrior Heritage Tech Tree Bonus
    const bonusHp = this.techTree.getBonusRecruitHp();
    const bonusArmor = this.techTree.getBonusRecruitArmor();
    unit.maxHp += bonusHp;
    unit.currentHp += bonusHp;
    unit.armor += bonusArmor;
  }

  private rerouteActiveUnits() {
    const newPath = this.pathfinder.getWorldPath();
    for (const u of this.unitManager.units) {
      if (u.isFriendly && !u.hasCompletedMaze) {
        u.waypoints = newPath;
        let closestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < newPath.length; i++) {
          const d = u.worldPos.distanceTo(newPath[i]);
          if (d < minDist) {
            minDist = d;
            closestIdx = i;
          }
        }
        u.currentWaypointIdx = Math.min(newPath.length - 1, closestIdx + 1);
      }
    }
  }

  private resolveWaveVictory() {
    this.waveInProgress = false;
    this.waveCleared = true;
    this.wavePhase = 'IDLE';

    const waveDef = this.currentMission.waves[this.currentWaveIndex];
    if (this.networkManager.inMatch) {
      this.networkManager.awardTeamGold('SUN', waveDef.rewardGold);
      this.networkManager.payoutRoundIncome();
    } else {
      this.soloWallet.gold += waveDef.rewardGold;
    }
    this.achievementManager.recordGold(waveDef.rewardGold);

    // Vault Reserve Gold Spires pay interest on their owner's reserve
    for (const tower of this.towerManager.towers.values()) {
      if (tower.type === TowerType.GOLD && tower.currentBranch === UpgradeBranch.BRANCH_B) {
        const curUpg = this.towerManager.getCurrentUpgrade(tower) || TOWER_DEFINITIONS[TowerType.GOLD].branchB[0];
        const ownerGold = this.networkManager.inMatch ? (this.towerOwnerSlot(tower)?.gold ?? 0) : this.soloWallet.gold;
        const interest = Math.round(ownerGold * (curUpg.roundInterestPercent ?? 0.10));
        const payout = Math.max(curUpg.roundFlatGold ?? 20, interest);
        this.creditTowerGold(tower, payout);
        tower.totalBuffApplied += payout;
        audio.playGoldGain();
        this.vfx.spawnFloatingText(tower.worldPos.clone().add(new THREE.Vector3(0, 2, 0)), `VAULT INTEREST: +${payout}g`, '#facc15', 2.0);
      }
    }

    const stackEvents = this.towerManager.applyRoundEndStacking();
    for (const ev of stackEvents) {
      audio.playUpgrade();
      this.vfx.spawnAscensionPillar(ev.pos, 0x22c55e);
      this.vfx.spawnFloatingText(ev.pos, ev.message, ev.color, 2.5);
    }
    if (this.towerManager.selectedTower) {
      this.refreshTowerCardIfOpen(this.towerManager.selectedTower);
    }

    if (this.castleHp >= this.castleHpAtWaveStart) {
      this.achievementManager.recordFlawlessWave();
    }

    this.towerManager.resetWaveEvolutions();
    this.currentWaveIndex++;
    this.extraPurchasedRecruits = 0;
    this.setFocusTarget(null);
    this.toggleFocusFireMode(false);

    for (const u of this.unitManager.units.filter(u => u.isFriendly)) {
      this.unitManager.despawnUnit(u);
    }

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

  private resolveMissionVictory() {
    this.missionEnded = true;
    this.waveInProgress = false;
    this.wavePhase = 'IDLE';

    audio.playVictory();
    this.vfx.spawnAscensionPillar(new THREE.Vector3(13, 0, 0), 0xfacc15);

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

  private handleSunCastleFallen() {
    if (this.isClient || this.missionEnded) return;
    if (this.isHostInMatch) {
      this.finishMultiplayerMatch('MOON', false);
    } else {
      this.resolveMissionDefeat();
    }
  }

  private handleMoonCastleFallen() {
    if (this.isHostInMatch) {
      this.finishMultiplayerMatch('SUN', false);
    }
  }

  private checkCastleDamage() {
    if (this.missionEnded || this.isClient) return;

    this.castleHp = this.arenaCastle.currentHp;
    if (this.arenaCastle.isDestroyed || this.castleHp <= 0) {
      this.handleSunCastleFallen();
      return;
    }

    if (this.moonCastle && this.moonCastle.group.visible && (this.moonCastle.isDestroyed || this.moonCastle.currentHp <= 0)) {
      this.handleMoonCastleFallen();
    }
  }

  /** Recruits of the maze army that reached the arena (excludes PvP mercenaries). */
  private countAssembledRecruits(): number {
    return this.unitManager.units.filter(u => u.isFriendly && !u.isMercenary && !u.isDead && u.hasCompletedMaze).length;
  }

  private updateHUD() {
    const totalRecruits = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits;
    const currentRecruitCost = this.getRecruitCost();
    const gold = this.playerGold;

    let phaseText = 'Prepare Maze';
    if (this.waveInProgress) {
      if (this.wavePhase === 'MAZE_RUN') {
        phaseText = `🏃 Maze (${this.countAssembledRecruits()}/${totalRecruits})`;
      } else {
        phaseText = '⚔️ Arena Clash!';
      }
    }

    const canBuyRecruit = this.wavePhase !== 'ARENA_CLASH';
    const isPvp = this.networkManager.inMatch && this.networkManager.mode === 'PVP';

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
      isPvp && this.moonCastle ? this.moonCastle.currentHp : undefined
    );

    this.ui.renderTowerPalette(gold, totalRecruits, currentRecruitCost, canBuyRecruit);

    if (this.towerManager.selectedTower && this.ui.isTowerCardOpen()) {
      this.ui.updateTowerCardLiveStats(this.towerManager.selectedTower, gold);
    }

    if (this.ui.mercenaryMenu && this.ui.mercenaryMenu.visible) {
      this.ui.mercenaryMenu.render(gold);
    }
  }

  private raycastGround(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);
    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, point) ? point : null;
  }

  private pickEnemyUnderCursor(): Unit | null {
    this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);
    const enemyUnits = this.unitManager.units.filter(u => !u.isFriendly && !u.isDead && !u.isDying);
    for (const enemy of enemyUnits) {
      if (this.raycaster.intersectObjects(enemy.mesh.children, true).length > 0) {
        return enemy;
      }
    }
    return null;
  }

  private setupMouseEvents() {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.updatePlacementGhost();

      const point = this.raycastGround();
      if (point) {
        this.lastPointerWorld.copy(point);
        this.networkManager.sendCursorMove(point.x, point.z);
      }
    });

    this.container.addEventListener('click', (e: MouseEvent) => {
      if (e.button !== 0) return;

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
        const coord = point ? this.grid.worldToGrid(point.x, point.z) : null;
        if (!point || !coord) return;

        if (this.grid.getTile(coord.x, coord.z) === TileType.ROAD) {
          this.localToast(point, 'Road tile! Build alongside the path.');
          return;
        }

        const currentType = this.ui.selectedTowerTypeForPlacement;
        const check = this.towerManager.canBuild(coord, currentType, this.playerGold);
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
    const msgPos = new THREE.Vector3(0, 2, 0);
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

  /** Authoritative focus-fire change (solo player / multiplayer host). */
  private setFocusTarget(target: Unit | null) {
    this.focusTarget = target;
    this.portalGuardianManager.setFocusTarget(target);
    this.unitManager.setFocusTarget(target);

    if (target && !target.isDead && !target.isDying) {
      audio.playFocusTarget();
      this.vfx.spawnFloatingText(
        target.worldPos.clone().add(new THREE.Vector3(0, 2.0, 0)),
        `🎯 FOCUS FIRE LOCKED: ${target.stats.name.toUpperCase()}!`,
        '#ef4444',
        1.6
      );
    }
    this.updateFocusVisuals();
  }

  /** Reticle & banner for the current focus target. */
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
          this.requestAction({ kind: 'START_WAVE' });
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
        this.ui.toggleWaveIntel(this.currentMission, this.currentWaveIndex);
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
      this.localToast(tower.worldPos, `🛡️ ${tower.ownerName || 'Teammate'}'s Tower (View Only)`, '#38bdf8', 1.5);
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

    const coord = this.grid.worldToGrid(point.x, point.z);
    if (!coord) {
      this.placementGhost.visible = false;
      this.ghostRangeRing.visible = false;
      return;
    }

    const world = this.grid.gridToWorld(coord.x, coord.z);
    this.placementGhost.position.set(world.x, 0.2, world.z);
    this.placementGhost.visible = true;

    const def = TOWER_DEFINITIONS[this.ui.selectedTowerTypeForPlacement];
    const canBuild = this.towerManager.canBuild(coord, this.ui.selectedTowerTypeForPlacement, this.playerGold);

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
    if (this.waveInProgress && dt > 0) {
      if (this.wavePhase === 'MAZE_RUN') {
        if (this.friendlyUnitsToSpawn > 0) {
          this.friendlySpawnTimer += dt;
          if (this.friendlySpawnTimer >= 1.2) {
            this.friendlySpawnTimer = 0;
            this.friendlyUnitsToSpawn--;
            this.spawnFriendlyRecruit();
          }
        }

        const livingRecruits = this.unitManager.units.filter(u => u.isFriendly && !u.isMercenary && !u.isDead);
        let assembledCount = 0;

        for (const u of livingRecruits) {
          if (u.hasCompletedMaze) {
            assembledCount++;
            if (!u.stagingPos) {
              const row = Math.floor((assembledCount - 1) / 4);
              const col = (assembledCount - 1) % 4;
              u.stagingPos = new THREE.Vector3(4.5 + row * 1.4, 0.4, -3.5 + col * 2.2);
            }
          }
        }

        // The HUD only re-renders on events, so refresh it as recruits arrive
        if (assembledCount !== this.lastAssembledCount) {
          this.lastAssembledCount = assembledCount;
          this.updateHUD();
        }

        if (
          this.friendlyUnitsToSpawn === 0 &&
          (livingRecruits.length === 0 || assembledCount === livingRecruits.length)
        ) {
          this.triggerArenaClash();
        }
      } else if (this.wavePhase === 'ARENA_CLASH') {
        const remainingEnemies = this.unitManager.units.filter(u => !u.isFriendly && !u.isDead);
        if (remainingEnemies.length === 0 && !this.waveCleared) {
          this.resolveWaveVictory();
        }
      }
    }

    if (dt > 0) {
      this.towerManager.update(now, this.unitManager.units, (gold, tower) => {
        this.creditTowerGold(tower, gold);
        this.updateHUD();
      });

      this.unitManager.update(dt, now, (bounty, enemyClass, isBoss) => this.awardKillBounty(bounty, enemyClass, isBoss));

      this.portalGuardianManager.update(
        dt,
        now,
        (bounty, enemyClass, isBoss) => this.awardKillBounty(bounty, enemyClass, isBoss),
        this.wavePhase === 'ARENA_CLASH'
      );

      this.arenaCastle.update(dt, this.cameraCtrl.camera);
      if (this.moonCastle && this.moonCastle.group.visible) {
        this.moonCastle.update(dt, this.cameraCtrl.camera);
      }
      this.checkCastleDamage();
    } else {
      for (const guardian of this.portalGuardianManager.guardians) {
        guardian.updateAnimation(rawDt, now);
      }
      this.arenaCastle.update(0, this.cameraCtrl.camera);
      if (this.moonCastle && this.moonCastle.group.visible) {
        this.moonCastle.update(0, this.cameraCtrl.camera);
      }
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
          this.setFocusTarget(null);
        }
      } else {
        this.updateFocusReticle(rawDt, now);
        this.ui.updateFocusFireState(this.isFocusFireMode, this.focusTarget);
      }
    }

    this.renderer.renderer.render(this.renderer.scene, this.cameraCtrl.camera);
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
