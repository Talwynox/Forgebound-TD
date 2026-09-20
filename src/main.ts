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

  // Phase and Mission lifecycle
  private wavePhase: 'IDLE' | 'MAZE_RUN' | 'ARENA_CLASH' = 'IDLE';
  private missionEnded: boolean = false;

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
    this.grid = new Grid(11, 11, 2, -22, 0);
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
    this.missionEnded = false;
    this.wavePhase = 'IDLE';

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
    this.renderer.buildRoadVisuals(this.grid);
    this.pathfinder.updatePathVisual();

    // Pre-spawn enemy army in the arena so player can inspect their stats during preparation!
    this.prepareWaveEnemiesInArena();

    this.updateHUD();
  }

  /**
   * Pre-spawns the enemy battalion for the current wave in battle formation in the arena.
   * Units wait idle and are fully clickable for stat inspection!
   */
  private prepareWaveEnemiesInArena() {
    // Remove previous enemy units
    for (let i = this.unitManager.units.length - 1; i >= 0; i--) {
      const u = this.unitManager.units[i];
      if (!u.isFriendly) {
        this.renderer.scene.remove(u.mesh);
        this.unitManager.units.splice(i, 1);
      }
    }

    if (this.currentWaveIndex >= this.currentMission.waves.length) return;
    const waveDef = this.currentMission.waves[this.currentWaveIndex];

    let enemyIndex = 0;
    for (const group of waveDef.enemies) {
      for (let i = 0; i < group.count; i++) {
        // Arrange in 2 to 3 ranks on the enemy side of the arena (X = 18..23, Z = -6..6)
        const row = Math.floor(enemyIndex / 6);
        const col = (enemyIndex % 6);
        const posX = 19 + row * 1.6;
        const posZ = -5 + col * 2.0;

        const startPos = new THREE.Vector3(posX, 0.4, posZ);
        this.unitManager.spawnEnemy(group.enemyClass, startPos, true); // true = waiting mode
        enemyIndex++;
      }
    }
  }

  private startWave() {
    if (this.waveInProgress) return;
    if (this.currentWaveIndex >= this.currentMission.waves.length) return;

    this.waveInProgress = true;
    this.waveCleared = false;
    this.wavePhase = 'MAZE_RUN';

    // Prepare Friendly Army (6 to 12 Recruits per wave based on wave number)
    this.friendlyUnitsToSpawn = 5 + this.currentWaveIndex * 2;
    this.friendlySpawnTimer = 0;

    audio.playBuild();
    this.updateHUD();
  }

  private triggerArenaClash() {
    this.wavePhase = 'ARENA_CLASH';
    audio.playEvolution();
    this.vfx.spawnFloatingText(new THREE.Vector3(13, 3, 0), '⚔️ THE ARENA CLASH BEGINS! CHARGE! ⚔️', '#facc15', 3.0);
    this.vfx.spawnAscensionPillar(new THREE.Vector3(2, 0, 0), 0x38bdf8);
    this.vfx.spawnAscensionPillar(new THREE.Vector3(22, 0, 0), 0xef4444);

    // Release all friendly units into combat
    for (const u of this.unitManager.units) {
      if (u.isFriendly && !u.isDead) {
        u.inCombat = true;
        u.stagingPos = null;
      }
    }

    // Unleash all waiting enemies in the arena
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
    // Core Pyro TD Mechanic: Recruits spawn severely wounded at 1 HP!
    unit.currentHp = 1;
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
    this.playerGold += waveDef.rewardGold;

    // 1. Calculate Vault Reserve Gold Towers Interest
    for (const tower of this.towerManager.towers.values()) {
      if (tower.type === TowerType.GOLD && tower.currentBranch === UpgradeBranch.BRANCH_B) {
        const curUpg = this.towerManager.getCurrentUpgrade(tower) || TOWER_DEFINITIONS[TowerType.GOLD].branchB[0];
        const interest = Math.round(this.playerGold * (curUpg.roundInterestPercent || 0.18));
        const payout = Math.max(curUpg.roundFlatGold || 50, interest);
        this.playerGold += payout;
        audio.playGoldGain();
        this.vfx.spawnFloatingText(tower.worldPos.clone().add(new THREE.Vector3(0, 2, 0)), `VAULT INTEREST: +${payout}g`, '#facc15', 2.0);
      }
    }

    // 2. Apply Slow Stacking Tower Growth at end of round!
    const stackEvents = this.towerManager.applyRoundEndStacking();
    for (const ev of stackEvents) {
      audio.playUpgrade();
      this.vfx.spawnAscensionPillar(ev.pos, 0x22c55e);
      this.vfx.spawnFloatingText(ev.pos, ev.message, ev.color, 2.5);
    }
    if (this.towerManager.selectedTower) {
      this.openTowerCard(this.towerManager.selectedTower);
    }

    this.currentWaveIndex++;

    // Clean up surviving friendly units from the completed wave so they don't attack next wave's waiting enemies!
    for (let i = this.unitManager.units.length - 1; i >= 0; i--) {
      const u = this.unitManager.units[i];
      if (u.isFriendly) {
        this.renderer.scene.remove(u.mesh);
        this.unitManager.units.splice(i, 1);
      }
    }

    // Check if Mission Complete (all 25 waves survived and defeated!)
    if (this.currentWaveIndex >= this.currentMission.waves.length) {
      this.resolveMissionVictory();
    } else {
      // Pre-spawn next wave's enemies immediately into the arena for player inspection during prep!
      this.prepareWaveEnemiesInArena();
      this.updateHUD();
    }
  }

  private resolveMissionVictory() {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.waveInProgress = false;
    this.wavePhase = 'IDLE';

    let stars = 1; // 1 star for clearing all waves
    if (this.castleHp >= this.castleMaxHp * 0.75) stars++;
    // Check if any unit achieved evolution during the mission
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

  private resolveMissionDefeat() {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.waveInProgress = false;
    this.wavePhase = 'IDLE';

    this.ui.showDefeat(() => this.loadMission(this.currentMission));
  }

  private checkCitadelDamage(dt: number) {
    if (this.missionEnded) return;

    // Friendly units attack enemy citadel during arena clash
    for (const unit of this.unitManager.units) {
      if (unit.isFriendly && !unit.isDead && unit.inCombat) {
        if (unit.worldPos.x >= 25) {
          const dmg = Math.round(unit.attack * dt * 2);
          this.enemyCitadelHp = Math.max(0, this.enemyCitadelHp - dmg);
          this.vfx.spawnBurstParticles(new THREE.Vector3(27, 2, 0), 0xef4444, 3);
        }
      }

      // If enemy units breach left (past arrival pad into abyss)
      if (!unit.isFriendly && !unit.isDead) {
        if (unit.worldPos.x <= 1) {
          const breachDmg = unit.stats.attack;
          this.castleHp = Math.max(0, this.castleHp - breachDmg);
          audio.playDefeat();
          this.vfx.spawnFloatingText(new THREE.Vector3(2, 2, 0), `CASTLE DAMAGED: -${breachDmg}`, '#ef4444', 1.5);
          unit.isDead = true;

          if (this.castleHp <= 0) {
            this.resolveMissionDefeat();
            return;
          }
        }
      }
    }
  }

  private updateHUD() {
    let phaseText = 'Prepare Maze';
    if (this.waveInProgress) {
      if (this.wavePhase === 'MAZE_RUN') {
        const assembled = this.unitManager.units.filter(u => u.isFriendly && u.hasCompletedMaze).length;
        const total = 5 + this.currentWaveIndex * 2;
        phaseText = `🏃 Maze (${assembled}/${total})`;
      } else {
        phaseText = '⚔️ Arena Clash!';
      }
    }

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
      this.waveInProgress,
      phaseText
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
            const tile = this.grid.getTile(coord.x, coord.z);
            if (tile === TileType.ROAD) {
              this.vfx.spawnFloatingText(point, 'Road tile! Build alongside the path.', '#ef4444', 1.5);
              return;
            }

            const check = this.towerManager.canBuild(coord, this.ui.selectedTowerTypeForPlacement, this.playerGold);
            if (check.allowed) {
              const def = TOWER_DEFINITIONS[this.ui.selectedTowerTypeForPlacement];
              const tower = this.towerManager.buildTower(coord, this.ui.selectedTowerTypeForPlacement);
              if (tower) {
                this.playerGold -= def.cost;
                this.ui.selectedTowerTypeForPlacement = null;
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
        this.openTowerCard(clickedTower);
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

  private openTowerCard(tower: any) {
    this.towerManager.selectTower(tower);
    this.ui.showTowerCard(
      tower,
      this.playerGold,
      (branch: UpgradeBranch) => {
        const res = this.towerManager.upgradeTower(tower.id, branch, this.playerGold);
        if (res.success) {
          this.playerGold -= res.cost;
          this.updateHUD();
          this.openTowerCard(tower); // Re-render card with new rank & next upgrade available!
        } else if (res.reason) {
          this.vfx.spawnFloatingText(tower.worldPos, res.reason, '#ef4444', 1.2);
        }
      },
      () => {
        const refund = this.towerManager.sellTower(tower.id);
        this.playerGold += refund;
        this.rerouteActiveUnits();
        this.ui.hideTowerCard();
        this.updateHUD();
      }
    );
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

    // 2. Wave Spawner & Phase Management
    if (this.waveInProgress && dt > 0) {
      if (this.wavePhase === 'MAZE_RUN') {
        // Spawn friendly recruits into the maze
        if (this.friendlyUnitsToSpawn > 0) {
          this.friendlySpawnTimer += dt;
          if (this.friendlySpawnTimer >= 1.2) {
            this.friendlySpawnTimer = 0;
            this.friendlyUnitsToSpawn--;
            this.spawnFriendlyRecruit();
          }
        }

        // Check friendly units assembling at the Arena gate
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

        // When all friendly recruits have finished running the maze and assembled at the gate:
        if (
          this.friendlyUnitsToSpawn === 0 &&
          livingFriendlies.length > 0 &&
          assembledCount === livingFriendlies.length
        ) {
          this.triggerArenaClash();
        }
      } else if (this.wavePhase === 'ARENA_CLASH') {
        // Check if all enemies in wave are defeated
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

