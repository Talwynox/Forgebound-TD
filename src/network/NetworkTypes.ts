import { GridCoord } from '../grid/Grid';
import { TowerType, UpgradeBranch } from '../towers/TowerData';
import { TeamId } from '../game/Teams';

export type { TeamId } from '../game/Teams';
export type GameMode = 'COOP' | 'PVP';
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
}

export const TEAM_COLORS: Record<TeamId, string[]> = {
  SUN: ['#facc15', '#38bdf8', '#34d399', '#f472b6'], // Gold, Sky Blue, Emerald, Rose
  MOON: ['#ef4444', '#a855f7', '#f97316', '#06b6d4']  // Crimson, Arcane Violet, Fiery Orange, Cyan
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
  TEAM_MOON: 256
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

/** Per-team values, indexed [SUN, MOON]. */
export type TeamPair<T> = [T, T];

export interface StateSnapshot {
  waveIndex: number;
  wavePhase: WavePhase;
  waveInProgress: boolean;
  extraRecruits: TeamPair<number>;
  gameSpeed: number;
  smartFocus: TeamPair<boolean>;
  focusUnitIds: TeamPair<number | null>;
  /** PvP: seconds until the next round auto-starts (build phase), else null. */
  buildTimer: number | null;
  /** PvP: seconds left for survivors to storm the enemy castle, else null. */
  stormTimer: number | null;
  /** PvP round 1: peerIds that voted to start early. */
  readyVotes: string[];
  sunCastle: CastleState;
  moonCastle: CastleState | null;
  /** peerId -> gold */
  economy: Record<string, number>;
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
  | { kind: 'START_WAVE' }
  | { kind: 'VOTE_READY'; ready: boolean }
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
