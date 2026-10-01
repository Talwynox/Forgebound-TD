import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mirrorX } from '../../game/Teams';

/**
 * Shared groundwork for the world scenery: where gameplay lives (so decor keeps clear of it),
 * the ground's height field, seeded noise, and static batching of props into a few draw calls.
 */

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------

type Zone =
  | { kind: 'rect'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; r: number };

const rect = (minX: number, maxX: number, minZ: number, maxZ: number): Zone => ({ kind: 'rect', minX, maxX, minZ, maxZ });
const circle = (x: number, z: number, r: number): Zone => ({ kind: 'circle', x, z, r });

/** Sun maze island, barracks castle, teleport gate, arena and the enemy citadel. */
export const SUN_ZONES: Zone[] = [
  rect(-34.2, -9.8, -16.2, 16.2),
  circle(-34, -12, 6.5),
  circle(-10, 12, 4),
  rect(-0.6, 44.5, -10.6, 10.6)
];

/** The PvP Moon maze island, castle and gate (mirror of the Sun side). */
export const MOON_ZONES: Zone[] = [
  rect(mirrorX(-9.8), mirrorX(-34.2), -16.2, 16.2),
  circle(mirrorX(-34), -12, 6.5),
  circle(mirrorX(-10), 12, 4)
];

export function inZones(zones: Zone[], x: number, z: number, margin: number): boolean {
  for (const zone of zones) {
    if (zone.kind === 'rect') {
      if (x > zone.minX - margin && x < zone.maxX + margin && z > zone.minZ - margin && z < zone.maxZ + margin) return true;
    } else if (Math.hypot(x - zone.x, z - zone.z) < zone.r + margin) {
      return true;
    }
  }
  return false;
}

/** Distance from the ley-line conduit that links the maze gate to the arena pad. */
function conduitDistance(x: number, z: number): number {
  const ax = -9.5, az = 11.2, bx = 1, bz = 0;
  const abx = bx - ax, abz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(x - (ax + abx * t), z - (az + abz * t));
}

export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }

/** The whole battlefield (both sides) — the ground stays dead flat here. */
const FLAT: Bounds = { minX: -54, maxX: 90, minZ: -28, maxZ: 26 };
/** Where the action is; detail density falls off with distance from it. */
export const CORE: Bounds = { minX: -36, maxX: 72, minZ: -18, maxZ: 18 };

export function outsideDistance(r: Bounds, x: number, z: number): number {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

// ------------------------------------------------------------------
// Noise
// ------------------------------------------------------------------

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise in [0, 1]. */
export function fbm(x: number, z: number): number {
  return (valueNoise(x, z) * 0.57 + valueNoise(x * 2.1 + 17, z * 2.1 + 9) * 0.29 + valueNoise(x * 4.3 + 41, z * 4.3 + 23) * 0.14);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Ground height: 0 across the battlefield, gently rolling hills far beyond it. */
export function groundHeight(x: number, z: number): number {
  const d = outsideDistance(FLAT, x, z);
  if (d <= 0) return 0;
  return smoothstep(0, 38, d) * (0.25 + fbm(x * 0.028, z * 0.028)) * 6.5;
}

export type Rand = () => number;

export function seededRandom(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------------
// Transforms & static batching: hundreds of small props become a handful of draw calls
// ------------------------------------------------------------------

const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

export function xf(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQuat, new THREE.Vector3(sx, sy, sz));
}

/** `local` expressed in `base`'s frame. */
export function at(base: THREE.Matrix4, local: THREE.Matrix4): THREE.Matrix4 {
  return base.clone().multiply(local);
}

export class StaticBatch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(geom: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    g.applyMatrix4(matrix);
    let list = this.parts.get(mat);
    if (!list) this.parts.set(mat, (list = []));
    list.push(g);
  }

  /** A unit-height geometry (centred on its Y axis) stretched between two points in `base`'s frame. */
  strut(geom: THREE.BufferGeometry, mat: THREE.Material, base: THREE.Matrix4, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    const m = new THREE.Matrix4().compose(from.clone().lerp(to, 0.5), q, new THREE.Vector3(radius, len, radius));
    this.add(geom, mat, at(base, m));
  }

  build(parent: THREE.Object3D) {
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list);
      list.forEach(g => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
}

/** Routes each prop to the always-visible batch, the Moon-field batch, or nowhere if it would sit on gameplay. */
export class DecorPlacer {
  readonly main = new StaticBatch();
  readonly moon = new StaticBatch();

  /** Returns the batch for a prop at (x, z) with the given clearance, or null if it must be skipped. */
  at(x: number, z: number, clearance: number): StaticBatch | null {
    if (inZones(SUN_ZONES, x, z, clearance)) return null;
    if (conduitDistance(x, z) < clearance + 1) return null;
    return inZones(MOON_ZONES, x, z, clearance) ? this.moon : this.main;
  }

  /**
   * Seeded scatter of `count` props within `maxDist` of the battlefield core (and optionally inside `region`).
   */
  scatter(rand: Rand, count: number, clearance: number, maxDist: number, place: (b: StaticBatch, x: number, z: number) => void,
    region: Bounds = { minX: -70, maxX: 105, minZ: -48, maxZ: 32 }) {
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 40; tries++) {
      const x = region.minX + rand() * (region.maxX - region.minX);
      const z = region.minZ + rand() * (region.maxZ - region.minZ);
      if (outsideDistance(CORE, x, z) > maxDist) continue;
      if (x > -10 && x < 0 && Math.abs(z) < 18) continue; // keep the maze-to-arena crossing clear
      const b = this.at(x, z, clearance);
      if (!b) continue;
      place(b, x, z);
      placed++;
    }
  }
}

// ------------------------------------------------------------------
// Shared unit geometry (only ever cloned into batches, never added to the scene)
// ------------------------------------------------------------------

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cylTaper: new THREE.CylinderGeometry(0.35, 0.5, 1, 6),
  branch: new THREE.CylinderGeometry(0.25, 0.5, 1, 4),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  cone5: new THREE.ConeGeometry(0.5, 1, 5),
  /** Triangular cross-section (apex at local +Z) for gable roofs. */
  prism: new THREE.CylinderGeometry(0.5, 0.5, 1, 3),
  rock: new THREE.DodecahedronGeometry(0.5, 0),
  rockLumpy: new THREE.IcosahedronGeometry(0.5, 0),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  sphere: new THREE.SphereGeometry(0.5, 8, 6),
  halfDome: new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  slabTop: new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false, 0, Math.PI),
  plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
};

/** Prop materials for every theme; ones a theme never uses are simply never compiled. */
export function createMaterials() {
  const flat = (color: number, roughness = 0.92, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  const glow = (color: number, emissive: number, intensity: number) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.5 });
  const basic = (r: number, g: number, b: number) => {
    const m = new THREE.MeshBasicMaterial();
    m.color.setRGB(r, g, b);
    return m;
  };
  return {
    // Frontier
    bark: flat(0x3a302a),
    deadWood: flat(0x3a2d22),
    graveStone: flat(0x4f4d55, 0.9),
    mossStone: flat(0x3c4536, 0.95),
    rock: flat(0x37332f, 0.95),
    darkRock: flat(0x26221f, 0.95),
    bone: flat(0xc9bfa8, 0.8),
    iron: flat(0x22252b, 0.45, 0.7),
    dirt: flat(0x2c2219, 1),
    bramble: flat(0x1f1a15, 0.9),
    obsidian: flat(0x181014, 0.4, 0.8),
    mushroomStem: new THREE.MeshStandardMaterial({ color: 0xb9b0a0, emissive: 0x2a3a36, emissiveIntensity: 0.6, roughness: 0.7 }),
    capTeal: glow(0x0f5f58, 0x2dd4bf, 1.7),
    capViolet: glow(0x4c1d6e, 0xa855f7, 1.6),
    runeGlow: glow(0x2e1065, 0x8b5cf6, 2.2),
    soulFire: glow(0x134e4a, 0x5eead4, 2.6),
    emberCrust: new THREE.MeshBasicMaterial({ color: 0x5a1606 }),
    voidBlack: new THREE.MeshBasicMaterial({ color: 0x050404 }),
    // Ironforge
    snow: flat(0xbfc8d4, 0.85),
    frostBark: flat(0x5a5652),
    greyRock: flat(0x55585e, 0.95),
    forgeStone: flat(0x4a4642, 0.9),
    timber: flat(0x4a3424),
    coal: glow(0x4a1a08, 0xff6a1a, 2.4),
    oreGlint: glow(0x3a2a10, 0xffa040, 1.5),
    // Canyon
    sandstone: flat(0xa0704a, 0.95),
    redRock: flat(0x7e4632, 0.95),
    paleBone: flat(0xe2d8c2, 0.8),
    cactus: flat(0x46613a, 0.85),
    dryBrush: flat(0x6b5434, 0.95),
    wagonWood: flat(0x5e4228, 0.9),
    // Rift
    riftStone: flat(0x4a4262, 0.9),
    riftBark: flat(0x30263c),
    crystalCyan: glow(0x0e4a5a, 0x22d3ee, 2.0),
    crystalViolet: glow(0x3b1d6e, 0xa855f7, 2.0),
    riftRune: glow(0x0c2a3a, 0x38bdf8, 2.2),
    riftCrust: new THREE.MeshBasicMaterial({ color: 0x1a2448 }),
    riftCore: basic(0.45, 1.6, 2.2),
    // Citadel
    charBark: flat(0x2a201c),
    basalt: flat(0x3a2e30, 0.85, 0.3),
    bannerRed: flat(0x4e1016, 0.95),
    hellfire: glow(0x5a1a08, 0xff4a14, 2.8)
  };
}

export type Mats = ReturnType<typeof createMaterials>;
