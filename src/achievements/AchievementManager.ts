/**
 * AchievementManager: Tracks persistent player statistics, monitors milestones,
 * and manages unlocks with localStorage persistence.
 */

import { ACHIEVEMENTS, AchievementDef, AchievementTierDef } from './AchievementData';
import { EnemyClass } from '../units/UnitData';
import { TowerType } from '../towers/TowerData';

const STORAGE_KEY = 'pyro_td_achievements_v1';

export interface PlayerStats {
  lifetimeGoldEarned: number;
  totalKills: number;
  goblinKills: number;
  orcKills: number;
  skeletonKills: number;
  assassinKills: number;
  ogreKills: number;
  ironforgeKills: number;
  canyonKills: number;
  riftKills: number;
  infernalKills: number;
  bossKills: number;
  escalatedClashesWon: number;
  maxedTowers: string[]; // TowerType strings
  towersBuilt: number;
  recruitsHired: number;
  championsEvolved: number;
  flawlessWaves: number;
  wavesCleared: number;
  missionsWon: number;
  campaignStars: number;
  multiplayerWins: number;
  unlockedTiers: Record<string, number>; // achievementId -> highest tier unlocked (1..5)
}

/** PlayerStats fields that are plain counters (everything except the tower list and unlock map). */
type CounterStat = { [K in keyof PlayerStats]: PlayerStats[K] extends number ? K : never }[keyof PlayerStats];

/** Which counter each enemy class adds to besides totalKills (bosses count via bossKills). */
const KILL_COUNTERS: Partial<Record<EnemyClass, CounterStat>> = {
  [EnemyClass.GOBLIN]: 'goblinKills',
  [EnemyClass.ORC_WARRIOR]: 'orcKills',
  [EnemyClass.SKELETON_ARCHER]: 'skeletonKills',
  [EnemyClass.SHADOW_ASSASSIN]: 'assassinKills',
  [EnemyClass.IRONCLAD_OGRE]: 'ogreKills',
  [EnemyClass.FORGE_BOMBER]: 'ironforgeKills',
  [EnemyClass.IRON_AUTOMATON]: 'ironforgeKills',
  [EnemyClass.IRON_ARBALIST]: 'ironforgeKills',
  [EnemyClass.ROCK_TROLL]: 'ironforgeKills',
  [EnemyClass.SCARAB_SWARMER]: 'canyonKills',
  [EnemyClass.SAND_RAIDER]: 'canyonKills',
  [EnemyClass.DUNE_SLINGER]: 'canyonKills',
  [EnemyClass.TOMB_GUARDIAN]: 'canyonKills',
  [EnemyClass.VOID_WISP]: 'riftKills',
  [EnemyClass.RIFT_STALKER]: 'riftKills',
  [EnemyClass.SPELLBREAKER]: 'riftKills',
  [EnemyClass.ARCANE_CONSTRUCT]: 'riftKills',
  [EnemyClass.IMP]: 'infernalKills',
  [EnemyClass.HELLHOUND]: 'infernalKills',
  [EnemyClass.FIRE_CULTIST]: 'infernalKills',
  [EnemyClass.DEMON_BRUTE]: 'infernalKills'
};

const freshStats = (): PlayerStats => ({
  lifetimeGoldEarned: 0,
  totalKills: 0,
  goblinKills: 0,
  orcKills: 0,
  skeletonKills: 0,
  assassinKills: 0,
  ogreKills: 0,
  ironforgeKills: 0,
  canyonKills: 0,
  riftKills: 0,
  infernalKills: 0,
  bossKills: 0,
  escalatedClashesWon: 0,
  maxedTowers: [],
  towersBuilt: 0,
  recruitsHired: 0,
  championsEvolved: 0,
  flawlessWaves: 0,
  wavesCleared: 0,
  missionsWon: 0,
  campaignStars: 0,
  multiplayerWins: 0,
  unlockedTiers: {}
});

export class AchievementManager {
  public stats: PlayerStats = freshStats();

  public onAchievementUnlocked: (achievement: AchievementDef, tierDef: AchievementTierDef) => void = () => {};

  constructor() {
    this.load();
    // Silently grant tiers added since the save was written (e.g. new Platinum/Legendary tiers already earned)
    this.checkThresholds();
    this.save();
  }

  public recordGold(amount: number) {
    if (amount <= 0) return;
    this.stats.lifetimeGoldEarned += amount;
    this.commit();
  }

  public recordKill(enemyClass: EnemyClass | string, isBoss: boolean = false) {
    this.stats.totalKills++;
    if (isBoss) {
      this.stats.bossKills++;
    }
    const counter = KILL_COUNTERS[enemyClass as EnemyClass];
    if (counter) this.stats[counter]++;
    this.commit();
  }

  public recordTowerMaxed(towerType: TowerType | string) {
    const typeStr = String(towerType);
    if (!this.stats.maxedTowers.includes(typeStr)) {
      this.stats.maxedTowers.push(typeStr);
      this.commit();
    }
  }

  public recordTowerBuilt() {
    this.increment('towersBuilt');
  }

  public recordRecruitHired() {
    this.increment('recruitsHired');
  }

  public recordChampionEvolved() {
    this.increment('championsEvolved');
  }

  /** A PvE wave was cleared; flawless = the castle took no damage, escalated = the clash reached arena escalation. */
  public recordWaveCleared(flawless: boolean, escalated: boolean) {
    this.stats.wavesCleared++;
    if (flawless) this.stats.flawlessWaves++;
    if (escalated) this.stats.escalatedClashesWon++;
    this.commit();
  }

  public recordMissionWon() {
    this.increment('missionsWon');
  }

  public recordMultiplayerWin() {
    this.increment('multiplayerWins');
  }

  public recordCampaignStars(totalStars: number) {
    if (totalStars > this.stats.campaignStars) {
      this.stats.campaignStars = totalStars;
      this.commit();
    }
  }

  public getMetricValue(metric: string): number {
    if (metric === 'uniqueTowersMaxed') return this.stats.maxedTowers.length;
    const value = this.stats[metric as keyof PlayerStats];
    return typeof value === 'number' ? value : 0;
  }

  public getUnlockedTier(achievementId: string): number {
    return this.stats.unlockedTiers[achievementId] || 0;
  }

  public getTotalTrophiesEarned(): { unlocked: number; total: number } {
    let unlocked = 0;
    let total = 0;

    for (const ach of ACHIEVEMENTS) {
      total += ach.tiers.length;
      unlocked += Math.min(this.stats.unlockedTiers[ach.id] || 0, ach.tiers.length);
    }

    return { unlocked, total };
  }

  private increment(counter: CounterStat) {
    this.stats[counter]++;
    this.commit();
  }

  private commit() {
    this.checkThresholds();
    this.save();
  }

  private checkThresholds() {
    for (const ach of ACHIEVEMENTS) {
      const currentVal = this.getMetricValue(ach.metric);
      const currentTier = this.stats.unlockedTiers[ach.id] || 0;

      for (const tierDef of ach.tiers) {
        if (tierDef.tier > currentTier && currentVal >= tierDef.threshold) {
          this.stats.unlockedTiers[ach.id] = tierDef.tier;
          this.onAchievementUnlocked(ach, tierDef);
        }
      }
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch (e) {
      console.warn('Could not save achievements to localStorage', e);
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;

      const stats = freshStats();
      for (const key of Object.keys(stats) as (keyof PlayerStats)[]) {
        if (typeof stats[key] === 'number' && typeof data[key] === 'number') {
          (stats[key] as number) = data[key];
        }
      }
      stats.maxedTowers = Array.isArray(data.maxedTowers) ? data.maxedTowers : [];
      stats.unlockedTiers = data.unlockedTiers && typeof data.unlockedTiers === 'object' ? data.unlockedTiers : {};
      // Older saves never tracked a total: seed it from the per-type kill counts they did keep
      if (typeof data.totalKills !== 'number') {
        stats.totalKills = stats.goblinKills + stats.orcKills + stats.skeletonKills + stats.assassinKills + stats.ogreKills + stats.bossKills;
      }
      this.stats = stats;
    } catch (e) {
      console.warn('Could not load achievements from localStorage', e);
    }
  }
}
