import * as THREE from 'three';
import { Grid } from '../grid/Grid';

export class SceneRenderer {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public container: HTMLElement;

  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public hemiLight: THREE.HemisphereLight;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Deep slate midnight
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

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
    this.renderer.toneMappingExposure = 1.1;

    container.appendChild(this.renderer.domElement);

    // 3. Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 0.4);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    this.sunLight.position.set(-15, 30, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -30;
    this.sunLight.shadow.camera.right = 30;
    this.sunLight.shadow.camera.top = 25;
    this.sunLight.shadow.camera.bottom = -25;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // 4. Ground Environment (Player Maze + Arena + Enemy Citadel)
    this.buildWorldEnvironment();
  }

  private buildWorldEnvironment() {
    // Large Ground Plane
    const groundGeom = new THREE.PlaneGeometry(100, 70);
    groundGeom.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Player Maze Base Platform (Left)
    const mazePlatformGeom = new THREE.BoxGeometry(22, 0.2, 22);
    const mazePlatformMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2
    });
    const mazePlatform = new THREE.Mesh(mazePlatformGeom, mazePlatformMat);
    mazePlatform.position.set(-14, 0, 0);
    mazePlatform.receiveShadow = true;
    this.scene.add(mazePlatform);

    // Maze Grid Border Trim
    const trimGeom = new THREE.BoxGeometry(22.4, 0.4, 0.4);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const trimN = new THREE.Mesh(trimGeom, trimMat);
    trimN.position.set(-14, 0.1, -11.2);
    this.scene.add(trimN);
    const trimS = trimN.clone();
    trimS.position.z = 11.2;
    this.scene.add(trimS);

    // Central Arena Platform (Middle/Right)
    const arenaGeom = new THREE.BoxGeometry(28, 0.15, 18);
    const arenaMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917, // Dark scorched stone / battle dust
      roughness: 0.85,
      metalness: 0.15
    });
    const arenaPlatform = new THREE.Mesh(arenaGeom, arenaMat);
    arenaPlatform.position.set(12, 0, 0);
    arenaPlatform.receiveShadow = true;
    this.scene.add(arenaPlatform);

    // Bridge / Portal connecting Maze Exit to Arena
    const bridgeGeom = new THREE.BoxGeometry(6, 0.18, 4);
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3,
      roughness: 0.4
    });
    const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
    bridge.position.set(-2, 0.02, 0);
    this.scene.add(bridge);

    // Portal Archway at Maze Exit
    const portalArch = new THREE.TorusGeometry(2, 0.25, 8, 24, Math.PI);
    const portalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7
    });
    const portal = new THREE.Mesh(portalArch, portalMat);
    portal.position.set(-3.2, 0, 0);
    portal.rotation.y = Math.PI / 2;
    this.scene.add(portal);

    // Player Castle Fortress (Far Left)
    this.buildPlayerCastle(new THREE.Vector3(-25, 0, 0));

    // Enemy Citadel Fortress (Far Right)
    this.buildEnemyCitadel(new THREE.Vector3(26, 0, 0));
  }

  private buildPlayerCastle(pos: THREE.Vector3) {
    const castleGroup = new THREE.Group();
    castleGroup.position.copy(pos);

    // Main Keep
    const keepGeom = new THREE.BoxGeometry(4, 5, 6);
    const keepMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 });
    const keep = new THREE.Mesh(keepGeom, keepMat);
    keep.position.y = 2.5;
    keep.castShadow = true;
    castleGroup.add(keep);

    // Castle Towers
    [-2.5, 2.5].forEach(z => {
      const towerGeom = new THREE.CylinderGeometry(0.9, 1.1, 7, 8);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8 });
      const tower = new THREE.Mesh(towerGeom, towerMat);
      tower.position.set(0, 3.5, z);
      tower.castShadow = true;
      castleGroup.add(tower);

      const roofGeom = new THREE.ConeGeometry(1.2, 2, 8);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa });
      const roof = new THREE.Mesh(roofGeom, roofMat);
      roof.position.set(0, 7.8, z);
      castleGroup.add(roof);
    });

    this.scene.add(castleGroup);
  }

  private buildEnemyCitadel(pos: THREE.Vector3) {
    const citadelGroup = new THREE.Group();
    citadelGroup.position.copy(pos);

    // Dark Spire
    const spireGeom = new THREE.ConeGeometry(3, 8, 6);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0x881337,
      emissive: 0x4c0519,
      roughness: 0.5
    });
    const spire = new THREE.Mesh(spireGeom, spireMat);
    spire.position.y = 4;
    spire.castShadow = true;
    citadelGroup.add(spire);

    // Glowing Lava Eye / Core
    const eyeGeom = new THREE.OctahedronGeometry(1.2);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9
    });
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.position.set(-1.2, 4.5, 0);
    citadelGroup.add(eye);

    this.scene.add(citadelGroup);
  }

  handleResize() {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
}
