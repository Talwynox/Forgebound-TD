/**
 * TechTree: Persistent meta-progression across the Campaign mode.
 * Stars earned in missions are spent here to boost stats permanently.
 */

export interface TechUpgrade {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number; // in campaign stars
  currentLevel: number;
}

export interface SaveData {
  missionStars: Record<number, number>; // missionId -> 1..3 stars
  techLevels: Record<string, number>;
}

const STORAGE_KEY = 'forgebound_td_campaign_save_v1';
const LEGACY_STORAGE_KEY = 'pyro_td_campaign_save_v1';

export class TechTreeManager {
  public upgrades: Record<string, TechUpgrade> = {
    masonry: {
      id: 'masonry',
      name: 'Masonry Mastery',
      description: '+30 Starting Gold per rank.',
      maxLevel: 4,
      costPerLevel: 1,
      currentLevel: 0
    },
    arcane: {
      id: 'arcane',
      name: 'Arcane Potency',
      description: '+15% Tower buff potency (healing, armor, attack).',
      maxLevel: 3,
      costPerLevel: 2,
      currentLevel: 0
    },
    engineering: {
      id: 'engineering',
      name: 'Engineering Guild',
      description: '-15% Tower upgrade gold costs.',
      maxLevel: 2,
      costPerLevel: 2,
      currentLevel: 0
    },
    warrior: {
      id: 'warrior',
      name: 'Warrior Heritage',
      description: '+30 starting HP and +4 base Armor for recruits.',
      maxLevel: 3,
      costPerLevel: 1,
      currentLevel: 0
    },
    auraAmp: {
      id: 'auraAmp',
      name: 'Aura Amplification',
      description: '+25% Aura Tower radius and effect strength.',
      maxLevel: 2,
      costPerLevel: 2,
      currentLevel: 0
    }
  };

  public missionStars: Record<number, number> = {};

  constructor() {
    this.load();
  }

  getTotalStarsEarned(): number {
    return Object.values(this.missionStars).reduce((sum, s) => sum + s, 0);
  }

  getStarsSpent(): number {
    return Object.values(this.upgrades).reduce(
      (sum, u) => sum + u.currentLevel * u.costPerLevel,
      0
    );
  }

  getAvailableStars(): number {
    return this.getTotalStarsEarned() - this.getStarsSpent();
  }

  upgrade(techId: string): boolean {
    const tech = this.upgrades[techId];
    if (!tech) return false;
    if (tech.currentLevel >= tech.maxLevel) return false;
    if (this.getAvailableStars() < tech.costPerLevel) return false;

    tech.currentLevel++;
    this.save();
    return true;
  }

  respec() {
    for (const tech of Object.values(this.upgrades)) {
      tech.currentLevel = 0;
    }
    this.save();
  }

  recordMissionCompletion(missionId: number, stars: number) {
    const current = this.missionStars[missionId] || 0;
    if (stars > current) {
      this.missionStars[missionId] = stars;
      this.save();
    }
  }

  getBonusStartingGold(): number {
    return this.upgrades.masonry.currentLevel * 30;
  }

  getBuffPotencyMultiplier(): number {
    return 1 + this.upgrades.arcane.currentLevel * 0.15;
  }

  getUpgradeDiscountMultiplier(): number {
    return 1 - this.upgrades.engineering.currentLevel * 0.15;
  }

  getBonusRecruitHp(): number {
    return this.upgrades.warrior.currentLevel * 30;
  }

  getBonusRecruitArmor(): number {
    return this.upgrades.warrior.currentLevel * 4;
  }

  save() {
    try {
      const techLevels: Record<string, number> = {};
      for (const [id, tech] of Object.entries(this.upgrades)) {
        techLevels[id] = tech.currentLevel;
      }
      const data: SaveData = {
        missionStars: this.missionStars,
        techLevels
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save campaign data to localStorage', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const data: SaveData = JSON.parse(raw);
      if (data.missionStars) {
        this.missionStars = data.missionStars;
      }
      if (data.techLevels) {
        for (const [id, level] of Object.entries(data.techLevels)) {
          if (this.upgrades[id]) {
            this.upgrades[id].currentLevel = Math.min(this.upgrades[id].maxLevel, level);
          }
        }
      }
    } catch (e) {
      console.warn('Could not load campaign data from localStorage', e);
    }
  }
}

