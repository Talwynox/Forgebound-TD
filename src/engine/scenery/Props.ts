import * as THREE from 'three';
import { DecorPlacer, G, Mats, Rand, StaticBatch, at, groundHeight, seededRandom, xf } from './Terrain';

/**
 * Prop builders for the scenery around the battlefield. Small props add themselves to a batch;
 * landmarks take the placer and skip themselves if they would land on gameplay.
 */

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ==================================================================
// Shared
// ==================================================================

/** Gnarled leafless tree with crooked branches. */
export function deadTree(b: StaticBatch, bark: THREE.Material, x: number, z: number, scale: number, seed: number) {
  const rand = seededRandom(seed);
  const base = xf(x, groundHeight(x, z), z, (rand() - 0.5) * 0.15, rand() * Math.PI * 2, (rand() - 0.5) * 0.15, scale);
  const trunkH = 2.6 + rand() * 0.8;
  b.add(G.cylTaper, bark, at(base, xf(0, trunkH / 2, 0, 0, 0, 0, 0.42, trunkH, 0.42)));
  // Root flare
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rand();
    b.add(G.branch, bark, at(base, xf(Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22, Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25, 0.16, 0.6, 0.16)));
  }
  const branches = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < branches; i++) {
    const a = rand() * Math.PI * 2;
    const tilt = 0.6 + rand() * 0.6;
    const len = 0.9 + rand() * 0.9;
    const y = trunkH * (0.5 + rand() * 0.45);
    const end = v(Math.cos(a) * Math.sin(tilt) * len, y + Math.cos(tilt) * len, Math.sin(a) * Math.sin(tilt) * len);
    b.strut(G.branch, bark, base, v(0, y, 0), end, 0.12);
    // A crooked twig off the branch end
    const tdir = end.clone().sub(v(0, y, 0)).normalize().add(v((rand() - 0.5) * 1.2, 0.6, (rand() - 0.5) * 1.2)).normalize();
    b.strut(G.branch, bark, base, end, end.clone().addScaledVector(tdir, len * 0.55), 0.06);
  }
}

export function skull(b: StaticBatch, bone: THREE.Material, m: THREE.Matrix4) {
  b.add(G.sphere, bone, at(m, xf(0, 0, 0, 0, 0, 0, 0.26, 0.24, 0.3)));
  b.add(G.box, bone, at(m, xf(0, -0.1, 0.06, 0, 0, 0, 0.16, 0.08, 0.16)));
}

export function skullPike(b: StaticBatch, mats: Mats, x: number, z: number, lean: number, ry: number) {
  const base = xf(x, 0, z, lean, ry, 0);
  b.add(G.cyl6, mats.deadWood, at(base, xf(0, 1.1, 0, 0, 0, 0, 0.1, 2.2, 0.1)));
  b.add(G.cone4, mats.iron, at(base, xf(0, 2.35, 0, 0, 0, 0, 0.08, 0.3, 0.08)));
  skull(b, mats.bone, at(base, xf(0, 2.05, 0)));
}

/** Skull pikes warning travellers off the enemy citadel (every theme: it is always the enemy's gate). */
export function citadelPikes(p: DecorPlacer, mats: Mats) {
  [[41, -12.8, 0.15], [43.2, -14.2, -0.12], [39, -14.6, 0.08], [41.5, 12.9, -0.15], [43.6, 14.5, 0.1], [39.4, 15, -0.05]].forEach(([x, z, lean], i) => {
    const b = p.at(x, z, 0.2);
    if (b) skullPike(b, mats, x, z, lean, i * 1.3);
  });
}

export function boulder(b: StaticBatch, palette: THREE.Material[], x: number, z: number, s: number, rand: Rand) {
  const mat = palette[Math.floor(rand() * palette.length)];
  b.add(rand() < 0.5 ? G.rock : G.rockLumpy, mat,
    xf(x, groundHeight(x, z) + s * 0.12, z, rand() * 3, rand() * 3, rand() * 3, s * (1 + rand() * 0.5), s * (0.5 + rand() * 0.4), s));
}

export function mushroomCluster(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand, caps: THREE.Material[]) {
  const cap = caps[Math.floor(rand() * caps.length)];
  const n = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const mx = x + (rand() - 0.5) * 0.9;
    const mz = z + (rand() - 0.5) * 0.9;
    const h = 0.12 + rand() * 0.22;
    const r = 0.08 + rand() * 0.12;
    const y = groundHeight(mx, mz);
    b.add(G.cyl6, mats.mushroomStem, xf(mx, y + h / 2, mz, 0, 0, 0, r * 0.45, h, r * 0.45));
    b.add(G.halfDome, cap, xf(mx, y + h, mz, (rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3, r * 2, r * 1.3, r * 2));
  }
}

/** Thorny thicket (or dry desert brush, or burnt scrub — by material). */
export function bramble(b: StaticBatch, mat: THREE.Material, x: number, z: number, rand: Rand) {
  const n = 6 + Math.floor(rand() * 5);
  const y = groundHeight(x, z);
  b.add(G.halfDome, mat, xf(x, y, z, 0, 0, 0, 1.0, 0.35, 1.0));
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const tilt = 0.5 + rand() * 0.8;
    b.add(G.cone4, mat, xf(x + Math.cos(a) * 0.3, y + 0.25, z + Math.sin(a) * 0.3, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt, 0.05, 0.6 + rand() * 0.5, 0.05));
  }
}

export function bones(b: StaticBatch, bone: THREE.Material, x: number, z: number, rand: Rand) {
  skull(b, bone, xf(x, 0.1, z, rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6));
  for (let i = 0; i < 3; i++) {
    b.add(G.cyl6, bone, xf(x + (rand() - 0.5) * 0.8, 0.04, z + (rand() - 0.5) * 0.8, 0, rand() * Math.PI, Math.PI / 2, 0.06, 0.5 + rand() * 0.3, 0.06));
  }
}

/** Glowing crack in the earth: molten (infernal) or arcane (rift), by material. */
export function fissure(b: StaticBatch, crust: THREE.Material, core: THREE.Material, x: number, z: number, rand: Rand) {
  let angle = rand() * Math.PI * 2;
  let cx = x;
  let cz = z;
  const segments = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < segments; i++) {
    angle += (rand() - 0.5) * 1.1;
    const len = 0.7 + rand() * 0.9;
    const width = 0.16 + rand() * 0.16;
    const mx = cx + Math.sin(angle) * len * 0.5;
    const mz = cz + Math.cos(angle) * len * 0.5;
    const y = groundHeight(mx, mz);
    b.add(G.plane, crust, xf(mx, y + 0.06, mz, 0, angle, 0, width * 3.2, 1, len * 1.1));
    b.add(G.plane, core, xf(mx, y + 0.09, mz, 0, angle, 0, width, 1, len * 1.04));
    // Short side branch
    if (rand() < 0.5) {
      const side = angle + (rand() < 0.5 ? 1 : -1) * (0.7 + rand() * 0.5);
      const sl = len * 0.6;
      const sx = mx + Math.sin(side) * sl * 0.5;
      const sz = mz + Math.cos(side) * sl * 0.5;
      b.add(G.plane, crust, xf(sx, y + 0.05, sz, 0, side, 0, width * 2, 1, sl));
      b.add(G.plane, core, xf(sx, y + 0.08, sz, 0, side, 0, width * 0.5, 1, sl));
    }
    cx += Math.sin(angle) * len;
    cz += Math.cos(angle) * len;
  }
}

export function obsidianSpike(b: StaticBatch, mat: THREE.Material, x: number, z: number, rand: Rand) {
  const h = 1.6 + rand() * 2.6;
  b.add(G.cone4, mat, xf(x, groundHeight(x, z) + h * 0.42, z, (rand() - 0.5) * 0.5, rand() * 3, (rand() - 0.5) * 0.5, 0.5 + rand() * 0.4, h, 0.5 + rand() * 0.4));
}

/** Smouldering fissures and obsidian shards on the infernal ground beyond the enemy citadel. */
export function infernalEast(p: DecorPlacer, mats: Mats, lava: THREE.Material, rand: Rand, fissures: number, spikes: number) {
  const east = { minX: 46, maxX: 100, minZ: -32, maxZ: 28 };
  p.scatter(rand, fissures, 1.5, 60, (b, x, z) => fissure(b, mats.emberCrust, lava, x, z, rand), east);
  p.scatter(rand, spikes, 1, 60, (b, x, z) => obsidianSpike(b, mats.obsidian, x, z, rand), east);
}

/** Where dead trees stand in every theme (bark and what grows beside them vary). */
export const DEAD_TREE_SPOTS: [number, number, number][] = [
  [-30, -22, 1.1], [-14, -24, 1.25], [-4, -16, 0.95], [3, -27, 1.2], [21, -24, 1.0], [35, -16, 1.15],
  [-40, 9, 1.0], [-42, 21, 1.2], [-5, 20, 0.9], [5, 15.5, 1.0], [24, 15, 1.1], [-26, 21, 0.9],
  [-16, 22, 1.0], [52, -24, 1.2], [61, -27, 1.0], [78, -20, 1.2], [80, 15, 1.0], [-58, -8, 1.3],
  [-60, 14, 1.1], [36, 21, 1.0], [15, -33, 1.3], [-8, -33, 1.15], [-36, -34, 1.2], [47, 21, 1.1],
  [-52, -18, 1.0], [30, -30, 1.25], [64, 22, 1.0], [92, -6, 1.2]
];

export function plantDeadTrees(p: DecorPlacer, bark: THREE.Material, every = 1, extra?: (b: StaticBatch, x: number, z: number) => void) {
  DEAD_TREE_SPOTS.forEach(([x, z, s], i) => {
    if (i % every !== 0) return;
    const b = p.at(x, z, 1.5);
    if (!b) return;
    deadTree(b, bark, x, z, s, 500 + i);
    extra?.(b, x, z);
  });
}

/** Ring of standing stones with carved glowing runes around an altar. */
export function runeCircle(p: DecorPlacer, mats: Mats, cx: number, cz: number, stone: THREE.Material, rune: THREE.Material, core: THREE.Material) {
  const b = p.at(cx, cz, 5);
  if (!b) return;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const x = cx + Math.cos(a) * 4.4;
    const z = cz + Math.sin(a) * 4.4;
    const face = Math.atan2(cx - x, cz - z);
    if (i === 4) {
      // One stone has toppled
      b.add(G.cylTaper, stone, xf(x, 0.3, z, 0, face + 0.4, Math.PI / 2, 0.9, 2.4, 0.55));
      continue;
    }
    const h = 2.2 + (i % 3) * 0.5;
    const m = xf(x, h / 2 - 0.1, z, (i % 2 ? 0.05 : -0.06), face, 0);
    b.add(G.cylTaper, stone, at(m, xf(0, 0, 0, 0, 0, 0, 0.9, h, 0.55)));
    b.add(G.box, rune, at(m, xf(0, 0.1, 0.27, 0, 0, 0, 0.1, h * 0.55, 0.06)));
    b.add(G.box, rune, at(m, xf(0, 0.25, 0.27, 0, 0, 0, 0.35, 0.08, 0.06)));
  }
  b.add(G.box, stone, xf(cx, 0.35, cz, 0, 0.3, 0, 2.2, 0.7, 1.2));
  b.add(G.box, rune, xf(cx, 0.71, cz, 0, 0.3, 0, 1.6, 0.03, 0.12));
  b.add(G.box, rune, xf(cx, 0.71, cz, 0, 0.3 + Math.PI / 2, 0, 0.8, 0.03, 0.12));
  b.add(G.sphere, core, xf(cx, 1.05, cz, 0, 0, 0, 0.35, 0.5, 0.35));
  skull(b, mats.bone, xf(cx + 0.6, 0.85, cz + 0.1, 0, 0.4, 0));
}

/** Round watchtower ruin with broken crenellations. */
export function watchtower(p: DecorPlacer, mats: Mats, cx: number, cz: number, stone: THREE.Material, cap?: THREE.Material) {
  const b = p.at(cx, cz, 3);
  if (!b) return;
  const y = groundHeight(cx, cz);
  b.add(G.cylTaper, stone, xf(cx, y + 2.6, cz, 0, 0, 0, 3.4, 5.6, 3.4));
  for (let c = 0; c < 5; c++) {
    const a = (c / 7) * Math.PI * 2;
    b.add(G.box, stone, xf(cx + Math.cos(a) * 1.4, y + 5.65, cz + Math.sin(a) * 1.4, 0, -a, 0, 0.6, 0.7, 0.45));
  }
  b.add(G.cyl6, mats.deadWood, xf(cx + 0.6, y + 4.2, cz + 0.9, 0, 0, 0.5, 0.12, 3.2, 0.12));
  b.add(G.box, mats.dirt, xf(cx, y + 3.4, cz + 1.62, 0, 0, 0, 0.35, 0.9, 0.05));
  if (cap) b.add(G.halfDome, cap, xf(cx, y + 5.38, cz, 0, 0, 0, 2.3, 0.35, 2.3));
}

// ==================================================================
// Frontier: moonlit forest graveyard
// ==================================================================

function headstone(b: StaticBatch, mats: Mats, x: number, z: number, ry: number, lean: number, kind: number) {
  const base = xf(x, 0, z, lean, ry, lean * 0.5);
  if (kind === 0) {
    // Rounded headstone
    b.add(G.box, mats.graveStone, at(base, xf(0, 0.3, 0, 0, 0, 0, 0.5, 0.6, 0.14)));
    b.add(G.slabTop, mats.graveStone, at(base, xf(0, 0.6, 0, 0, Math.PI / 2, Math.PI / 2, 0.5, 0.14, 0.5)));
  } else if (kind === 1) {
    // Celtic-style cross
    b.add(G.box, mats.graveStone, at(base, xf(0, 0.5, 0, 0, 0, 0, 0.13, 1.0, 0.11)));
    b.add(G.box, mats.graveStone, at(base, xf(0, 0.72, 0, 0, 0, 0, 0.55, 0.13, 0.11)));
  } else {
    // Weathered, broken slab
    b.add(G.box, mats.mossStone, at(base, xf(0, 0.22, 0, 0, 0, 0.18, 0.55, 0.44, 0.16)));
  }
  // Sunken grave mound in front
  b.add(G.halfDome, mats.dirt, xf(x + Math.sin(ry) * 0.75, 0, z + Math.cos(ry) * 0.75, 0, ry, 0, 0.7, 0.18, 1.3));
}

/** Rows of graves behind a broken wrought-iron fence. */
export function graveyard(p: DecorPlacer, mats: Mats) {
  const rand = seededRandom(77);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      if (rand() < 0.15) continue;
      const x = 6 + col * 2.2 + (rand() - 0.5) * 0.6;
      const z = -15.5 - row * 2.6 + (rand() - 0.5) * 0.5;
      const b = p.at(x, z, 1);
      if (b) headstone(b, mats, x, z, Math.PI + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.25, Math.floor(rand() * 3));
    }
  }
  const fz = -13.2;
  for (let x = 4.5; x <= 19.5; x += 0.45) {
    if (x > 11 && x < 13.2) continue; // gate gap
    if (rand() < 0.18) continue; // missing bars
    const b = p.at(x, fz, 0.3);
    if (!b) continue;
    const lean = rand() < 0.15 ? (rand() - 0.5) * 0.6 : 0;
    b.add(G.box, mats.iron, xf(x, 0.55, fz, 0, 0, lean, 0.05, 1.1, 0.05));
    b.add(G.cone4, mats.iron, xf(x - Math.sin(lean) * 0.55, 1.14, fz, 0, 0, lean, 0.07, 0.18, 0.07));
  }
  const rail = p.at(8, fz, 0.3);
  rail?.add(G.box, mats.iron, xf(7.7, 0.8, fz, 0, 0, 0, 6.4, 0.05, 0.05));
  rail?.add(G.box, mats.iron, xf(16.3, 0.8, fz, 0, 0, 0, 6.4, 0.05, 0.05));
  [11, 13.2].forEach(x => {
    const b = p.at(x, fz, 0.3);
    b?.add(G.box, mats.graveStone, xf(x, 0.75, fz, 0, 0, 0, 0.45, 1.5, 0.45));
    b?.add(G.sphere, mats.graveStone, xf(x, 1.62, fz, 0, 0, 0, 0.4, 0.4, 0.4));
  });
}

/** Broken columns, fallen drums and a crumbling gable wall. */
export function ruinedChapel(p: DecorPlacer, mats: Mats, cx: number, cz: number, stone: THREE.Material, fallen: THREE.Material) {
  const b = p.at(cx, cz, 3);
  if (!b) return;
  [2.6, 1.1, 3.4, 0.6, 1.8, 2.9].forEach((h, i) => {
    const x = cx - 3.5 + (i % 3) * 3.5;
    const z = cz - 1.6 + Math.floor(i / 3) * 3.2;
    b.add(G.cyl6, stone, xf(x, h / 2, z, 0, i, 0, 0.6, h, 0.6));
    b.add(G.box, stone, xf(x, 0.12, z, 0, 0, 0, 0.85, 0.24, 0.85));
  });
  b.add(G.cyl6, fallen, xf(cx + 1.4, 0.3, cz + 3.4, 0, 0.5, Math.PI / 2, 0.6, 1.6, 0.6));
  b.add(G.cyl6, fallen, xf(cx - 2.2, 0.3, cz + 0.4, 0, -0.4, Math.PI / 2, 0.6, 1.1, 0.6));
  b.add(G.box, stone, xf(cx, 1.5, cz - 3.2, 0, 0, 0, 5.2, 3.0, 0.5));
  b.add(G.box, stone, xf(cx - 1.4, 3.3, cz - 3.2, 0, 0, 0.55, 2.2, 0.8, 0.5));
  b.add(G.box, mats.dirt, xf(cx, 1.8, cz - 2.94, 0, 0, 0, 0.9, 1.6, 0.05)); // empty window
  b.add(G.box, fallen, xf(cx + 2.1, 0.25, cz - 2.2, 0.3, 0.6, 0.2, 0.9, 0.5, 0.7));
}

/** Mausoleum with a gabled roof and a soul lantern over its dark door. */
export function crypt(p: DecorPlacer, mats: Mats, cx: number, cz: number) {
  const b = p.at(cx, cz, 3);
  if (!b) return;
  const base = xf(cx, 0, cz, 0, 0.35, 0);
  b.add(G.box, mats.graveStone, at(base, xf(0, 0.2, 0, 0, 0, 0, 4.4, 0.4, 5.2)));
  b.add(G.box, mats.graveStone, at(base, xf(0, 1.6, -0.3, 0, 0, 0, 3.6, 2.4, 4.0)));
  // Gabled roof (triangular prism: 4.2 wide, 1.3 high, sitting on the 2.8-high walls)
  b.add(G.prism, mats.darkRock, at(base, xf(0, 3.23, -0.3, -Math.PI / 2, 0, 0, 4.85, 4.6, 1.73)));
  [-1.3, 1.3].forEach(x => b.add(G.cyl6, mats.graveStone, at(base, xf(x, 1.6, 2.1, 0, 0, 0, 0.45, 2.4, 0.45))));
  b.add(G.box, mats.graveStone, at(base, xf(0, 2.95, 2.0, 0, 0, 0, 3.4, 0.35, 0.9)));
  b.add(G.box, mats.dirt, at(base, xf(0, 1.25, 1.72, 0, 0, 0, 1.3, 1.9, 0.05)));
  b.add(G.sphere, mats.soulFire, at(base, xf(0, 2.55, 1.8, 0, 0, 0, 0.28, 0.36, 0.28)));
  b.add(G.box, mats.iron, at(base, xf(0, 2.8, 1.8, 0, 0, 0, 0.36, 0.06, 0.36)));
}

// ==================================================================
// Ironforge: frozen mountain pass with forges and mines
// ==================================================================

export function snowDrift(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand) {
  const ry = rand() * 3;
  const len = 1.8 + rand() * 2.2;
  b.add(G.halfDome, mats.snow, xf(x, groundHeight(x, z) - 0.04, z, 0, ry, 0, len, 0.2 + rand() * 0.2, len * (0.35 + rand() * 0.2)));
  b.add(G.halfDome, mats.snow, xf(x + Math.cos(ry) * len * 0.3, groundHeight(x, z) - 0.04, z - Math.sin(ry) * len * 0.3, 0, ry + 0.5, 0, len * 0.5, 0.14, len * 0.3));
}

/** Stacked stone way-marker. */
export function cairn(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand) {
  let y = groundHeight(x, z);
  for (let i = 0; i < 4; i++) {
    const s = 0.9 - i * 0.16;
    const h = s * 0.45;
    b.add(G.rock, mats.greyRock, xf(x + (rand() - 0.5) * 0.12, y + h / 2, z + (rand() - 0.5) * 0.12, 0, rand() * 3, 0, s * 1.4, h * 2, s * 1.2));
    y += h * 0.85;
  }
  b.add(G.halfDome, mats.snow, xf(x, y - 0.05, z, 0, 0, 0, 0.45, 0.2, 0.4));
}

export function orePile(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand) {
  for (let i = 0; i < 6; i++) {
    const s = 0.35 + rand() * 0.35;
    b.add(G.rockLumpy, mats.darkRock, xf(x + (rand() - 0.5) * 1.2, s * 0.3, z + (rand() - 0.5) * 1.2, rand() * 3, rand() * 3, 0, s));
  }
  for (let i = 0; i < 4; i++) {
    b.add(G.octa, mats.oreGlint, xf(x + (rand() - 0.5) * 1.0, 0.25 + rand() * 0.2, z + (rand() - 0.5) * 1.0, rand(), rand(), rand(), 0.16));
  }
}

function anvil(b: StaticBatch, mats: Mats, x: number, z: number, ry: number) {
  const base = xf(x, 0, z, 0, ry, 0);
  b.add(G.cyl6, mats.timber, at(base, xf(0, 0.3, 0, 0, 0, 0, 0.6, 0.6, 0.6)));
  b.add(G.box, mats.iron, at(base, xf(0, 0.7, 0, 0, 0, 0, 0.3, 0.2, 0.22)));
  b.add(G.box, mats.iron, at(base, xf(0, 0.88, 0, 0, 0, 0, 0.75, 0.16, 0.28)));
  b.add(G.cone4, mats.iron, at(base, xf(0.52, 0.88, 0, 0, 0, -Math.PI / 2, 0.16, 0.32, 0.16)));
}

/** Stone forge with a glowing coal hearth, hood and chimney, an anvil and a quench barrel. */
export function forge(p: DecorPlacer, mats: Mats, x: number, z: number, ry: number) {
  const b = p.at(x, z, 2.5);
  if (!b) return;
  const base = xf(x, 0, z, 0, ry, 0);
  b.add(G.box, mats.forgeStone, at(base, xf(0, 0.5, 0, 0, 0, 0, 2.2, 1.0, 1.6)));
  b.add(G.box, mats.coal, at(base, xf(0, 1.03, 0.1, 0, 0, 0, 1.5, 0.08, 1.0)));
  b.add(G.cone4, mats.forgeStone, at(base, xf(0, 1.95, -0.1, 0, Math.PI / 4, 0, 2.0, 0.9, 1.6)));
  b.add(G.cyl6, mats.forgeStone, at(base, xf(0, 2.9, -0.2, 0, 0, 0, 0.7, 2.6, 0.7)));
  b.add(G.box, mats.darkRock, at(base, xf(0, 4.25, -0.2, 0, 0, 0, 0.95, 0.2, 0.95)));
  b.add(G.box, mats.timber, at(base, xf(1.45, 0.55, 0.2, 0, 0, 0.5, 0.9, 0.18, 0.6))); // bellows
  b.add(G.cyl8, mats.timber, at(base, xf(-1.6, 0.4, 0.9, 0, 0, 0, 0.7, 0.8, 0.7))); // quench barrel
  // The anvil stands in front of the hearth
  const front = at(base, xf(0.4, 0, 1.8));
  const e = new THREE.Vector3().setFromMatrixPosition(front);
  anvil(b, mats, e.x, e.z, ry + 0.3);
}

/** Timber-framed mine entrance cut into a snowy rock hill, with rails and an abandoned ore cart. */
export function mineEntrance(p: DecorPlacer, mats: Mats, cx: number, cz: number) {
  const b = p.at(cx, cz, 5);
  if (!b) return;
  b.add(G.halfDome, mats.greyRock, xf(cx, 0, cz - 1.5, 0, 0.3, 0, 9, 4.5, 6));
  b.add(G.halfDome, mats.snow, xf(cx, 1.5, cz - 1.6, 0, 0.3, 0, 6.4, 1.8, 4.2));
  [[-4.2, -0.5, 1.6], [4.0, 0.2, 1.3], [3.2, 1.6, 0.9], [-3.0, 1.8, 0.8]].forEach(([dx, dz, s]) =>
    b.add(G.rock, mats.greyRock, xf(cx + dx, s * 0.3, cz + dz, 0.4, dx, 0.2, s * 1.4, s, s * 1.2)));
  // Dark mouth and timber frame
  b.add(G.box, mats.voidBlack, xf(cx, 0.95, cz + 1.25, 0, 0, 0, 1.8, 1.9, 0.5));
  [-1.05, 1.05].forEach(dx => b.add(G.box, mats.timber, xf(cx + dx, 1.05, cz + 1.55, 0, 0, 0, 0.26, 2.1, 0.26)));
  b.add(G.box, mats.timber, xf(cx, 2.2, cz + 1.55, 0, 0, 0, 2.7, 0.28, 0.32));
  // Rails running out of the mine
  [-0.4, 0.4].forEach(dx => b.add(G.box, mats.iron, xf(cx + dx, 0.06, cz + 4.2, 0, 0, 0, 0.07, 0.07, 5.2)));
  for (let s = 0; s < 8; s++) b.add(G.box, mats.timber, xf(cx, 0.03, cz + 1.9 + s * 0.65, 0, 0, 0, 1.15, 0.06, 0.2));
  // Ore cart
  const cart = xf(cx, 0, cz + 4.6, 0, 0.05, 0);
  b.add(G.box, mats.iron, at(cart, xf(0, 0.6, 0, 0, 0, 0, 1.0, 0.6, 1.3)));
  b.add(G.box, mats.timber, at(cart, xf(0, 0.92, 0, 0, 0, 0, 1.06, 0.06, 1.36)));
  [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]].forEach(([wx, wz]) =>
    b.add(G.cyl8, mats.iron, at(cart, xf(wx, 0.2, wz, 0, 0, Math.PI / 2, 0.36, 0.08, 0.36))));
  b.add(G.rockLumpy, mats.darkRock, at(cart, xf(0, 0.95, 0, 0.3, 0.5, 0, 0.8, 0.45, 1.0)));
  b.add(G.octa, mats.oreGlint, at(cart, xf(0.2, 1.15, 0.2, 0.3, 0, 0.4, 0.18)));
  // Lantern post
  b.add(G.cyl6, mats.timber, xf(cx + 1.8, 1.0, cz + 2.2, 0, 0, 0, 0.12, 2.0, 0.12));
  b.add(G.box, mats.coal, xf(cx + 1.8, 2.05, cz + 2.2, 0, 0, 0, 0.22, 0.28, 0.22));
}

// ==================================================================
// Canyon: sun-baked badlands with bones, cacti and wrecked caravans
// ==================================================================

export function cactus(b: StaticBatch, mats: Mats, x: number, z: number, s: number, rand: Rand) {
  const y = groundHeight(x, z);
  const h = (1.6 + rand() * 1.4) * s;
  const r = 0.42 * s;
  b.add(G.cyl8, mats.cactus, xf(x, y + h / 2, z, 0, 0, 0, r, h, r));
  b.add(G.sphere, mats.cactus, xf(x, y + h, z, 0, 0, 0, r, r * 0.8, r));
  const arms = rand() < 0.3 ? 0 : 1 + Math.floor(rand() * 2);
  for (let i = 0; i < arms; i++) {
    const a = rand() * Math.PI * 2;
    const ay = h * (0.35 + rand() * 0.3);
    const out = 0.5 * s;
    const up = (0.5 + rand() * 0.6) * s;
    const ex = x + Math.cos(a) * out;
    const ez = z + Math.sin(a) * out;
    b.add(G.cyl8, mats.cactus, xf(x + Math.cos(a) * out * 0.5, y + ay, z + Math.sin(a) * out * 0.5, 0, -a, Math.PI / 2, r * 0.7, out, r * 0.7));
    b.add(G.cyl8, mats.cactus, xf(ex, y + ay + up / 2, ez, 0, 0, 0, r * 0.7, up, r * 0.7));
    b.add(G.sphere, mats.cactus, xf(ex, y + ay + up, ez, 0, 0, 0, r * 0.7, r * 0.6, r * 0.7));
  }
}

/** Horned skull lying in the dust. */
export function hornedSkull(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand) {
  const base = xf(x, 0.12, z, (rand() - 0.5) * 0.4, rand() * Math.PI * 2, 0);
  b.add(G.box, mats.paleBone, at(base, xf(0, 0, 0.1, 0, 0, 0, 0.3, 0.2, 0.55)));
  b.add(G.sphere, mats.paleBone, at(base, xf(0, 0.04, -0.15, 0, 0, 0, 0.38, 0.28, 0.32)));
  [-1, 1].forEach(side => b.strut(G.cone4, mats.paleBone, base, v(side * 0.15, 0.08, -0.2), v(side * 0.6, 0.3, -0.05), 0.09));
}

/** The bleached ribcage, spine and skull of some huge beast. */
export function beastSkeleton(p: DecorPlacer, mats: Mats, x: number, z: number, ry: number, s: number) {
  const b = p.at(x, z, 4 * s);
  if (!b) return;
  const base = xf(x, 0, z, 0, ry, 0, s);
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const lx = -3 + t * 6;
    const ly = 0.35 + Math.sin(t * Math.PI) * 0.6;
    b.add(G.box, mats.paleBone, at(base, xf(lx, ly, 0, 0, 0, 0, 0.3, 0.24, 0.24)));
    if (t > 0.2 && t < 0.8 && i % 2 === 0) {
      const reach = 0.8 + Math.sin(t * Math.PI) * 0.7;
      [-1, 1].forEach(side => {
        const mid = v(lx, ly + 0.15, side * reach);
        b.strut(G.cyl6, mats.paleBone, base, v(lx, ly, side * 0.15), mid, 0.1);
        b.strut(G.cyl6, mats.paleBone, base, mid, v(lx + 0.15, 0.05, side * (reach + 0.5)), 0.09);
      });
    }
  }
  // Skull with long horns at the front
  b.add(G.box, mats.paleBone, at(base, xf(3.7, 0.35, 0, 0, 0, -0.2, 1.2, 0.45, 0.55)));
  [-1, 1].forEach(side => b.strut(G.cone4, mats.paleBone, base, v(3.4, 0.55, side * 0.2), v(2.9, 1.5, side * 1.0), 0.18));
}

export function barrel(b: StaticBatch, mats: Mats, x: number, z: number, onSide: boolean, rand: Rand) {
  if (onSide) b.add(G.cyl8, mats.wagonWood, xf(x, 0.32, z, 0, rand() * 3, Math.PI / 2, 0.62, 0.85, 0.62));
  else b.add(G.cyl8, mats.wagonWood, xf(x, 0.42, z, 0, 0, 0, 0.62, 0.85, 0.62));
}

/** Wrecked covered wagon slumped on a broken wheel. */
export function brokenWagon(p: DecorPlacer, mats: Mats, x: number, z: number, ry: number) {
  const b = p.at(x, z, 2.5);
  if (!b) return;
  const base = xf(x, 0, z, 0, ry, 0);
  const bed = at(base, xf(0, 0.72, 0, 0.12, 0, -0.16));
  b.add(G.box, mats.wagonWood, at(bed, xf(0, 0, 0, 0, 0, 0, 2.6, 0.12, 1.3)));
  b.add(G.box, mats.wagonWood, at(bed, xf(0, 0.25, 0.62, 0, 0, 0, 2.6, 0.4, 0.06)));
  b.add(G.box, mats.wagonWood, at(bed, xf(0.3, 0.2, -0.62, 0, 0, 0.1, 2.0, 0.35, 0.06)));
  // Bare canopy hoops
  [-0.8, 0, 0.8].forEach(hx => {
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * Math.PI;
      const a1 = ((k + 1) / 4) * Math.PI;
      b.strut(G.cyl6, mats.wagonWood, bed, v(hx, 0.3 + Math.sin(a0) * 0.9, Math.cos(a0) * 0.65), v(hx, 0.3 + Math.sin(a1) * 0.9, Math.cos(a1) * 0.65), 0.05);
    }
  });
  // Wheels: three on their axles, one fallen off
  [[-0.9, 0.72], [0.9, 0.72], [-0.9, -0.72]].forEach(([wx, wz]) =>
    b.add(G.cyl8, mats.wagonWood, at(base, xf(wx, 0.45, wz, Math.PI / 2, 0, 0, 0.9, 0.1, 0.9))));
  b.add(G.cyl8, mats.wagonWood, at(base, xf(1.7, 0.05, -1.4, 0, 0.4, 0, 0.9, 0.1, 0.9)));
  b.add(G.box, mats.wagonWood, at(base, xf(2.0, 0.12, 0, 0, 0, 0.12, 1.5, 0.08, 0.1))); // tongue
}

/** Balanced-rock spire of stacked sandstone. */
export function hoodoo(b: StaticBatch, mats: Mats, x: number, z: number, s: number, rand: Rand) {
  const y = groundHeight(x, z);
  b.add(G.cylTaper, mats.sandstone, xf(x, y + 1.0 * s, z, 0, rand() * 3, 0, 1.4 * s, 2.0 * s, 1.4 * s));
  b.add(G.rock, mats.redRock, xf(x, y + 2.3 * s, z, rand(), rand(), 0, 1.2 * s, 1.0 * s, 1.1 * s));
  b.add(G.cylTaper, mats.sandstone, xf(x, y + 3.1 * s, z, 0, rand() * 3, 0, 0.9 * s, 1.4 * s, 0.9 * s));
  b.add(G.cyl6, mats.redRock, xf(x, y + 3.95 * s, z, 0.08, rand() * 3, 0, 1.9 * s, 0.4 * s, 1.7 * s));
}

/** Natural sandstone arch. */
export function rockArch(p: DecorPlacer, mats: Mats, cx: number, cz: number) {
  const b = p.at(cx, cz, 5);
  if (!b) return;
  [-1, 1].forEach(side => {
    const x = cx + side * 3.6;
    [[1.0, 2.6], [3.0, 2.3], [5.0, 2.1]].forEach(([y, s], i) =>
      b.add(G.rock, i % 2 ? mats.redRock : mats.sandstone, xf(x + side * (i === 1 ? 0.25 : 0), y, cz, 0.2 * i, side + i, 0, s * 1.1, s, s)));
    b.add(G.rock, mats.redRock, xf(cx + side * 2.9, 6.1, cz, 0.3, side, 0.4 * side, 2.4, 1.6, 2.1));
  });
  b.add(G.box, mats.sandstone, xf(cx, 6.75, cz, 0, 0, 0, 7.4, 1.3, 2.2));
  b.add(G.box, mats.redRock, xf(cx, 7.45, cz, 0, 0.05, 0, 6.6, 0.3, 2.0));
  // Rubble at the foot
  [[-1.6, 1.4, 0.7], [1.9, -1.2, 0.5], [0.4, 1.8, 0.4]].forEach(([dx, dz, s]) =>
    b.add(G.rock, mats.sandstone, xf(cx + dx, s * 0.3, cz + dz, dx, dz, 0, s * 1.3, s, s)));
}

// ==================================================================
// Rift: arcane crystals, floating stone and torn ground
// ==================================================================

export function crystalCluster(b: StaticBatch, mats: Mats, x: number, z: number, s: number, rand: Rand, mat: THREE.Material) {
  const y = groundHeight(x, z);
  b.add(G.rock, mats.riftStone, xf(x, y + 0.1 * s, z, rand(), rand(), 0, 1.2 * s, 0.5 * s, 1.1 * s));
  const n = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const tilt = i === 0 ? 0 : 0.2 + rand() * 0.5;
    const h = (i === 0 ? 2.6 : 1.0 + rand() * 1.6) * s;
    const r = (0.3 + rand() * 0.15) * s;
    b.add(G.octa, mat, xf(x + Math.cos(a) * 0.25 * s, y + h * 0.38, z + Math.sin(a) * 0.25 * s, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt, r, h, r));
  }
}

/** Chunk of earth torn loose and hanging in the air. */
export function floatingRock(b: StaticBatch, mats: Mats, x: number, z: number, h: number, s: number, rand: Rand) {
  const y = groundHeight(x, z) + h;
  b.add(G.rock, mats.riftStone, xf(x, y, z, 0, rand() * 3, 0, 1.5 * s, 0.6 * s, 1.3 * s));
  b.add(G.cone5, mats.riftStone, xf(x, y - 0.75 * s, z, Math.PI, rand() * 3, 0, 1.1 * s, 1.3 * s, 1.0 * s));
  if (rand() < 0.6) b.add(G.octa, rand() < 0.5 ? mats.crystalCyan : mats.crystalViolet, xf(x + 0.2 * s, y + 0.45 * s, z, 0.2, 0, 0.1, 0.25 * s, 0.9 * s, 0.25 * s));
}

/** Broken arcane pillar with a ring of runes still orbiting its top. */
export function arcanePillar(b: StaticBatch, mats: Mats, x: number, z: number, h: number, rand: Rand) {
  b.add(G.box, mats.riftStone, xf(x, 0.15, z, 0, 0, 0, 1.3, 0.3, 1.3));
  b.add(G.cyl6, mats.riftStone, xf(x, h / 2, z, 0, rand(), 0, 0.85, h, 0.85));
  b.add(G.cyl6, mats.riftStone, xf(x + 0.2, h + 1.5, z, 0.4, rand(), 0.3, 0.85, 0.6, 0.85)); // floating broken top
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(G.box, mats.riftRune, xf(x + Math.cos(a) * 0.95, h + 0.7, z + Math.sin(a) * 0.95, 0, -a, 0, 0.08, 0.3, 0.3));
  }
}

// ==================================================================
// Citadel: scorched infernal wastes
// ==================================================================

/** Iron gibbet cage hanging from a post. */
export function gibbet(p: DecorPlacer, mats: Mats, x: number, z: number, ry: number) {
  const b = p.at(x, z, 1.2);
  if (!b) return;
  const base = xf(x, 0, z, 0, ry, 0);
  b.add(G.cyl6, mats.charBark, at(base, xf(0, 2.0, 0, 0, 0, 0, 0.24, 4.0, 0.24)));
  b.add(G.box, mats.charBark, at(base, xf(0.75, 3.85, 0, 0, 0, 0, 1.7, 0.18, 0.18)));
  b.strut(G.cyl6, mats.charBark, base, v(0, 3.0, 0), v(0.7, 3.8, 0), 0.1);
  b.add(G.box, mats.iron, at(base, xf(1.4, 3.45, 0, 0, 0, 0, 0.04, 0.75, 0.04)));
  const cy = 2.4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(G.box, mats.iron, at(base, xf(1.4 + Math.cos(a) * 0.38, cy, Math.sin(a) * 0.38, 0, 0, 0, 0.04, 1.3, 0.04)));
  }
  [cy - 0.65, cy + 0.65].forEach(y => b.add(G.cyl8, mats.iron, at(base, xf(1.4, y, 0, 0, 0, 0, 0.85, 0.05, 0.85))));
  skull(b, mats.bone, at(base, xf(1.4, cy - 0.45, 0, 0.3, 0.5, 0)));
}

/** Tattered war banner on a scorched pole. */
export function burntBanner(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand) {
  const base = xf(x, 0, z, (rand() - 0.5) * 0.15, rand() * Math.PI, (rand() - 0.5) * 0.15);
  b.add(G.cyl6, mats.charBark, at(base, xf(0, 1.7, 0, 0, 0, 0, 0.1, 3.4, 0.1)));
  b.add(G.box, mats.charBark, at(base, xf(0, 3.15, 0, 0, 0, 0, 1.3, 0.06, 0.06)));
  [-0.42, 0, 0.42].forEach(bx => {
    const len = 0.9 + rand() * 0.9;
    b.add(G.box, mats.bannerRed, at(base, xf(bx, 3.12 - len / 2, 0, 0, 0, (rand() - 0.5) * 0.08, 0.38, len, 0.03)));
  });
}

export function skullPile(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand) {
  const layers: [number, number, number][] = [[5, 0.38, 0.13], [3, 0.2, 0.36], [1, 0, 0.56]];
  for (const [n, r, y] of layers) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand();
      skull(b, mats.bone, xf(x + Math.cos(a) * r, y, z + Math.sin(a) * r, (rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4));
    }
  }
}

/** Cluster of hexagonal basalt columns. */
export function basaltColumns(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand) {
  const y = groundHeight(x, z);
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = i === 6 ? 0 : 1.25;
    const h = 1.2 + rand() * 2.8;
    b.add(G.cyl6, mats.basalt, xf(x + Math.cos(a) * r, y + h / 2, z + Math.sin(a) * r, 0, 0, 0, 1.25, h, 1.25));
  }
}

/** Stepped altar with great horns and a hellfire orb, ringed by obsidian spikes. */
export function sacrificialAltar(p: DecorPlacer, mats: Mats, cx: number, cz: number, rand: Rand) {
  const b = p.at(cx, cz, 5);
  if (!b) return;
  b.add(G.box, mats.basalt, xf(cx, 0.2, cz, 0, 0.3, 0, 5, 0.4, 5));
  b.add(G.box, mats.basalt, xf(cx, 0.6, cz, 0, 0.3, 0, 3.6, 0.4, 3.6));
  b.add(G.box, mats.obsidian, xf(cx, 1.15, cz, 0, 0.3, 0, 2.2, 0.7, 1.2));
  const base = xf(cx, 0, cz, 0, 0.3, 0);
  [-1, 1].forEach(side => b.strut(G.cone4, mats.bone, base, v(side * 0.9, 1.45, 0), v(side * 1.7, 3.2, 0.3), 0.35));
  b.add(G.sphere, mats.hellfire, xf(cx, 2.0, cz, 0, 0, 0, 0.55, 0.65, 0.55));
  skull(b, mats.bone, at(base, xf(0.6, 1.62, 0.2, 0, 0.4, 0)));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    obsidianSpike(b, mats.obsidian, cx + Math.cos(a) * 4.4, cz + Math.sin(a) * 4.4, rand);
  }
}
