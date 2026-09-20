/**
 * TowerData: Definitions, stats, costs, and branching upgrade data for all Pyro TD towers.
 */

export enum TowerType {
  SHRINE = 'SHRINE',
  FORGE = 'FORGE',
  OBELISK = 'OBELISK',
  AURA = 'AURA',
  FROST = 'FROST',
  RULEBREAKER = 'RULEBREAKER',
  GOLD = 'GOLD',
  EVOLUTION = 'EVOLUTION'
}

export enum UpgradeBranch {
  NONE = 'NONE',
  BRANCH_A = 'BRANCH_A', // Standard / Focused
  BRANCH_B = 'BRANCH_B'  // Slow Stacking / Synergistic
}

export interface TowerUpgradeDef {
  name: string;
  cost: number;
  description: string;
  badge: string; // e.g., 'Standard' or 'Slow Stacking'
  range: number;
  rate: number; // Attack/cast interval in seconds
  // Specific modifiers
  healAmount?: number;
  armorAmount?: number;
  attackAmount?: number;
  slowPercent?: number;
  slowDuration?: number;
  auraSpeedBonus?: number; // e.g. 0.50 for +50% cast speed
  fixedHp?: number;
  goldPerHit?: number;
  roundInterestPercent?: number;
  roundFlatGold?: number;
  // Slow Stacking bonuses (applied at end of round)
  stackingHpPerRound?: number;
  stackingArmorPerRound?: number;
  stackingAttackPerRound?: number;
  unlockTier3Evolution?: boolean;
  grantUnitPassive?: string;
}

export interface TowerDef {
  type: TowerType;
  name: string;
  cost: number;
  description: string;
  color: number;
  accentColor: number;
  range: number;
  rate: number; // Base attack/cast interval in seconds
  // Base effects
  healAmount?: number;
  armorAmount?: number;
  attackAmount?: number;
  slowPercent?: number;
  slowDuration?: number;
  auraSpeedBonus?: number;
  fixedHp?: number;
  goldPerHit?: number;
  roundInterestPercent?: number;
  // Upgrades
  branchA: TowerUpgradeDef;
  branchB: TowerUpgradeDef;
}

export const TOWER_DEFINITIONS: Record<TowerType, TowerDef> = {
  [TowerType.SHRINE]: {
    type: TowerType.SHRINE,
    name: 'Vitality Shrine',
    cost: 50,
    description: 'Heals friendly units as they pass by.',
    color: 0x22c55e, // Emerald Green
    accentColor: 0x86efac,
    range: 3.5,
    rate: 1.0,
    healAmount: 40,
    branchA: {
      name: 'Radiant Sanctuary',
      cost: 75,
      badge: 'Burst Heal',
      description: 'Massively increases instant healing per hit (+100 HP).',
      range: 4.0,
      rate: 0.85,
      healAmount: 100
    },
    branchB: {
      name: 'Lifebloom Grove',
      cost: 70,
      badge: 'Slow Stacking',
      description: 'Heals moderately (+30 HP) and gives stacking Lifebloom: +60 Max HP added to the unit at the end of the round!',
      range: 3.5,
      rate: 1.1,
      healAmount: 30,
      stackingHpPerRound: 60
    }
  },

  [TowerType.FORGE]: {
    type: TowerType.FORGE,
    name: 'Iron Forge',
    cost: 55,
    description: 'Forges armor plating on passing units, mitigating physical damage.',
    color: 0x64748b, // Slate Steel
    accentColor: 0x38bdf8,
    range: 3.2,
    rate: 1.2,
    armorAmount: 5,
    branchA: {
      name: 'Reinforced Anvil',
      cost: 80,
      badge: 'Heavy Plating',
      description: 'Instantly grants high flat armor per hit (+15 Armor).',
      range: 3.5,
      rate: 1.1,
      armorAmount: 15
    },
    branchB: {
      name: 'Tempered Bastion',
      cost: 75,
      badge: 'Slow Stacking',
      description: 'Grants +4 Armor on hit, and stacks Tempered steel: +10 bonus Armor added at the end of the round!',
      range: 3.2,
      rate: 1.3,
      armorAmount: 4,
      stackingArmorPerRound: 10
    }
  },

  [TowerType.OBELISK]: {
    type: TowerType.OBELISK,
    name: 'Flame Obelisk',
    cost: 60,
    description: 'Infuses weapons with flame, increasing unit attack damage.',
    color: 0xf97316, // Fire Orange
    accentColor: 0xfde047,
    range: 3.5,
    rate: 1.1,
    attackAmount: 8,
    branchA: {
      name: 'War Pillar',
      cost: 85,
      badge: 'High Impact',
      description: 'Increases unit attack damage significantly (+22 Attack).',
      range: 3.8,
      rate: 1.0,
      attackAmount: 22
    },
    branchB: {
      name: 'Frenzy Monolith',
      cost: 80,
      badge: 'Slow Stacking',
      description: 'Grants +5 Attack on hit, plus Frenzy stacks: +14 bonus Attack added at the end of the round!',
      range: 3.5,
      rate: 1.2,
      attackAmount: 5,
      stackingAttackPerRound: 14
    }
  },

  [TowerType.AURA]: {
    type: TowerType.AURA,
    name: 'Aura Spire',
    cost: 80,
    description: 'Emits a haste field that increases the attack/cast speed of all towers in range.',
    color: 0xa855f7, // Arcane Purple
    accentColor: 0xf472b6,
    range: 4.2,
    rate: 2.0,
    auraSpeedBonus: 0.35, // +35% cast speed to nearby towers
    branchA: {
      name: 'Clockwork Overdrive',
      cost: 110,
      badge: 'Hyper-Haste',
      description: 'Concentrated aura providing +80% attack speed to adjacent towers!',
      range: 3.2,
      rate: 2.0,
      auraSpeedBonus: 0.80
    },
    branchB: {
      name: 'Expansive Resonance',
      cost: 100,
      badge: 'Wide Field',
      description: 'Broadened aura zone (range 6.5) boosting all towers in a wide area by +45% attack speed.',
      range: 6.5,
      rate: 2.0,
      auraSpeedBonus: 0.45
    }
  },

  [TowerType.FROST]: {
    type: TowerType.FROST,
    name: 'Frost Monolith',
    cost: 65,
    description: 'Chills passing friendly units to slow movement, keeping them in the maze longer for more buffs!',
    color: 0x06b6d4, // Cyan Ice
    accentColor: 0xa5f3fc,
    range: 3.8,
    rate: 1.4,
    slowPercent: 0.40, // 40% slow
    slowDuration: 3.2,
    branchA: {
      name: 'Deep Freeze',
      cost: 90,
      badge: 'Maximum Dwell',
      description: 'Super-chills units with a 70% slow for 4.5s for extreme buff exposure.',
      range: 4.0,
      rate: 1.2,
      slowPercent: 0.70,
      slowDuration: 4.5
    },
    branchB: {
      name: 'Blizzard Zone',
      cost: 85,
      badge: 'AoE Chill',
      description: 'Blizzard pulse that continuously keeps all passing units slowed by 50%.',
      range: 5.2,
      rate: 1.0,
      slowPercent: 0.50,
      slowDuration: 3.8
    }
  },

  [TowerType.RULEBREAKER]: {
    type: TowerType.RULEBREAKER,
    name: 'The Rulebreaker',
    cost: 120,
    description: 'Rewrites unit reality, directly setting passing unit HP to a fixed 500 HP.',
    color: 0xe11d48, // Crimson Arcane
    accentColor: 0xf43f5e,
    range: 3.0,
    rate: 1.5,
    fixedHp: 500,
    branchA: {
      name: 'Titan Core',
      cost: 150,
      badge: 'Massive HP',
      description: 'Sets passing unit HP directly to 1,200 HP! Instantly primes units for colossal Tier 3 evolutions.',
      range: 3.2,
      rate: 1.4,
      fixedHp: 1200
    },
    branchB: {
      name: 'Equalizer Core',
      cost: 130,
      badge: 'HP + Armor',
      description: 'Sets unit HP to 750 HP and permanently grants +20 Armor.',
      range: 3.0,
      rate: 1.4,
      fixedHp: 750,
      armorAmount: 20
    }
  },

  [TowerType.GOLD]: {
    type: TowerType.GOLD,
    name: 'Gold Spire',
    cost: 70,
    description: 'Generates extra gold to fuel your defensive economy.',
    color: 0xeab308, // Gold
    accentColor: 0xfef08a,
    range: 3.5,
    rate: 1.2,
    goldPerHit: 4,
    branchA: {
      name: 'Midas Siphon',
      cost: 95,
      badge: 'Gold on Hit',
      description: 'Generates +12 Gold every time it hits a passing unit!',
      range: 3.8,
      rate: 0.95,
      goldPerHit: 12
    },
    branchB: {
      name: 'Vault Reserve',
      cost: 90,
      badge: 'Round Interest',
      description: 'Generates +2 Gold on hit, plus pays out +18% bonus interest (min 50g) at the end of each round!',
      range: 3.2,
      rate: 1.3,
      goldPerHit: 2,
      roundInterestPercent: 0.18,
      roundFlatGold: 50
    }
  },

  [TowerType.EVOLUTION]: {
    type: TowerType.EVOLUTION,
    name: 'Evolution Spire',
    cost: 130,
    description: 'Ascends qualified units into higher combat classes (Footman -> Knight/Berserker/Cleric).',
    color: 0x8b5cf6, // Violet
    accentColor: 0xc4b5fd,
    range: 3.0,
    rate: 1.6,
    branchA: {
      name: 'Heroic Spire',
      cost: 160,
      badge: 'Tier 3 Unlocked',
      description: 'Enables Tier 3 ascensions into Paladin, Archmage, and Pyro Golem when units have 600+ HP or high stats!',
      range: 3.5,
      rate: 1.4,
      unlockTier3Evolution: true
    },
    branchB: {
      name: 'Specialist Spire',
      cost: 140,
      badge: 'Passive Auras',
      description: 'Grants evolved units combat passives: Divine Shield, Whirlwind Cleave, and Fireball bursts!',
      range: 3.2,
      rate: 1.5,
      grantUnitPassive: 'HEROIC_AURA'
    }
  }
};
