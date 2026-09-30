import type { GridCoord } from './Grid';

/**
 * Maze road layouts for the 11 x 15 maze island. Each layout is the road's corner points in walking
 * order; straight runs between them are filled in. Every layout starts at the barracks (0, 1) and
 * ends at the teleport gate (10, 13), and parallel lanes never touch, so plots always separate them.
 */
export type MazeLayoutId = 'FRONTIER' | 'IRONFORGE' | 'CANYON' | 'RIFT' | 'CITADEL';

export const MAZE_LAYOUTS: Record<MazeLayoutId, GridCoord[]> = {
  // Horizontal serpentine, alternating 3-row and 1-row pockets (55 road tiles)
  FRONTIER: [
    { x: 0, z: 1 }, { x: 9, z: 1 }, { x: 9, z: 5 }, { x: 1, z: 5 }, { x: 1, z: 7 },
    { x: 9, z: 7 }, { x: 9, z: 11 }, { x: 1, z: 11 }, { x: 1, z: 13 }, { x: 10, z: 13 }
  ],
  // Mountain switchbacks: vertical lanes with single-file ledges between them (71 road tiles)
  IRONFORGE: [
    { x: 0, z: 1 }, { x: 1, z: 1 }, { x: 1, z: 13 }, { x: 3, z: 13 }, { x: 3, z: 1 }, { x: 5, z: 1 },
    { x: 5, z: 13 }, { x: 7, z: 13 }, { x: 7, z: 1 }, { x: 9, z: 1 }, { x: 9, z: 13 }, { x: 10, z: 13 }
  ],
  // Two broad canyon mesas with a short road around them (39 road tiles)
  CANYON: [
    { x: 0, z: 1 }, { x: 9, z: 1 }, { x: 9, z: 7 }, { x: 1, z: 7 }, { x: 1, z: 13 }, { x: 10, z: 13 }
  ],
  // Jagged fault lines stepping diagonally across the island (41 road tiles)
  RIFT: [
    { x: 0, z: 1 }, { x: 3, z: 1 }, { x: 3, z: 2 }, { x: 6, z: 2 }, { x: 6, z: 3 }, { x: 9, z: 3 },
    { x: 9, z: 5 }, { x: 10, z: 5 }, { x: 10, z: 7 }, { x: 7, z: 7 }, { x: 7, z: 8 }, { x: 4, z: 8 },
    { x: 4, z: 9 }, { x: 1, z: 9 }, { x: 1, z: 11 }, { x: 3, z: 11 }, { x: 3, z: 12 }, { x: 6, z: 12 },
    { x: 6, z: 13 }, { x: 10, z: 13 }
  ],
  // Battlements: square-wave crenellations whose notches touch the road on three sides (67 road tiles)
  CITADEL: [
    { x: 0, z: 1 }, { x: 2, z: 1 }, { x: 2, z: 3 }, { x: 4, z: 3 }, { x: 4, z: 1 }, { x: 6, z: 1 },
    { x: 6, z: 3 }, { x: 8, z: 3 }, { x: 8, z: 1 }, { x: 10, z: 1 }, { x: 10, z: 6 }, { x: 8, z: 6 },
    { x: 8, z: 8 }, { x: 6, z: 8 }, { x: 6, z: 6 }, { x: 4, z: 6 }, { x: 4, z: 8 }, { x: 2, z: 8 },
    { x: 2, z: 6 }, { x: 0, z: 6 }, { x: 0, z: 11 }, { x: 2, z: 11 }, { x: 2, z: 13 }, { x: 4, z: 13 },
    { x: 4, z: 11 }, { x: 6, z: 11 }, { x: 6, z: 13 }, { x: 8, z: 13 }, { x: 8, z: 11 }, { x: 10, z: 11 },
    { x: 10, z: 13 }
  ]
};

/** Expands corner points into every road tile, in walking order. */
export function expandRoad(corners: GridCoord[]): GridCoord[] {
  const tiles: GridCoord[] = [];
  corners.forEach((c, i) => {
    if (i === 0) {
      tiles.push({ ...c });
      return;
    }
    const prev = corners[i - 1];
    const dx = Math.sign(c.x - prev.x);
    const dz = Math.sign(c.z - prev.z);
    let x = prev.x;
    let z = prev.z;
    while (x !== c.x || z !== c.z) {
      x += dx;
      z += dz;
      tiles.push({ x, z });
    }
  });
  return tiles;
}
