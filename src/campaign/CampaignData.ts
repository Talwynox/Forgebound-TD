import { EnemyClass } from '../units/UnitData';

export interface WaveDef {
  waveNumber: number;
  enemies: { enemyClass: EnemyClass; count: number; delayBetween: number }[];
  rewardGold: number;
}

export interface CampaignMission {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  briefing: string;
  startingGold: number;
  castleMaxHp: number;
  enemyCitadelHp: number;
  waves: WaveDef[];
  starObjectives: [string, string, string];
}

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  {
    id: 1,
    title: 'Mission 1: The Frontier Outpost',
    subtitle: 'Forest Vale - Goblin Incursion',
    description: 'Establish basic mazing tactics using Vitality Shrines and Flame Obelisks.',
    briefing: 'Commander, Goblin skirmishers are raiding our frontier. Set up a maze with Vitality Shrines and Flame Obelisks so our recruits are heavily buffed before charging into the arena!',
    startingGold: 220,
    castleMaxHp: 100,
    enemyCitadelHp: 300,
    waves: [
      {
        waveNumber: 1,
        enemies: [{ enemyClass: EnemyClass.GOBLIN, count: 6, delayBetween: 0.8 }],
        rewardGold: 50
      },
      {
        waveNumber: 2,
        enemies: [{ enemyClass: EnemyClass.GOBLIN, count: 10, delayBetween: 0.6 }],
        rewardGold: 70
      },
      {
        waveNumber: 3,
        enemies: [
          { enemyClass: EnemyClass.GOBLIN, count: 8, delayBetween: 0.5 },
          { enemyClass: EnemyClass.ORC_WARRIOR, count: 2, delayBetween: 1.2 }
        ],
        rewardGold: 100
      }
    ],
    starObjectives: [
      'Defeat all 3 enemy waves',
      'Maintain Citadel HP above 80%',
      'Achieve at least 1 Unit Evolution'
    ]
  },
  {
    id: 2,
    title: 'Mission 2: Ironforge Pass',
    subtitle: 'Rocky Crags - Armored Marauders',
    description: 'Deploy Iron Forges for heavy armor plating and Aura Spires to accelerate nearby towers.',
    briefing: 'Heavy Orc Marauders are marching down the crag. Their axes cut deep — build Iron Forges to grant your units armor mitigation, and place Aura Spires to supercharge your buff towers!',
    startingGold: 260,
    castleMaxHp: 120,
    enemyCitadelHp: 500,
    waves: [
      {
        waveNumber: 1,
        enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 5, delayBetween: 1.0 }],
        rewardGold: 60
      },
      {
        waveNumber: 2,
        enemies: [
          { enemyClass: EnemyClass.ORC_WARRIOR, count: 6, delayBetween: 0.9 },
          { enemyClass: EnemyClass.SKELETON_ARCHER, count: 4, delayBetween: 0.7 }
        ],
        rewardGold: 80
      },
      {
        waveNumber: 3,
        enemies: [
          { enemyClass: EnemyClass.ORC_WARRIOR, count: 8, delayBetween: 0.8 },
          { enemyClass: EnemyClass.SKELETON_ARCHER, count: 6, delayBetween: 0.6 }
        ],
        rewardGold: 110
      },
      {
        waveNumber: 4,
        enemies: [
          { enemyClass: EnemyClass.ORC_WARRIOR, count: 10, delayBetween: 0.7 },
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 2, delayBetween: 2.0 }
        ],
        rewardGold: 150
      }
    ],
    starObjectives: [
      'Repel the Orc Marauder assault',
      'Evolve a Heavy Knight (Tier 2 Armor)',
      'Finish with 100+ Castle HP remaining'
    ]
  },
  {
    id: 3,
    title: 'Mission 3: The Golden Canyon',
    subtitle: 'Sunken Mines - Economic Dominance',
    description: 'Utilize Gold Spires (Midas on Hit vs Vault Interest) and Frost Monoliths to slow unit pacing.',
    briefing: 'We need enormous gold reserves to fund our war campaign! Build Gold Spires to generate currency, and place Frost Monoliths to slow your units down so surrounding towers can hit them dozens of times!',
    startingGold: 280,
    castleMaxHp: 150,
    enemyCitadelHp: 750,
    waves: [
      {
        waveNumber: 1,
        enemies: [{ enemyClass: EnemyClass.GOBLIN, count: 12, delayBetween: 0.5 }],
        rewardGold: 70
      },
      {
        waveNumber: 2,
        enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 8, delayBetween: 0.7 }],
        rewardGold: 90
      },
      {
        waveNumber: 3,
        enemies: [
          { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 10, delayBetween: 0.6 },
          { enemyClass: EnemyClass.SKELETON_ARCHER, count: 6, delayBetween: 0.6 }
        ],
        rewardGold: 130
      },
      {
        waveNumber: 4,
        enemies: [
          { enemyClass: EnemyClass.ORC_WARRIOR, count: 10, delayBetween: 0.7 },
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 3, delayBetween: 1.5 }
        ],
        rewardGold: 180
      }
    ],
    starObjectives: [
      'Clear all 4 waves of agile assassins',
      'Amass over 400 Gold in reserve',
      'Evolve a Fire Berserker (High Attack)'
    ]
  },
  {
    id: 4,
    title: 'Mission 4: The Rulebreaker\'s Trial',
    subtitle: 'Arcane Rift - Rewriting Reality',
    description: 'Use The Rulebreaker to force fixed 500-1200 HP on units and unlock Tier 3 Paladins.',
    briefing: 'The enemy has unleashed heavy Ironclad Crushers that shrug off basic strikes. Harness the forbidden "Rulebreaker" tower to instantly rewrite your units\' HP to titanic levels and ascend them into Sun Paladins and Colossi!',
    startingGold: 320,
    castleMaxHp: 180,
    enemyCitadelHp: 1000,
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { enemyClass: EnemyClass.ORC_WARRIOR, count: 8, delayBetween: 0.8 },
          { enemyClass: EnemyClass.SKELETON_ARCHER, count: 4, delayBetween: 0.6 }
        ],
        rewardGold: 80
      },
      {
        waveNumber: 2,
        enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 12, delayBetween: 0.5 }],
        rewardGold: 110
      },
      {
        waveNumber: 3,
        enemies: [
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 4, delayBetween: 1.8 },
          { enemyClass: EnemyClass.ORC_WARRIOR, count: 8, delayBetween: 0.7 }
        ],
        rewardGold: 150
      },
      {
        waveNumber: 4,
        enemies: [
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 6, delayBetween: 1.5 },
          { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 8, delayBetween: 0.6 }
        ],
        rewardGold: 200
      },
      {
        waveNumber: 5,
        enemies: [
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 8, delayBetween: 1.4 }
        ],
        rewardGold: 250
      }
    ],
    starObjectives: [
      'Survive the Ironclad Crusher onslaught',
      'Ascend a unit into a Tier 3 Sun Paladin or Pyro Colossus',
      'Finish mission with 120+ Castle HP'
    ]
  },
  {
    id: 5,
    title: 'Mission 5: The Infernal Citadel',
    subtitle: 'Molten Core - Final Showdown',
    description: 'Face Lord Ignis in a legendary battle combining all towers, branching upgrades, and evolutions.',
    briefing: 'Lord Ignis has risen from the molten depths. His hellfire aura burns all who approach unprepared. Construct your master maze with full branching synergies and slow-stacking enhancements to vanquish the Demon Lord!',
    startingGold: 400,
    castleMaxHp: 200,
    enemyCitadelHp: 1500,
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { enemyClass: EnemyClass.ORC_WARRIOR, count: 10, delayBetween: 0.7 },
          { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 8, delayBetween: 0.5 }
        ],
        rewardGold: 100
      },
      {
        waveNumber: 2,
        enemies: [
          { enemyClass: EnemyClass.SKELETON_ARCHER, count: 12, delayBetween: 0.5 },
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 4, delayBetween: 1.5 }
        ],
        rewardGold: 140
      },
      {
        waveNumber: 3,
        enemies: [
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 7, delayBetween: 1.2 },
          { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 10, delayBetween: 0.5 }
        ],
        rewardGold: 190
      },
      {
        waveNumber: 4,
        enemies: [
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 10, delayBetween: 1.0 },
          { enemyClass: EnemyClass.SKELETON_ARCHER, count: 10, delayBetween: 0.5 }
        ],
        rewardGold: 250
      },
      {
        waveNumber: 5,
        enemies: [
          { enemyClass: EnemyClass.BOSS_LORD_IGNIS, count: 1, delayBetween: 3.0 },
          { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 4, delayBetween: 1.5 },
          { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 8, delayBetween: 0.5 }
        ],
        rewardGold: 400
      }
    ],
    starObjectives: [
      'Vanquish Lord Ignis and destroy the Molten Citadel',
      'Field at least two Tier 3 Champions (Paladin, Colossus, Archmage)',
      'Achieve victory without losing your Castle'
    ]
  }
];
