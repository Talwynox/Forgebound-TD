/**
 * UnitMeshFactory: Builds distinct multi-part procedural meshes for each unit class.
 * Each unit is a THREE.Group of stacked primitives (body, head, weapon, accessories)
 * that form a recognizable medieval fantasy silhouette.
 */
import * as THREE from 'three';
import { FriendlyClass, EnemyClass, isFriendlyClass } from './UnitData';

// ─── Helper: create a quick mesh ───────────────────────────
function m(
  geom: THREE.BufferGeometry,
  color: number,
  opts: { emissive?: number; emissiveIntensity?: number; metalness?: number; roughness?: number; transparent?: boolean; opacity?: number } = {}
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    metalness: opts.metalness ?? 0.3,
    roughness: opts.roughness ?? 0.5,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  return mesh;
}

// ─── FRIENDLY UNIT BUILDERS ────────────────────────────────

function buildRecruit(s: number): THREE.Group {
  const g = new THREE.Group();

  // Peasant leather boots & leggings
  [-1, 1].forEach(side => {
    const boot = m(new THREE.BoxGeometry(0.12 * s, 0.14 * s, 0.16 * s), 0x451a03, { roughness: 0.8 });
    boot.position.set(side * 0.11 * s, 0.07 * s, 0.02 * s);
    g.add(boot);
    const leg = m(new THREE.CylinderGeometry(0.06 * s, 0.07 * s, 0.22 * s, 5), 0x57534e);
    leg.position.set(side * 0.11 * s, 0.18 * s, 0);
    g.add(leg);
  });

  // Peasant linen tunic with rolled sleeves
  const tunic = m(new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.45 * s, 6), 0x94a3b8);
  tunic.position.y = 0.38 * s;
  g.add(tunic);

  // Leather waist belt with forged iron buckle
  const belt = m(new THREE.CylinderGeometry(0.24 * s, 0.25 * s, 0.05 * s, 8), 0x78350f);
  belt.position.y = 0.32 * s;
  g.add(belt);

  const buckle = m(new THREE.BoxGeometry(0.06 * s, 0.06 * s, 0.02 * s), 0xd4d4d4, { metalness: 0.8 });
  buckle.position.set(0, 0.32 * s, 0.13 * s);
  g.add(buckle);

  // Head with determined eyes
  const head = m(new THREE.SphereGeometry(0.15 * s, 8, 6), 0xfcd9b0);
  head.position.set(0, 0.72 * s, 0.02 * s);
  g.add(head);

  [-1, 1].forEach(side => {
    const eye = m(new THREE.SphereGeometry(0.025 * s, 4, 4), 0x1e293b);
    eye.position.set(side * 0.05 * s, 0.74 * s, 0.15 * s);
    g.add(eye);
  });

  // Padded arming cap / leather coif with rolled rim
  const cap = m(new THREE.CylinderGeometry(0.14 * s, 0.19 * s, 0.14 * s, 7), 0x64748b, { roughness: 0.6 });
  cap.position.set(0, 0.83 * s, 0);
  g.add(cap);

  const brim = m(new THREE.TorusGeometry(0.17 * s, 0.025 * s, 4, 10), 0x475569);
  brim.position.set(0, 0.78 * s, 0);
  brim.rotation.x = Math.PI / 2;
  g.add(brim);

  // Wooden buckler on left arm
  const buckler = m(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.03 * s, 8), 0x78350f);
  buckler.position.set(-0.28 * s, 0.45 * s, 0.08 * s);
  buckler.rotation.z = Math.PI / 2;
  g.add(buckler);

  const boss = m(new THREE.SphereGeometry(0.05 * s, 6, 4), 0xa0a0a0, { metalness: 0.8 });
  boss.position.set(-0.3 * s, 0.45 * s, 0.08 * s);
  g.add(boss);

  // Sturdy ash-wood spear in right hand
  const spearShaft = m(new THREE.CylinderGeometry(0.022 * s, 0.022 * s, 1.25 * s, 5), 0x854d0e);
  spearShaft.position.set(0.28 * s, 0.6 * s, 0.05 * s);
  g.add(spearShaft);

  // Steel spearhead with cross-wings
  const spearTip = m(new THREE.ConeGeometry(0.055 * s, 0.22 * s, 4), 0xc0c0c0, { metalness: 0.9, roughness: 0.15 });
  spearTip.position.set(0.28 * s, 1.28 * s, 0.05 * s);
  g.add(spearTip);

  const crossWings = m(new THREE.BoxGeometry(0.14 * s, 0.025 * s, 0.025 * s), 0x71717a, { metalness: 0.8 });
  crossWings.position.set(0.28 * s, 1.15 * s, 0.05 * s);
  g.add(crossWings);

  return g;
}

function buildFootman(s: number): THREE.Group {
  const g = new THREE.Group();

  // Greaves and boots
  [-1, 1].forEach(side => {
    const boot = m(new THREE.BoxGeometry(0.12 * s, 0.16 * s, 0.18 * s), 0x334155, { metalness: 0.5 });
    boot.position.set(side * 0.12 * s, 0.08 * s, 0.02 * s);
    g.add(boot);
    const leg = m(new THREE.CylinderGeometry(0.065 * s, 0.075 * s, 0.24 * s, 6), 0x475569, { metalness: 0.6 });
    leg.position.set(side * 0.12 * s, 0.2 * s, 0);
    g.add(leg);
  });

  // Body: armored infantry gambeson & chainmail
  const body = m(new THREE.CylinderGeometry(0.28 * s, 0.32 * s, 0.55 * s, 8), 0x3b82f6, { metalness: 0.55 });
  body.position.y = 0.45 * s;
  g.add(body);

  // Iron belt & buckle
  const belt = m(new THREE.CylinderGeometry(0.3 * s, 0.31 * s, 0.06 * s, 8), 0x1e293b, { metalness: 0.7 });
  belt.position.y = 0.34 * s;
  g.add(belt);

  // Shoulder pauldrons with brass trim
  [-1, 1].forEach(side => {
    const pauldron = m(new THREE.SphereGeometry(0.14 * s, 6, 5), 0x2563eb, { metalness: 0.65 });
    pauldron.position.set(side * 0.3 * s, 0.65 * s, 0);
    g.add(pauldron);
    const trim = m(new THREE.TorusGeometry(0.13 * s, 0.015 * s, 4, 8), 0xfacc15, { metalness: 0.8 });
    trim.position.set(side * 0.3 * s, 0.65 * s, 0);
    trim.rotation.y = Math.PI / 2;
    g.add(trim);
  });

  // Head
  const head = m(new THREE.SphereGeometry(0.15 * s, 8, 6), 0xfcd9b0);
  head.position.set(0, 0.78 * s, 0.02 * s);
  g.add(head);

  // Kettle / Sallet helmet with brim & nose guard
  const helmet = m(new THREE.CylinderGeometry(0.18 * s, 0.21 * s, 0.16 * s, 8), 0x475569, { metalness: 0.75 });
  helmet.position.set(0, 0.88 * s, 0);
  g.add(helmet);

  const helmBrim = m(new THREE.TorusGeometry(0.22 * s, 0.025 * s, 4, 10), 0x334155, { metalness: 0.8 });
  helmBrim.position.set(0, 0.82 * s, 0);
  helmBrim.rotation.x = Math.PI / 2;
  g.add(helmBrim);

  const noseGuard = m(new THREE.BoxGeometry(0.035 * s, 0.12 * s, 0.05 * s), 0x475569, { metalness: 0.75 });
  noseGuard.position.set(0, 0.8 * s, 0.17 * s);
  g.add(noseGuard);

  // Heater Shield (left arm)
  const shield = m(new THREE.BoxGeometry(0.06 * s, 0.46 * s, 0.32 * s), 0x1d4ed8, { metalness: 0.55 });
  shield.position.set(-0.34 * s, 0.45 * s, 0.08 * s);
  g.add(shield);

  const emblem = m(new THREE.BoxGeometry(0.07 * s, 0.14 * s, 0.1 * s), 0xfacc15, { metalness: 0.85 });
  emblem.position.set(-0.34 * s, 0.48 * s, 0.08 * s);
  g.add(emblem);

  // Arming sword (right arm)
  const blade = m(new THREE.BoxGeometry(0.04 * s, 0.65 * s, 0.04 * s), 0xc0c0c0, { metalness: 0.85, roughness: 0.15 });
  blade.position.set(0.3 * s, 0.55 * s, 0.05 * s);
  g.add(blade);

  const guard = m(new THREE.BoxGeometry(0.16 * s, 0.035 * s, 0.045 * s), 0x854d0e);
  guard.position.set(0.3 * s, 0.28 * s, 0.05 * s);
  g.add(guard);

  const pommel = m(new THREE.SphereGeometry(0.035 * s, 5, 4), 0xfacc15, { metalness: 0.8 });
  pommel.position.set(0.3 * s, 0.18 * s, 0.05 * s);
  g.add(pommel);

  return g;
}

function buildKnight(s: number): THREE.Group {
  const g = new THREE.Group();
  // Heavy torso
  const body = m(new THREE.BoxGeometry(0.5 * s, 0.65 * s, 0.35 * s), 0x475569, { metalness: 0.65, roughness: 0.3 });
  body.position.y = 0.35 * s;
  g.add(body);
  // Thick shoulder plates
  [-1, 1].forEach(side => {
    const plate = m(new THREE.BoxGeometry(0.18 * s, 0.12 * s, 0.3 * s), 0x64748b, { metalness: 0.7 });
    plate.position.set(side * 0.3 * s, 0.6 * s, 0);
    g.add(plate);
  });
  // Head
  const head = m(new THREE.SphereGeometry(0.16 * s, 8, 6), 0xfcd9b0);
  head.position.y = 0.78 * s;
  g.add(head);
  // Great helm (bucket shape)
  const helm = m(new THREE.CylinderGeometry(0.18 * s, 0.19 * s, 0.25 * s, 6), 0x64748b, { metalness: 0.7 });
  helm.position.y = 0.82 * s;
  g.add(helm);
  // Helm visor slit
  const visor = m(new THREE.BoxGeometry(0.14 * s, 0.03 * s, 0.05 * s), 0x1e293b);
  visor.position.set(0, 0.8 * s, 0.18 * s);
  g.add(visor);
  // Helm plume
  const plume = m(new THREE.BoxGeometry(0.04 * s, 0.2 * s, 0.22 * s), 0xdc2626);
  plume.position.set(0, 1.0 * s, 0);
  g.add(plume);
  // Tower shield
  const shield = m(new THREE.BoxGeometry(0.07 * s, 0.55 * s, 0.4 * s), 0x475569, { metalness: 0.6 });
  shield.position.set(-0.35 * s, 0.35 * s, 0);
  g.add(shield);
  // Shield cross
  const crossV = m(new THREE.BoxGeometry(0.08 * s, 0.35 * s, 0.04 * s), 0xfacc15, { metalness: 0.8 });
  crossV.position.set(-0.35 * s, 0.38 * s, 0);
  g.add(crossV);
  const crossH = m(new THREE.BoxGeometry(0.08 * s, 0.04 * s, 0.2 * s), 0xfacc15, { metalness: 0.8 });
  crossH.position.set(-0.35 * s, 0.42 * s, 0);
  g.add(crossH);
  return g;
}

function buildBerserker(s: number): THREE.Group {
  const g = new THREE.Group();
  // Lean muscular torso
  const body = m(new THREE.CylinderGeometry(0.2 * s, 0.26 * s, 0.55 * s, 6), 0xef4444);
  body.position.y = 0.3 * s;
  g.add(body);
  // War paint stripe
  const stripe = m(new THREE.BoxGeometry(0.28 * s, 0.06 * s, 0.01 * s), 0x1e1e1e);
  stripe.position.set(0, 0.35 * s, 0.21 * s);
  g.add(stripe);
  // Head (no helmet — wild warrior)
  const head = m(new THREE.SphereGeometry(0.15 * s, 8, 6), 0xfcd9b0);
  head.position.y = 0.7 * s;
  g.add(head);
  // Mohawk hair
  const hair = m(new THREE.BoxGeometry(0.04 * s, 0.18 * s, 0.2 * s), 0xdc2626);
  hair.position.y = 0.88 * s;
  g.add(hair);
  // Dual axes
  [-1, 1].forEach(side => {
    // Axe handle
    const handle = m(new THREE.CylinderGeometry(0.02 * s, 0.02 * s, 0.45 * s, 4), 0x8B6914);
    handle.position.set(side * 0.26 * s, 0.4 * s, 0);
    handle.rotation.z = side * 0.15;
    g.add(handle);
    // Axe head (wedge)
    const axeHead = m(new THREE.BoxGeometry(0.04 * s, 0.16 * s, 0.12 * s), 0xa0a0a0, { metalness: 0.8 });
    axeHead.position.set(side * 0.26 * s, 0.65 * s, 0.06 * s);
    g.add(axeHead);
  });
  return g;
}

function buildCleric(s: number): THREE.Group {
  const g = new THREE.Group();
  // Flowing robe body
  const body = m(new THREE.CylinderGeometry(0.18 * s, 0.35 * s, 0.7 * s, 8), 0x10b981);
  body.position.y = 0.35 * s;
  g.add(body);
  // Robe trim
  const trim = m(new THREE.CylinderGeometry(0.36 * s, 0.37 * s, 0.06 * s, 8), 0xfacc15, { metalness: 0.5 });
  trim.position.y = 0.04 * s;
  g.add(trim);
  // Head
  const head = m(new THREE.SphereGeometry(0.14 * s, 8, 6), 0xfcd9b0);
  head.position.y = 0.8 * s;
  g.add(head);
  // Hood
  const hood = m(new THREE.ConeGeometry(0.2 * s, 0.22 * s, 6), 0x047857);
  hood.position.y = 0.93 * s;
  g.add(hood);
  // Floating holy symbol (octahedron)
  const symbol = m(new THREE.OctahedronGeometry(0.12 * s), 0xfbbf24, {
    emissive: 0xf59e0b, emissiveIntensity: 0.8, metalness: 0.6
  });
  symbol.position.set(0, 1.15 * s, 0.2 * s);
  symbol.name = 'floating';
  g.add(symbol);
  // Staff
  const staff = m(new THREE.CylinderGeometry(0.02 * s, 0.025 * s, 0.9 * s, 4), 0x8B6914);
  staff.position.set(0.24 * s, 0.45 * s, 0);
  g.add(staff);
  // Staff top crystal
  const crystal = m(new THREE.OctahedronGeometry(0.06 * s), 0x34d399, { emissive: 0x10b981, emissiveIntensity: 0.6 });
  crystal.position.set(0.24 * s, 0.95 * s, 0);
  g.add(crystal);
  return g;
}

function buildPaladin(s: number): THREE.Group {
  const g = new THREE.Group();
  // Heavy golden plate torso
  const body = m(new THREE.BoxGeometry(0.5 * s, 0.6 * s, 0.35 * s), 0xf59e0b, { metalness: 0.7, roughness: 0.25 });
  body.position.y = 0.35 * s;
  g.add(body);
  // Ornate pauldrons
  [-1, 1].forEach(side => {
    const pauldron = m(new THREE.BoxGeometry(0.18 * s, 0.1 * s, 0.2 * s), 0xeab308, { metalness: 0.8 });
    pauldron.position.set(side * 0.32 * s, 0.6 * s, 0);
    g.add(pauldron);
    // Pauldron spike
    const spike = m(new THREE.ConeGeometry(0.04 * s, 0.12 * s, 4), 0xfacc15, { metalness: 0.8 });
    spike.position.set(side * 0.32 * s, 0.7 * s, 0);
    g.add(spike);
  });
  // Head
  const head = m(new THREE.SphereGeometry(0.16 * s, 8, 6), 0xfcd9b0);
  head.position.y = 0.78 * s;
  g.add(head);
  // Crown helm
  const helm = m(new THREE.CylinderGeometry(0.2 * s, 0.18 * s, 0.16 * s, 8), 0xfacc15, { metalness: 0.8, roughness: 0.2 });
  helm.position.y = 0.9 * s;
  g.add(helm);
  // Halo ring
  const halo = m(new THREE.TorusGeometry(0.22 * s, 0.02 * s, 6, 16), 0xfde68a, {
    emissive: 0xfbbf24, emissiveIntensity: 0.9
  });
  halo.position.y = 1.05 * s;
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  // Warhammer
  const hammerShaft = m(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 0.7 * s, 4), 0x8B6914);
  hammerShaft.position.set(0.34 * s, 0.5 * s, 0);
  g.add(hammerShaft);
  const hammerHead = m(new THREE.BoxGeometry(0.12 * s, 0.18 * s, 0.12 * s), 0xd4d4d4, { metalness: 0.9, roughness: 0.15 });
  hammerHead.position.set(0.34 * s, 0.88 * s, 0);
  g.add(hammerHead);
  return g;
}

function buildArchmage(s: number): THREE.Group {
  const g = new THREE.Group();
  // Robes (cone shape)
  const robe = m(new THREE.ConeGeometry(0.3 * s, 0.75 * s, 8), 0x8b5cf6);
  robe.position.y = 0.38 * s;
  g.add(robe);
  // Robe belt
  const belt = m(new THREE.CylinderGeometry(0.18 * s, 0.2 * s, 0.06 * s, 8), 0xfacc15, { metalness: 0.5 });
  belt.position.y = 0.5 * s;
  g.add(belt);
  // Head
  const head = m(new THREE.SphereGeometry(0.14 * s, 8, 6), 0xfcd9b0);
  head.position.y = 0.82 * s;
  g.add(head);
  // Wizard hat
  const hatBrim = m(new THREE.CylinderGeometry(0.25 * s, 0.26 * s, 0.04 * s, 8), 0x6d28d9);
  hatBrim.position.y = 0.9 * s;
  g.add(hatBrim);
  const hatCone = m(new THREE.ConeGeometry(0.15 * s, 0.4 * s, 6), 0x6d28d9);
  hatCone.position.y = 1.12 * s;
  hatCone.rotation.z = 0.15; // Slight tilt
  g.add(hatCone);
  // Hat star
  const star = m(new THREE.OctahedronGeometry(0.04 * s), 0xfde68a, { emissive: 0xfbbf24, emissiveIntensity: 1.0 });
  star.position.y = 1.33 * s;
  g.add(star);
  // Staff
  const staff = m(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 1.1 * s, 4), 0x5b21b6);
  staff.position.set(0.28 * s, 0.55 * s, 0);
  g.add(staff);
  // Floating orb
  const orb = m(new THREE.SphereGeometry(0.1 * s, 10, 8), 0xc084fc, {
    emissive: 0xa855f7, emissiveIntensity: 0.9
  });
  orb.position.set(0.28 * s, 1.15 * s, 0);
  orb.name = 'floating';
  g.add(orb);
  return g;
}

function buildPyroGolem(s: number): THREE.Group {
  const g = new THREE.Group();
  // Legs (two cylinders)
  [-1, 1].forEach(side => {
    const leg = m(new THREE.CylinderGeometry(0.12 * s, 0.14 * s, 0.35 * s, 5), 0x78350f);
    leg.position.set(side * 0.15 * s, 0.18 * s, 0);
    g.add(leg);
  });
  // Massive body block
  const body = m(new THREE.BoxGeometry(0.65 * s, 0.7 * s, 0.5 * s), 0xd97706, { metalness: 0.4, roughness: 0.6 });
  body.position.y = 0.7 * s;
  g.add(body);
  // Molten crack lines (emissive strips)
  [0.55, 0.7, 0.85].forEach(yOff => {
    const crack = m(new THREE.BoxGeometry(0.6 * s, 0.03 * s, 0.01 * s), 0xfb923c, {
      emissive: 0xf97316, emissiveIntensity: 1.0
    });
    crack.position.set(0, yOff * s, 0.26 * s);
    g.add(crack);
  });
  // Block head
  const head = m(new THREE.BoxGeometry(0.35 * s, 0.3 * s, 0.3 * s), 0x92400e, { metalness: 0.4 });
  head.position.y = 1.2 * s;
  g.add(head);
  // Glowing eyes
  [-1, 1].forEach(side => {
    const eye = m(new THREE.SphereGeometry(0.05 * s, 6, 4), 0xff6b00, {
      emissive: 0xff4500, emissiveIntensity: 1.5
    });
    eye.position.set(side * 0.1 * s, 1.22 * s, 0.16 * s);
    g.add(eye);
  });
  // Massive fists
  [-1, 1].forEach(side => {
    const arm = m(new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 0.4 * s, 5), 0x92400e);
    arm.position.set(side * 0.42 * s, 0.65 * s, 0);
    g.add(arm);
    const fist = m(new THREE.BoxGeometry(0.18 * s, 0.2 * s, 0.18 * s), 0xd97706, { metalness: 0.5 });
    fist.position.set(side * 0.42 * s, 0.4 * s, 0);
    g.add(fist);
  });
  return g;
}

function buildSoldier(s: number): THREE.Group {
  const g = new THREE.Group();

  // Armored greaves & sabatons
  [-1, 1].forEach(side => {
    const boot = m(new THREE.BoxGeometry(0.14 * s, 0.18 * s, 0.22 * s), 0x334155, { metalness: 0.6 });
    boot.position.set(side * 0.13 * s, 0.09 * s, 0.04 * s);
    g.add(boot);
    const greave = m(new THREE.CylinderGeometry(0.07 * s, 0.08 * s, 0.26 * s, 6), 0x475569, { metalness: 0.7 });
    greave.position.set(side * 0.13 * s, 0.22 * s, 0);
    g.add(greave);
  });

  // Royal blue tabard over chainmail
  const tabard = m(new THREE.BoxGeometry(0.44 * s, 0.5 * s, 0.28 * s), 0x1d4ed8);
  tabard.position.y = 0.42 * s;
  g.add(tabard);

  // Polished steel breastplate
  const breastplate = m(new THREE.BoxGeometry(0.42 * s, 0.32 * s, 0.18 * s), 0x3b82f6, { metalness: 0.75, roughness: 0.25 });
  breastplate.position.set(0, 0.52 * s, 0.08 * s);
  g.add(breastplate);

  // Golden lion/sunburst chest insignia
  const crest = m(new THREE.OctahedronGeometry(0.07 * s), 0xfacc15, { metalness: 0.85, roughness: 0.2 });
  crest.position.set(0, 0.54 * s, 0.18 * s);
  g.add(crest);

  // Sculpted steel pauldrons with gold bevels
  [-1, 1].forEach(side => {
    const pauldron = m(new THREE.BoxGeometry(0.18 * s, 0.14 * s, 0.26 * s), 0x2563eb, { metalness: 0.7 });
    pauldron.position.set(side * 0.32 * s, 0.68 * s, 0);
    g.add(pauldron);

    const rim = m(new THREE.BoxGeometry(0.2 * s, 0.03 * s, 0.28 * s), 0xfacc15, { metalness: 0.85 });
    rim.position.set(side * 0.32 * s, 0.74 * s, 0);
    g.add(rim);
  });

  // Head with chin and eyes
  const head = m(new THREE.SphereGeometry(0.15 * s, 8, 6), 0xfcd9b0);
  head.position.set(0, 0.82 * s, 0.02 * s);
  g.add(head);

  // Knightly helmet with visor slit & crest
  const helm = m(new THREE.CylinderGeometry(0.18 * s, 0.19 * s, 0.22 * s, 8), 0x3b82f6, { metalness: 0.75, roughness: 0.2 });
  helm.position.set(0, 0.92 * s, 0.02 * s);
  g.add(helm);

  const visorSlit = m(new THREE.BoxGeometry(0.14 * s, 0.035 * s, 0.05 * s), 0x0f172a);
  visorSlit.position.set(0, 0.88 * s, 0.19 * s);
  g.add(visorSlit);

  // Blue horsehair crest plume atop helmet
  const plume = m(new THREE.BoxGeometry(0.04 * s, 0.24 * s, 0.26 * s), 0x1e40af);
  plume.position.set(0, 1.1 * s, -0.02 * s);
  g.add(plume);

  // Knightly Arming Sword (Right hand)
  const swordGroup = new THREE.Group();
  swordGroup.position.set(0.34 * s, 0.55 * s, 0.08 * s);

  const blade = m(new THREE.BoxGeometry(0.045 * s, 0.72 * s, 0.02 * s), 0xd4d4d4, { metalness: 0.9, roughness: 0.15 });
  blade.position.y = 0.36 * s;
  swordGroup.add(blade);

  const fuller = m(new THREE.BoxGeometry(0.015 * s, 0.5 * s, 0.022 * s), 0x94a3b8, { metalness: 0.8 });
  fuller.position.y = 0.36 * s;
  swordGroup.add(fuller);

  const crossguard = m(new THREE.BoxGeometry(0.18 * s, 0.03 * s, 0.05 * s), 0xfacc15, { metalness: 0.85 });
  swordGroup.add(crossguard);

  const grip = m(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.14 * s, 4), 0x451a03);
  grip.position.y = -0.08 * s;
  swordGroup.add(grip);

  const pommel = m(new THREE.SphereGeometry(0.035 * s, 6, 4), 0xfacc15, { metalness: 0.85 });
  pommel.position.y = -0.16 * s;
  swordGroup.add(pommel);

  g.add(swordGroup);

  // Large Royal Heater Shield (Left arm)
  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(-0.35 * s, 0.48 * s, 0.12 * s);
  shieldGroup.rotation.y = Math.PI / 6;

  // Heater shield body
  const shieldMain = m(new THREE.BoxGeometry(0.06 * s, 0.52 * s, 0.34 * s), 0x1d4ed8, { metalness: 0.6 });
  shieldGroup.add(shieldMain);

  // Golden cross on shield
  const shieldCrossV = m(new THREE.BoxGeometry(0.075 * s, 0.4 * s, 0.05 * s), 0xfacc15, { metalness: 0.85 });
  shieldCrossV.position.x = -0.01 * s;
  shieldGroup.add(shieldCrossV);

  const shieldCrossH = m(new THREE.BoxGeometry(0.075 * s, 0.05 * s, 0.22 * s), 0xfacc15, { metalness: 0.85 });
  shieldCrossH.position.set(-0.01 * s, 0.08 * s, 0);
  shieldGroup.add(shieldCrossH);

  g.add(shieldGroup);

  // Floating Champion Star
  const glow = m(new THREE.OctahedronGeometry(0.07 * s), 0x60a5fa, {
    emissive: 0x3b82f6,
    emissiveIntensity: 1.3,
    transparent: true,
    opacity: 0.7
  });
  glow.position.set(0, 1.3 * s, 0);
  glow.name = 'floating';
  g.add(glow);

  return g;
}

function buildArcher(s: number): THREE.Group {
  const g = new THREE.Group();

  // 1. Leather boots & leggings
  [-1, 1].forEach(side => {
    const boot = m(new THREE.BoxGeometry(0.12 * s, 0.16 * s, 0.18 * s), 0x451a03, { roughness: 0.8 });
    boot.position.set(side * 0.11 * s, 0.08 * s, 0.02 * s);
    g.add(boot);
    const leg = m(new THREE.CylinderGeometry(0.06 * s, 0.07 * s, 0.28 * s, 6), 0x27272a);
    leg.position.set(side * 0.11 * s, 0.22 * s, 0);
    g.add(leg);
  });

  // 2. Forest Ranger Tunic (rich moss green)
  const tunic = m(new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.45 * s, 7), 0x166534);
  tunic.position.y = 0.42 * s;
  g.add(tunic);

  // 3. Studded Leather Cuirass / Brigandine
  const cuirass = m(new THREE.BoxGeometry(0.36 * s, 0.34 * s, 0.26 * s), 0x78350f, { roughness: 0.7 });
  cuirass.position.set(0, 0.48 * s, 0);
  g.add(cuirass);

  // Crossed utility harness & brass chest buckle
  const strapA = m(new THREE.BoxGeometry(0.04 * s, 0.38 * s, 0.28 * s), 0x451a03);
  strapA.position.set(0, 0.48 * s, 0);
  strapA.rotation.z = 0.45;
  g.add(strapA);

  const buckle = m(new THREE.BoxGeometry(0.06 * s, 0.06 * s, 0.02 * s), 0xd97706, { metalness: 0.8 });
  buckle.position.set(0, 0.52 * s, 0.14 * s);
  g.add(buckle);

  // Belt & hip pouch with sheathed hunting dagger
  const belt = m(new THREE.CylinderGeometry(0.24 * s, 0.25 * s, 0.05 * s, 8), 0x451a03);
  belt.position.y = 0.32 * s;
  g.add(belt);

  const pouch = m(new THREE.BoxGeometry(0.08 * s, 0.1 * s, 0.08 * s), 0x5c3317);
  pouch.position.set(0.18 * s, 0.32 * s, 0.05 * s);
  g.add(pouch);

  const daggerHandle = m(new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.12 * s, 4), 0xd4d4d4, { metalness: 0.7 });
  daggerHandle.position.set(0.18 * s, 0.42 * s, 0.05 * s);
  daggerHandle.rotation.x = -0.3;
  g.add(daggerHandle);

  // 4. Arms & Archery Bracers
  // Left arm (holds the bow extended forward-left)
  const leftArm = m(new THREE.CylinderGeometry(0.055 * s, 0.06 * s, 0.32 * s, 5), 0x166534);
  leftArm.position.set(-0.24 * s, 0.52 * s, 0.1 * s);
  leftArm.rotation.x = Math.PI / 4;
  leftArm.rotation.z = Math.PI / 6;
  g.add(leftArm);

  // Leather forearm bracer on left wrist (protects arm from bowstring recoil)
  const bracer = m(new THREE.CylinderGeometry(0.065 * s, 0.07 * s, 0.16 * s, 6), 0x78350f, { roughness: 0.6 });
  bracer.position.set(-0.3 * s, 0.5 * s, 0.22 * s);
  bracer.rotation.x = Math.PI / 4;
  g.add(bracer);

  // Right arm (draw hand near chest/shoulder)
  const rightArm = m(new THREE.CylinderGeometry(0.055 * s, 0.06 * s, 0.28 * s, 5), 0x166534);
  rightArm.position.set(0.24 * s, 0.52 * s, 0);
  rightArm.rotation.x = -Math.PI / 6;
  rightArm.rotation.z = -Math.PI / 8;
  g.add(rightArm);

  // 5. Head & Sculpted Ranger Cowl
  const head = m(new THREE.SphereGeometry(0.15 * s, 8, 6), 0xfcd9b0);
  head.position.set(0, 0.78 * s, 0.02 * s);
  g.add(head);

  // Keen hunter eyes
  [-1, 1].forEach(side => {
    const eye = m(new THREE.SphereGeometry(0.025 * s, 4, 4), 0x0f172a);
    eye.position.set(side * 0.055 * s, 0.79 * s, 0.15 * s);
    g.add(eye);
  });

  // Shoulder mantle/cowl draping over shoulders
  const mantle = m(new THREE.ConeGeometry(0.28 * s, 0.22 * s, 7), 0x14532d);
  mantle.position.set(0, 0.72 * s, -0.02 * s);
  g.add(mantle);

  // Deep ranger hood framing the face with pointed back peak
  const hood = m(new THREE.ConeGeometry(0.22 * s, 0.3 * s, 6), 0x166534);
  hood.position.set(0, 0.94 * s, -0.04 * s);
  hood.rotation.x = -0.2;
  g.add(hood);

  // 6. Recurve Longbow (Held proudly in left hand)
  const bowGroup = new THREE.Group();
  bowGroup.position.set(-0.36 * s, 0.54 * s, 0.28 * s);
  bowGroup.rotation.y = Math.PI / 4;
  bowGroup.rotation.z = -0.1;

  // Central leather grip wrap
  const bowGrip = m(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.16 * s, 6), 0x451a03);
  bowGroup.add(bowGrip);

  // Upper recurve limb
  const upperLimb = m(new THREE.CylinderGeometry(0.022 * s, 0.028 * s, 0.42 * s, 5), 0x92400e);
  upperLimb.position.set(0, 0.26 * s, -0.04 * s);
  upperLimb.rotation.x = -0.22;
  bowGroup.add(upperLimb);

  const upperTip = m(new THREE.ConeGeometry(0.02 * s, 0.12 * s, 4), 0x78350f);
  upperTip.position.set(0, 0.48 * s, -0.02 * s);
  upperTip.rotation.x = 0.35;
  bowGroup.add(upperTip);

  // Lower recurve limb
  const lowerLimb = m(new THREE.CylinderGeometry(0.028 * s, 0.022 * s, 0.42 * s, 5), 0x92400e);
  lowerLimb.position.set(0, -0.26 * s, -0.04 * s);
  lowerLimb.rotation.x = 0.22;
  bowGroup.add(lowerLimb);

  const lowerTip = m(new THREE.ConeGeometry(0.02 * s, 0.12 * s, 4), 0x78350f);
  lowerTip.position.set(0, -0.48 * s, -0.02 * s);
  lowerTip.rotation.x = -0.35;
  bowGroup.add(lowerTip);

  // Taut silver bowstring
  const string = m(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.96 * s, 3), 0xf1f5f9, { roughness: 0.3 });
  string.position.set(0, 0, -0.09 * s);
  bowGroup.add(string);

  // Nocked Arrow on the bow
  const arrowShaft = m(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.65 * s, 4), 0xa16207);
  arrowShaft.position.set(0.02 * s, 0, 0.12 * s);
  arrowShaft.rotation.x = Math.PI / 2;
  bowGroup.add(arrowShaft);

  // Steel broadhead tip
  const broadhead = m(new THREE.ConeGeometry(0.025 * s, 0.09 * s, 4), 0xc0c0c0, { metalness: 0.9, roughness: 0.2 });
  broadhead.position.set(0.02 * s, 0, 0.46 * s);
  broadhead.rotation.x = Math.PI / 2;
  bowGroup.add(broadhead);

  g.add(bowGroup);

  // 7. Diagonal Back Quiver with Fletched Arrows
  const quiverGroup = new THREE.Group();
  quiverGroup.position.set(0.12 * s, 0.58 * s, -0.16 * s);
  quiverGroup.rotation.z = -0.35;
  quiverGroup.rotation.x = -0.2;

  // Stitched leather quiver cylinder
  const quiverBody = m(new THREE.CylinderGeometry(0.08 * s, 0.07 * s, 0.48 * s, 6), 0x78350f, { roughness: 0.7 });
  quiverGroup.add(quiverBody);

  // Golden brass rim at top of quiver
  const quiverRim = m(new THREE.TorusGeometry(0.085 * s, 0.015 * s, 4, 8), 0xd97706, { metalness: 0.8 });
  quiverRim.position.y = 0.24 * s;
  quiverRim.rotation.x = Math.PI / 2;
  quiverGroup.add(quiverRim);

  // 3 arrows with visible shafts and split-feather fletchings (white and emerald vanes)
  [-0.035, 0, 0.035].forEach((xOff, i) => {
    const shaft = m(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.35 * s, 3), 0xa16207);
    shaft.position.set(xOff * s, 0.32 * s + i * 0.02 * s, 0);
    quiverGroup.add(shaft);

    const featherL = m(new THREE.BoxGeometry(0.035 * s, 0.08 * s, 0.004 * s), 0xf8fafc);
    featherL.position.set(xOff * s - 0.015 * s, 0.42 * s + i * 0.02 * s, 0);
    featherL.rotation.z = 0.15;
    quiverGroup.add(featherL);

    const featherR = m(new THREE.BoxGeometry(0.035 * s, 0.08 * s, 0.004 * s), 0x22c55e);
    featherR.position.set(xOff * s + 0.015 * s, 0.42 * s + i * 0.02 * s, 0);
    featherR.rotation.z = -0.15;
    quiverGroup.add(featherR);
  });

  g.add(quiverGroup);

  // 8. Champion Wind / Ranger Aura Mote
  const featherGlow = m(new THREE.OctahedronGeometry(0.06 * s), 0x34d399, {
    emissive: 0x10b981,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.75
  });
  featherGlow.position.set(0, 1.25 * s, 0);
  featherGlow.name = 'floating';
  g.add(featherGlow);

  return g;
}

function buildMage(s: number): THREE.Group {
  const g = new THREE.Group();

  // 1. Layered Flowing Robe Skirt (Imperial Violet with Gold Hem)
  const robeSkirt = m(new THREE.ConeGeometry(0.35 * s, 0.7 * s, 9), 0x6d28d9, { roughness: 0.6 });
  robeSkirt.position.y = 0.35 * s;
  g.add(robeSkirt);

  // Embroidered gold trim along robe bottom
  const goldHem = m(new THREE.CylinderGeometry(0.355 * s, 0.36 * s, 0.06 * s, 9), 0xf59e0b, {
    metalness: 0.85,
    roughness: 0.25
  });
  goldHem.position.y = 0.04 * s;
  g.add(goldHem);

  // Midnight blue inner cassock fold in front
  const innerFold = m(new THREE.BoxGeometry(0.12 * s, 0.62 * s, 0.02 * s), 0x1e1b4b);
  innerFold.position.set(0, 0.36 * s, 0.26 * s);
  g.add(innerFold);

  // 2. Torso with Robe Mantle & Arcane Sash
  const torso = m(new THREE.CylinderGeometry(0.22 * s, 0.26 * s, 0.42 * s, 8), 0x7c3aed);
  torso.position.y = 0.62 * s;
  g.add(torso);

  // Arcane sash belt with golden runic buckle & hanging ribbon tails
  const sash = m(new THREE.CylinderGeometry(0.24 * s, 0.25 * s, 0.07 * s, 8), 0xf59e0b, { metalness: 0.8 });
  sash.position.y = 0.48 * s;
  g.add(sash);

  const sashTail = m(new THREE.BoxGeometry(0.08 * s, 0.28 * s, 0.02 * s), 0xd97706);
  sashTail.position.set(-0.04 * s, 0.34 * s, 0.25 * s);
  g.add(sashTail);

  // Shoulder mantle
  const mantle = m(new THREE.BoxGeometry(0.52 * s, 0.12 * s, 0.3 * s), 0x5b21b6, { roughness: 0.5 });
  mantle.position.set(0, 0.76 * s, 0);
  g.add(mantle);

  // Wide, billowing wizard sleeves on both arms
  [-1, 1].forEach(side => {
    const sleeve = m(new THREE.ConeGeometry(0.13 * s, 0.36 * s, 6), 0x6d28d9);
    sleeve.position.set(side * 0.28 * s, 0.62 * s, 0.02 * s);
    sleeve.rotation.z = side * -0.4;
    sleeve.rotation.x = 0.1;
    g.add(sleeve);
    // Gold sleeve cuff
    const cuff = m(new THREE.TorusGeometry(0.12 * s, 0.015 * s, 4, 8), 0xf59e0b, { metalness: 0.8 });
    cuff.position.set(side * 0.34 * s, 0.48 * s, 0.04 * s);
    cuff.rotation.y = Math.PI / 2;
    g.add(cuff);
  });

  // 3. Thick Leather-Bound Grimoire / Spell Tome (strapped to hip)
  const grimoireGroup = new THREE.Group();
  grimoireGroup.position.set(-0.24 * s, 0.46 * s, 0.08 * s);
  grimoireGroup.rotation.y = -0.3;
  grimoireGroup.rotation.z = 0.15;

  // Tome cover in rich crimson leather
  const bookCover = m(new THREE.BoxGeometry(0.09 * s, 0.24 * s, 0.18 * s), 0x4c0519, { roughness: 0.7 });
  grimoireGroup.add(bookCover);

  // Golden spine & corner braces
  const bookSpine = m(new THREE.BoxGeometry(0.095 * s, 0.245 * s, 0.03 * s), 0xf59e0b, { metalness: 0.85 });
  bookSpine.position.z = -0.08 * s;
  grimoireGroup.add(bookSpine);

  // Golden runic seal on front cover
  const bookSeal = m(new THREE.OctahedronGeometry(0.035 * s), 0xfacc15, { metalness: 0.9 });
  bookSeal.position.set(0.048 * s, 0, 0);
  grimoireGroup.add(bookSeal);

  // Glowing arcane bookmark ribbon hanging from pages
  const ribbon = m(new THREE.BoxGeometry(0.015 * s, 0.12 * s, 0.04 * s), 0xc084fc, {
    emissive: 0xa855f7,
    emissiveIntensity: 1.0
  });
  ribbon.position.set(0, -0.15 * s, 0.04 * s);
  grimoireGroup.add(ribbon);

  g.add(grimoireGroup);

  // 4. Head & The Iconic Pointed Wizard Hat
  const head = m(new THREE.SphereGeometry(0.15 * s, 8, 6), 0xfcd9b0);
  head.position.set(0, 0.86 * s, 0.02 * s);
  g.add(head);

  // Mystic grey/white beard
  const beard = m(new THREE.ConeGeometry(0.12 * s, 0.28 * s, 5), 0xe2e8f0, { roughness: 0.9 });
  beard.position.set(0, 0.75 * s, 0.12 * s);
  beard.rotation.x = -0.2;
  g.add(beard);

  // Wide flared wizard hat brim
  const hatBrim = m(new THREE.CylinderGeometry(0.35 * s, 0.37 * s, 0.035 * s, 12), 0x4c1d95, { roughness: 0.5 });
  hatBrim.position.set(0, 0.98 * s, 0.02 * s);
  hatBrim.rotation.x = -0.08;
  g.add(hatBrim);

  // Golden hatband with mystical buckle
  const hatBand = m(new THREE.CylinderGeometry(0.21 * s, 0.22 * s, 0.06 * s, 10), 0xf59e0b, { metalness: 0.85 });
  hatBand.position.set(0, 1.03 * s, 0.02 * s);
  hatBand.rotation.x = -0.08;
  g.add(hatBand);

  const hatBuckle = m(new THREE.BoxGeometry(0.06 * s, 0.06 * s, 0.02 * s), 0xfde68a, { metalness: 0.9 });
  hatBuckle.position.set(0, 1.03 * s, 0.23 * s);
  g.add(hatBuckle);

  // Tall crumpled pointed cone with wizardly tilt!
  const hatCone = m(new THREE.ConeGeometry(0.19 * s, 0.46 * s, 8), 0x5b21b6, { roughness: 0.5 });
  hatCone.position.set(0.03 * s, 1.25 * s, -0.04 * s);
  hatCone.rotation.z = 0.22;
  hatCone.rotation.x = -0.25;
  g.add(hatCone);

  // Golden mystical tip charm
  const starTip = m(new THREE.OctahedronGeometry(0.04 * s), 0xfde68a, {
    emissive: 0xf59e0b,
    emissiveIntensity: 1.2
  });
  starTip.position.set(0.09 * s, 1.48 * s, -0.12 * s);
  g.add(starTip);

  // 5. Arcane Pyromancer Staff (Tall, twisted darkwood with flaming core)
  const staffGroup = new THREE.Group();
  staffGroup.position.set(0.34 * s, 0.65 * s, 0.12 * s);

  // Twisted darkwood shaft
  const staffShaft = m(new THREE.CylinderGeometry(0.024 * s, 0.028 * s, 1.35 * s, 6), 0x18181b, { roughness: 0.8 });
  staffGroup.add(staffShaft);

  // Golden staff head double crescent / astrolabe crown
  const crownLower = m(new THREE.TorusGeometry(0.12 * s, 0.02 * s, 4, 10, Math.PI), 0xf59e0b, { metalness: 0.9 });
  crownLower.position.y = 0.62 * s;
  crownLower.rotation.z = Math.PI;
  staffGroup.add(crownLower);

  const crownUpper = m(new THREE.TorusGeometry(0.14 * s, 0.022 * s, 4, 10, Math.PI), 0xf59e0b, { metalness: 0.9 });
  crownUpper.position.y = 0.72 * s;
  staffGroup.add(crownUpper);

  // Floating, pulsing fiery core orb!
  const flameCore = m(new THREE.SphereGeometry(0.11 * s, 10, 8), 0xff4500, {
    emissive: 0xff2200,
    emissiveIntensity: 2.2
  });
  flameCore.position.y = 0.74 * s;
  flameCore.name = 'floating';
  staffGroup.add(flameCore);

  // Orbiting arcane crystal sparks
  const spark1 = m(new THREE.OctahedronGeometry(0.04 * s), 0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 1.8 });
  spark1.position.set(0.15 * s, 0.78 * s, 0);
  spark1.name = 'rotating';
  staffGroup.add(spark1);

  const spark2 = m(new THREE.OctahedronGeometry(0.035 * s), 0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 1.8 });
  spark2.position.set(-0.14 * s, 0.7 * s, 0.08 * s);
  spark2.name = 'rotating';
  staffGroup.add(spark2);

  g.add(staffGroup);

  // 6. Spinning Mana Aura Halo
  const manaHalo = m(new THREE.TorusGeometry(0.3 * s, 0.02 * s, 6, 16), 0xa855f7, {
    emissive: 0x9333ea,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.6
  });
  manaHalo.position.set(0, 1.08 * s, 0);
  manaHalo.rotation.x = Math.PI / 2;
  manaHalo.name = 'rotating';
  g.add(manaHalo);

  return g;
}

// ─── ENEMY UNIT BUILDERS ───────────────────────────────────

function buildGoblin(s: number): THREE.Group {
  const g = new THREE.Group();

  // Hunched green body
  const body = m(new THREE.CylinderGeometry(0.18 * s, 0.24 * s, 0.42 * s, 5), 0x84cc16);
  body.position.set(0, 0.24 * s, 0.04 * s);
  body.rotation.x = 0.15; // hunched forward
  g.add(body);

  // Stitched ragged leather vest
  const vest = m(new THREE.BoxGeometry(0.3 * s, 0.3 * s, 0.24 * s), 0x713f12, { roughness: 0.9 });
  vest.position.set(0, 0.26 * s, 0.04 * s);
  g.add(vest);

  // Head (wide goblin head)
  const head = m(new THREE.SphereGeometry(0.18 * s, 8, 6), 0x65a30d);
  head.position.set(0, 0.54 * s, 0.08 * s);
  g.add(head);

  // Pointy flared ears
  [-1, 1].forEach(side => {
    const ear = m(new THREE.ConeGeometry(0.05 * s, 0.22 * s, 3), 0x65a30d);
    ear.position.set(side * 0.2 * s, 0.58 * s, 0.04 * s);
    ear.rotation.z = side * 0.85;
    g.add(ear);
  });

  // Golden hoop earring on right ear!
  const earring = m(new THREE.TorusGeometry(0.04 * s, 0.01 * s, 4, 8), 0xfacc15, { metalness: 0.9 });
  earring.position.set(0.24 * s, 0.54 * s, 0.04 * s);
  g.add(earring);

  // Beady malicious eyes
  [-1, 1].forEach(side => {
    const eye = m(new THREE.SphereGeometry(0.035 * s, 5, 4), 0xfef08a, { emissive: 0xeab308, emissiveIntensity: 0.6 });
    eye.position.set(side * 0.07 * s, 0.58 * s, 0.22 * s);
    g.add(eye);
  });

  // Curved wicked iron scimitar in right hand
  const scimitarGroup = new THREE.Group();
  scimitarGroup.position.set(0.24 * s, 0.35 * s, 0.08 * s);

  const blade = m(new THREE.BoxGeometry(0.03 * s, 0.35 * s, 0.08 * s), 0x78716c, { metalness: 0.7, roughness: 0.3 });
  blade.rotation.x = -0.3;
  scimitarGroup.add(blade);
  g.add(scimitarGroup);

  // Spiked wooden buckler on left arm
  const buckler = m(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.03 * s, 6), 0x451a03);
  buckler.position.set(-0.24 * s, 0.32 * s, 0.08 * s);
  buckler.rotation.z = Math.PI / 2;
  g.add(buckler);

  const spike = m(new THREE.ConeGeometry(0.03 * s, 0.08 * s, 4), 0x78716c, { metalness: 0.8 });
  spike.position.set(-0.26 * s, 0.32 * s, 0.08 * s);
  spike.rotation.z = Math.PI / 2;
  g.add(spike);

  return g;
}

function buildOrcWarrior(s: number): THREE.Group {
  const g = new THREE.Group();

  // Muscular brute body
  const body = m(new THREE.CylinderGeometry(0.34 * s, 0.38 * s, 0.68 * s, 6), 0xb45309, { roughness: 0.7 });
  body.position.y = 0.38 * s;
  g.add(body);

  // Heavy leather harness & iron studs
  const harness = m(new THREE.BoxGeometry(0.06 * s, 0.7 * s, 0.42 * s), 0x713f12);
  harness.position.set(0, 0.4 * s, 0);
  harness.rotation.z = 0.35;
  g.add(harness);

  // Spiked iron pauldron on forward shoulder
  const pauldron = m(new THREE.BoxGeometry(0.24 * s, 0.15 * s, 0.28 * s), 0x44403c, { metalness: 0.7 });
  pauldron.position.set(-0.35 * s, 0.68 * s, 0);
  g.add(pauldron);

  const pauldronSpike = m(new THREE.ConeGeometry(0.05 * s, 0.16 * s, 4), 0x78716c, { metalness: 0.8 });
  pauldronSpike.position.set(-0.35 * s, 0.82 * s, 0);
  g.add(pauldronSpike);

  // Fierce orc head
  const head = m(new THREE.SphereGeometry(0.2 * s, 8, 6), 0x92400e);
  head.position.set(0, 0.84 * s, 0.04 * s);
  g.add(head);

  // Lower jaw tusks
  [-1, 1].forEach(side => {
    const tusk = m(new THREE.ConeGeometry(0.04 * s, 0.16 * s, 4), 0xfef3c7, { roughness: 0.5 });
    tusk.position.set(side * 0.11 * s, 0.78 * s, 0.18 * s);
    tusk.rotation.x = -0.4;
    g.add(tusk);
  });

  // Horned iron skullcap
  const helm = m(new THREE.CylinderGeometry(0.19 * s, 0.22 * s, 0.14 * s, 6), 0x3f3f46, { metalness: 0.75 });
  helm.position.set(0, 0.94 * s, 0.04 * s);
  g.add(helm);

  [-1, 1].forEach(side => {
    const horn = m(new THREE.ConeGeometry(0.045 * s, 0.22 * s, 4), 0x1c1917);
    horn.position.set(side * 0.2 * s, 0.98 * s, 0.04 * s);
    horn.rotation.z = side * -0.6;
    g.add(horn);
  });

  // Giant jagged war cleaver
  const handle = m(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.65 * s, 4), 0x854d0e);
  handle.position.set(0.38 * s, 0.55 * s, 0.08 * s);
  g.add(handle);

  const blade = m(new THREE.BoxGeometry(0.08 * s, 0.42 * s, 0.24 * s), 0x52525b, { metalness: 0.7, roughness: 0.25 });
  blade.position.set(0.38 * s, 0.92 * s, 0.12 * s);
  g.add(blade);

  return g;
}

function buildSkeletonArcher(s: number): THREE.Group {
  const g = new THREE.Group();

  // Ivory bone legs
  [-1, 1].forEach(side => {
    const leg = m(new THREE.CylinderGeometry(0.035 * s, 0.04 * s, 0.32 * s, 4), 0xe2e8f0, { roughness: 0.8 });
    leg.position.set(side * 0.1 * s, 0.16 * s, 0);
    g.add(leg);
    const foot = m(new THREE.BoxGeometry(0.07 * s, 0.04 * s, 0.12 * s), 0xe2e8f0, { roughness: 0.8 });
    foot.position.set(side * 0.1 * s, 0.02 * s, 0.03 * s);
    g.add(foot);
  });

  // Pelvis bone
  const pelvis = m(new THREE.BoxGeometry(0.24 * s, 0.08 * s, 0.14 * s), 0xe2e8f0, { roughness: 0.8 });
  pelvis.position.y = 0.34 * s;
  g.add(pelvis);

  // Spine and ribcage
  const spine = m(new THREE.CylinderGeometry(0.03 * s, 0.035 * s, 0.3 * s, 4), 0xe2e8f0, { roughness: 0.8 });
  spine.position.y = 0.48 * s;
  g.add(spine);

  for (let i = 0; i < 3; i++) {
    const rib = m(new THREE.TorusGeometry((0.13 - i * 0.015) * s, 0.018 * s, 4, 8, Math.PI), 0xe2e8f0, { roughness: 0.8 });
    rib.position.set(0, (0.42 + i * 0.08) * s, 0.02 * s);
    rib.rotation.x = Math.PI / 2;
    g.add(rib);
  }

  // Tattered dark shroud / cape over shoulders
  const cloak = m(new THREE.ConeGeometry(0.28 * s, 0.45 * s, 6), 0x1e293b, { roughness: 0.9 });
  cloak.position.set(0, 0.52 * s, -0.04 * s);
  g.add(cloak);

  // Skull Head
  const skull = m(new THREE.SphereGeometry(0.14 * s, 8, 6), 0xf1f5f9, { roughness: 0.85 });
  skull.position.set(0, 0.78 * s, 0.02 * s);
  g.add(skull);

  // Jaw
  const jaw = m(new THREE.BoxGeometry(0.11 * s, 0.05 * s, 0.08 * s), 0xe2e8f0);
  jaw.position.set(0, 0.68 * s, 0.06 * s);
  g.add(jaw);

  // Sunken eye sockets with piercing red eye flames!
  [-1, 1].forEach(side => {
    const socket = m(new THREE.SphereGeometry(0.038 * s, 5, 4), 0x0f172a);
    socket.position.set(side * 0.055 * s, 0.8 * s, 0.12 * s);
    g.add(socket);

    const flame = m(new THREE.SphereGeometry(0.022 * s, 4, 4), 0xff0000, {
      emissive: 0xff0000,
      emissiveIntensity: 2.5
    });
    flame.position.set(side * 0.055 * s, 0.8 * s, 0.135 * s);
    g.add(flame);
  });

  // Tattered charcoal cowl framing the skull
  const cowl = m(new THREE.ConeGeometry(0.2 * s, 0.26 * s, 6), 0x334155, { roughness: 0.9 });
  cowl.position.set(0, 0.92 * s, -0.04 * s);
  cowl.rotation.x = -0.2;
  g.add(cowl);

  // Curved Bone Recurve Bow in left hand
  const bowGroup = new THREE.Group();
  bowGroup.position.set(-0.28 * s, 0.55 * s, 0.18 * s);
  bowGroup.rotation.y = Math.PI / 4;

  const bowLimbU = m(new THREE.CylinderGeometry(0.02 * s, 0.025 * s, 0.42 * s, 4), 0xcbd5e1);
  bowLimbU.position.set(0, 0.22 * s, -0.04 * s);
  bowLimbU.rotation.x = -0.25;
  bowGroup.add(bowLimbU);

  const bowLimbL = m(new THREE.CylinderGeometry(0.025 * s, 0.02 * s, 0.42 * s, 4), 0xcbd5e1);
  bowLimbL.position.set(0, -0.22 * s, -0.04 * s);
  bowLimbL.rotation.x = 0.25;
  bowGroup.add(bowLimbL);

  const boneString = m(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.88 * s, 3), 0x475569);
  boneString.position.set(0, 0, -0.08 * s);
  bowGroup.add(boneString);

  g.add(bowGroup);

  // Bone quiver on back with black-fletched arrows
  const quiver = m(new THREE.CylinderGeometry(0.065 * s, 0.055 * s, 0.42 * s, 5), 0x3f3f46);
  quiver.position.set(0.1 * s, 0.55 * s, -0.16 * s);
  quiver.rotation.z = -0.3;
  g.add(quiver);

  [-0.02, 0.02].forEach((xOff, i) => {
    const arrow = m(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.28 * s, 3), 0xe2e8f0);
    arrow.position.set(0.1 * s + xOff * s, 0.72 * s + i * 0.02 * s, -0.16 * s);
    g.add(arrow);

    const fletch = m(new THREE.BoxGeometry(0.03 * s, 0.06 * s, 0.004 * s), 0x0f172a);
    fletch.position.set(0.1 * s + xOff * s, 0.82 * s + i * 0.02 * s, -0.16 * s);
    g.add(fletch);
  });

  return g;
}

function buildShadowAssassin(s: number): THREE.Group {
  const g = new THREE.Group();
  // Sleek dark body
  const body = m(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 0.55 * s, 6), 0x334155);
  body.position.y = 0.3 * s;
  g.add(body);
  // Dark cloak
  const cloak = m(new THREE.ConeGeometry(0.28 * s, 0.5 * s, 6), 0x1e293b, { transparent: true, opacity: 0.85 });
  cloak.position.y = 0.32 * s;
  g.add(cloak);
  // Head — mostly hidden in hood
  const head = m(new THREE.SphereGeometry(0.13 * s, 8, 6), 0x1e293b);
  head.position.y = 0.68 * s;
  g.add(head);
  // Hood
  const hood = m(new THREE.ConeGeometry(0.18 * s, 0.2 * s, 6), 0x0f172a);
  hood.position.y = 0.82 * s;
  g.add(hood);
  // Glowing eyes in shadow
  [-1, 1].forEach(side => {
    const eye = m(new THREE.SphereGeometry(0.025 * s, 4, 3), 0xa855f7, {
      emissive: 0x7c3aed, emissiveIntensity: 1.5
    });
    eye.position.set(side * 0.055 * s, 0.7 * s, 0.12 * s);
    g.add(eye);
  });
  // Twin daggers
  [-1, 1].forEach(side => {
    const blade = m(new THREE.BoxGeometry(0.025 * s, 0.3 * s, 0.02 * s), 0x6b7280, { metalness: 0.7 });
    blade.position.set(side * 0.22 * s, 0.3 * s, 0.05 * s);
    blade.rotation.z = side * 0.2;
    g.add(blade);
    // Poison glow on blade
    const poison = m(new THREE.BoxGeometry(0.03 * s, 0.08 * s, 0.01 * s), 0x22c55e, {
      emissive: 0x16a34a, emissiveIntensity: 0.8
    });
    poison.position.set(side * 0.22 * s, 0.4 * s, 0.06 * s);
    g.add(poison);
  });
  return g;
}

function buildIroncladOgre(s: number): THREE.Group {
  const g = new THREE.Group();
  // Massive body
  const body = m(new THREE.BoxGeometry(0.6 * s, 0.75 * s, 0.5 * s), 0x78716c, { metalness: 0.5, roughness: 0.4 });
  body.position.y = 0.4 * s;
  g.add(body);
  // Armor plates on chest
  const plate = m(new THREE.BoxGeometry(0.55 * s, 0.3 * s, 0.06 * s), 0x57534e, { metalness: 0.7, roughness: 0.3 });
  plate.position.set(0, 0.5 * s, 0.27 * s);
  g.add(plate);
  // Belly armor
  const belly = m(new THREE.CylinderGeometry(0.3 * s, 0.32 * s, 0.25 * s, 6), 0x57534e, { metalness: 0.6 });
  belly.position.y = 0.2 * s;
  g.add(belly);
  // Small angry head (comically small for body size)
  const head = m(new THREE.SphereGeometry(0.16 * s, 8, 6), 0x78716c);
  head.position.y = 0.9 * s;
  g.add(head);
  // Iron helmet rivets
  const helm = m(new THREE.CylinderGeometry(0.18 * s, 0.2 * s, 0.15 * s, 6), 0x44403c, { metalness: 0.7 });
  helm.position.y = 1.0 * s;
  g.add(helm);
  // Beady red eyes
  [-1, 1].forEach(side => {
    const eye = m(new THREE.SphereGeometry(0.03 * s, 4, 3), 0xef4444, { emissive: 0xdc2626, emissiveIntensity: 0.8 });
    eye.position.set(side * 0.07 * s, 0.92 * s, 0.14 * s);
    g.add(eye);
  });
  // Giant spiked club
  const clubHandle = m(new THREE.CylinderGeometry(0.05 * s, 0.04 * s, 0.7 * s, 5), 0x8B6914);
  clubHandle.position.set(0.42 * s, 0.55 * s, 0);
  g.add(clubHandle);
  const clubHead = m(new THREE.DodecahedronGeometry(0.16 * s, 0), 0x44403c, { metalness: 0.6 });
  clubHead.position.set(0.42 * s, 0.95 * s, 0);
  g.add(clubHead);
  // Club spikes
  for (let i = 0; i < 4; i++) {
    const spike = m(new THREE.ConeGeometry(0.03 * s, 0.1 * s, 4), 0x6b7280, { metalness: 0.8 });
    const angle = (i / 4) * Math.PI * 2;
    spike.position.set(
      0.42 * s + Math.cos(angle) * 0.15 * s,
      0.95 * s,
      Math.sin(angle) * 0.15 * s
    );
    spike.rotation.z = Math.cos(angle) * 0.5;
    spike.rotation.x = Math.sin(angle) * 0.5;
    g.add(spike);
  }
  return g;
}

function buildBossLordIgnis(s: number): THREE.Group {
  const g = new THREE.Group();
  // Massive demon body
  const body = m(new THREE.BoxGeometry(0.7 * s, 0.85 * s, 0.5 * s), 0xb91c1c, {
    emissive: 0x991b1b, emissiveIntensity: 0.3, metalness: 0.4
  });
  body.position.y = 0.5 * s;
  g.add(body);
  // Fiery rune veins
  [0.35, 0.55, 0.75].forEach(yOff => {
    const vein = m(new THREE.BoxGeometry(0.65 * s, 0.03 * s, 0.01 * s), 0xfb923c, {
      emissive: 0xf97316, emissiveIntensity: 1.2
    });
    vein.position.set(0, yOff * s, 0.26 * s);
    g.add(vein);
  });
  // Shoulder armor
  [-1, 1].forEach(side => {
    const pauldron = m(new THREE.BoxGeometry(0.22 * s, 0.14 * s, 0.28 * s), 0x7f1d1d, { metalness: 0.6 });
    pauldron.position.set(side * 0.42 * s, 0.85 * s, 0);
    g.add(pauldron);
    // Shoulder spikes
    const spike = m(new THREE.ConeGeometry(0.05 * s, 0.2 * s, 4), 0x450a0a);
    spike.position.set(side * 0.42 * s, 1.0 * s, 0);
    g.add(spike);
  });
  // Demon head
  const head = m(new THREE.SphereGeometry(0.2 * s, 8, 6), 0x991b1b);
  head.position.y = 1.05 * s;
  g.add(head);
  // Horns
  [-1, 1].forEach(side => {
    const horn = m(new THREE.ConeGeometry(0.05 * s, 0.35 * s, 5), 0x1c1917);
    horn.position.set(side * 0.15 * s, 1.2 * s, 0);
    horn.rotation.z = side * -0.4;
    g.add(horn);
  });
  // Blazing eyes
  [-1, 1].forEach(side => {
    const eye = m(new THREE.SphereGeometry(0.04 * s, 5, 4), 0xff6600, {
      emissive: 0xff4400, emissiveIntensity: 2.0
    });
    eye.position.set(side * 0.08 * s, 1.08 * s, 0.17 * s);
    g.add(eye);
  });
  // Flaming sword
  const swordHandle = m(new THREE.CylinderGeometry(0.04 * s, 0.035 * s, 0.5 * s, 5), 0x1c1917);
  swordHandle.position.set(0.45 * s, 0.6 * s, 0);
  g.add(swordHandle);
  const swordBlade = m(new THREE.BoxGeometry(0.06 * s, 0.7 * s, 0.04 * s), 0xef4444, {
    emissive: 0xdc2626, emissiveIntensity: 0.8, metalness: 0.7
  });
  swordBlade.position.set(0.45 * s, 1.0 * s, 0);
  g.add(swordBlade);
  // Fire aura ring
  const auraRing = m(new THREE.TorusGeometry(0.55 * s, 0.04 * s, 6, 20), 0xf97316, {
    emissive: 0xea580c, emissiveIntensity: 1.0, transparent: true, opacity: 0.5
  });
  auraRing.position.y = 0.15 * s;
  auraRing.rotation.x = Math.PI / 2;
  auraRing.name = 'rotating';
  g.add(auraRing);
  return g;
}

// ─── PUBLIC API ─────────────────────────────────────────────

const FRIENDLY_BUILDERS: Record<FriendlyClass, (s: number) => THREE.Group> = {
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
  [FriendlyClass.MAGE]: buildMage,
};

const ENEMY_BUILDERS: Record<EnemyClass, (s: number) => THREE.Group> = {
  [EnemyClass.GOBLIN]: buildGoblin,
  [EnemyClass.ORC_WARRIOR]: buildOrcWarrior,
  [EnemyClass.SKELETON_ARCHER]: buildSkeletonArcher,
  [EnemyClass.SHADOW_ASSASSIN]: buildShadowAssassin,
  [EnemyClass.IRONCLAD_OGRE]: buildIroncladOgre,
  [EnemyClass.BOSS_LORD_IGNIS]: buildBossLordIgnis,
};

/**
 * Builds a multi-part medieval fantasy mesh for a given unit class.
 * Returns a THREE.Group where all child meshes are positioned relative to
 * ground level (y = 0 is feet level). The group can be added directly to a parent unit group.
 */
export function buildUnitMesh(
  unitClass: FriendlyClass | EnemyClass,
  isFriendly: boolean,
  scale: number
): THREE.Group {
  // The mesh follows the unit's class, not its allegiance (PvP mercenaries can fight for either side).
  const builder = isFriendlyClass(unitClass)
    ? FRIENDLY_BUILDERS[unitClass]
    : ENEMY_BUILDERS[unitClass as EnemyClass];

  if (!builder) {
    // Fallback: simple capsule
    const g = new THREE.Group();
    const body = m(new THREE.CapsuleGeometry(0.25 * scale, 0.5 * scale, 4, 8), 0x888888);
    body.position.y = 0.45 * scale;
    g.add(body);
    return g;
  }

  return builder(scale);
}

/**
 * Returns the approximate total height of a unit mesh group (for HP bar placement).
 */
export function getUnitMeshHeight(
  unitClass: FriendlyClass | EnemyClass,
  isFriendly: boolean,
  scale: number
): number {
  // Approximate heights per class for HP bar positioning
  if (isFriendlyClass(unitClass)) {
    switch (unitClass as FriendlyClass) {
      case FriendlyClass.RECRUIT: return 1.15 * scale;
      case FriendlyClass.FOOTMAN: return 1.2 * scale;
      case FriendlyClass.KNIGHT: return 1.35 * scale;
      case FriendlyClass.BERSERKER: return 1.2 * scale;
      case FriendlyClass.CLERIC: return 1.3 * scale;
      case FriendlyClass.PALADIN: return 1.45 * scale;
      case FriendlyClass.ARCHMAGE: return 1.6 * scale;
      case FriendlyClass.PYRO_GOLEM: return 1.65 * scale;
      case FriendlyClass.SOLDIER: return 1.35 * scale;
      case FriendlyClass.ARCHER: return 1.3 * scale;
      case FriendlyClass.MAGE: return 1.55 * scale; // Tall because of pointed wizard hat!
    }
  } else {
    switch (unitClass as EnemyClass) {
      case EnemyClass.GOBLIN: return 0.95 * scale;
      case EnemyClass.ORC_WARRIOR: return 1.3 * scale;
      case EnemyClass.SKELETON_ARCHER: return 1.2 * scale;
      case EnemyClass.SHADOW_ASSASSIN: return 1.2 * scale;
      case EnemyClass.IRONCLAD_OGRE: return 1.45 * scale;
      case EnemyClass.BOSS_LORD_IGNIS: return 1.75 * scale;
    }
  }
  return 1.2 * scale;
}

