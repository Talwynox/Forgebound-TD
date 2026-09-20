import * as THREE from 'three';
import { Grid, GridCoord, TileType } from '../grid/Grid';
import { Pathfinder } from '../grid/Pathfinder';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS, TowerDef, TowerUpgradeDef, SOLDIER_ABILITIES, ARCHER_ABILITIES, EvoAbilityTier } from './TowerData';
import { VFXManager } from '../vfx/VFXManager';
import { audio } from '../engine/AudioSystem';
import { Unit } from '../units/UnitManager';
import { FriendlyClass } from '../units/UnitData';

export interface TowerInstance {
  id: number;
  type: TowerType;
  gridCoord: GridCoord;
  worldPos: THREE.Vector3;
  mesh: THREE.Group;
  currentBranch: UpgradeBranch;
  branchLevel: number; // 0 = unbranched, 1 = rank 1, 2 = rank 2, 3 = rank 3...
  totalCostInvested: number;
  level: number; // 1 = base, 2 = rank 1, 3 = rank 2, 4 = rank 3...
  lastActionTime: number;
  effectiveRate: number; // Cast interval after Aura bonuses
  effectiveRange: number;
  auraBonusMultiplier: number;
  totalBuffApplied: number;
  totalHits: number;
  accumulatedStackBonus: number; // Stacking bonus accumulated at the end of each round
  roundsStacked: number; // How many rounds this tower has stacked
  // Evolution Tower Special State
  evoPath?: 'SOLDIER' | 'ARCHER';
  ability1Level: number; // 0 to 3
  ability2Level: number; // 0 to 3
  hasEvolvedThisWave: boolean;
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
  public rangeIndicator: THREE.Group | null = null;
  private rangeBorderMesh: THREE.Mesh | null = null;
  private rangeFillMesh: THREE.Mesh | null = null;

  constructor(grid: Grid, pathfinder: Pathfinder, scene: THREE.Scene, vfx: VFXManager) {
    this.grid = grid;
    this.pathfinder = pathfinder;
    this.scene = scene;
    this.vfx = vfx;

    this.createRangeIndicator();
  }

  private createRangeIndicator() {
    this.rangeIndicator = new THREE.Group();
    this.rangeIndicator.position.y = 0.14; // Above island surface (y=0.10) & road slabs (y=0.09)
    this.rangeIndicator.renderOrder = 30;

    // 1. Soft glowing fill area covering the entire radius
    const fillGeom = new THREE.CircleGeometry(1, 48);
    fillGeom.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide
    });
    this.rangeFillMesh = new THREE.Mesh(fillGeom, fillMat);
    this.rangeFillMesh.renderOrder = 29;
    this.rangeIndicator.add(this.rangeFillMesh);

    // 2. High-contrast perimeter boundary ring
    const ringGeom = new THREE.RingGeometry(0.85, 1, 48);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide
    });
    this.rangeBorderMesh = new THREE.Mesh(ringGeom, ringMat);
    this.rangeBorderMesh.renderOrder = 30;
    this.rangeIndicator.add(this.rangeBorderMesh);

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
      branchLevel: 0,
      totalCostInvested: def.cost,
      level: 1,
      lastActionTime: performance.now(),
      effectiveRate: def.rate,
      effectiveRange: def.range,
      auraBonusMultiplier: 0,
      totalBuffApplied: 0,
      totalHits: 0,
      accumulatedStackBonus: 0,
      roundsStacked: 0,
      evoPath: undefined,
      ability1Level: 0,
      ability2Level: 0,
      hasEvolvedThisWave: false
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

  getCurrentUpgrade(tower: TowerInstance): TowerUpgradeDef | null {
    if (tower.currentBranch === UpgradeBranch.NONE || tower.branchLevel === 0) return null;
    const def = TOWER_DEFINITIONS[tower.type];
    const list = tower.currentBranch === UpgradeBranch.BRANCH_A ? def.branchA : def.branchB;
    const idx = Math.min(tower.branchLevel - 1, list.length - 1);
    return list[idx] || null;
  }

  getNextUpgrade(tower: TowerInstance, branchChoice?: UpgradeBranch): { upg: TowerUpgradeDef; branch: UpgradeBranch } | null {
    const def = TOWER_DEFINITIONS[tower.type];
    if (tower.currentBranch === UpgradeBranch.NONE) {
      const branch = branchChoice || UpgradeBranch.BRANCH_A;
      const list = branch === UpgradeBranch.BRANCH_A ? def.branchA : def.branchB;
      return list[0] ? { upg: list[0], branch } : null;
    }
    const list = tower.currentBranch === UpgradeBranch.BRANCH_A ? def.branchA : def.branchB;
    if (tower.branchLevel < list.length) {
      return { upg: list[tower.branchLevel], branch: tower.currentBranch };
    }
    return null;
  }

  upgradeTower(towerId: number, branch: UpgradeBranch, playerGold: number): { success: boolean; cost: number; reason?: string } {
    const tower = this.towers.get(towerId);
    if (!tower) return { success: false, cost: 0, reason: 'Tower not found' };

    const def = TOWER_DEFINITIONS[tower.type];

    if (tower.type === TowerType.EVOLUTION) {
      if (tower.currentBranch !== UpgradeBranch.NONE) {
        return { success: false, cost: 0, reason: 'Path already chosen! Upgrade abilities below.' };
      }
      tower.currentBranch = branch;
      tower.branchLevel = 1;
      tower.evoPath = branch === UpgradeBranch.BRANCH_A ? 'SOLDIER' : 'ARCHER';
      tower.level = 2;
      const upgDef = branch === UpgradeBranch.BRANCH_A ? def.branchA[0] : def.branchB[0];
      tower.totalCostInvested += upgDef.cost;
      audio.playUpgrade();
      const forgeColor = tower.evoPath === 'SOLDIER' ? 0x3b82f6 : 0x10b981;
      this.vfx.spawnAscensionPillar(tower.worldPos, forgeColor);
      this.vfx.spawnFloatingText(
        tower.worldPos.clone().add(new THREE.Vector3(0, 2.5, 0)),
        `FORGE CHOSEN: ${tower.evoPath}!`,
        tower.evoPath === 'SOLDIER' ? '#60a5fa' : '#34d399',
        1.8
      );
      return { success: true, cost: upgDef.cost };
    }

    const next = this.getNextUpgrade(tower, branch);
    if (!next) return { success: false, cost: 0, reason: 'Tower is already at maximum upgrade rank!' };

    const upgDef = next.upg;
    if (playerGold < upgDef.cost) {
      return { success: false, cost: 0, reason: `Need ${upgDef.cost}g to upgrade.` };
    }

    if (tower.currentBranch === UpgradeBranch.NONE) {
      tower.currentBranch = branch;
      tower.branchLevel = 1;
    } else {
      tower.branchLevel++;
    }

    tower.level++;
    tower.totalCostInvested += upgDef.cost;
    tower.effectiveRange = upgDef.range;

    // Visual upgrade indicator: add or scale golden/arcane halo at top of mesh
    if (!tower.rotatingRing) {
      const haloGeom = new THREE.TorusGeometry(0.5, 0.06, 8, 24);
      haloGeom.rotateX(Math.PI / 2);
      const haloMat = new THREE.MeshStandardMaterial({
        color: tower.currentBranch === UpgradeBranch.BRANCH_A ? 0xfacc15 : 0xa855f7,
        emissive: tower.currentBranch === UpgradeBranch.BRANCH_A ? 0xeab308 : 0x7e22ce,
        emissiveIntensity: 0.6
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      haloMesh.position.y = 2.4;
      haloMesh.name = 'rotating';
      tower.mesh.add(haloMesh);
      tower.rotatingRing = haloMesh;
    } else {
      const scale = 1.0 + (tower.branchLevel - 1) * 0.25;
      tower.rotatingRing.scale.set(scale, scale, scale);
      const mat = (tower.rotatingRing as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.6 + tower.branchLevel * 0.25;
      }
    }

    this.recalculateAuras();
    this.showRange(tower);

    audio.playUpgrade();
    this.vfx.spawnAscensionPillar(tower.worldPos, def.accentColor);
    this.vfx.spawnFloatingText(tower.worldPos.clone().add(new THREE.Vector3(0, 2.5, 0)), `UPGRADED: ${upgDef.name}`, '#facc15', 1.5);

    return { success: true, cost: upgDef.cost };
  }

  upgradeEvoAbility(towerId: number, abilityIndex: 1 | 2, playerGold: number): { success: boolean; cost: number; reason?: string } {
    const tower = this.towers.get(towerId);
    if (!tower) return { success: false, cost: 0, reason: 'Tower not found' };
    if (tower.type !== TowerType.EVOLUTION || !tower.evoPath) {
      return { success: false, cost: 0, reason: 'Must choose Soldier or Archer path first!' };
    }

    const currentLvl = abilityIndex === 1 ? tower.ability1Level : tower.ability2Level;
    if (currentLvl >= 3) {
      return { success: false, cost: 0, reason: 'Ability already at maximum Tier 3!' };
    }

    let tierDef: EvoAbilityTier | undefined;
    if (tower.evoPath === 'SOLDIER') {
      tierDef = abilityIndex === 1
        ? SOLDIER_ABILITIES.armorAura[currentLvl]
        : SOLDIER_ABILITIES.crit[currentLvl];
    } else {
      tierDef = abilityIndex === 1
        ? ARCHER_ABILITIES.multishot[currentLvl]
        : ARCHER_ABILITIES.damageAura[currentLvl];
    }

    if (!tierDef) {
      return { success: false, cost: 0, reason: 'Invalid ability tier' };
    }

    if (playerGold < tierDef.cost) {
      return { success: false, cost: 0, reason: `Need ${tierDef.cost}g to upgrade ${tierDef.name}.` };
    }

    if (abilityIndex === 1) {
      tower.ability1Level++;
    } else {
      tower.ability2Level++;
    }

    tower.totalCostInvested += tierDef.cost;
    audio.playUpgrade();
    const color = tower.evoPath === 'SOLDIER' ? 0x3b82f6 : 0x10b981;
    this.vfx.spawnBurstParticles(tower.worldPos.clone().add(new THREE.Vector3(0, 1.5, 0)), color, 12);
    this.vfx.spawnFloatingText(
      tower.worldPos.clone().add(new THREE.Vector3(0, 2.5, 0)),
      `UPGRADED: ${tierDef.name}!`,
      tower.evoPath === 'SOLDIER' ? '#60a5fa' : '#34d399',
      1.5
    );

    return { success: true, cost: tierDef.cost };
  }

  resetWaveEvolutions() {
    for (const tower of this.towers.values()) {
      if (tower.type === TowerType.EVOLUTION) {
        tower.hasEvolvedThisWave = false;
      }
    }
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
      const curUpg = this.getCurrentUpgrade(auraTower);
      const bonus = curUpg?.auraSpeedBonus ?? def.auraSpeedBonus ?? 0.35;
      const range = auraTower.effectiveRange;

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
      const curUpg = this.getCurrentUpgrade(tower);
      const baseRate = curUpg?.rate ?? def.rate;

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

  applyRoundEndStacking(): { towerId: number; message: string; color: string; pos: THREE.Vector3 }[] {
    const results: { towerId: number; message: string; color: string; pos: THREE.Vector3 }[] = [];
    for (const tower of this.towers.values()) {
      if (tower.currentBranch === UpgradeBranch.BRANCH_B) {
        const curUpg = this.getCurrentUpgrade(tower);
        if (!curUpg) continue;

        let bonusGained = 0;
        let statName = '';
        let color = '#4ade80';

        if (tower.type === TowerType.SHRINE && curUpg.stackingHpPerRound) {
          bonusGained = curUpg.stackingHpPerRound;
          statName = 'HP/hit';
          color = '#4ade80';
        } else if (tower.type === TowerType.FORGE && curUpg.stackingArmorPerRound) {
          bonusGained = curUpg.stackingArmorPerRound;
          statName = 'Armor/hit';
          color = '#60a5fa';
        } else if (tower.type === TowerType.OBELISK && curUpg.stackingAttackPerRound) {
          bonusGained = curUpg.stackingAttackPerRound;
          statName = 'Attack/hit';
          color = '#fb923c';
        }

        if (bonusGained > 0) {
          tower.accumulatedStackBonus += bonusGained;
          tower.roundsStacked++;
          const def = TOWER_DEFINITIONS[tower.type];
          const baseVal = (tower.type === TowerType.SHRINE ? (curUpg.healAmount ?? def.healAmount ?? 1)
            : tower.type === TowerType.FORGE ? (curUpg.armorAmount ?? def.armorAmount ?? 1)
            : (curUpg.attackAmount ?? def.attackAmount ?? 1));
          const totalVal = baseVal + tower.accumulatedStackBonus;

          results.push({
            towerId: tower.id,
            message: `🌱 STACKED: +${bonusGained} ${statName} (Now: +${totalVal})`,
            color,
            pos: tower.worldPos.clone().add(new THREE.Vector3(0, 2.2, 0))
          });
        }
      }
    }
    return results;
  }

  getTowerStatsSummary(tower: TowerInstance): { currentEffect: string; lifetimeOutput: string } {
    const def = TOWER_DEFINITIONS[tower.type];
    const curUpg = this.getCurrentUpgrade(tower);
    let effectStr = '';
    let lifetimeStr = '';

    switch (tower.type) {
      case TowerType.SHRINE: {
        const baseHeal = curUpg?.healAmount ?? def.healAmount ?? 1;
        const totalHeal = baseHeal + tower.accumulatedStackBonus;
        const stackText = tower.accumulatedStackBonus > 0
          ? ` (+${tower.accumulatedStackBonus} from ${tower.roundsStacked} rounds stacked)`
          : (curUpg?.stackingHpPerRound ? ` (Grows +${curUpg.stackingHpPerRound} HP/round)` : '');
        effectStr = `Heals: +${totalHeal} HP per hit${stackText}`;
        lifetimeStr = `Total Healed: ${tower.totalBuffApplied} HP (${tower.totalHits} casts)`;
        break;
      }
      case TowerType.FORGE: {
        const baseArmor = curUpg?.armorAmount ?? def.armorAmount ?? 1;
        const totalArmor = baseArmor + tower.accumulatedStackBonus;
        const stackText = tower.accumulatedStackBonus > 0
          ? ` (+${tower.accumulatedStackBonus} from ${tower.roundsStacked} rounds stacked)`
          : (curUpg?.stackingArmorPerRound ? ` (Grows +${curUpg.stackingArmorPerRound} Armor/round)` : '');
        effectStr = `Armor: +${totalArmor} Armor per hit${stackText}`;
        lifetimeStr = `Total Armor Plated: +${tower.totalBuffApplied} (${tower.totalHits} casts)`;
        break;
      }
      case TowerType.OBELISK: {
        const baseAtk = curUpg?.attackAmount ?? def.attackAmount ?? 1;
        const totalAtk = baseAtk + tower.accumulatedStackBonus;
        const stackText = tower.accumulatedStackBonus > 0
          ? ` (+${tower.accumulatedStackBonus} from ${tower.roundsStacked} rounds stacked)`
          : (curUpg?.stackingAttackPerRound ? ` (Grows +${curUpg.stackingAttackPerRound} Attack/round)` : '');
        effectStr = `Attack: +${totalAtk} Attack per hit${stackText}`;
        lifetimeStr = `Total Attack Boosted: +${tower.totalBuffApplied} (${tower.totalHits} casts)`;
        break;
      }
      case TowerType.AURA: {
        const haste = Math.round((curUpg?.auraSpeedBonus ?? def.auraSpeedBonus ?? 0.35) * 100);
        effectStr = `Aura Haste: +${haste}% Cast Speed to nearby towers`;
        lifetimeStr = `Radius: ${tower.effectiveRange.toFixed(1)} tiles`;
        break;
      }
      case TowerType.FROST: {
        const slow = Math.round((curUpg?.slowPercent ?? def.slowPercent ?? 0.40) * 100);
        const dur = curUpg?.slowDuration ?? def.slowDuration ?? 3.2;
        effectStr = `Chill: -${slow}% Movement Speed for ${dur.toFixed(1)}s`;
        lifetimeStr = `Total Units Slowed: ${tower.totalHits}`;
        break;
      }
      case TowerType.RULEBREAKER: {
        const hp = curUpg?.fixedHp ?? def.fixedHp ?? 15;
        const speed = curUpg?.rate ?? def.rate;
        effectStr = `Reality Shift: Sets unit HP to ${hp} HP (Cast: ${speed.toFixed(2)}s | Skips units ≥${hp} HP)`;
        lifetimeStr = `Total Units Transmuted: ${tower.totalHits}`;
        break;
      }
      case TowerType.GOLD: {
        const g = curUpg?.goldPerHit ?? def.goldPerHit ?? 4;
        const interest = curUpg?.roundInterestPercent ? ` + ${Math.round(curUpg.roundInterestPercent * 100)}% round interest` : '';
        effectStr = `Income: +${g} Gold per hit${interest}`;
        lifetimeStr = `Total Gold Minted: ${tower.totalBuffApplied}g (${tower.totalHits} hits)`;
        break;
      }
      case TowerType.EVOLUTION: {
        if (!tower.evoPath) {
          effectStr = 'Select Soldier or Archer path to forge champions (Requires 250 HP base units).';
          lifetimeStr = 'Quota: 1 unit per wave | Individual building abilities';
        } else if (tower.evoPath === 'SOLDIER') {
          const quotaStr = tower.hasEvolvedThisWave
            ? '🔒 1/1 Evolved this wave'
            : '⚡ Ready to Evolve (Requires 250 HP)';
          effectStr = `Forges Soldier (1,250 HP cap, Melee). Status: ${quotaStr}`;
          lifetimeStr = `Armor Aura Lv.${tower.ability1Level}/3 | Crit Lv.${tower.ability2Level}/3 (${tower.totalHits} forged)`;
        } else {
          const quotaStr = tower.hasEvolvedThisWave
            ? '🔒 1/1 Evolved this wave'
            : '⚡ Ready to Evolve (Requires 250 HP)';
          effectStr = `Forges Archer (1,000 HP cap, Ranged). Status: ${quotaStr}`;
          lifetimeStr = `Multishot Lv.${tower.ability1Level}/3 | Damage Aura Lv.${tower.ability2Level}/3 (${tower.totalHits} forged)`;
        }
        break;
      }
    }

    return { currentEffect: effectStr, lifetimeOutput: lifetimeStr };
  }

  showRange(tower: TowerInstance) {
    if (!this.rangeIndicator || !this.rangeFillMesh || !this.rangeBorderMesh) return;
    const r = tower.effectiveRange;
    this.rangeIndicator.position.set(tower.worldPos.x, 0.14, tower.worldPos.z);

    // Update fill area scale
    this.rangeFillMesh.scale.set(r, r, 1);

    // Update outer perimeter boundary ring
    this.rangeBorderMesh.geometry.dispose();
    const ringGeom = new THREE.RingGeometry(Math.max(0.1, r - 0.15), r, 48);
    ringGeom.rotateX(-Math.PI / 2);
    this.rangeBorderMesh.geometry = ringGeom;

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
        if (dist > tower.effectiveRange) return false;

        // Special Rulebreaker logic:
        // Do not attack a unit which already has more (or equal) HP than what this tower sets it to!
        if (tower.type === TowerType.RULEBREAKER) {
          const curUpg = this.getCurrentUpgrade(tower);
          const targetFixedHp = curUpg?.fixedHp ?? def.fixedHp ?? 15;
          if (u.currentHp >= targetFixedHp) {
            return false;
          }
        }

        // Special Evolution Spire logic:
        // 1. One evolution per wave strictly!
        // 2. Must have chosen a path (Soldier or Archer)
        // 3. Unit must have reached max base HP (>= 250 HP)
        // 4. Unit must not already be an evolved champion
        if (tower.type === TowerType.EVOLUTION) {
          if (tower.hasEvolvedThisWave || !tower.evoPath) {
            return false;
          }
          if (u.currentHp < 250) {
            return false;
          }
          if (u.unitClass === FriendlyClass.SOLDIER || u.unitClass === FriendlyClass.ARCHER) {
            return false;
          }
        }

        return true;
      });

      if (targetsInRange.length === 0) continue;

      // Select target
      const target = targetsInRange[0];
      const fireFrom = tower.worldPos.clone().add(new THREE.Vector3(0, 1.6, 0));
      const fireTo = target.worldPos.clone().add(new THREE.Vector3(0, 0.5, 0));
      const def = TOWER_DEFINITIONS[tower.type];
      const curUpg = this.getCurrentUpgrade(tower);

      // Perform Tower Effect
      let fired = false;

      switch (tower.type) {
        case TowerType.SHRINE: {
          const baseHeal = curUpg?.healAmount ?? def.healAmount ?? 1;
          const heal = baseHeal + tower.accumulatedStackBonus;
          target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
          tower.totalBuffApplied += heal;
          tower.totalHits++;
          audio.playHealBuff();
          this.vfx.spawnBeam(fireFrom, fireTo, 0x22c55e);
          const stackNotice = tower.accumulatedStackBonus > 0 ? ` (+${tower.accumulatedStackBonus} stack)` : '';
          this.vfx.spawnFloatingText(fireTo, `+${heal} HP${stackNotice}`, '#4ade80');
          target.recordBuff('Vitality Shrine');
          fired = true;
          break;
        }

        case TowerType.FORGE: {
          const baseArmor = curUpg?.armorAmount ?? def.armorAmount ?? 1;
          const armor = baseArmor + tower.accumulatedStackBonus;
          target.armor += armor;
          tower.totalBuffApplied += armor;
          tower.totalHits++;
          audio.playArmorBuff();
          this.vfx.spawnBeam(fireFrom, fireTo, 0x38bdf8);
          const stackNotice = tower.accumulatedStackBonus > 0 ? ` (+${tower.accumulatedStackBonus} stack)` : '';
          this.vfx.spawnFloatingText(fireTo, `+${armor} Armor${stackNotice}`, '#60a5fa');
          target.recordBuff('Iron Forge');
          fired = true;
          break;
        }

        case TowerType.OBELISK: {
          const baseAtk = curUpg?.attackAmount ?? def.attackAmount ?? 1;
          const atk = baseAtk + tower.accumulatedStackBonus;
          target.attack += atk;
          tower.totalBuffApplied += atk;
          tower.totalHits++;
          audio.playAttackBuff();
          this.vfx.spawnBeam(fireFrom, fireTo, 0xf97316);
          const stackNotice = tower.accumulatedStackBonus > 0 ? ` (+${tower.accumulatedStackBonus} stack)` : '';
          this.vfx.spawnFloatingText(fireTo, `+${atk} Attack${stackNotice}`, '#fb923c');
          target.recordBuff('Flame Obelisk');
          fired = true;
          break;
        }

        case TowerType.FROST: {
          const slowPct = curUpg?.slowPercent ?? def.slowPercent ?? 0.40;
          const duration = curUpg?.slowDuration ?? def.slowDuration ?? 3.2;
          target.applySlow(slowPct, duration);
          tower.totalHits++;
          audio.playFrostSlow();
          this.vfx.spawnBeam(fireFrom, fireTo, 0x06b6d4);
          this.vfx.spawnFloatingText(fireTo, `FROST SLOW -${Math.round(slowPct * 100)}%`, '#67e8f9');
          fired = true;
          break;
        }

        case TowerType.RULEBREAKER: {
          const fixedHp = curUpg?.fixedHp ?? def.fixedHp ?? 15;
          const extraArmor = curUpg?.armorAmount ?? 0;

          if (target.currentHp >= fixedHp) {
            break; // Skip units that already have >= fixedHp
          }

          target.maxHp = Math.max(target.maxHp, fixedHp);
          target.currentHp = fixedHp;
          if (extraArmor > 0) {
            target.armor += extraArmor;
          }
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
          const goldGain = curUpg?.goldPerHit ?? def.goldPerHit ?? 4;
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
          if (tower.hasEvolvedThisWave || !tower.evoPath) break;
          if (target.currentHp < 250) break;
          if (target.unitClass === FriendlyClass.SOLDIER || target.unitClass === FriendlyClass.ARCHER) break;

          const isSoldier = tower.evoPath === 'SOLDIER';
          const newClass = isSoldier ? FriendlyClass.SOLDIER : FriendlyClass.ARCHER;

          target.morphClass(newClass);

          // Apply abilities bought in THIS SPECIFIC evo tower
          if (isSoldier) {
            if (tower.ability1Level > 0) {
              const tier = SOLDIER_ABILITIES.armorAura[tower.ability1Level - 1];
              target.armorAuraBonus = tier.bonus || 0;
              target.recordBuff(`Armor Aura Lv.${tower.ability1Level} (+${tier.bonus} Armor)`);
            }
            if (tower.ability2Level > 0) {
              const tier = SOLDIER_ABILITIES.crit[tower.ability2Level - 1];
              target.critChance = tier.chance || 0;
              target.critMultiplier = tier.multiplier || 2.0;
              target.recordBuff(`Crit Lv.${tower.ability2Level} (${Math.round((tier.chance || 0) * 100)}% @ ${tier.multiplier}x)`);
            }
          } else {
            if (tower.ability1Level > 0) {
              const tier = ARCHER_ABILITIES.multishot[tower.ability1Level - 1];
              target.multishotChance = tier.chance || 0;
              target.multishotTargets = tier.targets || 2;
              target.recordBuff(`Multishot Lv.${tower.ability1Level} (${Math.round((tier.chance || 0) * 100)}% -> ${tier.targets} targets)`);
            }
            if (tower.ability2Level > 0) {
              const tier = ARCHER_ABILITIES.damageAura[tower.ability2Level - 1];
              target.damageAuraBonus = tier.bonus || 0;
              target.recordBuff(`Damage Aura Lv.${tower.ability2Level} (+${tier.bonus} Attack)`);
            }
          }

          tower.hasEvolvedThisWave = true;
          tower.totalHits++;
          audio.playEvolution();
          this.vfx.spawnBeam(fireFrom, fireTo, isSoldier ? 0x3b82f6 : 0x10b981, 0.4);
          this.vfx.spawnAscensionPillar(target.worldPos, isSoldier ? 0x2563eb : 0x059669);
          this.vfx.spawnFloatingText(
            fireTo,
            `⚡ FORGED ${target.stats.name.toUpperCase()}! (Max HP: ${target.maxHp})`,
            isSoldier ? '#60a5fa' : '#34d399',
            2.2
          );
          fired = true;
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

