/**
 * Grid: Represents the isometric tile map for the Player Maze Island.
 * Features a distinct paved serpentine road with dedicated buildable plots lining both sides.
 */

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

  constructor(width: number = 11, depth: number = 11, tileSize: number = 2, originX: number = -22, originZ: number = 0) {
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

    this.spawnCoord = { x: 0, z: 1 };
    this.exitCoord = { x: 10, z: 9 };

    this.initRoadLayout();
  }

  /**
   * Generates an authentic, winding serpentine road with building plots on all sides.
   */
  private initRoadLayout() {
    this.roadCoords = [];

    const addRoad = (x: number, z: number) => {
      if (this.isValid(x, z)) {
        this.cells[x][z] = TileType.ROAD;
        this.roadCoords.push({ x, z });
      }
    };

    // 1. Row z = 1: east from 0 to 9
    for (let x = 0; x <= 9; x++) addRoad(x, 1);

    // 2. Turn down: x = 9, z = 2..3
    addRoad(9, 2);
    addRoad(9, 3);

    // 3. Row z = 3: west from 8 down to 1
    for (let x = 8; x >= 1; x--) addRoad(x, 3);

    // 4. Turn down: x = 1, z = 4..5
    addRoad(1, 4);
    addRoad(1, 5);

    // 5. Row z = 5: east from 2 to 9
    for (let x = 2; x <= 9; x++) addRoad(x, 5);

    // 6. Turn down: x = 9, z = 6..7
    addRoad(9, 6);
    addRoad(9, 7);

    // 7. Row z = 7: west from 8 down to 1
    for (let x = 8; x >= 1; x--) addRoad(x, 7);

    // 8. Turn down: x = 1, z = 8..9
    addRoad(1, 8);
    addRoad(1, 9);

    // 9. Row z = 9: east from 2 to 10 (Teleporter Gate!)
    for (let x = 2; x <= 10; x++) addRoad(x, 9);

    // Set spawn and teleporter exit
    this.cells[this.spawnCoord.x][this.spawnCoord.z] = TileType.SPAWN;
    this.cells[this.exitCoord.x][this.exitCoord.z] = TileType.PORTAL;
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
    this.initRoadLayout();
  }
}
