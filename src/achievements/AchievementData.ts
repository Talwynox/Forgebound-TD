/**
 * AchievementData: Definitions, categories, and tiers for the Pyro TD Achievement System.
 */

export enum AchievementCategory {
  ALL = 'ALL',
  ECONOMY = 'ECONOMY',
  COMBAT = 'COMBAT',
  TOWERS = 'TOWERS',
  EVOLUTION = 'EVOLUTION',
  CAMPAIGN = 'CAMPAIGN'
}

export interface AchievementTierDef {
  tier: number;             // 1 = Bronze, 2 = Silver, 3 = Gold, 4 = Platinum
  threshold: number;        // Metric count required to unlock
  title: string;            // Tier-specific title (e.g. "Gold Hoarder I")
  description: string;      // Tier description
  badge: string;            // 🥉, 🥈, 🥇, 💎
  badgeName: string;        // 'Bronze', 'Silver', 'Gold', 'Platinum'
}

export interface AchievementDef {
  id: string;
  icon: string;
  category: AchievementCategory;
  name: string;
  metric: string;
  unit: string;
  tiers: AchievementTierDef[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // 1. Economy
  {
    id: 'lifetime_gold',
    icon: '🪙',
    category: AchievementCategory.ECONOMY,
    name: 'Vault of the Realm',
    metric: 'lifetimeGoldEarned',
    unit: 'Gold',
    tiers: [
      { tier: 1, threshold: 1000, title: 'Prosperity I', description: 'Accumulate 1,000 lifetime gold.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 5000, title: 'Prosperity II', description: 'Accumulate 5,000 lifetime gold.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 20000, title: 'Prosperity III', description: 'Accumulate 20,000 lifetime gold.', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 50000, title: 'Treasury of Kings', description: 'Accumulate 50,000 lifetime gold!', badge: '💎', badgeName: 'Platinum' }
    ]
  },

  // 2. Combat - Goblins
  {
    id: 'kills_goblin',
    icon: '👺',
    category: AchievementCategory.COMBAT,
    name: 'Goblin Exterminator',
    metric: 'goblinKills',
    unit: 'Goblins',
    tiers: [
      { tier: 1, threshold: 25, title: 'Goblin Slayer I', description: 'Slay 25 Goblin raiders.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 100, title: 'Goblin Slayer II', description: 'Slay 100 Goblin raiders.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 300, title: 'Goblin Scourge', description: 'Slay 300 Goblin raiders!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 3. Combat - Orc Warriors
  {
    id: 'kills_orc',
    icon: '🧌',
    category: AchievementCategory.COMBAT,
    name: 'Orc Cleaver',
    metric: 'orcKills',
    unit: 'Orcs',
    tiers: [
      { tier: 1, threshold: 15, title: 'Orc Cleaver I', description: 'Vanquish 15 Orc Warriors.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 60, title: 'Orc Cleaver II', description: 'Vanquish 60 Orc Warriors.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 200, title: 'Warlord Executioner', description: 'Vanquish 200 Orc Warriors!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 4. Combat - Skeleton Archers
  {
    id: 'kills_skeleton',
    icon: '💀',
    category: AchievementCategory.COMBAT,
    name: 'Bone Shatterer',
    metric: 'skeletonKills',
    unit: 'Skeletons',
    tiers: [
      { tier: 1, threshold: 15, title: 'Bone Shatterer I', description: 'Smash 15 Skeleton Sharpshooters.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 50, title: 'Bone Shatterer II', description: 'Smash 50 Skeleton Sharpshooters.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 150, title: 'Crypt Sovereign', description: 'Smash 150 Skeleton Sharpshooters!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 5. Combat - Shadow Assassins
  {
    id: 'kills_assassin',
    icon: '🗡️',
    category: AchievementCategory.COMBAT,
    name: 'Shadow Banisher',
    metric: 'assassinKills',
    unit: 'Assassins',
    tiers: [
      { tier: 1, threshold: 10, title: 'Shadow Hunter I', description: 'Eliminate 10 Shadow Assassins.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 40, title: 'Shadow Hunter II', description: 'Eliminate 40 Shadow Assassins.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 120, title: 'Bane of Shadows', description: 'Eliminate 120 Shadow Assassins!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 6. Combat - Ironclad Ogres
  {
    id: 'kills_ogre',
    icon: '🛡️',
    category: AchievementCategory.COMBAT,
    name: 'Colossus Breaker',
    metric: 'ogreKills',
    unit: 'Ogres',
    tiers: [
      { tier: 1, threshold: 5, title: 'Giant Toppler I', description: 'Topple 5 Ironclad Ogres.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 20, title: 'Giant Toppler II', description: 'Topple 20 Ironclad Ogres.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 60, title: 'Titan Slayer', description: 'Topple 60 Ironclad Ogres!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 7. Combat - Demon Lord Ignis
  {
    id: 'kills_boss',
    icon: '🔥',
    category: AchievementCategory.COMBAT,
    name: 'Bane of Ignis',
    metric: 'bossKills',
    unit: 'Demon Lords',
    tiers: [
      { tier: 1, threshold: 1, title: 'Infernal Extinguisher I', description: 'Defeat Lord Ignis at the climax of Wave 25.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 3, title: 'Infernal Extinguisher II', description: 'Defeat Lord Ignis 3 times.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 5, title: 'Hellfire Conqueror', description: 'Defeat Lord Ignis 5 times!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 8. Towers - Master Architect (Unique Tower Types Maxed to Rank 10)
  {
    id: 'towers_maxed',
    icon: '🏰',
    category: AchievementCategory.TOWERS,
    name: 'Grand Architect',
    metric: 'uniqueTowersMaxed',
    unit: 'Tower Types',
    tiers: [
      { tier: 1, threshold: 1, title: 'Master Craftsman I', description: 'Fully upgrade 1 tower type to Rank 10.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 4, title: 'Master Craftsman II', description: 'Fully upgrade 4 distinct tower types to Rank 10.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 8, title: 'High Architect of the Realm', description: 'Master all 8 tower types to Rank 10!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 9. Evolution - Champions Ascended
  {
    id: 'champions_evolved',
    icon: '✨',
    category: AchievementCategory.EVOLUTION,
    name: 'Heroic Vanguard',
    metric: 'championsEvolved',
    unit: 'Champions',
    tiers: [
      { tier: 1, threshold: 5, title: 'Ascension I', description: 'Evolve 5 recruits into Soldiers, Archers, or Mages.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 25, title: 'Ascension II', description: 'Evolve 25 recruits into Champions.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 100, title: 'Army of Legends', description: 'Evolve 100 recruits into Champions!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 10. Strategy - Flawless Waves (Castle took 0 damage)
  {
    id: 'flawless_waves',
    icon: '👑',
    category: AchievementCategory.CAMPAIGN,
    name: 'Impenetrable Citadel',
    metric: 'flawlessWaves',
    unit: 'Flawless Waves',
    tiers: [
      { tier: 1, threshold: 5, title: 'Untouchable I', description: 'Clear 5 waves without the Castle taking any damage.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 20, title: 'Untouchable II', description: 'Clear 20 waves without Castle damage.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 50, title: 'Aegis of the Kingdom', description: 'Clear 50 flawless waves!', badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 11. Campaign - Stars Earned
  {
    id: 'campaign_stars',
    icon: '⭐',
    category: AchievementCategory.CAMPAIGN,
    name: 'Decorated Commander',
    metric: 'campaignStars',
    unit: 'Stars',
    tiers: [
      { tier: 1, threshold: 3, title: 'Commendation I', description: 'Earn 3 Campaign Stars.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 9, title: 'Commendation II', description: 'Earn 9 Campaign Stars.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 18, title: 'Grand Marshal', description: 'Earn 18 Campaign Stars across all missions!', badge: '🥇', badgeName: 'Gold' }
    ]
  }
];

