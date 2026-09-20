import * as THREE from 'three';
import { Grid, GridCoord, TileType } from '../grid/Grid';
import { Pathfinder } from '../grid/Pathfinder';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS, TowerDef, TowerUpgradeDef } from './TowerData';
import { VFXManager } from '../vfx/VFXManager';
import { audio } from '../engine/AudioSystem';
import { Unit } from '../units/UnitManager';

export interface TowerInstance {
  id: number;
  type: TowerType;
  gridCoord: GridCoord;
  worldPos: THREE.Vector3;
  mesh: THREE.Group;
  currentBranch: UpgradeBranch;
  totalCostInvested: number;
  level: number; // 1 = base, 2 = upgraded
  lastActionTime: number;
  effectiveRate: number; // Cast interval after Aura bonuses
  effectiveRange: number;
  auraBonusMultiplier: number;
  totalBuffApplied: number;
  totalHits: number;
  // Dynamic visual parts for animation
  floatingElement?: THREE.Object3D;
  rotatingRing?: THREE.Object3D;
}

export class TowerManager {
  public towers: Map<number, TowerInstance> = new Map();
  public nextId: number = 1;
  public grid: Grid;
  public pathfinder: Pathfinder;
  public scene: THREE.Scene;
  public vfx: VFXManager;

  public selectedTower: TowerInstance | null = null;
  public rangeIndicator: THREE.Mesh | null = null;

  constructor(grid: Grid, pathfinder: Pathfinder, scene: THREE.Scene, vfx: VFXManager) {
    this.grid = grid;
    this.pathfinder = pathfinder;
    this.scene = scene;
    this.vfx = vfx;

    this.createRangeIndicator();
  }

  private createRangeIndicator() {
    const geom = new THREE.RingGeometry(0.1, 1, 32);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.rangeIndicator = new THREE.Mesh(geom, mat);
    this.rangeIndicator.position.y = 0.08;
    this.rangeIndicator.visible = false;
    this.scene.add(this.rangeIndicator);
  }

  canBuild(coord: GridCoord, type: TowerType, playerGold: number): { allowed: boolean; reason?: string } {
    const def = TOWER_DEFINITIONS[type];
    if (playerGold < def.cost) {
      return { allowed: false, reason: `Not enough gold! Need ${def.cost}g.` };
    }
    if (!this.grid.isBuildable(coord.x, coord.z)) {
      return { allowed: false, reason: 'Tile is occupied or not buildable.' };
    }
    if (!this.pathfinder.canPlaceTower(coord.x, coord.z)) {
      return { allowed: false, reason: 'Placing a tower here would block the maze path!' };
    }
    return { allowed: true };
  }

  buildTower(coord: GridCoord, type: TowerType): TowerInstance | null {
    const def = TOWER_DEFINITIONS[type];
    const world = this.grid.gridToWorld(coord.x, coord.z);
    const worldPos = new THREE.Vector3(world.x, 0, world.z);

    const mesh = this.createTowerMesh(type, worldPos);
    this.scene.add(mesh);

    const tower: TowerInstance = {
      id: this.nextId++,
      type,
      gridCoord: { ...coord },
      worldPos,
      mesh,
      currentBranch: UpgradeBranch.NONE,
      totalCostInvested: def.cost,
      level: 1,
      lastActionTime: performance.now(),
      effectiveRate: def.rate,
      effectiveRange: def.range,
      auraBonusMultiplier: 0,
      totalBuffApplied: 0,
      totalHits: 0
    };

    // Extract animated parts
    mesh.traverse(child => {
      if (child.name === 'floating') tower.floatingElement = child;
      if (child.name === 'rotating') tower.rotatingRing = child;
    });

    this.grid.setTile(coord.x, coord.z, TileType.TOWER);
    this.towers.set(tower.id, tower);

    // Update Auras and visual path
    this.recalculateAuras();
    this.pathfinder.updatePathVisual();

    audio.playBuild();
    this.vfx.spawnBurstParticles(worldPos, def.accentColor, 12);

    return tower;
  }

  upgradeTower(towerId: number, branch: UpgradeBranch, playerGold: number): { success: boolean; cost: number; reason?: string } {
    const tower = this.towers.get(towerId);
    if (!tower) return { success: false, cost: 0, reason: 'Tower not found' };
    if (tower.level > 1) return { success: false, cost: 0, reason: 'Tower is already fully upgraded!' };

    const def = TOWER_DEFINITIONS[tower.type];
    const upgDef: TowerUpgradeDef = branch === UpgradeBranch.BRANCH_A ? def.branchA : def.branchB;

    if (playerGold < upgDef.cost) {
      return { success: false, cost: 0, reason: `Need ${upgDef.cost}g to upgrade.` };
    }

    tower.currentBranch = branch;
    tower.level = 2;
    tower.totalCostInvested += upgDef.cost;
    tower.effectiveRange = upgDef.range;

    // Visual upgrade indicator: add golden/arcane halo at top of mesh
    const haloGeom = new THREE.TorusGeometry(0.5, 0.06, 8, 24);
    haloGeom.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshStandardMaterial({
      color: branch === UpgradeBranch.BRANCH_A ? 0xfacc15 : 0xa855f7,
      emissive: branch === UpgradeBranch.BRANCH_A ? 0xeab308 : 0x7e22ce,
      emissiveIntensity: 0.6
    });
    const haloMesh = new THREE.Mesh(haloGeom, haloMat);
    haloMesh.position.y = 2.4;
    haloMesh.name = 'rotating';
    tower.mesh.add(haloMesh);
    tower.rotatingRing = haloMesh;

    this.recalculateAuras();
    this.showRange(tower);

    audio.playUpgrade();
    this.vfx.spawnAscensionPillar(tower.worldPos, def.accentColor);
    this.vfx.spawnFloatingText(tower.worldPos.clone().add(new THREE.Vector3(0, 2.5, 0)), `UPGRADED: ${upgDef.name}`, '#facc15', 1.5);

    return { success: true, cost: upgDef.cost };
  }

  sellTower(towerId: number): number {
    const tower = this.towers.get(towerId);
    if (!tower) return 0;

    const refund = Math.floor(tower.totalCostInvested * 0.75);

    this.scene.remove(tower.mesh);
    tower.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.grid.setTile(tower.gridCoord.x, tower.gridCoord.z, TileType.EMPTY);
    this.towers.delete(towerId);

    if (this.selectedTower?.id === towerId) {
      this.selectedTower = null;
      this.hideRange();
    }

    this.recalculateAuras();
    this.pathfinder.updatePathVisual();
    audio.playSell();
    this.vfx.spawnBurstParticles(tower.worldPos, 0x94a3b8, 10);

    return refund;
  }

  /**
   * Recalculate attack rates for all towers based on active Aura towers.
   */
  recalculateAuras() {
    // Reset aura bonuses
    for (const tower of this.towers.values()) {
      tower.auraBonusMultiplier = 0;
    }

    // Apply aura towers
    for (const auraTower of this.towers.values()) {
      if (auraTower.type !== TowerType.AURA) continue;

      const def = TOWER_DEFINITIONS[TowerType.AURA];
      let bonus = def.auraSpeedBonus || 0.3;
      let range = auraTower.effectiveRange;

      if (auraTower.currentBranch === UpgradeBranch.BRANCH_A) {
        bonus = def.branchA.auraSpeedBonus || 0.8;
      } else if (auraTower.currentBranch === UpgradeBranch.BRANCH_B) {
        bonus = def.branchB.auraSpeedBonus || 0.45;
      }

      for (const targetTower of this.towers.values()) {
        if (targetTower.id === auraTower.id) continue;
        const dist = auraTower.worldPos.distanceTo(targetTower.worldPos);
        if (dist <= range) {
          targetTower.auraBonusMultiplier += bonus;
        }
      }
    }

    // Apply final effectiveRate = baseRate / (1 + totalAuraBonus)
    for (const tower of this.towers.values()) {
      const def = TOWER_DEFINITIONS[tower.type];
      let baseRate = def.rate;
      if (tower.currentBranch === UpgradeBranch.BRANCH_A) baseRate = def.branchA.rate;
      if (tower.currentBranch === UpgradeBranch.BRANCH_B) baseRate = def.branchB.rate;

      tower.effectiveRate = baseRate / (1 + tower.auraBonusMultiplier);
    }
  }

  selectTower(tower: TowerInstance | null) {
    this.selectedTower = tower;
    if (tower) {
      this.showRange(tower);
    } else {
      this.hideRange();
    }
  }

  getTowerStatsSummary(tower: TowerInstance): { currentEffect: string; lifetimeOutput: string } {
    const def = TOWER_DEFINITIONS[tower.type];
    let effectStr = '';
    let lifetimeStr = '';

    switch (tower.type) {
      case TowerType.SHRINE: {
        const heal = tower.currentBranch === UpgradeBranch.BRANCH_A
          ? def.branchA.healAmount || 100
          : tower.currentBranch === UpgradeBranch.BRANCH_B
          ? def.branchB.healAmount || 30
          : def.healAmount || 40;
        effectStr = `Heals: +${heal} HP per hit`;
        lifetimeStr = `Total Healed: ${tower.totalBuffApplied} HP (${tower.totalHits} casts)`;
        break;
      }
      case TowerType.FORGE: {
        const armor = tower.currentBranch === UpgradeBranch.BRANCH_A
          ? def.branchA.armorAmount || 15
          : tower.currentBranch === UpgradeBranch.BRANCH_B
          ? def.branchB.armorAmount || 4
          : def.armorAmount || 5;
        effectStr = `Armor: +${armor} Armor per hit`;
        lifetimeStr = `Total Armor Plated: +${tower.totalBuffApplied} (${tower.totalHits} casts)`;
        break;
      }
      case TowerType.OBELISK: {
        const atk = tower.currentBranch === UpgradeBranch.BRANCH_A
          ? def.branchA.attackAmount || 22
          : tower.currentBranch === UpgradeBranch.BRANCH_B
          ? def.branchB.attackAmount || 5
          : def.attackAmount || 8;
        effectStr = `Attack: +${atk} Attack per hit`;
        lifetimeStr = `Total Attack Boosted: +${tower.totalBuffApplied} (${tower.totalHits} casts)`;
        break;
      }
      case TowerType.AURA: {
        const haste = Math.round(((tower.currentBranch === UpgradeBranch.BRANCH_A
          ? def.branchA.auraSpeedBonus || 0.8
          : tower.currentBranch === UpgradeBranch.BRANCH_B
          ? def.branchB.auraSpeedBonus || 0.45
          : def.auraSpeedBonus || 0.35)) * 100);
        effectStr = `Aura Haste: +${haste}% Cast Speed to nearby towers`;
        lifetimeStr = `Radius: ${tower.effectiveRange.toFixed(1)} tiles`;
        break;
      }
      case TowerType.FROST: {
        const slow = Math.round(((tower.currentBranch === UpgradeBranch.BRANCH_A
          ? def.branchA.slowPercent || 0.7
          : tower.currentBranch === UpgradeBranch.BRANCH_B
          ? def.branchB.slowPercent || 0.5
          : def.slowPercent || 0.4)) * 100);
        const dur = tower.currentBranch === UpgradeBranch.BRANCH_A
          ? def.branchA.slowDuration || 4.5
          : def.slowDuration || 3.2;
        effectStr = `Chill: -${slow}% Movement Speed for ${dur}s`;
        lifetimeStr = `Total Units Slowed: ${tower.totalHits}`;
        break;
      }
      case TowerType.RULEBREAKER: {
        const hp = tower.currentBranch === UpgradeBranch.BRANCH_A
          ? def.branchA.fixedHp || 1200
          : tower.currentBranch === UpgradeBranch.BRANCH_B
          ? def.branchB.fixedHp || 750
          : def.fixedHp || 500;
        effectStr = `Reality Shift: Unit HP set directly to ${hp} HP`;
        lifetimeStr = `Total Units Transmuted: ${tower.totalHits}`;
        break;
      }
      case TowerType.GOLD: {
        const g = tower.currentBranch === UpgradeBranch.BRANCH_A
          ? def.branchA.goldPerHit || 12
          : def.goldPerHit || 4;
        effectStr = `Income: +${g} Gold per hit`;
        lifetimeStr = `Total Gold Minted: ${tower.totalBuffApplied}g (${tower.totalHits} hits)`;
        break;
      }
      case TowerType.EVOLUTION: {
        effectStr = tower.currentBranch === UpgradeBranch.BRANCH_A
          ? 'Ascends units to Tier 2 & Tier 3 (Paladin, Colossus, Archmage)'
          : 'Ascends units to Tier 2 (Footman, Knight, Berserker, Cleric)';
        lifetimeStr = `Total Champions Ascended: ${tower.totalHits}`;
        break;
      }
    }

    return { currentEffect: effectStr, lifetimeOutput: lifetimeStr };
  }

  showRange(tower: TowerInstance) {
    if (!this.rangeIndicator) return;
    const r = tower.effectiveRange;
    this.rangeIndicator.geometry.dispose();
    this.rangeIndicator.geometry = new THREE.RingGeometry(r - 0.15, r, 48);
    this.rangeIndicator.geometry.rotateX(-Math.PI / 2);
    this.rangeIndicator.position.set(tower.worldPos.x, 0.08, tower.worldPos.z);
    this.rangeIndicator.visible = true;
  }

  hideRange() {
    if (this.rangeIndicator) {
      this.rangeIndicator.visible = false;
    }
  }

  /**
   * Update tower animations (floating crystals, spinning rings) and fire buffs on units
   */
  update(time: number, units: Unit[], addGoldCallback: (amount: number) => void) {
    // 1. Visual animations
    for (const tower of this.towers.values()) {
      if (tower.floatingElement) {
        tower.floatingElement.position.y = 1.6 + Math.sin(time * 0.003 + tower.id) * 0.12;
        tower.floatingElement.rotation.y += 0.015;
      }
      if (tower.rotatingRing) {
        tower.rotatingRing.rotation.y += 0.025;
        tower.rotatingRing.rotation.z += 0.01;
      }
    }

    // 2. Tower Actions / Buff Casts
    for (const tower of this.towers.values()) {
      if (tower.type === TowerType.AURA) {
        // Aura tower pulses passively; recalculateAuras handles stats
        continue;
      }

      const elapsed = (time - tower.lastActionTime) / 1000;
      if (elapsed < tower.effectiveRate) continue;

      // Find eligible friendly units in range that are traversing the maze
      const targetsInRange = units.filter(u => {
        if (!u.isFriendly || u.isDead || u.inCombat) return false;
        const dist = tower.worldPos.distanceTo(u.worldPos);
        return dist <= tower.effectiveRange;
      });

      if (targetsInRange.length === 0) continue;

      // Select target
      const target = targetsInRange[0];
      const fireFrom = tower.worldPos.clone().add(new THREE.Vector3(0, 1.6, 0));
      const fireTo = target.worldPos.clone().add(new THREE.Vector3(0, 0.5, 0));
      const def = TOWER_DEFINITIONS[tower.type];

      // Perform Tower Effect
      let fired = false;

      switch (tower.type) {
        case TowerType.SHRINE: {
          let heal = def.healAmount || 40;
          if (tower.currentBranch === UpgradeBranch.BRANCH_A) {
            heal = def.branchA.healAmount || 100;
          } else if (tower.currentBranch === UpgradeBranch.BRANCH_B) {
            heal = def.branchB.healAmount || 30;
            const stackHp = def.branchB.stackingHpPerRound || 60;
            target.stackingLifebloom += stackHp;
            this.vfx.spawnFloatingText(fireTo, `+Lifebloom (${target.stackingLifebloom} HP)`, '#86efac', 1.0);
          }
          target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
          tower.totalBuffApplied += heal;
          tower.totalHits++;
          audio.playHealBuff();
          this.vfx.spawnBeam(fireFrom, fireTo, 0x22c55e);
          this.vfx.spawnFloatingText(fireTo, `+${heal} HP`, '#4ade80');
          target.recordBuff('Vitality Shrine');
          fired = true;
          break;
        }

        case TowerType.FORGE: {
          let armor = def.armorAmount || 5;
          if (tower.currentBranch === UpgradeBranch.BRANCH_A) {
            armor = def.branchA.armorAmount || 15;
          } else if (tower.currentBranch === UpgradeBranch.BRANCH_B) {
            armor = def.branchB.armorAmount || 4;
            const stackArmor = def.branchB.stackingArmorPerRound || 10;
            target.stackingArmor += stackArmor;
            this.vfx.spawnFloatingText(fireTo, `+Tempered (${target.stackingArmor} Armor)`, '#93c5fd', 1.0);
          }
          target.armor += armor;
          tower.totalBuffApplied += armor;
          tower.totalHits++;
          audio.playArmorBuff();
          this.vfx.spawnBeam(fireFrom, fireTo, 0x38bdf8);
          this.vfx.spawnFloatingText(fireTo, `+${armor} Armor`, '#60a5fa');
          target.recordBuff('Iron Forge');
          fired = true;
          break;
        }

        case TowerType.OBELISK: {
          let atk = def.attackAmount || 8;
          if (tower.currentBranch === UpgradeBranch.BRANCH_A) {
            atk = def.branchA.attackAmount || 22;
          } else if (tower.currentBranch === UpgradeBranch.BRANCH_B) {
            atk = def.branchB.attackAmount || 5;
            const stackAtk = def.branchB.stackingAttackPerRound || 14;
            target.stackingAttack += stackAtk;
            this.vfx.spawnFloatingText(fireTo, `+Frenzy (${target.stackingAttack} ATK)`, '#fdba74', 1.0);
          }
          target.attack += atk;
          tower.totalBuffApplied += atk;
          tower.totalHits++;
          audio.playAttackBuff();
          this.vfx.spawnBeam(fireFrom, fireTo, 0xf97316);
          this.vfx.spawnFloatingText(fireTo, `+${atk} Attack`, '#fb923c');
          target.recordBuff('Flame Obelisk');
          fired = true;
          break;
        }

        case TowerType.FROST: {
          let slowPct = def.slowPercent || 0.4;
          let duration = def.slowDuration || 3.0;
          if (tower.currentBranch === UpgradeBranch.BRANCH_A) {
            slowPct = def.branchA.slowPercent || 0.7;
            duration = def.branchA.slowDuration || 4.5;
          } else if (tower.currentBranch === UpgradeBranch.BRANCH_B) {
            slowPct = def.branchB.slowPercent || 0.5;
            duration = def.branchB.slowDuration || 3.8;
          }
          target.applySlow(slowPct, duration);
          tower.totalHits++;
          audio.playFrostSlow();
          this.vfx.spawnBeam(fireFrom, fireTo, 0x06b6d4);
          this.vfx.spawnFloatingText(fireTo, `FROST SLOW -${Math.round(slowPct * 100)}%`, '#67e8f9');
          fired = true;
          break;
        }

        case TowerType.RULEBREAKER: {
          let fixedHp = def.fixedHp || 500;
          let extraArmor = 0;
          if (tower.currentBranch === UpgradeBranch.BRANCH_A) {
            fixedHp = def.branchA.fixedHp || 1200;
          } else if (tower.currentBranch === UpgradeBranch.BRANCH_B) {
            fixedHp = def.branchB.fixedHp || 750;
            extraArmor = def.branchB.armorAmount || 20;
            target.armor += extraArmor;
          }
          target.maxHp = fixedHp;
          target.currentHp = fixedHp;
          tower.totalHits++;
          audio.playRulebreaker();
          this.vfx.spawnBeam(fireFrom, fireTo, 0xe11d48, 0.25);
          this.vfx.spawnAscensionPillar(target.worldPos, 0xe11d48);
          this.vfx.spawnFloatingText(fireTo, `RULEBREAKER: HP -> ${fixedHp}!`, '#f43f5e', 1.8);
          target.recordBuff('Rulebreaker Reality Shift');
          fired = true;
          break;
        }

        case TowerType.GOLD: {
          let goldGain = def.goldPerHit || 4;
          if (tower.currentBranch === UpgradeBranch.BRANCH_A) {
            goldGain = def.branchA.goldPerHit || 12;
          }
          addGoldCallback(goldGain);
          tower.totalBuffApplied += goldGain;
          tower.totalHits++;
          audio.playGoldGain();
          this.vfx.spawnBeam(fireFrom, fireTo, 0xeab308);
          this.vfx.spawnFloatingText(fireTo, `+${goldGain} Gold`, '#facc15');
          fired = true;
          break;
        }

        case TowerType.EVOLUTION: {
          const allowTier3 = tower.currentBranch === UpgradeBranch.BRANCH_A;
          const evolved = target.checkAndEvolve(allowTier3);
          if (evolved) {
            tower.totalHits++;
            audio.playEvolution();
            this.vfx.spawnBeam(fireFrom, fireTo, 0x8b5cf6, 0.3);
            this.vfx.spawnAscensionPillar(target.worldPos, 0xa855f7);
            this.vfx.spawnFloatingText(fireTo, `ASCENDED: ${target.stats.name.toUpperCase()}!`, '#c084fc', 2.0);
            fired = true;
          }
          break;
        }
      }

      if (fired) {
        tower.lastActionTime = time;
      }
    }
  }

  /**
   * Generates procedural 3D low-poly meshes for towers
   */
  private createTowerMesh(type: TowerType, pos: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Stone base for all towers
    const baseGeom = new THREE.CylinderGeometry(0.85, 0.95, 0.35, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8,
      metalness: 0.2
    });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 0.175;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const def = TOWER_DEFINITIONS[type];

    switch (type) {
      case TowerType.SHRINE: {
        // Emerald crystal shrine
        const pillarGeom = new THREE.CylinderGeometry(0.35, 0.5, 1.2, 6);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
        const pillar = new THREE.Mesh(pillarGeom, pillarMat);
        pillar.position.y = 0.8;
        group.add(pillar);

        const crystalGeom = new THREE.OctahedronGeometry(0.45, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: def.color,
          emissive: def.accentColor,
          emissiveIntensity: 0.6,
          roughness: 0.2
        });
        const crystal = new THREE.Mesh(crystalGeom, crystalMat);
        crystal.name = 'floating';
        crystal.position.y = 1.6;
        group.add(crystal);
        break;
      }

      case TowerType.FORGE: {
        // Heavy iron anvil & glowing embers
        const anvilGeom = new THREE.BoxGeometry(0.7, 0.6, 0.7);
        const anvilMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
        const anvil = new THREE.Mesh(anvilGeom, anvilMat);
        anvil.position.y = 0.5;
        group.add(anvil);

        const hammerGeom = new THREE.BoxGeometry(0.35, 0.3, 0.6);
        const hammerMat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.5
        });
        const hammer = new THREE.Mesh(hammerGeom, hammerMat);
        hammer.name = 'floating';
        hammer.position.y = 1.5;
        group.add(hammer);
        break;
      }

      case TowerType.OBELISK: {
        // Tall fiery obelisk
        const obeliskGeom = new THREE.ConeGeometry(0.4, 1.6, 4);
        const obeliskMat = new THREE.MeshStandardMaterial({
          color: 0x7c2d12,
          emissive: 0xf97316,
          emissiveIntensity: 0.4
        });
        const obelisk = new THREE.Mesh(obeliskGeom, obeliskMat);
        obelisk.position.y = 1.0;
        group.add(obelisk);

        const flameGeom = new THREE.DodecahedronGeometry(0.35, 0);
        const flameMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.9
        });
        const flame = new THREE.Mesh(flameGeom, flameMat);
        flame.name = 'floating';
        flame.position.y = 1.8;
        group.add(flame);
        break;
      }

      case TowerType.AURA: {
        // Arcane spire with rotating rings
        const spireGeom = new THREE.CylinderGeometry(0.2, 0.4, 1.4, 8);
        const spireMat = new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.4 });
        const spire = new THREE.Mesh(spireGeom, spireMat);
        spire.position.y = 0.9;
        group.add(spire);

        const ringGeom = new THREE.TorusGeometry(0.55, 0.08, 8, 24);
        ringGeom.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          emissive: 0xa855f7,
          emissiveIntensity: 0.8
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.name = 'rotating';
        ring.position.y = 1.3;
        group.add(ring);

        const orbGeom = new THREE.SphereGeometry(0.3, 12, 12);
        const orbMat = new THREE.MeshStandardMaterial({
          color: 0xf472b6,
          emissive: 0xec4899,
          emissiveIntensity: 0.8
        });
        const orb = new THREE.Mesh(orbGeom, orbMat);
        orb.name = 'floating';
        orb.position.y = 1.8;
        group.add(orb);
        break;
      }

      case TowerType.FROST: {
        // Ice crystal monolith
        const iceGeom = new THREE.ConeGeometry(0.45, 1.7, 5);
        const iceMat = new THREE.MeshStandardMaterial({
          color: 0x0891b2,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.5,
          roughness: 0.1,
          transparent: true,
          opacity: 0.88
        });
        const ice = new THREE.Mesh(iceGeom, iceMat);
        ice.position.y = 1.0;
        group.add(ice);

        const floatIceGeom = new THREE.OctahedronGeometry(0.35);
        const floatIceMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.9
        });
        const floatIce = new THREE.Mesh(floatIceGeom, floatIceMat);
        floatIce.name = 'floating';
        floatIce.position.y = 1.85;
        group.add(floatIce);
        break;
      }

      case TowerType.RULEBREAKER: {
        // Dark crimson monolith with floating cubic reality core
        const corePillar = new THREE.CylinderGeometry(0.3, 0.5, 1.2, 4);
        const coreMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
        const pillar = new THREE.Mesh(corePillar, coreMat);
        pillar.position.y = 0.8;
        group.add(pillar);

        const cubeGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const cubeMat = new THREE.MeshStandardMaterial({
          color: 0xe11d48,
          emissive: 0xbe123c,
          emissiveIntensity: 0.9
        });
        const cube = new THREE.Mesh(cubeGeom, cubeMat);
        cube.name = 'floating';
        cube.position.y = 1.6;
        group.add(cube);
        break;
      }

      case TowerType.GOLD: {
        // Golden treasure monument
        const pillarGeom = new THREE.CylinderGeometry(0.35, 0.45, 1.2, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.5 });
        const pillar = new THREE.Mesh(pillarGeom, pillarMat);
        pillar.position.y = 0.8;
        group.add(pillar);

        const coinGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16);
        coinGeom.rotateZ(Math.PI / 2);
        const coinMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xeab308,
          emissiveIntensity: 0.7,
          metalness: 0.8,
          roughness: 0.2
        });
        const coin = new THREE.Mesh(coinGeom, coinMat);
        coin.name = 'floating';
        coin.position.y = 1.7;
        group.add(coin);
        break;
      }

      case TowerType.EVOLUTION: {
        // Arcane gateway arch with celestial core
        const archGeom = new THREE.TorusGeometry(0.7, 0.15, 8, 16, Math.PI);
        const archMat = new THREE.MeshStandardMaterial({
          color: 0x6d28d9,
          emissive: 0x4c1d95,
          roughness: 0.3
        });
        const arch = new THREE.Mesh(archGeom, archMat);
        arch.position.y = 0.8;
        group.add(arch);

        const coreGeom = new THREE.DodecahedronGeometry(0.4, 0);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0xc4b5fd,
          emissive: 0x8b5cf6,
          emissiveIntensity: 0.9
        });
        const core = new THREE.Mesh(coreGeom, coreMat);
        core.name = 'floating';
        core.position.y = 1.4;
        group.add(core);
        break;
      }
    }

    return group;
  }
}

