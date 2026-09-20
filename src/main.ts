import * as THREE from 'three';
import { SceneRenderer } from './engine/Renderer';
import { CameraController } from './engine/Camera';
import { AudioSystem, audio } from './engine/AudioSystem';
import { Grid, TileType, GridCoord } from './grid/Grid';
import { Pathfinder } from './grid/Pathfinder';
import { VFXManager } from './vfx/VFXManager';
import { TowerManager } from './towers/TowerManager';
import { UnitManager } from './units/UnitManager';
import { TechTreeManager } from './campaign/TechTree';
import { UIManager } from './ui/UIManager';
import { CAMPAIGN_MISSIONS, CampaignMission } from './campaign/CampaignData';
import { FriendlyClass, EnemyClass } from './units/UnitData';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS } from './towers/TowerData';

class GameApp {
  private container: HTMLElement;
  private renderer: SceneRenderer;
  private cameraCtrl: CameraController;
  private grid: Grid;
  private pathfinder: Pathfinder;
  private vfx: VFXManager;
  private towerManager: TowerManager;
  private unitManager: UnitManager;
  private techTree: TechTreeManager;
  private ui: UIManager;

  // Game State
  private currentMission: CampaignMission;
  private currentWaveIndex: number = 0;
  private playerGold: number = 250;
  private castleHp: number = 100;
  private castleMaxHp: number = 100;
  private enemyCitadelHp: number = 300;
  private enemyCitadelMaxHp: number = 300;

  private gameSpeed: number = 1;
  private waveInProgress: boolean = false;
  private waveCleared: boolean = false;
  private friendlyUnitsToSpawn: number = 0;
  private friendlySpawnTimer: number = 0;
  private enemiesToSpawnQueue: { enemyClass: EnemyClass; delay: number }[] = [];
  private enemySpawnTimer: number = 0;

  // Raycasting & Mouse Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private placementGhost: THREE.Mesh | null = null;
  private ghostRangeRing: THREE.Mesh | null = null;

  // Timing
  private lastFrameTime = performance.now();

  constructor() {
    this.container = document.getElementById('canvas-container')!;
    this.renderer = new SceneRenderer(this.container);
    this.cameraCtrl = new CameraController(this.container);
    this.grid = new Grid(10, 10, 2, -14, 0);
    this.pathfinder = new Pathfinder(this.grid);
    this.pathfinder.setScene(this.renderer.scene);
    this.vfx = new VFXManager(this.renderer.scene, this.cameraCtrl.camera, this.container);
    this.towerManager = new TowerManager(this.grid, this.pathfinder, this.renderer.scene, this.vfx);
    this.unitManager = new UnitManager(this.renderer.scene, this.vfx, this.cameraCtrl.camera);
    this.techTree = new TechTreeManager();
    this.ui = new UIManager(document.getElementById('app')!);
    this.ui.init(this.towerManager, this.unitManager, this.techTree);

    this.currentMission = CAMPAIGN_MISSIONS[0];

    this.setupUIHandlers();
    this.setupMouseEvents();
    this.setupPlacementGhost();
    this.loadMission(this.currentMission);

    window.addEventListener('resize', () => this.onWindowResize());

    this.animate();
  }

  private setupUIHandlers() {
    this.ui.onStartWave = () => this.startWave();
    this.ui.onSetGameSpeed = (speed: number) => {
      this.gameSpeed = speed;
      this.updateHUD();
    };
    this.ui.onSelectMission = (mission: CampaignMission) => {
      this.loadMission(mission);
    };
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

    const rGeom = new THREE.RingGeometry(0.1, 3.5, 32);
    rGeom.rotateX(-Math.PI / 2);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    this.ghostRangeRing = new THREE.Mesh(rGeom, rMat);
    this.ghostRangeRing.position.y = 0.05;
    this.ghostRangeRing.visible = false;
    this.renderer.scene.add(this.ghostRangeRing);
  }

  private loadMission(mission: CampaignMission) {
    this.currentMission = mission;
    this.currentWaveIndex = 0;
    this.waveInProgress = false;
    this.waveCleared = false;

    // Starting gold + Tech Tree bonus
    this.playerGold = mission.startingGold + this.techTree.getBonusStartingGold();
    this.castleHp = mission.castleMaxHp;
    this.castleMaxHp = mission.castleMaxHp;
    this.enemyCitadelHp = mission.enemyCitadelHp;
    this.enemyCitadelMaxHp = mission.enemyCitadelHp;

    // Reset grid & units
    this.unitManager.clearAll();
    for (const id of Array.from(this.towerManager.towers.keys())) {
      this.towerManager.sellTower(id);
    }
    this.grid.resetGrid();
    this.pathfinder.updatePathVisual();

    this.updateHUD();
  }

  private startWave() {
    if (this.waveInProgress) return;
    if (this.currentWaveIndex >= this.currentMission.waves.length) return;

    this.waveInProgress = true;
    this.waveCleared = false;
    const waveDef = this.currentMission.waves[this.currentWaveIndex];

    // Prepare Friendly Army (8 to 14 Recruits per wave based on wave number)
    this.friendlyUnitsToSpawn = 6 + this.currentWaveIndex * 2;
    this.friendlySpawnTimer = 0;

    // Prepare Enemy Queue
    this.enemiesToSpawnQueue = [];
    for (const group of waveDef.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.enemiesToSpawnQueue.push({
          enemyClass: group.enemyClass,
          delay: group.delayBetween
        });
      }
    }
    this.enemySpawnTimer = 0;

    audio.playHit();
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

  private spawnEnemyUnit(enemyClass: EnemyClass) {
    // Spawn on the right edge of the battlefield arena
    const startX = 22 + (Math.random() - 0.5) * 2;
    const startZ = (Math.random() - 0.5) * 8;
    const startPos = new THREE.Vector3(startX, 0.4, startZ);

    this.unitManager.spawnEnemy(enemyClass, startPos);
  }

  private resolveWaveVictory() {
    this.waveInProgress = false;
    this.waveCleared = true;

    const waveDef = this.currentMission.waves[this.currentWaveIndex];
    this.playerGold += waveDef.rewardGold;

    // 1. Calculate Vault Reserve Gold Towers Interest
    for (const tower of this.towerManager.towers.values()) {
      if (tower.type === TowerType.GOLD && tower.currentBranch === UpgradeBranch.BRANCH_B) {
        const def = TOWER_DEFINITIONS[TowerType.GOLD].branchB;
        const interest = Math.round(this.playerGold * (def.roundInterestPercent || 0.18));
        const payout = Math.max(def.roundFlatGold || 50, interest);
        this.playerGold += payout;
        audio.playGoldGain();
        this.vfx.spawnFloatingText(tower.worldPos.clone().add(new THREE.Vector3(0, 2, 0)), `VAULT INTEREST: +${payout}g`, '#facc15', 2.0);
      }
    }

    // 2. Apply Slow Stacking Buffs to surviving friendly units!
    const survivingFriendlies = this.unitManager.units.filter(u => u.isFriendly && !u.isDead);
    for (const unit of survivingFriendlies) {
      const buffs = unit.applyEndOfWeekBuffs();
      if (buffs.length > 0) {
        audio.playUpgrade();
        this.vfx.spawnAscensionPillar(unit.worldPos, 0x22c55e);
        this.vfx.spawnFloatingText(unit.worldPos.clone().add(new THREE.Vector3(0, 1.2, 0)), buffs.join(' | '), '#4ade80', 2.5);
      }
    }

    this.currentWaveIndex++;

    // Check if Mission Complete
    if (this.currentWaveIndex >= this.currentMission.waves.length) {
      this.resolveMissionVictory();
    } else {
      this.updateHUD();
    }
  }

  private resolveMissionVictory() {
    let stars = 1; // 1 star for clearing
    if (this.castleHp >= this.castleMaxHp * 0.8) stars++;
    // Check if any unit achieved evolution
    const hasEvolved = this.unitManager.units.some(u => u.isFriendly && u.stats.tier >= 2);
    if (hasEvolved) stars++;

    this.techTree.recordMissionCompletion(this.currentMission.id, stars);

    this.ui.showVictory(
      stars,
      () => {
        // Next Mission
        const nextId = this.currentMission.id + 1;
        const nextM = CAMPAIGN_MISSIONS.find(m => m.id === nextId);
        if (nextM) this.loadMission(nextM);
        else this.ui.showCampaignMap();
      },
      () => {
        // Retry
        this.loadMission(this.currentMission);
      }
    );
  }

  private checkCitadelDamage(dt: number) {
    // If friendly units reach the right edge (enemy citadel), they bombard it
    for (const unit of this.unitManager.units) {
      if (unit.isFriendly && !unit.isDead && unit.inCombat) {
        if (unit.worldPos.x >= 23) {
          const dmg = Math.round(unit.attack * dt * 2);
          this.enemyCitadelHp = Math.max(0, this.enemyCitadelHp - dmg);
          this.vfx.spawnBurstParticles(new THREE.Vector3(25, 2, 0), 0xef4444, 3);
          if (this.enemyCitadelHp <= 0) {
            // Citadel Destroyed!
            this.resolveMissionVictory();
            return;
          }
        }
      }

      // If enemy units breach left (past portal into player castle)
      if (!unit.isFriendly && !unit.isDead) {
        if (unit.worldPos.x <= -4) {
          const breachDmg = unit.stats.attack;
          this.castleHp = Math.max(0, this.castleHp - breachDmg);
          audio.playDefeat();
          this.vfx.spawnFloatingText(new THREE.Vector3(-14, 2, 0), `CASTLE DAMAGED: -${breachDmg}`, '#ef4444', 1.5);
          unit.isDead = true;

          if (this.castleHp <= 0) {
            this.ui.showDefeat(() => this.loadMission(this.currentMission));
            return;
          }
        }
      }
    }
  }

  private updateHUD() {
    this.ui.renderTopBar(
      this.currentMission,
      Math.min(this.currentWaveIndex + 1, this.currentMission.waves.length),
      this.currentMission.waves.length,
      this.playerGold,
      this.castleHp,
      this.castleMaxHp,
      this.enemyCitadelHp,
      this.enemyCitadelMaxHp,
      this.gameSpeed,
      this.waveInProgress
    );
  }

  private setupMouseEvents() {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.updatePlacementGhost();
    });

    this.container.addEventListener('click', (e: MouseEvent) => {
      if (e.button !== 0) return;

      this.raycaster.setFromCamera(this.mouse, this.cameraCtrl.camera);

      // 1. If currently in Tower Placement mode
      if (this.ui.selectedTowerTypeForPlacement) {
        const point = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.groundPlane, point)) {
          const coord = this.grid.worldToGrid(point.x, point.z);
          if (coord) {
            const check = this.towerManager.canBuild(coord, this.ui.selectedTowerTypeForPlacement, this.playerGold);
            if (check.allowed) {
              const def = TOWER_DEFINITIONS[this.ui.selectedTowerTypeForPlacement];
              const tower = this.towerManager.buildTower(coord, this.ui.selectedTowerTypeForPlacement);
              if (tower) {
                this.playerGold -= def.cost;
                this.ui.selectedTowerTypeForPlacement = null;
                this.ui.renderTowerPalette();
                this.updatePlacementGhost();
                this.updateHUD();
              }
            } else {
              this.vfx.spawnFloatingText(point, check.reason || 'Cannot build here!', '#ef4444', 1.5);
            }
          }
        }
        return;
      }

      // 2. Check for Tower click
      let clickedTower: any = null;
      for (const tower of this.towerManager.towers.values()) {
        const intersects = this.raycaster.intersectObjects(tower.mesh.children, true);
        if (intersects.length > 0) {
          clickedTower = tower;
          break;
        }
      }

      if (clickedTower) {
        this.towerManager.selectTower(clickedTower);
        this.ui.showTowerCard(
          clickedTower,
          this.playerGold,
          (branch: UpgradeBranch) => {
            const res = this.towerManager.upgradeTower(clickedTower.id, branch, this.playerGold);
            if (res.success) {
              this.playerGold -= res.cost;
              this.updateHUD();
              this.ui.showTowerCard(clickedTower, this.playerGold, () => {}, () => {});
            } else if (res.reason) {
              this.vfx.spawnFloatingText(clickedTower.worldPos, res.reason, '#ef4444', 1.2);
            }
          },
          () => {
            const refund = this.towerManager.sellTower(clickedTower.id);
            this.playerGold += refund;
            this.ui.hideTowerCard();
            this.updateHUD();
          }
        );
        return;
      }

      // 3. Check for Unit click
      let clickedUnit: any = null;
      for (const unit of this.unitManager.units) {
        const intersects = this.raycaster.intersectObjects(unit.mesh.children, true);
        if (intersects.length > 0) {
          clickedUnit = unit;
          break;
        }
      }

      if (clickedUnit) {
        this.unitManager.selectUnit(clickedUnit);
        this.ui.showUnitCard(clickedUnit);
        return;
      }

      // Deselect all
      this.towerManager.selectTower(null);
      this.unitManager.selectUnit(null);
      this.ui.hideTowerCard();
      this.ui.hideUnitCard();
    });

    // Right click cancels placement
    window.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      if (this.ui.selectedTowerTypeForPlacement) {
        this.ui.selectedTowerTypeForPlacement = null;
        this.ui.renderTowerPalette();
        this.updatePlacementGhost();
      }
    });
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

        // Update range ring
        this.ghostRangeRing.position.set(world.x, 0.05, world.z);
        this.ghostRangeRing.geometry.dispose();
        this.ghostRangeRing.geometry = new THREE.RingGeometry(def.range - 0.15, def.range, 32);
        this.ghostRangeRing.geometry.rotateX(-Math.PI / 2);
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

    const dt = rawDt * this.gameSpeed;

    // 1. Camera
    this.cameraCtrl.update(rawDt);

    // 2. Wave Spawner
    if (this.waveInProgress && dt > 0) {
      // Spawn friendly recruits
      if (this.friendlyUnitsToSpawn > 0) {
        this.friendlySpawnTimer += dt;
        if (this.friendlySpawnTimer >= 1.2) {
          this.friendlySpawnTimer = 0;
          this.friendlyUnitsToSpawn--;
          this.spawnFriendlyRecruit();
        }
      }

      // Spawn enemy units
      if (this.enemiesToSpawnQueue.length > 0) {
        this.enemySpawnTimer += dt;
        const next = this.enemiesToSpawnQueue[0];
        if (this.enemySpawnTimer >= next.delay) {
          this.enemySpawnTimer = 0;
          this.enemiesToSpawnQueue.shift();
          this.spawnEnemyUnit(next.enemyClass);
        }
      }

      // Check if all enemies in wave are defeated
      if (
        this.friendlyUnitsToSpawn === 0 &&
        this.enemiesToSpawnQueue.length === 0
      ) {
        const remainingEnemies = this.unitManager.units.filter(u => !u.isFriendly && !u.isDead);
        if (remainingEnemies.length === 0 && !this.waveCleared) {
          this.resolveWaveVictory();
        }
      }
    }

    // 3. Update Systems
    if (dt > 0) {
      this.towerManager.update(now, this.unitManager.units, (gold) => {
        this.playerGold += gold;
        this.updateHUD();
      });

      this.unitManager.update(dt, now, (bounty) => {
        this.playerGold += bounty;
        this.updateHUD();
      });

      this.checkCitadelDamage(dt);
    }

    // 4. VFX & Floating Text
    this.vfx.update();

    // 5. Update Unit Card if selected
    if (this.unitManager.selectedUnit) {
      if (this.unitManager.selectedUnit.isDead) {
        this.ui.hideUnitCard();
        this.unitManager.selectedUnit = null;
      } else {
        this.ui.showUnitCard(this.unitManager.selectedUnit);
      }
    }

    // 6. Render 3D Scene
    this.renderer.renderer.render(this.renderer.scene, this.cameraCtrl.camera);
  }
}

// Start game on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
