import { EnemyClass, ENEMY_UNIT_STATS, UnitTier } from '../units/UnitData';
import type { WaveDef } from './CampaignData';

/**
 * Builds a mission's 25 waves from its enemy roster. Each wave gets a threat budget (the smoothed
 * curve of Mission 1, scaled per mission) and spends it on a few battalions of unlocked enemies.
 * Deterministic: the same spec always yields the same waves, so co-op peers agree.
 */

export interface RosterEntry {
  enemyClass: EnemyClass;
  /** First wave (1-based) this enemy can appear in; it always appears in that wave. */
  from: number;
  /** Last wave it can appear in (default: 25). */
  to?: number;
  /** Relative share of a wave's budget when picked. */
  weight: number;
}

export interface WaveGenSpec {
  roster: RosterEntry[];
  boss: EnemyClass;
  /** Multiplies every wave's threat budget. */
  budgetMult: number;
  /** Multiplies the wave-clear gold of Mission 1's curve. */
  rewardMult: number;
  seed: number;
}

export const WAVE_COUNT = 25;

/** Threat budget per wave (T1 = 1, T2 = 2.5, T3 = 7), smoothed from Mission 1's hand-made waves. */
const BASE_BUDGET = [2, 4, 8, 12, 16, 21, 28, 45, 62, 80, 92, 105, 115, 128, 142, 152, 164, 175, 190, 204, 212, 225, 235, 250, 200];
/** Mission 1's wave-clear gold. */
const BASE_REWARD = [50, 55, 65, 75, 90, 80, 90, 105, 120, 150, 150, 170, 185, 210, 240, 250, 275, 300, 320, 360, 380, 410, 440, 490, 650];

const MAX_ENEMIES_PER_WAVE = 60;
const MAX_PER_SWARM_GROUP = 18;
const MAX_PER_BATTALION = 30;
/** Battalions trimmed below this size by the unit cap are dropped instead. */
const MIN_BATTALION = 4;

function threatCost(enemyClass: EnemyClass): number {
  const tier = ENEMY_UNIT_STATS[enemyClass].tier;
  return tier === UnitTier.TIER_3 ? 7 : tier === UnitTier.TIER_2 ? 2.5 : 1;
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(entries: RosterEntry[], rand: () => number): RosterEntry {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = rand() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return entries[entries.length - 1];
}

/** Fills a budget with battalions of the given roster entries (weight-proportional shares). */
function fillBudget(picked: RosterEntry[], budget: number, maxEnemies: number): Map<EnemyClass, number> {
  const counts = new Map<EnemyClass, number>();
  const totalWeight = picked.reduce((sum, e) => sum + e.weight, 0);
  let spent = 0;
  for (const e of picked) {
    const cost = threatCost(e.enemyClass);
    let count = Math.max(1, Math.round((budget * e.weight / totalWeight) / cost));
    count = Math.min(count, cost === 1 ? MAX_PER_SWARM_GROUP : MAX_PER_BATTALION);
    counts.set(e.enemyClass, count);
    spent += count * cost;
  }
  // Spend what the swarm cap left over on the heaviest battalion
  const heaviest = picked.reduce((a, b) => (threatCost(a.enemyClass) >= threatCost(b.enemyClass) ? a : b));
  const extra = Math.floor((budget - spent) / threatCost(heaviest.enemyClass));
  if (extra > 0) counts.set(heaviest.enemyClass, Math.min(MAX_PER_BATTALION, counts.get(heaviest.enemyClass)! + extra));

  // Respect the unit cap by trimming the cheapest battalions first (dropping any left as a straggler)
  let total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const byCost = [...picked].sort((a, b) => threatCost(a.enemyClass) - threatCost(b.enemyClass));
  for (const e of byCost) {
    if (total <= maxEnemies || counts.size === 1) break;
    const c = counts.get(e.enemyClass)!;
    const left = c - Math.min(c, total - maxEnemies);
    if (left < MIN_BATTALION) {
      counts.delete(e.enemyClass);
      total -= c;
    } else {
      counts.set(e.enemyClass, left);
      total -= c - left;
    }
  }
  return counts;
}

/** Front line first: melee before ranged, heavies at the very front. */
function formationOrder(a: EnemyClass, b: EnemyClass): number {
  const sa = ENEMY_UNIT_STATS[a];
  const sb = ENEMY_UNIT_STATS[b];
  const rangedA = sa.range > 2 ? 1 : 0;
  const rangedB = sb.range > 2 ? 1 : 0;
  return rangedA - rangedB || threatCost(b) - threatCost(a);
}

export function generateWaves(spec: WaveGenSpec): WaveDef[] {
  const rand = rng(spec.seed);
  const waves: WaveDef[] = [];

  for (let w = 1; w <= WAVE_COUNT; w++) {
    const isBossWave = w === WAVE_COUNT;
    const budget = BASE_BUDGET[w - 1] * spec.budgetMult;
    const available = spec.roster.filter(e => w >= e.from && w <= (e.to ?? WAVE_COUNT));

    // A newly unlocked enemy always debuts; the rest of the battalions are drawn by weight
    const groupCount = Math.min(available.length, w < 3 ? 1 : w < 8 ? 2 : 3);
    const picked: RosterEntry[] = available.filter(e => e.from === w).slice(0, groupCount);
    while (picked.length < groupCount) {
      picked.push(pickWeighted(available.filter(e => !picked.includes(e)), rand));
    }

    const counts = fillBudget(picked, budget, MAX_ENEMIES_PER_WAVE - (isBossWave ? 1 : 0));
    const enemies = Array.from(counts.entries())
      .sort(([a], [b]) => formationOrder(a, b))
      .map(([enemyClass, count]) => ({ enemyClass, count, delayBetween: 0.5 }));
    if (isBossWave) enemies.unshift({ enemyClass: spec.boss, count: 1, delayBetween: 2.5 });

    waves.push({
      waveNumber: w,
      enemies,
      rewardGold: Math.round((BASE_REWARD[w - 1] * spec.rewardMult) / 5) * 5
    });
  }
  return waves;
}
