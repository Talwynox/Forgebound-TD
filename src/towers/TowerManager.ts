import * as THREE from 'three';
import { Grid, GridCoord, TileType } from '../grid/Grid';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS, TowerDef, TowerUpgradeDef, SOLDIER_ABILITIES, ARCHER_ABILITIES, MAGE_ABILITIES, EvoAbilityTier } from './TowerData';
import { VFXManager } from '../vfx/VFXManager';
import { audio } from '../engine/AudioSystem';
import { Unit } from '../units/UnitManager';
import { FriendlyClass } from '../units/UnitData';
import { TeamId } from '../game/Teams';

export interface TowerInstance {
  id: number;
  type: TowerType;
  gridCoord: GridCoord;
  worldPos: THREE.Vector3;
  mesh: THREE.Group;
  ownerPeerId?: string;
  ownerName?: string;
  team: TeamId;
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
  evoPath?: 'SOLDIER' | 'ARCHER' | 'MAGE';
  ability1Level: number; // 0 to 10
  ability2Level: number; // 0 to 10
  ability3Level: number; // 0 to 10
  ability4Level: number; // 0 to 10
  hasEvolvedThisWave: boolean;
  // Dynamic visual parts for animation
  floatingElement?: THREE.Object3D;
  rotatingRing?: THREE.Object3D;
}

export class TowerManager {
  public towers: Map<number, TowerInstance> = new Map();
  public nextId: number = 1;
  /** Each team builds on its own maze grid (solo/co-op only use the Sun grid). */
  private grids: Record<TeamId, Grid>;
  public scene: THREE.Scene;
  public vfx: VFXManager;

  public selectedTower: TowerInstance | null = null;
  private smartFocusByTeam: Record<TeamId, boolean> = { SUN: true, MOON: true };
  /** The local player's team: what team-scoped getters used by the UI report. */
  public viewTeam: TeamId = 'SUN';
  public rangeIndicator: THREE.Group | null = null;
  private rangeBorderMesh: THREE.Mesh | null = null;
  private rangeFillMesh: THREE.Mesh | null = null;
  public onChampionEvolved: () => void = () => {};

  get smartFocusEnabled(): boolean {
    return this.smartFocusByTeam[this.viewTeam];
  }

  isSmartFocus(team: TeamId): boolean {
    return this.smartFocusByTeam[team];
  }

  setSmartFocus(team: TeamId, enabled: boolean) {
    this.smartFocusByTeam[team] = enabled;
  }

  toggleSmartFocus(team: TeamId = 'SUN'): boolean {
    this.smartFocusByTeam[team] = !this.smartFocusByTeam[team];
    return this.smartFocusByTeam[team];
  }

  constructor(sunGrid: Grid, moonGrid: Grid, scene: THREE.Scene, vfx: VFXManager) {
    this.grids = { SUN: sunGrid, MOON: moonGrid };
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
      opacity: 0.18,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
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
      opacity: 0.90,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -6,
      side: THREE.DoubleSide
    });
    this.rangeBorderMesh = new THREE.Mesh(ringGeom, ringMat);
    this.rangeBorderMesh.renderOrder = 30;
    this.rangeIndicator.add(this.rangeBorderMesh);

    this.rangeIndicator.visible = false;
    this.scene.add(this.rangeIndicator);
  }

  getGrid(team: TeamId): Grid {
    return this.grids[team];
  }

  /** Towers of a type owned by a team (the Gold Spire limit is per team). */
  getTowerCountByType(type: TowerType, team: TeamId = this.viewTeam): number {
    let count = 0;
    for (const tower of this.towers.values()) {
      if (tower.type === type && tower.team === team) count++;
    }
    return count;
  }

  canBuild(coord: GridCoord, type: TowerType, playerGold: number, team: TeamId = 'SUN'): { allowed: boolean; reason?: string } {
    const def = TOWER_DEFINITIONS[type];
    if (playerGold < def.cost) {
      return { allowed: false, reason: `Not enough gold! Need ${def.cost}g.` };
    }
    if (type === TowerType.GOLD && this.getTowerCountByType(TowerType.GOLD, team) >= 4) {
      return { allowed: false, reason: 'Gold Spire limit reached! Maximum 4 Gold Spires allowed.' };
    }
    if (!this.grids[team].isBuildable(coord.x, coord.z)) {
      return { allowed: false, reason: 'Tile is occupied or not buildable.' };
    }
    return { allowed: true };
  }

  buildTower(
    coord: GridCoord,
    type: TowerType,
    forcedId?: number,
    ownerPeerId?: string,
    ownerName?: string,
    team: TeamId = 'SUN'
  ): TowerInstance | null {
    const def = TOWER_DEFINITIONS[type];
    const grid = this.grids[team];
    const world = grid.gridToWorld(coord.x, coord.z);
    const worldPos = new THREE.Vector3(world.x, 0, world.z);

    const mesh = this.createTowerMesh(type, worldPos);
    this.scene.add(mesh);

    const id = forcedId !== undefined ? forcedId : this.nextId++;
    if (forcedId !== undefined && forcedId >= this.nextId) {
      this.nextId = forcedId + 1;
    }

    const tower: TowerInstance = {
      id,
      type,
      gridCoord: { ...coord },
      worldPos,
      mesh,
      ownerPeerId,
      ownerName,
      team,
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
      ability3Level: 0,
      ability4Level: 0,
      hasEvolvedThisWave: false
    };

    // Extract animated parts
    mesh.traverse(child => {
      if (child.name === 'floating') tower.floatingElement = child;
      if (child.name === 'rotating') tower.rotatingRing = child;
    });

    grid.setTile(coord.x, coord.z, TileType.TOWER);
    this.towers.set(tower.id, tower);

    this.recalculateAuras();

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
      const pathCost = (branch === UpgradeBranch.BRANCH_A
        ? def.branchA[0]
        : (branch === UpgradeBranch.BRANCH_B ? def.branchB[0] : (def.branchC ? def.branchC[0] : def.branchA[0]))).cost;
      if (playerGold < pathCost) {
        return { success: false, cost: 0, reason: `Need ${pathCost}g to choose this path.` };
      }
      tower.currentBranch = branch;
      tower.branchLevel = 1;
      tower.evoPath = branch === UpgradeBranch.BRANCH_A
        ? 'SOLDIER'
        : (branch === UpgradeBranch.BRANCH_B ? 'ARCHER' : 'MAGE');
      tower.level = 2;
      const upgDef = branch === UpgradeBranch.BRANCH_A
        ? def.branchA[0]
        : (branch === UpgradeBranch.BRANCH_B ? def.branchB[0] : (def.branchC ? def.branchC[0] : def.branchA[0]));
      tower.totalCostInvested += upgDef.cost;
      audio.playUpgrade();

      // Transform the 3D visual mesh of the Evolution Tower to match the chosen path!
      this.morphEvolutionTower(tower, tower.evoPath);

      const forgeColor = tower.evoPath === 'SOLDIER' ? 0x3b82f6 : (tower.evoPath === 'ARCHER' ? 0x10b981 : 0xa855f7);
      const forgeHex = tower.evoPath === 'SOLDIER' ? '#60a5fa' : (tower.evoPath === 'ARCHER' ? '#34d399' : '#c084fc');
      this.vfx.spawnAscensionPillar(tower.worldPos, forgeColor);
      this.vfx.spawnFloatingText(
        tower.worldPos.clone().add(new THREE.Vector3(0, 2.5, 0)),
        `FORGE CHOSEN: ${tower.evoPath}!`,
        forgeHex,
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
      const scale = 1.0 + (tower.branchLevel - 1) * 0.08;
      tower.rotatingRing.scale.set(scale, scale, scale);
      const mat = (tower.rotatingRing as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = Math.min(2.0, 0.6 + (tower.branchLevel - 1) * 0.15);
      }
    }

    this.recalculateAuras();
    if (this.selectedTower === tower) {
      this.showRange(tower);
    }

    audio.playUpgrade();
    this.vfx.spawnAscensionPillar(tower.worldPos, def.accentColor);
    this.vfx.spawnFloatingText(tower.worldPos.clone().add(new THREE.Vector3(0, 2.5, 0)), `UPGRADED: ${upgDef.name}`, '#facc15', 1.5);

    return { success: true, cost: upgDef.cost };
  }

  upgradeEvoAbility(towerId: number, abilityIndex: 1 | 2 | 3 | 4, playerGold: number): { success: boolean; cost: number; reason?: string } {
    const tower = this.towers.get(towerId);
    if (!tower) return { success: false, cost: 0, reason: 'Tower not found' };
    if (tower.type !== TowerType.EVOLUTION || !tower.evoPath) {
      return { success: false, cost: 0, reason: 'Must choose Soldier, Archer, or Mage path first!' };
    }

    let currentLvl = 0;
    if (abilityIndex === 1) currentLvl = tower.ability1Level;
    else if (abilityIndex === 2) currentLvl = tower.ability2Level;
    else if (abilityIndex === 3) currentLvl = tower.ability3Level;
    else currentLvl = tower.ability4Level;

    let abilityList: EvoAbilityTier[];
    if (tower.evoPath === 'SOLDIER') {
      if (abilityIndex === 1) abilityList = SOLDIER_ABILITIES.armorAura;
      else if (abilityIndex === 2) abilityList = SOLDIER_ABILITIES.crit;
      else if (abilityIndex === 3) abilityList = SOLDIER_ABILITIES.lifeRegen;
      else abilityList = SOLDIER_ABILITIES.thorns;
    } else if (tower.evoPath === 'ARCHER') {
      if (abilityIndex === 1) abilityList = ARCHER_ABILITIES.multishot;
      else if (abilityIndex === 2) abilityList = ARCHER_ABILITIES.damageAura;
      else if (abilityIndex === 3) abilityList = ARCHER_ABILITIES.armorShred;
      else abilityList = ARCHER_ABILITIES.rapidQuiver;
    } else {
      if (abilityIndex === 1) abilityList = MAGE_ABILITIES.manaGain;
      else if (abilityIndex === 2) abilityList = MAGE_ABILITIES.fireball;
      else if (abilityIndex === 3) abilityList = MAGE_ABILITIES.stun;
      else abilityList = MAGE_ABILITIES.burn;
    }

    if (currentLvl >= abilityList.length) {
      return { success: false, cost: 0, reason: `Ability already at maximum Tier ${abilityList.length}!` };
    }

    const tierDef = abilityList[currentLvl];

    if (!tierDef) {
      return { success: false, cost: 0, reason: 'Invalid ability tier' };
    }

    if (playerGold < tierDef.cost) {
      return { success: false, cost: 0, reason: `Need ${tierDef.cost}g to upgrade ${tierDef.name}.` };
    }

    if (abilityIndex === 1) {
      tower.ability1Level++;
    } else if (abilityIndex === 2) {
      tower.ability2Level++;
    } else if (abilityIndex === 3) {
      tower.ability3Level++;
    } else {
      tower.ability4Level++;
    }

    tower.totalCostInvested += tierDef.cost;
    audio.playUpgrade();
    const color = tower.evoPath === 'SOLDIER' ? 0x3b82f6 : (tower.evoPath === 'ARCHER' ? 0x10b981 : 0xa855f7);
    const colorHex = tower.evoPath === 'SOLDIER' ? '#60a5fa' : (tower.evoPath === 'ARCHER' ? '#34d399' : '#c084fc');
    this.vfx.spawnBurstParticles(tower.worldPos.clone().add(new THREE.Vector3(0, 1.5, 0)), color, 12);
    this.vfx.spawnFloatingText(
      tower.worldPos.clone().add(new THREE.Vector3(0, 2.5, 0)),
      `UPGRADED: ${tierDef.name}!`,
      colorHex,
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

  /**
   * Replaces the 3D model of an Evolution Tower when a path (SOLDIER, ARCHER, or MAGE) is chosen
   */
  private morphEvolutionTower(tower: TowerInstance, path: 'SOLDIER' | 'ARCHER' | 'MAGE') {
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

    const newMesh = this.createTowerMesh(TowerType.EVOLUTION, tower.worldPos, path);
    tower.mesh = newMesh;
    tower.floatingElement = undefined;
    tower.rotatingRing = undefined;

    newMesh.traverse(child => {
      if (child.name === 'floating') tower.floatingElement = child;
      if (child.name === 'rotating') tower.rotatingRing = child;
    });

    this.scene.add(newMesh);
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

    this.grids[tower.team].setTile(tower.gridCoord.x, tower.gridCoord.z, TileType.EMPTY);
    this.towers.delete(towerId);

    if (this.selectedTower?.id === towerId) {
      this.selectedTower = null;
      this.hideRange();
    }

    this.recalculateAuras();
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
        if (targetTower.id === auraTower.id || targetTower.team !== auraTower.team) continue;
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
        const slow = Math.round((curUpg?.slowPercent ?? def.slowPercent ?? 0.30) * 100);
        const dur = curUpg?.slowDuration ?? def.slowDuration ?? 2.8;
        const isAoE = tower.currentBranch === UpgradeBranch.BRANCH_B;
        effectStr = isAoE
          ? `Blizzard: -${slow}% AoE Movement Slow for ${dur.toFixed(1)}s (All units in range)`
          : `Chill: -${slow}% Movement Slow for ${dur.toFixed(1)}s`;
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
        if (tower.currentBranch === UpgradeBranch.BRANCH_B) {
          const interestPct = Math.round((curUpg?.roundInterestPercent ?? 0.10) * 100);
          const minGold = curUpg?.roundFlatGold ?? 20;
          effectStr = `Vault Reserve: ${interestPct}% Round Interest (Min ${minGold}g) | No on-hit gold`;
          lifetimeStr = `Total Vault Interest: ${tower.totalBuffApplied}g`;
        } else {
          const g = curUpg?.goldPerHit ?? def.goldPerHit ?? 2;
          effectStr = `Income: +${g} Gold per hit`;
          lifetimeStr = `Total Gold Minted: ${tower.totalBuffApplied}g (${tower.totalHits} hits)`;
        }
        break;
      }
      case TowerType.EVOLUTION: {
        if (!tower.evoPath) {
          effectStr = 'Select Soldier, Archer, or Mage path to forge champions (Requires 250 HP base units).';
          lifetimeStr = 'Quota: 1 unit per wave | Individual building abilities';
        } else if (tower.evoPath === 'SOLDIER') {
          const quotaStr = tower.hasEvolvedThisWave
            ? '🔒 1/1 Evolved this wave'
            : '⚡ Ready to Evolve (Requires 250 HP)';
          effectStr = `Forges Soldier (1,250 HP cap, Melee). Status: ${quotaStr}`;
          lifetimeStr = `Aura Lv.${tower.ability1Level} | Crit Lv.${tower.ability2Level} | Regen Lv.${tower.ability3Level} | Thorns Lv.${tower.ability4Level} (${tower.totalHits} forged)`;
        } else if (tower.evoPath === 'ARCHER') {
          const quotaStr = tower.hasEvolvedThisWave
            ? '🔒 1/1 Evolved this wave'
            : '⚡ Ready to Evolve (Requires 250 HP)';
          effectStr = `Forges Archer (1,000 HP cap, Ranged). Status: ${quotaStr}`;
          lifetimeStr = `Multishot Lv.${tower.ability1Level} | Aura Lv.${tower.ability2Level} | Sunder Lv.${tower.ability3Level} | Flurry Lv.${tower.ability4Level} (${tower.totalHits} forged)`;
        } else {
          const quotaStr = tower.hasEvolvedThisWave
            ? '🔒 1/1 Evolved this wave'
            : '⚡ Ready to Evolve (Requires 250 HP)';
          effectStr = `Forges Mage (850 HP cap, Pyromancer). Status: ${quotaStr}`;
          lifetimeStr = `Siphon Lv.${tower.ability1Level} | Fireball Lv.${tower.ability2Level} | Stun Lv.${tower.ability3Level} | Burn Lv.${tower.ability4Level} (${tower.totalHits} forged)`;
        }
        break;
      }
    }

    return { currentEffect: effectStr, lifetimeOutput: lifetimeStr };
  }

  showRange(tower: TowerInstance) {
    if (!this.rangeIndicator || !this.rangeFillMesh || !this.rangeBorderMesh) return;
    const r = tower.effectiveRange;
    this.rangeIndicator.position.set(tower.worldPos.x, 0.20, tower.worldPos.z);

    // Update fill area scale
    this.rangeFillMesh.scale.setScalar(r);

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
  /** Idle tower animations only (used by multiplayer clients, which don't simulate tower effects). */
  updateVisuals(time: number) {
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
  }

  update(time: number, units: Unit[], addGoldCallback: (amount: number, tower: TowerInstance) => void) {
    this.updateVisuals(time);

    // Tower Actions / Buff Casts
    for (const tower of this.towers.values()) {
      if (tower.type === TowerType.AURA) {
        // Aura tower pulses passively; recalculateAuras handles stats
        continue;
      }

      const elapsed = (time - tower.lastActionTime) / 1000;
      if (elapsed < tower.effectiveRate) continue;

      const def = TOWER_DEFINITIONS[tower.type];
      const curUpg = this.getCurrentUpgrade(tower);

      // Find eligible friendly units in range that are traversing the maze
      const targetsInRange = units.filter(u => {
        if (!u.isFriendly || u.team !== tower.team || u.isDead || u.inCombat) return false;
        const dist = tower.worldPos.distanceTo(u.worldPos);
        if (dist > tower.effectiveRange) return false;

        // Special Vitality Shrine logic:
        // Do not attack/heal units that are already at full HP!
        if (tower.type === TowerType.SHRINE && u.currentHp >= u.maxHp) {
          return false;
        }

        // Special Rulebreaker logic:
        // Do not attack a unit which already has more (or equal) HP than what this tower sets it to!
        if (tower.type === TowerType.RULEBREAKER) {
          const targetFixedHp = curUpg?.fixedHp ?? def.fixedHp ?? 15;
          if (u.currentHp >= targetFixedHp) {
            return false;
          }
        }

        // Special Evolution Spire logic:
        // 1. One evolution per wave strictly!
        // 2. Must have chosen a path (Soldier, Archer, or Mage)
        // 3. Unit must have reached max base HP (>= 250 HP)
        // 4. Unit must not already be an evolved champion
        if (tower.type === TowerType.EVOLUTION) {
          if (tower.hasEvolvedThisWave || !tower.evoPath) {
            return false;
          }
          if (u.currentHp < 250) {
            return false;
          }
          if (u.unitClass === FriendlyClass.SOLDIER || u.unitClass === FriendlyClass.ARCHER || u.unitClass === FriendlyClass.MAGE) {
            return false;
          }
        }

        // Special Gold Spire logic:
        // Branch B (Vault Reserve) produces no on-hit gold; it strictly earns interest at round end
        if (tower.type === TowerType.GOLD && tower.currentBranch === UpgradeBranch.BRANCH_B) {
          return false;
        }

        return true;
      });

      if (targetsInRange.length === 0) continue;

      // Select target: for Vitality Shrines, prioritize the most wounded unit
      if (tower.type === TowerType.SHRINE) {
        targetsInRange.sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp));
      } else if (this.smartFocusByTeam[tower.team] && (tower.type === TowerType.FORGE || tower.type === TowerType.OBELISK)) {
        // Smart Focus: prioritize evolved champions / higher tier units over normal recruits
        targetsInRange.sort((a, b) => {
          const rankA = (a.unitClass === FriendlyClass.SOLDIER || a.unitClass === FriendlyClass.ARCHER || a.unitClass === FriendlyClass.MAGE)
            ? 3 : (a.unitClass !== FriendlyClass.RECRUIT ? 2 : 1);
          const rankB = (b.unitClass === FriendlyClass.SOLDIER || b.unitClass === FriendlyClass.ARCHER || b.unitClass === FriendlyClass.MAGE)
            ? 3 : (b.unitClass !== FriendlyClass.RECRUIT ? 2 : 1);
          return rankB - rankA;
        });
      }

      const target = targetsInRange[0];
      const fireFrom = tower.worldPos.clone().add(new THREE.Vector3(0, 1.6, 0));
      const fireTo = target.worldPos.clone().add(new THREE.Vector3(0, 0.5, 0));

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
          const slowPct = curUpg?.slowPercent ?? def.slowPercent ?? 0.30;
          const duration = curUpg?.slowDuration ?? def.slowDuration ?? 2.8;

          if (tower.currentBranch === UpgradeBranch.BRANCH_B) {
            // Branch B: True AoE Blizzard Zone - pulses and chills ALL friendly units in range simultaneously!
            for (const u of targetsInRange) {
              u.applySlow(slowPct, duration);
              const uPos = u.worldPos.clone().add(new THREE.Vector3(0, 0.5, 0));
              this.vfx.spawnBurstParticles(uPos, 0xa5f3fc, 4);
            }
            tower.totalHits += targetsInRange.length;
            audio.playFrostSlow();
            this.vfx.spawnBurstParticles(fireFrom, 0x06b6d4, 16);
            this.vfx.spawnFloatingText(
              fireFrom.clone().add(new THREE.Vector3(0, 1.2, 0)),
              `❄️ BLIZZARD -${Math.round(slowPct * 100)}% (${targetsInRange.length} units)`,
              '#67e8f9',
              1.2
            );
          } else {
            // Branch A & Base: Focused single-target chill beam (caps at 80%)
            target.applySlow(slowPct, duration);
            tower.totalHits++;
            audio.playFrostSlow();
            this.vfx.spawnBeam(fireFrom, fireTo, 0x06b6d4);
            this.vfx.spawnFloatingText(fireTo, `FROST SLOW -${Math.round(slowPct * 100)}%`, '#67e8f9');
          }
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
          const goldGain = tower.currentBranch === UpgradeBranch.BRANCH_B
            ? 0
            : (curUpg?.goldPerHit ?? def.goldPerHit ?? 2);
          if (goldGain > 0) {
            addGoldCallback(goldGain, tower);
            tower.totalBuffApplied += goldGain;
            tower.totalHits++;
            audio.playGoldGain();
            this.vfx.spawnBeam(fireFrom, fireTo, 0xeab308);
            this.vfx.spawnFloatingText(fireTo, `+${goldGain} Gold`, '#facc15');
            fired = true;
          }
          break;
        }

        case TowerType.EVOLUTION: {
          if (tower.hasEvolvedThisWave || !tower.evoPath) break;
          if (target.currentHp < 250) break;
          if (target.unitClass === FriendlyClass.SOLDIER || target.unitClass === FriendlyClass.ARCHER || target.unitClass === FriendlyClass.MAGE) break;

          const newClass = tower.evoPath === 'SOLDIER'
            ? FriendlyClass.SOLDIER
            : (tower.evoPath === 'ARCHER' ? FriendlyClass.ARCHER : FriendlyClass.MAGE);

          target.morphClass(newClass);
          this.onChampionEvolved();

          // Apply abilities bought in THIS SPECIFIC evo tower
          if (tower.evoPath === 'SOLDIER') {
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
            if (tower.ability3Level > 0) {
              const tier = SOLDIER_ABILITIES.lifeRegen[tower.ability3Level - 1];
              target.lifeRegen = tier.bonus || 0;
              target.recordBuff(`Iron Vigor Lv.${tower.ability3Level} (+${tier.bonus} HP/s)`);
            }
            if (tower.ability4Level > 0) {
              const tier = SOLDIER_ABILITIES.thorns[tower.ability4Level - 1];
              target.thornsMultiplier = tier.multiplier || 0;
              target.flatDmgReduction = tier.secondaryBonus || 0;
              target.recordBuff(`Spiked Bulwark Lv.${tower.ability4Level} (${Math.round((tier.multiplier || 0) * 100)}% Thorns, -${tier.secondaryBonus} Dmg)`);
            }
          } else if (tower.evoPath === 'ARCHER') {
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
            if (tower.ability3Level > 0) {
              const tier = ARCHER_ABILITIES.armorShred[tower.ability3Level - 1];
              target.armorShredOnHit = tier.bonus || 0;
              target.armorShredDuration = tier.duration || 4.0;
              target.recordBuff(`Sundering Shot Lv.${tower.ability3Level} (-${tier.bonus} Enemy Armor)`);
            }
            if (tower.ability4Level > 0) {
              const tier = ARCHER_ABILITIES.rapidQuiver[tower.ability4Level - 1];
              target.attackSpeedBonus = tier.bonus || 0;
              target.recordBuff(`Rapid Quiver Lv.${tower.ability4Level} (+${Math.round((tier.bonus || 0) * 100)}% Atk Speed)`);
            }
          } else {
            // MAGE
            if (tower.ability1Level > 0) {
              const tier = MAGE_ABILITIES.manaGain[tower.ability1Level - 1];
              target.manaGainPerAttack = tier.bonus || 25;
              target.recordBuff(`Arcane Siphon Lv.${tower.ability1Level} (+${tier.bonus} Mana/Atk)`);
            }
            if (tower.ability2Level > 0) {
              const tier = MAGE_ABILITIES.fireball[tower.ability2Level - 1];
              target.fireballDamageMult = tier.multiplier || 2.2;
              target.fireballRadius = tier.bonus || 2.4;
              target.recordBuff(`Mega Fireball Lv.${tower.ability2Level} (${tier.multiplier}x Dmg, ${tier.bonus}m AoE)`);
            }
            if (tower.ability3Level > 0) {
              const tier = MAGE_ABILITIES.stun[tower.ability3Level - 1];
              target.stunChance = tier.chance || 0;
              target.stunDuration = tier.duration || 1.5;
              target.recordBuff(`Paralyzing Arc Lv.${tower.ability3Level} (${Math.round((tier.chance || 0) * 100)}% Stun @ ${tier.duration}s)`);
            }
            if (tower.ability4Level > 0) {
              const tier = MAGE_ABILITIES.burn[tower.ability4Level - 1];
              target.burnMultiplier = tier.multiplier || 0;
              target.burnDuration = tier.duration || 3.0;
              target.recordBuff(`Molten Pyre Lv.${tower.ability4Level} (${Math.round((tier.multiplier || 0) * 100)}% Burn DoT)`);
            }
          }

          tower.hasEvolvedThisWave = true;
          tower.totalHits++;
          audio.playEvolution();
          const evoColor = tower.evoPath === 'SOLDIER' ? 0x3b82f6 : (tower.evoPath === 'ARCHER' ? 0x10b981 : 0xa855f7);
          const pillarColor = tower.evoPath === 'SOLDIER' ? 0x2563eb : (tower.evoPath === 'ARCHER' ? 0x059669 : 0x7c3aed);
          const evoHex = tower.evoPath === 'SOLDIER' ? '#60a5fa' : (tower.evoPath === 'ARCHER' ? '#34d399' : '#c084fc');
          this.vfx.spawnBeam(fireFrom, fireTo, evoColor, 0.4);
          this.vfx.spawnAscensionPillar(target.worldPos, pillarColor);
          this.vfx.spawnFloatingText(
            fireTo,
            `⚡ FORGED ${target.stats.name.toUpperCase()}! (Max HP: ${target.maxHp})`,
            evoHex,
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
  private createTowerMesh(type: TowerType, pos: THREE.Vector3, evoPath?: 'SOLDIER' | 'ARCHER' | 'MAGE'): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Medieval stone base with decorative trim
    const baseGeom = new THREE.CylinderGeometry(0.85, 0.95, 0.35, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x5c4a3a, // Warm brown stone brick
      roughness: 0.85,
      metalness: 0.15
    });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 0.175;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Stone ring trim at top of base
    const trimRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.05, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x44362a, roughness: 0.8, metalness: 0.2 })
    );
    trimRing.position.y = 0.35;
    trimRing.rotation.x = Math.PI / 2;
    group.add(trimRing);

    // Four stone buttresses around base
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const buttress = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.3, 0.15),
        baseMat
      );
      buttress.position.set(Math.cos(angle) * 0.85, 0.18, Math.sin(angle) * 0.85);
      buttress.rotation.y = -angle;
      buttress.castShadow = true;
      group.add(buttress);
    }

    const def = TOWER_DEFINITIONS[type];

    switch (type) {
      case TowerType.SHRINE: {
        // Emerald crystal shrine with vine-wrapped pillar
        const pillarGeom = new THREE.CylinderGeometry(0.35, 0.5, 1.2, 6);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1a, roughness: 0.8 });
        const pillar = new THREE.Mesh(pillarGeom, pillarMat);
        pillar.position.y = 0.8;
        group.add(pillar);

        // Vine wraps on pillar
        for (let i = 0; i < 3; i++) {
          const vine = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.06, 0.06),
            new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 })
          );
          vine.position.set(0, 0.55 + i * 0.25, 0.32);
          vine.rotation.y = i * 0.8;
          group.add(vine);
        }

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

        // Secondary smaller crystal shard
        const shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.18, 0),
          crystalMat.clone()
        );
        shard.position.set(0.3, 1.3, 0.15);
        shard.rotation.z = 0.5;
        group.add(shard);
        break;
      }

      case TowerType.FORGE: {
        // Heavy iron anvil, bellows & glowing embers
        const anvilGeom = new THREE.BoxGeometry(0.7, 0.6, 0.7);
        const anvilMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
        const anvil = new THREE.Mesh(anvilGeom, anvilMat);
        anvil.position.y = 0.5;
        group.add(anvil);

        // Bellows on the side
        const bellows = new THREE.Mesh(
          new THREE.ConeGeometry(0.2, 0.4, 4),
          new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.6 })
        );
        bellows.position.set(-0.45, 0.45, 0);
        bellows.rotation.z = Math.PI / 3;
        group.add(bellows);

        // Glowing coals/embers at base of anvil
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + 0.3;
          const coal = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.08, 0),
            new THREE.MeshStandardMaterial({
              color: 0xff4500,
              emissive: 0xff2200,
              emissiveIntensity: 1.2
            })
          );
          coal.position.set(Math.cos(angle) * 0.42, 0.38, Math.sin(angle) * 0.42);
          group.add(coal);
        }

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
        // Tall fiery obelisk with rune carvings
        const obeliskGeom = new THREE.ConeGeometry(0.4, 1.6, 4);
        const obeliskMat = new THREE.MeshStandardMaterial({
          color: 0x7c2d12,
          emissive: 0xf97316,
          emissiveIntensity: 0.4
        });
        const obelisk = new THREE.Mesh(obeliskGeom, obeliskMat);
        obelisk.position.y = 1.0;
        group.add(obelisk);

        // Fire rune rings around the obelisk
        [0.6, 1.0, 1.3].forEach((yOff, idx) => {
          const runeRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.35 - idx * 0.08, 0.03, 4, 12),
            new THREE.MeshStandardMaterial({
              color: 0xf97316,
              emissive: 0xea580c,
              emissiveIntensity: 1.0
            })
          );
          runeRing.position.y = yOff;
          runeRing.rotation.x = Math.PI / 2;
          group.add(runeRing);
        });

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
        // Arcane spire with twin gyroscopic rings and orbiting motes
        const spireGeom = new THREE.CylinderGeometry(0.2, 0.42, 1.4, 8);
        const spireMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.4, metalness: 0.3 });
        const spire = new THREE.Mesh(spireGeom, spireMat);
        spire.position.y = 0.9;
        spire.castShadow = true;
        group.add(spire);

        // Gold collar bands on the spire
        [0.45, 1.1].forEach(yPos => {
          const collar = new THREE.Mesh(
            new THREE.TorusGeometry(0.32 - (yPos - 0.45) * 0.1, 0.03, 6, 16),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
          );
          collar.position.y = yPos;
          collar.rotation.x = Math.PI / 2;
          group.add(collar);
        });

        // Primary rotating arcane ring
        const ringGeom = new THREE.TorusGeometry(0.58, 0.06, 8, 24);
        ringGeom.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          emissive: 0xa855f7,
          emissiveIntensity: 0.9
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.name = 'rotating';
        ring.position.y = 1.4;
        group.add(ring);

        // Floating central arcane orb
        const orbGeom = new THREE.SphereGeometry(0.28, 12, 12);
        const orbMat = new THREE.MeshStandardMaterial({
          color: 0xf472b6,
          emissive: 0xec4899,
          emissiveIntensity: 0.95
        });
        const orb = new THREE.Mesh(orbGeom, orbMat);
        orb.name = 'floating';
        orb.position.y = 1.8;
        group.add(orb);

        // Orbiting arcane satellites (attached to group)
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2;
          const satellite = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.08),
            new THREE.MeshStandardMaterial({
              color: 0xe879f9,
              emissive: 0xd946ef,
              emissiveIntensity: 0.8
            })
          );
          satellite.position.set(Math.cos(angle) * 0.45, 1.6, Math.sin(angle) * 0.45);
          group.add(satellite);
        }
        break;
      }

      case TowerType.FROST: {
        // Glacial frost spire with jutting ice crystals and perimeter spikes
        const iceGeom = new THREE.ConeGeometry(0.42, 1.8, 6);
        const iceMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: 0x0891b2,
          emissiveIntensity: 0.55,
          roughness: 0.1,
          metalness: 0.1,
          transparent: true,
          opacity: 0.88
        });
        const ice = new THREE.Mesh(iceGeom, iceMat);
        ice.position.y = 1.05;
        ice.castShadow = true;
        group.add(ice);

        // 4 Glacial spikes bursting outward from the base
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.65, 4),
            iceMat
          );
          spike.position.set(Math.cos(angle) * 0.55, 0.45, Math.sin(angle) * 0.55);
          spike.rotation.z = Math.cos(angle) * -0.45;
          spike.rotation.x = Math.sin(angle) * 0.45;
          group.add(spike);
        }

        // Floating levitating ice prism
        const floatIceGeom = new THREE.OctahedronGeometry(0.32);
        const floatIceMat = new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x38bdf8,
          emissiveIntensity: 1.0,
          roughness: 0.05
        });
        const floatIce = new THREE.Mesh(floatIceGeom, floatIceMat);
        floatIce.name = 'floating';
        floatIce.position.y = 1.95;
        group.add(floatIce);
        break;
      }

      case TowerType.RULEBREAKER: {
        // Obsidian monolith with reality-distorting crimson tesseract
        const corePillar = new THREE.CylinderGeometry(0.28, 0.48, 1.25, 4);
        const coreMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3, metalness: 0.8 });
        const pillar = new THREE.Mesh(corePillar, coreMat);
        pillar.position.y = 0.8;
        pillar.castShadow = true;
        group.add(pillar);

        // Crimson runic vertical bands
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const rib = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.9, 0.04),
            new THREE.MeshStandardMaterial({
              color: 0xef4444,
              emissive: 0xdc2626,
              emissiveIntensity: 1.2
            })
          );
          rib.position.set(Math.cos(angle) * 0.32, 0.8, Math.sin(angle) * 0.32);
          group.add(rib);
        }

        // 4 floating obsidian shards that guard the core
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const shard = new THREE.Mesh(
            new THREE.ConeGeometry(0.08, 0.35, 4),
            coreMat
          );
          shard.position.set(Math.cos(angle) * 0.5, 1.5, Math.sin(angle) * 0.5);
          shard.rotation.z = Math.cos(angle) * -0.3;
          group.add(shard);
        }

        // Floating reality tesseract cube
        const cubeGeom = new THREE.BoxGeometry(0.48, 0.48, 0.48);
        const cubeMat = new THREE.MeshStandardMaterial({
          color: 0xe11d48,
          emissive: 0xbe123c,
          emissiveIntensity: 1.0,
          roughness: 0.2
        });
        const cube = new THREE.Mesh(cubeGeom, cubeMat);
        cube.name = 'floating';
        cube.position.y = 1.65;
        group.add(cube);
        break;
      }

      case TowerType.GOLD: {
        // Midas treasury pedestal with treasure pile and spinning gold medallion
        const pillarGeom = new THREE.CylinderGeometry(0.35, 0.48, 1.15, 8);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
        const pillar = new THREE.Mesh(pillarGeom, pillarMat);
        pillar.position.y = 0.75;
        group.add(pillar);

        // Gold coin pile around the base of the pillar
        const coinMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xeab308,
          emissiveIntensity: 0.5,
          metalness: 0.85,
          roughness: 0.2
        });
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const coinStack = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.18, 8),
            coinMat
          );
          coinStack.position.set(Math.cos(angle) * 0.48, 0.42, Math.sin(angle) * 0.48);
          group.add(coinStack);
        }

        // Sparkling ruby jewel on the pedestal
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.1),
          new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.7 })
        );
        gem.position.set(0.15, 1.35, 0.15);
        group.add(gem);

        // Giant floating gold coin with rim
        const coinGeom = new THREE.CylinderGeometry(0.48, 0.48, 0.1, 16);
        coinGeom.rotateZ(Math.PI / 2);
        const coin = new THREE.Mesh(coinGeom, coinMat);
        coin.name = 'floating';
        coin.position.y = 1.75;
        group.add(coin);
        break;
      }

      case TowerType.EVOLUTION: {
        if (evoPath === 'SOLDIER') {
          // --- SOLDIER FORGE (Knight's Armory & Bastion Gateway) ---
          // Royal blue steel archway
          const archGeom = new THREE.TorusGeometry(0.76, 0.16, 8, 20, Math.PI);
          const archMat = new THREE.MeshStandardMaterial({
            color: 0x1d4ed8,
            emissive: 0x2563eb,
            emissiveIntensity: 0.5,
            metalness: 0.7,
            roughness: 0.3
          });
          const arch = new THREE.Mesh(archGeom, archMat);
          arch.position.y = 0.85;
          group.add(arch);

          // Twin fortress stone columns
          [-0.75, 0.75].forEach(xOff => {
            const pillar = new THREE.Mesh(
              new THREE.BoxGeometry(0.38, 1.8, 0.38),
              new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.5 })
            );
            pillar.position.set(xOff, 0.9, 0);
            pillar.castShadow = true;
            group.add(pillar);

            // Mounted knight heraldic shield on pillar front
            const shield = new THREE.Mesh(
              new THREE.BoxGeometry(0.06, 0.55, 0.38),
              new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.6, roughness: 0.3 })
            );
            shield.position.set(xOff, 1.1, 0.22);
            group.add(shield);

            // Gold cross emblem on shield
            const crossV = new THREE.Mesh(
              new THREE.BoxGeometry(0.07, 0.42, 0.08),
              new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
            );
            crossV.position.set(xOff, 1.1, 0.23);
            group.add(crossV);

            const crossH = new THREE.Mesh(
              new THREE.BoxGeometry(0.07, 0.08, 0.26),
              new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
            );
            crossH.position.set(xOff, 1.15, 0.23);
            group.add(crossH);
          });

          // Giant crossed claymores / broadswords above the arch
          [-0.6, 0.6].forEach(angle => {
            const sword = new THREE.Mesh(
              new THREE.BoxGeometry(0.04, 1.0, 0.08),
              new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.15 })
            );
            sword.position.set(0, 1.7, 0);
            sword.rotation.z = angle;
            group.add(sword);

            // Sword crossguard
            const guard = new THREE.Mesh(
              new THREE.BoxGeometry(0.06, 0.06, 0.26),
              new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 })
            );
            guard.position.set(Math.sin(angle) * -0.3, 1.7 + Math.cos(angle) * -0.3, 0);
            guard.rotation.z = angle;
            group.add(guard);
          });

          // Rotating Azure Starburst Valor Halo
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.52, 0.05, 6, 16),
            new THREE.MeshStandardMaterial({
              color: 0x60a5fa,
              emissive: 0x3b82f6,
              emissiveIntensity: 0.8
            })
          );
          halo.name = 'rotating';
          halo.position.y = 1.45;
          halo.rotation.x = Math.PI / 4;
          group.add(halo);

          // Floating Golden Champion Crest
          const crest = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.38, 0),
            new THREE.MeshStandardMaterial({
              color: 0xfacc15,
              emissive: 0xeab308,
              emissiveIntensity: 1.0,
              metalness: 0.8,
              roughness: 0.2
            })
          );
          crest.name = 'floating';
          crest.position.y = 1.45;
          group.add(crest);

        } else if (evoPath === 'ARCHER') {
          // --- ARCHER FORGE (Ranger's Fletcher Grove) ---
          // Living elderwood gateway arch
          const archGeom = new THREE.TorusGeometry(0.76, 0.16, 8, 20, Math.PI);
          const archMat = new THREE.MeshStandardMaterial({
            color: 0x065f46,
            emissive: 0x047857,
            emissiveIntensity: 0.5,
            roughness: 0.6
          });
          const arch = new THREE.Mesh(archGeom, archMat);
          arch.position.y = 0.85;
          group.add(arch);

          // Twin dark oak totem pylons wrapped in leaves
          [-0.75, 0.75].forEach(xOff => {
            const pylon = new THREE.Mesh(
              new THREE.CylinderGeometry(0.2, 0.3, 1.8, 6),
              new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 })
            );
            pylon.position.set(xOff, 0.9, 0);
            pylon.castShadow = true;
            group.add(pylon);

            // Leaf vine wrapping on pylon
            for (let v = 0; v < 3; v++) {
              const vine = new THREE.Mesh(
                new THREE.BoxGeometry(0.48, 0.08, 0.08),
                new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 })
              );
              vine.position.set(xOff, 0.5 + v * 0.4, 0.2);
              vine.rotation.y = v * 0.7;
              group.add(vine);
            }

            // Target roundel mounted on pillar
            const target = new THREE.Mesh(
              new THREE.CylinderGeometry(0.24, 0.24, 0.05, 12),
              new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 })
            );
            target.position.set(xOff, 1.25, 0.24);
            target.rotation.x = Math.PI / 2;
            group.add(target);

            // Target bullseye dot
            const bullseye = new THREE.Mesh(
              new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12),
              new THREE.MeshStandardMaterial({ color: 0xef4444 })
            );
            bullseye.position.set(xOff, 1.25, 0.25);
            bullseye.rotation.x = Math.PI / 2;
            group.add(bullseye);
          });

          // Giant elven recurve bow mounted atop the arch
          const bow = new THREE.Mesh(
            new THREE.TorusGeometry(0.68, 0.04, 4, 16, Math.PI * 1.1),
            new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.4 })
          );
          bow.position.set(0, 1.75, 0);
          bow.rotation.z = Math.PI;
          group.add(bow);

          // Silver bowstring
          const string = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 1.1, 3),
            new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.8 })
          );
          string.position.set(0, 1.85, 0);
          string.rotation.z = Math.PI / 2;
          group.add(string);

          // Rotating Jade Wind Halo
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.48, 0.045, 6, 16),
            new THREE.MeshStandardMaterial({
              color: 0x6ee7b7,
              emissive: 0x10b981,
              emissiveIntensity: 0.85
            })
          );
          halo.name = 'rotating';
          halo.position.y = 1.45;
          halo.rotation.x = Math.PI / 4;
          group.add(halo);

          // Floating Radiant Emerald Wind Crystal
          const crystal = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.36),
            new THREE.MeshStandardMaterial({
              color: 0x10b981,
              emissive: 0x34d399,
              emissiveIntensity: 1.1,
              roughness: 0.1,
              metalness: 0.2
            })
          );
          crystal.name = 'floating';
          crystal.position.y = 1.45;
          group.add(crystal);

        } else if (evoPath === 'MAGE') {
          // --- MAGE SANCTUM (Pyromancer's Arcane Gateway) ---
          // Violet & fiery amber gateway arch
          const archGeom = new THREE.TorusGeometry(0.76, 0.16, 8, 20, Math.PI);
          const archMat = new THREE.MeshStandardMaterial({
            color: 0x6d28d9,
            emissive: 0x7c3aed,
            emissiveIntensity: 0.6,
            roughness: 0.4
          });
          const arch = new THREE.Mesh(archGeom, archMat);
          arch.position.y = 0.85;
          group.add(arch);

          // Twin obsidian wizard spire columns
          [-0.75, 0.75].forEach(xOff => {
            const pylon = new THREE.Mesh(
              new THREE.CylinderGeometry(0.2, 0.32, 1.8, 6),
              new THREE.MeshStandardMaterial({ color: 0x1e1b4b, metalness: 0.6, roughness: 0.4 })
            );
            pylon.position.set(xOff, 0.9, 0);
            pylon.castShadow = true;
            group.add(pylon);

            // Fiery brazier bowl atop each pylon
            const brazier = new THREE.Mesh(
              new THREE.CylinderGeometry(0.24, 0.12, 0.18, 8),
              new THREE.MeshStandardMaterial({ color: 0x451a03, metalness: 0.8 })
            );
            brazier.position.set(xOff, 1.85, 0);
            group.add(brazier);

            // Flaming coal inside brazier
            const flame = new THREE.Mesh(
              new THREE.SphereGeometry(0.1, 6, 6),
              new THREE.MeshStandardMaterial({
                color: 0xff4500,
                emissive: 0xff2200,
                emissiveIntensity: 1.5
              })
            );
            flame.position.set(xOff, 1.96, 0);
            group.add(flame);
          });

          // Floating Pyromancer Grimoire / Spellbook above the arch
          const grimoire = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.08, 0.22),
            new THREE.MeshStandardMaterial({
              color: 0x7c2d12,
              emissive: 0xd97706,
              emissiveIntensity: 0.4
            })
          );
          grimoire.position.set(0, 1.75, 0);
          grimoire.rotation.x = 0.3;
          group.add(grimoire);

          // Rotating Incandescent Solar / Firestorm Halo
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.52, 0.045, 6, 16),
            new THREE.MeshStandardMaterial({
              color: 0xfbbf24,
              emissive: 0xf59e0b,
              emissiveIntensity: 1.2
            })
          );
          halo.name = 'rotating';
          halo.position.y = 1.45;
          halo.rotation.x = Math.PI / 4;
          group.add(halo);

          // Giant Floating Blazing Fireball Core
          const fireball = new THREE.Mesh(
            new THREE.SphereGeometry(0.38, 10, 8),
            new THREE.MeshStandardMaterial({
              color: 0xff4500,
              emissive: 0xff2200,
              emissiveIntensity: 1.8,
              roughness: 0.1
            })
          );
          fireball.name = 'floating';
          fireball.position.y = 1.45;
          group.add(fireball);

        } else {
          // --- UNCHOSEN EVOLUTION SPIRE (Base Celestial Gateway) ---
          const archGeom = new THREE.TorusGeometry(0.72, 0.14, 8, 20, Math.PI);
          const archMat = new THREE.MeshStandardMaterial({
            color: 0x4c1d95,
            emissive: 0x6d28d9,
            emissiveIntensity: 0.5,
            roughness: 0.3
          });
          const arch = new THREE.Mesh(archGeom, archMat);
          arch.position.y = 0.85;
          group.add(arch);

          // Twin flanking crystal spires
          [-0.72, 0.72].forEach(xOff => {
            const spireMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.12, 0.18, 1.5, 6),
              new THREE.MeshStandardMaterial({ color: 0x312e81, metalness: 0.4, roughness: 0.5 })
            );
            spireMesh.position.set(xOff, 0.75, 0);
            group.add(spireMesh);

            const tipCrystal = new THREE.Mesh(
              new THREE.ConeGeometry(0.12, 0.35, 6),
              new THREE.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x6366f1, emissiveIntensity: 0.8 })
            );
            tipCrystal.position.set(xOff, 1.6, 0);
            group.add(tipCrystal);
          });

          // Rotating gyroscopic celestial halo
          const haloGeom = new THREE.TorusGeometry(0.45, 0.04, 6, 16);
          const haloMat = new THREE.MeshStandardMaterial({
            color: 0xa78bfa,
            emissive: 0x8b5cf6,
            emissiveIntensity: 0.9
          });
          const halo = new THREE.Mesh(haloGeom, haloMat);
          halo.name = 'rotating';
          halo.position.y = 1.45;
          halo.rotation.x = Math.PI / 4;
          group.add(halo);

          // Floating celestial core
          const coreGeom = new THREE.DodecahedronGeometry(0.36, 0);
          const coreMat = new THREE.MeshStandardMaterial({
            color: 0xc4b5fd,
            emissive: 0x8b5cf6,
            emissiveIntensity: 0.95
          });
          const core = new THREE.Mesh(coreGeom, coreMat);
          core.name = 'floating';
          core.position.y = 1.45;
          group.add(core);
        }
        break;
      }
    }

    return group;
  }
}

