/**
 * TechTree: Persistent meta-progression across the Campaign mode.
 * Stars earned in missions are spent here to boost stats permanently.
 *
 * Balance anchor: one star ≈ +30 starting gold (Masonry Mastery). Every other rank is tuned to be
 * worth roughly the same, and the whole tree costs about twice the stars the campaign awards,
 * so players have to pick a direction.
 */

export type TechBranch = 'ECONOMY' | 'ARMY' | 'DEFENSE';

export const TECH_BRANCHES: { id: TechBranch; label: string }[] = [
  { id: 'ECONOMY', label: '💰 Economy' },
  { id: 'ARMY', label: '⚔️ Army' },
  { id: 'DEFENSE', label: '🏰 Defense' }
];

export interface TechUpgrade {
  id: string;
  branch: TechBranch;
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

// Per-rank effect sizes
const MASONRY_GOLD = 30;
const TAX_GOLD_PER_WAVE = 3;
const RECRUITER_DISCOUNT = 0.08;
const WARRIOR_HP_PERCENT = 0.1;
const WARRIOR_ARMOR = 4;
const DRILLS_ATTACK = 2;
const LEVY_RECRUITS = 1;
const PEDIGREE_BONUS = 0.05;
const WALLS_HP = 150;
const MORTAR_REPAIR = 20;
const BALLISTA_LEVELS = 1;

type TechDef = Omit<TechUpgrade, 'currentLevel'>;

const TECH_DEFS: TechDef[] = [
  // Economy
  { id: 'masonry', branch: 'ECONOMY', name: 'Masonry Mastery', description: `+${MASONRY_GOLD} Starting Gold per rank.`, maxLevel: 4, costPerLevel: 1 },
  { id: 'taxes', branch: 'ECONOMY', name: 'Royal Taxes', description: `+${TAX_GOLD_PER_WAVE} Gold for every cleared wave per rank.`, maxLevel: 3, costPerLevel: 1 },
  { id: 'recruiter', branch: 'ECONOMY', name: "Recruiter's Guild", description: `Hiring extra recruits costs ${RECRUITER_DISCOUNT * 100}% less per rank.`, maxLevel: 3, costPerLevel: 1 },
  // Army
  { id: 'warrior', branch: 'ARMY', name: 'Warrior Heritage', description: `+${WARRIOR_HP_PERCENT * 100}% max HP and +${WARRIOR_ARMOR} base Armor for recruits per rank.`, maxLevel: 3, costPerLevel: 1 },
  { id: 'drills', branch: 'ARMY', name: 'Weapon Drills', description: `+${DRILLS_ATTACK} base Attack for recruits per rank.`, maxLevel: 3, costPerLevel: 1 },
  { id: 'levy', branch: 'ARMY', name: 'Militia Levy', description: `+${LEVY_RECRUITS} free recruit in every wave's army per rank (does not raise the hiring price).`, maxLevel: 2, costPerLevel: 2 },
  { id: 'pedigree', branch: 'ARMY', name: "Champion's Pedigree", description: `Evolved champions gain +${PEDIGREE_BONUS * 100}% max HP and Attack per rank.`, maxLevel: 3, costPerLevel: 1 },
  // Defense
  { id: 'walls', branch: 'DEFENSE', name: 'Stonewright Walls', description: `+${WALLS_HP} Castle max HP per rank.`, maxLevel: 3, costPerLevel: 1 },
  { id: 'mortar', branch: 'DEFENSE', name: 'Mending Mortar', description: `The Castle repairs ${MORTAR_REPAIR} HP after every cleared wave per rank.`, maxLevel: 3, costPerLevel: 1 },
  { id: 'ballista', branch: 'DEFENSE', name: 'Ballista Drills', description: `Portal Guardians start ${BALLISTA_LEVELS} Damage level higher per rank.`, maxLevel: 2, costPerLevel: 1 }
];

export class TechTreeManager {
  public upgrades: Record<string, TechUpgrade> = Object.fromEntries(
    TECH_DEFS.map(def => [def.id, { ...def, currentLevel: 0 }])
  );

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

  private rank(techId: string): number {
    return this.upgrades[techId]?.currentLevel ?? 0;
  }

  getBonusStartingGold(): number {
    return this.rank('masonry') * MASONRY_GOLD;
  }

  getBonusWaveGold(): number {
    return this.rank('taxes') * TAX_GOLD_PER_WAVE;
  }

  /** Multiplier applied to the price of hiring an extra recruit. */
  getRecruitCostMultiplier(): number {
    return 1 - this.rank('recruiter') * RECRUITER_DISCOUNT;
  }

  /** Fractional max HP bonus for recruits (carries over when they evolve into champions). */
  getBonusRecruitHpPercent(): number {
    return this.rank('warrior') * WARRIOR_HP_PERCENT;
  }

  getBonusRecruitArmor(): number {
    return this.rank('warrior') * WARRIOR_ARMOR;
  }

  getBonusRecruitAttack(): number {
    return this.rank('drills') * DRILLS_ATTACK;
  }

  getBonusFreeRecruits(): number {
    return this.rank('levy') * LEVY_RECRUITS;
  }

  /** Fractional max HP and Attack bonus for freshly evolved champions. */
  getChampionBonus(): number {
    return this.rank('pedigree') * PEDIGREE_BONUS;
  }

  getBonusCastleHp(): number {
    return this.rank('walls') * WALLS_HP;
  }

  getCastleRepairPerWave(): number {
    return this.rank('mortar') * MORTAR_REPAIR;
  }

  getBonusGuardianLevels(): number {
    return this.rank('ballista') * BALLISTA_LEVELS;
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
