import * as THREE from 'three';
import {
  FriendlyClass,
  EnemyClass,
  UnitStats,
  FRIENDLY_UNIT_STATS,
  UnitTier,
  calculateDamage,
  getUnitStats,
  getEnemyWaveScaling,
  getKillBounty
} from './UnitData';
import { buildUnitMesh, getUnitMeshHeight } from './UnitMeshFactory';
import { VFXManager } from '../vfx/VFXManager';
import { audio } from '../engine/AudioSystem';
import { ArenaCastle } from '../engine/ArenaCastle';
import { TeamId, opponentOf, sideX, forwardDir, forwardYaw, mirrorX } from '../game/Teams';

/** Called when a unit that pays a bounty dies (enemies; in PvP any unit). */
export type KillCallback = (bounty: number, killed: Unit) => void;

export const ARENA_BOUNDS = {
  minX: 1.2,
  maxX: mirrorX(1.2),
  minZ: -8.4,
  maxZ: 8.4
};

export class Unit {
  public id: number;
  public isFriendly: boolean;
  /** Which side the unit fights for. Solo/co-op: the maze army is SUN, wave enemies are MOON. */
  public team: TeamId;
  public unitClass: FriendlyClass | EnemyClass;
  public stats: UnitStats;

  public currentHp: number;
  public maxHp: number;
  public armor: number;
  public attack: number;
  public attackRate: number;
  public moveSpeed: number;

  // Slow / Pacing effect from Frost Tower
  public slowFactor: number = 0; // 0 to 0.7
  public slowTimer: number = 0; // remaining seconds

  // Slow Stacking Buffs (applied at end of round)
  public stackingLifebloom: number = 0;
  public stackingArmor: number = 0;
  public stackingAttack: number = 0;

  public buffHistory: string[] = [];

  // Navigation
  public waypoints: THREE.Vector3[] = [];
  public currentWaypointIdx: number = 0;
  public hasCompletedMaze: boolean = false;
  public stagingPos: THREE.Vector3 | null = null;
  public inCombat: boolean = false;
  public isWaitingInArena: boolean = false;
  public isDead: boolean = false;
  public lateralLaneOffset: number = 0;

  // Multiplayer client mirroring: latest authoritative transform from the host
  public netTargetPos: THREE.Vector3 | null = null;
  public netTargetYaw: number = 0;
  /** Whether the unit walked this frame; units holding position aren't shoved by walkers. */
  public movedThisFrame: boolean = false;

  // Evolution Champion Abilities (Soldier, Archer, Mage)
  public armorAuraBonus: number = 0;
  public rampPerHit: number = 0; // Soldier Ability 2: bonus damage gained per consecutive hit on the same target
  public rampStacks: number = 0;
  public rampTargetId: number = -1;
  public lifeRegen: number = 0; // Soldier Ability 3: HP recovered per second in combat
  public thornsMultiplier: number = 0; // Soldier Ability 4: Reflect % of incoming melee dmg
  public flatDmgReduction: number = 0; // Soldier Ability 4: Flat damage reduction per incoming hit
  public lastLifeRegenTick: number = 0;

  public multishotChance: number = 0;
  public multishotTargets: number = 1;
  public damageAuraBonus: number = 0;
  public armorShredOnHit: number = 0; // Archer Ability 3: Shreds enemy armor for 4s
  public armorShredDuration: number = 4.0;
  public attackSpeedBonus: number = 0; // Archer Ability 4: Rapid Quiver attack speed multiplier

  // Mage Mana & Mega Fireball abilities
  public mana: number = 0;
  public maxMana: number = 100;
  public manaGainPerAttack: number = 0;
  public fireballRadius: number = 2.4;
  public fireballDamageMult: number = 2.2;
  public stunChance: number = 0; // Mage Ability 3: Paralyzing Arc stun chance
  public stunDuration: number = 0; // Mage Ability 3: Stun duration in seconds
  public burnMultiplier: number = 0; // Mage Ability 4: Molten Pyre DoT multiplier
  public burnDuration: number = 3.0;

  // Active Combat Status Debuffs (can affect any unit in combat)
  public stunTimer: number = 0;
  public armorDebuff: number = 0;
  public armorDebuffTimer: number = 0;
  public burnTimer: number = 0;
  public burnDmgPerSec: number = 0;
  public lastBurnTick: number = 0;

  // Active Combat Aura Buffs (received from nearby champions)
  public combatAuraArmor: number = 0;
  public combatAuraAttack: number = 0;

  // Combat targeting
  public target: Unit | null = null;
  public lastAttackTime: number = 0;

  // Combat Animation Timers
  public lungeTimer: number = 0; // 0 to 0.16s: forward thrust on attack
  public hitFlinchTimer: number = 0; // 0 to 0.14s: tilt/recoil backwards when damaged
  public isDying: boolean = false;
  public deathTimer: number = 0;

  // Boss Attributes (Lord Ignis)
  public isBoss: boolean = false;
  public bossStompCooldown: number = 5.0; // Initial stomp cooldown
  public magmaShieldActive: boolean = false;

  // 3D Visuals
  public mesh: THREE.Group;
  public hpBarGroup: THREE.Group;
  public hpBarMesh: THREE.Mesh;
  public hpBarGlossMesh?: THREE.Mesh;
  public hpBarBgMesh: THREE.Mesh;
  public hpBarBorderMesh?: THREE.Mesh;
  public manaBarMesh?: THREE.Mesh;
  public manaBarGlossMesh?: THREE.Mesh;
  public manaBarBgMesh?: THREE.Mesh;
  public bodyMesh: THREE.Mesh;
  public fillWidth: number = 1.28;

  constructor(
    id: number,
    isFriendly: boolean,
    unitClass: FriendlyClass | EnemyClass,
    startPos: THREE.Vector3,
    waypoints: THREE.Vector3[] = [],
    team?: TeamId
  ) {
    this.id = id;
    this.isFriendly = isFriendly;
    this.team = team ?? (isFriendly ? 'SUN' : 'MOON');
    this.unitClass = unitClass;
    this.stats = getUnitStats(unitClass);

    if (!isFriendly && unitClass === EnemyClass.BOSS_LORD_IGNIS) {
      this.isBoss = true;
    }

    this.maxHp = this.stats.hp;
    // Core Forgebound TD mechanic: friendly units spawn severely injured (1 HP) and need tower blessings!
    this.currentHp = isFriendly ? 1 : this.stats.hp;
    this.armor = this.stats.armor;
    this.attack = this.stats.attack;
    this.attackRate = this.stats.attackRate;
    this.moveSpeed = this.stats.moveSpeed;

    // Lateral offset across the maze lane so units don't walk in a single-file line
    this.lateralLaneOffset = isFriendly ? ((id % 5) - 2) * 0.25 : ((id % 3) - 1) * 0.3;

    this.waypoints = waypoints;
    this.currentWaypointIdx = 0;

    // 3D Object Group
    this.mesh = new THREE.Group();
    this.mesh.position.copy(startPos);
    if (isFriendly) {
      this.mesh.position.z += this.lateralLaneOffset;
    }

    // Body Mesh Group (multi-part composite from factory)
    const bodyGroup = buildUnitMesh(unitClass, isFriendly, this.stats.scale);
    this.bodyMesh = bodyGroup as unknown as THREE.Mesh; // bodyMesh is now a Group but typed as Mesh for backward compat
    this.mesh.add(bodyGroup);

    // Health Bar Container Group (billboards towards camera)
    const hpBarY = getUnitMeshHeight(unitClass, isFriendly, this.stats.scale) + 0.18;
    this.hpBarGroup = new THREE.Group();
    this.hpBarGroup.position.set(0, hpBarY, 0);
    this.mesh.add(this.hpBarGroup);

    const isChampion = isFriendly && (
      unitClass === FriendlyClass.SOLDIER ||
      unitClass === FriendlyClass.PALADIN ||
      unitClass === FriendlyClass.ARCHMAGE ||
      unitClass === FriendlyClass.ARCHER ||
      unitClass === FriendlyClass.MAGE
    );
    const width = this.isBoss ? 2.1 : (isChampion ? 1.45 : 1.35);
    const height = this.isBoss ? 0.22 : 0.16;
    this.fillWidth = width - 0.08;
    const fillHeight = height - 0.05;

    // 1. Drop Shadow Background (deep slate shadow)
    const shadowGeom = new THREE.PlaneGeometry(width + 0.1, height + 0.06);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.position.z = -0.003;
    this.hpBarGroup.add(shadowMesh);

    // 2. Metallic Beveled Border (golden bronze for champions/bosses, forged iron/steel for others)
    const borderColor = this.isBoss ? 0xd97706 : (isChampion ? 0xb45309 : (isFriendly ? 0x475569 : 0x3f3f46));
    const borderGeom = new THREE.PlaneGeometry(width + 0.04, height + 0.03);
    const borderMat = new THREE.MeshBasicMaterial({ color: borderColor, side: THREE.DoubleSide });
    this.hpBarBorderMesh = new THREE.Mesh(borderGeom, borderMat);
    this.hpBarBorderMesh.position.z = -0.001;
    this.hpBarGroup.add(this.hpBarBorderMesh);

    // 3. Dark Recessed Trough (Background where depleted HP shows)
    const barBgGeom = new THREE.PlaneGeometry(width, height);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x141416, side: THREE.DoubleSide });
    this.hpBarBgMesh = new THREE.Mesh(barBgGeom, barBgMat);
    this.hpBarGroup.add(this.hpBarBgMesh);

    // 4. Vibrant Health Fill
    const barGeom = new THREE.PlaneGeometry(this.fillWidth, fillHeight);
    const fillColor = isFriendly ? 0x10b981 : (this.isBoss ? 0xdc2626 : 0xe11d48);
    const barMat = new THREE.MeshBasicMaterial({ color: fillColor, side: THREE.DoubleSide });
    this.hpBarMesh = new THREE.Mesh(barGeom, barMat);
    this.hpBarMesh.position.z = 0.002;
    this.hpBarGroup.add(this.hpBarMesh);

    // 5. Glassy Top Sheen / Gloss Strip (gives polished AAA game look)
    const glossGeom = new THREE.PlaneGeometry(this.fillWidth, fillHeight * 0.44);
    const glossMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide
    });
    this.hpBarGlossMesh = new THREE.Mesh(glossGeom, glossMat);
    this.hpBarGlossMesh.position.set(0, fillHeight * 0.26, 0.004);
    this.hpBarGroup.add(this.hpBarGlossMesh);

    // 6. Tactical Pip Divider Ticks (splits health into 4 readable quadrants)
    [-0.25, 0, 0.25].forEach(pct => {
      const tickGeom = new THREE.PlaneGeometry(0.02, fillHeight);
      const tickMat = new THREE.MeshBasicMaterial({ color: 0x09090b, side: THREE.DoubleSide });
      const tickMesh = new THREE.Mesh(tickGeom, tickMat);
      tickMesh.position.set(this.fillWidth * pct, 0, 0.005);
      this.hpBarGroup.add(tickMesh);
    });

    // 7. Shield Badge for Armored Units
    if (this.armor > 0) {
      const shieldBadge = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.065),
        new THREE.MeshStandardMaterial({
          color: isFriendly ? 0xfacc15 : 0x94a3b8,
          metalness: 0.8,
          roughness: 0.2
        })
      );
      shieldBadge.position.set(-width * 0.54, 0, 0.01);
      shieldBadge.rotation.z = Math.PI / 4;
      this.hpBarGroup.add(shieldBadge);
    }

    if (unitClass === FriendlyClass.MAGE) {
      this.manaGainPerAttack = 25;
      this.initManaBar(hpBarY);
    }
  }

  initManaBar(_hpBarY: number) {
    if (this.manaBarMesh) {
      return;
    }
    const width = this.fillWidth * 0.96;
    const height = 0.055;
    const yOff = -(0.16 * 0.5 + 0.065);

    // Mana Gutter
    const manaBgGeom = new THREE.PlaneGeometry(width + 0.04, height + 0.02);
    const manaBgMat = new THREE.MeshBasicMaterial({ color: 0x020617, side: THREE.DoubleSide });
    this.manaBarBgMesh = new THREE.Mesh(manaBgGeom, manaBgMat);
    this.manaBarBgMesh.position.set(0, yOff, 0.001);
    this.hpBarGroup.add(this.manaBarBgMesh);

    // Mana Fill
    const manaGeom = new THREE.PlaneGeometry(width, height);
    const manaMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide });
    this.manaBarMesh = new THREE.Mesh(manaGeom, manaMat);
    this.manaBarMesh.position.set(0, yOff, 0.003);
    this.hpBarGroup.add(this.manaBarMesh);

    // Mana Gloss
    const manaGlossGeom = new THREE.PlaneGeometry(width, height * 0.45);
    const manaGlossMat = new THREE.MeshBasicMaterial({
      color: 0xe9d5ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.manaBarGlossMesh = new THREE.Mesh(manaGlossGeom, manaGlossMat);
    this.manaBarGlossMesh.position.set(0, yOff + height * 0.25, 0.004);
    this.hpBarGroup.add(this.manaBarGlossMesh);
  }

  get worldPos(): THREE.Vector3 {
    return this.mesh.position;
  }

  applySlow(percent: number, duration: number) {
    this.slowFactor = Math.min(0.80, Math.max(this.slowFactor, percent));
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  recordBuff(name: string) {
    if (!this.buffHistory.includes(name)) {
      this.buffHistory.push(name);
    }
  }

  checkAndEvolve(allowTier3: boolean): boolean {
    if (!this.isFriendly) return false;

    // Check Evolution eligibility based on current stats
    if (this.unitClass === FriendlyClass.RECRUIT && this.attack >= 30) {
      this.morphClass(FriendlyClass.FOOTMAN);
      return true;
    }
    if (this.unitClass === FriendlyClass.FOOTMAN && this.armor >= 25) {
      this.morphClass(FriendlyClass.KNIGHT);
      return true;
    }
    if (this.unitClass === FriendlyClass.FOOTMAN && this.attack >= 60) {
      this.morphClass(FriendlyClass.BERSERKER);
      return true;
    }

    if (allowTier3) {
      if (this.unitClass === FriendlyClass.KNIGHT && this.maxHp >= 600) {
        this.morphClass(FriendlyClass.PALADIN);
        return true;
      }
      if (this.unitClass === FriendlyClass.BERSERKER && this.attack >= 100) {
        this.morphClass(FriendlyClass.ARCHMAGE);
        return true;
      }
      if (this.unitClass === FriendlyClass.CLERIC && this.maxHp >= 800) {
        this.morphClass(FriendlyClass.PYRO_GOLEM);
        return true;
      }
    }

    return false;
  }

  morphClass(newClass: FriendlyClass) {
    const prevMax = this.stats.hp;
    this.unitClass = newClass;
    const newStats = FRIENDLY_UNIT_STATS[newClass];
    this.stats = newStats;

    // Increase max HP ceiling without full healing: heal towers have to fill the rest
    const hpCeilingBonus = Math.max(0, newStats.hp - prevMax);
    this.maxHp += hpCeilingBonus;
    this.currentHp = Math.min(this.maxHp, this.currentHp + Math.round(hpCeilingBonus * 0.08));

    this.armor = Math.max(this.armor, newStats.armor);
    this.attack = Math.max(this.attack, newStats.attack);
    this.attackRate = newStats.attackRate;
    this.moveSpeed = newStats.moveSpeed;

    // Update body mesh visually — dispose old body group and build new one from factory
    this.mesh.remove(this.bodyMesh);
    (this.bodyMesh as unknown as THREE.Group).traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });

    const newBody = buildUnitMesh(newClass, true, newStats.scale);
    this.bodyMesh = newBody as unknown as THREE.Mesh;
    this.mesh.add(newBody);

    const hpBarY = getUnitMeshHeight(newClass, true, newStats.scale) + 0.18;
    this.hpBarGroup.position.y = hpBarY;

    if (newClass === FriendlyClass.MAGE) {
      this.mana = 0;
      this.maxMana = 100;
      this.manaGainPerAttack = 25;
      this.fireballRadius = 2.4;
      this.fireballDamageMult = 2.2;
      this.initManaBar(hpBarY);
    }
  }

  updateHpBar(camera: THREE.Camera) {
    const hpRatio = Math.max(0, Math.min(1, this.currentHp / this.maxHp));
    this.hpBarMesh.scale.x = hpRatio;
    this.hpBarMesh.position.x = -(1 - hpRatio) * (this.fillWidth * 0.5);

    if (this.hpBarGlossMesh) {
      this.hpBarGlossMesh.scale.x = hpRatio;
      this.hpBarGlossMesh.position.x = -(1 - hpRatio) * (this.fillWidth * 0.5);
    }

    // Dynamic warning color for critical health
    if (this.isFriendly) {
      const mat = this.hpBarMesh.material as THREE.MeshBasicMaterial;
      if (hpRatio < 0.25) {
        mat.color.setHex(0xef4444); // Urgent red
      } else if (hpRatio < 0.5) {
        mat.color.setHex(0xf59e0b); // Warning amber
      } else {
        mat.color.setHex(0x10b981); // Emerald green
      }
    }

    if (this.manaBarMesh && this.manaBarBgMesh) {
      const manaRatio = Math.max(0, Math.min(1, this.mana / this.maxMana));
      const manaFillW = this.fillWidth * 0.96;
      this.manaBarMesh.scale.x = manaRatio;
      this.manaBarMesh.position.x = -(1 - manaRatio) * (manaFillW * 0.5);
      if (this.manaBarGlossMesh) {
        this.manaBarGlossMesh.scale.x = manaRatio;
        this.manaBarGlossMesh.position.x = -(1 - manaRatio) * (manaFillW * 0.5);
      }
    }

    // Billboard towards camera
    this.hpBarGroup.quaternion.copy(camera.quaternion);
  }

  applyEndOfWeekBuffs(): string[] {
    const applied: string[] = [];
    if (this.stackingLifebloom > 0) {
      this.maxHp += this.stackingLifebloom;
      this.currentHp = Math.min(this.maxHp, this.currentHp + this.stackingLifebloom);
      applied.push(`+${this.stackingLifebloom} Max HP (Lifebloom)`);
    }
    if (this.stackingArmor > 0) {
      this.armor += this.stackingArmor;
      applied.push(`+${this.stackingArmor} Armor (Tempered)`);
    }
    if (this.stackingAttack > 0) {
      this.attack += this.stackingAttack;
      applied.push(`+${this.stackingAttack} Attack (Frenzy)`);
    }
    return applied;
  }
}

export class UnitManager {
  public units: Unit[] = [];
  public nextId: number = 1;
  public scene: THREE.Scene;
  public vfx: VFXManager;
  public camera: THREE.Camera;

  public selectedUnit: Unit | null = null;
  /** Each team's focus-fire target (an enemy of that team). */
  public focusTargets: Record<TeamId, Unit | null> = { SUN: null, MOON: null };
  /** PvP: both armies are recruit-type units; every kill pays a bounty and units wear team rings. */
  public pvpMode: boolean = false;
  /** Arena escalation: multiplies all unit-vs-unit damage when a clash drags on. */
  public damageMultiplier: number = 1;

  private castles: Record<TeamId, ArenaCastle | null> = { SUN: null, MOON: null };
  private onCastleDestroyed: Record<TeamId, (() => void) | null> = { SUN: null, MOON: null };

  public setCastle(team: TeamId, castle: ArenaCastle | null, onDestroyed?: () => void) {
    this.castles[team] = castle;
    if (onDestroyed) this.onCastleDestroyed[team] = onDestroyed;
  }

  public setFocusTarget(target: Unit | null, team: TeamId = 'SUN') {
    this.focusTargets[team] = target;
  }

  /** Where a team's army materializes in the arena after clearing its maze. */
  public arrivalPos(team: TeamId): THREE.Vector3 {
    return new THREE.Vector3(sideX(team, 2), 0.4, 0);
  }

  /** Ground ring in the team colour so the two PvP armies are easy to tell apart. */
  private addTeamMarker(unit: Unit) {
    const r = Math.max(0.35, unit.stats.scale * 0.5);
    const geom = new THREE.RingGeometry(r, r + 0.12, 24);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: unit.team === 'SUN' ? 0xfacc15 : 0xef4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geom, mat);
    ring.position.y = -0.34;
    unit.mesh.add(ring);
  }

  constructor(scene: THREE.Scene, vfx: VFXManager, camera: THREE.Camera) {
    this.scene = scene;
    this.vfx = vfx;
    this.camera = camera;
  }

  spawnFriendly(unitClass: FriendlyClass, startPos: THREE.Vector3, waypoints: THREE.Vector3[], team: TeamId = 'SUN'): Unit {
    const unit = new Unit(this.nextId++, true, unitClass, startPos, waypoints, team);
    if (this.pvpMode) this.addTeamMarker(unit);
    this.scene.add(unit.mesh);
    this.units.push(unit);
    return unit;
  }

  spawnEnemy(enemyClass: EnemyClass, startPos: THREE.Vector3, isWaiting: boolean = true, waveIndex: number = 0): Unit {
    const unit = new Unit(this.nextId++, false, enemyClass, startPos);
    unit.isWaitingInArena = isWaiting;
    unit.inCombat = !isWaiting; // If waiting, inCombat is false until gates open
    unit.mesh.rotation.y = Math.PI / 2; // Face towards the friendly arrival side

    // Escalating wave power: from wave 8 on, enemies scale up HP, Armor, and Attack
    const { hpMult, armorBonus, atkMult } = getEnemyWaveScaling(waveIndex);
    unit.maxHp = Math.round(unit.maxHp * hpMult);
    unit.currentHp = unit.maxHp;
    unit.armor += armorBonus;
    unit.attack = Math.round(unit.attack * atkMult);

    this.scene.add(unit.mesh);
    this.units.push(unit);
    return unit;
  }

  /** Multiplayer client: creates a mirror of a host-simulated unit. */
  spawnNetworkUnit(id: number, isFriendly: boolean, unitClass: FriendlyClass | EnemyClass, startPos: THREE.Vector3, team: TeamId): Unit {
    const unit = new Unit(id, isFriendly, unitClass, startPos, [], team);
    unit.mesh.position.copy(startPos);
    if (this.pvpMode) this.addTeamMarker(unit);
    this.scene.add(unit.mesh);
    this.units.push(unit);
    return unit;
  }

  /** Can this unit currently be engaged in the arena? Excludes units still in the maze or waiting behind the gates. */
  private isEngageable(u: Unit): boolean {
    if (u.isDead || u.isDying || u.isWaitingInArena) return false;
    return !u.isFriendly || u.inCombat || u.hasCompletedMaze;
  }

  /** Death shrink animation. Returns true once the unit should be removed. */
  private animateDeath(unit: Unit, dt: number): boolean {
    unit.deathTimer -= dt;
    const progress = Math.max(0, unit.deathTimer / 0.45);
    const s = unit.stats.scale * Math.max(0.01, progress);
    unit.mesh.scale.set(s, s, s);
    unit.mesh.position.y -= dt * 0.5;
    return unit.deathTimer <= 0;
  }

  /** Attack lunge & hit flinch animations. */
  private animateCombatTimers(unit: Unit, dt: number) {
    if (unit.lungeTimer > 0) {
      unit.lungeTimer -= dt;
      const lungeProgress = 1 - Math.max(0, unit.lungeTimer / 0.16);
      unit.bodyMesh.position.z = Math.sin(lungeProgress * Math.PI) * 0.3 * unit.stats.scale;
    } else if (unit.hitFlinchTimer <= 0) {
      unit.bodyMesh.position.z = 0;
    }

    if (unit.hitFlinchTimer > 0) {
      unit.hitFlinchTimer -= dt;
      const flinchProgress = 1 - Math.max(0, unit.hitFlinchTimer / 0.14);
      unit.bodyMesh.rotation.x = -Math.sin(flinchProgress * Math.PI) * 0.35;
      unit.bodyMesh.position.z = -Math.sin(flinchProgress * Math.PI) * 0.18 * unit.stats.scale;
    } else if (unit.lungeTimer <= 0) {
      unit.bodyMesh.rotation.x = 0;
    }
  }

  /** Ambient accessory animation (floating cores, rotating halos/gems). */
  private animateAccessories(unit: Unit, dt: number, time: number) {
    unit.bodyMesh.traverse(child => {
      if (child.name === 'rotating') {
        child.rotation.y += dt * 1.8;
        child.rotation.z += dt * 0.9;
      } else if (child.name === 'floating') {
        if (child.userData.baseY === undefined) child.userData.baseY = child.position.y;
        child.position.y = child.userData.baseY + Math.sin(time * 0.005 + unit.id) * 0.05 * unit.stats.scale;
      }
    });
  }

  /**
   * Multiplayer client update: units are simulated by the host, so only interpolate towards the
   * latest snapshot transform and play cosmetic animations.
   */
  updateRemote(dt: number, time: number) {
    const lerp = 1 - Math.exp(-dt * 12);

    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];

      if (unit.isDying) {
        if (this.animateDeath(unit, dt)) {
          unit.isDead = true;
          this.removeUnit(unit, i);
        }
        continue;
      }

      this.animateCombatTimers(unit, dt);

      let moving = false;
      if (unit.netTargetPos) {
        const dist = unit.worldPos.distanceTo(unit.netTargetPos);
        if (dist > 6) {
          unit.mesh.position.copy(unit.netTargetPos); // Teleports (maze exit warp)
        } else {
          unit.mesh.position.lerp(unit.netTargetPos, lerp);
        }
        moving = dist > 0.03;
      }

      let yawDiff = unit.netTargetYaw - unit.mesh.rotation.y;
      yawDiff = Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff));
      unit.mesh.rotation.set(0, unit.mesh.rotation.y + yawDiff * lerp, 0);

      if (unit.isWaitingInArena) {
        unit.bodyMesh.position.y = Math.sin(time * 0.003 + unit.id) * 0.04 * unit.stats.scale;
      } else if (moving) {
        unit.bodyMesh.position.y = Math.abs(Math.sin(time * 0.008 * unit.moveSpeed)) * 0.1 * unit.stats.scale;
      }

      this.animateAccessories(unit, dt, time);
      unit.updateHpBar(this.camera);
    }
  }

  update(dt: number, time: number, onKill: KillCallback) {
    // 1. Update Unit Buff Status & Navigation
    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];

      if (unit.isDying) {
        if (this.animateDeath(unit, dt)) {
          unit.isDead = true;
          this.removeUnit(unit, i);
        }
        continue;
      }

      if (unit.isDead) {
        this.removeUnit(unit, i);
        continue;
      }

      this.animateCombatTimers(unit, dt);

      const prevX = unit.mesh.position.x;
      const prevZ = unit.mesh.position.z;
      unit.movedThisFrame = false;

      // Decrement slow timer
      if (unit.slowTimer > 0) {
        unit.slowTimer -= dt;
        if (unit.slowTimer <= 0) {
          unit.slowFactor = 0;
        }
      }

      // Calculate effective movement speed
      const effectiveSpeed = unit.moveSpeed * (1 - unit.slowFactor);

      // Enemy waiting in formation in arena
      if (!unit.isFriendly && unit.isWaitingInArena) {
        // Idle breathing bob (applied to whole body group)
        unit.bodyMesh.position.y = Math.sin(time * 0.003 + unit.id) * 0.04 * unit.stats.scale;
        unit.updateHpBar(this.camera);
        continue;
      }

      // Unit in Maze Pathing
      if (unit.isFriendly && !unit.inCombat) {
        if (!unit.hasCompletedMaze) {
          if (unit.currentWaypointIdx < unit.waypoints.length) {
            const targetWp = unit.waypoints[unit.currentWaypointIdx].clone();
            targetWp.z += unit.lateralLaneOffset;

            const dir = new THREE.Vector3().subVectors(targetWp, unit.worldPos);
            const dist = dir.length();

            if (dist < 0.35) {
              unit.currentWaypointIdx++;
              if (unit.currentWaypointIdx >= unit.waypoints.length) {
                // Reached Teleportation Gate! Beam directly to Arena Arrival Pad!
                audio.playTeleport();
                this.vfx.spawnBurstParticles(unit.worldPos, 0x38bdf8, 14);

                // Teleport directly to the team's Arrival Pad on the Arena Island!
                const arrivalPadPos = this.arrivalPos(unit.team);
                unit.mesh.position.copy(arrivalPadPos);
                this.vfx.spawnAscensionPillar(arrivalPadPos, unit.team === 'SUN' ? 0x38bdf8 : 0xef4444);
                this.vfx.spawnFloatingText(arrivalPadPos, 'WARPED TO ARENA!', '#38bdf8', 1.4);

                unit.hasCompletedMaze = true;
              }
            } else {
              dir.normalize();
              // Never overshoot the waypoint: large steps (low FPS at 4x speed) would orbit it forever
              unit.mesh.position.addScaledVector(dir, Math.min(dist, effectiveSpeed * dt));
              unit.mesh.lookAt(targetWp.x, unit.worldPos.y, targetWp.z);
              // Bobbing animation (applied to whole body group)
              unit.bodyMesh.position.y = Math.abs(Math.sin(time * 0.008 * effectiveSpeed)) * 0.1 * unit.stats.scale;
            }
          }
        } else if (unit.stagingPos) {
          // Walk into orderly battalion formation at arena gate
          const dir = new THREE.Vector3().subVectors(unit.stagingPos, unit.worldPos);
          const dist = dir.length();
          if (dist > 0.15) {
            dir.normalize();
            unit.mesh.position.addScaledVector(dir, Math.min(dist, effectiveSpeed * dt));
            unit.mesh.lookAt(unit.stagingPos.x, unit.worldPos.y, unit.stagingPos.z);
          } else {
            // Face forward into the arena towards enemies
            unit.mesh.rotation.set(0, forwardYaw(unit.team), 0);
          }
        }
      }

      // Unit in Combat / Battlefield
      if (unit.inCombat) {
        this.handleCombatMovementAndAttack(unit, dt, time, onKill);
      }
      unit.movedThisFrame = Math.abs(unit.mesh.position.x - prevX) + Math.abs(unit.mesh.position.z - prevZ) > 1e-5;

      // Constrain units located in the arena to arena perimeter walls
      this.clampUnitToArena(unit);

      this.animateAccessories(unit, dt, time);

      // Update Health bar
      unit.updateHpBar(this.camera);
    }

    // 2. Calculate Champion Combat Auras (Soldier Armor Aura & Archer Damage Aura)
    for (const u of this.units) {
      u.combatAuraArmor = 0;
      u.combatAuraAttack = 0;
    }
    const combatFriendlies = this.units.filter(u => u.isFriendly && !u.isDead && u.inCombat);
    for (const champ of combatFriendlies) {
      if (champ.armorAuraBonus > 0) {
        for (const ally of combatFriendlies) {
          if (ally.team === champ.team && champ.worldPos.distanceTo(ally.worldPos) <= 4.5) {
            ally.combatAuraArmor = Math.max(ally.combatAuraArmor, champ.armorAuraBonus);
          }
        }
      }
      if (champ.damageAuraBonus > 0) {
        for (const ally of combatFriendlies) {
          if (ally.team === champ.team && champ.worldPos.distanceTo(ally.worldPos) <= 4.5) {
            ally.combatAuraAttack = Math.max(ally.combatAuraAttack, champ.damageAuraBonus);
          }
        }
      }
    }

    // 3. Unit-to-unit soft-collision separation to prevent stacking without catapulting units
    for (let a = 0; a < this.units.length; a++) {
      const uA = this.units[a];
      if (uA.isDead) continue;
      const aInArena = uA.inCombat || uA.isWaitingInArena || uA.hasCompletedMaze;

      for (let b = a + 1; b < this.units.length; b++) {
        const uB = this.units[b];
        if (uB.isDead) continue;
        const bInArena = uB.inCombat || uB.isWaitingInArena || uB.hasCompletedMaze;

        // Only separate units located in the arena
        if (!aInArena && !bInArena) continue;

        const dx = uA.worldPos.x - uB.worldPos.x;
        const dz = uA.worldPos.z - uB.worldPos.z;
        const distSq = dx * dx + dz * dz;
        const minRadius = (uA.stats.scale + uB.stats.scale) * 0.45;

        if (distSq < minRadius * minRadius && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = minRadius - dist;

          // Cap maximum push per frame to eliminate explosive launches when crowds swarm a single boss
          const maxPush = 2.4 * dt;
          const pushX = THREE.MathUtils.clamp((dx / dist) * overlap * 2.2 * dt, -maxPush, maxPush);
          const pushZ = THREE.MathUtils.clamp((dz / dist) * overlap * 2.2 * dt, -maxPush, maxPush);

          // A unit holding position (e.g. fighting) is anchored: whoever walked into it steps aside,
          // so a crowd advancing on one defender can't bulldoze it across the arena
          const aAnchored = !uA.movedThisFrame;
          const bAnchored = !uB.movedThisFrame;
          const shareA = aAnchored === bAnchored ? 0.5 : (aAnchored ? 0 : 1);

          uA.mesh.position.x += pushX * shareA;
          uA.mesh.position.z += pushZ * shareA;
          uB.mesh.position.x -= pushX * (1 - shareA);
          uB.mesh.position.z -= pushZ * (1 - shareA);

          if (aInArena) this.clampUnitToArena(uA);
          if (bInArena) this.clampUnitToArena(uB);
        }
      }
    }
  }

  /** Applies arena escalation to unit-vs-unit damage. */
  private escalate(dmg: number): number {
    return this.damageMultiplier === 1 ? dmg : Math.max(1, Math.round(dmg * this.damageMultiplier));
  }

  public clampUnitToArena(unit: Unit) {
    if (unit.inCombat || unit.isWaitingInArena || unit.hasCompletedMaze) {
      unit.mesh.position.x = THREE.MathUtils.clamp(unit.mesh.position.x, ARENA_BOUNDS.minX, ARENA_BOUNDS.maxX);
      unit.mesh.position.z = THREE.MathUtils.clamp(unit.mesh.position.z, ARENA_BOUNDS.minZ, ARENA_BOUNDS.maxZ);
    }
  }

  private handleCombatMovementAndAttack(
    unit: Unit,
    dt: number,
    time: number,
    onKillEnemy: KillCallback
  ) {
    const effectiveSpeed = unit.moveSpeed * (1 - unit.slowFactor);

    // 1. Armor Shred Debuff timer
    if (unit.armorDebuffTimer > 0) {
      unit.armorDebuffTimer -= dt;
      if (unit.armorDebuffTimer <= 0) {
        unit.armorDebuff = 0;
      }
    }

    // 2. Burn DoT timer & damage
    if (unit.burnTimer > 0) {
      unit.burnTimer -= dt;
      const burnDmgThisFrame = unit.burnDmgPerSec * dt * this.damageMultiplier;
      unit.currentHp -= burnDmgThisFrame;
      if (time - unit.lastBurnTick >= 500) {
        unit.lastBurnTick = time;
        this.vfx.spawnFlamePuff(unit.worldPos, 0xf97316);
      }
      if (unit.currentHp <= 0) {
        this.killUnit(unit, onKillEnemy);
        return;
      }
    }

    // 3. Soldier Life Regen (In-combat HP recovery)
    if (unit.lifeRegen > 0 && unit.currentHp < unit.maxHp) {
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + unit.lifeRegen * dt);
      if (time - unit.lastLifeRegenTick >= 1000) {
        unit.lastLifeRegenTick = time;
        audio.playHealPulse();
        this.vfx.spawnHealingPulse(unit.worldPos, 0x22c55e);
        this.vfx.spawnFloatingText(unit.worldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), `+${Math.round(unit.lifeRegen)} HP`, '#34d399', 0.8);
      }
    }

    // 4. Stun status: completely halts movement, attacks, and boss abilities!
    if (unit.stunTimer > 0) {
      unit.stunTimer -= dt;
      return;
    }

    // Boss Abilities (Lord Ignis Infernal Ground Stomp)
    if (unit.isBoss) {
      unit.bossStompCooldown -= dt;
      if (unit.bossStompCooldown <= 0) {
        const nearbyOpponents = this.units.filter(
          u => u.team !== unit.team && !u.isDead && !u.isDying && unit.worldPos.distanceTo(u.worldPos) <= 4.0
        );
        if (nearbyOpponents.length > 0) {
          unit.bossStompCooldown = 6.0;
          audio.playBossSlam();
          this.vfx.spawnGroundStompShockwave(unit.worldPos, 4.0, 0xff3700);
          this.vfx.spawnFloatingText(unit.worldPos.clone().add(new THREE.Vector3(0, 2.0, 0)), '💥 INFERNAL GROUND STOMP! 💥', '#ff4500', 1.6);

          for (const target of nearbyOpponents) {
            const stompDmg = this.escalate(calculateDamage(Math.round(unit.attack * 1.5), target.armor + target.combatAuraArmor));
            target.currentHp -= stompDmg;
            target.hitFlinchTimer = 0.25;

            // Pushback
            const pushDir = new THREE.Vector3().subVectors(target.worldPos, unit.worldPos).normalize();
            target.mesh.position.addScaledVector(pushDir, 0.6);
            this.clampUnitToArena(target);

            const hitPos = target.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));
            this.vfx.spawnBurstParticles(hitPos, 0xff4500, 8);
            this.vfx.spawnFloatingText(hitPos, `STOMP -${stompDmg}`, '#ff3700', 1.1);

            if (target.currentHp <= 0) {
              this.killUnit(target, onKillEnemy);
            }
          }
        }
      }
    }

    // Find nearest opposing target (ignoring units still in the maze or waiting behind the arena gates)
    const enemies = this.units.filter(u => u.team !== unit.team && this.isEngageable(u));
    const focusTarget = this.focusTargets[unit.team];
    const enemyCastle = this.castles[opponentOf(unit.team)];

    // Dynamic Attack speed rate
    const effectiveAttackRate = unit.attackSpeedBonus > 0
      ? unit.attackRate / (1 + unit.attackSpeedBonus)
      : unit.attackRate;

    // --- ENEMY AI: Target friendly units or the Player's Arena Stronghold ---
    if (!unit.isFriendly) {
      const castleTargetX = enemyCastle ? enemyCastle.gateTargetPos.x : 1.3;
      const castleTargetZ = THREE.MathUtils.clamp(unit.worldPos.z, -2.6, 2.6);
      const castleTargetPos = new THREE.Vector3(castleTargetX, unit.worldPos.y, castleTargetZ);
      const distToCastle = unit.worldPos.distanceTo(castleTargetPos);

      // Find nearest friendly defender (if any exist)
      let nearestFriendly: Unit | null = null;
      let minFriendlyDist = Infinity;

      if (focusTarget && !focusTarget.isDead && !focusTarget.isDying && focusTarget.team !== unit.team) {
        const dFocus = unit.worldPos.distanceTo(focusTarget.worldPos);
        if (unit.stats.range > 2.0 || dFocus <= 7.5) {
          nearestFriendly = focusTarget;
          minFriendlyDist = dFocus;
        }
      }

      if (!nearestFriendly) {
        for (const f of enemies) {
          const d = unit.worldPos.distanceTo(f.worldPos);
          if (d < minFriendlyDist) {
            minFriendlyDist = d;
            nearestFriendly = f;
          }
        }
      }

      // Decide whether to assault the Arena Castle or fight nearest friendly unit:
      const shouldAttackCastle =
        Boolean(enemyCastle &&
        !enemyCastle.isDestroyed &&
        (!nearestFriendly ||
          (distToCastle <= unit.stats.range + 0.4 && minFriendlyDist > unit.stats.range + 0.5) ||
          (unit.worldPos.x <= 3.2 && distToCastle < minFriendlyDist)));

      if (shouldAttackCastle) {
        const effectiveAttackRange = unit.stats.range + 0.4;
        const inCastleRange =
          distToCastle <= effectiveAttackRange ||
          (unit.worldPos.x <= castleTargetX + effectiveAttackRange && Math.abs(unit.worldPos.z - castleTargetZ) <= 0.6);

        if (inCastleRange) {
          // In range: stop and assault the castle
          unit.mesh.lookAt(castleTargetX - 2.0, unit.worldPos.y, castleTargetZ);

          const elapsed = (time - unit.lastAttackTime) / 1000;
          if (elapsed >= effectiveAttackRate) {
            unit.lastAttackTime = time;
            unit.lungeTimer = 0.16;

            const isRanged = unit.stats.range > 2.0;
            const hitPos = new THREE.Vector3(castleTargetX, 1.2, castleTargetZ);

            if (isRanged) {
              this.vfx.spawnBeam(unit.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), hitPos, 0xe2e8f0, 0.18);
            }

            const rawDmg = unit.attack;
            if (enemyCastle) {
              const destroyed = enemyCastle.takeDamage(rawDmg, hitPos);
              if (destroyed) this.onCastleDestroyed[opponentOf(unit.team)]?.();
            }
          }
        } else {
          // March toward castle front gate
          const dir = new THREE.Vector3().subVectors(castleTargetPos, unit.worldPos).normalize();
          unit.mesh.position.addScaledVector(dir, effectiveSpeed * dt);
          unit.mesh.lookAt(castleTargetPos.x, unit.worldPos.y, castleTargetPos.z);
          unit.bodyMesh.position.y = Math.abs(Math.sin(time * 0.008 * effectiveSpeed)) * 0.1 * unit.stats.scale;
        }

        this.clampUnitToArena(unit);
        return;
      }

      // If there are no friendly units and no castle, march west
      if (!nearestFriendly) {
        const marchDir = new THREE.Vector3(-1, 0, 0);
        unit.mesh.position.addScaledVector(marchDir, effectiveSpeed * dt);
        unit.mesh.rotation.y = Math.PI / 2;
        this.clampUnitToArena(unit);
        return;
      }

      // Engage nearest friendly unit
      const targetBuffer = (nearestFriendly.stats.scale - 0.6) * 0.5;
      const crowdBuffer = unit.stats.range <= 1.2 ? 0.35 : 0;
      const effectiveAttackRange = unit.stats.range + Math.max(0, targetBuffer) + crowdBuffer;

      if (minFriendlyDist <= effectiveAttackRange) {
        unit.mesh.lookAt(nearestFriendly.worldPos.x, unit.worldPos.y, nearestFriendly.worldPos.z);
        const elapsed = (time - unit.lastAttackTime) / 1000;
        if (elapsed >= effectiveAttackRate) {
          unit.lastAttackTime = time;
          this.executeAttack(unit, nearestFriendly, onKillEnemy);
        }
      } else {
        const dir = new THREE.Vector3().subVectors(nearestFriendly.worldPos, unit.worldPos).normalize();
        unit.mesh.position.addScaledVector(dir, effectiveSpeed * dt);
        unit.mesh.lookAt(nearestFriendly.worldPos.x, unit.worldPos.y, nearestFriendly.worldPos.z);
      }

      this.clampUnitToArena(unit);
      return;
    }

    // --- FRIENDLY AI: Target enemy units or advance ---
    if (enemies.length === 0) {
      const dir = forwardDir(unit.team);
      if (enemyCastle && !enemyCastle.isDestroyed) {
        const castleTargetX = enemyCastle.gateTargetPos.x;
        const castleTargetZ = THREE.MathUtils.clamp(unit.worldPos.z, -2.6, 2.6);
        const castleTargetPos = new THREE.Vector3(castleTargetX, unit.worldPos.y, castleTargetZ);
        const distToCastle = unit.worldPos.distanceTo(castleTargetPos);
        const effectiveAttackRange = unit.stats.range + 0.6;

        if (distToCastle <= effectiveAttackRange || (unit.worldPos.x - castleTargetX) * dir >= -effectiveAttackRange) {
          unit.mesh.lookAt(castleTargetX + 2.0 * dir, unit.worldPos.y, castleTargetZ);
          const elapsed = (time - unit.lastAttackTime) / 1000;
          if (elapsed >= effectiveAttackRate) {
            unit.lastAttackTime = time;
            unit.lungeTimer = 0.16;
            const hitPos = new THREE.Vector3(castleTargetX, 1.2, castleTargetZ);
            const destroyed = enemyCastle.takeDamage(unit.attack, hitPos);
            if (destroyed) this.onCastleDestroyed[opponentOf(unit.team)]?.();
          }
          return;
        } else {
          const moveDir = new THREE.Vector3().subVectors(castleTargetPos, unit.worldPos).normalize();
          unit.mesh.position.addScaledVector(moveDir, unit.moveSpeed * dt);
          unit.mesh.lookAt(castleTargetPos.x, unit.worldPos.y, castleTargetPos.z);
          this.clampUnitToArena(unit);
          return;
        }
      }

      // Victory march toward the opponent's side
      unit.mesh.position.x += dir * unit.moveSpeed * dt;
      unit.mesh.rotation.set(0, forwardYaw(unit.team), 0);
      this.clampUnitToArena(unit);
      return;
    }

    let nearest: Unit | null = null;
    let nearestDist = Infinity;

    if (focusTarget && !focusTarget.isDead && !focusTarget.isDying && focusTarget.team !== unit.team) {
      const dFocus = unit.worldPos.distanceTo(focusTarget.worldPos);
      if (unit.stats.range > 2.0 || dFocus <= 7.5) {
        nearest = focusTarget;
        nearestDist = dFocus;
      }
    }

    if (!nearest) {
      for (const e of enemies) {
        const d = unit.worldPos.distanceTo(e.worldPos);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }
    }

    if (!nearest) return;

    // Calculate dynamic attack range taking target size into account
    // Target scale gives extra reach so units don't have to embed inside large units (e.g. Ogres/Bosses)
    // Extra melee buffer (+0.35) allows units in the 2nd row of a crowd to attack without shoving the front row
    const targetBuffer = (nearest.stats.scale - 0.6) * 0.5;
    const crowdBuffer = unit.stats.range <= 1.2 ? 0.35 : 0;
    const effectiveAttackRange = unit.stats.range + Math.max(0, targetBuffer) + crowdBuffer;

    // Check if in attack range
    if (nearestDist <= effectiveAttackRange) {
      // Stop and attack
      unit.mesh.lookAt(nearest.worldPos.x, unit.worldPos.y, nearest.worldPos.z);

      const elapsed = (time - unit.lastAttackTime) / 1000;
      if (elapsed >= effectiveAttackRate) {
        unit.lastAttackTime = time;
        this.executeAttack(unit, nearest, onKillEnemy);
      }
    } else {
      // March toward nearest target
      const dir = new THREE.Vector3().subVectors(nearest.worldPos, unit.worldPos).normalize();
      unit.mesh.position.addScaledVector(dir, unit.moveSpeed * dt);
      unit.mesh.lookAt(nearest.worldPos.x, unit.worldPos.y, nearest.worldPos.z);
    }

    this.clampUnitToArena(unit);
  }

  private executeAttack(attacker: Unit, defender: Unit, onKillEnemy: KillCallback) {
    attacker.lungeTimer = 0.16;
    defender.hitFlinchTimer = 0.14;

    let rawDmg = attacker.attack + attacker.combatAuraAttack;

    // Soldier Relentless Assault: each consecutive hit on the same target deals more damage
    let rampBonus = 0;
    if (attacker.rampPerHit > 0) {
      if (attacker.rampTargetId !== defender.id) {
        attacker.rampTargetId = defender.id;
        attacker.rampStacks = 0;
      }
      rampBonus = attacker.rampStacks * attacker.rampPerHit;
      rawDmg = Math.round(rawDmg * (1 + rampBonus));
      attacker.rampStacks++;
    }

    const totalArmor = defender.armor + defender.combatAuraArmor;
    const effectiveArmor = Math.max(0, totalArmor - defender.armorDebuff);
    let finalDmg = calculateDamage(rawDmg, effectiveArmor);

    // Defender flat damage reduction (Soldier Spiked Bulwark)
    if (defender.flatDmgReduction > 0) {
      finalDmg = Math.max(1, finalDmg - defender.flatDmgReduction);
    }
    finalDmg = this.escalate(finalDmg);

    defender.currentHp -= finalDmg;

    // Audio & VFX
    audio.playHit();
    const hitPos = defender.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));

    if (rampBonus >= 0.5) {
      this.vfx.spawnBurstParticles(hitPos, 0xfacc15, 8);
      this.vfx.spawnFloatingText(hitPos, `⚔️ +${Math.round(rampBonus * 100)}% -${finalDmg}`, '#facc15', 1.2);
    } else {
      this.vfx.spawnBurstParticles(hitPos, attacker.isFriendly ? 0xf87171 : 0xef4444, 4);
      this.vfx.spawnFloatingText(hitPos, `-${finalDmg}`, attacker.isFriendly ? '#f87171' : '#fb923c', 0.8);
    }

    // Archer Sundering Shot (Armor Shred on hit)
    if (attacker.armorShredOnHit > 0 && !defender.isDead && !defender.isDying) {
      defender.armorDebuff = Math.max(defender.armorDebuff, attacker.armorShredOnHit);
      defender.armorDebuffTimer = attacker.armorShredDuration || 4.0;
      audio.playShred();
      this.vfx.spawnFloatingText(hitPos.clone().add(new THREE.Vector3(0, 0.4, 0)), `🛡️ -${attacker.armorShredOnHit} ARMOR`, '#38bdf8', 0.9);
    }

    // Archer Rapid Quiver proc indicator
    if (attacker.attackSpeedBonus > 0 && Math.random() < 0.25) {
      this.vfx.spawnFloatingText(attacker.worldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), '⚡ FLURRY', '#a7f3d0', 0.6);
    }

    // Soldier Thorns retaliation against melee attacker
    if (defender.thornsMultiplier > 0 && attacker.stats.range <= 2.0 && !attacker.isDead && !attacker.isDying) {
      const reflectedDmg = Math.max(1, Math.round(finalDmg * defender.thornsMultiplier));
      attacker.currentHp -= reflectedDmg;
      attacker.hitFlinchTimer = 0.12;
      const attackerHitPos = attacker.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));
      this.vfx.spawnBurstParticles(attackerHitPos, 0xa3e635, 6);
      this.vfx.spawnFloatingText(attackerHitPos, `🌵 THORNS -${reflectedDmg}`, '#a3e635', 0.9);
      if (attacker.currentHp <= 0) {
        this.killUnit(attacker, onKillEnemy);
      }
    }

    // Mage Paralyzing Arc (Stun)
    if (attacker.stunChance > 0 && Math.random() < attacker.stunChance && !defender.isDead && !defender.isDying) {
      defender.stunTimer = Math.max(defender.stunTimer, attacker.stunDuration || 1.5);
      audio.playStun();
      this.vfx.spawnStunRing(defender.worldPos, attacker.stunDuration || 1.5);
      this.vfx.spawnFloatingText(defender.worldPos.clone().add(new THREE.Vector3(0, 1.4, 0)), '⚡ STUNNED!', '#facc15', 1.2);
    }

    // Mage Molten Pyre (Burn DoT)
    if (attacker.burnMultiplier > 0 && !defender.isDead && !defender.isDying) {
      const burnDmg = Math.max(1, Math.round((attacker.attack + attacker.combatAuraAttack) * attacker.burnMultiplier));
      defender.burnDmgPerSec = Math.max(defender.burnDmgPerSec, burnDmg);
      defender.burnTimer = attacker.burnDuration || 3.0;
      this.vfx.spawnFloatingText(hitPos.clone().add(new THREE.Vector3(0, 0.7, 0)), `🔥 BURN -${burnDmg}/s`, '#fb923c', 0.9);
    }

    // Melee attack slash arc
    if (attacker.stats.range <= 2.0) {
      audio.playSlash();
      const arcColor = attacker.isFriendly ? 0x38bdf8 : (attacker.isBoss ? 0xff4500 : 0xf97316);
      this.vfx.spawnSlashArc(attacker.worldPos, defender.worldPos, arcColor, attacker.stats.scale);
    }

    // Boss Phase 2 Transition (Magma Shield)
    if (defender.isBoss && !defender.magmaShieldActive && defender.currentHp <= defender.maxHp * 0.5) {
      defender.magmaShieldActive = true;
      defender.armor += 15; // Fortified magma armor
      audio.playRulebreaker();
      this.vfx.spawnAscensionPillar(defender.worldPos, 0xff3b30);
      this.vfx.spawnBurstParticles(defender.worldPos, 0xff4500, 32);
      this.vfx.spawnFloatingText(defender.worldPos.clone().add(new THREE.Vector3(0, 2.2, 0)), '🛡️ PHASE 2: MAGMA SHIELD (+15 ARMOR)! 🛡️', '#ff3700', 2.0);
    }

    // Archer Ranged Projectile / Beam
    if (attacker.stats.range > 2.0) {
      this.vfx.spawnBeam(attacker.worldPos.clone().add(new THREE.Vector3(0, 0.8, 0)), hitPos, 0x10b981, 0.15);
    }

    // Archer Multishot Volley
    if (attacker.multishotChance > 0 && Math.random() < attacker.multishotChance) {
      const otherEnemies = this.units.filter(u => u.team !== attacker.team && !u.isDead && !u.isDying && u.id !== defender.id);
      const targets = otherEnemies
        .filter(u => attacker.worldPos.distanceTo(u.worldPos) <= attacker.stats.range)
        .slice(0, attacker.multishotTargets - 1);

      for (const t of targets) {
        const tArmor = t.armor + t.combatAuraArmor;
        const tEffArmor = Math.max(0, tArmor - t.armorDebuff);
        let extraDmg = calculateDamage(attacker.attack + attacker.combatAuraAttack, tEffArmor);
        if (t.flatDmgReduction > 0) extraDmg = Math.max(1, extraDmg - t.flatDmgReduction);
        extraDmg = this.escalate(extraDmg);
        t.currentHp -= extraDmg;
        t.hitFlinchTimer = 0.14;
        const extraHitPos = t.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));
        this.vfx.spawnBeam(attacker.worldPos.clone().add(new THREE.Vector3(0, 0.8, 0)), extraHitPos, 0x34d399, 0.12);
        this.vfx.spawnFloatingText(extraHitPos, `🏹 MULTISHOT -${extraDmg}`, '#34d399', 0.9);

        // Apply armor shred on multishot as well
        if (attacker.armorShredOnHit > 0) {
          t.armorDebuff = Math.max(t.armorDebuff, attacker.armorShredOnHit);
          t.armorDebuffTimer = attacker.armorShredDuration || 4.0;
        }

        if (t.currentHp <= 0) {
          this.killUnit(t, onKillEnemy);
        }
      }
    }

    // Mage Arcane Siphon & Mega Fireball AoE
    if (attacker.unitClass === FriendlyClass.MAGE) {
      this.vfx.spawnBeam(attacker.worldPos.clone().add(new THREE.Vector3(0, 0.8, 0)), hitPos, 0xa855f7, 0.15);

      const gain = attacker.manaGainPerAttack || 25;
      attacker.mana += gain;
      this.vfx.spawnFloatingText(attacker.worldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), `+${gain} MP`, '#c084fc', 0.6);

      // Check if full mana -> CAST BIG FIREBALL!
      if (attacker.mana >= attacker.maxMana) {
        // Carry the overflow so every point of Arcane Siphon shortens the cast cycle
        attacker.mana = Math.min(attacker.mana - attacker.maxMana, attacker.maxMana - 1);
        audio.playFireball();

        const fireballPos = defender.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));
        this.vfx.spawnAscensionPillar(defender.worldPos, 0xff4500);
        this.vfx.spawnBurstParticles(defender.worldPos, 0xff3700, 24);
        this.vfx.spawnBeam(attacker.worldPos.clone().add(new THREE.Vector3(0, 0.9, 0)), fireballPos, 0xff4500, 0.3);
        this.vfx.spawnFloatingText(defender.worldPos.clone().add(new THREE.Vector3(0, 1.3, 0)), '🔥 MEGA FIREBALL! 🔥', '#ff4500', 1.8);

        const rawSplashDmg = Math.round((attacker.attack + attacker.combatAuraAttack) * attacker.fireballDamageMult);
        const enemies = this.units.filter(u => u.team !== attacker.team && !u.isDead && !u.isDying);

        for (const enemy of enemies) {
          const dist = defender.worldPos.distanceTo(enemy.worldPos);
          if (dist <= attacker.fireballRadius) {
            const splashArmor = Math.max(0, enemy.armor + enemy.combatAuraArmor - enemy.armorDebuff);
            let enemyFinalDmg = calculateDamage(rawSplashDmg, splashArmor);
            if (enemy.flatDmgReduction > 0) enemyFinalDmg = Math.max(1, enemyFinalDmg - enemy.flatDmgReduction);
            enemyFinalDmg = this.escalate(enemyFinalDmg);
            enemy.currentHp -= enemyFinalDmg;
            enemy.hitFlinchTimer = 0.18;
            const enemyHitPos = enemy.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));
            this.vfx.spawnBurstParticles(enemyHitPos, 0xf97316, 6);
            this.vfx.spawnFloatingText(enemyHitPos, `🔥 AOE -${enemyFinalDmg}`, '#ff6b00', 1.0);

            // Molten Pyre burn on splash targets
            if (attacker.burnMultiplier > 0 && !enemy.isDead && !enemy.isDying) {
              const splashBurn = Math.max(1, Math.round((attacker.attack + attacker.combatAuraAttack) * attacker.burnMultiplier));
              enemy.burnDmgPerSec = Math.max(enemy.burnDmgPerSec, splashBurn);
              enemy.burnTimer = attacker.burnDuration || 3.0;
            }

            if (enemy.currentHp <= 0) {
              this.killUnit(enemy, onKillEnemy);
            }
          }
        }
      }
    }

    // Passive Cleave for Pyro Golem
    if (attacker.stats.passive === 'CLEAVE') {
      const nearby = this.units.filter(u => u.team !== attacker.team && !u.isDead && !u.isDying && u.id !== defender.id);
      for (const n of nearby) {
        if (attacker.worldPos.distanceTo(n.worldPos) <= 2.2) {
          const cleaveDmg = Math.round(finalDmg * 0.6);
          n.currentHp -= cleaveDmg;
          n.hitFlinchTimer = 0.14;
          this.vfx.spawnFloatingText(n.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), `CLEAVE -${cleaveDmg}`, '#f97316', 0.8);
          if (n.currentHp <= 0) this.killUnit(n, onKillEnemy);
        }
      }
    }

    if (defender.currentHp <= 0) {
      this.killUnit(defender, onKillEnemy);
    }
  }

  /** Starts the death animation (visual state only). */
  beginDeath(unit: Unit) {
    if (unit.isDying || unit.isDead) return;
    unit.isDying = true;
    unit.deathTimer = 0.45;
    unit.inCombat = false;
    unit.hpBarGroup.visible = false;
    unit.hpBarMesh.visible = false;
    unit.hpBarBgMesh.visible = false;
    if (unit.manaBarMesh) unit.manaBarMesh.visible = false;
    if (unit.manaBarBgMesh) unit.manaBarBgMesh.visible = false;
  }

  private killUnit(unit: Unit, onKillEnemy: KillCallback) {
    if (unit.isDying || unit.isDead) return;
    this.beginDeath(unit);

    // Death particle burst
    const burstColor = unit.isBoss ? 0xff4500 : (unit.isFriendly ? 0x38bdf8 : 0xef4444);
    this.vfx.spawnBurstParticles(unit.worldPos.clone().add(new THREE.Vector3(0, 0.5, 0)), burstColor, unit.isBoss ? 36 : 14);

    if (!unit.isFriendly || this.pvpMode) {
      // Bounty for enemies (and, in PvP, for every unit of the opposing army)
      const bounty = getKillBounty(unit.stats, unit.isBoss);
      onKillEnemy(bounty, unit);
      audio.playGoldGain();
      this.vfx.spawnFloatingText(unit.worldPos.clone().add(new THREE.Vector3(0, 1.2, 0)), `+${bounty}g`, '#facc15', unit.isBoss ? 1.8 : 1.2);
    }
  }

  getBossUnit(): Unit | null {
    return this.units.find(u => u.isBoss && !u.isDead && !u.isDying) || null;
  }

  private removeUnit(unit: Unit, index: number) {
    this.scene.remove(unit.mesh);
    unit.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });

    this.units.splice(index, 1);
    if (this.selectedUnit === unit) {
      this.selectedUnit = null;
    }
    if (this.focusTargets.SUN === unit) this.focusTargets.SUN = null;
    if (this.focusTargets.MOON === unit) this.focusTargets.MOON = null;
  }

  /** Immediately removes a unit (no death animation). */
  despawnUnit(unit: Unit) {
    const idx = this.units.indexOf(unit);
    if (idx < 0) return;
    unit.isDead = true;
    this.removeUnit(unit, idx);
  }

  selectUnit(unit: Unit | null) {
    this.selectedUnit = unit;
  }

  public damageUnit(target: Unit, rawDmg: number, onKillEnemy: KillCallback): number {
    if (target.isDead || target.isDying) return 0;
    const defenderArmor = target.armor + (target.combatAuraArmor || 0);
    const finalDmg = calculateDamage(rawDmg, defenderArmor);

    target.currentHp -= finalDmg;
    target.hitFlinchTimer = 0.16;

    const hitPos = target.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));
    this.vfx.spawnBurstParticles(hitPos, 0x38bdf8, 8);
    this.vfx.spawnFloatingText(hitPos, `-${finalDmg}`, '#38bdf8', 0.9);

    if (target.currentHp <= 0) {
      this.killUnit(target, onKillEnemy);
    }
    return finalDmg;
  }

  clearAll() {
    for (let i = this.units.length - 1; i >= 0; i--) {
      this.removeUnit(this.units[i], i);
    }
  }
}

