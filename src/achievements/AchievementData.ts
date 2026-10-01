/**
 * AchievementData: Definitions, categories, and tiers for the Pyro TD Achievement System.
 */

import { CAMPAIGN_MISSIONS } from '../campaign/CampaignData';

export enum AchievementCategory {
  ALL = 'ALL',
  ECONOMY = 'ECONOMY',
  COMBAT = 'COMBAT',
  TOWERS = 'TOWERS',
  EVOLUTION = 'EVOLUTION',
  CAMPAIGN = 'CAMPAIGN'
}

export interface AchievementTierDef {
  tier: number;             // 1 = Bronze, 2 = Silver, 3 = Gold, 4 = Platinum, 5 = Legendary
  threshold: number;        // Metric count required to unlock
  title: string;            // Tier-specific title (e.g. "Gold Hoarder I")
  description: string;      // Tier description
  badge: string;            // 🥉, 🥈, 🥇, 💎, 🌟
  badgeName: string;        // 'Bronze', 'Silver', 'Gold', 'Platinum', 'Legendary'
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

/** Every mission can award at most 3 stars. */
const MAX_CAMPAIGN_STARS = CAMPAIGN_MISSIONS.length * 3;

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
      { tier: 4, threshold: 50000, title: 'Treasury of Kings', description: 'Accumulate 50,000 lifetime gold!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 250000, title: 'Midas Incarnate', description: 'Accumulate 250,000 lifetime gold!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 2. Economy - Recruits hired
  {
    id: 'recruits_hired',
    icon: '🛡️',
    category: AchievementCategory.ECONOMY,
    name: 'Call to Arms',
    metric: 'recruitsHired',
    unit: 'Recruits',
    tiers: [
      { tier: 1, threshold: 10, title: 'Muster I', description: 'Hire 10 extra recruits.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 50, title: 'Muster II', description: 'Hire 50 extra recruits.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 200, title: 'Standing Army', description: 'Hire 200 extra recruits!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 600, title: 'Grand Levy', description: 'Hire 600 extra recruits!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 1500, title: 'Legion Without End', description: 'Hire 1,500 extra recruits!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 3. Combat - Every enemy slain
  {
    id: 'kills_total',
    icon: '⚔️',
    category: AchievementCategory.COMBAT,
    name: 'Scourge of Armies',
    metric: 'totalKills',
    unit: 'Enemies',
    tiers: [
      { tier: 1, threshold: 250, title: 'Warbringer I', description: 'Slay 250 enemies of any kind.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 1000, title: 'Warbringer II', description: 'Slay 1,000 enemies.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 5000, title: 'Warbringer III', description: 'Slay 5,000 enemies!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 15000, title: 'Field of Ten Thousand', description: 'Slay 15,000 enemies!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 50000, title: 'Endbringer', description: 'Slay 50,000 enemies!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 4. Combat - Goblins
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
      { tier: 3, threshold: 300, title: 'Goblin Scourge', description: 'Slay 300 Goblin raiders!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 1000, title: 'Goblin Bane', description: 'Slay 1,000 Goblin raiders!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 4000, title: 'Nightmare of the Warrens', description: 'Slay 4,000 Goblin raiders!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 5. Combat - Orc Warriors
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
      { tier: 3, threshold: 200, title: 'Warlord Executioner', description: 'Vanquish 200 Orc Warriors!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 700, title: 'Horde Breaker', description: 'Vanquish 700 Orc Warriors!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 2500, title: 'End of the Clans', description: 'Vanquish 2,500 Orc Warriors!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 6. Combat - Skeleton Archers
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
      { tier: 3, threshold: 150, title: 'Crypt Sovereign', description: 'Smash 150 Skeleton Sharpshooters!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 500, title: 'Ossuary Keeper', description: 'Smash 500 Skeleton Sharpshooters!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 2000, title: 'Lord of Dust', description: 'Smash 2,000 Skeleton Sharpshooters!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 7. Combat - Shadow Assassins
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
      { tier: 3, threshold: 120, title: 'Bane of Shadows', description: 'Eliminate 120 Shadow Assassins!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 400, title: 'Lightbringer', description: 'Eliminate 400 Shadow Assassins!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 1500, title: 'Eternal Dawn', description: 'Eliminate 1,500 Shadow Assassins!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 8. Combat - Ironclad Ogres
  {
    id: 'kills_ogre',
    icon: '🪨',
    category: AchievementCategory.COMBAT,
    name: 'Colossus Breaker',
    metric: 'ogreKills',
    unit: 'Ogres',
    tiers: [
      { tier: 1, threshold: 5, title: 'Giant Toppler I', description: 'Topple 5 Ironclad Ogres.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 20, title: 'Giant Toppler II', description: 'Topple 20 Ironclad Ogres.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 60, title: 'Titan Slayer', description: 'Topple 60 Ironclad Ogres!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 200, title: 'Mountain Mover', description: 'Topple 200 Ironclad Ogres!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 800, title: 'Earthshaker', description: 'Topple 800 Ironclad Ogres!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 9. Combat - Ironforge Pass forces
  {
    id: 'kills_ironforge',
    icon: '⚙️',
    category: AchievementCategory.COMBAT,
    name: 'Forge Wrecker',
    metric: 'ironforgeKills',
    unit: 'Ironforge foes',
    tiers: [
      { tier: 1, threshold: 50, title: 'Scrap Maker I', description: 'Destroy 50 Ironforge Pass enemies (bombers, automatons, arbalists, trolls).', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 200, title: 'Scrap Maker II', description: 'Destroy 200 Ironforge Pass enemies.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 600, title: 'Foundry Breaker', description: 'Destroy 600 Ironforge Pass enemies!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 2000, title: 'Anvil Shatterer', description: 'Destroy 2,000 Ironforge Pass enemies!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 6000, title: 'Rust of Ages', description: 'Destroy 6,000 Ironforge Pass enemies!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 10. Combat - Golden Canyon forces
  {
    id: 'kills_canyon',
    icon: '🦂',
    category: AchievementCategory.COMBAT,
    name: 'Sandstorm Breaker',
    metric: 'canyonKills',
    unit: 'Canyon foes',
    tiers: [
      { tier: 1, threshold: 50, title: 'Dune Sweeper I', description: 'Defeat 50 Golden Canyon enemies (scarabs, raiders, slingers, tomb guardians).', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 200, title: 'Dune Sweeper II', description: 'Defeat 200 Golden Canyon enemies.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 600, title: 'Tomb Sealer', description: 'Defeat 600 Golden Canyon enemies!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 2000, title: 'Pharaoh\'s Wrath', description: 'Defeat 2,000 Golden Canyon enemies!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 6000, title: 'Sands of Eternity', description: 'Defeat 6,000 Golden Canyon enemies!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 11. Combat - Arcane Rift forces
  {
    id: 'kills_rift',
    icon: '🌀',
    category: AchievementCategory.COMBAT,
    name: 'Rift Warden',
    metric: 'riftKills',
    unit: 'Rift foes',
    tiers: [
      { tier: 1, threshold: 50, title: 'Void Closer I', description: 'Banish 50 Arcane Rift enemies (wisps, stalkers, spellbreakers, constructs).', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 200, title: 'Void Closer II', description: 'Banish 200 Arcane Rift enemies.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 600, title: 'Riftsealer', description: 'Banish 600 Arcane Rift enemies!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 2000, title: 'Keeper of the Weave', description: 'Banish 2,000 Arcane Rift enemies!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 6000, title: 'Master of the Void', description: 'Banish 6,000 Arcane Rift enemies!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 12. Combat - Infernal Citadel forces
  {
    id: 'kills_infernal',
    icon: '😈',
    category: AchievementCategory.COMBAT,
    name: 'Demon Bane',
    metric: 'infernalKills',
    unit: 'Demons',
    tiers: [
      { tier: 1, threshold: 50, title: 'Hellwalker I', description: 'Slay 50 Infernal Citadel enemies (imps, hellhounds, cultists, brutes).', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 200, title: 'Hellwalker II', description: 'Slay 200 Infernal Citadel enemies.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 600, title: 'Citadel Stormer', description: 'Slay 600 Infernal Citadel enemies!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 2000, title: 'Hellfire Quencher', description: 'Slay 2,000 Infernal Citadel enemies!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 6000, title: 'Sealer of the Abyss', description: 'Slay 6,000 Infernal Citadel enemies!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 13. Combat - Mission bosses
  {
    id: 'kills_boss',
    icon: '👑',
    category: AchievementCategory.COMBAT,
    name: 'Kingslayer',
    metric: 'bossKills',
    unit: 'Bosses',
    tiers: [
      { tier: 1, threshold: 1, title: 'Giant Slayer I', description: 'Defeat a mission boss at the climax of Wave 25.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 3, title: 'Giant Slayer II', description: 'Defeat 3 mission bosses.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 5, title: 'Kingslayer', description: 'Defeat 5 mission bosses!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 15, title: 'Tyrant\'s End', description: 'Defeat 15 mission bosses!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 40, title: 'Doom of Warlords', description: 'Defeat 40 mission bosses!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 14. Combat - Clashes won after arena escalation kicked in
  {
    id: 'escalation_survived',
    icon: '🔥',
    category: AchievementCategory.COMBAT,
    name: 'Trial by Fire',
    metric: 'escalatedClashesWon',
    unit: 'Escalated Clashes',
    tiers: [
      { tier: 1, threshold: 1, title: 'Into the Blaze I', description: 'Win a wave after the arena clash escalates.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 10, title: 'Into the Blaze II', description: 'Win 10 escalated clashes.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 30, title: 'Forged in Flame', description: 'Win 30 escalated clashes!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 80, title: 'Phoenix Heart', description: 'Win 80 escalated clashes!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 200, title: 'Unburnt', description: 'Win 200 escalated clashes!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 15. Towers - Master Architect (Unique Tower Types Maxed to Rank 10)
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

  // 16. Towers - Towers built
  {
    id: 'towers_built',
    icon: '🏗️',
    category: AchievementCategory.TOWERS,
    name: 'Master Builder',
    metric: 'towersBuilt',
    unit: 'Towers',
    tiers: [
      { tier: 1, threshold: 25, title: 'Mason I', description: 'Build 25 towers.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 150, title: 'Mason II', description: 'Build 150 towers.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 500, title: 'Master Mason', description: 'Build 500 towers!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 1500, title: 'City of Spires', description: 'Build 1,500 towers!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 5000, title: 'Shaper of the Land', description: 'Build 5,000 towers!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 17. Evolution - Champions Ascended
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
      { tier: 3, threshold: 100, title: 'Army of Legends', description: 'Evolve 100 recruits into Champions!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 300, title: 'Hall of Heroes', description: 'Evolve 300 recruits into Champions!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 1000, title: 'Pantheon Builder', description: 'Evolve 1,000 recruits into Champions!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 18. Strategy - Flawless Waves (Castle took 0 damage)
  {
    id: 'flawless_waves',
    icon: '🏯',
    category: AchievementCategory.CAMPAIGN,
    name: 'Impenetrable Citadel',
    metric: 'flawlessWaves',
    unit: 'Flawless Waves',
    tiers: [
      { tier: 1, threshold: 5, title: 'Untouchable I', description: 'Clear 5 waves without the Castle taking any damage.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 20, title: 'Untouchable II', description: 'Clear 20 waves without Castle damage.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 50, title: 'Aegis of the Kingdom', description: 'Clear 50 flawless waves!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 150, title: 'Unbreachable', description: 'Clear 150 flawless waves!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 400, title: 'The Eternal Wall', description: 'Clear 400 flawless waves!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 19. Campaign - Waves cleared
  {
    id: 'waves_cleared',
    icon: '🌊',
    category: AchievementCategory.CAMPAIGN,
    name: 'Tide Turner',
    metric: 'wavesCleared',
    unit: 'Waves',
    tiers: [
      { tier: 1, threshold: 10, title: 'Holdfast I', description: 'Clear 10 waves.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 50, title: 'Holdfast II', description: 'Clear 50 waves.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 150, title: 'Breakwater', description: 'Clear 150 waves!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 400, title: 'Stormwarden', description: 'Clear 400 waves!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 1000, title: 'Master of Tides', description: 'Clear 1,000 waves!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 20. Campaign - Missions won (replays count)
  {
    id: 'missions_won',
    icon: '🚩',
    category: AchievementCategory.CAMPAIGN,
    name: 'Veteran Commander',
    metric: 'missionsWon',
    unit: 'Victories',
    tiers: [
      { tier: 1, threshold: 1, title: 'Field Commander I', description: 'Win a campaign mission.', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 5, title: 'Field Commander II', description: 'Win 5 campaign missions (replays count).', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 15, title: 'War Hero', description: 'Win 15 campaign missions!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 40, title: 'Lord Protector', description: 'Win 40 campaign missions!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 100, title: 'Undying Legend', description: 'Win 100 campaign missions!', badge: '🌟', badgeName: 'Legendary' }
    ]
  },

  // 21. Campaign - Stars Earned
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
      { tier: 3, threshold: MAX_CAMPAIGN_STARS, title: 'Grand Marshal', description: `Earn all ${MAX_CAMPAIGN_STARS} Campaign Stars across every mission!`, badge: '🥇', badgeName: 'Gold' }
    ]
  },

  // 22. Multiplayer - Match victories (co-op or PvP)
  {
    id: 'multiplayer_wins',
    icon: '🤝',
    category: AchievementCategory.CAMPAIGN,
    name: 'Brothers in Arms',
    metric: 'multiplayerWins',
    unit: 'Match Wins',
    tiers: [
      { tier: 1, threshold: 1, title: 'Allied Victory I', description: 'Win a multiplayer match (co-op or PvP).', badge: '🥉', badgeName: 'Bronze' },
      { tier: 2, threshold: 5, title: 'Allied Victory II', description: 'Win 5 multiplayer matches.', badge: '🥈', badgeName: 'Silver' },
      { tier: 3, threshold: 20, title: 'Banner Bearer', description: 'Win 20 multiplayer matches!', badge: '🥇', badgeName: 'Gold' },
      { tier: 4, threshold: 50, title: 'Warlord of the Realms', description: 'Win 50 multiplayer matches!', badge: '💎', badgeName: 'Platinum' },
      { tier: 5, threshold: 120, title: 'Undisputed Champion', description: 'Win 120 multiplayer matches!', badge: '🌟', badgeName: 'Legendary' }
    ]
  }
];
