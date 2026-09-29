export type TeamId = 'SUN' | 'MOON';

export function opponentOf(team: TeamId): TeamId {
  return team === 'SUN' ? 'MOON' : 'SUN';
}

/**
 * The battlefield is symmetric around the middle of the arena: in PvP the Moon side
 * (maze island, castle, ballistae, arrival pad) mirrors the Sun side across this X.
 */
export const ARENA_MIRROR_X = 13.3;

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
