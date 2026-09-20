import * as THREE from 'three';
import { Grid, GridCoord, TileType } from './Grid';

interface PathNode {
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

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
   * Run A* algorithm to find grid path from start to goal.
   * Returns array of GridCoord or empty array if no path.
   */
  findPath(start: GridCoord = this.grid.spawnCoord, goal: GridCoord = this.grid.exitCoord, hypotheticalBlock?: GridCoord): GridCoord[] {
    const openList: PathNode[] = [];
    const closedSet = new Set<string>();

    const makeKey = (x: number, z: number) => `${x},${z}`;

    const startNode: PathNode = {
      x: start.x,
      z: start.z,
      g: 0,
      h: Math.abs(start.x - goal.x) + Math.abs(start.z - goal.z),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;
    openList.push(startNode);

    const neighbors = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 }
    ];

    while (openList.length > 0) {
      // Find node with lowest f
      let lowestIdx = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[lowestIdx].f) {
          lowestIdx = i;
        }
      }
      const current = openList.splice(lowestIdx, 1)[0];

      if (current.x === goal.x && current.z === goal.z) {
        // Reconstruct path
        const path: GridCoord[] = [];
        let curr: PathNode | null = current;
        while (curr) {
          path.unshift({ x: curr.x, z: curr.z });
          curr = curr.parent;
        }
        return path;
      }

      closedSet.add(makeKey(current.x, current.z));

      for (const n of neighbors) {
        const nx = current.x + n.x;
        const nz = current.z + n.z;

        if (!this.grid.isValid(nx, nz)) continue;
        if (closedSet.has(makeKey(nx, nz))) continue;

        // Check if blocked by hypothetical tower placement
        if (hypotheticalBlock && nx === hypotheticalBlock.x && nz === hypotheticalBlock.z) {
          continue;
        }

        // Check if blocked by actual tower or wall
        const tile = this.grid.getTile(nx, nz);
        if (tile === TileType.TOWER || tile === TileType.WALL) {
          continue;
        }

        const gScore = current.g + 1;
        let neighborNode = openList.find(node => node.x === nx && node.z === nz);

        if (!neighborNode) {
          const hScore = Math.abs(nx - goal.x) + Math.abs(nz - goal.z);
          neighborNode = {
            x: nx,
            z: nz,
            g: gScore,
            h: hScore,
            f: gScore + hScore,
            parent: current
          };
          openList.push(neighborNode);
        } else if (gScore < neighborNode.g) {
          neighborNode.g = gScore;
          neighborNode.f = gScore + neighborNode.h;
          neighborNode.parent = current;
        }
      }
    }

    return []; // No path found
  }

  /**
   * Finds the full maze path through all checkpoints:
   * Spawn -> CP1 -> CP2 -> CP3 -> Exit
   */
  getFullMazeGridPath(hypotheticalBlock?: GridCoord): GridCoord[] {
    const waypoints: GridCoord[] = [
      this.grid.spawnCoord,
      ...this.grid.checkpoints,
      this.grid.exitCoord
    ];

    const fullPath: GridCoord[] = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];

      // If hypothetical block is on one of the required checkpoints or spawn/exit, invalid
      if (hypotheticalBlock && hypotheticalBlock.x === to.x && hypotheticalBlock.z === to.z) {
        return [];
      }

      const segment = this.findPath(from, to, hypotheticalBlock);
      if (segment.length === 0) {
        return []; // No valid route for this segment
      }

      // Add to fullPath, skipping duplicate start point
      if (fullPath.length === 0) {
        fullPath.push(...segment);
      } else {
        fullPath.push(...segment.slice(1));
      }
    }

    return fullPath;
  }

  /**
   * Check if placing a tower at (x, z) would block the maze completely
   */
  canPlaceTower(x: number, z: number): boolean {
    if (!this.grid.isBuildable(x, z)) return false;
    // Disallow placing on spawn, checkpoints, or exit
    if (x === this.grid.spawnCoord.x && z === this.grid.spawnCoord.z) return false;
    if (x === this.grid.exitCoord.x && z === this.grid.exitCoord.z) return false;
    for (const cp of this.grid.checkpoints) {
      if (x === cp.x && z === cp.z) return false;
    }

    // Run hypothetical pathfinding across all checkpoints
    const path = this.getFullMazeGridPath({ x, z });
    return path.length > 0;
  }

  /**
   * Converts grid coordinates into world-space waypoints for 3D units to walk.
   */
  getWorldPath(): THREE.Vector3[] {
    const gridPath = this.getFullMazeGridPath();
    return gridPath.map(coord => {
      const world = this.grid.gridToWorld(coord.x, coord.z);
      return new THREE.Vector3(world.x, 0.4, world.z);
    });
  }

  /**
   * Updates 3D visual path line in the Three.js scene
   */
  updatePathVisual() {
    if (!this.scene) return;

    if (this.pathLine) {
      this.scene.remove(this.pathLine);
      this.pathLine.geometry.dispose();
      (this.pathLine.material as THREE.Material).dispose();
      this.pathLine = null;
    }

    const worldPoints = this.getWorldPath();
    if (worldPoints.length < 2) return;

    // Slight elevation above ground
    const points = worldPoints.map(p => new THREE.Vector3(p.x, 0.15, p.z));

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.6,
      gapSize: 0.3,
      linewidth: 3
    });

    this.pathLine = new THREE.Line(geometry, material);
    this.pathLine.computeLineDistances();
    this.scene.add(this.pathLine);
  }
}

