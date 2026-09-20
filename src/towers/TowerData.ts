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
  badge: string; // e.g., 'Burst Heal' or 'Slow Stacking'
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
  // Branching Upgrades (3 ranks per branch)
  branchA: TowerUpgradeDef[];
  branchB: TowerUpgradeDef[];
}

export interface EvoAbilityTier {
  level: number;
  cost: number;
  name: string;
  description: string;
  bonus?: number; // Armor aura bonus or damage aura bonus
  chance?: number; // Crit chance or multishot chance
  multiplier?: number; // Crit multiplier
  targets?: number; // Multishot target count
}

export const SOLDIER_ABILITIES = {
  armorAura: [
    { level: 1, cost: 40, name: 'Armor Aura I', description: 'Radiates +6 Armor to all surrounding allies in combat.', bonus: 6 },
    { level: 2, cost: 75, name: 'Armor Aura II', description: 'Radiates +12 Armor to all surrounding allies in combat.', bonus: 12 },
    { level: 3, cost: 120, name: 'Armor Aura III', description: 'Radiates +20 Armor to all surrounding allies in combat.', bonus: 20 }
  ] as EvoAbilityTier[],
  crit: [
    { level: 1, cost: 40, name: 'Critical Strike I', description: '25% chance to deal 2.0x Critical Strike damage.', chance: 0.25, multiplier: 2.0 },
    { level: 2, cost: 75, name: 'Critical Strike II', description: '35% chance to deal 2.5x Critical Strike damage.', chance: 0.35, multiplier: 2.5 },
    { level: 3, cost: 120, name: 'Critical Strike III', description: '50% chance to deal 3.0x Critical Strike damage.', chance: 0.50, multiplier: 3.0 }
  ] as EvoAbilityTier[]
};

export const ARCHER_ABILITIES = {
  multishot: [
    { level: 1, cost: 40, name: 'Multishot I', description: '30% chance to fire arrows at 2 targets simultaneously.', chance: 0.30, targets: 2 },
    { level: 2, cost: 75, name: 'Multishot II', description: '50% chance to fire arrows at 3 targets simultaneously.', chance: 0.50, targets: 3 },
    { level: 3, cost: 120, name: 'Multishot III', description: '75% chance to fire arrows at 4 targets simultaneously.', chance: 0.75, targets: 4 }
  ] as EvoAbilityTier[],
  damageAura: [
    { level: 1, cost: 40, name: 'Damage Aura I', description: 'Radiates +6 Attack to all surrounding allies in combat.', bonus: 6 },
    { level: 2, cost: 75, name: 'Damage Aura II', description: 'Radiates +14 Attack to all surrounding allies in combat.', bonus: 14 },
    { level: 3, cost: 120, name: 'Damage Aura III', description: 'Radiates +24 Attack to all surrounding allies in combat.', bonus: 24 }
  ] as EvoAbilityTier[]
};

export const TOWER_DEFINITIONS: Record<TowerType, TowerDef> = {
  [TowerType.SHRINE]: {
    type: TowerType.SHRINE,
    name: 'Vitality Shrine',
    cost: 10,
    description: 'Heals friendly units (+1 HP) as they pass by.',
    color: 0x22c55e, // Emerald Green
    accentColor: 0x86efac,
    range: 3.5,
    rate: 1.0,
    healAmount: 1,
    branchA: [
      {
        name: 'Radiant Sanctuary I',
        cost: 25,
        badge: 'Burst Heal',
        description: 'Increases instant healing to +4 HP per hit.',
        range: 3.8,
        rate: 0.9,
        healAmount: 4
      },
      {
        name: 'Radiant Sanctuary II',
        cost: 55,
        badge: 'Burst Heal',
        description: 'Increases instant healing to +12 HP per hit.',
        range: 4.0,
        rate: 0.8,
        healAmount: 12
      },
      {
        name: 'Radiant Sanctuary III - Divine Font',
        cost: 95,
        badge: 'Burst Heal',
        description: 'Master healing font: massive +30 HP burst healing per hit.',
        range: 4.2,
        rate: 0.7,
        healAmount: 30
      }
    ],
    branchB: [
      {
        name: 'Lifebloom Grove I',
        cost: 20,
        badge: 'Slow Stacking',
        description: 'Heals +2 HP on hit, grants Lifebloom: +5 Max HP round bonus per stack.',
        range: 3.5,
        rate: 1.0,
        healAmount: 2,
        stackingHpPerRound: 5
      },
      {
        name: 'Lifebloom Grove II',
        cost: 45,
        badge: 'Slow Stacking',
        description: 'Heals +4 HP on hit, grants Lifebloom: +12 Max HP round bonus per stack.',
        range: 3.6,
        rate: 1.0,
        healAmount: 4,
        stackingHpPerRound: 12
      },
      {
        name: 'Lifebloom Grove III - Yggdrasil',
        cost: 85,
        badge: 'Slow Stacking',
        description: 'Elder Grove: heals +8 HP on hit, +25 Max HP round bonus per stack.',
        range: 3.8,
        rate: 0.95,
        healAmount: 8,
        stackingHpPerRound: 25
      }
    ]
  },

  [TowerType.FORGE]: {
    type: TowerType.FORGE,
    name: 'Iron Forge',
    cost: 20,
    description: 'Forges armor plating on passing units (+1 Armor), mitigating physical damage.',
    color: 0x64748b, // Slate Steel
    accentColor: 0x38bdf8,
    range: 3.2,
    rate: 1.2,
    armorAmount: 1,
    branchA: [
      {
        name: 'Reinforced Anvil I',
        cost: 30,
        badge: 'Heavy Plating',
        description: 'Forges +3 Armor per hit.',
        range: 3.4,
        rate: 1.1,
        armorAmount: 3
      },
      {
        name: 'Reinforced Anvil II',
        cost: 65,
        badge: 'Heavy Plating',
        description: 'Heavy forging: +7 Armor per hit.',
        range: 3.6,
        rate: 1.0,
        armorAmount: 7
      },
      {
        name: 'Reinforced Anvil III - Adamant Citadel',
        cost: 110,
        badge: 'Heavy Plating',
        description: 'Adamant plating: +15 Armor per hit.',
        range: 3.8,
        rate: 0.9,
        armorAmount: 15
      }
    ],
    branchB: [
      {
        name: 'Tempered Bastion I',
        cost: 25,
        badge: 'Slow Stacking',
        description: 'Grants +2 Armor on hit, +3 bonus Armor round end per stack.',
        range: 3.2,
        rate: 1.2,
        armorAmount: 2,
        stackingArmorPerRound: 3
      },
      {
        name: 'Tempered Bastion II',
        cost: 55,
        badge: 'Slow Stacking',
        description: 'Grants +3 Armor on hit, +7 bonus Armor round end per stack.',
        range: 3.4,
        rate: 1.1,
        armorAmount: 3,
        stackingArmorPerRound: 7
      },
      {
        name: 'Tempered Bastion III - Eternal Bulwark',
        cost: 95,
        badge: 'Slow Stacking',
        description: 'Eternal Bulwark: +5 Armor on hit, +15 bonus Armor round end per stack.',
        range: 3.6,
        rate: 1.0,
        armorAmount: 5,
        stackingArmorPerRound: 15
      }
    ]
  },

  [TowerType.OBELISK]: {
    type: TowerType.OBELISK,
    name: 'Flame Obelisk',
    cost: 20,
    description: 'Infuses weapons with flame, increasing unit attack damage (+1 Attack).',
    color: 0xf97316, // Fire Orange
    accentColor: 0xfde047,
    range: 3.5,
    rate: 1.1,
    attackAmount: 1,
    branchA: [
      {
        name: 'War Pillar I',
        cost: 30,
        badge: 'High Impact',
        description: 'Infuses +4 Attack damage per hit.',
        range: 3.6,
        rate: 1.0,
        attackAmount: 4
      },
      {
        name: 'War Pillar II',
        cost: 65,
        badge: 'High Impact',
        description: 'Blazing edge: +10 Attack damage per hit.',
        range: 3.8,
        rate: 0.9,
        attackAmount: 10
      },
      {
        name: 'War Pillar III - Inferno Monolith',
        cost: 115,
        badge: 'High Impact',
        description: 'Inferno Pillar: massive +22 Attack damage per hit.',
        range: 4.0,
        rate: 0.8,
        attackAmount: 22
      }
    ],
    branchB: [
      {
        name: 'Frenzy Monolith I',
        cost: 25,
        badge: 'Slow Stacking',
        description: 'Grants +2 Attack on hit, +3 bonus Attack round end per stack.',
        range: 3.5,
        rate: 1.1,
        attackAmount: 2,
        stackingAttackPerRound: 3
      },
      {
        name: 'Frenzy Monolith II',
        cost: 55,
        badge: 'Slow Stacking',
        description: 'Grants +3 Attack on hit, +7 bonus Attack round end per stack.',
        range: 3.6,
        rate: 1.05,
        attackAmount: 3,
        stackingAttackPerRound: 7
      },
      {
        name: 'Frenzy Monolith III - Bloodfire Core',
        cost: 95,
        badge: 'Slow Stacking',
        description: 'Bloodfire Core: +5 Attack on hit, +15 bonus Attack round end per stack.',
        range: 3.8,
        rate: 0.95,
        attackAmount: 5,
        stackingAttackPerRound: 15
      }
    ]
  },

  [TowerType.AURA]: {
    type: TowerType.AURA,
    name: 'Aura Spire',
    cost: 50,
    description: 'Emits a haste field that increases the attack/cast speed of all towers in range (+35% haste).',
    color: 0xa855f7, // Arcane Purple
    accentColor: 0xf472b6,
    range: 4.2,
    rate: 2.0,
    auraSpeedBonus: 0.35, // +35% cast speed to nearby towers
    branchA: [
      {
        name: 'Clockwork Overdrive I',
        cost: 60,
        badge: 'Hyper-Haste',
        description: 'Concentrated aura providing +55% attack speed to nearby towers.',
        range: 3.4,
        rate: 2.0,
        auraSpeedBonus: 0.55
      },
      {
        name: 'Clockwork Overdrive II',
        cost: 100,
        badge: 'Hyper-Haste',
        description: 'Overcharged field: +80% attack speed to nearby towers.',
        range: 3.6,
        rate: 2.0,
        auraSpeedBonus: 0.80
      },
      {
        name: 'Clockwork Overdrive III - Temporal Singularity',
        cost: 160,
        badge: 'Hyper-Haste',
        description: 'Temporal Singularity: +120% attack speed to nearby towers!',
        range: 3.8,
        rate: 2.0,
        auraSpeedBonus: 1.20
      }
    ],
    branchB: [
      {
        name: 'Expansive Resonance I',
        cost: 55,
        badge: 'Wide Field',
        description: 'Broadened aura zone (range 5.5) boosting all towers by +40% attack speed.',
        range: 5.5,
        rate: 2.0,
        auraSpeedBonus: 0.40
      },
      {
        name: 'Expansive Resonance II',
        cost: 95,
        badge: 'Wide Field',
        description: 'Expansive pulse (range 6.8) boosting all towers by +50% attack speed.',
        range: 6.8,
        rate: 2.0,
        auraSpeedBonus: 0.50
      },
      {
        name: 'Expansive Resonance III - Harmonic Beacon',
        cost: 150,
        badge: 'Wide Field',
        description: 'Harmonic Beacon (range 8.2) boosting all towers across the island by +65% attack speed.',
        range: 8.2,
        rate: 2.0,
        auraSpeedBonus: 0.65
      }
    ]
  },

  [TowerType.FROST]: {
    type: TowerType.FROST,
    name: 'Frost Monolith',
    cost: 25,
    description: 'Chills passing friendly units (40% slow for 3.2s) to keep them in the maze longer for more buffs!',
    color: 0x06b6d4, // Cyan Ice
    accentColor: 0xa5f3fc,
    range: 3.8,
    rate: 1.4,
    slowPercent: 0.40, // 40% slow
    slowDuration: 3.2,
    branchA: [
      {
        name: 'Deep Freeze I',
        cost: 50,
        badge: 'Maximum Dwell',
        description: 'Chills units with a 55% slow for 3.8s for increased buff exposure.',
        range: 4.0,
        rate: 1.3,
        slowPercent: 0.55,
        slowDuration: 3.8
      },
      {
        name: 'Deep Freeze II',
        cost: 85,
        badge: 'Maximum Dwell',
        description: 'Super-chills units with a 70% slow for 4.5s for extreme buff exposure.',
        range: 4.2,
        rate: 1.2,
        slowPercent: 0.70,
        slowDuration: 4.5
      },
      {
        name: 'Deep Freeze III - Absolute Zero',
        cost: 130,
        badge: 'Maximum Dwell',
        description: 'Absolute Zero: 82% movement freeze for 5.5s!',
        range: 4.4,
        rate: 1.0,
        slowPercent: 0.82,
        slowDuration: 5.5
      }
    ],
    branchB: [
      {
        name: 'Blizzard Zone I',
        cost: 45,
        badge: 'AoE Chill',
        description: 'Pulsing blizzard zone (range 4.8) keeping units slowed by 45%.',
        range: 4.8,
        rate: 1.2,
        slowPercent: 0.45,
        slowDuration: 3.5
      },
      {
        name: 'Blizzard Zone II',
        cost: 80,
        badge: 'AoE Chill',
        description: 'Expanded blizzard (range 5.6) keeping units slowed by 55%.',
        range: 5.6,
        rate: 1.0,
        slowPercent: 0.55,
        slowDuration: 4.0
      },
      {
        name: 'Blizzard Zone III - Frostbite Tempest',
        cost: 125,
        badge: 'AoE Chill',
        description: 'Frostbite Tempest: broad 65% chilling tempest with rapid pulse (0.8s, range 6.5).',
        range: 6.5,
        rate: 0.8,
        slowPercent: 0.65,
        slowDuration: 4.5
      }
    ]
  },

  [TowerType.RULEBREAKER]: {
    type: TowerType.RULEBREAKER,
    name: 'The Rulebreaker',
    cost: 35,
    description: 'Rewrites unit reality, directly setting passing unit HP to a fixed 15 HP.',
    color: 0xe11d48, // Crimson Arcane
    accentColor: 0xf43f5e,
    range: 3.0,
    rate: 1.5,
    fixedHp: 15,
    branchA: [
      {
        name: 'Titan Core I',
        cost: 50,
        badge: 'Aggressive HP',
        description: 'Aggressive HP surge: directly sets passing unit HP to 75 HP (slow 1.5s cast rate).',
        range: 3.0,
        rate: 1.5,
        fixedHp: 75
      },
      {
        name: 'Titan Core II',
        cost: 100,
        badge: 'Aggressive HP',
        description: 'Titanic leap: directly sets passing unit HP to 160 HP (slow 1.5s cast rate).',
        range: 3.1,
        rate: 1.5,
        fixedHp: 160
      },
      {
        name: 'Titan Core III - Colossus Forge',
        cost: 175,
        badge: 'Aggressive HP',
        description: 'Colossus Forge: sets unit HP to 250 HP cap (slow 1.5s cast rate)! Primes units for Tier 3 ascensions.',
        range: 3.2,
        rate: 1.5,
        fixedHp: 250
      }
    ],
    branchB: [
      {
        name: 'Chrono Transmuter I',
        cost: 45,
        badge: 'Rapid Cast',
        description: 'Accelerated shift: sets unit HP to 40 HP with faster 1.20s cast rate.',
        range: 3.0,
        rate: 1.20,
        fixedHp: 40
      },
      {
        name: 'Chrono Transmuter II',
        cost: 75,
        badge: 'Rapid Cast',
        description: 'Rapid transmuter: sets unit HP to 80 HP with swift 0.95s cast rate.',
        range: 3.1,
        rate: 0.95,
        fixedHp: 80
      },
      {
        name: 'Chrono Transmuter III',
        cost: 115,
        badge: 'Rapid Cast',
        description: 'High-speed reality warping: sets unit HP to 130 HP with rapid 0.75s cast rate.',
        range: 3.2,
        rate: 0.75,
        fixedHp: 130
      },
      {
        name: 'Chrono Transmuter IV',
        cost: 165,
        badge: 'Rapid Cast',
        description: 'Blistering shift: sets unit HP to 190 HP with ultra-fast 0.60s cast rate.',
        range: 3.3,
        rate: 0.60,
        fixedHp: 190
      },
      {
        name: 'Chrono Transmuter V - Singularity',
        cost: 230,
        badge: 'Rapid Cast',
        description: 'Temporal Singularity: caps at 250 HP with hyper-speed 0.45s cast rate, transmuting entire passing battalions!',
        range: 3.4,
        rate: 0.45,
        fixedHp: 250
      }
    ]
  },

  [TowerType.GOLD]: {
    type: TowerType.GOLD,
    name: 'Gold Spire',
    cost: 30,
    description: 'Generates extra gold (+4g on hit) to fuel your defensive economy.',
    color: 0xeab308, // Gold
    accentColor: 0xfef08a,
    range: 3.5,
    rate: 1.2,
    goldPerHit: 4,
    branchA: [
      {
        name: 'Midas Siphon I',
        cost: 45,
        badge: 'Gold on Hit',
        description: 'Generates +8 Gold every time it hits a passing unit.',
        range: 3.6,
        rate: 1.1,
        goldPerHit: 8
      },
      {
        name: 'Midas Siphon II',
        cost: 80,
        badge: 'Gold on Hit',
        description: 'Generates +14 Gold every time it hits a passing unit.',
        range: 3.8,
        rate: 0.95,
        goldPerHit: 14
      },
      {
        name: 'Midas Siphon III - Philosopher Touch',
        cost: 125,
        badge: 'Gold on Hit',
        description: 'Generates +22 Gold on rapid hit (+22g every 0.8s)!',
        range: 4.0,
        rate: 0.8,
        goldPerHit: 22
      }
    ],
    branchB: [
      {
        name: 'Vault Reserve I',
        cost: 40,
        badge: 'Round Interest',
        description: 'Generates +2 Gold on hit + 12% round interest (min 25g) at round end.',
        range: 3.2,
        rate: 1.3,
        goldPerHit: 2,
        roundInterestPercent: 0.12,
        roundFlatGold: 25
      },
      {
        name: 'Vault Reserve II',
        cost: 75,
        badge: 'Round Interest',
        description: 'Generates +3 Gold on hit + 18% round interest (min 50g) at round end.',
        range: 3.4,
        rate: 1.2,
        goldPerHit: 3,
        roundInterestPercent: 0.18,
        roundFlatGold: 50
      },
      {
        name: 'Vault Reserve III - Imperial Treasury',
        cost: 120,
        badge: 'Round Interest',
        description: 'Generates +4 Gold on hit + 25% compound round interest (min 80g) at round end.',
        range: 3.5,
        rate: 1.1,
        goldPerHit: 4,
        roundInterestPercent: 0.25,
        roundFlatGold: 80
      }
    ]
  },

  [TowerType.EVOLUTION]: {
    type: TowerType.EVOLUTION,
    name: 'Evolution Spire',
    cost: 100,
    description: 'Evolves a single 250 HP unit per wave into a Soldier or Archer champion with upgraded abilities.',
    color: 0x8b5cf6, // Violet
    accentColor: 0xc4b5fd,
    range: 3.0,
    rate: 1.0,
    branchA: [
      {
        name: 'Soldier Forge',
        cost: 0,
        badge: 'Melee Champion',
        description: 'Evolves 1 unit (at 250 HP) per wave into a Soldier (1,250 HP cap) with Armor Aura and Critical Strike.',
        range: 3.0,
        rate: 1.0
      }
    ],
    branchB: [
      {
        name: 'Archer Forge',
        cost: 0,
        badge: 'Ranged Marksman',
        description: 'Evolves 1 unit (at 250 HP) per wave into an Archer (1,000 HP cap) with Multishot and Damage Aura.',
        range: 3.0,
        rate: 1.0
      }
    ]
  }
};

