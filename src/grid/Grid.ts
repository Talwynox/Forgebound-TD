/**
 * Grid: Represents the isometric tile map for the Player Maze and Battlefield.
 */

export enum TileType {
  EMPTY = 0,
  TOWER = 1,
  SPAWN = 2,
  EXIT = 3,
  WALL = 4
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

  // World offset so grid is centered / placed on the player's side
  public originX: number;
  public originZ: number;

  constructor(width: number = 10, depth: number = 10, tileSize: number = 2, originX: number = -14, originZ: number = 0) {
    this.width = width;
    this.depth = depth;
    this.tileSize = tileSize;
    this.originX = originX;
    this.originZ = originZ;

    this.cells = [];
    for (let x = 0; x < width; x++) {
      this.cells[x] = [];
      for (let z = 0; z < depth; z++) {
        this.cells[x][z] = TileType.EMPTY;
      }
    }

    // Default Spawn (left edge middle) and Exit (right edge middle)
    this.spawnCoord = { x: 0, z: Math.floor(depth / 2) };
    this.exitCoord = { x: width - 1, z: Math.floor(depth / 2) };

    this.cells[this.spawnCoord.x][this.spawnCoord.z] = TileType.SPAWN;
    this.cells[this.exitCoord.x][this.exitCoord.z] = TileType.EXIT;
  }

  isValid(x: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.depth;
  }

  isBuildable(x: number, z: number): boolean {
    if (!this.isValid(x, z)) return false;
    return this.cells[x][z] === TileType.EMPTY;
  }

  setTile(x: number, z: number, type: TileType) {
    if (this.isValid(x, z)) {
      this.cells[x][z] = type;
    }
  }

  getTile(x: number, z: number): TileType {
    if (!this.isValid(x, z)) return TileType.WALL;
    return this.cells[x][z];
  }

  gridToWorld(x: number, z: number): { x: number; z: number } {
    return {
      x: this.originX + (x - this.width / 2 + 0.5) * this.tileSize,
      z: this.originZ + (z - this.depth / 2 + 0.5) * this.tileSize
    };
  }

  worldToGrid(worldX: number, worldZ: number): GridCoord | null {
    const gx = Math.floor((worldX - this.originX) / this.tileSize + this.width / 2);
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
    this.cells[this.spawnCoord.x][this.spawnCoord.z] = TileType.SPAWN;
    this.cells[this.exitCoord.x][this.exitCoord.z] = TileType.EXIT;
  }
}
