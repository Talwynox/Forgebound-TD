export type TeamId = 'SUN' | 'MOON';

export function opponentOf(team: TeamId): TeamId {
  return team === 'SUN' ? 'MOON' : 'SUN';
}

/**
 * Arena island layout. The Sun (west) side is fixed; the arena extends east far enough that
 * level-1 ballistae (range 13) on either side don't reach the melee in the middle.
 */
export const ARENA_WIDTH = 38;
export const ARENA_WEST_X = 0;
export const ARENA_CENTER_X = ARENA_WEST_X + ARENA_WIDTH / 2;

/**
 * The battlefield is symmetric around the middle of the arena: in PvP the Moon side
 * (maze island, castle, ballistae, arrival pad) mirrors the Sun side across this X.
 */
export const ARENA_MIRROR_X = 18.3;

export function mirrorX(x: number): number {
  return 2 * ARENA_MIRROR_X - x;
}

/** Mirrors a Sun-side X coordinate to the given team's side. */
export function sideX(team: TeamId, sunX: number): number {
  return team === 'SUN' ? sunX : mirrorX(sunX);
}

/** Direction (+1 east / -1 west) a team advances in towards the enemy. */
export function forwardDir(team: TeamId): number {
  return team === 'SUN' ? 1 : -1;
}

/** Y rotation of a unit facing the enemy side. */
export function forwardYaw(team: TeamId): number {
  return team === 'SUN' ? -Math.PI / 2 : Math.PI / 2;
}

export const TEAM_NAMES: Record<TeamId, string> = { SUN: 'Sun', MOON: 'Moon' };
