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
  ARCHER = 'ARCHER',
  MAGE = 'MAGE'
}

export enum EnemyClass {
  // Mission 1: Frontier Outpost
  GOBLIN = 'GOBLIN',
  ORC_WARRIOR = 'ORC_WARRIOR',
  SKELETON_ARCHER = 'SKELETON_ARCHER',
  SHADOW_ASSASSIN = 'SHADOW_ASSASSIN',
  IRONCLAD_OGRE = 'IRONCLAD_OGRE',
  BOSS_GOBLIN_WARLORD = 'BOSS_GOBLIN_WARLORD',
  // Mission 2: Ironforge Pass
  FORGE_BOMBER = 'FORGE_BOMBER',
  IRON_AUTOMATON = 'IRON_AUTOMATON',
  IRON_ARBALIST = 'IRON_ARBALIST',
  ROCK_TROLL = 'ROCK_TROLL',
  BOSS_IRON_COLOSSUS = 'BOSS_IRON_COLOSSUS',
  // Mission 3: Golden Canyon
  SCARAB_SWARMER = 'SCARAB_SWARMER',
  SAND_RAIDER = 'SAND_RAIDER',
  DUNE_SLINGER = 'DUNE_SLINGER',
  TOMB_GUARDIAN = 'TOMB_GUARDIAN',
  BOSS_SAND_WYRM = 'BOSS_SAND_WYRM',
  // Mission 4: Arcane Rift
  VOID_WISP = 'VOID_WISP',
  RIFT_STALKER = 'RIFT_STALKER',
  SPELLBREAKER = 'SPELLBREAKER',
  ARCANE_CONSTRUCT = 'ARCANE_CONSTRUCT',
  BOSS_RIFT_ARCHON = 'BOSS_RIFT_ARCHON',
  // Mission 5: Infernal Citadel
  IMP = 'IMP',
  HELLHOUND = 'HELLHOUND',
  FIRE_CULTIST = 'FIRE_CULTIST',
  DEMON_BRUTE = 'DEMON_BRUTE',
  BOSS_LORD_IGNIS = 'BOSS_LORD_IGNIS'
}

/**
 * Special mechanics. Friendly: HEALING_AURA, DIVINE_SHIELD, FIREBALL, CLEAVE (flavour on legacy classes;
 * CLEAVE is live for any attacker). Enemy abilities are implemented in UnitManager.
 */
export type UnitPassive =
  | 'HEALING_AURA' | 'DIVINE_SHIELD' | 'FIREBALL' | 'CLEAVE'
  | 'SUMMON_GOBLINS' // Goblin Warlord: calls goblin reinforcements
  | 'DEATH_BLAST' // explodes on death, damaging nearby opponents
  | 'PLATING' // loses armor with every hit taken
  | 'COLOSSUS_PLATING' // plating that periodically reforges
  | 'REGEN' // regenerates a share of max HP every second
  | 'DODGE' // chance to evade attacks outright
  | 'RANGED_WARD' // halves damage from ranged attackers
  | 'BURROW' // dives and resurfaces under the enemy backline
  | 'TRUE_DAMAGE' // attacks ignore armor
  | 'BLINK' // teleports to the enemy backline when the fight starts
  | 'DISPEL' // hits strip tower-granted attack & armor
  | 'REFLECT' // reflects part of the damage it takes
  | 'REWRITE' // periodically cuts nearby opponents' HP down to a fraction of their max
  | 'BURN_ON_HIT' // attacks set the target on fire
  | 'HEALER' // periodically heals nearby allies
  | 'HELLFIRE_AURA'; // Lord Ignis: burning aura, ground stomp, magma shield

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
  passive?: UnitPassive;
  /** Player-facing summary of the special mechanic and how to counter it (wave intel, unit card). */
  abilityText?: string;
  isBoss?: boolean;
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
    scale: 0.85,
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
    scale: 1.05,
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
    scale: 1.2,
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
    scale: 1.15,
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
    scale: 1.1,
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
    scale: 1.35,
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
    scale: 1.3,
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
    scale: 1.6,
    description: 'Gigantic elemental behemoth whose massive fists cleave all enemies.',
    passive: 'CLEAVE'
  },
  [FriendlyClass.SOLDIER]: {
    name: 'Soldier',
    tier: UnitTier.TIER_2,
    hp: 3750, // High HP cap: champions are the sink for heal towers
    armor: 16,
    attack: 38,
    attackRate: 1.0,
    moveSpeed: 2.0,
    range: 1.0,
    color: 0x3b82f6, // Royal Champion Blue
    scale: 1.25,
    description: 'Melee champion forged at 250 HP with high HP cap, Armor Aura, and Relentless Assault.'
  },
  [FriendlyClass.ARCHER]: {
    name: 'Archer',
    tier: UnitTier.TIER_2,
    hp: 3000, // High HP cap: champions are the sink for heal towers
    armor: 6,
    attack: 42,
    attackRate: 0.85,
    moveSpeed: 2.2,
    range: 6.5, // Long-range sharpshooter
    color: 0x10b981, // Emerald Archer
    scale: 1.2,
    description: 'Ranged marksman forged at 250 HP with high HP cap, Multishot volleys, and Damage Aura.'
  },
  [FriendlyClass.MAGE]: {
    name: 'Mage',
    tier: UnitTier.TIER_2,
    hp: 2550, // High HP cap: champions are the sink for heal towers
    armor: 8,
    attack: 45,
    attackRate: 1.1,
    moveSpeed: 2.0,
    range: 5.2, // Ranged arcane caster
    color: 0xa855f7, // Arcane Pyromancer Purple
    scale: 1.2,
    description: 'Arcane Pyromancer forged at 250 HP with high HP cap. Attacks generate Mana, casting an explosive AoE Mega Fireball at 100 Mana.'
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
    scale: 0.85,
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
    scale: 1.15,
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
    scale: 1.05,
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
    scale: 1.1,
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
    scale: 1.55,
    description: 'Towering armored beast that soaks enormous damage.'
  },
  [EnemyClass.BOSS_GOBLIN_WARLORD]: {
    name: 'Grukk the Goblin Warlord',
    tier: UnitTier.TIER_3,
    hp: 3000,
    armor: 25,
    attack: 70,
    attackRate: 1.3,
    moveSpeed: 1.6,
    range: 1.3,
    color: 0x65a30d, // Warpaint green
    scale: 1.9,
    description: 'Self-crowned king of the frontier raiders, riding a war drum of stolen iron.',
    passive: 'SUMMON_GOBLINS',
    abilityText: 'Every 9s blows his war horn and calls 3 Goblin Raiders into the fight (they pay no bounty). Kill him fast or focus the adds with Multishot and Fireball splash.',
    isBoss: true
  },

  // --- Mission 2: Ironforge Pass ---
  [EnemyClass.FORGE_BOMBER]: {
    name: 'Forge Bomber',
    tier: UnitTier.TIER_1,
    hp: 110,
    armor: 4,
    attack: 10,
    attackRate: 1.0,
    moveSpeed: 2.6,
    range: 0.8,
    color: 0xea580c, // Glowing powder keg
    scale: 0.8,
    description: 'Gremlin sapper hauling a lit keg of forge powder.',
    passive: 'DEATH_BLAST',
    abilityText: 'Explodes on death, hitting every opponent within 2.5m for 6x its Attack. Spread out or kill it at range.'
  },
  [EnemyClass.IRON_AUTOMATON]: {
    name: 'Iron Automaton',
    tier: UnitTier.TIER_2,
    hp: 240,
    armor: 36,
    attack: 20,
    attackRate: 1.3,
    moveSpeed: 1.5,
    range: 0.9,
    color: 0x64748b, // Riveted steel
    scale: 1.15,
    description: 'Clockwork sentinel wrapped in layered steel plates.',
    passive: 'PLATING',
    abilityText: 'Loses 2 Armor for every hit it takes. Many fast hits (Rapid Quiver, Multishot) peel it apart.'
  },
  [EnemyClass.IRON_ARBALIST]: {
    name: 'Iron Arbalist',
    tier: UnitTier.TIER_2,
    hp: 170,
    armor: 10,
    attack: 26,
    attackRate: 1.5,
    moveSpeed: 1.8,
    range: 4.2,
    color: 0x475569, // Gunmetal
    scale: 1.05,
    description: 'Dwarf-forged heavy crossbowman firing bolts from behind the line.'
  },
  [EnemyClass.ROCK_TROLL]: {
    name: 'Rock Troll',
    tier: UnitTier.TIER_3,
    hp: 900,
    armor: 12,
    attack: 44,
    attackRate: 1.5,
    moveSpeed: 1.5,
    range: 1.1,
    color: 0x78716c, // Granite hide
    scale: 1.5,
    description: 'Mountain brute whose stony hide knits itself back together.',
    passive: 'REGEN',
    abilityText: 'Regenerates 2.5% of its max HP every second. Burst it down; Molten Pyre burn and focus fire beat the regen.'
  },
  [EnemyClass.BOSS_IRON_COLOSSUS]: {
    name: 'The Iron Colossus',
    tier: UnitTier.TIER_3,
    hp: 4000,
    armor: 90,
    attack: 85,
    attackRate: 1.6,
    moveSpeed: 1.2,
    range: 1.5,
    color: 0x94a3b8, // Polished adamant
    scale: 2.1,
    description: 'A walking forge-engine built to guard the pass.',
    passive: 'COLOSSUS_PLATING',
    abilityText: 'Starts with 90 Armor that drops by 1 with every hit it takes (down to 10), but it reforges +15 Armor every 12s. Swarm it with as many hits as possible; Sundering Shot helps.',
    isBoss: true
  },

  // --- Mission 3: Golden Canyon ---
  [EnemyClass.SCARAB_SWARMER]: {
    name: 'Scarab Swarmer',
    tier: UnitTier.TIER_1,
    hp: 60,
    armor: 0,
    attack: 7,
    attackRate: 0.7,
    moveSpeed: 3.0,
    range: 0.7,
    color: 0x0f766e, // Jade carapace
    scale: 0.6,
    description: 'Dog-sized beetle that pours out of the dunes in chittering waves.'
  },
  [EnemyClass.SAND_RAIDER]: {
    name: 'Sand Raider',
    tier: UnitTier.TIER_2,
    hp: 220,
    armor: 6,
    attack: 30,
    attackRate: 0.9,
    moveSpeed: 2.6,
    range: 0.9,
    color: 0xd97706, // Desert wraps
    scale: 1.05,
    description: 'Veiled canyon bandit with twin scimitars.',
    passive: 'DODGE',
    abilityText: 'Dodges 30% of attacks outright. Splash damage (Mega Fireball) and burns can not be dodged.'
  },
  [EnemyClass.DUNE_SLINGER]: {
    name: 'Dune Slinger',
    tier: UnitTier.TIER_2,
    hp: 140,
    armor: 4,
    attack: 20,
    attackRate: 1.1,
    moveSpeed: 2.1,
    range: 4.5,
    color: 0xca8a04, // Sun-bleached cloth
    scale: 1.0,
    description: 'Nomad skirmisher hurling stones from the canyon walls.'
  },
  [EnemyClass.TOMB_GUARDIAN]: {
    name: 'Tomb Guardian',
    tier: UnitTier.TIER_3,
    hp: 950,
    armor: 26,
    attack: 46,
    attackRate: 1.5,
    moveSpeed: 1.4,
    range: 1.1,
    color: 0xa8a29e, // Wrapped sandstone
    scale: 1.5,
    description: 'Bandaged sentinel of the buried kings, shielded by old wards.',
    passive: 'RANGED_WARD',
    abilityText: 'Takes half damage from ranged attacks. Bring melee: Soldiers with Relentless Assault shred it.'
  },
  [EnemyClass.BOSS_SAND_WYRM]: {
    name: 'Sandmaw the Devourer',
    tier: UnitTier.TIER_3,
    hp: 3800,
    armor: 30,
    attack: 95,
    attackRate: 1.4,
    moveSpeed: 1.8,
    range: 1.6,
    color: 0xb45309, // Sandstone scales
    scale: 2.0,
    description: 'An ancient wyrm that swims through the canyon floor.',
    passive: 'BURROW',
    abilityText: 'Every 10s burrows and bursts out under your rearmost unit, hitting everything within 3m for 2x its Attack. Give your Archers and Mages enough HP and armor to survive the ambush.',
    isBoss: true
  },

  // --- Mission 4: Arcane Rift ---
  [EnemyClass.VOID_WISP]: {
    name: 'Void Wisp',
    tier: UnitTier.TIER_1,
    hp: 100,
    armor: 0,
    attack: 14,
    attackRate: 1.0,
    moveSpeed: 2.4,
    range: 4.0,
    color: 0x7c3aed, // Void violet
    scale: 0.75,
    description: 'A flickering shard of the rift that burns through flesh and steel alike.',
    passive: 'TRUE_DAMAGE',
    abilityText: 'Its bolts ignore armor. Forge armor does not help here; kill wisps fast with Archers and splash.'
  },
  [EnemyClass.RIFT_STALKER]: {
    name: 'Rift Stalker',
    tier: UnitTier.TIER_2,
    hp: 190,
    armor: 6,
    attack: 36,
    attackRate: 0.85,
    moveSpeed: 2.7,
    range: 0.8,
    color: 0x6d28d9, // Phase-shifted shadow
    scale: 1.05,
    description: 'Assassin that steps through folds in reality.',
    passive: 'BLINK',
    abilityText: 'Blinks straight to your rearmost unit when the clash starts. Keep a bodyguard near your ranged champions.'
  },
  [EnemyClass.SPELLBREAKER]: {
    name: 'Spellbreaker',
    tier: UnitTier.TIER_2,
    hp: 280,
    armor: 12,
    attack: 24,
    attackRate: 1.1,
    moveSpeed: 1.9,
    range: 0.9,
    color: 0x0891b2, // Null-rune cyan
    scale: 1.1,
    description: 'Rune-tattooed warden who unravels blessings with every strike.',
    passive: 'DISPEL',
    abilityText: 'Each hit strips 15% of the Attack and Armor your towers gave its target. Kill it before it reaches your champions.'
  },
  [EnemyClass.ARCANE_CONSTRUCT]: {
    name: 'Arcane Construct',
    tier: UnitTier.TIER_3,
    hp: 950,
    armor: 25,
    attack: 50,
    attackRate: 1.6,
    moveSpeed: 1.3,
    range: 1.1,
    color: 0x4338ca, // Glyph-carved obsidian
    scale: 1.5,
    description: 'Floating monolith of glyph-stone animated by the rift.',
    passive: 'REFLECT',
    abilityText: 'Reflects 20% of the damage it takes back at the attacker. Give the units that fight it plenty of HP.'
  },
  [EnemyClass.BOSS_RIFT_ARCHON]: {
    name: 'The Unbound Archon',
    tier: UnitTier.TIER_3,
    hp: 3400,
    armor: 30,
    attack: 80,
    attackRate: 1.5,
    moveSpeed: 1.4,
    range: 5.0,
    color: 0xa855f7, // Rift light
    scale: 2.0,
    description: 'The mind behind the rift, rewriting the rules of the battlefield.',
    passive: 'REWRITE',
    abilityText: 'Ranged caster. Every 12s Reality Rewrite cuts every opponent within 6m down to 40% of their max HP. Keep healing up and strike between casts.',
    isBoss: true
  },

  // --- Mission 5: Infernal Citadel ---
  [EnemyClass.IMP]: {
    name: 'Cinder Imp',
    tier: UnitTier.TIER_1,
    hp: 80,
    armor: 2,
    attack: 10,
    attackRate: 0.8,
    moveSpeed: 2.9,
    range: 0.8,
    color: 0xdc2626, // Ember red
    scale: 0.7,
    description: 'Cackling fire-sprite that swarms in burning packs.',
    passive: 'BURN_ON_HIT',
    abilityText: 'Hits set the target on fire (30% of its Attack per second for 3s).'
  },
  [EnemyClass.HELLHOUND]: {
    name: 'Hellhound',
    tier: UnitTier.TIER_2,
    hp: 240,
    armor: 8,
    attack: 28,
    attackRate: 0.9,
    moveSpeed: 2.9,
    range: 0.9,
    color: 0x991b1b, // Charred hide
    scale: 1.1,
    description: 'Molten-jawed hound bred in the citadel kennels.',
    passive: 'BURN_ON_HIT',
    abilityText: 'Bites set the target on fire (50% of its Attack per second for 3s). Soldier Iron Vigor out-heals the burn.'
  },
  [EnemyClass.FIRE_CULTIST]: {
    name: 'Fire Cultist',
    tier: UnitTier.TIER_2,
    hp: 170,
    armor: 6,
    attack: 18,
    attackRate: 1.3,
    moveSpeed: 1.9,
    range: 4.0,
    color: 0xf97316, // Flame robes
    scale: 1.05,
    description: 'Robed zealot chanting hymns to the Overlord.',
    passive: 'HEALER',
    abilityText: 'Every 4s heals allies within 4m for 8% of their max HP. Focus Fire the cultists first.'
  },
  [EnemyClass.DEMON_BRUTE]: {
    name: 'Demon Brute',
    tier: UnitTier.TIER_3,
    hp: 1000,
    armor: 32,
    attack: 55,
    attackRate: 1.5,
    moveSpeed: 1.4,
    range: 1.2,
    color: 0x7f1d1d, // Obsidian hide
    scale: 1.6,
    description: 'Hulking pit demon wielding a brazier-headed maul.',
    passive: 'CLEAVE',
    abilityText: 'Every swing cleaves 60% damage into all opponents within 2.2m. Do not bunch your frontline up.'
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
    scale: 2.1,
    description: 'Lord of the Molten Citadel. His presence burns the ground.',
    passive: 'HELLFIRE_AURA',
    abilityText: 'Hellfire aura burns everything within 3.5m. Every 6s his Ground Stomp hits all within 4m for 1.5x Attack and knocks them back; at 50% HP his Magma Shield adds +15 Armor. Spread out, keep ranged units back, and bring Sundering Shot.',
    isBoss: true
  }
};

/**
 * Enemy stat scaling: waves grow stronger from wave 8 on (waveIndex is 0-based), and later missions
 * multiply HP and Attack by their difficulty. Shared by spawning and the wave intel.
 */
export function getEnemyWaveScaling(waveIndex: number, missionStatMult: number = 1): { hpMult: number; armorBonus: number; atkMult: number } {
  const extraWaves = Math.max(0, waveIndex + 1 - 7);
  return {
    hpMult: (1 + extraWaves * 0.18) * missionStatMult,
    armorBonus: Math.round(extraWaves * 2.2),
    atkMult: (1 + extraWaves * 0.12) * missionStatMult
  };
}

/** Gold paid for killing a unit (enemies in PvE; any unit of the opposing army in PvP). */
export function getKillBounty(stats: UnitStats, isBoss: boolean): number {
  return isBoss ? 250 : stats.tier === UnitTier.TIER_3 ? 60 : stats.tier === UnitTier.TIER_2 ? 25 : 12;
}

/** Fraction of each hit absorbed by armor (Warcraft III formula, see calculateDamage). */
export function armorReduction(armor: number): number {
  return armor >= 0 ? (armor * 0.06) / (1 + armor * 0.06) : 0;
}

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


/** Whether a class belongs to the defender roster (as opposed to the enemy bestiary). */
export function isFriendlyClass(unitClass: FriendlyClass | EnemyClass): unitClass is FriendlyClass {
  return unitClass in FRIENDLY_UNIT_STATS;
}

/** Looks up stats by class, independent of which side the unit fights for (e.g. PvP mercenaries). */
export function getUnitStats(unitClass: FriendlyClass | EnemyClass): UnitStats {
  return isFriendlyClass(unitClass)
    ? FRIENDLY_UNIT_STATS[unitClass]
    : ENEMY_UNIT_STATS[unitClass as EnemyClass];
}
