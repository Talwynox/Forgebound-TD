import * as THREE from 'three';
import {
  FriendlyClass,
  EnemyClass,
  UnitStats,
  FRIENDLY_UNIT_STATS,
  ENEMY_UNIT_STATS,
  UnitTier,
  calculateDamage
} from './UnitData';
import { VFXManager } from '../vfx/VFXManager';
import { audio } from '../engine/AudioSystem';

export class Unit {
  public id: number;
  public isFriendly: boolean;
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
  public inCombat: boolean = false;
  public isDead: boolean = false;

  // Combat targeting
  public target: Unit | null = null;
  public lastAttackTime: number = 0;

  // 3D Visuals
  public mesh: THREE.Group;
  public hpBarMesh: THREE.Mesh;
  public hpBarBgMesh: THREE.Mesh;
  public bodyMesh: THREE.Mesh;

  constructor(
    id: number,
    isFriendly: boolean,
    unitClass: FriendlyClass | EnemyClass,
    startPos: THREE.Vector3,
    waypoints: THREE.Vector3[] = []
  ) {
    this.id = id;
    this.isFriendly = isFriendly;
    this.unitClass = unitClass;
    this.stats = isFriendly
      ? FRIENDLY_UNIT_STATS[unitClass as FriendlyClass]
      : ENEMY_UNIT_STATS[unitClass as EnemyClass];

    this.maxHp = this.stats.hp;
    this.currentHp = this.stats.hp;
    this.armor = this.stats.armor;
    this.attack = this.stats.attack;
    this.attackRate = this.stats.attackRate;
    this.moveSpeed = this.stats.moveSpeed;

    this.waypoints = waypoints;
    this.currentWaypointIdx = 0;

    // 3D Object Group
    this.mesh = new THREE.Group();
    this.mesh.position.copy(startPos);

    // Body Mesh
    const geom = isFriendly
      ? new THREE.CapsuleGeometry(0.3 * this.stats.scale, 0.5 * this.stats.scale, 4, 8)
      : new THREE.CylinderGeometry(0.25 * this.stats.scale, 0.35 * this.stats.scale, 0.8 * this.stats.scale, 6);

    const mat = new THREE.MeshStandardMaterial({
      color: this.stats.color,
      roughness: 0.5,
      metalness: isFriendly ? 0.3 : 0.1
    });

    this.bodyMesh = new THREE.Mesh(geom, mat);
    this.bodyMesh.position.y = 0.45 * this.stats.scale;
    this.bodyMesh.castShadow = true;
    this.mesh.add(this.bodyMesh);

    // Health Bar Background
    const barBgGeom = new THREE.PlaneGeometry(0.8, 0.1);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
    this.hpBarBgMesh = new THREE.Mesh(barBgGeom, barBgMat);
    this.hpBarBgMesh.position.y = 1.1 * this.stats.scale;
    this.mesh.add(this.hpBarBgMesh);

    // Health Bar Foreground
    const barGeom = new THREE.PlaneGeometry(0.78, 0.08);
    const barMat = new THREE.MeshBasicMaterial({
      color: isFriendly ? 0x22c55e : 0xef4444,
      side: THREE.DoubleSide
    });
    this.hpBarMesh = new THREE.Mesh(barGeom, barMat);
    this.hpBarMesh.position.set(0, 1.1 * this.stats.scale, 0.01);
    this.mesh.add(this.hpBarMesh);
  }

  get worldPos(): THREE.Vector3 {
    return this.mesh.position;
  }

  applySlow(percent: number, duration: number) {
    this.slowFactor = Math.max(this.slowFactor, percent);
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
    if (this.stats.tier === UnitTier.TIER_1) {
      if (this.armor >= 20) {
        this.morphClass(FriendlyClass.KNIGHT);
        return true;
      }
      if (this.attack >= 26) {
        this.morphClass(FriendlyClass.BERSERKER);
        return true;
      }
      if (this.maxHp >= 300) {
        this.morphClass(FriendlyClass.CLERIC);
        return true;
      }
      // General threshold
      if (this.currentHp >= 200 || this.buffHistory.length >= 3) {
        this.morphClass(FriendlyClass.FOOTMAN);
        return true;
      }
    } else if (this.stats.tier === UnitTier.TIER_2 && allowTier3) {
      // Tier 3 Evolution
      if (this.maxHp >= 1000) {
        this.morphClass(FriendlyClass.PYRO_GOLEM);
        return true;
      }
      if (this.maxHp >= 650 && this.armor >= 30) {
        this.morphClass(FriendlyClass.PALADIN);
        return true;
      }
      if (this.attack >= 50) {
        this.morphClass(FriendlyClass.ARCHMAGE);
        return true;
      }
    }

    return false;
  }

  morphClass(newClass: FriendlyClass) {
    this.unitClass = newClass;
    const newStats = FRIENDLY_UNIT_STATS[newClass];
    this.stats = newStats;

    // Preserve accumulated bonuses on top of new class baseline!
    this.maxHp = Math.max(this.maxHp, newStats.hp);
    this.currentHp = Math.max(this.currentHp, newStats.hp);
    this.armor = Math.max(this.armor, newStats.armor);
    this.attack = Math.max(this.attack, newStats.attack);
    this.attackRate = newStats.attackRate;
    this.moveSpeed = newStats.moveSpeed;

    // Update body mesh visually
    this.bodyMesh.geometry.dispose();
    (this.bodyMesh.material as THREE.Material).dispose();

    if (newClass === FriendlyClass.PYRO_GOLEM) {
      this.bodyMesh.geometry = new THREE.BoxGeometry(0.9, 1.2, 0.9);
    } else if (newClass === FriendlyClass.PALADIN) {
      this.bodyMesh.geometry = new THREE.DodecahedronGeometry(0.55);
    } else {
      this.bodyMesh.geometry = new THREE.CapsuleGeometry(0.35 * newStats.scale, 0.6 * newStats.scale, 4, 8);
    }

    this.bodyMesh.material = new THREE.MeshStandardMaterial({
      color: newStats.color,
      emissive: newClass === FriendlyClass.PALADIN ? 0xf59e0b : 0x000000,
      emissiveIntensity: 0.3,
      roughness: 0.4
    });

    this.hpBarBgMesh.position.y = 1.3 * newStats.scale;
    this.hpBarMesh.position.y = 1.3 * newStats.scale;
  }

  updateHpBar(camera: THREE.Camera) {
    const hpRatio = Math.max(0, Math.min(1, this.currentHp / this.maxHp));
    this.hpBarMesh.scale.x = hpRatio;
    this.hpBarMesh.position.x = -(1 - hpRatio) * 0.39;

    // Billboard towards camera
    this.hpBarBgMesh.quaternion.copy(camera.quaternion);
    this.hpBarMesh.quaternion.copy(camera.quaternion);
  }

  applyEndOfWeekBuffs(): string[] {
    const applied: string[] = [];
    if (this.stackingLifebloom > 0) {
      this.maxHp += this.stackingLifebloom;
      this.currentHp = this.maxHp;
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

  // Battlefield clash boundaries
  public arenaMinX: number = 4;
  public arenaMaxX: number = 24;

  constructor(scene: THREE.Scene, vfx: VFXManager, camera: THREE.Camera) {
    this.scene = scene;
    this.vfx = vfx;
    this.camera = camera;
  }

  spawnFriendly(unitClass: FriendlyClass, startPos: THREE.Vector3, waypoints: THREE.Vector3[]): Unit {
    const unit = new Unit(this.nextId++, true, unitClass, startPos, waypoints);
    this.scene.add(unit.mesh);
    this.units.push(unit);
    return unit;
  }

  spawnEnemy(enemyClass: EnemyClass, startPos: THREE.Vector3): Unit {
    const unit = new Unit(this.nextId++, false, enemyClass, startPos);
    unit.inCombat = true; // Enemies spawn directly in the arena
    this.scene.add(unit.mesh);
    this.units.push(unit);
    return unit;
  }

  update(dt: number, time: number, onKillEnemyCallback: (bounty: number) => void) {
    // 1. Update Unit Buff Status & Navigation
    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];

      if (unit.isDead) {
        this.removeUnit(unit, i);
        continue;
      }

      // Decrement slow timer
      if (unit.slowTimer > 0) {
        unit.slowTimer -= dt;
        if (unit.slowTimer <= 0) {
          unit.slowFactor = 0;
        }
      }

      // Calculate effective movement speed
      const effectiveSpeed = unit.moveSpeed * (1 - unit.slowFactor);

      // Unit in Maze Pathing
      if (unit.isFriendly && !unit.inCombat) {
        if (unit.currentWaypointIdx < unit.waypoints.length) {
          const targetWp = unit.waypoints[unit.currentWaypointIdx];
          const dir = new THREE.Vector3().subVectors(targetWp, unit.worldPos);
          const dist = dir.length();

          if (dist < 0.25) {
            unit.currentWaypointIdx++;
            if (unit.currentWaypointIdx >= unit.waypoints.length) {
              // Reached Maze Exit! Step into the Battlefield Arena!
              unit.inCombat = true;
              this.vfx.spawnFloatingText(unit.worldPos, 'ENTERING ARENA!', '#38bdf8', 1.5);
            }
          } else {
            dir.normalize();
            unit.mesh.position.addScaledVector(dir, effectiveSpeed * dt);
            unit.mesh.lookAt(targetWp.x, unit.worldPos.y, targetWp.z);
            // Bobbing animation
            unit.bodyMesh.position.y = (0.45 + Math.abs(Math.sin(time * 0.008 * effectiveSpeed)) * 0.1) * unit.stats.scale;
          }
        }
      }

      // Unit in Combat / Battlefield
      if (unit.inCombat) {
        this.handleCombatMovementAndAttack(unit, dt, time, onKillEnemyCallback);
      }

      // Update Health bar
      unit.updateHpBar(this.camera);
    }
  }

  private handleCombatMovementAndAttack(
    unit: Unit,
    dt: number,
    time: number,
    onKillEnemy: (bounty: number) => void
  ) {
    // Find nearest opposing target
    const enemies = this.units.filter(u => u.isFriendly !== unit.isFriendly && !u.isDead);

    if (enemies.length === 0) {
      // March towards opponent's citadel
      const marchDir = unit.isFriendly ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-1, 0, 0);
      unit.mesh.position.addScaledVector(marchDir, unit.moveSpeed * dt);
      unit.mesh.rotation.y = unit.isFriendly ? -Math.PI / 2 : Math.PI / 2;
      return;
    }

    // Find closest target
    let nearest: Unit | null = null;
    let nearestDist = Infinity;

    for (const e of enemies) {
      const d = unit.worldPos.distanceTo(e.worldPos);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }

    if (!nearest) return;

    // Check if in attack range
    if (nearestDist <= unit.stats.range) {
      // Stop and attack
      unit.mesh.lookAt(nearest.worldPos.x, unit.worldPos.y, nearest.worldPos.z);

      const elapsed = (time - unit.lastAttackTime) / 1000;
      if (elapsed >= unit.attackRate) {
        unit.lastAttackTime = time;
        this.executeAttack(unit, nearest, onKillEnemy);
      }
    } else {
      // March toward nearest target
      const dir = new THREE.Vector3().subVectors(nearest.worldPos, unit.worldPos).normalize();
      unit.mesh.position.addScaledVector(dir, unit.moveSpeed * dt);
      unit.mesh.lookAt(nearest.worldPos.x, unit.worldPos.y, nearest.worldPos.z);
    }
  }

  private executeAttack(attacker: Unit, defender: Unit, onKillEnemy: (bounty: number) => void) {
    const rawDmg = attacker.attack;
    const finalDmg = calculateDamage(rawDmg, defender.armor);

    defender.currentHp -= finalDmg;

    // Audio & VFX
    audio.playHit();
    const hitPos = defender.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));
    this.vfx.spawnFloatingText(hitPos, `-${finalDmg}`, attacker.isFriendly ? '#f87171' : '#fb923c', 0.8);
    this.vfx.spawnBurstParticles(hitPos, attacker.isFriendly ? 0xf87171 : 0xef4444, 4);

    // Passive Cleave for Pyro Golem
    if (attacker.stats.passive === 'CLEAVE') {
      const nearby = this.units.filter(u => u.isFriendly !== attacker.isFriendly && !u.isDead && u.id !== defender.id);
      for (const n of nearby) {
        if (attacker.worldPos.distanceTo(n.worldPos) <= 2.2) {
          const cleaveDmg = Math.round(finalDmg * 0.6);
          n.currentHp -= cleaveDmg;
          this.vfx.spawnFloatingText(n.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0)), `CLEAVE -${cleaveDmg}`, '#f97316', 0.8);
          if (n.currentHp <= 0) this.killUnit(n, onKillEnemy);
        }
      }
    }

    if (defender.currentHp <= 0) {
      this.killUnit(defender, onKillEnemy);
    }
  }

  private killUnit(unit: Unit, onKillEnemy: (bounty: number) => void) {
    unit.isDead = true;
    if (!unit.isFriendly) {
      // Enemy bounty
      const bounty = unit.stats.tier === UnitTier.TIER_3 ? 60 : unit.stats.tier === UnitTier.TIER_2 ? 25 : 12;
      onKillEnemy(bounty);
      audio.playGoldGain();
      this.vfx.spawnFloatingText(unit.worldPos.clone().add(new THREE.Vector3(0, 1, 0)), `+${bounty}g`, '#facc15', 1.2);
    }
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
    if (this.selectedUnit?.id === unit.id) {
      this.selectedUnit = null;
    }
  }

  selectUnit(unit: Unit | null) {
    this.selectedUnit = unit;
  }

  clearAll() {
    for (let i = this.units.length - 1; i >= 0; i--) {
      this.removeUnit(this.units[i], i);
    }
  }
}
