import * as THREE from 'three';
import { SceneRenderer } from './engine/Renderer';
import { CameraController } from './engine/Camera';
import { AudioSystem, audio } from './engine/AudioSystem';
import { Grid, TileType, GridCoord } from './grid/Grid';
import { Pathfinder } from './grid/Pathfinder';
import { VFXManager } from './vfx/VFXManager';
import { TowerManager } from './towers/TowerManager';
import { Unit, UnitManager } from './units/UnitManager';
import { TechTreeManager } from './campaign/TechTree';
import { UIManager } from './ui/UIManager';
import { CAMPAIGN_MISSIONS, CampaignMission } from './campaign/CampaignData';
import { FriendlyClass, EnemyClass } from './units/UnitData';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS } from './towers/TowerData';
import { PortalGuardian, PortalGuardianManager } from './towers/PortalGuardianManager';
import { AchievementManager } from './achievements/AchievementManager';
import { ArenaCastle } from './engine/ArenaCastle';
import { NetworkManager } from './network/NetworkManager';
import { GameMode, TeamId, UnitSnapshot } from './network/NetworkTypes';

class GameApp {
  private container: HTMLElement;
  private renderer: SceneRenderer;
  private cameraCtrl: CameraController;
  private grid: Grid;
  private pathfinder: Pathfinder;
  private vfx: VFXManager;
  private towerManager: TowerManager;
  private unitManager: UnitManager;
  private arenaCastle!: ArenaCastle;
  private moonCastle: ArenaCastle | null = null;
  private techTree: TechTreeManager;
  private ui: UIManager;
  private portalGuardianManager: PortalGuardianManager;
  public achievementManager: AchievementManager;
  public networkManager!: NetworkManager;
  private lastSnapshotTime: number = 0;
  private castleHpAtWaveStart: number = 3000;

  // Game State
  private currentMission: CampaignMission;
  private currentWaveIndex: number = 0;
  private playerGold: number = 250;
  private castleHp: number = 800;
  private castleMaxHp: number = 800;

  private gameSpeed: number = 1;
  private waveInProgress: boolean = false;
  private waveCleared: boolean = false;
  private friendlyUnitsToSpawn: number = 0;
  private friendlySpawnTimer: number = 0;
  private enemiesToSpawnQueue: { enemyClass: EnemyClass; delay: number }[] = [];
  private enemySpawnTimer: number = 0;

  // Army recruitment
  private readonly BASE_RECRUITS_PER_WAVE = 10;
  private extraPurchasedRecruits: number = 0;

  private getRecruitCost(): number {
    return Math.round(25 * Math.pow(1.8, this.extraPurchasedRecruits));
  }

  // Phase and Mission lifecycle
  private wavePhase: 'IDLE' | 'MAZE_RUN' | 'ARENA_CLASH' = 'IDLE';
  private missionEnded: boolean = false;

  // Raycasting & Mouse Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
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
    this.towerManager = new TowerManager(this.grid, this.pathfinder, this.renderer.scene, this.vfx);
    this.unitManager = new UnitManager(this.renderer.scene, this.vfx, this.cameraCtrl.camera);
    this.arenaCastle = new ArenaCastle(this.renderer.scene, this.vfx, this.castleMaxHp);
    this.unitManager.setArenaCastle(this.arenaCastle, () => this.resolveMissionDefeat());
    this.portalGuardianManager = new PortalGuardianManager(this.renderer.scene, this.vfx, this.unitManager);
    this.techTree = new TechTreeManager();
    this.achievementManager = new AchievementManager();
    this.ui = new UIManager(document.getElementById('app')!);
    this.ui.init(this.towerManager, this.unitManager, this.techTree, this.achievementManager);

    this.networkManager = new NetworkManager();
    this.networkManager.setScene(this.renderer.scene);
    this.ui.initMultiplayer(this.networkManager, (mode) => {
      this.startMultiplayerMatch(mode);
    });
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

  private setupUIHandlers() {
    this.ui.onStartWave = () => this.startWave();
    this.ui.onBuyRecruit = () => this.buyRecruit();
    this.ui.onToggleFocusFire = () => this.toggleFocusFireMode();
    this.ui.onClearFocusTarget = () => this.setFocusTarget(null);
    this.ui.onToggleSmartFocus = () => this.toggleSmartFocus();
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
    this.ui.onSetGameSpeed = (speed: number) => {
      this.gameSpeed = speed;
      this.updateHUD();
    };
    this.ui.onSelectMission = (mission: CampaignMission) => {
      this.loadMission(mission);
    };
  }

  private setupNetworkHandlers() {
    const prevMatchStarted = this.networkManager.onMatchStarted;
    this.networkManager.onMatchStarted = (mode, missionId, startingGold) => {
      if (this.ui.multiplayerModal) {
        this.ui.multiplayerModal.close();
      }
      if (prevMatchStarted) {
        prevMatchStarted(mode, missionId, startingGold);
      }
      this.startMultiplayerMatch(mode, missionId, startingGold);
    };

    this.networkManager.onRemoteBuildTower = (peerId, team, coord, towerType) => {
      const player = this.networkManager.getPlayer(peerId);
      const def = TOWER_DEFINITIONS[towerType];
      if (player && player.gold >= def.cost) {
        const canBuild = this.towerManager.canBuild(coord, towerType, player.gold);
        if (canBuild.allowed) {
          const ownerName = player.name;
          const tower = this.towerManager.buildTower(coord, towerType, undefined, peerId, ownerName, team);
          if (tower) {
            player.gold -= def.cost;
            if (peerId === this.networkManager.localPeerId) {
              this.playerGold = player.gold;
            }
            this.rerouteActiveUnits();
            this.updateHUD();
            this.networkManager.conn.broadcast({
              type: 'EVENT_TOWER_BUILT',
              id: tower.id,
              team,
              ownerPeerId: peerId,
              towerType,
              coord
            });
          }
        }
      }
    };

    this.networkManager.onRemoteUpgradeTower = (peerId, towerId, branch) => {
      const player = this.networkManager.getPlayer(peerId);
      const tower = this.towerManager.towers.get(towerId);
      if (!player || !tower) return;

      // Ownership protection: only the owner can upgrade their tower!
      if (tower.ownerPeerId && tower.ownerPeerId !== peerId) {
        return;
      }

      const res = this.towerManager.upgradeTower(towerId, branch, player.gold);
      if (res.success) {
        player.gold -= res.cost;
        if (peerId === this.networkManager.localPeerId) {
          this.playerGold = player.gold;
        }
        if (this.towerManager.selectedTower?.id === towerId) {
          this.openTowerCard(tower);
        }
        this.updateHUD();
        this.networkManager.conn.broadcast({
          type: 'EVENT_TOWER_UPGRADED',
          id: towerId,
          ownerPeerId: peerId,
          branch,
          level: tower.level
        });
      }
    };

    this.networkManager.onRemoteSellTower = (peerId, towerId) => {
      const player = this.networkManager.getPlayer(peerId);
      const tower = this.towerManager.towers.get(towerId);
      if (!player || !tower) return;

      // Ownership protection: only the owner can sell their tower!
      if (tower.ownerPeerId && tower.ownerPeerId !== peerId) {
        return;
      }

      const refund = this.towerManager.sellTower(towerId);
      player.gold += refund;
      if (peerId === this.networkManager.localPeerId) {
        this.playerGold = player.gold;
      }
      if (this.towerManager.selectedTower?.id === towerId) {
        this.towerManager.selectTower(null);
        this.ui.hideTowerCard();
      }
      this.rerouteActiveUnits();
      this.updateHUD();
      this.networkManager.conn.broadcast({
        type: 'EVENT_TOWER_SOLD',
        id: towerId,
        ownerPeerId: peerId,
        refundGold: refund
      });
    };

    this.networkManager.onRemoteBuyRecruit = (peerId, _team) => {
      const player = this.networkManager.getPlayer(peerId);
      const cost = this.getRecruitCost();
      if (player && player.gold >= cost) {
        player.gold -= cost;
        this.extraPurchasedRecruits++;
        if (peerId === this.networkManager.localPeerId) {
          this.playerGold = player.gold;
        }
        audio.playBuild();
        this.updateHUD();
      }
    };

    this.networkManager.onRemoteMercenarySend = (peerId, team, enemyClass) => {
      const player = this.networkManager.getPlayer(peerId);
      if (!player) return;
      const isSun = team === 'SUN';
      const spawnX = isSun ? 3.0 : 21.0;
      const spawnPos = new THREE.Vector3(spawnX, 0.4, (Math.random() - 0.5) * 4.0);
      const unit = this.unitManager.spawnEnemy(enemyClass, spawnPos, false, this.currentWaveIndex);
      if (unit) {
        unit.inCombat = true;
      }
      this.vfx.spawnFloatingText(spawnPos, `⚔️ ${player.name} SENT ${enemyClass}!`, isSun ? '#facc15' : '#ef4444', 2.0);
      audio.playEvolution();
      this.updateHUD();
    };

    this.networkManager.onSnapshotReceived = (snapshot) => {
      this.castleHp = snapshot.sunCastleHp;
      this.castleMaxHp = snapshot.sunCastleMaxHp;
      this.arenaCastle.currentHp = snapshot.sunCastleHp;
      this.arenaCastle.maxHp = snapshot.sunCastleMaxHp;
      this.arenaCastle.updateHpBar();

      if (snapshot.moonCastleHp !== undefined && this.moonCastle) {
        this.moonCastle.currentHp = snapshot.moonCastleHp;
        if (snapshot.moonCastleMaxHp) this.moonCastle.maxHp = snapshot.moonCastleMaxHp;
        this.moonCastle.updateHpBar();
      }

      const mySlot = this.networkManager.getLocalPlayer();
      if (mySlot && snapshot.playerGolds[this.networkManager.localPeerId] !== undefined) {
        this.playerGold = snapshot.playerGolds[this.networkManager.localPeerId];
      }

      this.wavePhase = snapshot.wavePhase;
      this.updateHUD();
    };

    this.networkManager.onWaveCountdown = (secondsLeft) => {
      this.vfx.spawnFloatingText(
        new THREE.Vector3(12, 3, 0),
        secondsLeft > 0 ? `⚔️ BATTLE IN ${secondsLeft}... ⚔️` : '⚔️ CHARGE! ⚔️',
        '#facc15',
        0.8
      );
      audio.playBuild();
    };

    this.networkManager.onMatchEnd = (winningTeam, isCoopVictory) => {
      this.missionEnded = true;
      this.waveInProgress = false;
      const isMyWin = this.networkManager.mode === 'COOP' ? isCoopVictory : this.networkManager.localTeam === winningTeam;
      if (isMyWin) {
        this.ui.showVictory(3, () => this.ui.multiplayerModal.open('host'), () => this.loadMission(this.currentMission));
      } else {
        this.ui.showDefeat(() => this.ui.multiplayerModal.open('host'));
      }
    };

    this.networkManager.onRemoteTowerBuilt = (id, team, ownerPeerId, towerType, coord) => {
      if (!this.networkManager.isHost) {
        const owner = this.networkManager.getPlayer(ownerPeerId);
        const ownerName = owner ? owner.name : 'Teammate';
        const tower = this.towerManager.buildTower(coord, towerType, id, ownerPeerId, ownerName, team);
        if (tower) {
          this.vfx.spawnFloatingText(tower.worldPos, `🏗️ ${ownerName} BUILT ${TOWER_DEFINITIONS[towerType].name}!`, '#38bdf8', 1.8);
          audio.playBuild();
          this.rerouteActiveUnits();
          this.updateHUD();
        }
      }
    };

    this.networkManager.onRemoteTowerUpgraded = (id, ownerPeerId, branch, level) => {
      if (!this.networkManager.isHost) {
        const tower = this.towerManager.towers.get(id);
        if (tower) {
          this.towerManager.upgradeTower(id, branch, 999999);
          const owner = this.networkManager.getPlayer(ownerPeerId);
          const ownerName = owner ? owner.name : 'Teammate';
          this.vfx.spawnFloatingText(tower.worldPos, `⚡ ${ownerName} UPGRADED (LV ${level})!`, '#facc15', 1.8);
          audio.playUpgrade();
          if (this.towerManager.selectedTower?.id === id) {
            this.openTowerCard(tower);
          }
          this.updateHUD();
        }
      }
    };

    this.networkManager.onRemoteTowerSold = (id, ownerPeerId, refundGold) => {
      if (!this.networkManager.isHost) {
        const tower = this.towerManager.towers.get(id);
        if (tower) {
          const pos = tower.worldPos.clone();
          this.towerManager.sellTower(id);
          const owner = this.networkManager.getPlayer(ownerPeerId);
          const ownerName = owner ? owner.name : 'Teammate';
          this.vfx.spawnFloatingText(pos, `💰 ${ownerName} SOLD TOWER (+${refundGold}g)`, '#94a3b8', 1.8);
          if (this.towerManager.selectedTower?.id === id) {
            this.towerManager.selectTower(null);
            this.ui.hideTowerCard();
          }
          this.rerouteActiveUnits();
          this.updateHUD();
        }
      }
    };

    this.networkManager.onMercenarySummoned = (senderPeerId, senderTeam, enemyClass) => {
      if (!this.networkManager.isHost) {
        const isSun = senderTeam === 'SUN';
        const spawnX = isSun ? 3.0 : 21.0;
        const spawnPos = new THREE.Vector3(spawnX, 0.4, (Math.random() - 0.5) * 4.0);
        const unit = this.unitManager.spawnEnemy(enemyClass, spawnPos, false, this.currentWaveIndex);
        if (unit) unit.inCombat = true;
        const sender = this.networkManager.getPlayer(senderPeerId);
        const senderName = sender ? sender.name : 'Opponent';
        this.vfx.spawnFloatingText(spawnPos, `⚔️ ${senderName} SENT ${enemyClass}!`, isSun ? '#facc15' : '#ef4444', 2.0);
        audio.playEvolution();
        this.updateHUD();
      }
    };
  }

  private startMultiplayerMatch(mode: GameMode, missionId: number = 1, startingGold: number = 250) {
    this.playerGold = startingGold;
    const mission = CAMPAIGN_MISSIONS.find(m => m.id === missionId) || CAMPAIGN_MISSIONS[0];
    this.loadMission(mission);

    if (mode === 'PVP') {
      this.ui.mercenaryMenu.show();
      if (!this.moonCastle) {
        this.moonCastle = new ArenaCastle(
          this.renderer.scene,
          this.vfx,
          1500,
          new THREE.Vector3(24.5, 0, 0),
          true
        );
      } else {
        this.moonCastle.reset(1500);
        this.moonCastle.group.visible = true;
      }
      this.unitManager.setMoonCastle(this.moonCastle, () => {
        this.resolvePvPMatchEnd('SUN');
      });
      this.unitManager.onCastleDestroyed = () => {
        this.resolvePvPMatchEnd('MOON');
      };
      this.vfx.spawnFloatingText(new THREE.Vector3(12, 3, 0), '⚔️ 4V4 CLASH OF STRONGHOLDS BEGINS! ⚔️', '#ef4444', 3.0);
    } else {
      this.ui.mercenaryMenu.hide();
      this.unitManager.setMoonCastle(null);
      this.unitManager.onCastleDestroyed = () => {
        this.resolveMissionDefeat();
      };
      if (this.moonCastle) {
        this.moonCastle.group.visible = false;
      }
      this.vfx.spawnFloatingText(new THREE.Vector3(12, 3, 0), '🤝 CO-OP ALLIED BASTION DEFENSE! 🤝', '#38bdf8', 3.0);
    }

    this.updateHUD();
  }

  private resolvePvPMatchEnd(winningTeam: TeamId) {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.waveInProgress = false;

    if (winningTeam === 'SUN') {
      if (this.moonCastle && !this.moonCastle.isDestroyed) {
        this.moonCastle.triggerDestruction();
      }
    } else {
      if (this.arenaCastle && !this.arenaCastle.isDestroyed) {
        this.arenaCastle.triggerDestruction();
      }
    }

    if (this.networkManager.isHost) {
      this.networkManager.conn.broadcast({
        type: 'EVENT_MATCH_END',
        winningTeam
      });
    }

    const isMyWin = this.networkManager.localTeam === winningTeam;
    setTimeout(() => {
      if (isMyWin) {
        this.ui.showVictory(3, () => this.ui.multiplayerModal.open('host'), () => this.loadMission(this.currentMission));
      } else {
        this.ui.showDefeat(() => this.ui.multiplayerModal.open('host'));
      }
    }, 1200);
  }

  private broadcastStateSnapshot() {
    if (!this.networkManager || !this.networkManager.isHost) return;

    const playerGolds: Record<string, number> = {};
    const playerIncomes: Record<string, number> = {};
    for (const p of this.networkManager.players.values()) {
      playerGolds[p.peerId] = p.gold;
      playerIncomes[p.peerId] = p.income;
    }

    const units: UnitSnapshot[] = this.unitManager.units.map(u => ({
      id: u.id,
      isFriendly: u.isFriendly,
      team: 'SUN',
      unitClass: u.unitClass,
      x: u.worldPos.x,
      y: u.worldPos.y,
      z: u.worldPos.z,
      rotY: u.mesh.rotation.y,
      currentHp: u.currentHp,
      maxHp: u.maxHp,
      isDead: u.isDead,
      inCombat: u.inCombat,
      tier: u.stats.tier
    }));

    this.networkManager.conn.broadcast({
      type: 'STATE_SNAPSHOT',
      snapshot: {
        waveNumber: this.currentWaveIndex + 1,
        wavePhase: this.wavePhase,
        sunCastleHp: this.arenaCastle.currentHp,
        sunCastleMaxHp: this.arenaCastle.maxHp,
        moonCastleHp: this.moonCastle ? this.moonCastle.currentHp : undefined,
        moonCastleMaxHp: this.moonCastle ? this.moonCastle.maxHp : undefined,
        playerGolds,
        playerIncomes,
        units
      }
    });
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
    this.setFocusTarget(null);

    this.playerGold = mission.startingGold + this.techTree.getBonusStartingGold();
    this.castleHp = mission.castleMaxHp;
    this.castleMaxHp = mission.castleMaxHp;
    if (this.arenaCastle) {
      this.arenaCastle.reset(this.castleMaxHp);
    }

    this.unitManager.clearAll();
    if (this.portalGuardianManager) {
      this.portalGuardianManager.resetAll();
    }
    if (this.ui) {
      this.ui.hideGuardianCard();
    }
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
    for (let i = this.unitManager.units.length - 1; i >= 0; i--) {
      const u = this.unitManager.units[i];
      if (!u.isFriendly) {
        this.renderer.scene.remove(u.mesh);
        this.unitManager.units.splice(i, 1);
      }
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

  private startWave() {
    if (this.waveInProgress) return;
    if (this.currentWaveIndex >= this.currentMission.waves.length) return;

    this.waveInProgress = true;
    this.waveCleared = false;
    this.wavePhase = 'MAZE_RUN';
    this.towerManager.resetWaveEvolutions();

    this.friendlyUnitsToSpawn = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits;
    this.friendlySpawnTimer = 0;
    this.castleHpAtWaveStart = this.castleHp;

    audio.playBuild();
    this.updateHUD();
  }

  private triggerArenaClash() {
    this.wavePhase = 'ARENA_CLASH';
    audio.playEvolution();
    this.vfx.spawnFloatingText(new THREE.Vector3(13, 3, 0), '⚔️ THE ARENA CLASH BEGINS! CHARGE! ⚔️', '#facc15', 3.0);
    this.vfx.spawnAscensionPillar(new THREE.Vector3(2, 0, 0), 0x38bdf8);
    this.vfx.spawnAscensionPillar(new THREE.Vector3(22, 0, 0), 0xef4444);

    for (const u of this.unitManager.units) {
      if (u.isFriendly && !u.isDead) {
        u.inCombat = true;
        u.stagingPos = null;
      }
    }

    for (const u of this.unitManager.units) {
      if (!u.isFriendly && !u.isDead) {
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
    if (this.networkManager.isConnected && this.networkManager.isHost) {
      this.networkManager.awardTeamBounty('SUN', waveDef.rewardGold);
      this.networkManager.payoutRoundIncome();
      const mySlot = this.networkManager.getLocalPlayer();
      if (mySlot) this.playerGold = mySlot.gold;
    } else {
      this.playerGold += waveDef.rewardGold;
    }
    this.achievementManager.recordGold(waveDef.rewardGold);

    for (const tower of this.towerManager.towers.values()) {
      if (tower.type === TowerType.GOLD && tower.currentBranch === UpgradeBranch.BRANCH_B) {
        const curUpg = this.towerManager.getCurrentUpgrade(tower) || TOWER_DEFINITIONS[TowerType.GOLD].branchB[0];
        const interest = Math.round(this.playerGold * (curUpg.roundInterestPercent ?? 0.10));
        const payout = Math.max(curUpg.roundFlatGold ?? 20, interest);
        this.playerGold += payout;
        this.achievementManager.recordGold(payout);
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
      this.openTowerCard(this.towerManager.selectedTower);
    }

    if (this.castleHp >= this.castleHpAtWaveStart) {
      this.achievementManager.recordFlawlessWave();
    }

    this.towerManager.resetWaveEvolutions();
    this.currentWaveIndex++;
    this.extraPurchasedRecruits = 0;
    this.setFocusTarget(null);
    this.toggleFocusFireMode(false);

    for (let i = this.unitManager.units.length - 1; i >= 0; i--) {
      const u = this.unitManager.units[i];
      if (u.isFriendly) {
        this.renderer.scene.remove(u.mesh);
        this.unitManager.units.splice(i, 1);
      }
    }

    if (this.currentWaveIndex >= this.currentMission.waves.length) {
      if (this.networkManager.isConnected && this.networkManager.isHost) {
        this.networkManager.conn.broadcast({
          type: 'EVENT_MATCH_END',
          winningTeam: 'SUN',
          isCoopVictory: true
        });
      }
      this.resolveMissionVictory();
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

    if (this.arenaCastle && !this.arenaCastle.isDestroyed) {
      this.arenaCastle.triggerDestruction();
    }

    setTimeout(() => {
      this.ui.showDefeat(() => this.loadMission(this.currentMission));
    }, 1200);
  }

  private checkCastleDamage() {
    if (this.missionEnded || !this.arenaCastle) return;

    this.castleHp = this.arenaCastle.currentHp;
    if (this.arenaCastle.isDestroyed || this.castleHp <= 0) {
      if (this.networkManager.mode === 'PVP' && this.networkManager.isConnected) {
        this.resolvePvPMatchEnd('MOON');
      } else {
        this.resolveMissionDefeat();
      }
      return;
    }

    if (this.networkManager.mode === 'PVP' && this.networkManager.isConnected && this.moonCastle) {
      if (this.moonCastle.isDestroyed || this.moonCastle.currentHp <= 0) {
        this.resolvePvPMatchEnd('SUN');
      }
    }
  }

  private buyRecruit() {
    if (this.networkManager.isConnected) {
      this.networkManager.sendBuyRecruit(this.networkManager.localTeam);
      return;
    }

    if (this.wavePhase === 'ARENA_CLASH') {
      audio.playDefeat();
      this.vfx.spawnFloatingText(new THREE.Vector3(-34, 4, -12), 'Cannot recruit during Arena Clash!', '#f87171', 2.0);
      return;
    }

    const cost = this.getRecruitCost();
    if (this.playerGold < cost) {
      audio.playDefeat();
      this.vfx.spawnFloatingText(new THREE.Vector3(-34, 4, -12), `Need 🪙${cost}g for Recruit!`, '#f87171', 1.5);
      return;
    }

    this.playerGold -= cost;
    this.extraPurchasedRecruits++;
    const totalRecruits = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits;
    const nextCost = this.getRecruitCost();
    audio.playBuild();

    if (this.wavePhase === 'MAZE_RUN') {
      this.friendlyUnitsToSpawn++;
      this.vfx.spawnFloatingText(new THREE.Vector3(-34, 4, -12), `🛡️ RECRUIT REINFORCEMENT! (${totalRecruits} total, next 🪙${nextCost}g)`, '#38bdf8', 2.0);
    } else {
      this.vfx.spawnFloatingText(new THREE.Vector3(-34, 4, -12), `🛡️ +1 RECRUIT HIRED! (${totalRecruits} total, next 🪙${nextCost}g)`, '#38bdf8', 2.0);
    }
    this.vfx.spawnAscensionPillar(new THREE.Vector3(-34, 0, -12), 0x38bdf8);

    this.updateHUD();
  }

  private updateHUD() {
    const totalRecruits = this.BASE_RECRUITS_PER_WAVE + this.extraPurchasedRecruits;
    const currentRecruitCost = this.getRecruitCost();

    let phaseText = 'Prepare Maze';
    if (this.waveInProgress) {
      if (this.wavePhase === 'MAZE_RUN') {
        const assembled = this.unitManager.units.filter(u => u.isFriendly && u.hasCompletedMaze).length;
        phaseText = `🏃 Maze (${assembled}/${totalRecruits})`;
      } else {
        phaseText = '⚔️ Arena Clash!';
      }
    }

    const canBuyRecruit = this.wavePhase !== 'ARENA_CLASH';

    this.ui.renderTopBar(
      this.currentMission,
      Math.min(this.currentWaveIndex + 1, this.currentMission.waves.length),
      this.currentMission.waves.length,
      this.playerGold,
      this.castleHp,
      this.castleMaxHp,
      this.gameSpeed,
      this.waveInProgress,
      phaseText,
      totalRecruits,
      currentRecruitCost,
      canBuyRecruit
    );

    this.ui.renderTowerPalette(this.playerGold, totalRecruits, currentRecruitCost, canBuyRecruit);

    if (this.towerManager.selectedTower && this.ui.isTowerCardOpen()) {
      this.ui.updateTowerCardLiveStats(this.towerManager.selectedTower, this.playerGold);
    }

    if (this.ui.mercenaryMenu && this.ui.mercenaryMenu.visible) {
      this.ui.mercenaryMenu.render(this.playerGold);
    }
  }

  private setupMouseEvents() {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.updatePlacementGhost();

      if (this.networkManager.isConnected) {
        this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);
        const point = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.groundPlane, point)) {
          this.networkManager.sendCursorMove(point.x, point.z, this.ui.selectedTowerTypeForPlacement || undefined);
        }
      }
    });

    this.container.addEventListener('click', (e: MouseEvent) => {
      if (e.button !== 0) return;

      this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);

      if (this.isFocusFireMode) {
        let clickedEnemy: Unit | null = null;
        const enemyUnits = this.unitManager.units.filter(u => !u.isFriendly && !u.isDead && !u.isDying);
        for (const enemy of enemyUnits) {
          const intersects = this.raycaster.intersectObjects(enemy.mesh.children, true);
          if (intersects.length > 0) {
            clickedEnemy = enemy;
            break;
          }
        }

        if (clickedEnemy) {
          this.setFocusTarget(clickedEnemy);
        }
        this.toggleFocusFireMode(false);
        return;
      }

      if (this.ui.selectedTowerTypeForPlacement) {
        const point = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.groundPlane, point)) {
          const coord = this.grid.worldToGrid(point.x, point.z);
          if (coord) {
            const tile = this.grid.getTile(coord.x, coord.z);
            if (tile === TileType.ROAD) {
              this.vfx.spawnFloatingText(point, 'Road tile! Build alongside the path.', '#ef4444', 1.5);
              return;
            }

            const check = this.towerManager.canBuild(coord, this.ui.selectedTowerTypeForPlacement, this.playerGold);
            if (check.allowed) {
              const currentType = this.ui.selectedTowerTypeForPlacement;
              const def = TOWER_DEFINITIONS[currentType];

              if (this.networkManager.isConnected) {
                this.networkManager.sendBuildTower(this.networkManager.localTeam, coord, currentType);
                if (!e.shiftKey) {
                  this.ui.selectedTowerTypeForPlacement = null;
                }
                this.ui.renderTowerPalette();
                this.updatePlacementGhost();
                return;
              }

              const tower = this.towerManager.buildTower(
                coord,
                currentType,
                undefined,
                'local',
                'Commander',
                'SUN'
              );
              if (tower) {
                this.playerGold -= def.cost;

                const isGoldLimit = currentType === TowerType.GOLD && this.towerManager.getTowerCountByType(TowerType.GOLD) >= 4;
                if (e.shiftKey && this.playerGold >= def.cost && !isGoldLimit) {
                  this.ui.selectedTowerTypeForPlacement = currentType;
                } else {
                  this.ui.selectedTowerTypeForPlacement = null;
                }

                this.ui.renderTowerPalette();
                this.updatePlacementGhost();
                this.rerouteActiveUnits();
                this.updateHUD();
              }
            } else {
              this.vfx.spawnFloatingText(point, check.reason || 'Cannot build here!', '#ef4444', 1.5);
            }
          }
        }
        return;
      }

      const clickedGuardian = this.portalGuardianManager.checkClick(this.raycaster);
      if (clickedGuardian) {
        this.openGuardianCard(clickedGuardian);
        return;
      }

      let clickedTower: any = null;
      for (const tower of this.towerManager.towers.values()) {
        const intersects = this.raycaster.intersectObjects(tower.mesh.children, true);
        if (intersects.length > 0) {
          clickedTower = tower;
          break;
        }
      }

      if (clickedTower) {
        this.openTowerCard(clickedTower);
        return;
      }

      let clickedUnit: any = null;
      for (const unit of this.unitManager.units) {
        const intersects = this.raycaster.intersectObjects(unit.mesh.children, true);
        if (intersects.length > 0) {
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

      this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);
      let clickedEnemy: Unit | null = null;
      const enemyUnits = this.unitManager.units.filter(u => !u.isFriendly && !u.isDead && !u.isDying);
      for (const enemy of enemyUnits) {
        const intersects = this.raycaster.intersectObjects(enemy.mesh.children, true);
        if (intersects.length > 0) {
          clickedEnemy = enemy;
          break;
        }
      }

      if (clickedEnemy) {
        this.setFocusTarget(clickedEnemy);
      } else if (this.focusTarget) {
        this.setFocusTarget(null);
      }
    });
  }

  private selectTowerForPlacement(type: TowerType) {
    if (type === TowerType.GOLD && this.towerManager.getTowerCountByType(TowerType.GOLD) >= 4 && this.ui.selectedTowerTypeForPlacement !== type) {
      audio.playDefeat();
      this.vfx.spawnFloatingText(new THREE.Vector3(0, 2, 0), 'Gold Spire limit reached! Maximum 4 allowed.', '#ef4444', 1.5);
      return;
    }

    const def = TOWER_DEFINITIONS[type];
    if (this.playerGold < def.cost && this.ui.selectedTowerTypeForPlacement !== type) {
      audio.playDefeat();
      this.vfx.spawnFloatingText(new THREE.Vector3(0, 2, 0), `Need 🪙${def.cost}g for ${def.name}!`, '#ef4444', 1.5);
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
      audio.playBuild();
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

  private toggleSmartFocus() {
    const active = this.towerManager.toggleSmartFocus();
    audio.playUpgrade();
    this.vfx.spawnFloatingText(
      new THREE.Vector3(0, 3, 0),
      `🎯 SMART FOCUS: ${active ? 'ON (Champions First)' : 'OFF (Lead Recruits)'}`,
      active ? '#a5b4fc' : '#94a3b8',
      1.4
    );
    this.updateHUD();
    if (this.towerManager.selectedTower && this.ui.isTowerCardOpen()) {
      this.openTowerCard(this.towerManager.selectedTower);
    }
  }

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
        this.toggleSmartFocus();
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
        this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);
        const point = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.groundPlane, point)) {
          this.networkManager.sendMapPing(point.x, point.z);
        }
        return;
      }

      if (this.ui.isGuardianCardOpen()) {
        const guardian = this.portalGuardianManager.getSelectedGuardian();
        if (guardian) {
          if (e.key === '1' || e.code === 'Numpad1') {
            e.preventDefault();
            this.upgradeGuardian(guardian, 'damage');
            return;
          } else if (e.key === '2' || e.code === 'Numpad2') {
            e.preventDefault();
            this.upgradeGuardian(guardian, 'range');
            return;
          }
        }
      } else if (this.ui.isTowerCardOpen()) {
        if (e.key === '1' || e.code === 'Numpad1') {
          if (this.ui.triggerTowerUpgradeHotkey(1)) {
            e.preventDefault();
            return;
          }
        } else if (e.key === '2' || e.code === 'Numpad2') {
          if (this.ui.triggerTowerUpgradeHotkey(2)) {
            e.preventDefault();
            return;
          }
        } else if (e.key === '3' || e.code === 'Numpad3') {
          if (this.ui.triggerTowerUpgradeHotkey(3)) {
            e.preventDefault();
            return;
          }
        } else if (e.key === '4' || e.code === 'Numpad4') {
          if (this.ui.triggerTowerUpgradeHotkey(4)) {
            e.preventDefault();
            return;
          }
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
          const selectedType = placementTypes[targetIndex];
          this.selectTowerForPlacement(selectedType);
          e.preventDefault();
          return;
        }
      }

      if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === '0' || e.code === 'Numpad0') {
        this.buyRecruit();
        e.preventDefault();
        return;
      }

      if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter') {
        if (!this.waveInProgress) {
          this.startWave();
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const speeds = [1, 2, 4];
        const curIdx = speeds.indexOf(this.gameSpeed);
        this.gameSpeed = speeds[(curIdx + 1) % speeds.length];
        this.updateHUD();
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
          this.setFocusTarget(null);
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

  private openTowerCard(tower: any) {
    this.portalGuardianManager.deselect();
    this.ui.hideGuardianCard();
    this.unitManager.selectUnit(null);
    this.ui.hideUnitCard();
    this.towerManager.selectTower(tower);

    const isMultiplayer = Boolean(this.networkManager && this.networkManager.isConnected);
    const localPeerId = this.networkManager?.localPeerId;
    const isOwner = !isMultiplayer || !tower.ownerPeerId || tower.ownerPeerId === localPeerId || tower.ownerPeerId === 'local';

    if (!isOwner) {
      const ownerLabel = tower.ownerName || 'Teammate';
      this.vfx.spawnFloatingText(tower.worldPos, `🛡️ ${ownerLabel}'s Tower (View Only)`, '#38bdf8', 1.5);
    }

    this.ui.showTowerCard(
      tower,
      this.playerGold,
      (branch: UpgradeBranch) => {
        if (!isOwner) {
          this.vfx.spawnFloatingText(tower.worldPos, '⛔ Only the builder can upgrade this tower!', '#ef4444', 1.5);
          return;
        }
        if (this.networkManager.isConnected) {
          this.networkManager.sendUpgradeTower(tower.id, branch);
          return;
        }
        const res = this.towerManager.upgradeTower(tower.id, branch, this.playerGold);
        if (res.success) {
          this.playerGold -= res.cost;
          if (tower.level >= 10) {
            this.achievementManager.recordTowerMaxed(tower.type);
          }
          this.updateHUD();
          this.openTowerCard(tower);
        } else if (res.reason) {
          audio.playDefeat();
          this.vfx.spawnFloatingText(tower.worldPos, res.reason, '#ef4444', 1.2);
        }
      },
      () => {
        if (!isOwner) {
          this.vfx.spawnFloatingText(tower.worldPos, '⛔ Only the builder can sell this tower!', '#ef4444', 1.5);
          return;
        }
        if (this.networkManager.isConnected) {
          this.networkManager.sendSellTower(tower.id);
          this.ui.hideTowerCard();
          return;
        }
        const refund = this.towerManager.sellTower(tower.id);
        this.playerGold += refund;
        this.rerouteActiveUnits();
        this.ui.hideTowerCard();
        this.updateHUD();
      },
      (abilityIndex: 1 | 2 | 3 | 4) => {
        if (!isOwner) {
          this.vfx.spawnFloatingText(tower.worldPos, '⛔ Only the builder can evolve this tower!', '#ef4444', 1.5);
          return;
        }
        const res = this.towerManager.upgradeEvoAbility(tower.id, abilityIndex, this.playerGold);
        if (res.success) {
          this.playerGold -= res.cost;
          if (tower.ability1Level >= 10 && tower.ability2Level >= 10 && tower.ability3Level >= 10 && tower.ability4Level >= 10) {
            this.achievementManager.recordTowerMaxed(TowerType.EVOLUTION);
          }
          this.updateHUD();
          this.openTowerCard(tower);
        } else if (res.reason) {
          audio.playDefeat();
          this.vfx.spawnFloatingText(tower.worldPos, res.reason, '#ef4444', 1.2);
        }
      },
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
        this.upgradeGuardian(guardian, upgradeType);
      },
      () => {
        this.portalGuardianManager.deselect();
      }
    );
  }

  private upgradeGuardian(guardian: PortalGuardian, upgradeType: 'damage' | 'range') {
    if (upgradeType === 'damage') {
      const cost = guardian.getDamageUpgradeCost();
      const nextDmg = guardian.getNextDamage();
      if (nextDmg === null) return;
      if (this.playerGold >= cost) {
        this.playerGold -= cost;
        guardian.upgradeDamage();
        audio.playUpgrade();
        this.vfx.spawnAscensionPillar(guardian.position, 0x38bdf8);
        this.vfx.spawnBurstParticles(guardian.position.clone().add(new THREE.Vector3(0, 3.2, 0)), 0xfacc15, 14);
        this.vfx.spawnFloatingText(
          guardian.position.clone().add(new THREE.Vector3(0, 3.5, 0)),
          `⚔️ GREATBOLT DAMAGE LV. ${guardian.damageLevel}! (${guardian.getDamage()} DMG)`,
          '#38bdf8',
          1.6
        );
        this.updateHUD();
        this.openGuardianCard(guardian);
      } else {
        audio.playDefeat();
        this.vfx.spawnFloatingText(guardian.position, `Need 🪙${cost}g!`, '#ef4444', 1.2);
      }
    } else if (upgradeType === 'range') {
      const cost = guardian.getRangeUpgradeCost();
      const nextRange = guardian.getNextRange();
      if (nextRange === null) return;
      if (this.playerGold >= cost) {
        this.playerGold -= cost;
        guardian.upgradeRange();
        audio.playUpgrade();
        this.vfx.spawnAscensionPillar(guardian.position, 0x06b6d4);
        this.vfx.spawnBurstParticles(guardian.position.clone().add(new THREE.Vector3(0, 3.2, 0)), 0x38bdf8, 14);
        this.vfx.spawnFloatingText(
          guardian.position.clone().add(new THREE.Vector3(0, 3.5, 0)),
          `🎯 BALLISTA REACH LV. ${guardian.rangeLevel}! (${guardian.getRange().toFixed(1)}M)`,
          '#06b6d4',
          1.6
        );
        this.updateHUD();
        this.openGuardianCard(guardian);
      } else {
        audio.playDefeat();
        this.vfx.spawnFloatingText(guardian.position, `Need 🪙${cost}g!`, '#ef4444', 1.2);
      }
    }
  }

  private updatePlacementGhost() {
    if (!this.placementGhost || !this.ghostRangeRing) return;

    if (!this.ui.selectedTowerTypeForPlacement) {
      this.placementGhost.visible = false;
      this.ghostRangeRing.visible = false;
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);
    const point = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, point)) {
      const coord = this.grid.worldToGrid(point.x, point.z);
      if (coord) {
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
      } else {
        this.placementGhost.visible = false;
        this.ghostRangeRing.visible = false;
      }
    }
  }

  private onWindowResize() {
    this.renderer.handleResize();
    this.cameraCtrl.handleResize();
  }

  private animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const rawDt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    if (this.networkManager && this.networkManager.isHost && this.networkManager.isConnected) {
      if (now - this.lastSnapshotTime >= 60) {
        this.lastSnapshotTime = now;
        this.broadcastStateSnapshot();
      }
    }

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

        const livingFriendlies = this.unitManager.units.filter(u => u.isFriendly && !u.isDead);
        let assembledCount = 0;

        for (let i = 0; i < livingFriendlies.length; i++) {
          const u = livingFriendlies[i];
          if (u.hasCompletedMaze) {
            assembledCount++;
            if (!u.stagingPos) {
              const row = Math.floor((assembledCount - 1) / 4);
              const col = (assembledCount - 1) % 4;
              u.stagingPos = new THREE.Vector3(4.5 + row * 1.4, 0.4, -3.5 + col * 2.2);
            }
          }
        }

        if (
          this.friendlyUnitsToSpawn === 0 &&
          (livingFriendlies.length === 0 || assembledCount === livingFriendlies.length)
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
      this.towerManager.update(now, this.unitManager.units, (gold) => {
        this.playerGold += gold;
        this.achievementManager.recordGold(gold);
        this.updateHUD();
      });

      this.unitManager.update(dt, now, (bounty, enemyClass, isBoss) => {
        if (this.networkManager.isConnected) {
          if (this.networkManager.isHost) {
            this.networkManager.awardTeamBounty('SUN', bounty);
            const mySlot = this.networkManager.getLocalPlayer();
            if (mySlot) this.playerGold = mySlot.gold;
          }
        } else {
          this.playerGold += bounty;
        }
        this.achievementManager.recordGold(bounty);
        if (enemyClass) {
          this.achievementManager.recordKill(enemyClass, isBoss || false);
        }
        this.updateHUD();
      });

      this.portalGuardianManager.update(
        dt,
        now,
        (bounty, enemyClass, isBoss) => {
          if (this.networkManager.isConnected) {
            if (this.networkManager.isHost) {
              this.networkManager.awardTeamBounty('SUN', bounty);
              const mySlot = this.networkManager.getLocalPlayer();
              if (mySlot) this.playerGold = mySlot.gold;
            }
          } else {
            this.playerGold += bounty;
          }
          this.achievementManager.recordGold(bounty);
          if (enemyClass) {
            this.achievementManager.recordKill(enemyClass, isBoss || false);
          }
          this.updateHUD();
        },
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
        this.setFocusTarget(null);
      } else {
        this.updateFocusReticle(rawDt, now);
        this.ui.updateFocusFireState(this.isFocusFireMode, this.focusTarget);
      }
    }

    this.renderer.renderer.render(this.renderer.scene, this.cameraCtrl.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
