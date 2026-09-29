import * as THREE from 'three';
import { Unit, UnitManager } from '../units/UnitManager';
import { EnemyClass, FriendlyClass, getUnitStats, isFriendlyClass } from '../units/UnitData';
import { TowerManager } from '../towers/TowerManager';
import { PortalGuardianManager } from '../towers/PortalGuardianManager';
import { ArenaCastle } from '../engine/ArenaCastle';
import { UnitState, TowerState, GuardianState, CastleState, UNIT_FLAG } from './NetworkTypes';

/**
 * Packing (Host) and applying (Client) of the authoritative world state carried by STATE_SNAPSHOT.
 */

const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function getYaw(obj: THREE.Object3D): number {
  // rotation.y alone is ambiguous after lookAt() (XYZ Euler flips x/z for |yaw| > 90°).
  yawEuler.setFromQuaternion(obj.quaternion, 'YXZ');
  return yawEuler.y;
}

const c100 = (n: number) => Math.round(n * 100);

// --- Units ---

export function encodeUnit(u: Unit): UnitState {
  let flags = 0;
  if (u.isFriendly) flags |= UNIT_FLAG.FRIENDLY;
  if (u.inCombat) flags |= UNIT_FLAG.IN_COMBAT;
  if (u.isDying) flags |= UNIT_FLAG.DYING;
  if (u.lungeTimer > 0.08) flags |= UNIT_FLAG.LUNGING;
  if (u.hitFlinchTimer > 0.07) flags |= UNIT_FLAG.FLINCHING;
  if (u.hasCompletedMaze) flags |= UNIT_FLAG.COMPLETED_MAZE;
  if (u.isWaitingInArena) flags |= UNIT_FLAG.WAITING_IN_ARENA;
  if (u.magmaShieldActive) flags |= UNIT_FLAG.MAGMA_SHIELD;
  if (u.isMercenary) flags |= UNIT_FLAG.MERCENARY;

  return [
    u.id,
    u.unitClass,
    flags,
    c100(u.worldPos.x),
    c100(u.worldPos.y),
    c100(u.worldPos.z),
    c100(getYaw(u.mesh)),
    Math.ceil(Math.max(0, u.currentHp)),
    Math.round(u.maxHp),
    Math.round(u.armor),
    Math.round(u.attack),
    Math.round(u.mana)
  ];
}

/**
 * Reconciles the client's mirrored units with the host's list.
 * @param onUnitDied called once when a mirrored unit starts dying (for local achievements)
 */
export function applyUnitStates(unitManager: UnitManager, states: UnitState[], onUnitDied: (unit: Unit) => void) {
  const byId = new Map<number, Unit>();
  for (const u of unitManager.units) byId.set(u.id, u);
  const seen = new Set<number>();

  for (const [id, unitClass, flags, x, y, z, yaw, hp, maxHp, armor, attack, mana] of states) {
    seen.add(id);
    const isFriendly = (flags & UNIT_FLAG.FRIENDLY) !== 0;
    const cls = unitClass as FriendlyClass | EnemyClass;
    const pos = new THREE.Vector3(x / 100, y / 100, z / 100);

    let unit = byId.get(id);
    if (unit && unit.isFriendly !== isFriendly) {
      unitManager.despawnUnit(unit);
      unit = undefined;
    }
    if (!unit) {
      if (flags & UNIT_FLAG.DYING) continue; // Never saw it alive; skip the death animation
      unit = unitManager.spawnNetworkUnit(id, isFriendly, cls, pos);
      unit.mesh.rotation.set(0, yaw / 100, 0);
    }

    // Evolutions change a friendly unit's class (and mesh) mid-run
    if (unit.unitClass !== cls && isFriendly && isFriendlyClass(cls)) {
      unit.morphClass(cls);
    } else if (unit.unitClass !== cls) {
      unit.unitClass = cls;
      unit.stats = getUnitStats(cls);
    }

    unit.netTargetPos = pos;
    unit.netTargetYaw = yaw / 100;
    unit.currentHp = hp;
    unit.maxHp = Math.max(1, maxHp);
    unit.armor = armor;
    unit.attack = attack;
    unit.mana = mana;
    unit.inCombat = (flags & UNIT_FLAG.IN_COMBAT) !== 0;
    unit.hasCompletedMaze = (flags & UNIT_FLAG.COMPLETED_MAZE) !== 0;
    unit.isWaitingInArena = (flags & UNIT_FLAG.WAITING_IN_ARENA) !== 0;
    unit.magmaShieldActive = (flags & UNIT_FLAG.MAGMA_SHIELD) !== 0;
    unit.isMercenary = (flags & UNIT_FLAG.MERCENARY) !== 0;
    if ((flags & UNIT_FLAG.LUNGING) && unit.lungeTimer <= 0) unit.lungeTimer = 0.16;
    if ((flags & UNIT_FLAG.FLINCHING) && unit.hitFlinchTimer <= 0) unit.hitFlinchTimer = 0.14;

    if ((flags & UNIT_FLAG.DYING) && !unit.isDying) {
      unitManager.beginDeath(unit);
      onUnitDied(unit);
    }
  }

  // Units the host no longer tracks: finish their death animation, otherwise remove immediately
  for (const u of Array.from(unitManager.units)) {
    if (!seen.has(u.id) && !u.isDying) {
      unitManager.despawnUnit(u);
    }
  }
}

// --- Towers ---

export function encodeTowers(towerManager: TowerManager): TowerState[] {
  return Array.from(towerManager.towers.values()).map(t => [
    t.id,
    t.accumulatedStackBonus,
    t.roundsStacked,
    t.hasEvolvedThisWave ? 1 : 0,
    Math.round(t.totalBuffApplied),
    t.totalHits
  ]);
}

export function applyTowerStates(towerManager: TowerManager, states: TowerState[]) {
  for (const [id, stack, rounds, evolved, buff, hits] of states) {
    const t = towerManager.towers.get(id);
    if (!t) continue;
    t.accumulatedStackBonus = stack;
    t.roundsStacked = rounds;
    t.hasEvolvedThisWave = evolved === 1;
    t.totalBuffApplied = buff;
    t.totalHits = hits;
  }
}

// --- Portal Guardians ---

export function encodeGuardians(guardians: PortalGuardianManager): GuardianState[] {
  return guardians.guardians.map(g => [
    g.id,
    g.damageLevel,
    g.rangeLevel,
    Math.round(g.totalDamageDealt),
    g.totalKills,
    g.shotsFired
  ]);
}

export function applyGuardianStates(guardians: PortalGuardianManager, states: GuardianState[]) {
  for (const [id, dmgLvl, rangeLvl, dealt, kills, shots] of states) {
    guardians.getGuardian(id)?.applyNetworkState(dmgLvl, rangeLvl, dealt, kills, shots);
  }
}

// --- Castles ---

export function encodeCastle(castle: ArenaCastle): CastleState {
  return [Math.ceil(castle.currentHp), Math.round(castle.maxHp), castle.isDestroyed ? 1 : 0];
}

export function applyCastleState(castle: ArenaCastle, state: CastleState) {
  castle.applyNetworkState(state[0], state[1], state[2] === 1);
}
