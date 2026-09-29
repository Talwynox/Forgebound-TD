import * as THREE from 'three';
import { Grid } from './Grid';

/**
 * The maze road is a fixed serpentine layout (towers are only built on the plots beside it),
 * so the walking path is simply the road tiles in order.
 */
export class Pathfinder {
  private grid: Grid;

  constructor(grid: Grid) {
    this.grid = grid;
  }

  /**
   * Returns sequential world-space waypoints along the paved serpentine road.
   */
  getWorldPath(): THREE.Vector3[] {
    return this.grid.roadCoords.map(coord => {
      const world = this.grid.gridToWorld(coord.x, coord.z);
      return new THREE.Vector3(world.x, 0.4, world.z);
    });
  }
}
