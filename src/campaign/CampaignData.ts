import { EnemyClass } from '../units/UnitData';
import type { MazeLayoutId } from '../grid/MazeLayouts';
import type { MapThemeId } from '../engine/MapThemes';
import { generateWaves } from './WaveGenerator';

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
  mazeLayout: MazeLayoutId;
  theme: MapThemeId;
  /** Multiplies enemy HP and Attack (later missions hit harder). */
  enemyStatMult: number;
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
  { waveNumber: 25, enemies: [{ enemyClass: EnemyClass.BOSS_GOBLIN_WARLORD, count: 1, delayBetween: 2.5 }, { enemyClass: EnemyClass.IRONCLAD_OGRE, count: 16, delayBetween: 0.85 }, { enemyClass: EnemyClass.SHADOW_ASSASSIN, count: 18, delayBetween: 0.35 }, { enemyClass: EnemyClass.SKELETON_ARCHER, count: 16, delayBetween: 0.35 }], rewardGold: 650 }
];

/** Star objectives mirror how stars are actually awarded: by castle HP left at the end. */
function starObjectives(bossName: string): [string, string, string] {
  return [
    `Survive all 25 waves and defeat ${bossName}`,
    'Win with at least 40% Castle HP remaining',
    'Win with at least 75% Castle HP remaining'
  ];
}

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  {
    id: 1,
    title: 'Mission 1: The Frontier Outpost',
    subtitle: 'Forest Vale - The 25 Waves of Valor',
    description: 'Goblin raiders, orc marauders and siege crushers pour out of the forest. Learn the maze and hold the frontier.',
    briefing: 'Commander, the raider clans have united under Grukk the Goblin Warlord! Build a winding maze with Vitality Shrines, Iron Forges and Flame Obelisks to empower your recruits, and break his warband before he blows the war horn one last time.',
    startingGold: 250,
    castleMaxHp: 800,
    castleHpPerWave: 150,
    mazeLayout: 'FRONTIER',
    theme: 'FRONTIER',
    enemyStatMult: 1,
    waves: MISSION_1_WAVES,
    starObjectives: starObjectives('Grukk the Goblin Warlord')
  },
  {
    id: 2,
    title: 'Mission 2: Ironforge Pass',
    subtitle: 'Mountain Switchbacks - The Iron Legion',
    description: 'A long switchback road where every plot overlooks two lanes. Clockwork automatons, sappers and trolls hold the pass.',
    briefing: 'The mountain forges have woken. Iron Automatons shrug off single heavy blows but crack under a storm of hits, Forge Bombers explode when they fall, and Rock Trolls regenerate unless you burst them down. At the summit waits the Iron Colossus, whose plating reforges itself.',
    startingGold: 280,
    castleMaxHp: 1000,
    castleHpPerWave: 200,
    mazeLayout: 'IRONFORGE',
    theme: 'IRONFORGE',
    enemyStatMult: 1.08,
    waves: generateWaves({
      seed: 2,
      budgetMult: 1.05,
      rewardMult: 1.05,
      boss: EnemyClass.BOSS_IRON_COLOSSUS,
      roster: [
        { enemyClass: EnemyClass.FORGE_BOMBER, from: 1, weight: 3 },
        { enemyClass: EnemyClass.IRON_AUTOMATON, from: 2, weight: 3 },
        { enemyClass: EnemyClass.IRON_ARBALIST, from: 4, weight: 2 },
        { enemyClass: EnemyClass.ROCK_TROLL, from: 7, weight: 2 }
      ]
    }),
    starObjectives: starObjectives('the Iron Colossus')
  },
  {
    id: 3,
    title: 'Mission 3: The Golden Canyon',
    subtitle: 'Twin Mesas - Sands of the Buried Kings',
    description: 'A short road around two wide mesas: plenty of room to build, but little road to buff on. Scarab swarms and dodging raiders ride the dunes.',
    briefing: 'The canyon tombs are open. Scarab Swarmers come in floods, Sand Raiders dodge a third of all attacks, Dune Slingers pelt you from range and Tomb Guardians shrug off arrows. Beneath the sand, Sandmaw the Devourer hunts the weakest in your rear lines.',
    startingGold: 320,
    castleMaxHp: 1100,
    castleHpPerWave: 220,
    mazeLayout: 'CANYON',
    theme: 'CANYON',
    enemyStatMult: 1.1,
    waves: generateWaves({
      seed: 3,
      budgetMult: 1.05,
      rewardMult: 1.1,
      boss: EnemyClass.BOSS_SAND_WYRM,
      roster: [
        { enemyClass: EnemyClass.SCARAB_SWARMER, from: 1, weight: 4 },
        { enemyClass: EnemyClass.SAND_RAIDER, from: 2, weight: 3 },
        { enemyClass: EnemyClass.DUNE_SLINGER, from: 4, weight: 2 },
        { enemyClass: EnemyClass.TOMB_GUARDIAN, from: 7, weight: 2 }
      ]
    }),
    starObjectives: starObjectives('Sandmaw the Devourer')
  },
  {
    id: 4,
    title: 'Mission 4: The Arcane Rift',
    subtitle: 'Fault Lines - Where the Rules Break',
    description: 'A short, jagged road cut by the rift. Its creatures ignore armor, strip your blessings and blink behind your lines.',
    briefing: 'Reality is tearing. Void Wisps burn through any armor, Spellbreakers unravel what your towers granted, Rift Stalkers blink straight at your backline and Arcane Constructs reflect the blows they take. The Unbound Archon waits at the heart of the rift, rewriting the health of everything around it.',
    startingGold: 360,
    castleMaxHp: 1200,
    castleHpPerWave: 240,
    mazeLayout: 'RIFT',
    theme: 'RIFT',
    enemyStatMult: 1.18,
    waves: generateWaves({
      seed: 4,
      budgetMult: 1.1,
      rewardMult: 1.15,
      boss: EnemyClass.BOSS_RIFT_ARCHON,
      roster: [
        { enemyClass: EnemyClass.VOID_WISP, from: 1, weight: 3 },
        { enemyClass: EnemyClass.SPELLBREAKER, from: 2, weight: 3 },
        { enemyClass: EnemyClass.RIFT_STALKER, from: 3, weight: 2 },
        { enemyClass: EnemyClass.ARCANE_CONSTRUCT, from: 7, weight: 2 }
      ]
    }),
    starObjectives: starObjectives('the Unbound Archon')
  },
  {
    id: 5,
    title: 'Mission 5: The Infernal Citadel',
    subtitle: 'The Battlements - Final Showdown',
    description: 'Fight along the citadel battlements, where every notch touches the road on three sides. Burning hordes guard Lord Ignis himself.',
    briefing: 'This is the end of the road. Cinder Imps and Hellhounds set everything on fire, Fire Cultists mend the horde from the back lines and Demon Brutes cleave through tight formations. Lord Ignis waits behind them: his hellfire aura burns, his stomp shatters, and at half health his Magma Shield hardens.',
    startingGold: 420,
    castleMaxHp: 1400,
    castleHpPerWave: 280,
    mazeLayout: 'CITADEL',
    theme: 'CITADEL',
    enemyStatMult: 1.28,
    waves: generateWaves({
      seed: 5,
      budgetMult: 1.15,
      rewardMult: 1.2,
      boss: EnemyClass.BOSS_LORD_IGNIS,
      roster: [
        { enemyClass: EnemyClass.IMP, from: 1, weight: 3 },
        { enemyClass: EnemyClass.HELLHOUND, from: 2, weight: 3 },
        { enemyClass: EnemyClass.FIRE_CULTIST, from: 4, weight: 2 },
        { enemyClass: EnemyClass.DEMON_BRUTE, from: 6, weight: 2 }
      ]
    }),
    starObjectives: starObjectives('Lord Ignis')
  }
];
