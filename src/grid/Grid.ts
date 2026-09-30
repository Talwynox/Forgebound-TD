/**
 * Grid: Represents the isometric tile map for the Player Maze Island.
 * Features a paved road (its route depends on the mission's maze layout) with buildable plots lining it.
 */
import { MAZE_LAYOUTS, MazeLayoutId, expandRoad } from './MazeLayouts';

export enum TileType {
  EMPTY = 0,    // Buildable plot next to the road
  TOWER = 1,    // Built tower
  SPAWN = 2,    // Player Barracks / Spawn gate
  PORTAL = 3,   // Teleportation gate to Arena
  ROAD = 4      // Paved unit walking road (cannot build on road)
}

export interface GridCoord {
  x: number;
  z: number;
}

export class Grid {
  public width: number;
  public depth: number;
  public tileSize: number;
  public cells: TileType[][];
  public spawnCoord: GridCoord;
  public exitCoord: GridCoord;
  public roadCoords: GridCoord[] = [];

  // World offset for the Maze Island
  public originX: number;
  public originZ: number;
  /** Mirror the layout along X (the PvP Moon maze is the Sun maze reflected across the arena). */
  public mirrored: boolean;
  /** Which maze the road follows. */
  private layoutId: MazeLayoutId = 'FRONTIER';

  constructor(width: number = 11, depth: number = 15, tileSize: number = 2, originX: number = -22, originZ: number = 0, mirrored: boolean = false) {
    this.width = width;
    this.depth = depth;
    this.tileSize = tileSize;
    this.originX = originX;
    this.originZ = originZ;
    this.mirrored = mirrored;

    this.cells = [];
    for (let x = 0; x < width; x++) {
      this.cells[x] = [];
      for (let z = 0; z < depth; z++) {
        this.cells[x][z] = TileType.EMPTY;
      }
    }

    this.spawnCoord = { x: 0, z: 1 };
    this.exitCoord = { x: this.width - 1, z: this.depth - 2 };

    this.initRoadLayout();
  }

  /** Switches to another road layout (a mission's maze) and rebuilds the grid. */
  setLayout(layoutId: MazeLayoutId) {
    this.layoutId = layoutId;
    this.resetGrid();
  }

  /** Lays the current layout's road; everything else stays a buildable plot. */
  private initRoadLayout() {
    this.roadCoords = [];
    for (const { x, z } of expandRoad(MAZE_LAYOUTS[this.layoutId])) {
      if (this.isValid(x, z)) {
        this.cells[x][z] = TileType.ROAD;
        this.roadCoords.push({ x, z });
      }
    }

    // Set spawn and teleporter exit safely
    if (this.isValid(this.spawnCoord.x, this.spawnCoord.z)) {
      this.cells[this.spawnCoord.x][this.spawnCoord.z] = TileType.SPAWN;
    }
    if (this.isValid(this.exitCoord.x, this.exitCoord.z)) {
      this.cells[this.exitCoord.x][this.exitCoord.z] = TileType.PORTAL;
    }
  }

  isRoad(x: number, z: number): boolean {
    if (!this.isValid(x, z)) return false;
    const t = this.cells[x][z];
    return t === TileType.ROAD || t === TileType.SPAWN || t === TileType.PORTAL;
  }

  isValid(x: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.depth;
  }

  isBuildable(x: number, z: number): boolean {
    if (!this.isValid(x, z)) return false;
    // Only EMPTY plots (adjacent to road) can have towers built on them
    return this.cells[x][z] === TileType.EMPTY;
  }

  setTile(x: number, z: number, type: TileType) {
    if (this.isValid(x, z)) {
      this.cells[x][z] = type;
    }
  }

  getTile(x: number, z: number): TileType {
    if (!this.isValid(x, z)) return TileType.ROAD;
    return this.cells[x][z];
  }

  gridToWorld(x: number, z: number): { x: number; z: number } {
    const col = this.mirrored ? this.width - 1 - x : x;
    return {
      x: this.originX + (col - this.width / 2 + 0.5) * this.tileSize,
      z: this.originZ + (z - this.depth / 2 + 0.5) * this.tileSize
    };
  }

  worldToGrid(worldX: number, worldZ: number): GridCoord | null {
    const col = Math.floor((worldX - this.originX) / this.tileSize + this.width / 2);
    const gx = this.mirrored ? this.width - 1 - col : col;
    const gz = Math.floor((worldZ - this.originZ) / this.tileSize + this.depth / 2);
    if (this.isValid(gx, gz)) {
      return { x: gx, z: gz };
    }
    return null;
  }

  resetGrid() {
    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.depth; z++) {
        this.cells[x][z] = TileType.EMPTY;
      }
    }
    this.initRoadLayout();
  }
}
