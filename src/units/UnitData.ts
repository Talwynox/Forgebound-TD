/**
 * UnitData: Unit definitions, evolution criteria, stats, and formulas.
 */

export enum UnitTier {
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3
}

export enum FriendlyClass {
  RECRUIT = 'RECRUIT',
  FOOTMAN = 'FOOTMAN',
  KNIGHT = 'KNIGHT',
  BERSERKER = 'BERSERKER',
  CLERIC = 'CLERIC',
  PALADIN = 'PALADIN',
  ARCHMAGE = 'ARCHMAGE',
  PYRO_GOLEM = 'PYRO_GOLEM',
  SOLDIER = 'SOLDIER',
  ARCHER = 'ARCHER'
}

export enum EnemyClass {
  GOBLIN = 'GOBLIN',
  ORC_WARRIOR = 'ORC_WARRIOR',
  SKELETON_ARCHER = 'SKELETON_ARCHER',
  SHADOW_ASSASSIN = 'SHADOW_ASSASSIN',
  IRONCLAD_OGRE = 'IRONCLAD_OGRE',
  BOSS_LORD_IGNIS = 'BOSS_LORD_IGNIS'
}

export interface UnitStats {
  name: string;
  tier: UnitTier;
  hp: number;
  armor: number;
  attack: number;
  attackRate: number; // seconds per attack
  moveSpeed: number;
  range: number; // melee is ~0.8, ranged is 3-4
  color: number;
  scale: number;
  description: string;
  passive?: string;
}

export const FRIENDLY_UNIT_STATS: Record<FriendlyClass, UnitStats> = {
  [FriendlyClass.RECRUIT]: {
    name: 'Recruit',
    tier: UnitTier.TIER_1,
    hp: 250, // Base max HP of 250
    armor: 2,
    attack: 10,
    attackRate: 1.2,
    moveSpeed: 2.2,
    range: 0.9,
    color: 0x94a3b8, // Light steel
    scale: 0.6,
    description: 'Fresh recruit seeking blessings through the maze.'
  },
  [FriendlyClass.FOOTMAN]: {
    name: 'Footman',
    tier: UnitTier.TIER_2,
    hp: 250,
    armor: 12,
    attack: 20,
    attackRate: 1.1,
    moveSpeed: 2.0,
    range: 0.9,
    color: 0x3b82f6, // Blue soldier
    scale: 0.75,
    description: 'Disciplined infantry with balanced offense and defense.'
  },
  [FriendlyClass.KNIGHT]: {
    name: 'Heavy Knight',
    tier: UnitTier.TIER_2,
    hp: 420,
    armor: 28,
    attack: 22,
    attackRate: 1.2,
    moveSpeed: 1.8,
    range: 0.9,
    color: 0x475569, // Heavy iron
    scale: 0.85,
    description: 'Heavily armored juggernaut forged in the anvil.'
  },
  [FriendlyClass.BERSERKER]: {
    name: 'Fire Berserker',
    tier: UnitTier.TIER_2,
    hp: 300,
    armor: 8,
    attack: 42,
    attackRate: 0.75,
    moveSpeed: 2.5,
    range: 0.9,
    color: 0xef4444, // Crimson flame
    scale: 0.8,
    description: 'Dual-wielding skirmisher with devastating attack speed.'
  },
  [FriendlyClass.CLERIC]: {
    name: 'Holy Cleric',
    tier: UnitTier.TIER_2,
    hp: 350,
    armor: 14,
    attack: 16,
    attackRate: 1.3,
    moveSpeed: 2.0,
    range: 1.0,
    color: 0x10b981, // Emerald divine
    scale: 0.75,
    description: 'Channels vitality to heal surrounding allies in combat.',
    passive: 'HEALING_AURA'
  },
  [FriendlyClass.PALADIN]: {
    name: 'Sun Paladin',
    tier: UnitTier.TIER_3,
    hp: 900,
    armor: 45,
    attack: 55,
    attackRate: 1.0,
    moveSpeed: 1.9,
    range: 1.0,
    color: 0xf59e0b, // Golden amber
    scale: 1.0,
    description: 'Elite champion shielded in sun-forged armor and divine power.',
    passive: 'DIVINE_SHIELD'
  },
  [FriendlyClass.ARCHMAGE]: {
    name: 'Grand Archmage',
    tier: UnitTier.TIER_3,
    hp: 700,
    armor: 22,
    attack: 85,
    attackRate: 1.4,
    moveSpeed: 1.9,
    range: 3.8,
    color: 0x8b5cf6, // Purple mystic
    scale: 0.95,
    description: 'Casts explosive arcane bolts from afar.',
    passive: 'FIREBALL'
  },
  [FriendlyClass.PYRO_GOLEM]: {
    name: 'Pyro Colossus',
    tier: UnitTier.TIER_3,
    hp: 1500,
    armor: 55,
    attack: 95,
    attackRate: 1.5,
    moveSpeed: 1.5,
    range: 1.2,
    color: 0xd97706, // Molten Stone
    scale: 1.25,
    description: 'Gigantic elemental behemoth whose massive fists cleave all enemies.',
    passive: 'CLEAVE'
  },
  [FriendlyClass.SOLDIER]: {
    name: 'Soldier',
    tier: UnitTier.TIER_2,
    hp: 1250, // Massively increased HP cap
    armor: 16,
    attack: 38,
    attackRate: 1.0,
    moveSpeed: 2.0,
    range: 1.0,
    color: 0x3b82f6, // Royal Champion Blue
    scale: 0.95,
    description: 'Melee champion forged at 250 HP with high HP cap, Armor Aura, and Critical Strike.'
  },
  [FriendlyClass.ARCHER]: {
    name: 'Archer',
    tier: UnitTier.TIER_2,
    hp: 1000, // Massively increased HP cap
    armor: 6,
    attack: 42,
    attackRate: 0.85,
    moveSpeed: 2.2,
    range: 5.5, // Long-range sharpshooter
    color: 0x10b981, // Emerald Archer
    scale: 0.9,
    description: 'Ranged marksman forged at 250 HP with high HP cap, Multishot volleys, and Damage Aura.'
  }
};

export const ENEMY_UNIT_STATS: Record<EnemyClass, UnitStats> = {
  [EnemyClass.GOBLIN]: {
    name: 'Goblin Raider',
    tier: UnitTier.TIER_1,
    hp: 90,
    armor: 2,
    attack: 8,
    attackRate: 1.0,
    moveSpeed: 2.5,
    range: 0.8,
    color: 0x84cc16, // Lime goblin
    scale: 0.6,
    description: 'Quick light skirmisher.'
  },
  [EnemyClass.ORC_WARRIOR]: {
    name: 'Orc Marauder',
    tier: UnitTier.TIER_2,
    hp: 260,
    armor: 14,
    attack: 22,
    attackRate: 1.2,
    moveSpeed: 1.8,
    range: 0.9,
    color: 0xb45309, // Brown orc
    scale: 0.8,
    description: 'Brutal shock warrior.'
  },
  [EnemyClass.SKELETON_ARCHER]: {
    name: 'Skeleton Marksman',
    tier: UnitTier.TIER_2,
    hp: 150,
    armor: 6,
    attack: 18,
    attackRate: 1.3,
    moveSpeed: 2.0,
    range: 3.5,
    color: 0xe2e8f0, // Bone white
    scale: 0.7,
    description: 'Undead archer firing piercing bone shafts.'
  },
  [EnemyClass.SHADOW_ASSASSIN]: {
    name: 'Shadow Stalker',
    tier: UnitTier.TIER_2,
    hp: 200,
    armor: 8,
    attack: 38,
    attackRate: 0.8,
    moveSpeed: 2.8,
    range: 0.8,
    color: 0x475569, // Dark silhouette
    scale: 0.75,
    description: 'Lethal speed demon with poison daggers.'
  },
  [EnemyClass.IRONCLAD_OGRE]: {
    name: 'Ironclad Crusher',
    tier: UnitTier.TIER_3,
    hp: 850,
    armor: 30,
    attack: 48,
    attackRate: 1.6,
    moveSpeed: 1.4,
    range: 1.1,
    color: 0x78716c, // Stone giant
    scale: 1.15,
    description: 'Towering armored beast that soaks enormous damage.'
  },
  [EnemyClass.BOSS_LORD_IGNIS]: {
    name: 'Lord Ignis (Infernal Overlord)',
    tier: UnitTier.TIER_3,
    hp: 3500,
    armor: 40,
    attack: 90,
    attackRate: 1.5,
    moveSpeed: 1.3,
    range: 1.5,
    color: 0xb91c1c, // Crimson demon
    scale: 1.5,
    description: 'Lord of the Molten Citadel. His presence burns the ground.',
    passive: 'HELLFIRE_AURA'
  }
};

/**
 * Warcraft III Armor Damage Reduction Formula:
 * Reduction = (Armor * 0.06) / (1 + Armor * 0.06)
 * Damage Taken = Raw Damage * (1 - Reduction)
 */
export function calculateDamage(rawDmg: number, armor: number): number {
  if (armor >= 0) {
    const reduction = (armor * 0.06) / (1 + armor * 0.06);
    return Math.max(1, Math.round(rawDmg * (1 - reduction)));
  } else {
    // Negative armor increases damage taken
    const increase = 2 - Math.pow(0.94, -armor);
    return Math.max(1, Math.round(rawDmg * increase));
  }
}

