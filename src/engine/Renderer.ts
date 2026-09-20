import * as THREE from 'three';
import { Grid, TileType } from '../grid/Grid';

export class SceneRenderer {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public container: HTMLElement;

  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public hemiLight: THREE.HemisphereLight;

  // Animated elements
  public portalVortex: THREE.Mesh | null = null;
  public arrivalVortex: THREE.Mesh | null = null;
  private roadGroup: THREE.Group = new THREE.Group();

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d16); // Cosmic midnight
    this.scene.fog = new THREE.FogExp2(0x090d16, 0.012);

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
    this.renderer.toneMappingExposure = 1.15;

    container.appendChild(this.renderer.domElement);

    // 3. Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.45);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    this.sunLight.position.set(-15, 35, 25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.camera.left = -40;
    this.sunLight.shadow.camera.right = 40;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // 4. Ground Environment (Maze Island + Void + Arena Island)
    this.buildWorldEnvironment();
  }

  private buildWorldEnvironment() {
    // Large Distant Ground / Cloud Bed
    const deepPlaneGeom = new THREE.PlaneGeometry(160, 120);
    deepPlaneGeom.rotateX(-Math.PI / 2);
    const deepPlaneMat = new THREE.MeshStandardMaterial({
      color: 0x050811,
      roughness: 0.95
    });
    const deepPlane = new THREE.Mesh(deepPlaneGeom, deepPlaneMat);
    deepPlane.position.y = -2.5;
    this.scene.add(deepPlane);

    // ==========================================
    // 1. MAZE ISLAND (Left Plateau: X = -22, Z = 0)
    // ==========================================
    const mazeIslandGeom = new THREE.BoxGeometry(24, 0.5, 24);
    const mazeIslandMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark tactical stone
      roughness: 0.75,
      metalness: 0.2
    });
    const mazeIsland = new THREE.Mesh(mazeIslandGeom, mazeIslandMat);
    mazeIsland.position.set(-22, -0.15, 0);
    mazeIsland.receiveShadow = true;
    this.scene.add(mazeIsland);

    // Stone border trim for Maze Island
    const trimGeomX = new THREE.BoxGeometry(24.4, 0.6, 0.4);
    const trimGeomZ = new THREE.BoxGeometry(0.4, 0.6, 24.4);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

    const trimN = new THREE.Mesh(trimGeomX, trimMat);
    trimN.position.set(-22, 0.1, -12.1);
    this.scene.add(trimN);
    const trimS = trimN.clone();
    trimS.position.z = 12.1;
    this.scene.add(trimS);

    const trimW = new THREE.Mesh(trimGeomZ, trimMat);
    trimW.position.set(-34.1, 0.1, 0);
    this.scene.add(trimW);
    const trimE = trimW.clone();
    trimE.position.x = -9.9;
    this.scene.add(trimE);

    this.scene.add(this.roadGroup);

    // Player Castle (Start of Maze: X = -33, Z = -8)
    this.buildPlayerCastle(new THREE.Vector3(-34, 0, -8));

    // Teleportation Gate (End of Maze: X = -11, Z = 8)
    this.buildTeleportationGate(new THREE.Vector3(-11, 0, 8));

    // ==========================================
    // 2. GRAND ARENA ISLAND (Right: X = 14, Z = 0)
    // ==========================================
    const arenaIslandGeom = new THREE.BoxGeometry(28, 0.5, 20);
    const arenaIslandMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917, // Scorched colosseum dirt & stone
      roughness: 0.85,
      metalness: 0.15
    });
    const arenaIsland = new THREE.Mesh(arenaIslandGeom, arenaIslandMat);
    arenaIsland.position.set(14, -0.15, 0);
    arenaIsland.receiveShadow = true;
    this.scene.add(arenaIsland);

    // Arena Gold & Marble border trim
    const arenaTrimMat = new THREE.MeshStandardMaterial({
      color: 0x44403c,
      roughness: 0.7
    });
    const aTrimN = new THREE.Mesh(new THREE.BoxGeometry(28.4, 0.6, 0.4), arenaTrimMat);
    aTrimN.position.set(14, 0.1, -10.1);
    this.scene.add(aTrimN);
    const aTrimS = aTrimN.clone();
    aTrimS.position.z = 10.1;
    this.scene.add(aTrimS);

    const aTrimW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 20.4), arenaTrimMat);
    aTrimW.position.set(-0.1, 0.1, 0);
    this.scene.add(aTrimW);
    const aTrimE = aTrimW.clone();
    aTrimE.position.x = 28.1;
    this.scene.add(aTrimE);

    // Friendly Arrival Teleport Pad in Arena (X = 2, Z = 0)
    this.buildArrivalTeleportPad(new THREE.Vector3(2, 0, 0));

    // Center Arena Clash Markings & Ring (X = 13, Z = 0)
    const clashRingGeom = new THREE.RingGeometry(4.5, 4.8, 32);
    clashRingGeom.rotateX(-Math.PI / 2);
    const clashRingMat = new THREE.MeshBasicMaterial({
      color: 0xea580c,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const clashRing = new THREE.Mesh(clashRingGeom, clashRingMat);
    clashRing.position.set(13, 0.12, 0);
    this.scene.add(clashRing);

    // Arena Perimeter Torch Braziers
    [
      { x: 3, z: -9 }, { x: 13, z: -9 }, { x: 23, z: -9 },
      { x: 3, z: 9 },  { x: 13, z: 9 },  { x: 23, z: 9 }
    ].forEach(pos => {
      this.buildTorchBrazier(new THREE.Vector3(pos.x, 0, pos.z));
    });

    // Enemy Citadel Fortress (Far Right: X = 27, Z = 0)
    this.buildEnemyCitadel(new THREE.Vector3(27, 0, 0));
  }

  /**
   * Builds distinct, high-contrast cobblestone road paving across all road tiles
   */
  buildRoadVisuals(grid: Grid) {
    // Clear old road meshes
    while (this.roadGroup.children.length > 0) {
      const child = this.roadGroup.children[0];
      this.roadGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Cobblestone slate
      roughness: 0.85,
      metalness: 0.1
    });

    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Glowing cyan curb line
      emissive: 0x0284c7,
      emissiveIntensity: 0.4
    });

    const tileW = grid.tileSize * 0.94;

    for (const coord of grid.roadCoords) {
      const world = grid.gridToWorld(coord.x, coord.z);

      // Main Road Slab
      const slabGeom = new THREE.BoxGeometry(tileW, 0.08, tileW);
      const slab = new THREE.Mesh(slabGeom, roadMat);
      slab.position.set(world.x, 0.05, world.z);
      slab.receiveShadow = true;
      this.roadGroup.add(slab);

      // Glowing runic center dot
      const dotGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.09, 6);
      const dot = new THREE.Mesh(dotGeom, curbMat);
      dot.position.set(world.x, 0.06, world.z);
      this.roadGroup.add(dot);
    }
  }

  private buildPlayerCastle(pos: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Keep Body
    const keepGeom = new THREE.BoxGeometry(3.5, 4.5, 5);
    const keepMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });
    const keep = new THREE.Mesh(keepGeom, keepMat);
    keep.position.y = 2.25;
    keep.castShadow = true;
    group.add(keep);

    // Castle Towers
    [-2.2, 2.2].forEach(z => {
      const towerGeom = new THREE.CylinderGeometry(0.8, 1.0, 6.5, 8);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8 });
      const tower = new THREE.Mesh(towerGeom, towerMat);
      tower.position.set(0, 3.25, z);
      tower.castShadow = true;
      group.add(tower);

      const roofGeom = new THREE.ConeGeometry(1.1, 1.8, 8);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa });
      const roof = new THREE.Mesh(roofGeom, roofMat);
      roof.position.set(0, 7.2, z);
      group.add(roof);
    });

    this.scene.add(group);
  }

  private buildTeleportationGate(pos: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Grand Portal Archway
    const archGeom = new THREE.TorusGeometry(1.6, 0.22, 8, 24, Math.PI);
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.8
    });
    const arch = new THREE.Mesh(archGeom, archMat);
    arch.position.y = 1.6;
    arch.rotation.y = -Math.PI / 2;
    group.add(arch);

    // Swirling Portal Core
    const vortexGeom = new THREE.CircleGeometry(1.4, 24);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    this.portalVortex = new THREE.Mesh(vortexGeom, vortexMat);
    this.portalVortex.position.y = 1.6;
    this.portalVortex.rotation.y = -Math.PI / 2;
    group.add(this.portalVortex);

    this.scene.add(group);
  }

  private buildArrivalTeleportPad(pos: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Glowing Arrival Rune Ring
    const padGeom = new THREE.CylinderGeometry(1.8, 2.0, 0.1, 24);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.6
    });
    const pad = new THREE.Mesh(padGeom, padMat);
    pad.position.y = 0.05;
    group.add(pad);

    const ringGeom = new THREE.RingGeometry(1.2, 1.6, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    this.arrivalVortex = new THREE.Mesh(ringGeom, ringMat);
    this.arrivalVortex.position.y = 0.12;
    group.add(this.arrivalVortex);

    this.scene.add(group);
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
    const fireGeom = new THREE.DodecahedronGeometry(0.25);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const fire = new THREE.Mesh(fireGeom, fireMat);
    fire.position.y = 1.55;
    group.add(fire);

    this.scene.add(group);
  }

  private buildEnemyCitadel(pos: THREE.Vector3) {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Dark Spire Fortress
    const spireGeom = new THREE.ConeGeometry(3.5, 9, 6);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0x4c0519,
      emissive: 0x881337,
      emissiveIntensity: 0.3,
      roughness: 0.5
    });
    const spire = new THREE.Mesh(spireGeom, spireMat);
    spire.position.y = 4.5;
    spire.castShadow = true;
    group.add(spire);

    // Crimson Demonic Eye
    const eyeGeom = new THREE.OctahedronGeometry(1.2);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.95
    });
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(-1.4, 5.0, 0);
    group.add(eye);

    this.scene.add(group);
  }

  handleResize() {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
}
