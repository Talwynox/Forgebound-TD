import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MapThemeId } from '../MapThemes';
import type { GroundTextureStyle } from '../ProceduralTextures';
import { DecorPlacer, G, Mats, Rand, StaticBatch, groundHeight, xf } from './Terrain';
import {
  arcanePillar, barrel, basaltColumns, beastSkeleton, boulder, bones, bramble, brokenWagon, burntBanner, cactus, cairn,
  citadelPikes, crypt, crystalCluster, fissure, floatingRock, forge, gibbet, graveyard, hoodoo, hornedSkull, infernalEast,
  mineEntrance, mushroomCluster, obsidianSpike, orePile, plantDeadTrees, rockArch, ruinedChapel, runeCircle,
  sacrificialAltar, skullPile, snowDrift, watchtower
} from './Props';

/**
 * Per-mission scenery: each map theme gets its own ground, grass, treeline, landmarks, scattered
 * details and mist, all standing on the same flat battlefield.
 */

type RGB = [number, number, number];

/** One kind of instanced treeline silhouette (all layers share the same instance transforms). */
export interface TreeSpecies {
  layers: { geom: THREE.BufferGeometry; mat: THREE.Material }[];
  palette: number[];
  weight: number;
  scale: [number, number];
  /** Extra vertical stretch range. */
  stretch?: [number, number];
  /** Height above the ground (floating rift shards). */
  lift?: (rand: Rand) => number;
}

export interface Scenery {
  texture: GroundTextureStyle;
  /** Material colour over the ground texture. */
  groundTint: number;
  /** Floor the maze island with this theme's ground in a tint (default: the classic damp moss). */
  mazeFloor?: { tint: number };
  /** Large-scale secondary patches (straw, snow, red earth…) painted in vertex colours. */
  patch: { color: RGB; amount: number };
  /** Blight creeping out from the infernal east. */
  east: { color: RGB; amount: number };
  tufts: { palette: number[]; density: number; height: number };
  treeline: { density: number; species: () => TreeSpecies[] };
  mist: { near: number; east: number; opacity: number };
  decorate: (p: DecorPlacer, mats: Mats, lava: THREE.Material, rand: Rand) => void;
}

// ------------------------------------------------------------------
// Treeline geometry (vertex-coloured; built fresh per scenery so it can be disposed)
// ------------------------------------------------------------------

/** Paints a geometry by each vertex's local Y (before it is moved into place) and drops UVs. */
function paint(g: THREE.BufferGeometry, color: (y: number) => RGB): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) colors.push(...color(pos.getY(i)));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

const solid = (c: RGB) => () => c;
const silhouetteMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
const merge = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts.map(p => (p.index ? p.toNonIndexed() : p)))!;
  parts.forEach(p => p.dispose());
  return g;
};

const PINE_TIERS = [{ r: 1.2, h: 1.7, y: 1.8 }, { r: 0.95, h: 1.5, y: 2.7 }, { r: 0.65, h: 1.4, y: 3.6 }];
const TRUNK: RGB = [0.55, 0.38, 0.3];

/** Pine with white foliage, tinted green (or violet, or charred) per instance. */
function pine(palette: number[], weight: number): TreeSpecies {
  const parts = [paint(new THREE.CylinderGeometry(0.14, 0.24, 1.8, 5), solid(TRUNK)).translate(0, 0.9, 0)];
  PINE_TIERS.forEach(t => parts.push(paint(new THREE.ConeGeometry(t.r, t.h, 6), solid([1, 1, 1])).translate(0, t.y, 0)));
  return { layers: [{ geom: merge(parts), mat: silhouetteMat() }], palette, weight, scale: [1.5, 3.3] };
}

/** Pine whose tiers are capped with snow. */
function snowPine(weight: number): TreeSpecies {
  const parts = [paint(new THREE.CylinderGeometry(0.14, 0.24, 1.8, 5), solid(TRUNK)).translate(0, 0.9, 0)];
  PINE_TIERS.forEach(t => parts.push(paint(new THREE.ConeGeometry(t.r, t.h, 6, 3), y =>
    (y + t.h / 2) / t.h > 0.6 ? [0.88, 0.92, 0.97] : [0.13, 0.22, 0.17]).translate(0, t.y, 0)));
  return { layers: [{ geom: merge(parts), mat: silhouetteMat() }], palette: [0xffffff, 0xe8eef2, 0xd4dce2], weight, scale: [1.5, 3.3] };
}

/** Grey crag with a snowy top. */
function snowCliff(weight: number): TreeSpecies {
  const g = paint(new THREE.DodecahedronGeometry(1, 0).scale(1.3, 1.7, 1.1), y => (y > 1.2 ? [0.8, 0.84, 0.9] : [0.34, 0.36, 0.4]));
  return { layers: [{ geom: g.translate(0, 0.9, 0), mat: silhouetteMat() }], palette: [0xc8ccd2, 0xb0b6be], weight, scale: [2.5, 5.5], stretch: [0.8, 1.4] };
}

/** Flat-topped butte banded in red and ochre strata. */
function mesa(weight: number): TreeSpecies {
  const bands: { r0: number; r1: number; h: number; y: number; c: RGB }[] = [
    { r0: 1.0, r1: 1.25, h: 1.2, y: 0.6, c: [0.48, 0.24, 0.15] },
    { r0: 0.92, r1: 1.0, h: 1.4, y: 1.9, c: [0.62, 0.36, 0.22] },
    { r0: 0.85, r1: 0.92, h: 1.0, y: 3.1, c: [0.44, 0.22, 0.15] },
    { r0: 0.8, r1: 0.85, h: 0.25, y: 3.72, c: [0.68, 0.46, 0.3] }
  ];
  const g = merge(bands.map(b => paint(new THREE.CylinderGeometry(b.r0, b.r1, b.h, 7), solid(b.c)).translate(0, b.y, 0)));
  return { layers: [{ geom: g, mat: silhouetteMat() }], palette: [0xe6d6c8, 0xd2c0ae, 0xc0aa96], weight, scale: [3, 6], stretch: [0.5, 0.9] };
}

/** Tall stacked-rock spire. */
function hoodooSpire(weight: number): TreeSpecies {
  const g = merge([
    paint(new THREE.CylinderGeometry(0.5, 0.75, 2.2, 6), solid([0.7, 0.44, 0.28])).translate(0, 1.1, 0),
    paint(new THREE.DodecahedronGeometry(0.6, 0), solid([0.56, 0.3, 0.2])).translate(0, 2.5, 0),
    paint(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 6), solid([0.74, 0.48, 0.3])).translate(0, 3.5, 0),
    paint(new THREE.CylinderGeometry(0.9, 0.8, 0.4, 6), solid([0.55, 0.3, 0.2])).translate(0, 4.45, 0)
  ]);
  return { layers: [{ geom: g, mat: silhouetteMat() }], palette: [0xffffff, 0xf0dcc8], weight, scale: [1.2, 2.4] };
}

/** Saguaro silhouette. */
function saguaro(weight: number): TreeSpecies {
  const c: RGB = [0.3, 0.42, 0.24];
  const g = merge([
    paint(new THREE.CylinderGeometry(0.3, 0.32, 3.2, 7), solid(c)).translate(0, 1.6, 0),
    paint(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 6), solid(c)).rotateZ(Math.PI / 2).translate(0.4, 1.4, 0),
    paint(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 6), solid(c)).translate(0.7, 1.95, 0),
    paint(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 6), solid(c)).rotateZ(Math.PI / 2).translate(-0.35, 2.0, 0),
    paint(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 6), solid(c)).translate(-0.6, 2.35, 0)
  ]);
  return { layers: [{ geom: g, mat: silhouetteMat() }], palette: [0xffffff, 0xd8dcc8], weight, scale: [1.2, 2.0] };
}

/** Floating island of torn earth with crystals on top. */
function shardIsland(weight: number): TreeSpecies {
  const rock = merge([
    paint(new THREE.DodecahedronGeometry(1.2, 0).scale(1, 0.45, 1), y => (y > 0.2 ? [0.32, 0.26, 0.42] : [0.24, 0.21, 0.29])),
    paint(new THREE.ConeGeometry(1.1, 3, 6).rotateX(Math.PI), solid([0.2, 0.17, 0.25])).translate(0, -1.6, 0)
  ]);
  const crystals = merge([
    new THREE.OctahedronGeometry(0.35, 0).scale(1, 2.4, 1).translate(0.2, 0.95, 0.1),
    new THREE.OctahedronGeometry(0.25, 0).scale(1, 2.0, 1).rotateZ(0.4).translate(-0.4, 0.75, -0.2)
  ]);
  return {
    layers: [
      { geom: rock, mat: silhouetteMat() },
      { geom: crystals, mat: new THREE.MeshStandardMaterial({ color: 0x3b1d6e, emissive: 0x9b6cff, emissiveIntensity: 1.4, roughness: 0.4 }) }
    ],
    palette: [0xffffff, 0xe6e0f0],
    weight,
    scale: [1.2, 2.6],
    lift: rand => 4 + rand() * 12
  };
}

/** Towering crystal spire growing out of the ground. */
function crystalSpire(weight: number): TreeSpecies {
  const g = merge([
    new THREE.OctahedronGeometry(0.6, 0).scale(1, 5, 1).translate(0, 2.4, 0),
    new THREE.OctahedronGeometry(0.4, 0).scale(1, 4, 1).rotateZ(0.35).translate(0.7, 1.4, 0),
    new THREE.OctahedronGeometry(0.35, 0).scale(1, 3.5, 1).rotateX(-0.4).translate(-0.3, 1.1, 0.6)
  ]);
  return {
    layers: [{ geom: g, mat: new THREE.MeshStandardMaterial({ color: 0x0e4a5a, emissive: 0x22d3ee, emissiveIntensity: 1.2, roughness: 0.3, flatShading: true }) }],
    palette: [0xffffff],
    weight,
    scale: [1.2, 2.6]
  };
}

/** Jagged cluster of obsidian spires. */
function obsidianSpires(weight: number): TreeSpecies {
  const c: RGB = [0.14, 0.1, 0.12];
  const g = merge([
    paint(new THREE.ConeGeometry(0.7, 5, 5), solid(c)).translate(0, 2.5, 0),
    paint(new THREE.ConeGeometry(0.5, 3.4, 5), solid(c)).rotateZ(-0.25).translate(0.8, 1.6, 0.3),
    paint(new THREE.ConeGeometry(0.4, 2.4, 5), solid(c)).rotateX(0.3).translate(-0.5, 1.1, -0.5)
  ]);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6, flatShading: true });
  return { layers: [{ geom: g, mat }], palette: [0xffffff, 0xd8d0d4], weight, scale: [1.3, 3.0] };
}

// ------------------------------------------------------------------
// Themes
// ------------------------------------------------------------------

/** Boulders with a cap of snow on most of them. */
function snowyBoulder(b: StaticBatch, mats: Mats, x: number, z: number, rand: Rand) {
  const s = 0.4 + rand() * 1.1;
  boulder(b, [mats.greyRock, mats.greyRock, mats.darkRock], x, z, s, rand);
  if (rand() < 0.7) b.add(G.halfDome, mats.snow, xf(x, groundHeight(x, z) + s * 0.32, z, 0, 0, 0, s * 1.1, s * 0.3, s * 0.9));
}

export const SCENERY: Record<MapThemeId, Scenery> = {
  // Moonlit forest frontier: graveyard, rune circle, crypt, dead trees, glowing mushrooms
  FRONTIER: {
    texture: {
      seed: 13, base: '#323e28', patches: ['22,30,18', '64,58,36', '44,34,26', '52,66,40'],
      blades: 9000, live: [0.72, 1, 0.55], dead: [1.25, 1.05, 0.6], deadRatio: 0.18
    },
    groundTint: 0xd6dcc0,
    patch: { color: [1.18, 1.02, 0.68], amount: 0.55 },
    east: { color: [0.66, 0.52, 0.47], amount: 0.7 },
    tufts: { palette: [0x5a6e3a, 0x4a5c32, 0x3e5038, 0x6b6a3c, 0x7a6e44, 0x55663c], density: 1, height: 1 },
    treeline: { density: 1, species: () => [pine([0x17291d, 0x1d3324, 0x142219, 0x22302a, 0x2a2d24], 1)] },
    mist: { near: 0x6a6290, east: 0x7a5a6a, opacity: 1 },
    decorate: (p, mats, lava, rand) => {
      runeCircle(p, mats, -22, -27, mats.graveStone, mats.runeGlow, mats.soulFire);
      graveyard(p, mats);
      ruinedChapel(p, mats, 28, -19, mats.graveStone, mats.mossStone);
      crypt(p, mats, -45, -24);
      watchtower(p, mats, -50, -38, mats.graveStone);
      citadelPikes(p, mats);
      plantDeadTrees(p, mats.bark);
      p.scatter(rand, 70, 0.8, 30, (b, x, z) => boulder(b, [mats.mossStone, mats.darkRock, mats.rock], x, z, 0.4 + rand() * 1.1, rand));
      p.scatter(rand, 34, 0.4, 24, (b, x, z) => mushroomCluster(b, mats, x, z, rand, [mats.capTeal, mats.capTeal, mats.capViolet]));
      p.scatter(rand, 30, 0.6, 26, (b, x, z) => bramble(b, mats.bramble, x, z, rand));
      p.scatter(rand, 14, 0.4, 14, (b, x, z) => bones(b, mats.bone, x, z, rand));
      infernalEast(p, mats, lava, rand, 16, 22);
    }
  },

  // Frozen mountain pass: snowy pines and crags, a mine, forges, ore and cairns
  IRONFORGE: {
    texture: {
      seed: 17, base: '#3d4542', patches: ['28,32,34', '170,180,192', '64,60,54', '86,96,92'],
      blades: 6500, live: [0.82, 1, 0.92], dead: [1.15, 1.1, 1.0], deadRatio: 0.35,
      speckles: [{ count: 1400, colors: ['rgba(225,232,240,0.35)', 'rgba(200,210,222,0.25)'], size: 1.5 }]
    },
    groundTint: 0xe4e8ec,
    mazeFloor: { tint: 0xa8b0ba },
    patch: { color: [1.8, 1.85, 1.95], amount: 0.7 },
    east: { color: [0.62, 0.52, 0.5], amount: 0.6 },
    tufts: { palette: [0x6f7c74, 0x84918a, 0x5d6a62, 0x9aa49c, 0x7a7f6e], density: 0.6, height: 0.85 },
    treeline: { density: 1, species: () => [snowPine(0.75), snowCliff(0.25)] },
    mist: { near: 0xaab6c8, east: 0x8a7a80, opacity: 1.05 },
    decorate: (p, mats, lava, rand) => {
      mineEntrance(p, mats, -22, -27);
      forge(p, mats, 9, -17.5, 0.1);
      forge(p, mats, 17, -19, -0.25);
      [[5.5, -21], [13, -22.5], [21, -22]].forEach(([x, z]) => {
        const b = p.at(x, z, 0.8);
        if (b) orePile(b, mats, x, z, rand);
      });
      [[28, -17], [32, -21], [-4, -20], [-44, -20], [26, -24]].forEach(([x, z]) => {
        const b = p.at(x, z, 0.8);
        if (b) cairn(b, mats, x, z, rand);
      });
      watchtower(p, mats, -50, -38, mats.greyRock, mats.snow);
      citadelPikes(p, mats);
      plantDeadTrees(p, mats.frostBark, 2, (b, x, z) => snowDrift(b, mats, x + 0.6, z + 0.4, rand));
      p.scatter(rand, 60, 0.8, 30, (b, x, z) => snowyBoulder(b, mats, x, z, rand));
      p.scatter(rand, 45, 0.8, 30, (b, x, z) => snowDrift(b, mats, x, z, rand));
      p.scatter(rand, 8, 0.8, 22, (b, x, z) => orePile(b, mats, x, z, rand));
      p.scatter(rand, 10, 0.6, 26, (b, x, z) => cairn(b, mats, x, z, rand));
      p.scatter(rand, 14, 0.6, 24, (b, x, z) => bramble(b, mats.frostBark, x, z, rand));
      p.scatter(rand, 8, 0.4, 14, (b, x, z) => bones(b, mats.bone, x, z, rand));
      infernalEast(p, mats, lava, rand, 12, 16);
    }
  },

  // Sun-baked canyon: mesas, hoodoos, cacti, a rock arch, a wrecked caravan and a beast's bones
  CANYON: {
    texture: {
      seed: 23, base: '#6e5034', patches: ['120,86,52', '86,58,36', '150,112,72', '70,46,30'],
      blades: 1400, live: [1.25, 1.05, 0.65], dead: [1.4, 1.15, 0.75], deadRatio: 0.7,
      cracks: { count: 90, color: 'rgba(38,22,12,0.75)', width: 1.6 },
      speckles: [{ count: 1400, colors: ['rgba(170,140,100,0.5)', 'rgba(60,40,26,0.5)'], size: 1.8 }]
    },
    groundTint: 0xe6d6c4,
    mazeFloor: { tint: 0xb8a088 },
    patch: { color: [1.15, 0.78, 0.6], amount: 0.5 },
    east: { color: [0.6, 0.45, 0.4], amount: 0.55 },
    tufts: { palette: [0x8a7448, 0x9c8452, 0x6e5a36, 0x7f6a3e], density: 0.25, height: 0.9 },
    treeline: { density: 0.75, species: () => [mesa(0.45), hoodooSpire(0.35), saguaro(0.2)] },
    mist: { near: 0xb08458, east: 0x8a5a44, opacity: 0.6 },
    decorate: (p, mats, lava, rand) => {
      rockArch(p, mats, -22, -28);
      brokenWagon(p, mats, 9, -17, 0.4);
      brokenWagon(p, mats, 15.5, -20.5, -0.7);
      [[11.8, -15.6, false], [12.6, -16.3, true], [18, -18.4, true], [6.4, -19.2, false]].forEach(([x, z, side]) => {
        const b = p.at(x as number, z as number, 0.5);
        if (b) barrel(b, mats, x as number, z as number, side as boolean, rand);
      });
      beastSkeleton(p, mats, 27, -20, 0.5, 1.2);
      [[-4, -22, 1.1], [32, -26, 1.3], [-44, -22, 1.4], [-47, -31, 1.0]].forEach(([x, z, s]) => {
        const b = p.at(x, z, 2);
        if (b) hoodoo(b, mats, x, z, s, rand);
      });
      citadelPikes(p, mats);
      plantDeadTrees(p, mats.deadWood, 3);
      p.scatter(rand, 45, 0.8, 30, (b, x, z) => cactus(b, mats, x, z, 0.8 + rand() * 0.5, rand));
      p.scatter(rand, 34, 0.6, 28, (b, x, z) => bramble(b, mats.dryBrush, x, z, rand));
      p.scatter(rand, 60, 0.8, 30, (b, x, z) => boulder(b, [mats.sandstone, mats.redRock, mats.sandstone], x, z, 0.4 + rand() * 1.2, rand));
      p.scatter(rand, 12, 0.5, 20, (b, x, z) => hornedSkull(b, mats, x, z, rand));
      p.scatter(rand, 10, 0.4, 16, (b, x, z) => bones(b, mats.paleBone, x, z, rand));
      p.scatter(rand, 8, 1.5, 28, (b, x, z) => hoodoo(b, mats, x, z, 0.6 + rand() * 0.3, rand));
      infernalEast(p, mats, lava, rand, 12, 14);
    }
  },

  // Arcane rift: crystal growths, floating stone, glowing tears in the ground, broken arcane pillars
  RIFT: {
    texture: {
      seed: 29, base: '#2a2538', patches: ['18,14,30', '78,54,110', '38,62,86', '56,44,80'],
      blades: 7000, live: [0.85, 0.72, 1.15], dead: [0.7, 0.88, 1.15], deadRatio: 0.25,
      cracks: { count: 26, color: 'rgba(90,220,245,0.32)', width: 1.2 }
    },
    groundTint: 0xe0dcf0,
    mazeFloor: { tint: 0xb0a6cc },
    patch: { color: [0.75, 0.95, 1.4], amount: 0.5 },
    east: { color: [0.6, 0.5, 0.55], amount: 0.55 },
    tufts: { palette: [0x5a4a7a, 0x4a3e6a, 0x3e4a6a, 0x6a5a8a, 0x4e5a7a], density: 0.75, height: 1 },
    treeline: { density: 1, species: () => [shardIsland(0.4), crystalSpire(0.2), pine([0x2a2040, 0x30244a, 0x221a36, 0x3a2c50], 0.4)] },
    mist: { near: 0x8a5ad0, east: 0x6a4a8a, opacity: 1 },
    decorate: (p, mats, lava, rand) => {
      runeCircle(p, mats, -22, -27, mats.riftStone, mats.riftRune, mats.crystalCyan);
      const circle = p.at(-22, -27, 5);
      if (circle) [[-2, -1, 4.5], [2.2, 0.8, 5.5], [0.4, 2.4, 3.8]].forEach(([dx, dz, h]) => floatingRock(circle, mats, -22 + dx, -27 + dz, h, 0.7, rand));

      // The rift wound: a great crystal bloom torn out of the ground north of the arena
      const wound = p.at(12, -19.5, 2);
      if (wound) {
        crystalCluster(wound, mats, 12, -19.5, 2.2, rand, mats.crystalViolet);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          crystalCluster(wound, mats, 12 + Math.cos(a) * 3.6, -19.5 + Math.sin(a) * 3.0, 0.8 + rand() * 0.5, rand, mats.crystalCyan);
        }
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          fissure(wound, mats.riftCrust, mats.riftCore, 12 + Math.cos(a) * 1.8, -19.5 + Math.sin(a) * 1.5, rand);
        }
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          floatingRock(wound, mats, 12 + Math.cos(a) * 2.6, -19.5 + Math.sin(a) * 2.2, 2.5 + rand() * 3, 0.5 + rand() * 0.4, rand);
        }
      }

      // Ring of broken arcane pillars around a crystal heart
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = 28 + Math.cos(a) * 3.8;
        const z = -19.5 + Math.sin(a) * 3.2;
        const b = p.at(x, z, 0.8);
        if (b) arcanePillar(b, mats, x, z, 1.5 + rand() * 2, rand);
      }
      const heart = p.at(28, -19.5, 1);
      if (heart) crystalCluster(heart, mats, 28, -19.5, 1.2, rand, mats.crystalCyan);

      citadelPikes(p, mats);
      plantDeadTrees(p, mats.riftBark);
      p.scatter(rand, 34, 0.8, 28, (b, x, z) => crystalCluster(b, mats, x, z, 0.5 + rand() * 0.6, rand, rand() < 0.5 ? mats.crystalCyan : mats.crystalViolet));
      p.scatter(rand, 22, 1.2, 26, (b, x, z) => fissure(b, mats.riftCrust, mats.riftCore, x, z, rand));
      p.scatter(rand, 18, 1.5, 28, (b, x, z) => floatingRock(b, mats, x, z, 1.5 + rand() * 3, 0.5 + rand() * 0.6, rand));
      p.scatter(rand, 22, 0.4, 24, (b, x, z) => mushroomCluster(b, mats, x, z, rand, [mats.capViolet]));
      p.scatter(rand, 45, 0.8, 30, (b, x, z) => boulder(b, [mats.riftStone, mats.darkRock], x, z, 0.4 + rand() * 1.0, rand));
      p.scatter(rand, 10, 0.6, 24, (b, x, z) => bramble(b, mats.riftBark, x, z, rand));
      infernalEast(p, mats, lava, rand, 10, 12);
    }
  },

  // Infernal citadel: ash, lava cracks, obsidian, gibbets, burnt banners and a sacrificial altar
  CITADEL: {
    texture: {
      seed: 31, base: '#3e302b', patches: ['20,14,12', '96,52,30', '60,46,42', '118,66,38'],
      blades: 1600, live: [0.95, 0.75, 0.6], dead: [1.1, 0.8, 0.6], deadRatio: 1,
      cracks: { count: 50, color: 'rgba(8,4,4,0.75)', width: 1.6 },
      speckles: [
        { count: 900, colors: ['rgba(255,120,40,0.6)', 'rgba(255,70,20,0.5)'], size: 1.4 },
        { count: 1800, colors: ['rgba(130,120,115,0.35)'], size: 1.6 }
      ]
    },
    groundTint: 0xffffff,
    mazeFloor: { tint: 0xc4b4ac },
    patch: { color: [1.5, 0.85, 0.58], amount: 0.5 },
    east: { color: [0.6, 0.45, 0.42], amount: 0.4 },
    tufts: { palette: [0x3a3028, 0x4a3a2a, 0x2e2622, 0x52402c], density: 0.2, height: 0.7 },
    treeline: { density: 0.9, species: () => [obsidianSpires(0.55), pine([0x1c1614, 0x241c18, 0x2a1f1a], 0.45)] },
    mist: { near: 0x9a4430, east: 0x9a3220, opacity: 1 },
    decorate: (p, mats, lava, rand) => {
      sacrificialAltar(p, mats, -22, -27, rand);
      [[6.5, -15.5, 0.2], [11.5, -18, -0.3], [16.5, -15.8, 0.5], [21, -18.5, 0]].forEach(([x, z, ry]) => gibbet(p, mats, x, z, ry));
      // Burnt-out war camp
      [[25.5, -17], [30, -16.5], [27, -21.5], [31.5, -21]].forEach(([x, z]) => {
        const b = p.at(x, z, 0.6);
        if (b) burntBanner(b, mats, x, z, rand);
      });
      [[28, -18.8], [26, -23.5], [33, -19]].forEach(([x, z]) => {
        const b = p.at(x, z, 0.6);
        if (b) skullPile(b, mats, x, z, rand);
      });
      [[-4, -22], [-44, -22], [35, -26]].forEach(([x, z]) => {
        const b = p.at(x, z, 2);
        if (b) basaltColumns(b, mats, x, z, rand);
      });
      citadelPikes(p, mats);
      plantDeadTrees(p, mats.charBark);
      p.scatter(rand, 40, 1.5, 30, (b, x, z) => fissure(b, mats.emberCrust, lava, x, z, rand));
      p.scatter(rand, 36, 1, 30, (b, x, z) => obsidianSpike(b, mats.obsidian, x, z, rand));
      p.scatter(rand, 8, 0.8, 22, (b, x, z) => skullPile(b, mats, x, z, rand));
      p.scatter(rand, 18, 0.4, 18, (b, x, z) => bones(b, mats.bone, x, z, rand));
      p.scatter(rand, 22, 0.6, 26, (b, x, z) => bramble(b, mats.charBark, x, z, rand));
      p.scatter(rand, 50, 0.8, 30, (b, x, z) => boulder(b, [mats.basalt, mats.darkRock, mats.obsidian], x, z, 0.4 + rand() * 1.1, rand));
      infernalEast(p, mats, lava, rand, 10, 10);
    }
  }
};
