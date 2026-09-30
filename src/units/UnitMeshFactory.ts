/**
 * UnitMeshFactory: stylized, faceted low-poly dark-fantasy unit models.
 *
 * Models are built at a normalized size (a humanoid is ~1 unit tall, feet at y = 0, facing +Z)
 * and scaled as a whole. Each builder records the top of the head in `userData.headTop` so the
 * HP bar can sit just above it. Children named 'floating' / 'rotating' are animated by UnitManager.
 */
import * as THREE from 'three';
import { FriendlyClass, EnemyClass, isFriendlyClass } from './UnitData';

/** Extra on-screen size so units read well from the tactical camera (gameplay radius is unchanged). */
const VISUAL_SCALE = 1.3;

// ─── MATERIAL & PRIMITIVE KIT ───────────────────────────────

interface MatOpts {
  emissive?: number;
  glow?: number;
  metal?: number;
  rough?: number;
  smooth?: boolean;
  opacity?: number;
}

function mat(color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissive !== undefined ? (o.glow ?? 1.5) : 0,
    metalness: o.metal ?? 0.1,
    roughness: o.rough ?? 0.75,
    flatShading: !o.smooth,
    transparent: o.opacity !== undefined,
    opacity: o.opacity ?? 1
  });
}

/** Emissive-only material for eyes, runes, embers and spell cores (always blooms). */
function glowMat(color: number, strength: number = 2.6): THREE.MeshStandardMaterial {
  return mat(color, { emissive: color, glow: strength, rough: 0.4 });
}

function add(
  parent: THREE.Object3D,
  geom: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 7) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r: number, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const oct = (r: number) => new THREE.OctahedronGeometry(r, 0);
const torus = (r: number, t: number, rs = 5, ts = 12, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);

// ─── PALETTE ────────────────────────────────────────────────

const P = {
  skin: 0xd9a57e,
  skinDark: 0x9c6b4e,
  leather: 0x4a3222,
  leatherDark: 0x2e1f16,
  wood: 0x5a3d26,
  cloth: 0x6b6358,
  steel: 0x8a8f99,
  steelDark: 0x4a4e57,
  iron: 0x2f3138,
  gold: 0xc9973a,
  sunBlue: 0x24407a,
  sunBlueDark: 0x172a52,
  white: 0xd8d2c4,
  goblin: 0x5d7a3a,
  orc: 0x4f6b3a,
  bone: 0xd6cdb4,
  shadow: 0x1a1522,
  obsidian: 0x1a1214
};

// ─── BODY BUILDER ───────────────────────────────────────────

type TorsoKind = 'cloth' | 'plate' | 'robe' | 'bare' | 'mail';

interface BodySpec {
  skin: number;
  torso: number;
  torsoKind: TorsoKind;
  legs?: number;
  boots?: number;
  sleeves?: number;
  belt?: number;
  bulk?: number; // horizontal girth
  height?: number; // vertical stretch
  pauldrons?: number;
  hunch?: number; // forward lean of the upper body (radians)
}

interface Body {
  root: THREE.Group;
  upper: THREE.Group; // torso, arms & head pivot at the hips (so hunched builds lean together)
  rightHand: THREE.Vector3;
  leftHand: THREE.Vector3;
  headY: number;
  headR: number;
  shoulderY: number;
  chestZ: number;
  backZ: number;
}

function buildBody(spec: BodySpec): Body {
  const bulk = spec.bulk ?? 1;
  const h = spec.height ?? 1;
  const root = new THREE.Group();

  const legMat = mat(spec.legs ?? P.leatherDark);
  const bootMat = mat(spec.boots ?? P.leatherDark, { rough: 0.8 });
  const hipY = 0.42 * h;

  if (spec.torsoKind === 'robe') {
    // Flowing floor-length robe instead of legs
    add(root, cyl(0.15 * bulk, 0.27 * bulk, 0.46 * h, 8), mat(spec.torso), 0, 0.23 * h, 0);
    add(root, cyl(0.28 * bulk, 0.3 * bulk, 0.04, 8), mat(spec.belt ?? spec.torso, { rough: 0.9 }), 0, 0.02, 0);
  } else {
    [-1, 1].forEach(side => {
      add(root, box(0.12 * bulk, 0.09, 0.19), bootMat, side * 0.085 * bulk, 0.045, 0.025);
      add(root, cyl(0.055 * bulk, 0.047 * bulk, 0.18 * h, 6), bootMat, side * 0.085 * bulk, 0.16 * h, 0);
      add(root, cyl(0.062 * bulk, 0.056 * bulk, 0.2 * h, 6), legMat, side * 0.085 * bulk, 0.32 * h, 0);
    });
  }

  const upper = new THREE.Group();
  upper.position.y = hipY;
  upper.rotation.x = spec.hunch ?? 0;
  root.add(upper);

  const torsoMat = mat(spec.torso, spec.torsoKind === 'plate' ? { metal: 0.65, rough: 0.35 } : spec.torsoKind === 'mail' ? { metal: 0.5, rough: 0.5 } : {});
  const chestH = 0.36 * h;
  const chestY = chestH / 2 + 0.02;

  // Hips / belt
  add(upper, box(0.3 * bulk, 0.09, 0.19 * bulk), mat(spec.belt ?? P.leather, { rough: 0.85 }), 0, 0, 0);
  if (spec.belt !== undefined || spec.torsoKind !== 'robe') {
    add(upper, box(0.07, 0.06, 0.02), mat(P.gold, { metal: 0.8, rough: 0.3 }), 0, 0.0, 0.1 * bulk);
  }

  // Torso: tapered barrel, broader at the chest
  add(upper, cyl(0.19 * bulk, 0.15 * bulk, chestH, 7), torsoMat, 0, chestY, 0);
  if (spec.torsoKind === 'plate') {
    add(upper, box(0.26 * bulk, 0.2 * h, 0.06), mat(spec.torso, { metal: 0.75, rough: 0.28 }), 0, chestY + 0.05, 0.14 * bulk, -0.12);
  }
  if (spec.torsoKind === 'bare') {
    // Pectoral definition
    [-1, 1].forEach(side => add(upper, sph(0.075 * bulk, 6, 4), mat(spec.skin), side * 0.07 * bulk, chestY + 0.07, 0.12 * bulk));
  }

  const shoulderY = chestH + 0.02;
  const shoulderX = 0.2 * bulk;

  // Pauldrons
  if (spec.pauldrons !== undefined) {
    [-1, 1].forEach(side => {
      add(upper, sph(0.1 * bulk, 7, 5, ), mat(spec.pauldrons!, { metal: 0.7, rough: 0.3 }), side * shoulderX, shoulderY - 0.01, 0, 0, 0, side * -0.3);
    });
  }

  // Arms: upper arm hangs, forearm angles forward to the hands
  const sleeveMat = mat(spec.sleeves ?? spec.torso, spec.torsoKind === 'plate' ? { metal: 0.6, rough: 0.35 } : {});
  const handMat = mat(spec.skin);
  [-1, 1].forEach(side => {
    add(upper, cyl(0.05 * bulk, 0.045 * bulk, 0.2 * h, 6), side === 1 && spec.torsoKind === 'bare' ? handMat : sleeveMat,
      side * (shoulderX + 0.02), shoulderY - 0.12 * h, 0.01, 0, 0, side * 0.12);
    add(upper, cyl(0.045 * bulk, 0.04 * bulk, 0.18 * h, 6), spec.torsoKind === 'bare' ? handMat : sleeveMat,
      side * (shoulderX + 0.04), shoulderY - 0.27 * h, 0.07, -0.75, 0, 0);
    add(upper, sph(0.05 * bulk, 6, 5), handMat, side * (shoulderX + 0.04), shoulderY - 0.33 * h, 0.14);
  });

  // Neck & head
  const headR = 0.115;
  const headY = shoulderY + 0.05 + headR;
  add(upper, cyl(0.05, 0.06, 0.08, 6), mat(spec.skin), 0, shoulderY + 0.03, 0);
  add(upper, sph(headR, 8, 7), mat(spec.skin), 0, headY, 0.01);

  // Hand anchors in root space (upper is rotated/lifted)
  const toRoot = (v: THREE.Vector3) => {
    upper.updateMatrix();
    return v.applyMatrix4(upper.matrix);
  };
  const rightHand = toRoot(new THREE.Vector3(shoulderX + 0.04, shoulderY - 0.33 * h, 0.14));
  const leftHand = toRoot(new THREE.Vector3(-(shoulderX + 0.04), shoulderY - 0.33 * h, 0.14));
  const headWorld = toRoot(new THREE.Vector3(0, headY, 0));

  root.userData.headTop = headWorld.y + headR;
  return {
    root,
    upper,
    rightHand,
    leftHand,
    headY,
    headR,
    shoulderY,
    chestZ: 0.17 * bulk,
    backZ: -0.17 * bulk
  };
}

// ─── HEADGEAR ──────────────────────────────────────────────

function eyes(b: Body, color: number, spread = 0.045, y = 0.015, size = 0.022) {
  const m = glowMat(color, 3.2);
  [-1, 1].forEach(side => add(b.upper, sph(size, 5, 4), m, side * spread, b.headY + y, b.headR * 0.95 + 0.03));
}

function hood(b: Body, color: number, deep = true) {
  const m = mat(color, { rough: 0.9 });
  // Cowl drapes behind & above the head, leaving the face open
  add(b.upper, cone(b.headR * 1.35, 0.3, 7), m, 0, b.headY + 0.1, -0.05, -0.35);
  add(b.upper, cyl(b.headR * 1.25, b.headR * 1.55, 0.2, 7, ), m, 0, b.headY - 0.02, -0.045);
  add(b.upper, torus(b.headR * 1.1, 0.03, 4, 10), m, 0, b.headY, 0.03);
  if (deep) {
    // Shadowed face under the cowl
    add(b.upper, sph(b.headR * 0.95, 7, 5), mat(0x07050a, { rough: 1 }), 0, b.headY - 0.005, 0.02);
  }
  b.root.userData.headTop += 0.12;
}

function kettleHelm(b: Body, color: number) {
  const m = mat(color, { metal: 0.7, rough: 0.35 });
  add(b.upper, sph(b.headR * 1.1, 8, 5, ), m, 0, b.headY + 0.03, 0);
  add(b.upper, cyl(b.headR * 1.9, b.headR * 1.9, 0.02, 10), m, 0, b.headY + 0.01, 0);
  b.root.userData.headTop += 0.04;
}

function greatHelm(b: Body, color: number, plume?: number) {
  const m = mat(color, { metal: 0.75, rough: 0.3 });
  add(b.upper, cyl(b.headR * 1.12, b.headR * 1.12, b.headR * 2.2, 8), m, 0, b.headY + 0.01, 0);
  add(b.upper, cone(b.headR * 1.12, 0.07, 8), m, 0, b.headY + b.headR * 1.1 + 0.035, 0);
  add(b.upper, box(b.headR * 1.5, 0.018, 0.02), mat(0x050505), 0, b.headY + 0.015, b.headR * 1.1);
  add(b.upper, box(0.018, b.headR * 1.1, 0.02), mat(0x050505), 0, b.headY - 0.03, b.headR * 1.1);
  if (plume !== undefined) {
    add(b.upper, box(0.03, 0.12, 0.22), mat(plume, { rough: 0.9 }), 0, b.headY + b.headR * 1.3 + 0.08, -0.04, 0.3);
    b.root.userData.headTop += 0.1;
  }
  b.root.userData.headTop += 0.08;
}

function hornedHelm(b: Body, color: number, hornColor: number) {
  add(b.upper, new THREE.SphereGeometry(b.headR * 1.08, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { metal: 0.6, rough: 0.4 }), 0, b.headY + 0.01, 0);
  const hm = mat(hornColor, { rough: 0.5 });
  [-1, 1].forEach(side => add(b.upper, cone(0.035, 0.22, 5), hm, side * 0.14, b.headY + 0.1, 0, 0, 0, side * -0.9));
  b.root.userData.headTop += 0.06;
}

function wizardHat(b: Body, color: number, band: number) {
  const m = mat(color, { rough: 0.85 });
  add(b.upper, cyl(b.headR * 2.3, b.headR * 2.3, 0.02, 10), m, 0, b.headY + 0.06, 0);
  add(b.upper, cone(b.headR * 1.2, 0.42, 8), m, 0, b.headY + 0.27, -0.03, -0.18);
  add(b.upper, cyl(b.headR * 1.22, b.headR * 1.22, 0.035, 8), mat(band, { emissive: band, glow: 1.2 }), 0, b.headY + 0.09, 0);
  b.root.userData.headTop += 0.18;
}

function cape(b: Body, color: number, length = 0.6, width = 0.36) {
  const m = mat(color, { rough: 0.9 });
  m.side = THREE.DoubleSide;
  add(b.upper, box(width, length, 0.025), m, 0, b.shoulderY - length / 2 + 0.02, b.backZ - 0.02, 0.12);
}

// ─── WEAPONS & SHIELDS (placed at a hand anchor) ───────────

function sword(parent: THREE.Object3D, at: THREE.Vector3, len = 0.5, blade = P.steel, glow?: number) {
  const g = new THREE.Group();
  g.position.copy(at);
  g.rotation.x = -0.35;
  add(g, box(0.035, 0.1, 0.035), mat(P.leatherDark), 0, 0.0, 0);
  add(g, box(0.16, 0.025, 0.04), mat(P.gold, { metal: 0.8, rough: 0.3 }), 0, 0.06, 0);
  const bladeMat = glow !== undefined ? mat(blade, { emissive: glow, glow: 1.6, metal: 0.8, rough: 0.2 }) : mat(blade, { metal: 0.9, rough: 0.2 });
  add(g, box(0.055, len, 0.015), bladeMat, 0, 0.07 + len / 2, 0);
  add(g, cone(0.039, 0.07, 4), bladeMat, 0, 0.07 + len + 0.035, 0, 0, Math.PI / 4);
  parent.add(g);
  return g;
}

function spear(parent: THREE.Object3D, at: THREE.Vector3, len = 1.2) {
  const g = new THREE.Group();
  g.position.copy(at);
  add(g, cyl(0.016, 0.016, len, 5), mat(P.wood), 0, len * 0.3, 0);
  add(g, cone(0.04, 0.17, 4), mat(P.steel, { metal: 0.85, rough: 0.25 }), 0, len * 0.8 + 0.08, 0);
  parent.add(g);
  return g;
}

function axe(parent: THREE.Object3D, at: THREE.Vector3, size = 1, head = P.steelDark) {
  const g = new THREE.Group();
  g.position.copy(at);
  g.rotation.x = -0.3;
  add(g, cyl(0.02 * size, 0.022 * size, 0.55 * size, 5), mat(P.wood), 0, 0.15 * size, 0);
  const hm = mat(head, { metal: 0.8, rough: 0.3 });
  add(g, box(0.02 * size, 0.18 * size, 0.2 * size), hm, 0, 0.36 * size, 0.09 * size);
  add(g, cyl(0.1 * size, 0.1 * size, 0.02 * size, 6, ), hm, 0, 0.36 * size, 0.17 * size, 0, 0, Math.PI / 2);
  parent.add(g);
  return g;
}

function hammer(parent: THREE.Object3D, at: THREE.Vector3, head: number, glow?: number) {
  const g = new THREE.Group();
  g.position.copy(at);
  g.rotation.x = -0.3;
  add(g, cyl(0.02, 0.02, 0.6, 5), mat(P.wood), 0, 0.15, 0);
  add(g, box(0.22, 0.12, 0.12), glow !== undefined ? mat(head, { emissive: glow, glow: 1.4, metal: 0.8 }) : mat(head, { metal: 0.8, rough: 0.3 }), 0, 0.46, 0);
  parent.add(g);
  return g;
}

function staff(parent: THREE.Object3D, at: THREE.Vector3, orbColor: number, len = 1.15, floating = true) {
  const g = new THREE.Group();
  g.position.copy(at);
  add(g, cyl(0.018, 0.024, len, 6), mat(P.wood, { rough: 0.9 }), 0, len * 0.3, 0);
  add(g, torus(0.07, 0.014, 4, 10), mat(P.gold, { metal: 0.8, rough: 0.3 }), 0, len * 0.8 + 0.02, 0);
  const orb = add(g, ico(0.07), glowMat(orbColor, 3.0), 0, len * 0.8 + 0.1, 0);
  if (floating) orb.name = 'floating';
  parent.add(g);
  return g;
}

function bow(parent: THREE.Object3D, at: THREE.Vector3, wood = P.wood, string = 0xe7e0cf, glow?: number) {
  const g = new THREE.Group();
  g.position.copy(at);
  g.rotation.set(0, Math.PI / 2, 0.15);
  add(g, torus(0.36, 0.018, 4, 12, Math.PI * 0.9), glow !== undefined ? mat(wood, { emissive: glow, glow: 1.2 }) : mat(wood), 0, 0.12, 0, 0, 0, Math.PI * 0.55);
  add(g, box(0.006, 0.7, 0.006), mat(string, { rough: 0.5 }), -0.06, 0.12, 0);
  parent.add(g);
  return g;
}

function dagger(parent: THREE.Object3D, at: THREE.Vector3, blade = P.steel, glow?: number) {
  const g = new THREE.Group();
  g.position.copy(at);
  g.rotation.x = -0.6;
  add(g, box(0.03, 0.07, 0.03), mat(P.leatherDark), 0, 0, 0);
  add(g, cone(0.035, 0.24, 4), glow !== undefined ? mat(blade, { emissive: glow, glow: 2.2, metal: 0.7 }) : mat(blade, { metal: 0.85, rough: 0.2 }), 0, 0.16, 0);
  parent.add(g);
  return g;
}

type ShieldKind = 'round' | 'kite' | 'tower';

function shield(parent: THREE.Object3D, at: THREE.Vector3, kind: ShieldKind, face: number, rim: number, emblem?: number) {
  const g = new THREE.Group();
  g.position.copy(at).add(new THREE.Vector3(-0.05, 0.02, 0.04));
  g.rotation.y = -0.35;
  const rimMat = mat(rim, { metal: 0.75, rough: 0.35 });
  if (kind === 'round') {
    add(g, cyl(0.17, 0.17, 0.035, 10), mat(face), 0, 0, 0, Math.PI / 2);
    add(g, torus(0.17, 0.018, 4, 14), rimMat, 0, 0, 0.005);
    add(g, sph(0.045, 6, 4), rimMat, 0, 0, 0.03);
  } else {
    const hgt = kind === 'kite' ? 0.42 : 0.62;
    const wid = kind === 'kite' ? 0.28 : 0.36;
    add(g, box(wid, hgt * 0.7, 0.04), mat(face), 0, 0.05, 0);
    const point = add(g, cone(wid * 0.7, hgt * 0.32, 4), mat(face), 0, -hgt * 0.29 - 0.02, 0, Math.PI, Math.PI / 4);
    point.scale.set(1, 1, 0.06);
    add(g, box(wid + 0.03, 0.03, 0.05), rimMat, 0, 0.05 + hgt * 0.35, 0);
    if (emblem !== undefined) {
      add(g, box(0.03, hgt * 0.4, 0.02), mat(emblem, { emissive: emblem, glow: 1.1 }), 0, 0.03, 0.03);
      add(g, box(wid * 0.55, 0.03, 0.02), mat(emblem, { emissive: emblem, glow: 1.1 }), 0, 0.1, 0.03);
    }
  }
  parent.add(g);
  return g;
}

function quiver(b: Body, color: number, fletch: number) {
  const g = new THREE.Group();
  g.position.set(0.08, b.shoulderY - 0.12, b.backZ - 0.04);
  g.rotation.z = -0.4;
  add(g, cyl(0.05, 0.045, 0.34, 6), mat(color), 0, 0, 0);
  for (let i = 0; i < 3; i++) add(g, box(0.035, 0.07, 0.01), mat(fletch), (i - 1) * 0.025, 0.2, 0);
  b.upper.add(g);
}

function finish(root: THREE.Group, extraHeadroom = 0): THREE.Group {
  root.userData.headTop = (root.userData.headTop ?? 1) + extraHeadroom;
  return root;
}

// ─── FRIENDLY UNITS (Sun army: steel, deep blue & gold) ────

function buildRecruit(): THREE.Group {
  const b = buildBody({ skin: P.skin, torso: 0x6f5a43, torsoKind: 'cloth', sleeves: 0x5b4a38, legs: 0x3f352b, boots: P.leatherDark, belt: P.leather });
  hood(b, 0x57534e, false);
  spear(b.root, b.rightHand, 1.15);
  shield(b.root, b.leftHand, 'round', P.wood, P.steelDark);
  return finish(b.root);
}

function buildFootman(): THREE.Group {
  const b = buildBody({ skin: P.skin, torso: P.steelDark, torsoKind: 'mail', sleeves: P.steelDark, legs: 0x2f2a25, boots: P.iron, belt: P.leather, pauldrons: P.steel });
  // Blue tabard over the mail
  add(b.upper, box(0.2, 0.34, 0.02), mat(P.sunBlue), 0, 0.2, b.chestZ + 0.01, -0.05);
  add(b.upper, box(0.05, 0.12, 0.022), mat(P.gold, { metal: 0.6 }), 0, 0.24, b.chestZ + 0.025, -0.05);
  kettleHelm(b, P.steel);
  sword(b.root, b.rightHand, 0.42);
  shield(b.root, b.leftHand, 'kite', P.sunBlue, P.steel, P.gold);
  return finish(b.root);
}

function buildKnight(): THREE.Group {
  const b = buildBody({ skin: P.skin, torso: P.steel, torsoKind: 'plate', legs: P.steelDark, boots: P.iron, belt: P.leatherDark, pauldrons: P.steel, bulk: 1.12 });
  greatHelm(b, P.steel, P.sunBlue);
  cape(b, P.sunBlueDark, 0.62, 0.4);
  sword(b.root, b.rightHand, 0.55);
  shield(b.root, b.leftHand, 'tower', P.sunBlue, P.gold, P.gold);
  return finish(b.root);
}

function buildBerserker(): THREE.Group {
  const b = buildBody({ skin: P.skin, torso: P.skin, torsoKind: 'bare', legs: 0x3a2a1f, boots: P.leatherDark, belt: P.leather, bulk: 1.18 });
  // Fur mantle & glowing war paint
  add(b.upper, torus(0.2, 0.07, 5, 10), mat(0x6b5a45, { rough: 1 }), 0, b.shoulderY - 0.02, -0.02, Math.PI / 2);
  add(b.upper, box(0.04, 0.16, 0.01), glowMat(0xef4444, 1.8), 0, 0.22, b.chestZ + 0.02);
  hornedHelm(b, P.steelDark, P.bone);
  axe(b.root, b.rightHand, 1.05);
  axe(b.root, b.leftHand, 0.95);
  return finish(b.root);
}

function buildCleric(): THREE.Group {
  const b = buildBody({ skin: P.skin, torso: P.white, torsoKind: 'robe', sleeves: P.white, belt: P.gold });
  add(b.upper, box(0.07, 0.34, 0.02), mat(P.gold, { metal: 0.5 }), 0, 0.2, b.chestZ);
  hood(b, 0xbcb3a2, false);
  hammer(b.root, b.rightHand, P.steel);
  // Floating holy sigil
  const sigil = new THREE.Group();
  sigil.position.set(-0.3, b.shoulderY + 0.62, 0.05);
  add(sigil, box(0.04, 0.2, 0.02), glowMat(0xfde68a, 2.8), 0, 0, 0);
  add(sigil, box(0.14, 0.04, 0.02), glowMat(0xfde68a, 2.8), 0, 0.04, 0);
  sigil.name = 'floating';
  b.root.add(sigil);
  return finish(b.root);
}

function buildPaladin(): THREE.Group {
  const b = buildBody({ skin: P.skin, torso: 0xb8a36e, torsoKind: 'plate', legs: P.steel, boots: P.steelDark, belt: P.leatherDark, pauldrons: P.gold, bulk: 1.15 });
  greatHelm(b, 0xb8a36e);
  cape(b, 0xa8a092, 0.66, 0.42);
  hammer(b.root, b.rightHand, P.gold, 0xfde68a);
  shield(b.root, b.leftHand, 'kite', P.white, P.gold, 0xfbbf24);
  const halo = add(b.root, torus(0.15, 0.015, 4, 20), glowMat(0xfde68a, 2.6), 0, b.root.userData.headTop + 0.1, -0.05, Math.PI / 2);
  halo.name = 'rotating';
  return finish(b.root, 0.08);
}

function buildArchmage(): THREE.Group {
  const b = buildBody({ skin: P.skin, torso: 0x2c1f4a, torsoKind: 'robe', sleeves: 0x2c1f4a, belt: P.gold });
  add(b.upper, box(0.06, 0.34, 0.02), glowMat(0xa78bfa, 1.4), 0, 0.2, b.chestZ);
  // Long white beard
  add(b.upper, cone(0.075, 0.22, 5), mat(0xe5e0d6), 0, b.headY - 0.14, 0.08, Math.PI);
  wizardHat(b, 0x2c1f4a, 0xa78bfa);
  staff(b.root, b.rightHand, 0xc084fc, 1.25);
  return finish(b.root);
}

function buildPyroGolem(): THREE.Group {
  // Hulking basalt construct with magma seams
  const g = new THREE.Group();
  const rock = mat(0x2b2422, { rough: 0.95 });
  const magma = glowMat(0xff5a14, 1.5);
  [-1, 1].forEach(side => {
    add(g, box(0.2, 0.34, 0.22), rock, side * 0.15, 0.17, 0);
    add(g, box(0.16, 0.02, 0.18), magma, side * 0.15, 0.3, 0.02);
  });
  add(g, box(0.56, 0.5, 0.36), rock, 0, 0.6, 0);
  add(g, box(0.03, 0.3, 0.02), magma, 0.08, 0.58, 0.18, 0, 0, 0.35);
  add(g, box(0.03, 0.18, 0.02), magma, -0.1, 0.66, 0.18, 0, 0, -0.5);
  add(g, ico(0.07), glowMat(0xffa040, 2.2), 0, 0.66, 0.19).name = 'floating';
  [-1, 1].forEach(side => {
    add(g, ico(0.14), rock, side * 0.36, 0.8, 0);
    add(g, box(0.15, 0.36, 0.15), rock, side * 0.37, 0.55, 0.04, 0.2);
    add(g, ico(0.12), rock, side * 0.37, 0.34, 0.1);
    add(g, box(0.1, 0.02, 0.1), magma, side * 0.37, 0.42, 0.13);
  });
  add(g, box(0.24, 0.2, 0.22), rock, 0, 0.94, 0.03);
  [-1, 1].forEach(side => add(g, sph(0.025, 5, 4), glowMat(0xffb020, 3.5), side * 0.055, 0.96, 0.15));
  g.userData.headTop = 1.06;
  return g;
}

function buildSoldier(): THREE.Group {
  // Champion: blackened plate etched with glowing sun runes
  const b = buildBody({ skin: P.skin, torso: 0x3a3f4d, torsoKind: 'plate', legs: 0x2b2f3a, boots: P.iron, belt: P.leatherDark, pauldrons: 0x3a3f4d, bulk: 1.2 });
  add(b.upper, box(0.03, 0.2, 0.01), glowMat(0x60a5fa, 2.4), 0, 0.22, b.chestZ + 0.05);
  add(b.upper, box(0.14, 0.03, 0.01), glowMat(0x60a5fa, 2.4), 0, 0.27, b.chestZ + 0.05);
  greatHelm(b, 0x3a3f4d, 0x1d4ed8);
  cape(b, P.sunBlueDark, 0.7, 0.44);
  sword(b.root, b.rightHand, 0.62, 0x9fb8e8, 0x3b82f6);
  shield(b.root, b.leftHand, 'tower', 0x1e2a44, 0x8fa2c9, 0x60a5fa);
  const core = add(b.root, oct(0.06), glowMat(0x60a5fa, 3), 0, b.root.userData.headTop + 0.14, 0);
  core.name = 'floating';
  return finish(b.root, 0.1);
}

function buildArcher(): THREE.Group {
  // Champion ranger: dark forest leathers, hooded, glowing bow
  const b = buildBody({ skin: P.skin, torso: 0x2f3d27, torsoKind: 'cloth', sleeves: 0x26321f, legs: 0x2a2219, boots: P.leatherDark, belt: P.leather });
  add(b.upper, box(0.3, 0.05, 0.03), mat(P.leather), 0, 0.22, b.chestZ, 0, 0, 0.6);
  cape(b, 0x1f2b1a, 0.62, 0.36);
  hood(b, 0x1f2b1a);
  eyes(b, 0x6ee7b7, 0.04, 0.0, 0.016);
  quiver(b, P.leather, 0x6ee7b7);
  bow(b.root, b.leftHand, 0x3b2a1a, 0xe7e0cf, 0x10b981);
  const arrow = add(b.root, cone(0.02, 0.1, 4), glowMat(0x34d399, 3), b.leftHand.x, b.leftHand.y + 0.12, b.leftHand.z + 0.15, Math.PI / 2);
  arrow.name = 'floating';
  return finish(b.root);
}

function buildMage(): THREE.Group {
  // Champion battle-mage: ember-crimson robes, flame staff, orbiting sparks
  const b = buildBody({ skin: P.skin, torso: 0x4a1418, torsoKind: 'robe', sleeves: 0x3a0f12, belt: P.gold, pauldrons: 0x1f1a1a });
  add(b.upper, box(0.06, 0.34, 0.02), glowMat(0xf97316, 1.6), 0, 0.2, b.chestZ);
  wizardHat(b, 0x2a0c0f, 0xf97316);
  staff(b.root, b.rightHand, 0xff6a1a, 1.3);
  const sparkA = add(b.root, oct(0.035), glowMat(0xfbbf24, 3), 0.25, b.shoulderY + 0.4, 0.1);
  sparkA.name = 'rotating';
  const sparkB = add(b.root, oct(0.03), glowMat(0xf97316, 3), -0.25, b.shoulderY + 0.3, -0.1);
  sparkB.name = 'rotating';
  const halo = add(b.root, torus(0.3, 0.01, 4, 24), glowMat(0xf97316, 1.8), 0, b.shoulderY + 0.2, 0, Math.PI / 2);
  halo.name = 'rotating';
  return finish(b.root);
}

// ─── ENEMIES (hellish: sickly skin, rusted iron, glowing eyes) ──

function buildGoblin(): THREE.Group {
  const b = buildBody({ skin: P.goblin, torso: 0x4a3a28, torsoKind: 'cloth', sleeves: P.goblin, legs: 0x3a2c20, boots: 0x2a1f16, belt: 0x3a2412, bulk: 0.85, height: 0.78, hunch: 0.35 });
  // Big ears & long nose
  [-1, 1].forEach(side => add(b.upper, cone(0.045, 0.2, 4), mat(P.goblin), side * 0.14, b.headY + 0.03, -0.01, 0, 0, side * -1.35));
  add(b.upper, cone(0.025, 0.09, 4), mat(P.goblin), 0, b.headY - 0.02, b.headR + 0.03, Math.PI / 2);
  eyes(b, 0xfacc15, 0.05, 0.02, 0.02);
  dagger(b.root, b.rightHand, 0x7c5a3a);
  return finish(b.root);
}

function buildOrcWarrior(): THREE.Group {
  const b = buildBody({ skin: 0x6a8a44, torso: 0x5a4030, torsoKind: 'cloth', sleeves: 0x6a8a44, legs: 0x3e2e22, boots: 0x2a1f16, belt: 0x7a4a22, bulk: 1.35, height: 1.05, hunch: 0.18 });
  // Spiked iron pauldron on one shoulder, tusks
  add(b.upper, sph(0.13, 6, 4), mat(0x4a3a30, { metal: 0.6, rough: 0.5 }), -0.3, b.shoulderY, 0);
  [0, 1, 2].forEach(i => add(b.upper, cone(0.025, 0.12, 4), mat(0x9a9387, { metal: 0.6 }), -0.3 + (i - 1) * 0.06, b.shoulderY + 0.12, 0));
  [-1, 1].forEach(side => add(b.upper, cone(0.018, 0.08, 4), mat(P.bone), side * 0.05, b.headY - 0.06, b.headR * 0.9));
  add(b.upper, box(0.22, 0.04, 0.12), mat(0x2a1f18, { rough: 0.9 }), 0, b.headY + 0.1, 0);
  eyes(b, 0xef4444, 0.045, 0.02, 0.02);
  axe(b.root, b.rightHand, 1.35, 0x6b5a4a);
  return finish(b.root);
}

function buildSkeletonArcher(): THREE.Group {
  const g = new THREE.Group();
  const bone = mat(P.bone, { rough: 0.7 });
  [-1, 1].forEach(side => {
    add(g, cyl(0.022, 0.02, 0.4, 5), bone, side * 0.07, 0.2, 0);
    add(g, box(0.07, 0.03, 0.11), bone, side * 0.07, 0.015, 0.03);
  });
  add(g, box(0.2, 0.06, 0.1), bone, 0, 0.42, 0);
  add(g, cyl(0.02, 0.02, 0.2, 5), bone, 0, 0.53, -0.02);
  // Ribcage
  for (let i = 0; i < 4; i++) add(g, torus(0.1 - i * 0.008, 0.014, 4, 10, Math.PI * 1.4), bone, 0, 0.56 + i * 0.05, 0, Math.PI / 2, 0, Math.PI * 0.8);
  // Tattered hood & shoulder rags
  const rag = mat(0x2a2233, { rough: 1 });
  add(g, box(0.34, 0.06, 0.16), rag, 0, 0.78, -0.01);
  add(g, box(0.28, 0.36, 0.02), rag, 0, 0.58, -0.1, 0.1);
  // Skull with ghostly eye sockets
  add(g, sph(0.1, 7, 6), bone, 0, 0.9, 0.01);
  add(g, box(0.1, 0.05, 0.08), bone, 0, 0.83, 0.04);
  [-1, 1].forEach(side => add(g, sph(0.022, 5, 4), glowMat(0x22d3ee, 3.4), side * 0.035, 0.91, 0.09));
  add(g, cone(0.14, 0.24, 7), rag, 0, 0.99, -0.02, -0.2);
  [-1, 1].forEach(side => add(g, cyl(0.018, 0.016, 0.34, 5), bone, side * 0.17, 0.62, 0.06, -0.6, 0, side * 0.15));
  bow(g, new THREE.Vector3(-0.2, 0.52, 0.2), 0x2a2020, 0x9ca3af, 0x0e7490);
  g.userData.headTop = 1.08;
  return g;
}

function buildShadowAssassin(): THREE.Group {
  const b = buildBody({ skin: 0x2a2233, torso: P.shadow, torsoKind: 'cloth', sleeves: P.shadow, legs: 0x120e18, boots: 0x0c0a10, belt: 0x2a1f33, bulk: 0.95, hunch: 0.25 });
  // Ragged wisp cloak
  const cloak = mat(0x140f1c, { rough: 1, opacity: 0.9 });
  cloak.side = THREE.DoubleSide;
  add(b.upper, cone(0.32, 0.7, 7), cloak, 0, 0.12, -0.04, 0.15);
  add(b.upper, torus(0.3, 0.012, 4, 16), glowMat(0x7c3aed, 1.6), 0, -0.2, -0.02, Math.PI / 2 + 0.15);
  hood(b, 0x1c1428);
  eyes(b, 0xc084fc, 0.04, 0.0, 0.018);
  dagger(b.root, b.rightHand, 0x3b2a55, 0xa855f7);
  dagger(b.root, b.leftHand, 0x3b2a55, 0xa855f7);
  return finish(b.root);
}

function buildIroncladOgre(): THREE.Group {
  const b = buildBody({ skin: 0x9a8468, torso: 0x5d5f68, torsoKind: 'plate', sleeves: 0x9a8468, legs: 0x4a3828, boots: 0x3a3c44, belt: 0x5a3e28, pauldrons: 0x4d4f58, bulk: 1.75, height: 1.15, hunch: 0.2 });
  // Riveted iron bands & a tiny helmeted head with a burning visor slit
  add(b.upper, torus(0.3, 0.025, 4, 14), mat(0x6b6d76, { metal: 0.8, rough: 0.35 }), 0, 0.2, 0, Math.PI / 2);
  add(b.upper, cyl(b.headR * 1.15, b.headR * 1.2, b.headR * 2.1, 7), mat(0x55575f, { metal: 0.8, rough: 0.4 }), 0, b.headY, 0);
  add(b.upper, box(0.12, 0.02, 0.02), glowMat(0xff4a14, 3.4), 0, b.headY + 0.01, b.headR * 1.18);
  // Spiked iron maul
  const maul = new THREE.Group();
  maul.position.copy(b.rightHand);
  maul.rotation.x = -0.25;
  add(maul, cyl(0.03, 0.035, 0.7, 6), mat(P.wood), 0, 0.2, 0);
  add(maul, cyl(0.12, 0.12, 0.26, 8), mat(P.iron, { metal: 0.8, rough: 0.35 }), 0, 0.58, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    add(maul, cone(0.03, 0.1, 4), mat(0x9ca3af, { metal: 0.8 }), 0, 0.58 + Math.sin(a) * 0.13, Math.cos(a) * 0.13, a);
  }
  b.root.add(maul);
  return finish(b.root);
}

function buildBossLordIgnis(): THREE.Group {
  // Towering infernal overlord: obsidian armor split by magma, horned crown, bat wings, flaming blade
  const b = buildBody({ skin: 0x3a1510, torso: P.obsidian, torsoKind: 'plate', sleeves: P.obsidian, legs: 0x1a1010, boots: 0x0f0a0a, belt: 0x2a0f0a, pauldrons: 0x2a1512, bulk: 1.45, height: 1.1 });
  const magma = glowMat(0xff4a14, 1.8);
  add(b.upper, box(0.025, 0.24, 0.02), magma, 0.06, 0.2, b.chestZ + 0.03, 0, 0, 0.5);
  add(b.upper, box(0.025, 0.16, 0.02), magma, -0.07, 0.26, b.chestZ + 0.03, 0, 0, -0.6);
  add(b.upper, box(0.025, 0.12, 0.02), magma, -0.02, 0.1, b.chestZ + 0.02, 0, 0, 0.9);
  const wing = mat(0x3a1210, { emissive: 0x4a0805, glow: 0.7, rough: 0.8 });
  wing.side = THREE.DoubleSide;
  [-1, 1].forEach(side => {
    // Great curved horns
    add(b.upper, cone(0.05, 0.32, 5), mat(0x2a1c18, { rough: 0.5 }), side * 0.11, b.headY + 0.14, -0.02, -0.4, 0, side * -0.6);
    // Bat wings with glowing ember veins
    const w = add(b.upper, cone(0.45, 1.0, 3), wing, side * 0.38, b.shoulderY + 0.1, b.backZ - 0.12, 0.35, 0, side * -1.1);
    w.scale.z = 0.07;
    add(b.upper, box(0.02, 0.85, 0.02), glowMat(0xff5a14, 1.4), side * 0.42, b.shoulderY + 0.14, b.backZ - 0.12, 0.35, 0, side * -1.1);
  });
  eyes(b, 0xffb020, 0.045, 0.01, 0.024);
  // Spiked burning crown
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(b.upper, cone(0.025, 0.1, 4), glowMat(0xff7a1a, 2.0), Math.sin(a) * 0.1, b.headY + b.headR + 0.03, Math.cos(a) * 0.1);
  }
  sword(b.root, b.rightHand, 0.85, 0x3a0f0a, 0xff5a14);
  const aura = add(b.root, torus(0.45, 0.018, 4, 32), glowMat(0xff3b14, 1.3), 0, 0.04, 0, Math.PI / 2);
  aura.name = 'rotating';
  return finish(b.root, 0.2);
}

// ── Mission 1 boss ──

function buildGoblinWarlord(): THREE.Group {
  // Oversized goblin king in scavenged plate, bone crown and a war horn, dragging a spiked cleaver
  const b = buildBody({ skin: 0x6b8a3a, torso: 0x4a3b2c, torsoKind: 'plate', sleeves: 0x6b8a3a, legs: 0x3a2c20, boots: 0x2a1f16, belt: 0x7a4a22, pauldrons: 0x5a4a3a, bulk: 1.3, height: 1.0, hunch: 0.28 });
  [-1, 1].forEach(side => add(b.upper, cone(0.06, 0.26, 4), mat(0x6b8a3a), side * 0.16, b.headY + 0.04, -0.01, 0, 0, side * -1.35));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(b.upper, cone(0.02, 0.12, 4), mat(P.bone), Math.sin(a) * 0.1, b.headY + b.headR + 0.04, Math.cos(a) * 0.1);
  }
  eyes(b, 0xfacc15, 0.05, 0.02, 0.024);
  cape(b, 0x7f1d1d, 0.55, 0.42);
  // War horn slung at the hip
  add(b.upper, torus(0.08, 0.025, 4, 10, Math.PI), mat(P.bone), 0.2, 0.02, 0.06, 0, Math.PI / 2, 0);
  axe(b.root, b.rightHand, 1.6, 0x5a4a3a);
  shield(b.root, b.leftHand, 'round', 0x3a2c20, 0x6b5a4a, 0xfacc15);
  return finish(b.root, 0.15);
}

// ── Mission 2: Ironforge Pass (soot, riveted steel, forge glow) ──

function buildForgeBomber(): THREE.Group {
  const b = buildBody({ skin: 0x8a6a4a, torso: 0x3a2a1e, torsoKind: 'cloth', sleeves: 0x3a2a1e, legs: 0x2a1f16, boots: 0x1a1410, belt: 0x5a3a1e, bulk: 0.85, height: 0.75, hunch: 0.4 });
  kettleHelm(b, 0x4a4e57);
  eyes(b, 0xfb923c, 0.045, 0.02, 0.02);
  // Powder keg on the back with a sparking fuse
  add(b.upper, cyl(0.13, 0.13, 0.26, 8), mat(P.wood), 0, 0.2, b.backZ - 0.1, 0.2);
  [-0.08, 0.08].forEach(y => add(b.upper, torus(0.13, 0.012, 4, 12), mat(P.iron, { metal: 0.7 }), 0, 0.2 + y, b.backZ - 0.1, Math.PI / 2 + 0.2));
  const spark = add(b.upper, sph(0.04, 5, 4), glowMat(0xffb020, 3.4), 0, 0.4, b.backZ - 0.13);
  spark.name = 'floating';
  dagger(b.root, b.rightHand, 0x6b5a4a);
  return finish(b.root);
}

function buildIronAutomaton(): THREE.Group {
  const b = buildBody({ skin: 0x5d636e, torso: 0x6b7280, torsoKind: 'plate', sleeves: 0x5d636e, legs: 0x4b5160, boots: 0x3a3f4a, belt: 0x3a3f4a, pauldrons: 0x7c8490, bulk: 1.25, height: 1.0 });
  // Layered plates and a furnace core
  [0.08, 0.2].forEach(y => add(b.upper, box(0.36, 0.05, 0.3), mat(0x8a929e, { metal: 0.85, rough: 0.3 }), 0, y, 0));
  add(b.upper, cyl(0.07, 0.07, 0.03, 8), glowMat(0xf97316, 2.4), 0, 0.2, b.chestZ + 0.03, Math.PI / 2);
  add(b.upper, box(b.headR * 2, b.headR * 1.8, b.headR * 1.9), mat(0x6b7280, { metal: 0.85, rough: 0.3 }), 0, b.headY, 0);
  add(b.upper, box(0.14, 0.025, 0.02), glowMat(0x38bdf8, 3.0), 0, b.headY + 0.01, b.headR + 0.01);
  hammer(b.root, b.rightHand, 0x4b5160);
  return finish(b.root);
}

function buildIronArbalist(): THREE.Group {
  const b = buildBody({ skin: 0x9c6b4e, torso: 0x475569, torsoKind: 'mail', sleeves: 0x334155, legs: 0x2a2f38, boots: 0x1f232a, belt: 0x5a3a1e, bulk: 1.1, height: 0.85 });
  // Squat helmet with a braided beard, heavy crossbow
  greatHelm(b, 0x4a4e57);
  add(b.upper, cone(0.08, 0.2, 5), mat(0x7c2d12, { rough: 0.9 }), 0, b.headY - 0.14, b.headR * 0.7, Math.PI);
  const xb = new THREE.Group();
  xb.position.copy(b.rightHand);
  add(xb, box(0.06, 0.06, 0.5), mat(P.wood), 0, 0.02, 0.1);
  add(xb, box(0.5, 0.04, 0.05), mat(P.steelDark, { metal: 0.8 }), 0, 0.03, 0.3);
  add(xb, box(0.02, 0.02, 0.3), glowMat(0xf97316, 1.4), 0, 0.07, 0.2);
  b.root.add(xb);
  return finish(b.root);
}

function buildRockTroll(): THREE.Group {
  const b = buildBody({ skin: 0x78716c, torso: 0x78716c, torsoKind: 'bare', sleeves: 0x78716c, legs: 0x57534e, boots: 0x44403c, belt: 0x3a2c20, bulk: 1.8, height: 1.1, hunch: 0.35 });
  // Boulder shoulders overgrown with moss, tiny head
  [-1, 1].forEach(side => {
    add(b.upper, ico(0.16), mat(0x57534e, { rough: 0.95 }), side * 0.3, b.shoulderY + 0.02, 0);
    add(b.upper, ico(0.07), mat(0x4d7c0f, { rough: 1 }), side * 0.3, b.shoulderY + 0.14, 0);
  });
  add(b.upper, ico(0.12), mat(0x57534e, { rough: 0.95 }), 0, 0.3, b.backZ - 0.05);
  eyes(b, 0x84cc16, 0.04, 0.0, 0.02);
  // Stone club
  const club = new THREE.Group();
  club.position.copy(b.rightHand);
  club.rotation.x = -0.3;
  add(club, cyl(0.04, 0.05, 0.5, 6), mat(P.wood), 0, 0.15, 0);
  add(club, ico(0.14), mat(0x6b6560, { rough: 0.95 }), 0, 0.45, 0);
  b.root.add(club);
  return finish(b.root);
}

function buildIronColossus(): THREE.Group {
  // Forge-engine giant: riveted adamant body, furnace heart, smokestack shoulders, anvil fists
  const b = buildBody({ skin: 0x6b7280, torso: 0x94a3b8, torsoKind: 'plate', sleeves: 0x6b7280, legs: 0x4b5563, boots: 0x374151, belt: 0x374151, pauldrons: 0x94a3b8, bulk: 1.7, height: 1.1 });
  add(b.upper, cyl(0.12, 0.12, 0.04, 10), glowMat(0xff6a14, 2.6), 0, 0.2, b.chestZ + 0.04, Math.PI / 2);
  [0.06, 0.3].forEach(y => add(b.upper, torus(0.3, 0.02, 4, 16), mat(0xcbd5e1, { metal: 0.9, rough: 0.25 }), 0, y, 0, Math.PI / 2));
  [-1, 1].forEach(side => {
    add(b.upper, cyl(0.05, 0.06, 0.3, 7), mat(P.iron, { metal: 0.8 }), side * 0.28, b.shoulderY + 0.2, b.backZ);
    add(b.upper, sph(0.045, 5, 4), glowMat(0xffb020, 2.0), side * 0.28, b.shoulderY + 0.37, b.backZ);
  });
  add(b.upper, box(b.headR * 2.2, b.headR * 1.7, b.headR * 2), mat(0x94a3b8, { metal: 0.9, rough: 0.25 }), 0, b.headY, 0);
  add(b.upper, box(0.18, 0.03, 0.02), glowMat(0xff6a14, 3.4), 0, b.headY, b.headR + 0.02);
  [b.rightHand, b.leftHand].forEach(hand => add(b.root, box(0.2, 0.14, 0.16), mat(P.iron, { metal: 0.85, rough: 0.3 }), hand.x, hand.y - 0.02, hand.z + 0.04));
  const aura = add(b.root, torus(0.45, 0.016, 4, 32), glowMat(0xff8a3d, 1.1), 0, 0.04, 0, Math.PI / 2);
  aura.name = 'rotating';
  return finish(b.root, 0.2);
}

// ── Mission 3: Golden Canyon (sand, bronze, faded linen) ──

function buildScarabSwarmer(): THREE.Group {
  const g = new THREE.Group();
  const shell = mat(0x0f766e, { metal: 0.6, rough: 0.3 });
  const shellBody = add(g, sph(0.28, 8, 6), shell, 0, 0.22, 0);
  shellBody.scale.set(1, 0.6, 1.3);
  add(g, box(0.02, 0.2, 0.6), mat(0x134e4a, { metal: 0.6 }), 0, 0.36, 0);
  add(g, sph(0.12, 6, 5), mat(0x134e4a, { metal: 0.5 }), 0, 0.2, 0.34);
  [-1, 1].forEach(side => {
    add(g, cone(0.02, 0.14, 4), mat(0xca8a04, { metal: 0.6 }), side * 0.06, 0.2, 0.46, Math.PI / 2 + 0.3, 0, side * 0.3);
    [-0.15, 0, 0.15].forEach(z => add(g, cyl(0.015, 0.012, 0.22, 4), mat(0x134e4a), side * 0.26, 0.1, z, 0, 0, side * 1.0));
  });
  eyesAt(g, 0xfacc15, 0.05, 0.24, 0.43);
  g.userData.headTop = 0.45;
  return g;
}

function buildSandRaider(): THREE.Group {
  const b = buildBody({ skin: 0x9c6b4e, torso: 0xd6b27a, torsoKind: 'cloth', sleeves: 0xc8a064, legs: 0x8a6a3a, boots: 0x5a3d26, belt: 0x7c2d12, bulk: 0.95, hunch: 0.15 });
  hood(b, 0xd6b27a, false);
  add(b.upper, box(0.2, 0.06, 0.04), mat(0x7c2d12, { rough: 0.9 }), 0, b.headY - 0.04, b.headR * 0.95);
  eyes(b, 0xfbbf24, 0.04, 0.03, 0.017);
  [b.rightHand, b.leftHand].forEach(hand => sword(b.root, hand, 0.4, 0xd6d3d1));
  return finish(b.root);
}

function buildDuneSlinger(): THREE.Group {
  const b = buildBody({ skin: 0x9c6b4e, torso: 0xa16207, torsoKind: 'cloth', sleeves: 0xca8a04, legs: 0x78350f, boots: 0x5a3d26, belt: 0x44403c, bulk: 0.9, hunch: 0.1 });
  hood(b, 0xca8a04, false);
  eyes(b, 0xfde68a, 0.04, 0.02, 0.017);
  // Sling with a loaded stone
  add(b.root, cyl(0.006, 0.006, 0.4, 4), mat(0x78350f), b.rightHand.x, b.rightHand.y + 0.18, b.rightHand.z, 0.3);
  add(b.root, ico(0.05), mat(0x78716c), b.rightHand.x, b.rightHand.y + 0.38, b.rightHand.z + 0.1);
  add(b.upper, cyl(0.07, 0.06, 0.16, 6), mat(0x5a3d26), -0.2, 0.0, 0.05);
  return finish(b.root);
}

function buildTombGuardian(): THREE.Group {
  const b = buildBody({ skin: 0xd6cdb4, torso: 0xc8bfa4, torsoKind: 'bare', sleeves: 0xc8bfa4, legs: 0xb8ae94, boots: 0x8a7a5a, belt: 0xc9973a, bulk: 1.6, height: 1.15 });
  // Linen bandage bands, golden pharaoh headdress, glowing ward sigils
  [0.05, 0.15, 0.25].forEach(y => add(b.upper, torus(0.18 * 1.6, 0.015, 4, 14), mat(0xa8a08a, { rough: 1 }), 0, y, 0, Math.PI / 2 + 0.1));
  add(b.upper, cone(b.headR * 1.6, 0.34, 4), mat(P.gold, { metal: 0.8, rough: 0.3 }), 0, b.headY + 0.02, -0.06, -0.3, Math.PI / 4);
  add(b.upper, box(0.3, 0.04, 0.03), mat(0x1e3a8a), 0, b.headY + 0.06, b.headR * 0.8);
  eyes(b, 0x22d3ee, 0.04, 0.01, 0.02);
  add(b.upper, torus(0.36, 0.012, 4, 20), glowMat(0x22d3ee, 1.4), 0, 0.2, 0, Math.PI / 2);
  // Khopesh
  sword(b.root, b.rightHand, 0.55, P.gold);
  shield(b.root, b.leftHand, 'tower', 0xa8a08a, P.gold, 0x22d3ee);
  return finish(b.root);
}

function buildSandWyrm(): THREE.Group {
  // Serpent rearing out of the sand: coiled segmented body, horned jaw and fin crest
  const g = new THREE.Group();
  const scale = mat(0xb45309, { rough: 0.6, metal: 0.2 });
  const belly = mat(0xfcd34d, { rough: 0.7 });
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const seg = add(g, sph(0.34 - t * 0.12, 8, 6), scale, Math.sin(t * 5) * 0.22, 0.2 + t * 1.1, -0.2 + t * 0.35);
    seg.scale.set(1, 0.8, 1);
    add(g, box(0.02, 0.12, 0.14), mat(0x7c2d12), Math.sin(t * 5) * 0.22, 0.46 + t * 1.1 - t * 0.12, -0.25 + t * 0.35);
  }
  add(g, sph(0.28, 8, 6), belly, 0, 0.15, 0.1).scale.set(1.4, 0.35, 1.4);
  // Head
  const head = add(g, sph(0.24, 8, 6), scale, 0.0, 1.45, 0.3);
  head.scale.set(1, 0.8, 1.4);
  add(g, cone(0.18, 0.36, 6), mat(0x92400e, { rough: 0.6 }), 0, 1.38, 0.62, Math.PI / 2);
  [-1, 1].forEach(side => {
    add(g, cone(0.04, 0.34, 5), mat(P.bone), side * 0.14, 1.64, 0.2, -0.7, 0, side * -0.4);
    add(g, sph(0.035, 5, 4), glowMat(0xfbbf24, 3.4), side * 0.11, 1.52, 0.52);
  });
  const dust = add(g, torus(0.55, 0.03, 4, 28), mat(0xd6b27a, { opacity: 0.55, rough: 1 }), 0, 0.05, 0, Math.PI / 2);
  dust.name = 'rotating';
  g.userData.headTop = 1.75;
  return g;
}

// ── Mission 4: Arcane Rift (void violet, glyph cyan, floating shards) ──

function buildVoidWisp(): THREE.Group {
  const g = new THREE.Group();
  const core = add(g, oct(0.2), glowMat(0x8b5cf6, 2.8), 0, 0.75, 0);
  core.name = 'floating';
  add(g, ico(0.3), mat(0x4c1d95, { opacity: 0.35, emissive: 0x6d28d9, glow: 0.8 }), 0, 0.75, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(g, oct(0.06), glowMat(0x22d3ee, 2.2), Math.cos(a) * 0.32, 0.6 + i * 0.1, Math.sin(a) * 0.32);
  }
  add(g, cone(0.12, 0.45, 6), mat(0x2e1065, { opacity: 0.5 }), 0, 0.35, 0, Math.PI);
  const ring = add(g, torus(0.35, 0.012, 4, 20), glowMat(0x22d3ee, 1.5), 0, 0.75, 0, Math.PI / 2);
  ring.name = 'rotating';
  g.userData.headTop = 1.05;
  return g;
}

function buildRiftStalker(): THREE.Group {
  const b = buildBody({ skin: 0x2e1065, torso: 0x1e1b4b, torsoKind: 'cloth', sleeves: 0x1e1b4b, legs: 0x0f0a24, boots: 0x0a0718, belt: 0x4c1d95, bulk: 0.95, hunch: 0.3 });
  hood(b, 0x1e1b4b);
  eyes(b, 0x22d3ee, 0.04, 0.0, 0.018);
  // Phase shards trailing behind
  [0, 1, 2].forEach(i => add(b.upper, oct(0.05), glowMat(0x8b5cf6, 1.8), (i - 1) * 0.12, 0.1 + i * 0.08, b.backZ - 0.18 - i * 0.05));
  dagger(b.root, b.rightHand, 0x4c1d95, 0x22d3ee);
  dagger(b.root, b.leftHand, 0x4c1d95, 0x22d3ee);
  return finish(b.root);
}

function buildSpellbreaker(): THREE.Group {
  const b = buildBody({ skin: 0xc4a484, torso: 0x164e63, torsoKind: 'mail', sleeves: 0xc4a484, legs: 0x0c2d3a, boots: 0x0a1f28, belt: 0x155e75, bulk: 1.15 });
  hornedHelm(b, 0x155e75, 0xa5f3fc);
  eyes(b, 0x67e8f9, 0.045, 0.01, 0.02);
  // Null-rune tattoos and a rune-etched glaive
  [-1, 1].forEach(side => add(b.upper, box(0.02, 0.14, 0.02), glowMat(0x22d3ee, 2.0), side * 0.22, b.shoulderY - 0.15, 0.05));
  const glaive = spear(b.root, b.rightHand, 1.25);
  add(glaive, box(0.1, 0.2, 0.015), glowMat(0x67e8f9, 1.6), 0, 1.15, 0);
  return finish(b.root);
}

function buildArcaneConstruct(): THREE.Group {
  const g = new THREE.Group();
  const stone = mat(0x1e1b4b, { rough: 0.5, metal: 0.3 });
  const glyph = glowMat(0x818cf8, 2.2);
  // Floating monolith torso with hovering fists and a glyph eye
  const body = add(g, box(0.62, 0.9, 0.42), stone, 0, 0.95, 0);
  body.name = 'floating';
  add(g, box(0.64, 0.05, 0.44), glyph, 0, 0.75, 0);
  add(g, box(0.64, 0.05, 0.44), glyph, 0, 1.2, 0);
  add(g, oct(0.09), glowMat(0x22d3ee, 3.2), 0, 1.25, 0.23);
  [-1, 1].forEach(side => {
    add(g, box(0.24, 0.24, 0.24), stone, side * 0.52, 0.85, 0.12);
    add(g, box(0.25, 0.04, 0.25), glyph, side * 0.52, 0.85, 0.12);
    add(g, cone(0.14, 0.4, 4), stone, side * 0.2, 0.28, 0, Math.PI);
  });
  const ring = add(g, torus(0.5, 0.015, 4, 24), glyph, 0, 0.1, 0, Math.PI / 2);
  ring.name = 'rotating';
  g.userData.headTop = 1.5;
  return g;
}

function buildRiftArchon(): THREE.Group {
  // Robed rift-lord with a shattered halo, floating glyph plates and a reality-splitting staff
  const b = buildBody({ skin: 0x6d28d9, torso: 0x2e1065, torsoKind: 'robe', sleeves: 0x3b0764, belt: 0x22d3ee, bulk: 1.3, height: 1.15 });
  hood(b, 0x1e1b4b);
  eyes(b, 0x22d3ee, 0.045, 0.0, 0.026);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(b.upper, oct(0.05), glowMat(i % 2 ? 0x22d3ee : 0xc084fc, 2.4), Math.cos(a) * 0.22, b.headY + 0.22, Math.sin(a) * 0.1 - 0.05);
  }
  [-1, 1].forEach(side => add(b.upper, box(0.16, 0.24, 0.02), mat(0x312e81, { emissive: 0x6d28d9, glow: 0.8 }), side * 0.38, b.shoulderY + 0.05, 0, 0, 0, side * 0.3));
  staff(b.root, b.rightHand, 0x22d3ee, 1.4);
  const halo = add(b.root, torus(0.5, 0.02, 4, 32), glowMat(0xa855f7, 1.4), 0, 0.05, 0, Math.PI / 2);
  halo.name = 'rotating';
  return finish(b.root, 0.2);
}

// ── Mission 5: Infernal Citadel (charred hide, embers, blood iron) ──

function buildImp(): THREE.Group {
  const b = buildBody({ skin: 0xb91c1c, torso: 0xb91c1c, torsoKind: 'bare', sleeves: 0xb91c1c, legs: 0x7f1d1d, boots: 0x450a0a, belt: 0x1c1917, bulk: 0.8, height: 0.7, hunch: 0.4 });
  const wing = mat(0x450a0a, { rough: 0.8 });
  wing.side = THREE.DoubleSide;
  [-1, 1].forEach(side => {
    add(b.upper, cone(0.025, 0.12, 4), mat(0x1c1917), side * 0.07, b.headY + b.headR, 0, 0, 0, side * -0.4);
    const w = add(b.upper, cone(0.2, 0.36, 3), wing, side * 0.22, b.shoulderY, b.backZ - 0.06, 0.3, 0, side * -1.1);
    w.scale.z = 0.08;
  });
  eyes(b, 0xfde047, 0.04, 0.02, 0.02);
  add(b.root, sph(0.06, 6, 5), glowMat(0xff7a1a, 3.0), b.rightHand.x, b.rightHand.y + 0.06, b.rightHand.z).name = 'floating';
  return finish(b.root);
}

function buildHellhound(): THREE.Group {
  const g = new THREE.Group();
  const hide = mat(0x3f0d0d, { rough: 0.8 });
  const body = add(g, sph(0.3, 8, 6), hide, 0, 0.5, -0.05);
  body.scale.set(0.9, 0.75, 1.5);
  [[-0.14, 0.25], [0.14, 0.25], [-0.14, -0.3], [0.14, -0.3]].forEach(([x, z]) => add(g, cyl(0.05, 0.04, 0.4, 5), hide, x, 0.2, z));
  const head = add(g, sph(0.18, 7, 6), hide, 0, 0.65, 0.45);
  head.scale.set(1, 0.9, 1.25);
  add(g, box(0.16, 0.08, 0.22), mat(0x2a0808), 0, 0.57, 0.6);
  add(g, box(0.14, 0.02, 0.18), glowMat(0xff4a14, 3.0), 0, 0.6, 0.62);
  [-1, 1].forEach(side => {
    add(g, cone(0.04, 0.14, 4), hide, side * 0.1, 0.8, 0.4, -0.3);
    add(g, sph(0.025, 5, 4), glowMat(0xfbbf24, 3.4), side * 0.07, 0.7, 0.62);
  });
  // Ember spine and tail flame
  for (let i = 0; i < 4; i++) add(g, cone(0.03, 0.1, 4), glowMat(0xff5a14, 2.0), 0, 0.72, 0.2 - i * 0.16);
  add(g, cone(0.06, 0.28, 5), glowMat(0xff7a1a, 2.4), 0, 0.62, -0.58, -1.0);
  g.userData.headTop = 0.95;
  return g;
}

function buildFireCultist(): THREE.Group {
  const b = buildBody({ skin: 0xc28a6a, torso: 0x9a3412, torsoKind: 'robe', sleeves: 0x7c2d12, belt: 0x1c1917, bulk: 1.0 });
  hood(b, 0x7c2d12);
  eyes(b, 0xfb923c, 0.04, 0.0, 0.018);
  add(b.upper, box(0.03, 0.26, 0.02), glowMat(0xff7a1a, 1.6), 0, 0.15, b.chestZ + 0.02);
  staff(b.root, b.rightHand, 0xff5a14, 1.2);
  return finish(b.root);
}

function buildDemonBrute(): THREE.Group {
  const b = buildBody({ skin: 0x7f1d1d, torso: 0x7f1d1d, torsoKind: 'bare', sleeves: 0x7f1d1d, legs: 0x450a0a, boots: 0x1c1917, belt: 0x292524, pauldrons: 0x292524, bulk: 1.85, height: 1.15, hunch: 0.3 });
  const magma = glowMat(0xff4a14, 1.6);
  add(b.upper, box(0.025, 0.2, 0.02), magma, 0.08, 0.18, b.chestZ + 0.02, 0, 0, 0.5);
  add(b.upper, box(0.025, 0.16, 0.02), magma, -0.08, 0.24, b.chestZ + 0.02, 0, 0, -0.5);
  [-1, 1].forEach(side => add(b.upper, cone(0.06, 0.34, 5), mat(0x1c1917, { rough: 0.5 }), side * 0.12, b.headY + 0.12, 0, -0.3, 0, side * -0.7));
  eyes(b, 0xfbbf24, 0.045, 0.01, 0.022);
  // Brazier-headed maul
  const maul = new THREE.Group();
  maul.position.copy(b.rightHand);
  maul.rotation.x = -0.25;
  add(maul, cyl(0.035, 0.04, 0.75, 6), mat(0x292524), 0, 0.22, 0);
  add(maul, cyl(0.16, 0.12, 0.2, 8), mat(0x292524, { metal: 0.7, rough: 0.4 }), 0, 0.62, 0);
  add(maul, cone(0.12, 0.22, 6), glowMat(0xff6a14, 2.6), 0, 0.8, 0).name = 'floating';
  b.root.add(maul);
  return finish(b.root);
}

/** Eyes on a non-humanoid model (beasts, constructs). */
function eyesAt(g: THREE.Object3D, color: number, spread: number, y: number, z: number) {
  const m = glowMat(color, 3.2);
  [-1, 1].forEach(side => add(g, sph(0.025, 5, 4), m, side * spread, y, z));
}

// ─── PUBLIC API ─────────────────────────────────────────────

const FRIENDLY_BUILDERS: Record<FriendlyClass, () => THREE.Group> = {
  [FriendlyClass.RECRUIT]: buildRecruit,
  [FriendlyClass.FOOTMAN]: buildFootman,
  [FriendlyClass.KNIGHT]: buildKnight,
  [FriendlyClass.BERSERKER]: buildBerserker,
  [FriendlyClass.CLERIC]: buildCleric,
  [FriendlyClass.PALADIN]: buildPaladin,
  [FriendlyClass.ARCHMAGE]: buildArchmage,
  [FriendlyClass.PYRO_GOLEM]: buildPyroGolem,
  [FriendlyClass.SOLDIER]: buildSoldier,
  [FriendlyClass.ARCHER]: buildArcher,
  [FriendlyClass.MAGE]: buildMage
};

const ENEMY_BUILDERS: Record<EnemyClass, () => THREE.Group> = {
  [EnemyClass.GOBLIN]: buildGoblin,
  [EnemyClass.ORC_WARRIOR]: buildOrcWarrior,
  [EnemyClass.SKELETON_ARCHER]: buildSkeletonArcher,
  [EnemyClass.SHADOW_ASSASSIN]: buildShadowAssassin,
  [EnemyClass.IRONCLAD_OGRE]: buildIroncladOgre,
  [EnemyClass.BOSS_GOBLIN_WARLORD]: buildGoblinWarlord,
  [EnemyClass.FORGE_BOMBER]: buildForgeBomber,
  [EnemyClass.IRON_AUTOMATON]: buildIronAutomaton,
  [EnemyClass.IRON_ARBALIST]: buildIronArbalist,
  [EnemyClass.ROCK_TROLL]: buildRockTroll,
  [EnemyClass.BOSS_IRON_COLOSSUS]: buildIronColossus,
  [EnemyClass.SCARAB_SWARMER]: buildScarabSwarmer,
  [EnemyClass.SAND_RAIDER]: buildSandRaider,
  [EnemyClass.DUNE_SLINGER]: buildDuneSlinger,
  [EnemyClass.TOMB_GUARDIAN]: buildTombGuardian,
  [EnemyClass.BOSS_SAND_WYRM]: buildSandWyrm,
  [EnemyClass.VOID_WISP]: buildVoidWisp,
  [EnemyClass.RIFT_STALKER]: buildRiftStalker,
  [EnemyClass.SPELLBREAKER]: buildSpellbreaker,
  [EnemyClass.ARCANE_CONSTRUCT]: buildArcaneConstruct,
  [EnemyClass.BOSS_RIFT_ARCHON]: buildRiftArchon,
  [EnemyClass.IMP]: buildImp,
  [EnemyClass.HELLHOUND]: buildHellhound,
  [EnemyClass.FIRE_CULTIST]: buildFireCultist,
  [EnemyClass.DEMON_BRUTE]: buildDemonBrute,
  [EnemyClass.BOSS_LORD_IGNIS]: buildBossLordIgnis
};

function builderFor(unitClass: FriendlyClass | EnemyClass): () => THREE.Group {
  // The mesh follows the unit's class, not its allegiance
  return isFriendlyClass(unitClass) ? FRIENDLY_BUILDERS[unitClass] : ENEMY_BUILDERS[unitClass as EnemyClass];
}

/**
 * Builds the model for a unit class. Feet at y = 0, facing +Z.
 */
export function buildUnitMesh(
  unitClass: FriendlyClass | EnemyClass,
  _isFriendly: boolean,
  scale: number
): THREE.Group {
  const model = builderFor(unitClass)();
  model.scale.setScalar(scale * VISUAL_SCALE);
  return model;
}

const headTopCache = new Map<string, number>();

/**
 * Height of the model's head (for HP bar placement), in world units.
 */
export function getUnitMeshHeight(
  unitClass: FriendlyClass | EnemyClass,
  _isFriendly: boolean,
  scale: number
): number {
  let top = headTopCache.get(unitClass);
  if (top === undefined) {
    const probe = builderFor(unitClass)();
    top = (probe.userData.headTop as number) ?? 1;
    probe.traverse(c => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    });
    headTopCache.set(unitClass, top);
  }
  return top * scale * VISUAL_SCALE;
}
