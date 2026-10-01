import * as THREE from 'three';
import type { MapThemeId } from './MapThemes';
import { createGroundTexture, createMistTexture, createSoftEdgeMask } from './ProceduralTextures';
import { CORE, DecorPlacer, MOON_ZONES, SUN_ZONES, createMaterials, fbm, groundHeight, inZones, outsideDistance, seededRandom, smoothstep, xf } from './scenery/Terrain';
import { SCENERY, Scenery } from './scenery/Themes';

/**
 * The solid ground the battlefield stands on: one continuous surface that stays perfectly flat
 * around the maze islands and the arena and only rolls into low hills far out. Each mission's map
 * theme dresses it differently — its own ground texture, grass, treeline, landmarks and mist
 * (see scenery/Themes.ts).
 */

export interface WorldGround {
  themeId: MapThemeId;
  root: THREE.Group;
  /** Decor standing where the PvP Moon maze island goes; hidden while PvP is active. */
  moonFieldDecor: THREE.Group;
  /** Molten fissures that pulse with the renderer's lava animation. */
  lavaMaterials: THREE.MeshBasicMaterial[];
  mistLayers: { mat: THREE.MeshBasicMaterial; drift: THREE.Vector2 }[];
}

const GROUND_WIDTH = 460;
const GROUND_DEPTH = 360;

// Canvas textures are kept across rebuilds; everything else belongs to one scenery and is disposed with it
const groundTextures = new Map<MapThemeId, THREE.CanvasTexture>();
let mistTexture: THREE.CanvasTexture | null = null;
let mistMask: THREE.CanvasTexture | null = null;
const keptTextures = new Set<THREE.Texture>();

function keep<T extends THREE.Texture>(tex: T): T {
  keptTextures.add(tex);
  return tex;
}

/** One ground tile spans 10 world units, on the open field and on the maze floor alike. */
function groundTexture(themeId: MapThemeId): THREE.CanvasTexture {
  let texture = groundTextures.get(themeId);
  if (!texture) {
    texture = keep(createGroundTexture(SCENERY[themeId].texture, GROUND_WIDTH / 10, GROUND_DEPTH / 10));
    groundTextures.set(themeId, texture);
  }
  return texture;
}

const mazeFloorTextures = new Map<MapThemeId, THREE.Texture>();

/**
 * The maze island floor for a theme: its ground texture (scaled to the 24 x 32 island) and a tint,
 * or null for themes that keep the classic moss.
 */
export function mazeFloor(themeId: MapThemeId): { map: THREE.Texture; tint: number } | null {
  const spec = SCENERY[themeId].mazeFloor;
  if (!spec) return null;
  let map = mazeFloorTextures.get(themeId);
  if (!map) {
    map = keep(groundTexture(themeId).clone());
    map.repeat.set(2.4, 3.2);
    map.needsUpdate = true;
    mazeFloorTextures.set(themeId, map);
  }
  return { map, tint: spec.tint };
}

export function buildWorldGround(themeId: MapThemeId): WorldGround {
  const scenery = SCENERY[themeId];
  const root = new THREE.Group();
  const moonFieldDecor = new THREE.Group();
  root.add(moonFieldDecor);

  buildGroundPlane(root, scenery, groundTexture(themeId));
  buildGrassTufts(root, moonFieldDecor, scenery);
  buildTreeline(root, scenery);

  const mats = createMaterials();
  const lava = new THREE.MeshBasicMaterial({ color: 0xff4500 });
  const placer = new DecorPlacer();
  scenery.decorate(placer, mats, lava, seededRandom(909));
  placer.main.build(root);
  placer.moon.build(moonFieldDecor);

  const mistLayers: WorldGround['mistLayers'] = [];
  buildGroundMist(root, scenery, mistLayers);

  return { themeId, root, moonFieldDecor, lavaMaterials: [lava], mistLayers };
}

/** Frees the GPU resources of a scenery that has been taken out of the scene. */
export function disposeWorldGround(ground: WorldGround) {
  const materials = new Set<THREE.Material>();
  ground.root.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => materials.add(m));
    }
  });
  materials.forEach(m => {
    const textured = m as THREE.MeshBasicMaterial;
    [textured.map, textured.alphaMap].forEach(t => {
      if (t && !keptTextures.has(t)) t.dispose();
    });
    m.dispose();
  });
}

/** The one continuous ground surface (sits just under the 0.1-high island tops). */
function buildGroundPlane(root: THREE.Group, scenery: Scenery, texture: THREE.Texture) {
  const geom = new THREE.PlaneGeometry(GROUND_WIDTH, GROUND_DEPTH, 115, 90);
  geom.rotateX(-Math.PI / 2);
  geom.translate(18, 0, -20);

  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const patch = new THREE.Color(...scenery.patch.color);
  const east = new THREE.Color(...scenery.east.color);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));

    // Darker and lighter areas break up the texture's tiling
    const shade = 0.72 + fbm(x * 0.07, z * 0.07) * 0.5;
    c.setRGB(shade, shade, shade);
    // Large secondary patches: withered straw, snowfields, red earth…
    c.lerp(patch, smoothstep(0.55, 0.75, fbm(x * 0.045 + 40, z * 0.045 - 12)) * scenery.patch.amount);
    // Blight spreading out from the infernal east
    c.lerp(east, smoothstep(40, 95, x) * scenery.east.amount);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: scenery.groundTint, map: texture, vertexColors: true, roughness: 0.97, metalness: 0 });
  const ground = new THREE.Mesh(geom, mat);
  ground.receiveShadow = true;
  root.add(ground);
}

/** A tuft of a few leaning blades; normals point up so it lights like the ground beneath it. */
function createTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const blades = 6;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + (i % 2) * 0.5;
    const h = 0.24 + ((i * 7) % 5) * 0.045;
    const w = 0.045;
    const lean = 0.1 + (i % 3) * 0.06;
    const bx = Math.cos(a) * 0.05;
    const bz = Math.sin(a) * 0.05;
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    positions.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean);
    colors.push(0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 1, 1, 1);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(positions.length / 3).fill([0, 1, 0]).flat(), 3));
  return geom;
}

type Instance = { m: THREE.Matrix4; c: THREE.Color };

function buildGrassTufts(root: THREE.Group, moonGroup: THREE.Group, scenery: Scenery) {
  const { palette, density, height } = scenery.tufts;
  const rand = seededRandom(101);
  const colors = palette.map(h => new THREE.Color(h));
  const blight = new THREE.Color(0x4a4238);
  const sun: Instance[] = [];
  const moon: Instance[] = [];

  for (let i = 0; i < 30000; i++) {
    const x = -105 + rand() * 250;
    const z = -85 + rand() * 140;
    const d = outsideDistance(CORE, x, z);
    const falloff = d < 22 ? 1 : Math.max(0.1, 1 - (d - 22) * 0.025);
    const clump = 0.25 + fbm(x * 0.18, z * 0.18) * 1.2;
    if (rand() > falloff * clump * 0.85 * density) continue;
    if (inZones(SUN_ZONES, x, z, 0.35)) continue;
    const target = inZones(MOON_ZONES, x, z, 0.35) ? moon : sun;

    const s = 0.7 + rand() * 0.9;
    const m = xf(x, groundHeight(x, z), z, 0, rand() * Math.PI * 2, 0, s, s * (0.7 + rand() * 0.7) * height, s);
    const c = colors[Math.floor(rand() * colors.length)].clone().lerp(blight, smoothstep(40, 95, x) * 0.8);
    target.push({ m, c });
  }

  const geom = createTuftGeometry();
  const mat = new THREE.MeshStandardMaterial({ color: scenery.groundTint, vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  const make = (list: Instance[], parent: THREE.Object3D) => {
    if (list.length === 0) return;
    const mesh = new THREE.InstancedMesh(list === sun ? geom : geom.clone(), mat, list.length);
    list.forEach((t, i) => {
      mesh.setMatrixAt(i, t.m);
      mesh.setColorAt(i, t.c);
    });
    mesh.receiveShadow = true;
    parent.add(mesh);
  };
  make(sun, root);
  make(moon, moonGroup);
}

/** The theme's silhouettes closing in around the battlefield, thick enough to read as a solid horizon. */
function buildTreeline(root: THREE.Group, scenery: Scenery) {
  const species = scenery.treeline.species();
  const totalWeight = species.reduce((sum, s) => sum + s.weight, 0);
  const instances: Instance[][] = species.map(() => []);
  const palettes = species.map(s => s.palette.map(h => new THREE.Color(h)));
  const rand = seededRandom(303);

  for (let i = 0; i < 7000; i++) {
    const x = -160 + rand() * 360;
    const z = -150 + rand() * 230;
    const d = outsideDistance(CORE, x, z);
    const edge = smoothstep(22, 42, d) * (0.15 + fbm(x * 0.06 + 7, z * 0.06 - 3) * 1.1);
    if (rand() > edge * 0.5 * scenery.treeline.density) continue;

    let pick = rand() * totalWeight;
    let k = 0;
    while (k < species.length - 1 && pick > species[k].weight) pick -= species[k++].weight;
    const sp = species[k];
    const s = sp.scale[0] + rand() * (sp.scale[1] - sp.scale[0]);
    const stretch = sp.stretch ? sp.stretch[0] + rand() * (sp.stretch[1] - sp.stretch[0]) : 0.85 + rand() * 0.4;
    const y = groundHeight(x, z) - 0.2 + (sp.lift ? sp.lift(rand) : 0);
    instances[k].push({
      m: xf(x, y, z, (rand() - 0.5) * 0.08, rand() * Math.PI * 2, (rand() - 0.5) * 0.08, s, s * stretch, s),
      c: palettes[k][Math.floor(rand() * palettes[k].length)]
    });
  }

  species.forEach((sp, k) => {
    const list = instances[k];
    sp.layers.forEach(layer => {
      if (list.length === 0) {
        layer.geom.dispose();
        layer.mat.dispose();
        return;
      }
      const mesh = new THREE.InstancedMesh(layer.geom, layer.mat, list.length);
      list.forEach((t, i) => {
        mesh.setMatrixAt(i, t.m);
        mesh.setColorAt(i, t.c);
      });
      root.add(mesh);
    });
  });
}

/** Low banks of mist pooling over the open ground around (never over) the battlefield. */
function buildGroundMist(root: THREE.Group, scenery: Scenery, mistLayers: WorldGround['mistLayers']) {
  mistTexture ??= keep(createMistTexture());
  mistMask ??= keep(createSoftEdgeMask());
  const banks = [
    { x: -30, z: -36, w: 70, d: 26, opacity: 0.32 },
    { x: 12, z: -30, w: 46, d: 22, opacity: 0.29 },
    { x: 50, z: -36, w: 70, d: 26, opacity: 0.27 },
    { x: -64, z: 0, w: 30, d: 70, opacity: 0.32 },
    { x: 100, z: 0, w: 30, d: 70, opacity: 0.27 },
    { x: -26, z: 28, w: 70, d: 20, opacity: 0.26 },
    { x: 30, z: 24, w: 60, d: 16, opacity: 0.24 },
    { x: 80, z: 30, w: 60, d: 22, opacity: 0.24 }
  ];
  banks.forEach((bank, i) => {
    const tex = mistTexture!.clone();
    tex.needsUpdate = true;
    tex.repeat.set(bank.w / 40, bank.d / 40);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      alphaMap: mistMask,
      color: bank.x >= 45 ? scenery.mist.east : scenery.mist.near,
      transparent: true,
      opacity: bank.opacity * scenery.mist.opacity,
      depthWrite: false
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(bank.w, bank.d), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(bank.x, groundHeight(bank.x, bank.z) + 0.6 + (i % 3) * 0.25, bank.z);
    root.add(plane);
    mistLayers.push({ mat, drift: new THREE.Vector2(i % 2 ? 0.006 : -0.005, 0.002 * ((i % 3) - 1)) });
  });
}
