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
  goblinKills: number;
  orcKills: number;
  skeletonKills: number;
  assassinKills: number;
  ogreKills: number;
  bossKills: number;
  maxedTowers: string[]; // TowerType strings
  championsEvolved: number;
  flawlessWaves: number;
  campaignStars: number;
  unlockedTiers: Record<string, number>; // achievementId -> highest tier unlocked (1..4)
}

export class AchievementManager {
  public stats: PlayerStats = {
    lifetimeGoldEarned: 0,
    goblinKills: 0,
    orcKills: 0,
    skeletonKills: 0,
    assassinKills: 0,
    ogreKills: 0,
    bossKills: 0,
    maxedTowers: [],
    championsEvolved: 0,
    flawlessWaves: 0,
    campaignStars: 0,
    unlockedTiers: {}
  };

  public onAchievementUnlocked: (achievement: AchievementDef, tierDef: AchievementTierDef) => void = () => {};

  constructor() {
    this.load();
  }

  public recordGold(amount: number) {
    if (amount <= 0) return;
    this.stats.lifetimeGoldEarned += amount;
    this.checkThresholds();
    this.save();
  }

  public recordKill(enemyClass: EnemyClass | string, isBoss: boolean = false) {
    if (isBoss || enemyClass === EnemyClass.BOSS_LORD_IGNIS) {
      this.stats.bossKills++;
    }

    switch (enemyClass) {
      case EnemyClass.GOBLIN:
        this.stats.goblinKills++;
        break;
      case EnemyClass.ORC_WARRIOR:
        this.stats.orcKills++;
        break;
      case EnemyClass.SKELETON_ARCHER:
        this.stats.skeletonKills++;
        break;
      case EnemyClass.SHADOW_ASSASSIN:
        this.stats.assassinKills++;
        break;
      case EnemyClass.IRONCLAD_OGRE:
        this.stats.ogreKills++;
        break;
    }

    this.checkThresholds();
    this.save();
  }

  public recordTowerMaxed(towerType: TowerType | string) {
    const typeStr = String(towerType);
    if (!this.stats.maxedTowers.includes(typeStr)) {
      this.stats.maxedTowers.push(typeStr);
      this.checkThresholds();
      this.save();
    }
  }

  public recordChampionEvolved() {
    this.stats.championsEvolved++;
    this.checkThresholds();
    this.save();
  }

  public recordFlawlessWave() {
    this.stats.flawlessWaves++;
    this.checkThresholds();
    this.save();
  }

  public recordCampaignStars(totalStars: number) {
    if (totalStars > this.stats.campaignStars) {
      this.stats.campaignStars = totalStars;
      this.checkThresholds();
      this.save();
    }
  }

  public getMetricValue(metric: string): number {
    switch (metric) {
      case 'lifetimeGoldEarned':
        return this.stats.lifetimeGoldEarned;
      case 'goblinKills':
        return this.stats.goblinKills;
      case 'orcKills':
        return this.stats.orcKills;
      case 'skeletonKills':
        return this.stats.skeletonKills;
      case 'assassinKills':
        return this.stats.assassinKills;
      case 'ogreKills':
        return this.stats.ogreKills;
      case 'bossKills':
        return this.stats.bossKills;
      case 'uniqueTowersMaxed':
        return this.stats.maxedTowers.length;
      case 'championsEvolved':
        return this.stats.championsEvolved;
      case 'flawlessWaves':
        return this.stats.flawlessWaves;
      case 'campaignStars':
        return this.stats.campaignStars;
      default:
        return 0;
    }
  }

  public getUnlockedTier(achievementId: string): number {
    return this.stats.unlockedTiers[achievementId] || 0;
  }

  public getTotalTrophiesEarned(): { unlocked: number; total: number } {
    let unlocked = 0;
    let total = 0;

    for (const ach of ACHIEVEMENTS) {
      total += ach.tiers.length;
      unlocked += (this.stats.unlockedTiers[ach.id] || 0);
    }

    return { unlocked, total };
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
      if (data) {
        this.stats = {
          lifetimeGoldEarned: data.lifetimeGoldEarned ?? 0,
          goblinKills: data.goblinKills ?? 0,
          orcKills: data.orcKills ?? 0,
          skeletonKills: data.skeletonKills ?? 0,
          assassinKills: data.assassinKills ?? 0,
          ogreKills: data.ogreKills ?? 0,
          bossKills: data.bossKills ?? 0,
          maxedTowers: Array.isArray(data.maxedTowers) ? data.maxedTowers : [],
          championsEvolved: data.championsEvolved ?? 0,
          flawlessWaves: data.flawlessWaves ?? 0,
          campaignStars: data.campaignStars ?? 0,
          unlockedTiers: data.unlockedTiers ?? {}
        };
      }
    } catch (e) {
      console.warn('Could not load achievements from localStorage', e);
    }
  }
}

