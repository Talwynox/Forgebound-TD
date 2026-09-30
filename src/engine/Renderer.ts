import * as THREE from 'three';
import { Grid, TileType } from '../grid/Grid';
import { ARENA_MIRROR_X, ARENA_WIDTH, ARENA_CENTER_X, mirrorX } from '../game/Teams';
import { PostFX } from './PostFX';
import { createFlagstoneTexture, createGlowSprite, createMasonryTexture, createMistTexture, createMossTexture } from './ProceduralTextures';

interface ParticleField {
  points: THREE.Points;
  velocities: Float32Array;
  phases: Float32Array;
  min: THREE.Vector3;
  max: THREE.Vector3;
  kind: 'ember' | 'wisp';
}

type CastleTheme = 'SUN' | 'MOON';

const CASTLE_THEMES: Record<CastleTheme, { roof: number; banner: number; light: number }> = {
  SUN: { roof: 0x232838, banner: 0x2f4a8a, light: 0xff9a4a },
  MOON: { roof: 0x341015, banner: 0x7a1522, light: 0xff3b2a }
};

export class SceneRenderer {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public container: HTMLElement;

  public sunLight: THREE.DirectionalLight;
  private postFX: PostFX | null = null;
  public ambientLight: THREE.AmbientLight;
  public hemiLight: THREE.HemisphereLight;

  // Animated elements
  private portalVortices: THREE.Mesh[] = [];
  private arrivalVortices: THREE.Mesh[] = [];
  private roadGroup: THREE.Group = new THREE.Group();

  // PvP layout: mirrored Moon maze island & arena side; the decorative enemy citadel is hidden
  private enemyCitadel: THREE.Group | null = null;
  private moonSide: THREE.Group | null = null;
  private floatingLeyCrystals: { mesh: THREE.Group; baseY: number; speed: number; phase: number }[] = [];
  private animatedClouds: THREE.Group[] = [];
  private lavaMaterials: THREE.MeshBasicMaterial[] = [];
  private particleFields: ParticleField[] = [];
  private spinners: THREE.Object3D[] = [];
  private mistLayers: { mat: THREE.MeshBasicMaterial; drift: THREE.Vector2 }[] = [];
  private glowSprite: THREE.Texture = createGlowSprite();

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene - Dark fantasy night: the void swallows everything beyond the islands
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07060c);
    this.scene.fog = new THREE.FogExp2(0x0d0b17, 0.0085);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    container.appendChild(this.renderer.domElement);

    // 3. Lighting - cold moonlight key, violet ambient, warm firelight accents
    this.ambientLight = new THREE.AmbientLight(0x6d6694, 1.1);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x94a3e8, 0x3a2418, 1.1);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xc3cfff, 2.1);
    this.sunLight.position.set(-22, 38, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Warm hearth glow at the barracks castle
    const castleLight = new THREE.PointLight(0xff8a3d, 2.2, 24, 1.6);
    castleLight.position.set(-34, 5, -12);
    this.scene.add(castleLight);

    // Menacing hellfire at the enemy citadel
    const citadelLight = new THREE.PointLight(0xff2a1a, 2.4, 26, 1.6);
    citadelLight.position.set(mirrorX(-0.4), 5, 0);
    this.scene.add(citadelLight);

    // 4. Ground Environment (Maze Island + Void + Arena Island)
    this.buildWorldEnvironment();
  }

  private buildWorldEnvironment() {
    // 1. Medieval Fantasy Atmosphere, Mountains, Terrain & Floating Bedrock
    this.buildSkyAndAtmosphere();
    this.buildIslandBedrock();
    this.buildDistantMountainRanges();
    this.buildWestKingdomTerrain();
    this.buildEastInfernalTerrain();
    this.buildCentralChasmAndLeyLines();
    this.buildMistSea();
    this.buildArenaEmbers();

    this.buildMazeIsland(this.scene, this.roadGroup);

    // ==========================================
    // 2. GRAND ARENA ISLAND (Right: X = 14, Z = 0)
    // ==========================================
    const arenaIslandGeom = new THREE.BoxGeometry(ARENA_WIDTH, 0.6, 20);
    const arenaIslandMat = new THREE.MeshStandardMaterial({
      color: 0xb0a49c, // Tints the scorched flagstone texture
      map: createFlagstoneTexture(ARENA_WIDTH / 4, 5),
      roughness: 0.92,
      metalness: 0.05
    });
    const arenaIsland = new THREE.Mesh(arenaIslandGeom, arenaIslandMat);
    arenaIsland.position.set(ARENA_CENTER_X, -0.2, 0);
    arenaIsland.receiveShadow = true;
    this.scene.add(arenaIsland);

    // Stone materials for Colosseum
    const wallStoneMat = new THREE.MeshStandardMaterial({
      color: 0x3b3634, // Cold weathered colosseum stone
      roughness: 0.85,
      metalness: 0.15
    });
    const wallTrimMat = new THREE.MeshStandardMaterial({
      color: 0x2b221a, // Darker stone foundation / coping
      roughness: 0.8
    });

    // --- Colosseum Perimeter Walls with Battlements & Pillars ---
    // North Wall (Z = -10)
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(ARENA_WIDTH + 0.4, 1.5, 0.8), wallStoneMat);
    nWall.position.set(ARENA_CENTER_X, 0.55, -10.0);
    nWall.castShadow = true;
    nWall.receiveShadow = true;
    this.scene.add(nWall);

    // South Wall (Z = +10)
    const sWall = new THREE.Mesh(new THREE.BoxGeometry(ARENA_WIDTH + 0.4, 1.5, 0.8), wallStoneMat);
    sWall.position.set(ARENA_CENTER_X, 0.55, 10.0);
    sWall.castShadow = true;
    sWall.receiveShadow = true;
    this.scene.add(sWall);

    // West Barrier Wall (X = 0) flanking the Arena Stronghold Castle
    [-6.7, 6.7].forEach(zPos => {
      const wWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 6.6), wallStoneMat);
      wWall.position.set(-0.1, 0.55, zPos);
      wWall.castShadow = true;
      this.scene.add(wWall);
    });

    // Colosseum Stone Pillars along North and South Walls
    for (let i = 0; i < Math.floor(ARENA_WIDTH / 4); i++) {
      const px = 2 + i * 4.0;
      [-10.0, 10.0].forEach(pz => {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.45, 2.0, 6),
          wallTrimMat
        );
        pillar.position.set(px, 0.8, pz);
        pillar.castShadow = true;
        this.scene.add(pillar);

        // Stone cap on pillar
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.2, 0.8),
          wallStoneMat
        );
        cap.position.set(px, 1.85, pz);
        this.scene.add(cap);
      });
    }

    // Battlements / Crenellations along North & South Walls
    for (let i = 0; i < Math.floor(ARENA_WIDTH / 2); i++) {
      const bx = 1 + i * 2.0;
      [-10.0, 10.0].forEach(bz => {
        const merlon = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.45, 0.6),
          wallTrimMat
        );
        merlon.position.set(bx, 1.5, bz);
        this.scene.add(merlon);
      });
    }

    // --- Gladiator Combat Floor Markings ---
    // Outer stone perimeter paving ring
    const outerRingGeom = new THREE.RingGeometry(6.0, 6.7, 36);
    outerRingGeom.rotateX(-Math.PI / 2);
    const outerRing = new THREE.Mesh(
      outerRingGeom,
      new THREE.MeshStandardMaterial({ color: 0x2e2318, roughness: 0.9 })
    );
    outerRing.position.set(ARENA_MIRROR_X, 0.11, 0);
    this.scene.add(outerRing);

    // Glowing runic duel circle
    // Smouldering rune circle scorched into the flagstones
    const clashRingGeom = new THREE.RingGeometry(4.1, 4.25, 64);
    clashRingGeom.rotateX(-Math.PI / 2);
    const clashRingMat = new THREE.MeshStandardMaterial({
      color: 0x3a0f08,
      emissive: 0xff4a14,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const clashRing = new THREE.Mesh(clashRingGeom, clashRingMat);
    clashRing.position.set(ARENA_MIRROR_X, 0.12, 0);
    this.scene.add(clashRing);

    // Inner gladiator sunburst insignia
    const innerRingGeom = new THREE.RingGeometry(1.3, 1.4, 48);
    innerRingGeom.rotateX(-Math.PI / 2);
    const innerRing = new THREE.Mesh(
      innerRingGeom,
      new THREE.MeshStandardMaterial({
        color: 0x3a1a06,
        emissive: 0xffa032,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.7
      })
    );
    innerRing.position.set(ARENA_MIRROR_X, 0.12, 0);
    this.scene.add(innerRing);

    // Scorched battle blast marks near the clash zone
    [-2.2, 2.5].forEach((zOff, idx) => {
      const scorch = new THREE.Mesh(
        new THREE.CircleGeometry(1.8 - idx * 0.4, 12),
        new THREE.MeshBasicMaterial({ color: 0x1c130b, transparent: true, opacity: 0.45 })
      );
      scorch.rotation.x = -Math.PI / 2;
      scorch.position.set(ARENA_MIRROR_X - 1.3 + idx * 2.5, 0.11, zOff);
      this.scene.add(scorch);
    });

    // Spiked defensive barricades / chevaux-de-frise at corners
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
    const ironTipMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
    [
      { x: 3.5, z: -8.0, rot: 0.4 },
      { x: 3.5, z: 8.0, rot: -0.4 }
    ].forEach(bPos => {
      const barricadeGroup = new THREE.Group();
      barricadeGroup.position.set(bPos.x, 0.1, bPos.z);
      barricadeGroup.rotation.y = bPos.rot;

      for (let i = 0; i < 3; i++) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 5), woodMat);
        beam.position.set((i - 1) * 0.5, 0.4, 0);
        beam.rotation.z = Math.PI / 4;
        beam.rotation.x = (i % 2 === 0) ? 0.3 : -0.3;
        barricadeGroup.add(beam);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), ironTipMat);
        tip.position.set((i - 1) * 0.5 + 0.55, 0.95, 0);
        tip.rotation.z = -Math.PI / 4;
        barricadeGroup.add(tip);
      }
      this.scene.add(barricadeGroup);
    });

    // Scattered bone/skull props along wall borders
    const skullGeom = new THREE.SphereGeometry(0.14, 8, 8);
    const hornGeom = new THREE.ConeGeometry(0.05, 0.22, 4);
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const boneGroup = new THREE.Group();
      const skull = new THREE.Mesh(skullGeom, boneMat);
      const horn1 = new THREE.Mesh(hornGeom, boneMat);
      horn1.position.set(0.1, 0.1, 0);
      horn1.rotation.z = -0.5;
      const horn2 = new THREE.Mesh(hornGeom, boneMat);
      horn2.position.set(-0.1, 0.1, 0);
      horn2.rotation.z = 0.5;
      boneGroup.add(skull, horn1, horn2);

      const angle = (i * 1.05) % (Math.PI * 2);
      const rx = ARENA_CENTER_X + Math.cos(angle) * (ARENA_WIDTH / 2 - 3);
      const rz = Math.sin(angle) * 7.5;
      boneGroup.position.set(rx, 0.15, rz);
      boneGroup.rotation.y = i * 1.2;
      this.scene.add(boneGroup);
    }

    // Friendly Arrival Teleport Gate in Arena (X = 1.8, Z = 0)
    this.buildArrivalTeleportPad(new THREE.Vector3(1.8, 0, 0));

    // Arena Perimeter Torch Braziers on Stone Pillars
    [
      { x: 4, z: -8.8 }, { x: ARENA_MIRROR_X, z: -8.8 }, { x: mirrorX(4), z: -8.8 },
      { x: 4, z: 8.8 },  { x: ARENA_MIRROR_X, z: 8.8 },  { x: mirrorX(4), z: 8.8 }
    ].forEach(pos => {
      this.buildTorchBrazier(new THREE.Vector3(pos.x, 0, pos.z));
    });

    // Enemy Citadel Fortress (Far Right: X = 27, Z = 0)
    this.enemyCitadel = this.buildEnemyCitadel(new THREE.Vector3(mirrorX(-0.4), 0, 0));
  }

  /**
   * PvP: show the Moon team's maze island and arena side (a mirror image of the Sun side across
   * the arena centre) in place of the decorative enemy citadel.
   */
  public setPvpLayout(enabled: boolean, sunGrid: Grid) {
    if (enabled && !this.moonSide) {
      // Build the Sun-side content at Sun coordinates, then mirror the whole group across X.
      const side = new THREE.Group();
      side.scale.x = -1;
      side.position.x = 2 * ARENA_MIRROR_X;

      const moonRoad = new THREE.Group();
      this.buildMazeIsland(side, moonRoad, 'MOON');
      this.buildRoadVisuals(sunGrid, moonRoad);
      this.buildMazeBedrock(side);
      this.buildArrivalTeleportPad(new THREE.Vector3(1.8, 0, 0), side);

      const barrierMat = new THREE.MeshStandardMaterial({ color: 0x3b3634, roughness: 0.85, metalness: 0.15 });
      [-6.7, 6.7].forEach(zPos => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 6.6), barrierMat);
        wall.position.set(-0.1, 0.55, zPos);
        wall.castShadow = true;
        side.add(wall);
      });

      const moonCastleLight = new THREE.PointLight(CASTLE_THEMES.MOON.light, 2.2, 24, 1.6);
      moonCastleLight.position.set(-34, 4, -12);
      side.add(moonCastleLight);

      this.scene.add(side);
      this.moonSide = side;
    }

    if (this.moonSide) this.moonSide.visible = enabled;
    if (this.enemyCitadel) this.enemyCitadel.visible = !enabled;
  }

  /**
   * Maze island at the Sun position (X = -22): plateau, trims, decor, road, barracks castle & teleport gate.
   * The PvP Moon side reuses this inside a group mirrored across the arena.
   */
  private buildMazeIsland(parent: THREE.Object3D, roadGroup: THREE.Group, theme: CastleTheme = 'SUN') {
    // ==========================================
    // 1. MAZE ISLAND (Left Plateau: X = -22, Z = 0)
    // ==========================================
    const mazeIslandGeom = new THREE.BoxGeometry(24, 0.5, 32);
    const mazeIslandMat = new THREE.MeshStandardMaterial({
      color: 0xd6dcc0, // Tints the damp moss texture
      map: createMossTexture(4, 5),
      roughness: 0.95,
      metalness: 0.0
    });
    const mazeIsland = new THREE.Mesh(mazeIslandGeom, mazeIslandMat);
    mazeIsland.position.set(-22, -0.15, 0);
    mazeIsland.receiveShadow = true;
    parent.add(mazeIsland);

    // Stone border trim for Maze Island (covering 24 x 32)
    const trimGeomX = new THREE.BoxGeometry(24.4, 0.6, 0.4);
    const trimGeomZ = new THREE.BoxGeometry(0.4, 0.6, 32.4);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x5c4a3a, roughness: 0.8 });

    const trimN = new THREE.Mesh(trimGeomX, trimMat);
    trimN.position.set(-22, 0.1, -16.1);
    parent.add(trimN);
    const trimS = trimN.clone();
    trimS.position.z = 16.1;
    parent.add(trimS);

    const trimW = new THREE.Mesh(trimGeomZ, trimMat);
    trimW.position.set(-34.1, 0.1, 0);
    parent.add(trimW);
    const trimE = trimW.clone();
    trimE.position.x = -9.9;
    parent.add(trimE);

    // Decorative grass and stones
    const grassGeom = new THREE.ConeGeometry(0.15, 0.4, 4);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f6138, roughness: 0.9 });
    for (let i = 0; i < 14; i++) {
      const grass = new THREE.Mesh(grassGeom, grassMat);
      const angle = (i * 1.37) % (Math.PI * 2);
      const radX = 9 + (i % 3); 
      const radZ = 13 + (i % 3); 
      grass.position.set(-22 + Math.cos(angle) * radX, 0.15, Math.sin(angle) * radZ);
      parent.add(grass);
    }
    const rubbleGeom = new THREE.DodecahedronGeometry(0.1);
    const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const stone = new THREE.Mesh(rubbleGeom, rubbleMat);
      const angle = (i * 2.14) % (Math.PI * 2);
      const radX = 10 + (i % 2);
      const radZ = 14 + (i % 2);
      stone.position.set(-22 + Math.cos(angle) * radX, 0.15, Math.sin(angle) * radZ);
      stone.rotation.set(i, i * 1.5, 0);
      parent.add(stone);
    }

    parent.add(roadGroup);

    // Player Castle (Start of Maze: X = -34, Z = -12)
    this.buildPlayerCastle(new THREE.Vector3(-34, 0, -12), parent, theme);
    this.buildMazeWisps(parent);

    // Teleportation Gate (End of Maze: X = -10, Z = 12)
    this.buildTeleportationGate(new THREE.Vector3(-10, 0, 12), parent);
  }

  /**
   * Builds distinct, high-contrast cobblestone road paving across all road tiles
   */
  buildRoadVisuals(grid: Grid, roadGroup: THREE.Group = this.roadGroup) {
    // Clear old road meshes
    while (roadGroup.children.length > 0) {
      const child = roadGroup.children[0];
      roadGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    // Medieval Road Palette
    const gravelBedMat = new THREE.MeshStandardMaterial({
      color: 0x3e2e22, // Dark packed soil and roadbed gravel
      roughness: 0.95
    });

    const paverMat1 = new THREE.MeshStandardMaterial({
      color: 0x6e5c4a, // Warm aged granite flagstone
      roughness: 0.82,
      metalness: 0.08
    });

    const paverMat2 = new THREE.MeshStandardMaterial({
      color: 0x7c6955, // Sandstone paving slab
      roughness: 0.80,
      metalness: 0.08
    });

    const paverMat3 = new THREE.MeshStandardMaterial({
      color: 0x564739, // Weathered dark slate
      roughness: 0.88,
      metalness: 0.1
    });

    const paverMat4 = new THREE.MeshStandardMaterial({
      color: 0x8a7662, // Sun-warmed limestone paver
      roughness: 0.78,
      metalness: 0.05
    });

    const curbStoneMat = new THREE.MeshStandardMaterial({
      color: 0x483a2d, // Chiseled road edge curb granite
      roughness: 0.85,
      metalness: 0.15
    });

    const goldenRuneMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0xb45309,
      emissiveIntensity: 0.65,
      roughness: 0.4
    });

    const lanternIronMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.3
    });

    const lanternGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.6
    });

    const paverMats = [paverMat1, paverMat2, paverMat3, paverMat4];
    const s = grid.tileSize; // 2.0

    let tileIndex = 0;
    for (const coord of grid.roadCoords) {
      const world = grid.gridToWorld(coord.x, coord.z);

      // 1. Packed Dirt & Crushed Gravel Sub-Base (y = 0.11, sits proud of the grass at y = 0.10)
      const bedGeom = new THREE.BoxGeometry(s * 0.98, 0.06, s * 0.98);
      const bed = new THREE.Mesh(bedGeom, gravelBedMat);
      bed.position.set(world.x, 0.11, world.z);
      bed.receiveShadow = true;
      roadGroup.add(bed);

      // 2. Multi-Stone Flagstone Paver Clusters (5-6 organic flagstones per tile)
      const seed = Math.abs(coord.x * 13 + coord.z * 29);
      const paverOffsets = [
        { ox: -0.46, oz: -0.45, sx: 0.86, sz: 0.82, m: (seed + 0) % 4, h: 0.05 },
        { ox:  0.44, oz: -0.43, sx: 0.80, sz: 0.78, m: (seed + 1) % 4, h: 0.052 },
        { ox: -0.44, oz:  0.45, sx: 0.82, sz: 0.84, m: (seed + 2) % 4, h: 0.048 },
        { ox:  0.46, oz:  0.44, sx: 0.84, sz: 0.80, m: (seed + 3) % 4, h: 0.051 }
      ];

      for (const p of paverOffsets) {
        const pGeom = new THREE.BoxGeometry(p.sx, p.h, p.sz);
        const paver = new THREE.Mesh(pGeom, paverMats[p.m]);
        paver.position.set(world.x + p.ox, 0.145, world.z + p.oz);
        paver.rotation.y = ((seed % 7) - 3) * 0.015;
        paver.receiveShadow = true;
        roadGroup.add(paver);
      }

      // Center Keystone / Inlaid Golden Stepping Stone
      const isRunic = (coord.x + coord.z) % 2 === 0;
      const centerGeom = isRunic
        ? new THREE.CylinderGeometry(0.24, 0.28, 0.055, 8)
        : new THREE.BoxGeometry(0.44, 0.052, 0.44);
      const centerMat = isRunic ? goldenRuneMat : paverMats[(seed + 4) % 4];
      const centerStone = new THREE.Mesh(centerGeom, centerMat);
      centerStone.position.set(world.x, 0.15, world.z);
      centerStone.receiveShadow = true;
      roadGroup.add(centerStone);

      // 3. Raised Chiseled Stone Curbs along edges that border non-road tiles
      const hasNorthRoad = grid.isRoad(coord.x, coord.z - 1);
      const hasSouthRoad = grid.isRoad(coord.x, coord.z + 1);
      const hasWestRoad = grid.isRoad(coord.x - 1, coord.z);
      const hasEastRoad = grid.isRoad(coord.x + 1, coord.z);

      const curbHeight = 0.08;
      const curbY = 0.155; // Slightly elevated above the pavers

      if (!hasNorthRoad) {
        const curbN = new THREE.Mesh(new THREE.BoxGeometry(s * 0.98, curbHeight, 0.16), curbStoneMat);
        curbN.position.set(world.x, curbY, world.z - 0.91);
        curbN.receiveShadow = true;
        roadGroup.add(curbN);
      }

      if (!hasSouthRoad) {
        const curbS = new THREE.Mesh(new THREE.BoxGeometry(s * 0.98, curbHeight, 0.16), curbStoneMat);
        curbS.position.set(world.x, curbY, world.z + 0.91);
        curbS.receiveShadow = true;
        roadGroup.add(curbS);
      }

      if (!hasWestRoad) {
        const curbW = new THREE.Mesh(new THREE.BoxGeometry(0.16, curbHeight, s * 0.98), curbStoneMat);
        curbW.position.set(world.x - 0.91, curbY, world.z);
        curbW.receiveShadow = true;
        roadGroup.add(curbW);
      }

      if (!hasEastRoad) {
        const curbE = new THREE.Mesh(new THREE.BoxGeometry(0.16, curbHeight, s * 0.98), curbStoneMat);
        curbE.position.set(world.x + 0.91, curbY, world.z);
        curbE.receiveShadow = true;
        roadGroup.add(curbE);
      }

      // 4. Milestone Wayposts & Braziers at Hairpin Corners
      const isHairpinCorner =
        (!hasNorthRoad && !hasEastRoad) ||
        (!hasSouthRoad && !hasEastRoad) ||
        (!hasNorthRoad && !hasWestRoad && coord.x > 0) ||
        (!hasSouthRoad && !hasWestRoad && coord.x > 0);

      if (isHairpinCorner) {
        const postGeom = new THREE.CylinderGeometry(0.16, 0.22, 0.45, 6);
        const post = new THREE.Mesh(postGeom, curbStoneMat);
        const cornerX = !hasEastRoad ? world.x + 0.85 : world.x - 0.85;
        const cornerZ = !hasSouthRoad ? world.z + 0.85 : world.z - 0.85;
        post.position.set(cornerX, 0.32, cornerZ);
        roadGroup.add(post);

        const lanternPole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.06), lanternIronMat);
        lanternPole.position.set(cornerX, 0.65, cornerZ);
        roadGroup.add(lanternPole);

        const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), lanternGlowMat);
        ember.position.set(cornerX, 0.80, cornerZ);
        roadGroup.add(ember);
      }

      tileIndex++;
    }
  }

  private buildPlayerCastle(pos: THREE.Vector3, parent: THREE.Object3D = this.scene, theme: CastleTheme = 'SUN'): THREE.Group {
    const palette = CASTLE_THEMES[theme];
    const group = new THREE.Group();
    group.position.copy(pos);

    // Castle Palette Materials
    const stoneBaseMat = new THREE.MeshStandardMaterial({
      color: 0x2a2522, // Deep soot-stained foundation granite
      roughness: 0.8,
      metalness: 0.15
    });
    const fortressStoneMat = new THREE.MeshStandardMaterial({
      color: 0x55493f, // Weathered ashlar masonry
      roughness: 0.7,
      metalness: 0.15
    });
    const stoneTrimMat = new THREE.MeshStandardMaterial({
      color: 0x7a6c5e, // Carved limestone trims, corbels & parapets
      roughness: 0.6,
      metalness: 0.1
    });
    const royalBlueSlateMat = new THREE.MeshStandardMaterial({
      color: palette.roof, // Weathered slate spire tiles in the team's colour
      roughness: 0.55,
      metalness: 0.3
    });
    const gildedGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Heraldic royal gold finials & crests
      metalness: 0.85,
      roughness: 0.25
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Wrought iron portcullis & wall bands
      metalness: 0.85,
      roughness: 0.3
    });
    const woodOakMat = new THREE.MeshStandardMaterial({
      color: 0x451a03, // Sturdy reinforced dark oak doors
      roughness: 0.85
    });
    const glowingWindowMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.95
    });
    const arcaneBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2
    });

    // 1. Fortified Stepped Foundation Terrace
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.45, 7.8), stoneBaseMat);
    plinth.position.y = 0.22;
    plinth.receiveShadow = true;
    group.add(plinth);

    // Stone entrance steps in front of the gate (facing +X)
    const steps = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 3.2), stoneTrimMat);
    steps.position.set(3.5, 0.1, 0);
    steps.receiveShadow = true;
    group.add(steps);

    // 2. Main Keep (Royal Donjon) - Multi-tiered Centerpiece
    // Lower Great Hall
    const keepLower = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.2, 5.4), fortressStoneMat);
    keepLower.position.set(0, 2.3, 0);
    keepLower.castShadow = true;
    keepLower.receiveShadow = true;
    group.add(keepLower);

    // Middle Fortress Tier
    const keepMid = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 4.4), fortressStoneMat);
    keepMid.position.set(0, 5.2, 0);
    keepMid.castShadow = true;
    keepMid.receiveShadow = true;
    group.add(keepMid);

    // Machicolated Overhang & Corbel Ring
    const corbelLedge = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.35, 4.8), stoneTrimMat);
    corbelLedge.position.set(0, 6.6, 0);
    corbelLedge.castShadow = true;
    group.add(corbelLedge);

    // Upper Belfry Tower
    const belfry = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 2.6, 8), fortressStoneMat);
    belfry.position.set(0, 7.8, 0);
    belfry.castShadow = true;
    group.add(belfry);

    // High Grand Spire (Cobalt Slate)
    const belfryRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.8, 8), royalBlueSlateMat);
    belfryRoof.position.set(0, 10.2, 0);
    belfryRoof.castShadow = true;
    group.add(belfryRoof);

    // Gilded Finial & Arcane Pinnacle Beacon
    const finialRod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), gildedGoldMat);
    finialRod.position.set(0, 11.8, 0);
    group.add(finialRod);

    const beaconCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), arcaneBeaconMat);
    beaconCrystal.position.set(0, 12.3, 0);
    group.add(beaconCrystal);

    // Rooftop Crenellations / Merlons around Upper Keep
    [-1.8, 1.8].forEach(xOff => {
      [-2.2, -0.7, 0.7, 2.2].forEach(zOff => {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.45), stoneTrimMat);
        merlon.position.set(xOff, 6.95, zOff);
        group.add(merlon);
      });
    });

    // 3. Grand Gatehouse & Portcullis (Front +X face)
    const gatehouse = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, 3.2), fortressStoneMat);
    gatehouse.position.set(2.4, 1.8, 0);
    gatehouse.castShadow = true;
    gatehouse.receiveShadow = true;
    group.add(gatehouse);

    // Gatehouse Stone Arch Coping
    const gateCoping = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 3.4), stoneTrimMat);
    gateCoping.position.set(2.4, 3.55, 0);
    group.add(gateCoping);

    // Twin Dark Oak Timber Doors (Arched Opening)
    const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.8), woodOakMat);
    doorLeft.position.set(2.9, 1.2, -0.42);
    doorLeft.rotation.y = -0.25; // Slightly ajar
    doorLeft.castShadow = true;
    group.add(doorLeft);

    const doorRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.8), woodOakMat);
    doorRight.position.set(2.9, 1.2, 0.42);
    doorRight.rotation.y = 0.25; // Slightly ajar
    doorRight.castShadow = true;
    group.add(doorRight);

    // Iron Portcullis Grill (Partially raised above entrance)
    const portcullis = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 1.6), darkIronMat);
    portcullis.position.set(2.95, 2.2, 0);
    group.add(portcullis);

    // Royal Crest Shield above the Gate
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.55), gildedGoldMat);
    crest.position.set(3.12, 2.95, 0);
    group.add(crest);

    // Flanking Entrance Lantern Torches
    [-1.2, 1.2].forEach(zLantern => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), darkIronMat);
      bracket.position.set(3.15, 2.1, zLantern);
      group.add(bracket);

      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), glowingWindowMat);
      lantern.position.set(3.3, 2.05, zLantern);
      group.add(lantern);

      const lanternLight = new THREE.PointLight(0xffa040, 0.5, 5);
      lanternLight.position.set(3.4, 2.05, zLantern);
      group.add(lanternLight);
    });

    // 4. Stained Glass Windows & Lancet Openings
    // Grand Rose Window on Keep Front Face
    const roseWindow = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12), glowingWindowMat);
    roseWindow.rotation.z = Math.PI / 2;
    roseWindow.position.set(2.22, 4.8, 0);
    group.add(roseWindow);

    // Lancet windows on Keep sides
    [-2.72, 2.72].forEach(zWindow => {
      [3.0, 4.8].forEach(yWindow => {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 0.08), glowingWindowMat);
        win.position.set(0, yWindow, zWindow);
        group.add(win);
      });
    });

    // 5. Four Stately Sentry Corner Towers
    const towerPositions = [
      { x: 1.9, z: -2.7, hasBanner: true },   // Front North
      { x: 1.9, z: 2.7, hasBanner: true },    // Front South
      { x: -1.9, z: -2.7, hasBanner: false }, // Rear North
      { x: -1.9, z: 2.7, hasBanner: false }   // Rear South
    ];

    towerPositions.forEach(tp => {
      // Tower Lower Cylinder
      const tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 6.2, 8), fortressStoneMat);
      tBase.position.set(tp.x, 3.2, tp.z);
      tBase.castShadow = true;
      tBase.receiveShadow = true;
      group.add(tBase);

      // Machicolation Corbel Gallery
      const tGallery = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.9, 0.45, 8), stoneTrimMat);
      tGallery.position.set(tp.x, 6.35, tp.z);
      tGallery.castShadow = true;
      group.add(tGallery);

      // Parapet Merlons
      for (let m = 0; m < 4; m++) {
        const mAngle = (m * Math.PI) / 2 + Math.PI / 4;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.3), stoneTrimMat);
        merlon.position.set(tp.x + Math.cos(mAngle) * 0.95, 6.7, tp.z + Math.sin(mAngle) * 0.95);
        group.add(merlon);
      }

      // Conical Gothic Slate Roof
      const tRoof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 8), royalBlueSlateMat);
      tRoof.position.set(tp.x, 7.8, tp.z);
      tRoof.castShadow = true;
      group.add(tRoof);

      // Gilded Spire Finial Ball
      const tFinial = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), gildedGoldMat);
      tFinial.position.set(tp.x, 9.1, tp.z);
      group.add(tFinial);

      // Arrow Slit Window
      const arrowSlit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), darkIronMat);
      arrowSlit.position.set(tp.x + (tp.x > 0 ? 0.9 : -0.9), 4.2, tp.z);
      group.add(arrowSlit);

      // Royal Blue Wall Banners on front towers
      if (tp.hasBanner) {
        const banner = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.45), royalBlueSlateMat);
        banner.position.set(tp.x + 0.95, 4.6, tp.z);
        group.add(banner);

        // Gold Trim Border at bottom of banner
        const bTrim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.47), gildedGoldMat);
        bTrim.position.set(tp.x + 0.95, 3.65, tp.z);
        group.add(bTrim);
      }
    });

    // 6. Royal Standard Pennant flying from the main keep peak
    const flagStaff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), darkIronMat);
    flagStaff.position.set(0.6, 7.4, -0.6);
    group.add(flagStaff);

    // Fluttering Royal Standard Flag
    const flagGeom = new THREE.BufferGeometry();
    const flagVertices = new Float32Array([
      0, 0.5, 0,
      1.2, 0.25, 0.1,
      0, 0, 0
    ]);
    flagGeom.setAttribute('position', new THREE.BufferAttribute(flagVertices, 3));
    flagGeom.computeVertexNormals();
    const flagMesh = new THREE.Mesh(flagGeom, new THREE.MeshStandardMaterial({
      color: palette.banner,
      side: THREE.DoubleSide,
      roughness: 0.5
    }));
    flagMesh.position.set(0.6, 7.4, -0.6);
    group.add(flagMesh);

    parent.add(group);
    return group;
  }

  private buildTeleportationGate(pos: THREE.Vector3, parent: THREE.Object3D = this.scene): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Arcane Gate Palette Materials
    const granitePlinthMat = new THREE.MeshStandardMaterial({
      color: 0x2a2522, // Deep soot-stained foundation granite
      roughness: 0.8,
      metalness: 0.2
    });
    const ashlarArchMat = new THREE.MeshStandardMaterial({
      color: 0x64748b, // Ancient fortress stone
      roughness: 0.65,
      metalness: 0.15
    });
    const carvedTrimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Carved limestone trims & capitals
      roughness: 0.55,
      metalness: 0.1
    });
    const gildedRuneMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Inlaid runic gold
      metalness: 0.85,
      roughness: 0.25
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Wrought iron brackets & collars
      metalness: 0.85,
      roughness: 0.3
    });
    const arcaneCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.3
    });
    const vortexGlowMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      roughness: 0.3
    });

    // 1. Stepped Hexagonal Stone Foundation Dais
    const daisBase = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.8, 0.35, 6), granitePlinthMat);
    daisBase.position.y = 0.17;
    daisBase.receiveShadow = true;
    group.add(daisBase);

    const daisUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.15, 6), carvedTrimMat);
    daisUpper.position.y = 0.38;
    daisUpper.receiveShadow = true;
    group.add(daisUpper);

    // Stepped entrance threshold in front of the gate (facing -X towards road)
    const thresholdSteps = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 2.6), carvedTrimMat);
    thresholdSteps.position.set(-1.9, 0.12, 0);
    thresholdSteps.receiveShadow = true;
    group.add(thresholdSteps);

    // Inlaid Runic Portal Ring in the floor
    const floorRuneRing = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.6, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.7,
        side: THREE.DoubleSide
      })
    );
    floorRuneRing.rotation.x = -Math.PI / 2;
    floorRuneRing.position.y = 0.47;
    group.add(floorRuneRing);

    // 2. Monumental Fluted Arcane Pillars & Buttresses
    [-1.9, 1.9].forEach(zOffset => {
      // Pedestal Base
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), granitePlinthMat);
      ped.position.set(0, 0.55, zOffset);
      ped.castShadow = true;
      ped.receiveShadow = true;
      group.add(ped);

      // Fluted Pillar Column
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 4.0, 8), ashlarArchMat);
      pillar.position.set(0, 2.7, zOffset);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      group.add(pillar);

      // Golden Runic Binding Collars
      [1.4, 3.2].forEach(yCollar => {
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 6, 16), gildedRuneMat);
        collar.position.set(0, yCollar, zOffset);
        collar.rotation.x = Math.PI / 2;
        group.add(collar);
      });

      // Carved Corinthian/Gothic Capital
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 1.0), carvedTrimMat);
      cap.position.set(0, 4.75, zOffset);
      cap.castShadow = true;
      group.add(cap);

      // Slanted Exterior Buttress Wings
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 0.7), ashlarArchMat);
      const bZ = zOffset > 0 ? zOffset + 0.6 : zOffset - 0.6;
      buttress.position.set(0, 1.8, bZ);
      buttress.rotation.x = zOffset > 0 ? -0.2 : 0.2;
      buttress.castShadow = true;
      group.add(buttress);

      // Pillar Pinnacle Mana Crystals
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), arcaneCrystalMat);
      crystal.position.set(0, 5.2, zOffset);
      group.add(crystal);
    });

    // 3. Multi-Layered Grand Archway
    // Outer Heavy Stone Arch
    const outerArchGeom = new THREE.TorusGeometry(1.9, 0.26, 8, 28, Math.PI);
    const outerArch = new THREE.Mesh(outerArchGeom, ashlarArchMat);
    outerArch.position.set(0, 3.1, 0);
    outerArch.rotation.y = -Math.PI / 2;
    outerArch.castShadow = true;
    group.add(outerArch);

    // Inner Glowing Conduit Arch
    const innerArchGeom = new THREE.TorusGeometry(1.62, 0.12, 8, 24, Math.PI);
    const innerArch = new THREE.Mesh(innerArchGeom, vortexGlowMat);
    innerArch.position.set(0, 3.1, 0);
    innerArch.rotation.y = -Math.PI / 2;
    group.add(innerArch);

    // Gilded Keystone with Arcane Eye Ornament
    const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.75), carvedTrimMat);
    keystone.position.set(0, 5.0, 0);
    keystone.castShadow = true;
    group.add(keystone);

    const keystoneGold = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.45, 0.45), gildedRuneMat);
    keystoneGold.position.set(0, 5.05, 0);
    group.add(keystoneGold);

    // Floating Keystone Nexus Crystal suspended at apex
    const nexusCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36), arcaneCrystalMat);
    nexusCrystal.position.set(0, 5.75, 0);
    group.add(nexusCrystal);

    // 4. Swirling Dimensional Portal Vortex
    const vortexGeom = new THREE.CircleGeometry(1.5, 32);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide
    });
    const portalVortex = new THREE.Mesh(vortexGeom, vortexMat);
    portalVortex.position.set(0, 3.1, 0);
    portalVortex.rotation.y = -Math.PI / 2;
    group.add(portalVortex);
    this.portalVortices.push(portalVortex);

    // Inner Singularity Disc
    const singularity = new THREE.Mesh(
      new THREE.CircleGeometry(0.65, 24),
      new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
      })
    );
    singularity.position.set(0.01, 3.1, 0);
    singularity.rotation.y = -Math.PI / 2;
    group.add(singularity);

    // 5. Twin Arcane Fire Braziers at Entrance Threshold
    [-1.5, 1.5].forEach(zBrazier => {
      const bPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.8, 6), granitePlinthMat);
      bPlinth.position.set(-1.8, 0.5, zBrazier);
      bPlinth.castShadow = true;
      group.add(bPlinth);

      const bBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.18, 0.25, 8), darkIronMat);
      bBowl.position.set(-1.8, 0.95, zBrazier);
      group.add(bBowl);

      const bFire = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), arcaneCrystalMat);
      bFire.position.set(-1.8, 1.12, zBrazier);
      group.add(bFire);

      const bLight = new THREE.PointLight(0x38bdf8, 0.6, 6);
      bLight.position.set(-1.8, 1.25, zBrazier);
      group.add(bLight);
    });

    // Central Warm Portal Light
    const portalLight = new THREE.PointLight(0x0284c7, 0.8, 10);
    portalLight.position.set(0, 3.1, 0);
    group.add(portalLight);

    parent.add(group);
    return group;
  }

  private buildArrivalTeleportPad(pos: THREE.Vector3, parent: THREE.Object3D = this.scene): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Gladiator Dais Palette Materials
    const arenaGraniteMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Polished dark slate
      roughness: 0.65,
      metalness: 0.25
    });
    const stoneTrimMat = new THREE.MeshStandardMaterial({
      color: 0x64748b, // Weathered carved stone
      roughness: 0.7,
      metalness: 0.15
    });
    const gildedBrassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Polished gold/brass collars & inlays
      metalness: 0.85,
      roughness: 0.2
    });

    // 1. Concentric Stepped Gladiator Arrival Dais
    const lowerDais = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.28, 16), arenaGraniteMat);
    lowerDais.position.y = 0.14;
    lowerDais.receiveShadow = true;
    group.add(lowerDais);

    const upperDais = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.14, 16), stoneTrimMat);
    upperDais.position.y = 0.32;
    upperDais.receiveShadow = true;
    group.add(upperDais);

    // Radial Runic Floor Inlays (8 radial stone notches around perimeter)
    for (let r = 0; r < 8; r++) {
      const angle = (r * Math.PI) / 4;
      const notch = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.4), gildedBrassMat);
      notch.position.set(Math.cos(angle) * 2.2, 0.34, Math.sin(angle) * 2.2);
      notch.rotation.y = -angle;
      group.add(notch);
    }

    // Outer Glowing Runic Dial Ring
    const outerDial = new THREE.Mesh(
      new THREE.RingGeometry(1.65, 1.85, 32),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.7,
        side: THREE.DoubleSide
      })
    );
    outerDial.rotation.x = -Math.PI / 2;
    outerDial.position.y = 0.40;
    group.add(outerDial);

    // Swirling Arrival Vortex (horizontal floor vortex)
    const ringGeom = new THREE.RingGeometry(0.8, 1.55, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    });
    const arrivalVortex = new THREE.Mesh(ringGeom, ringMat);
    arrivalVortex.position.y = 0.42;
    group.add(arrivalVortex);
    this.arrivalVortices.push(arrivalVortex);

    // Inner Glowing Singularity Core
    const arrivalCore = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92
      })
    );
    arrivalCore.rotation.x = -Math.PI / 2;
    arrivalCore.position.y = 0.41;
    group.add(arrivalCore);

    // Central Upward Ascension Light
    const centerLight = new THREE.PointLight(0x0284c7, 0.7, 8);
    centerLight.position.set(0, 1.5, 0);
    group.add(centerLight);

    parent.add(group);
    return group;
  }

  private buildTorchBrazier(pos: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Stone Pillar
    const pillarGeom = new THREE.CylinderGeometry(0.3, 0.4, 1.4, 6);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x44403c });
    const pillar = new THREE.Mesh(pillarGeom, pillarMat);
    pillar.position.y = 0.7;
    pillar.castShadow = true;
    group.add(pillar);

    // Fire Orb
    const fireGeom = new THREE.SphereGeometry(0.18, 8, 8);
    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xff6a1a,
      emissiveIntensity: 3.2
    });
    const fire = new THREE.Mesh(fireGeom, fireMat);
    fire.position.y = 1.55;
    group.add(fire);
    
    // Fire Light
    const fireLight = new THREE.PointLight(0xff7a2a, 2.4, 11, 1.7);
    fireLight.position.y = 1.55;
    group.add(fireLight);

    this.scene.add(group);
  }

  /**
   * The Infernal Citadel: the enemy fortress forming the arena's east wall (solo & co-op).
   * Built facing west (-X) towards the arena; its bulk hangs out over the abyss on a molten rock spur.
   */
  private buildEnemyCitadel(pos: THREE.Vector3, parent: THREE.Object3D = this.scene): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(pos);

    const obsidian = new THREE.MeshStandardMaterial({ color: 0x1b151d, roughness: 0.45, metalness: 0.35, flatShading: true });
    const volcanicBrick = new THREE.MeshStandardMaterial({
      color: 0x8a6e6a,
      map: createMasonryTexture(2, 2),
      roughness: 0.9,
      metalness: 0.05
    });
    const bloodIron = new THREE.MeshStandardMaterial({ color: 0x4a1418, roughness: 0.4, metalness: 0.7, flatShading: true });
    const bone = new THREE.MeshStandardMaterial({ color: 0x8f8270, roughness: 0.8, flatShading: true });
    const magma = new THREE.MeshStandardMaterial({ color: 0xff5a1a, emissive: 0xff3c0a, emissiveIntensity: 2.4 });
    const hellfire = new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff2a0a, emissiveIntensity: 3.2, roughness: 0.3 });
    const banner = new THREE.MeshStandardMaterial({ color: 0x5c0f18, roughness: 0.9, side: THREE.DoubleSide });

    const add = (geom: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    /** Ring of jagged spikes crowning a tower top. */
    const spikeCrown = (x: number, y: number, z: number, r: number, count: number, h: number) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        add(new THREE.ConeGeometry(0.18, h * (0.7 + (i % 2) * 0.4), 4), obsidian,
          x + Math.cos(a) * r, y + h * 0.4, z + Math.sin(a) * r, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      }
    };

    /** Tall arrow-slit windows lit by the forges inside. */
    const slit = (x: number, y: number, z: number, h = 0.7) => add(new THREE.BoxGeometry(0.08, h, 0.16), magma, x, y, z);

    // 1. Molten rock spur the fortress stands on, hanging into the abyss
    const rock = new THREE.MeshStandardMaterial({ color: 0x151013, roughness: 0.95, flatShading: true });
    add(new THREE.BoxGeometry(7.5, 1.4, 19.6), rock, 3.2, -0.55, 0);
    add(new THREE.ConeGeometry(6.5, 11, 6), rock, 3.6, -6.8, 0, Math.PI);
    add(new THREE.ConeGeometry(3.2, 7, 5), rock, 3.0, -4.5, 6.5, Math.PI);
    add(new THREE.ConeGeometry(3.2, 7, 5), rock, 3.0, -4.5, -6.5, Math.PI);
    [[0.2, -2.2, 5.5, 0.3], [0.2, -3.2, -3.0, -0.2], [0.2, -2.6, 1.6, 0.15]].forEach(([x, y, z, rz]) => {
      add(new THREE.BoxGeometry(0.12, 3.6, 0.25), magma, x, y, z, 0, 0, rz);
    });

    // 2. Curtain wall: the arena's east wall, with spiked battlements
    add(new THREE.BoxGeometry(1.4, 4.2, 19.2), volcanicBrick, 0.2, 2.1, 0);
    add(new THREE.BoxGeometry(1.8, 0.35, 19.6), obsidian, 0.2, 4.35, 0);
    for (let z = -9; z <= 9; z += 1.5) {
      if (Math.abs(z) < 2.2) continue; // gatehouse
      add(new THREE.ConeGeometry(0.22, 0.9, 4), obsidian, -0.35, 4.9, z);
    }
    [-6.5, -4.2, 4.2, 6.5].forEach(z => slit(-0.52, 2.6, z));

    // 3. Gatehouse with a glowing hellfire portcullis and a horned skull above
    add(new THREE.BoxGeometry(2.4, 6.4, 4.4), volcanicBrick, -0.1, 3.2, 0);
    add(new THREE.BoxGeometry(2.8, 0.4, 4.8), obsidian, -0.1, 6.5, 0);
    add(new THREE.BoxGeometry(0.3, 3.2, 2.2), new THREE.MeshStandardMaterial({ color: 0x0a0608, roughness: 1 }), -1.25, 1.6, 0);
    for (let i = -2; i <= 2; i++) add(new THREE.BoxGeometry(0.08, 3.0, 0.08), bloodIron, -1.42, 1.55, i * 0.42);
    for (let j = 0; j < 4; j++) add(new THREE.BoxGeometry(0.08, 0.08, 2.1), bloodIron, -1.42, 0.5 + j * 0.8, 0);
    add(new THREE.BoxGeometry(0.05, 3.0, 2.0), new THREE.MeshStandardMaterial({ color: 0xff4a14, emissive: 0xff3008, emissiveIntensity: 1.3, transparent: true, opacity: 0.55 }), -1.3, 1.55, 0);
    const skullY = 4.6;
    add(new THREE.SphereGeometry(0.62, 8, 7), bone, -1.45, skullY, 0);
    add(new THREE.BoxGeometry(0.55, 0.35, 0.7), bone, -1.5, skullY - 0.5, 0);
    [-0.22, 0.22].forEach(z => add(new THREE.SphereGeometry(0.13, 6, 5), hellfire, -1.98, skullY + 0.05, z));
    [-1, 1].forEach(side => add(new THREE.ConeGeometry(0.16, 1.1, 5), bone, -1.3, skullY + 0.55, side * 0.55, 0, 0, side * 0.9));
    for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.2, 0.8, 4), obsidian, -0.9, 7.0, -1.8 + i * 0.9);

    // 4. Gate towers flanking the portcullis
    [-1, 1].forEach(side => {
      const z = side * 3.1;
      add(new THREE.CylinderGeometry(1.25, 1.5, 9.5, 8), volcanicBrick, 0.3, 4.75, z);
      add(new THREE.CylinderGeometry(1.55, 1.35, 0.45, 8), obsidian, 0.3, 9.7, z);
      spikeCrown(0.3, 9.9, z, 1.35, 8, 1.1);
      add(new THREE.ConeGeometry(1.1, 4.2, 8), bloodIron, 0.3, 12.1, z);
      add(new THREE.ConeGeometry(0.12, 1.4, 4), obsidian, 0.3, 14.8, z);
      [3.6, 6.4].forEach(y => slit(-0.95, y, z, 0.9));
      // Hellfire braziers on the tower fronts
      add(new THREE.CylinderGeometry(0.45, 0.25, 0.4, 7), bloodIron, -1.45, 7.6, z);
      const flame = add(new THREE.OctahedronGeometry(0.34, 0), hellfire, -1.45, 8.05, z);
      flame.scale.y = 1.5;
      const fireLight = new THREE.PointLight(0xff4a1a, 2.6, 13, 1.6);
      fireLight.position.set(-1.9, 8.2, z);
      group.add(fireLight);
      // Tattered war banners
      const b = add(new THREE.BoxGeometry(0.04, 2.6, 1.0), banner, -1.3, 5.2, z);
      b.rotation.z = 0.04 * side;
      add(new THREE.OctahedronGeometry(0.2, 0), magma, -1.33, 5.6, z).scale.set(0.3, 1.5, 1);
    });

    // 5. Corner watchtowers at the ends of the curtain wall
    [-1, 1].forEach(side => {
      const z = side * 8.2;
      add(new THREE.CylinderGeometry(1.0, 1.25, 7.0, 7), volcanicBrick, 0.4, 3.5, z);
      spikeCrown(0.4, 7.0, z, 1.05, 7, 0.9);
      add(new THREE.ConeGeometry(0.85, 3.0, 7), bloodIron, 0.4, 8.9, z);
      slit(-0.62, 4.6, z, 0.8);
    });

    // 6. The Dread Keep behind the gate, crowned by a chained hellfire crystal
    add(new THREE.BoxGeometry(4.2, 11, 5.4), volcanicBrick, 4.0, 5.5, 0);
    add(new THREE.BoxGeometry(4.6, 0.5, 5.8), obsidian, 4.0, 11.2, 0);
    add(new THREE.BoxGeometry(3.0, 3.2, 3.8), volcanicBrick, 4.0, 13.0, 0);
    [[-2.25, 0], [2.25, 0], [0, -2.85], [0, 2.85]].forEach(([dx, dz]) => {
      add(new THREE.ConeGeometry(0.35, 3.2, 4), obsidian, 4.0 + dx, 13.2, dz, dz * 0.08, 0, -dx * 0.08);
    });
    for (let y = 3; y <= 9; y += 2.6) {
      [-1.6, 0, 1.6].forEach(z => slit(1.85, y, z, 1.0));
    }
    const crystal = add(new THREE.OctahedronGeometry(0.95, 0), hellfire, 4.0, 17.4, 0);
    crystal.scale.y = 1.6;
    this.spinners.push(crystal);
    [[-2.25, 0], [2.25, 0], [0, -2.85], [0, 2.85]].forEach(([dx, dz]) => {
      const from = new THREE.Vector3(4.0 + dx, 14.6, dz);
      const to = new THREE.Vector3(4.0, 17.2, 0);
      const len = from.distanceTo(to);
      const chain = add(new THREE.CylinderGeometry(0.05, 0.05, len, 4), bloodIron, (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      chain.lookAt(to);
      chain.rotateX(Math.PI / 2);
    });
    const crystalLight = new THREE.PointLight(0xff3a14, 3.5, 32, 1.4);
    crystalLight.position.set(4.0, 17.4, 0);
    group.add(crystalLight);

    parent.add(group);
    return group;
  }

  /**
   * 1. Atmosphere & Celestial Sky Dome
   */
  private buildSkyAndAtmosphere() {
    // A. Procedural Twilight Horizon Sky Dome
    const skyDomeGeom = new THREE.SphereGeometry(220, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
    skyDomeGeom.scale(-1, 1, 1); // Invert faces to render interior

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, '#0c121e');    // Deep midnight indigo at zenith
      gradient.addColorStop(0.42, '#141e30'); // Twilight navy
      gradient.addColorStop(0.72, '#1e293b'); // Lower sky slate
      gradient.addColorStop(0.88, '#3b2633'); // Warm sunset horizon haze
      gradient.addColorStop(1.0, '#1c1524');  // Horizon edge silhouette
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 16, 256);

      const skyTex = new THREE.CanvasTexture(canvas);
      const skyDomeMat = new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false });
      const skyDome = new THREE.Mesh(skyDomeGeom, skyDomeMat);
      skyDome.position.y = -18;
      this.scene.add(skyDome);
    }

    // B. Celestial Fantasy Moon in North-West
    const moonGroup = new THREE.Group();
    moonGroup.position.set(-68, 56, -92);

    const moonGeom = new THREE.SphereGeometry(5.2, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const moon = new THREE.Mesh(moonGeom, moonMat);
    moonGroup.add(moon);

    const haloGeom = new THREE.RingGeometry(5.4, 9.5, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const halo = new THREE.Mesh(haloGeom, haloMat);
    halo.lookAt(-10, 0, 0);
    moonGroup.add(halo);
    this.scene.add(moonGroup);

    // Directional cool moonlight tint
    const moonLight = new THREE.DirectionalLight(0xa5b4fc, 0.45);
    moonLight.position.set(-68, 56, -92);
    this.scene.add(moonLight);

    // C. Twinkling Fantasy Starfield in Upper Celestial Vault
    const starCount = 350;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 85;
      starPositions[i * 3] = Math.cos(theta) * radius;
      starPositions[i * 3 + 1] = 22 + Math.random() * 55;
      starPositions[i * 3 + 2] = Math.sin(theta) * radius - 20;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85
    });
    const stars = new THREE.Points(starGeom, starMat);
    this.scene.add(stars);
  }

  /**
   * 2. Sculpted Bedrock Foundations beneath the Floating Islands
   */
  private buildIslandBedrock() {
    this.buildMazeBedrock(this.scene);
    this.buildArenaBedrock();
  }

  /** Floating rock foundation under the maze island (Sun position). */
  private buildMazeBedrock(parent: THREE.Object3D) {
    // --- Maze Island Bedrock (Kingdom of Light Floating Rock Foundation) ---
    const mazeBedrock = new THREE.Group();
    mazeBedrock.position.set(-22, 0, 0);

    const graniteMat = new THREE.MeshStandardMaterial({ color: 0x332e29, roughness: 0.9 });
    const deepRockMat = new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 0.95 });

    // Stepped bedrock tiers (depth 32)
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(23.2, 1.2, 31.2), graniteMat);
    l1.position.y = -0.7;
    mazeBedrock.add(l1);

    const l2 = new THREE.Mesh(new THREE.BoxGeometry(20.5, 1.6, 27.5), deepRockMat);
    l2.position.y = -1.9;
    mazeBedrock.add(l2);

    const l3 = new THREE.Mesh(new THREE.BoxGeometry(16.0, 2.0, 22.0), deepRockMat);
    l3.position.y = -3.5;
    mazeBedrock.add(l3);

    const l4 = new THREE.Mesh(new THREE.ConeGeometry(8.5, 4.5, 6), deepRockMat);
    l4.position.y = -6.0;
    l4.rotation.x = Math.PI;
    mazeBedrock.add(l4);

    // Hanging stalactite earth crags along the rim
    const stalactiteMat = new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.85 });
    const cragPositions = [
      { x: -11.0, z: -12.0, h: 2.8, r: 0.65 },
      { x: -11.0, z: 12.0, h: 3.2, r: 0.75 },
      { x: 11.0, z: -10.0, h: 2.8, r: 0.65 },
      { x: 11.0, z: 10.0, h: 3.5, r: 0.8 },
      { x: -5.0, z: 15.2, h: 2.5, r: 0.6 },
      { x: 6.0, z: 15.2, h: 3.2, r: 0.7 },
      { x: -4.0, z: -15.2, h: 2.6, r: 0.65 },
      { x: 5.0, z: -15.2, h: 3.0, r: 0.7 }
    ];
    cragPositions.forEach(cp => {
      const crag = new THREE.Mesh(new THREE.ConeGeometry(cp.r, cp.h, 5), stalactiteMat);
      crag.position.set(cp.x, -cp.h * 0.5 - 0.3, cp.z);
      crag.rotation.x = Math.PI;
      mazeBedrock.add(crag);
    });

    parent.add(mazeBedrock);
  }

  private buildArenaBedrock() {

    // --- Arena Island Bedrock (Infernal Dreadfort Basalt Foundation) ---
    const arenaBedrock = new THREE.Group();
    arenaBedrock.position.set(ARENA_CENTER_X, 0, 0);

    const basaltMat = new THREE.MeshStandardMaterial({ color: 0x1c1719, roughness: 0.85, metalness: 0.2 });
    const deepBasaltMat = new THREE.MeshStandardMaterial({ color: 0x120e10, roughness: 0.95 });
    const lavaVeinMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
    this.lavaMaterials.push(lavaVeinMat);

    const a1 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_WIDTH - 0.8, 1.4, 19.4), basaltMat);
    a1.position.y = -0.8;
    arenaBedrock.add(a1);

    const a2 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_WIDTH - 4.5, 1.8, 16.0), deepBasaltMat);
    a2.position.y = -2.2;
    arenaBedrock.add(a2);

    const a3 = new THREE.Mesh(new THREE.BoxGeometry(ARENA_WIDTH - 10.5, 2.2, 11.5), deepBasaltMat);
    a3.position.y = -4.0;
    arenaBedrock.add(a3);

    const a4 = new THREE.Mesh(new THREE.ConeGeometry(7.0, 4.5, 6), deepBasaltMat);
    a4.position.y = -6.8;
    a4.rotation.x = Math.PI;
    arenaBedrock.add(a4);

    // Glowing magma fissures running down bedrock edges
    [-6, 2, 8].forEach(xOff => {
      const veinN = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.5, 0.1), lavaVeinMat);
      veinN.position.set(xOff, -1.8, -9.8);
      veinN.rotation.z = (xOff % 2 === 0) ? 0.2 : -0.2;
      arenaBedrock.add(veinN);

      const veinS = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.5, 0.1), lavaVeinMat);
      veinS.position.set(xOff, -1.8, 9.8);
      veinS.rotation.z = (xOff % 2 === 0) ? -0.2 : 0.2;
      arenaBedrock.add(veinS);
    });

    this.scene.add(arenaBedrock);
  }

  /**
   * 3. Majestic Distant Mountain Ranges on Horizon
   */
  private buildDistantMountainRanges() {
    const mountainGroup = new THREE.Group();

    const alpineRockMat = new THREE.MeshStandardMaterial({ color: 0x161a24, roughness: 0.95, flatShading: true });
    const alpineSnowMat = new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: 0.9, flatShading: true });
    const volcanicRockMat = new THREE.MeshStandardMaterial({ color: 0x140f12, roughness: 0.95, flatShading: true });
    const calderaGlowMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    this.lavaMaterials.push(calderaGlowMat);

    // A. Northwest Alpine Mountain Range (Sanctum of Light)
    const alpinePeaks = [
      { x: -82, z: -85, r: 18, h: 44 },
      { x: -62, z: -78, r: 15, h: 36 },
      { x: -46, z: -88, r: 21, h: 50 },
      { x: -30, z: -80, r: 14, h: 34 },
      { x: -18, z: -92, r: 17, h: 42 },
      { x: -74, z: -68, r: 12, h: 26 },
      { x: -52, z: -62, r: 10, h: 22 },
      { x: -36, z: -66, r: 11, h: 25 }
    ];

    alpinePeaks.forEach((p, idx) => {
      const segs = 5 + (idx % 3);
      const mGeom = new THREE.ConeGeometry(p.r, p.h, segs);
      const mountain = new THREE.Mesh(mGeom, alpineRockMat);
      mountain.position.set(p.x, p.h * 0.5 - 12, p.z);
      mountain.rotation.y = idx * 1.1;
      mountainGroup.add(mountain);

      // Snow Cap (Top 35%)
      const capH = p.h * 0.35;
      const capR = p.r * 0.35;
      const cGeom = new THREE.ConeGeometry(capR, capH, segs);
      const cap = new THREE.Mesh(cGeom, alpineSnowMat);
      cap.position.set(p.x, p.h - capH * 0.5 - 12, p.z);
      cap.rotation.y = idx * 1.1;
      mountainGroup.add(cap);
    });

    // B. Northeast Volcanic Mountain Range (Infernal Badlands)
    const volcanicPeaks = [
      { x: 2,  z: -90, r: 16, h: 38, hasLava: false },
      { x: 18, z: -82, r: 19, h: 45, hasLava: true },
      { x: 36, z: -88, r: 22, h: 52, hasLava: true },
      { x: 54, z: -78, r: 17, h: 40, hasLava: true },
      { x: 70, z: -86, r: 20, h: 46, hasLava: false },
      { x: 12, z: -65, r: 11, h: 24, hasLava: false },
      { x: 28, z: -62, r: 13, h: 28, hasLava: false },
      { x: 48, z: -64, r: 12, h: 26, hasLava: false },
      { x: 64, z: -66, r: 14, h: 30, hasLava: false }
    ];

    volcanicPeaks.forEach((p, idx) => {
      const segs = 5 + (idx % 3);
      const mGeom = new THREE.ConeGeometry(p.r, p.h, segs);
      const volcano = new THREE.Mesh(mGeom, volcanicRockMat);
      volcano.position.set(p.x, p.h * 0.5 - 12, p.z);
      volcano.rotation.y = idx * 0.9;
      mountainGroup.add(volcano);

      if (p.hasLava) {
        const caldH = p.h * 0.16;
        const caldR = p.r * 0.16;
        const caldGeom = new THREE.ConeGeometry(caldR, caldH, segs);
        const caldera = new THREE.Mesh(caldGeom, calderaGlowMat);
        caldera.position.set(p.x, p.h - caldH * 0.5 - 12, p.z);
        caldera.rotation.y = idx * 0.9;
        mountainGroup.add(caldera);
      }
    });

    // C. Southern Horizon Framing Hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x18241b, roughness: 0.95 });
    const southHills = [
      { x: -65, z: 50, r: 22, h: 14 },
      { x: -35, z: 46, r: 18, h: 12 },
      { x: -10, z: 48, r: 16, h: 10 },
      { x: 18,  z: 48, r: 18, h: 11 },
      { x: 45,  z: 50, r: 20, h: 13 },
      { x: 68,  z: 46, r: 22, h: 15 }
    ];
    southHills.forEach(h => {
      const hGeom = new THREE.SphereGeometry(h.r, 8, 6);
      const hill = new THREE.Mesh(hGeom, hillMat);
      hill.position.set(h.x, -h.r + h.h - 5.5, h.z);
      mountainGroup.add(hill);
    });

    mountainGroup.position.y = -8;
    this.scene.add(mountainGroup);
  }

  /**
   * 4. West Kingdom Terrain: Rolling Valleys, Pine Forests, Mountain River & Ancient Ruins
   */
  private buildWestKingdomTerrain() {
    const westGroup = new THREE.Group();

    // Lower valley ground plane
    const valleyGeom = new THREE.PlaneGeometry(90, 110);
    valleyGeom.rotateX(-Math.PI / 2);
    const valleyMat = new THREE.MeshStandardMaterial({ color: 0x162c18, roughness: 0.95 });
    const valley = new THREE.Mesh(valleyGeom, valleyMat);
    valley.position.set(-45, -6.5, 0);
    westGroup.add(valley);

    // Rolling grassy mounds
    const knollMat1 = new THREE.MeshStandardMaterial({ color: 0x224823, roughness: 0.9 });
    const knollMat2 = new THREE.MeshStandardMaterial({ color: 0x1c3a1e, roughness: 0.9 });
    const knolls = [
      { x: -55, z: -35, r: 15, h: 4.5, mat: knollMat1 },
      { x: -40, z: -40, r: 12, h: 4.0, mat: knollMat2 },
      { x: -60, z: -10, r: 16, h: 5.0, mat: knollMat1 },
      { x: -58, z: 20,  r: 14, h: 4.2, mat: knollMat2 },
      { x: -45, z: 35,  r: 15, h: 4.5, mat: knollMat1 },
      { x: -30, z: 38,  r: 11, h: 3.5, mat: knollMat2 },
      { x: -18, z: -36, r: 10, h: 3.2, mat: knollMat1 },
      { x: -25, z: -45, r: 13, h: 3.8, mat: knollMat2 }
    ];
    knolls.forEach(k => {
      const kGeom = new THREE.SphereGeometry(k.r, 8, 6);
      const mound = new THREE.Mesh(kGeom, k.mat);
      mound.position.set(k.x, -k.r + k.h - 6.5, k.z);
      westGroup.add(mound);
    });

    // Ancient Medieval Watchtower Ruin in the Western Hills
    const towerStoneMat = new THREE.MeshStandardMaterial({ color: 0x48423b, roughness: 0.85 });
    const towerWoodMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.8 });
    const ruinGroup = new THREE.Group();
    ruinGroup.position.set(-52, -2.5, -20);
    const rBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 5.0, 6), towerStoneMat);
    rBase.position.y = 2.5;
    ruinGroup.add(rBase);
    for (let c = 0; c < 5; c++) {
      const ang = (c / 6) * Math.PI * 2;
      const bGeom = new THREE.BoxGeometry(0.5, 0.6, 0.4);
      const merl = new THREE.Mesh(bGeom, towerStoneMat);
      merl.position.set(Math.cos(ang) * 1.4, 5.2, Math.sin(ang) * 1.4);
      ruinGroup.add(merl);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.0, 4), towerWoodMat);
    beam.position.set(0.6, 3.5, 0.8);
    beam.rotation.z = 0.5;
    ruinGroup.add(beam);
    westGroup.add(ruinGroup);

    // Clustered Alpine Pine Forests
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.9 });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x143c1c, roughness: 0.85 });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x1e4a26, roughness: 0.85 });

    const createPineTree = (x: number, y: number, z: number, scale: number) => {
      const tree = new THREE.Group();
      tree.position.set(x, y, z);
      tree.scale.set(scale, scale, scale);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.8, 5), trunkMat);
      trunk.position.y = 0.9;
      tree.add(trunk);

      const fMat = (x + z) % 2 > 0 ? foliageMat1 : foliageMat2;
      const tiers = [
        { r: 1.1, h: 1.4, y: 1.7 },
        { r: 0.85, h: 1.3, y: 2.5 },
        { r: 0.6, h: 1.2, y: 3.3 }
      ];
      tiers.forEach(t => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 5), fMat);
        cone.position.y = t.y;
        tree.add(cone);
      });
      return tree;
    };

    const treePositions = [
      // Cluster 1: West hills
      { x: -50, y: -2.5, z: -30, s: 1.1 }, { x: -47, y: -3.0, z: -27, s: 0.9 },
      { x: -53, y: -2.3, z: -25, s: 1.2 }, { x: -44, y: -3.5, z: -32, s: 0.85 },
      { x: -56, y: -2.0, z: -15, s: 1.0 }, { x: -48, y: -2.8, z: -12, s: 1.15 },
      { x: -52, y: -2.4, z: -8,  s: 0.9 }, { x: -58, y: -2.0, z: -4,  s: 1.05 },
      // Cluster 2: North valley
      { x: -38, y: -3.5, z: -34, s: 1.0 }, { x: -33, y: -4.0, z: -32, s: 0.95 },
      { x: -42, y: -3.2, z: -38, s: 1.2 }, { x: -28, y: -4.5, z: -35, s: 0.8 },
      { x: -22, y: -4.8, z: -32, s: 1.1 }, { x: -17, y: -5.0, z: -30, s: 0.9 },
      // Cluster 3: South meadows
      { x: -54, y: -2.2, z: 18,  s: 1.1 }, { x: -48, y: -2.8, z: 22,  s: 0.85 },
      { x: -42, y: -3.2, z: 26,  s: 1.05 }, { x: -38, y: -3.8, z: 29,  s: 0.95 },
      { x: -46, y: -3.0, z: 32,  s: 1.15 }, { x: -33, y: -4.2, z: 35,  s: 0.9 },
      { x: -27, y: -4.6, z: 33,  s: 1.0 }, { x: -20, y: -5.0, z: 28,  s: 0.85 }
    ];
    treePositions.forEach(tp => {
      westGroup.add(createPineTree(tp.x, tp.y, tp.z, tp.s));
    });

    // Crystalline Alpine Mountain River
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x14203a,
      emissive: 0x0b1a33,
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9
    });
    const riverSegments = [
      { x: -44, z: -45, sx: 3.5, sz: 12, rot: 0.4 },
      { x: -39, z: -32, sx: 3.8, sz: 14, rot: 0.1 },
      { x: -36, z: -16, sx: 4.0, sz: 16, rot: -0.2 },
      { x: -33, z: 0,   sx: 4.2, sz: 16, rot: 0.15 },
      { x: -28, z: 16,  sx: 4.5, sz: 16, rot: 0.5 },
      { x: -19, z: 26,  sx: 5.0, sz: 14, rot: 0.8 }
    ];
    riverSegments.forEach(seg => {
      const rGeom = new THREE.PlaneGeometry(seg.sx, seg.sz);
      rGeom.rotateX(-Math.PI / 2);
      const riverMesh = new THREE.Mesh(rGeom, waterMat);
      riverMesh.position.set(seg.x, -6.35, seg.z);
      riverMesh.rotation.y = seg.rot;
      westGroup.add(riverMesh);
    });

    // Riverbank stones
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
    for (let i = 0; i < 12; i++) {
      const bGeom = new THREE.DodecahedronGeometry(0.3 + (i % 3) * 0.15);
      const b = new THREE.Mesh(bGeom, boulderMat);
      b.position.set(-36 + Math.sin(i * 1.5) * 6, -6.3, -35 + i * 5.5);
      westGroup.add(b);
    }

    // Far below the floating islands, mostly swallowed by the mist sea & fog
    westGroup.position.y = -22;
    this.scene.add(westGroup);
  }

  /**
   * 5. East Infernal Terrain: Scorched Badlands, Magma Rivers, Basalt Pillars & Obsidian Spikes
   */
  private buildEastInfernalTerrain() {
    const eastGroup = new THREE.Group();

    // Lower badlands ground plane
    const ashGeom = new THREE.PlaneGeometry(90, 110);
    ashGeom.rotateX(-Math.PI / 2);
    const ashMat = new THREE.MeshStandardMaterial({ color: 0x120f12, roughness: 0.95 });
    const ashField = new THREE.Mesh(ashGeom, ashMat);
    ashField.position.set(45, -6.5, 0);
    eastGroup.add(ashField);

    // Scorched volcanic crags
    const basaltCragMat = new THREE.MeshStandardMaterial({ color: 0x1d1719, roughness: 0.9, metalness: 0.2 });
    const crags = [
      { x: 38, z: -35, r: 13, h: 4.2 },
      { x: 55, z: -25, r: 16, h: 4.8 },
      { x: 62, z: 10,  r: 15, h: 4.5 },
      { x: 48, z: 30,  r: 14, h: 4.0 },
      { x: 32, z: 38,  r: 12, h: 3.5 },
      { x: 18, z: -36, r: 11, h: 3.2 },
      { x: 20, z: 34,  r: 10, h: 3.0 }
    ];
    crags.forEach(c => {
      const cGeom = new THREE.DodecahedronGeometry(c.r);
      const crag = new THREE.Mesh(cGeom, basaltCragMat);
      crag.position.set(c.x, -c.r + c.h - 6.5, c.z);
      crag.scale.set(1.2, 0.45, 1.0);
      eastGroup.add(crag);
    });

    // Glowing Rivers of Molten Magma
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff3800 });
    const lavaEdgeMat = new THREE.MeshBasicMaterial({ color: 0x3a0906 });
    this.lavaMaterials.push(lavaMat);

    const lavaStreams = [
      { x: 42, z: -8,  sx: 3.2, sz: 14, rot: -0.3 },
      { x: 32, z: -15, sx: 3.6, sz: 16, rot: -0.6 },
      { x: 20, z: -22, sx: 4.0, sz: 14, rot: -0.8 },
      { x: 10, z: -25, sx: 4.5, sz: 12, rot: -1.1 },
      { x: 38, z: 14,  sx: 3.0, sz: 16, rot: 0.4 },
      { x: 26, z: 22,  sx: 3.5, sz: 14, rot: 0.6 },
      { x: 12, z: 26,  sx: 4.2, sz: 12, rot: 0.9 }
    ];
    lavaStreams.forEach((str, idx) => {
      // Each stream is a chain of narrow, slightly bending fissure segments
      const segments = 5;
      const segLen = str.sz / segments;
      let angle = str.rot;
      let cx = str.x - Math.sin(str.rot) * str.sz * 0.5;
      let cz = str.z - Math.cos(str.rot) * str.sz * 0.5;
      for (let i = 0; i < segments; i++) {
        angle += Math.sin(idx * 3.1 + i * 1.7) * 0.35;
        const width = str.sx * (0.12 + 0.08 * Math.abs(Math.sin(idx + i * 2.3)));
        const midX = cx + Math.sin(angle) * segLen * 0.5;
        const midZ = cz + Math.cos(angle) * segLen * 0.5;

        const coreGeom = new THREE.PlaneGeometry(width, segLen * 1.08);
        coreGeom.rotateX(-Math.PI / 2);
        const core = new THREE.Mesh(coreGeom, lavaMat);
        core.position.set(midX, -6.38, midZ);
        core.rotation.y = angle;
        eastGroup.add(core);

        const crustGeom = new THREE.PlaneGeometry(width * 3.2, segLen * 1.12);
        crustGeom.rotateX(-Math.PI / 2);
        const crust = new THREE.Mesh(crustGeom, lavaEdgeMat);
        crust.position.set(midX, -6.42, midZ);
        crust.rotation.y = angle;
        eastGroup.add(crust);

        cx += Math.sin(angle) * segLen;
        cz += Math.cos(angle) * segLen;
      }
    });

    // Hexagonal Basalt Columns (Giant's Causeway style)
    const columnMat = new THREE.MeshStandardMaterial({ color: 0x241d20, roughness: 0.85, metalness: 0.3 });
    const colClusters = [
      { cx: 34, cz: -26 }, { cx: 48, cz: 20 }, { cx: 22, cz: 30 }
    ];
    colClusters.forEach(cc => {
      for (let i = 0; i < 6; i++) {
        const h = 2.5 + (i % 4) * 0.9;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, h, 6), columnMat);
        const ang = (i / 6) * Math.PI * 2;
        col.position.set(cc.cx + Math.cos(ang) * 1.3, -6.5 + h * 0.5, cc.cz + Math.sin(ang) * 1.3);
        eastGroup.add(col);
      }
    });

    // Jagged Demonic Obsidian Spikes
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x181014, roughness: 0.4, metalness: 0.8 });
    const spikes = [
      { x: 32, z: -32, h: 4.5, rotZ: 0.3,  rotX: 0.2 },
      { x: 50, z: -15, h: 5.5, rotZ: -0.2, rotX: -0.3 },
      { x: 42, z: 28,  h: 5.0, rotZ: 0.25, rotX: 0.3 },
      { x: 26, z: 36,  h: 4.0, rotZ: -0.3, rotX: 0.2 },
      { x: 18, z: -14, h: 3.5, rotZ: 0.35, rotX: -0.2 }
    ];
    spikes.forEach(sp => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.45, sp.h, 4), spikeMat);
      spike.position.set(sp.x, -6.5 + sp.h * 0.45, sp.z);
      spike.rotation.z = sp.rotZ;
      spike.rotation.x = sp.rotX;
      eastGroup.add(spike);
    });

    eastGroup.position.y = -22;
    this.scene.add(eastGroup);
  }

  /**
   * 6. Central Chasm & Levitating Arcane Ley-Line Conduit Bridge
   */
  private buildCentralChasmAndLeyLines() {
    const chasmGroup = new THREE.Group();

    // Deep abyss floor beneath the chasm
    const abyssGeom = new THREE.PlaneGeometry(28, 90);
    abyssGeom.rotateX(-Math.PI / 2);
    const abyssMat = new THREE.MeshStandardMaterial({ color: 0x080b12, roughness: 0.99 });
    const abyss = new THREE.Mesh(abyssGeom, abyssMat);
    abyss.position.set(-5, -40.0, 0);
    chasmGroup.add(abyss);

    // Floating Arcane Ley-Line Conduit Bridge
    // Spanning from Maze Exit (-11, 0, 8) across the chasm to Arena Pad (1.8, 0, 0)
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.8
    });
    const runeDiscMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      roughness: 0.6
    });

    const conduitNodes = [
      { x: -8.8, y: 0.2, z: 10.5 },
      { x: -7.0, y: 0.5, z: 8.4 },
      { x: -5.2, y: 0.8, z: 6.3 },
      { x: -3.4, y: 0.7, z: 4.2 },
      { x: -1.6, y: 0.4, z: 2.1 },
      { x: 0.2,  y: 0.2, z: 0.4 }
    ];

    conduitNodes.forEach((node, idx) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(node.x, node.y, node.z);

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.12, 6), runeDiscMat);
      nodeGroup.add(disc);

      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), crystalMat);
      crystal.position.y = 0.4;
      nodeGroup.add(crystal);

      chasmGroup.add(nodeGroup);

      this.floatingLeyCrystals.push({
        mesh: nodeGroup,
        baseY: node.y,
        speed: 1.5 + idx * 0.2,
        phase: idx * 0.8
      });
    });

    const conduitLight = new THREE.PointLight(0x38bdf8, 0.8, 14);
    conduitLight.position.set(-4.5, 2, 5.5);
    chasmGroup.add(conduitLight);

    this.scene.add(chasmGroup);
  }

  /**
   * 7. A drifting sea of mist beneath the floating islands: cold violet in the west,
   * lit from below by the lava rivers in the east.
   */
  private buildMistSea() {
    const mistTex = createMistTexture();
    const layers = [
      { y: -4.5, opacity: 0.5, color: 0x544a78, repeat: 3.0, drift: new THREE.Vector2(0.004, 0.0015) },
      { y: -8.5, opacity: 0.7, color: 0x3a3360, repeat: 2.1, drift: new THREE.Vector2(-0.0025, 0.001) },
      { y: -14.0, opacity: 0.85, color: 0x241f3c, repeat: 1.5, drift: new THREE.Vector2(0.0015, -0.002) }
    ];
    for (const l of layers) {
      const tex = mistTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(l.repeat, l.repeat);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: l.color,
        transparent: true,
        opacity: l.opacity,
        depthWrite: false
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(320, 240), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(0, l.y, 0);
      plane.renderOrder = -1;
      this.scene.add(plane);
      this.mistLayers.push({ mat, drift: l.drift });
    }

    // Infernal underglow bleeding up through the mist on the east side
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 100),
      new THREE.MeshBasicMaterial({
        map: this.glowSprite,
        color: new THREE.Color().setRGB(0.9, 0.22, 0.05),
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(ARENA_CENTER_X + 16, -16, 0);
    this.scene.add(glow);

    // Cold moonlit haze under the western kingdom
    const cold = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 80),
      new THREE.MeshBasicMaterial({
        map: this.glowSprite,
        color: new THREE.Color().setRGB(0.18, 0.22, 0.45),
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    cold.rotation.x = -Math.PI / 2;
    cold.position.set(-30, -16, 0);
    this.scene.add(cold);
  }

  private buildLowPolyCloudCover() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x241f33,
      roughness: 1.0,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });

    const createCloudPuff = (scaleX: number, scaleZ: number) => {
      const cloud = new THREE.Group();
      const puffCount = 5;
      for (let i = 0; i < puffCount; i++) {
        const radius = 1.6 + Math.sin(i * 1.2) * 0.7;
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), cloudMat);
        puff.position.set(
          (i - 2) * 1.5 * scaleX * 0.5,
          Math.sin(i * 1.8) * 0.4,
          ((i % 2) - 0.5) * 1.4 * scaleZ * 0.5
        );
        cloud.add(puff);
      }
      return cloud;
    };

    const cloudLocations = [
      { x: -28, y: -3.2, z: -18, sx: 1.5, sz: 1.2 },
      { x: -16, y: -3.8, z: 8,   sx: 1.8, sz: 1.4 },
      { x: -6,  y: -4.2, z: -12, sx: 2.0, sz: 1.5 },
      { x: 5,   y: -3.6, z: 15,  sx: 1.6, sz: 1.3 },
      { x: 22,  y: -4.0, z: -20, sx: 1.7, sz: 1.3 },
      { x: -45, y: -3.5, z: 12,  sx: 2.2, sz: 1.6 },
      { x: 38,  y: -3.8, z: 8,   sx: 2.0, sz: 1.5 }
    ];

    cloudLocations.forEach(loc => {
      const c = createCloudPuff(loc.sx, loc.sz);
      c.position.set(loc.x, loc.y, loc.z);
      this.animatedClouds.push(c);
      this.scene.add(c);
    });
  }

  private addParticleField(
    parent: THREE.Object3D,
    kind: 'ember' | 'wisp',
    count: number,
    min: THREE.Vector3,
    max: THREE.Vector3,
    color: THREE.Color,
    size: number
  ) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = THREE.MathUtils.lerp(min.x, max.x, Math.random());
      positions[i * 3 + 1] = THREE.MathUtils.lerp(min.y, max.y, Math.random());
      positions[i * 3 + 2] = THREE.MathUtils.lerp(min.z, max.z, Math.random());
      velocities[i * 3] = (Math.random() - 0.5) * 0.3;
      velocities[i * 3 + 1] = kind === 'ember' ? 0.35 + Math.random() * 0.8 : (Math.random() - 0.5) * 0.15;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this.glowSprite,
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    parent.add(points);
    this.particleFields.push({ points, velocities, phases, min, max, kind });
  }

  /** Embers drifting up from the scorched arena. */
  private buildArenaEmbers() {
    this.addParticleField(
      this.scene,
      'ember',
      220,
      new THREE.Vector3(-1, 0.2, -9.5),
      new THREE.Vector3(ARENA_WIDTH + 1, 9, 9.5),
      new THREE.Color().setRGB(2.4, 0.9, 0.3),
      0.22
    );
  }

  /** Pale spirit wisps hovering over a maze island (Sun coordinates; the Moon side is mirrored). */
  private buildMazeWisps(parent: THREE.Object3D) {
    this.addParticleField(
      parent,
      'wisp',
      70,
      new THREE.Vector3(-33, 0.6, -15),
      new THREE.Vector3(-11, 4.5, 15),
      new THREE.Color().setRGB(0.55, 1.5, 1.2),
      0.3
    );
  }

  private updateParticles(dt: number, timeSec: number) {
    for (const field of this.particleFields) {
      const attr = field.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const pos = attr.array as Float32Array;
      const v = field.velocities;
      const count = field.phases.length;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const sway = Math.sin(timeSec * 0.8 + field.phases[i]);
        pos[ix] += (v[ix] + sway * 0.12) * dt;
        pos[ix + 1] += (field.kind === 'ember' ? v[ix + 1] : v[ix + 1] + Math.cos(timeSec + field.phases[i]) * 0.1) * dt;
        pos[ix + 2] += (v[ix + 2] + Math.cos(timeSec * 0.6 + field.phases[i]) * 0.12) * dt;

        // Recycle particles that drift out of their volume
        if (field.kind === 'ember' && pos[ix + 1] > field.max.y) {
          pos[ix] = THREE.MathUtils.lerp(field.min.x, field.max.x, Math.random());
          pos[ix + 1] = field.min.y;
          pos[ix + 2] = THREE.MathUtils.lerp(field.min.z, field.max.z, Math.random());
        }
        for (let a = 0; a < 3; a++) {
          const lo = a === 0 ? field.min.x : a === 1 ? field.min.y : field.min.z;
          const hi = a === 0 ? field.max.x : a === 1 ? field.max.y : field.max.z;
          if (pos[ix + a] < lo) pos[ix + a] = hi;
          else if (pos[ix + a] > hi) pos[ix + a] = lo;
        }
      }
      attr.needsUpdate = true;

      // Wisps breathe in and out
      if (field.kind === 'wisp') {
        (field.points.material as THREE.PointsMaterial).opacity = 0.65 + Math.sin(timeSec * 1.3) * 0.25;
      }
    }
  }

  /**
   * Per-frame animation for dynamic world environment elements
   */
  public update(dt: number, now: number) {
    // 1. Vortex rotations
    for (const v of this.portalVortices) v.rotation.z += dt * 1.8;
    for (const v of this.arrivalVortices) v.rotation.z -= dt * 1.8;

    // 2. Ley-line crystal levitation & slow spin
    const timeSec = now * 0.001;
    for (let i = 0; i < this.floatingLeyCrystals.length; i++) {
      const item = this.floatingLeyCrystals[i];
      item.mesh.position.y = item.baseY + Math.sin(timeSec * item.speed + item.phase) * 0.12;
      item.mesh.rotation.y += dt * 0.8;
    }

    // 3. Gentle cloud drift across the canyon
    for (let i = 0; i < this.animatedClouds.length; i++) {
      const cloud = this.animatedClouds[i];
      cloud.position.x += dt * 0.35;
      if (cloud.position.x > 65) {
        cloud.position.x = -65;
      }
    }

    this.updateParticles(dt, timeSec);

    for (const layer of this.mistLayers) {
      layer.mat.map!.offset.x += layer.drift.x * dt;
      layer.mat.map!.offset.y += layer.drift.y * dt;
    }
    for (const s of this.spinners) {
      s.rotation.y += dt * 0.6;
      s.position.y += Math.sin(timeSec * 1.3) * 0.004;
    }

    // 4. Pulsating magma breathing glow
    const lavaPulse = 0.85 + Math.sin(timeSec * 2.5) * 0.15;
    for (let i = 0; i < this.lavaMaterials.length; i++) {
      this.lavaMaterials[i].color.setRGB(2.0 * lavaPulse, 0.46 * lavaPulse, 0.06 * lavaPulse);
    }
  }

  handleResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.postFX?.setSize(w, h, this.renderer.getPixelRatio());
  }

  /** Renders a frame through the post-processing chain (bloom + colour grade). */
  render(camera: THREE.Camera, now: number) {
    if (!this.postFX) {
      this.postFX = new PostFX(this.renderer, this.scene, camera, this.container.clientWidth, this.container.clientHeight);
    }
    this.postFX.render(now);
  }
}
