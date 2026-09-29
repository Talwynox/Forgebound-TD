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
  castleHpPerWave?: number; // Fortification bonus added to maxHp and currentHp each cleared wave without healing
  waves: WaveDef[];
  starObjectives: [string, string, string];
}

// 25 Progressive Waves for Mission 1
const MISSION_1_WAVES: WaveDef[] = [
  { waveNumber: 1, enemies: [{ enemyClass: EnemyClass.GOBLIN, count: 2, delayBetween: 1.2 }], rewardGold: 50 },
  { waveNumber: 2, enemies: [{ enemyClass: EnemyClass.GOBLIN, count: 4, delayBetween: 1.0 }], rewardGold: 55 },
  { waveNumber: 3, enemies: [{ enemyClass: EnemyClass.GOBLIN, count: 6, delayBetween: 0.8 }, { enemyClass: EnemyClass.ORC_WARRIOR, count: 1, delayBetween: 1.2 }], rewardGold: 65 },
  { waveNumber: 4, enemies: [{ enemyClass: EnemyClass.GOBLIN, count: 8, delayBetween: 0.7 }, { enemyClass: EnemyClass.ORC_WARRIOR, count: 2, delayBetween: 1.0 }], rewardGold: 75 },
  { waveNumber: 5, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 1, delayBetween: 2.0 }, { enemyClass: EnemyClass.GOBLIN, count: 10, delayBetween: 0.5 }], rewardGold: 90 },
  { waveNumber: 6, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 8, delayBetween: 0.8 }], rewardGold: 80 },
  { waveNumber: 7, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 8, delayBetween: 0.8 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 4, delayBetween: 0.6 }], rewardGold: 90 },
  { waveNumber: 8, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 12, delayBetween: 0.6 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 8, delayBetween: 0.5 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 2, delayBetween: 1.5 }], rewardGold: 105 },
  { waveNumber: 9, enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 14, delayBetween: 0.45 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 8, delayBetween: 0.5 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 2, delayBetween: 1.5 }], rewardGold: 120 },
  { waveNumber: 10, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 5, delayBetween: 1.4 }, { enemyClass: EnemyClass.ORC_WARRIOR, count: 14, delayBetween: 0.5 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 8, delayBetween: 0.5 }], rewardGold: 150 },
  { waveNumber: 11, enemies: [{ enemyClass: EnemyClass.SKELETON_ARCHER, count: 14, delayBetween: 0.45 }, { enemyClass: EnemyClass.ORC_WARRIOR, count: 12, delayBetween: 0.5 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 4, delayBetween: 1.4 }], rewardGold: 150 },
  { waveNumber: 12, enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 16, delayBetween: 0.4 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 6, delayBetween: 1.3 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 10, delayBetween: 0.5 }], rewardGold: 170 },
  { waveNumber: 13, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 16, delayBetween: 0.5 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 12, delayBetween: 0.45 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 6, delayBetween: 1.2 }], rewardGold: 185 },
  { waveNumber: 14, enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 18, delayBetween: 0.4 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 8, delayBetween: 1.2 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 12, delayBetween: 0.45 }], rewardGold: 210 },
  { waveNumber: 15, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 10, delayBetween: 1.1 }, { enemyClass: EnemyClass.ORC_WARRIOR, count: 16, delayBetween: 0.5 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 14, delayBetween: 0.4 }], rewardGold: 240 },
  { waveNumber: 16, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 18, delayBetween: 0.45 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 14, delayBetween: 0.4 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 10, delayBetween: 1.1 }], rewardGold: 250 },
  { waveNumber: 17, enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 22, delayBetween: 0.35 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 12, delayBetween: 1.0 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 10, delayBetween: 0.4 }], rewardGold: 275 },
  { waveNumber: 18, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 14, delayBetween: 1.0 }, { enemyClass: EnemyClass.ORC_WARRIOR, count: 16, delayBetween: 0.45 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 14, delayBetween: 0.4 }], rewardGold: 300 },
  { waveNumber: 19, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 16, delayBetween: 0.95 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 16, delayBetween: 0.4 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 16, delayBetween: 0.35 }], rewardGold: 320 },
  { waveNumber: 20, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 18, delayBetween: 0.9 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 18, delayBetween: 0.35 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 14, delayBetween: 0.4 }], rewardGold: 360 },
  { waveNumber: 21, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 20, delayBetween: 0.4 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 18, delayBetween: 0.35 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 16, delayBetween: 0.9 }], rewardGold: 380 },
  { waveNumber: 22, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 20, delayBetween: 0.85 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 18, delayBetween: 0.35 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 16, delayBetween: 0.35 }], rewardGold: 410 },
  { waveNumber: 23, enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 22, delayBetween: 0.35 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 18, delayBetween: 0.85 }, { enemyClass: EnemyClass.ORC_WARRIOR, count: 18, delayBetween: 0.4 }], rewardGold: 440 },
  { waveNumber: 24, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 24, delayBetween: 0.8 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 18, delayBetween: 0.35 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 16, delayBetween: 0.35 }], rewardGold: 490 },
  { waveNumber: 25, enemies: [{ enemyClass: EnemyClass.BOSS_LORD_IGNIS, count: 1, delayBetween: 2.5 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 16, delayBetween: 0.85 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 18, delayBetween: 0.35 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 16, delayBetween: 0.35 }], rewardGold: 650 }
];

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  {
    id: 1,
    title: 'Mission 1: The Frontier Outpost',
    subtitle: 'Forest Vale - The 25 Waves of Valor',
    description: 'Establish your master maze and survive 25 escalating waves of goblin raiders, orc hordes, and siege crushers.',
    briefing: 'Commander, the enemy vanguard is launching a massive 25-wave siege against our frontier outpost! Build a winding maze with Vitality Shrines, Iron Forges, and Flame Obelisks to empower your recruits, and prepare for the final overlord in Wave 25!',
    startingGold: 250,
    castleMaxHp: 800,
    castleHpPerWave: 150,
    waves: MISSION_1_WAVES,
    starObjectives: [
      'Survive and defeat all 25 enemy waves',
      'Maintain Castle HP above 75%',
      'Achieve at least 2 Unit Evolutions (Tier 2 or Tier 3)'
    ]
  },
  {
    id: 2,
    title: 'Mission 2: Ironforge Pass',
    subtitle: 'Rocky Crags - Armored Marauders',
    description: 'Deploy Iron Forges for heavy armor plating and Aura Spires to accelerate nearby towers.',
    briefing: 'Heavy Orc Marauders are marching down the crag. Their axes cut deep — build Iron Forges to grant your units armor mitigation, and place Aura Spires to supercharge your buff towers!',
    startingGold: 280,
    castleMaxHp: 1000,
    castleHpPerWave: 250,
    waves: [
      { waveNumber: 1, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 6, delayBetween: 1.0 }], rewardGold: 65 },
      { waveNumber: 2, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 8, delayBetween: 0.9 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 4, delayBetween: 0.7 }], rewardGold: 85 },
      { waveNumber: 3, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 10, delayBetween: 0.8 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 6, delayBetween: 0.6 }], rewardGold: 115 },
      { waveNumber: 4, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 12, delayBetween: 0.7 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 3, delayBetween: 1.8 }], rewardGold: 160 }
    ],
    starObjectives: [
      'Repel the Orc Marauder assault',
      'Evolve a Heavy Knight (Tier 2 Armor)',
      'Finish with 700+ Castle HP remaining'
    ]
  },
  {
    id: 3,
    title: 'Mission 3: The Golden Canyon',
    subtitle: 'Sunken Mines - Economic Dominance',
    description: 'Utilize Gold Spires (Midas on Hit vs Vault Interest) and Frost Monoliths to slow unit pacing.',
    briefing: 'We need enormous gold reserves to fund our war campaign! Build Gold Spires to generate currency, and place Frost Monoliths to slow your units down so surrounding towers can hit them dozens of times!',
    startingGold: 300,
    castleMaxHp: 1200,
    castleHpPerWave: 300,
    waves: [
      { waveNumber: 1, enemies: [{ enemyClass: EnemyClass.GOBLIN, count: 12, delayBetween: 0.5 }], rewardGold: 75 },
      { waveNumber: 2, enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 9, delayBetween: 0.7 }], rewardGold: 95 },
      { waveNumber: 3, enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 12, delayBetween: 0.6 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 6, delayBetween: 0.6 }], rewardGold: 135 },
      { waveNumber: 4, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 12, delayBetween: 0.7 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 4, delayBetween: 1.5 }], rewardGold: 190 }
    ],
    starObjectives: [
      'Clear all waves of agile assassins',
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
    startingGold: 350,
    castleMaxHp: 1500,
    castleHpPerWave: 350,
    waves: [
      { waveNumber: 1, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 9, delayBetween: 0.8 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 5, delayBetween: 0.6 }], rewardGold: 85 },
      { waveNumber: 2, enemies: [{ enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 14, delayBetween: 0.5 }], rewardGold: 115 },
      { waveNumber: 3, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 5, delayBetween: 1.8 }, { enemyClass: EnemyClass.ORC_WARRIOR, count: 10, delayBetween: 0.7 }], rewardGold: 160 },
      { waveNumber: 4, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 7, delayBetween: 1.5 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 10, delayBetween: 0.6 }], rewardGold: 210 },
      { waveNumber: 5, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 10, delayBetween: 1.4 }], rewardGold: 270 }
    ],
    starObjectives: [
      'Survive the Ironclad Crusher onslaught',
      'Ascend a unit into a Tier 3 Sun Paladin or Pyro Colossus',
      'Finish mission with 1000+ Castle HP'
    ]
  },
  {
    id: 5,
    title: 'Mission 5: The Infernal Citadel',
    subtitle: 'Molten Core - Final Showdown',
    description: 'Face Lord Ignis in a legendary battle combining all towers, branching upgrades, and evolutions.',
    briefing: 'Lord Ignis has risen from the molten depths. His hellfire aura burns all who approach unprepared. Construct your master maze with full branching synergies and slow-stacking enhancements to vanquish the Demon Lord!',
    startingGold: 450,
    castleMaxHp: 1800,
    castleHpPerWave: 400,
    waves: [
      { waveNumber: 1, enemies: [{ enemyClass: EnemyClass.ORC_WARRIOR, count: 12, delayBetween: 0.7 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 9, delayBetween: 0.5 }], rewardGold: 110 },
      { waveNumber: 2, enemies: [{ enemyClass: EnemyClass.SKELETON_ARCHER, count: 14, delayBetween: 0.5 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 5, delayBetween: 1.5 }], rewardGold: 150 },
      { waveNumber: 3, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 8, delayBetween: 1.2 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 12, delayBetween: 0.5 }], rewardGold: 200 },
      { waveNumber: 4, enemies: [{ enemyClass: EnemyClass.IRONCLAD_OGRE, count: 12, delayBetween: 1.0 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 12, delayBetween: 0.5 }], rewardGold: 270 },
      { waveNumber: 5, enemies: [{ enemyClass: EnemyClass.BOSS_LORD_IGNIS, count: 1, delayBetween: 3.0 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 6, delayBetween: 1.5 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 10, delayBetween: 0.5 }], rewardGold: 450 }
    ],
    starObjectives: [
      'Vanquish Lord Ignis and conquer the Molten Core',
      'Field at least two Tier 3 Champions (Paladin, Colossus, Archmage)',
      'Achieve victory without losing your Castle'
    ]
  }
];
