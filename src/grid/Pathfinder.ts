import * as THREE from 'three';
import { Grid, GridCoord } from './Grid';

export class Pathfinder {
  private grid: Grid;
  private pathLine: THREE.Line | null = null;
  public scene: THREE.Scene | null = null;

  constructor(grid: Grid) {
    this.grid = grid;
  }

  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Check if placing a tower at (x, z) is allowed.
   * Towers can be placed on any plot adjacent to the road, but NOT on the paved road itself!
   */
  canPlaceTower(x: number, z: number): boolean {
    return this.grid.isBuildable(x, z);
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

  /**
   * Updates visual path in the scene.
   * The physical cobblestone road with raised stone curbs and golden runic keystones
   * built by Renderer.buildRoadVisuals serves as the high-fidelity path visual.
   */
  updatePathVisual() {
    if (!this.scene) return;

    if (this.pathLine) {
      this.scene.remove(this.pathLine);
      this.pathLine.geometry.dispose();
      (this.pathLine.material as THREE.Material).dispose();
      this.pathLine = null;
    }
  }
}
