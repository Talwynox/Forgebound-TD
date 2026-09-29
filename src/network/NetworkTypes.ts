import { GridCoord } from '../grid/Grid';
import { TowerType, UpgradeBranch } from '../towers/TowerData';
import { EnemyClass } from '../units/UnitData';

export type GameMode = 'COOP' | 'PVP';
export type TeamId = 'SUN' | 'MOON';

export interface PlayerSlot {
  peerId: string;
  name: string;
  team: TeamId;
  slotIndex: number; // 0..3 within team
  isHost: boolean;
  isReady: boolean;
  pingMs: number;
  gold: number;
  income: number;
}

export const TEAM_COLORS: Record<TeamId, string[]> = {
  SUN: ['#facc15', '#38bdf8', '#34d399', '#f472b6'], // Gold, Sky Blue, Emerald, Rose
  MOON: ['#ef4444', '#a855f7', '#f97316', '#06b6d4']  // Crimson, Arcane Violet, Fiery Orange, Cyan
};

export interface MercenaryDef {
  enemyClass: EnemyClass;
  name: string;
  cost: number;
  incomeBonus: number;
  description: string;
  icon: string;
}

export const MERCENARY_DEFINITIONS: Record<string, MercenaryDef> = {
  [EnemyClass.GOBLIN]: {
    enemyClass: EnemyClass.GOBLIN,
    name: 'Goblin Raider',
    cost: 40,
    incomeBonus: 4,
    description: 'Fast agile scout. Low HP but swiftly slips through defenses.',
    icon: '👺'
  },
  [EnemyClass.SKELETON_ARCHER]: {
    enemyClass: EnemyClass.SKELETON_ARCHER,
    name: 'Skeleton Marksman',
    cost: 75,
    incomeBonus: 7,
    description: 'Ranged piercing archer attacking from safety.',
    icon: '🏹'
  },
  [EnemyClass.ORC_WARRIOR]: {
    enemyClass: EnemyClass.ORC_WARRIOR,
    name: 'Orc Marauder',
    cost: 110,
    incomeBonus: 11,
    description: 'Heavy cleaving warrior with solid armor and health.',
    icon: '🪓'
  },
  [EnemyClass.SHADOW_ASSASSIN]: {
    enemyClass: EnemyClass.SHADOW_ASSASSIN,
    name: 'Shadow Assassin',
    cost: 170,
    incomeBonus: 17,
    description: 'Deadly high-speed assassin with high critical burst.',
    icon: '🗡️'
  },
  [EnemyClass.IRONCLAD_OGRE]: {
    enemyClass: EnemyClass.IRONCLAD_OGRE,
    name: 'Ironclad Crusher',
    cost: 260,
    incomeBonus: 26,
    description: 'Massive siege brute that pulverizes champions and Stronghold gates.',
    icon: '🛡️'
  },
  [EnemyClass.BOSS_LORD_IGNIS]: {
    enemyClass: EnemyClass.BOSS_LORD_IGNIS,
    name: 'Lord Ignis Overlord',
    cost: 600,
    incomeBonus: 60,
    description: 'Hellfire titan with colossal health and infernal aura.',
    icon: '🔥'
  }
};

export interface UnitSnapshot {
  id: number;
  isFriendly: boolean;
  team: TeamId;
  unitClass: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  currentHp: number;
  maxHp: number;
  isDead: boolean;
  inCombat: boolean;
  tier: number;
}

export interface StateSnapshotPayload {
  waveNumber: number;
  wavePhase: 'IDLE' | 'MAZE_RUN' | 'ARENA_CLASH';
  sunCastleHp: number;
  sunCastleMaxHp: number;
  moonCastleHp?: number;
  moonCastleMaxHp?: number;
  playerGolds: Record<string, number>;
  playerIncomes: Record<string, number>;
  units: UnitSnapshot[];
}

export type NetworkMessage =
  // Handshake & Lobby
  | { type: 'ACTION_JOIN_LOBBY'; name: string }
  | { type: 'ACTION_SELECT_TEAM'; team: TeamId }
  | { type: 'ACTION_SET_READY'; ready: boolean }
  | { type: 'ACTION_SELECT_MODE'; mode: GameMode }
  | { type: 'ACTION_SELECT_MISSION'; missionId: number }
  | { type: 'ACTION_START_MATCH' }
  | { type: 'LOBBY_STATE'; mode: GameMode; missionId: number; players: PlayerSlot[] }
  | { type: 'MATCH_START'; mode: GameMode; missionId: number; players: PlayerSlot[]; startingGold: number }

  // Gameplay Actions (Client -> Host)
  | { type: 'ACTION_BUILD_TOWER'; team: TeamId; coord: GridCoord; towerType: TowerType }
  | { type: 'ACTION_UPGRADE_TOWER'; towerId: number; branch: UpgradeBranch }
  | { type: 'ACTION_SELL_TOWER'; towerId: number }
  | { type: 'ACTION_EVO_UPGRADE'; towerId: number; abilityIndex: 1 | 2 | 3 | 4 }
  | { type: 'ACTION_BUY_RECRUIT'; team: TeamId }
  | { type: 'ACTION_SEND_MERCENARY'; enemyClass: EnemyClass }
  | { type: 'ACTION_START_WAVE_READY'; ready: boolean }
  | { type: 'ACTION_CURSOR_MOVE'; worldX: number; worldZ: number; selectedTower?: TowerType | null }
  | { type: 'ACTION_PING_MAP'; worldX: number; worldZ: number }

  // Latency Heartbeats
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number }

  // Host Broadcast Events & Snapshots (Host -> Clients)
  | { type: 'STATE_SNAPSHOT'; snapshot: StateSnapshotPayload }
  | { type: 'EVENT_TOWER_BUILT'; id: number; team: TeamId; ownerPeerId: string; towerType: TowerType; coord: GridCoord }
  | { type: 'EVENT_TOWER_UPGRADED'; id: number; ownerPeerId: string; branch: UpgradeBranch; level: number }
  | { type: 'EVENT_TOWER_SOLD'; id: number; ownerPeerId: string; refundGold: number }
  | { type: 'EVENT_MERCENARY_SUMMONED'; senderPeerId: string; senderTeam: TeamId; enemyClass: EnemyClass }
  | { type: 'EVENT_CURSOR_BROADCAST'; peerId: string; team: TeamId; worldX: number; worldZ: number; selectedTower?: TowerType | null }
  | { type: 'EVENT_PING_BROADCAST'; peerId: string; team: TeamId; worldX: number; worldZ: number }
  | { type: 'EVENT_WAVE_COUNTDOWN'; secondsLeft: number }
  | { type: 'EVENT_MATCH_END'; winningTeam: TeamId; isCoopVictory?: boolean };
