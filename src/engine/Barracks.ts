import * as THREE from 'three';
import { G, StaticBatch, at, seededRandom, xf } from './scenery/Terrain';

/**
 * The war camp recruits march out of at the start of the maze: a log palisade on a raised earth
 * yard with a timber gatehouse, a longhouse barracks, a watchtower flying the team flag, tents,
 * training dummies, a spear rack and a campfire. Built in local space facing +X (the gate opens
 * onto the first road tile) and batched into a handful of draw calls.
 */

export interface BarracksPalette {
  /** Roofs and gate-tower caps in the team colour. */
  roof: number;
  /** Banners and flags. */
  banner: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Yard surface height (the earth platform covers the maze island's stone trim). */
const YARD = 0.44;
/** Front palisade line; the first build plots start just past it. */
const FRONT = 0.85;
const BACK = -3.4;
const SIDE = 3.7;
const GATE_HALF = 0.95;

export function buildBarracks(palette: BarracksPalette): THREE.Group {
  const group = new THREE.Group();
  const b = new StaticBatch();
  const rand = seededRandom(41);

  const flat = (color: number, roughness = 0.88, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  const glow = (color: number, emissive: number, intensity: number) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.5 });
  const m = {
    earth: flat(0x5a4630, 1),
    log: flat(0x80593a),
    darkWood: flat(0x4e3522),
    plank: flat(0x946c44),
    stone: flat(0x55493f, 0.8),
    canvas: flat(0xd2c4a2, 0.95),
    straw: flat(0xb89a5a, 0.95),
    iron: flat(0x2a2e36, 0.4, 0.7),
    gold: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 }),
    roof: flat(palette.roof, 0.7, 0.15),
    banner: new THREE.MeshStandardMaterial({ color: palette.banner, roughness: 0.6, side: THREE.DoubleSide }),
    fire: glow(0xffb060, 0xff6a1a, 2.6),
    window: glow(0xffedd5, 0xf59e0b, 0.95)
  };

  // 1. Raised earth yard with a timber ramp down to the road
  b.add(G.box, m.earth, xf((FRONT + 0.2 + BACK - 0.2) / 2, YARD / 2, 0, 0, 0, 0, FRONT - BACK + 0.4, YARD, SIDE * 2 + 0.4));
  b.add(G.box, m.plank, xf(FRONT + 0.55, 0.3, 0, 0, 0, -0.28, 1.15, 0.1, GATE_HALF * 2 - 0.1));
  for (let i = 0; i < 4; i++) {
    b.add(G.box, m.darkWood, xf(FRONT + 0.2 + i * 0.26, 0.4 - i * 0.075, 0, 0, 0, -0.28, 0.06, 0.04, GATE_HALF * 2));
  }

  // 2. Palisade of sharpened logs (gap in the front wall for the gate)
  const stake = (x: number, z: number) => {
    const h = 1.5 + rand() * 0.45;
    const lean = (rand() - 0.5) * 0.06;
    b.add(G.cyl6, m.log, xf(x, YARD + h / 2, z, lean, rand() * 3, lean, 0.32, h, 0.32));
    b.add(G.cone5, m.log, xf(x, YARD + h + 0.17, z, lean, rand() * 3, lean, 0.32, 0.34, 0.32));
  };
  const step = 0.32;
  for (let z = -SIDE; z <= SIDE + 0.01; z += step) {
    stake(BACK, z);
    if (Math.abs(z) > GATE_HALF + 0.3) stake(FRONT, z);
  }
  for (let x = BACK + step; x < FRONT - 0.1; x += step) {
    stake(x, -SIDE);
    stake(x, SIDE);
  }
  // Horizontal binding rails on the inside
  [-SIDE + 0.18, SIDE - 0.18].forEach(z => b.add(G.box, m.darkWood, xf((FRONT + BACK) / 2, YARD + 1.0, z, 0, 0, 0, FRONT - BACK, 0.08, 0.06)));
  b.add(G.box, m.darkWood, xf(BACK + 0.18, YARD + 1.0, 0, 0, 0, 0, 0.06, 0.08, SIDE * 2));

  // 3. Gatehouse: two small timber towers, a lintel with the team banner, doors swung inward
  [-1, 1].forEach(side => {
    const tz = side * (GATE_HALF + 0.35);
    const base = xf(FRONT - 0.05, YARD, tz);
    [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].forEach(([px, pz]) =>
      b.add(G.cyl6, m.log, at(base, xf(px, 1.7, pz, 0, 0, 0, 0.2, 3.4, 0.2))));
    b.add(G.box, m.plank, at(base, xf(0, 2.75, 0, 0, 0, 0, 0.8, 0.1, 0.8)));
    b.add(G.box, m.darkWood, at(base, xf(0, 3.05, 0, 0, 0, 0, 0.82, 0.5, 0.82))); // breastwork
    b.add(G.cone4, m.roof, at(base, xf(0, 3.75, 0, 0, Math.PI / 4, 0, 1.25, 0.9, 1.25)));
    b.strut(G.cyl6, m.darkWood, base, v(-0.25, 0.4, -0.25), v(0.25, 2.6, 0.25), 0.08);
    // Torch on the gate-facing post
    b.add(G.box, m.iron, at(base, xf(0.38, 1.9, -side * 0.28, 0, 0, 0, 0.18, 0.06, 0.06)));
    b.add(G.cone5, m.fire, at(base, xf(0.46, 2.05, -side * 0.28, 0, 0, 0, 0.14, 0.28, 0.14)));
    // Inward-swung gate leaf
    b.add(G.box, m.plank, xf(FRONT - 0.5, YARD + 0.95, side * (GATE_HALF - 0.05), 0, 0, 0, 0.95, 1.9, 0.1));
  });
  b.add(G.box, m.darkWood, xf(FRONT, YARD + 2.45, 0, 0, 0, 0, 0.28, 0.3, (GATE_HALF + 0.6) * 2));
  b.add(G.box, m.banner, xf(FRONT + 0.16, YARD + 1.75, 0, 0, 0, 0, 0.04, 1.1, 0.85));
  b.add(G.box, m.gold, xf(FRONT + 0.18, YARD + 1.25, 0, 0, 0, 0, 0.05, 0.1, 0.87));
  b.add(G.box, m.gold, xf(FRONT + 0.19, YARD + 1.9, 0, 0, 0, 0, 0.05, 0.36, 0.3)); // crest

  // 4. Longhouse barracks with a gabled roof in the team colour
  const lx = -2.3, lz = -0.2, lw = 1.8, ll = 4.2, wallH = 1.9;
  b.add(G.box, m.stone, xf(lx, YARD + 0.12, lz, 0, 0, 0, lw + 0.2, 0.24, ll + 0.2));
  b.add(G.box, m.plank, xf(lx, YARD + 0.24 + wallH / 2, lz, 0, 0, 0, lw, wallH, ll));
  const eaves = YARD + 0.24 + wallH;
  b.add(G.prism, m.roof, xf(lx, eaves + 0.25 * 1.73, lz, -Math.PI / 2, 0, 0, (lw + 0.6) / 0.866, ll + 0.5, 1.73));
  for (let k = -1; k <= 1; k++) b.add(G.box, m.darkWood, xf(lx + lw / 2 + 0.01, YARD + 0.24 + wallH / 2, lz + k * 1.6, 0, 0, 0, 0.06, wallH, 0.14));
  b.add(G.box, m.darkWood, xf(lx + lw / 2 + 0.03, YARD + 0.85, lz, 0, 0, 0, 0.06, 1.25, 0.75)); // door
  [-1.3, 1.25].forEach(dz => b.add(G.box, m.window, xf(lx + lw / 2 + 0.03, YARD + 1.4, lz + dz, 0, 0, 0, 0.05, 0.4, 0.35)));
  b.add(G.box, m.stone, xf(lx - 0.35, eaves + 0.9, lz - 1.5, 0, 0, 0, 0.42, 1.6, 0.42)); // chimney
  b.add(G.box, m.fire, xf(lx - 0.35, eaves + 1.72, lz - 1.5, 0, 0, 0, 0.3, 0.04, 0.3));

  // 5. Watchtower in the back corner, flying the team flag
  {
    const base = xf(-2.85, YARD, -3.05);
    const h = 6.0;
    [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].forEach(([px, pz]) =>
      b.strut(G.cyl6, m.log, base, v(px * 1.15, 0, pz * 1.15), v(px, h + 0.6, pz), 0.2));
    [1.4, 3.0].forEach(y => {
      b.strut(G.cyl6, m.darkWood, base, v(-0.4, y, -0.4), v(0.4, y + 1.3, -0.4), 0.07);
      b.strut(G.cyl6, m.darkWood, base, v(-0.4, y, 0.4), v(0.4, y + 1.3, 0.4), 0.07);
      b.strut(G.cyl6, m.darkWood, base, v(-0.4, y + 1.3, -0.4), v(-0.4, y, 0.4), 0.07);
    });
    b.add(G.box, m.plank, at(base, xf(0, h, 0, 0, 0, 0, 1.2, 0.12, 1.2)));
    b.add(G.box, m.darkWood, at(base, xf(0, h + 0.3, 0, 0, 0, 0, 1.15, 0.45, 1.15)));
    b.add(G.cone4, m.roof, at(base, xf(0, h + 1.55, 0, 0, Math.PI / 4, 0, 1.75, 1.2, 1.75)));
    b.add(G.cone5, m.fire, at(base, xf(0, h + 0.75, 0, 0, 0, 0, 0.5, 0.6, 0.5))); // signal fire
    b.add(G.cyl6, m.iron, at(base, xf(0, h + 2.75, 0, 0, 0, 0, 0.05, 1.5, 0.05)));
    const flag = new THREE.BufferGeometry();
    flag.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.55, 0, 1.3, 0.28, 0.12, 0, 0, 0], 3));
    flag.computeVertexNormals();
    b.add(flag, m.banner, at(base, xf(0, h + 2.85, 0, 0, 0, 0, 1.3)));
  }

  // 6. Tents with a stripe in the team colour
  [[-0.95, 2.75, 1.0], [0.15, 2.85, 0.95]].forEach(([tx, tz, w]) => {
    b.add(G.prism, m.canvas, xf(tx, YARD + 0.25 * 1.4, tz, -Math.PI / 2, 0, 0, w / 0.866, 1.5, 1.4));
    b.add(G.box, m.banner, xf(tx, YARD + 1.08, tz, 0, 0, 0, 0.08, 0.05, 1.52));
    b.add(G.box, m.darkWood, xf(tx, YARD + 0.5, tz + 0.78, 0, 0, 0, 0.3, 0.9, 0.03)); // open flap shadow
  });

  // 7. Training dummies
  [[0.15, -2.35, 0.3], [-0.7, -2.95, -0.4]].forEach(([dx, dz, ry]) => {
    const base = xf(dx, YARD, dz, 0, ry, 0);
    b.add(G.cyl6, m.darkWood, at(base, xf(0, 0.7, 0, 0, 0, 0, 0.12, 1.4, 0.12)));
    b.add(G.cyl8, m.straw, at(base, xf(0, 0.95, 0, 0, 0, 0, 0.42, 0.6, 0.42)));
    b.add(G.box, m.darkWood, at(base, xf(0, 1.15, 0, 0, 0, 0, 0.07, 0.07, 0.9)));
    b.add(G.sphere, m.straw, at(base, xf(0, 1.45, 0, 0, 0, 0, 0.34, 0.34, 0.34)));
  });

  // 8. Spear rack against the longhouse
  {
    const base = xf(-1.15, YARD, -1.75);
    [-0.45, 0.45].forEach(z => b.add(G.cyl6, m.darkWood, at(base, xf(0, 0.55, z, 0, 0, 0, 0.1, 1.1, 0.1))));
    b.add(G.box, m.darkWood, at(base, xf(0, 1.0, 0, 0, 0, 0, 0.08, 0.08, 1.0)));
    for (let i = 0; i < 4; i++) {
      const z = -0.33 + i * 0.22;
      b.strut(G.cyl6, m.darkWood, base, v(0.12, 0, z), v(-0.05, 1.7, z), 0.05);
      b.add(G.cone4, m.iron, at(base, xf(-0.06, 1.82, z, 0, 0, 0.1, 0.07, 0.24, 0.07)));
    }
  }

  // 9. Campfire ringed with stones
  {
    const cx = -0.35, cz = 0.35;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.add(G.rock, m.stone, xf(cx + Math.cos(a) * 0.42, YARD + 0.06, cz + Math.sin(a) * 0.42, a, a, 0, 0.24, 0.16, 0.2));
    }
    [0, 1.1, 2.2].forEach(a => b.strut(G.cyl6, m.darkWood, xf(cx, YARD, cz), v(Math.cos(a) * 0.32, 0.03, Math.sin(a) * 0.32), v(0, 0.3, 0), 0.08));
    b.add(G.cone5, m.fire, xf(cx, YARD + 0.32, cz, 0, 0, 0, 0.36, 0.55, 0.36));
    // Log benches
    [[cx + 0.15, cz + 0.95, 0.2], [cx - 0.1, cz - 0.95, -0.15]].forEach(([x, z, ry]) =>
      b.add(G.cyl6, m.log, xf(x, YARD + 0.12, z, 0, ry, Math.PI / 2, 0.26, 0.95, 0.26)));
  }

  // 10. Supplies
  [[-1.15, 1.35], [-1.12, 1.78], [-0.75, 1.55]].forEach(([x, z]) => b.add(G.cyl8, m.plank, xf(x, YARD + 0.3, z, 0, 0, 0, 0.42, 0.6, 0.42)));
  [[-3.0, 2.95, 0.2], [-2.55, 3.1, -0.3]].forEach(([x, z, ry]) => b.add(G.box, m.plank, xf(x, YARD + 0.25, z, 0, ry, 0, 0.5, 0.5, 0.5)));

  b.build(group);
  return group;
}
