import { GridCoord } from '../grid/Grid';
import { TowerType, UpgradeBranch } from '../towers/TowerData';
import { EnemyClass } from '../units/UnitData';

export type GameMode = 'COOP' | 'PVP';
export type TeamId = 'SUN' | 'MOON';
export type WavePhase = 'IDLE' | 'MAZE_RUN' | 'ARENA_CLASH';

export const MAX_PLAYERS_PER_TEAM = 4;
export const MAX_NAME_LENGTH = 16;

export interface PlayerSlot {
  peerId: string;
  name: string;
  team: TeamId;
  slotIndex: number; // 0..3 within team
  isHost: boolean;
  isReady: boolean;
  /** Set by the host when the player drops mid-match (their slot is kept until the match ends). */
  disconnected?: boolean;
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

// --- Authoritative state snapshot (Host -> Clients) ---
// Units/towers/guardians are packed as flat tuples to keep the ~10Hz snapshot small.

/** Bit flags packed into UnitState[2]. */
export const UNIT_FLAG = {
  FRIENDLY: 1,
  IN_COMBAT: 2,
  DYING: 4,
  LUNGING: 8,
  FLINCHING: 16,
  COMPLETED_MAZE: 32,
  WAITING_IN_ARENA: 64,
  MAGMA_SHIELD: 128,
  MERCENARY: 256
} as const;

/** [id, unitClass, flags, x*100, y*100, z*100, yaw*100, hp, maxHp, armor, attack, mana] */
export type UnitState = [number, string, number, number, number, number, number, number, number, number, number, number];

/** [id, accumulatedStackBonus, roundsStacked, hasEvolvedThisWave (0|1), totalBuffApplied, totalHits] */
export type TowerState = [number, number, number, number, number, number];

/** [id, damageLevel, rangeLevel, totalDamageDealt, totalKills, shotsFired] */
export type GuardianState = [string, number, number, number, number, number];

/** [currentHp, maxHp, isDestroyed (0|1)] */
export type CastleState = [number, number, number];

/** A replicated VFX/audio call: [target ('v' = VFX, 'a' = audio), method name, encoded args] */
export type FxEvent = ['v' | 'a', string, unknown[]];

export interface StateSnapshot {
  waveIndex: number;
  wavePhase: WavePhase;
  waveInProgress: boolean;
  extraRecruits: number;
  gameSpeed: number;
  smartFocus: boolean;
  focusUnitId: number | null;
  sunCastle: CastleState;
  moonCastle: CastleState | null;
  /** peerId -> [gold, income] */
  economy: Record<string, [number, number]>;
  units: UnitState[];
  towers: TowerState[];
  guardians: GuardianState[];
  fx: FxEvent[];
}

// --- Gameplay actions (Client -> Host, or executed directly on the Host) ---

export type GameAction =
  | { kind: 'BUILD_TOWER'; coord: GridCoord; towerType: TowerType }
  | { kind: 'UPGRADE_TOWER'; towerId: number; branch: UpgradeBranch }
  | { kind: 'EVO_UPGRADE'; towerId: number; abilityIndex: 1 | 2 | 3 | 4 }
  | { kind: 'SELL_TOWER'; towerId: number }
  | { kind: 'BUY_RECRUIT' }
  | { kind: 'SEND_MERCENARY'; enemyClass: EnemyClass }
  | { kind: 'START_WAVE' }
  | { kind: 'UPGRADE_GUARDIAN'; guardianId: string; upgradeType: 'damage' | 'range' }
  | { kind: 'SET_FOCUS'; unitId: number | null }
  | { kind: 'TOGGLE_SMART_FOCUS' }
  | { kind: 'SET_GAME_SPEED'; speed: number };

// --- Discrete world events (Host -> Clients) ---

export type HostEvent =
  | { kind: 'TOWER_BUILT'; id: number; team: TeamId; ownerPeerId: string; towerType: TowerType; coord: GridCoord }
  | { kind: 'TOWER_UPGRADED'; id: number; branch: UpgradeBranch }
  | { kind: 'EVO_UPGRADED'; id: number; abilityIndex: 1 | 2 | 3 | 4 }
  | { kind: 'TOWER_SOLD'; id: number }
  | { kind: 'ACTION_REJECTED'; reason: string; action: GameAction }
  | { kind: 'MATCH_END'; winningTeam: TeamId; isCoopVictory: boolean };

export type NetworkMessage =
  // Handshake & Lobby
  | { type: 'ACTION_JOIN_LOBBY'; name: string }
  | { type: 'ACTION_SELECT_TEAM'; team: TeamId }
  | { type: 'ACTION_SET_READY'; ready: boolean }
  | { type: 'LOBBY_STATE'; mode: GameMode; players: PlayerSlot[] }
  | { type: 'LOBBY_REJECTED'; reason: string }
  | { type: 'MATCH_START'; mode: GameMode; missionId: number; players: PlayerSlot[] }

  // Gameplay
  | { type: 'GAME_ACTION'; action: GameAction }
  | { type: 'HOST_EVENT'; event: HostEvent }
  | { type: 'STATE_SNAPSHOT'; snapshot: StateSnapshot }

  // Cosmetic presence
  | { type: 'ACTION_CURSOR_MOVE'; worldX: number; worldZ: number }
  | { type: 'ACTION_PING_MAP'; worldX: number; worldZ: number }
  | { type: 'EVENT_CURSOR_BROADCAST'; peerId: string; team: TeamId; worldX: number; worldZ: number }
  | { type: 'EVENT_PING_BROADCAST'; peerId: string; team: TeamId; worldX: number; worldZ: number }

  // Latency Heartbeats
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number };
