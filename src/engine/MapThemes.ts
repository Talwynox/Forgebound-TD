/**
 * Per-mission look of the world: sky & fog, ambient light, the maze island's ground tint and the
 * road's stones. FRONTIER is the original night palette (also used for PvP).
 */
export type MapThemeId = 'FRONTIER' | 'IRONFORGE' | 'CANYON' | 'RIFT' | 'CITADEL';

export interface MapTheme {
  background: number;
  fog: number;
  fogDensity: number;
  ambient: number;
  hemiSky: number;
  hemiGround: number;
  /** Tint over the maze island's ground texture. */
  ground: number;
  roadBed: number;
  pavers: [number, number, number, number];
  curb: number;
  /** Inlaid stepping-stone runes along the road. */
  rune: number;
  runeGlow: number;
}

export const MAP_THEMES: Record<MapThemeId, MapTheme> = {
  // Moonlit forest frontier
  FRONTIER: {
    background: 0x07060c, fog: 0x0d0b17, fogDensity: 0.0085,
    ambient: 0x6d6694, hemiSky: 0x94a3e8, hemiGround: 0x3a2418,
    ground: 0xd6dcc0,
    roadBed: 0x3e2e22, pavers: [0x6e5c4a, 0x7c6955, 0x564739, 0x8a7662], curb: 0x483a2d,
    rune: 0xd97706, runeGlow: 0xb45309
  },
  // Cold mountain pass lit by forge fires
  IRONFORGE: {
    background: 0x08090d, fog: 0x14171e, fogDensity: 0.009,
    ambient: 0x7a8499, hemiSky: 0xb8c4d8, hemiGround: 0x2a1e18,
    ground: 0x9aa3ad,
    roadBed: 0x2a2b30, pavers: [0x4a4d55, 0x3c3f46, 0x55585f, 0x44464c], curb: 0x2f3036,
    rune: 0xf97316, runeGlow: 0xc2410c
  },
  // Sun-baked canyon at dusk
  CANYON: {
    background: 0x140c07, fog: 0x2a1a10, fogDensity: 0.0065,
    ambient: 0xb08a60, hemiSky: 0xffd29a, hemiGround: 0x5a3a1e,
    ground: 0xe8c890,
    roadBed: 0x6b4a2a, pavers: [0xc2a070, 0xb08e5e, 0xd4b482, 0xa88652], curb: 0x7a5a36,
    rune: 0xfacc15, runeGlow: 0xca8a04
  },
  // Violet void of the arcane rift
  RIFT: {
    background: 0x0a0514, fog: 0x160a24, fogDensity: 0.0095,
    ambient: 0x8a5cc8, hemiSky: 0xb89cff, hemiGround: 0x1a0a2a,
    ground: 0x9c8ac8,
    roadBed: 0x1e1830, pavers: [0x3a3050, 0x2e2644, 0x453a5e, 0x342a4a], curb: 0x241c36,
    rune: 0x22d3ee, runeGlow: 0x0891b2
  },
  // Scorched infernal citadel
  CITADEL: {
    background: 0x0c0403, fog: 0x1c0806, fogDensity: 0.01,
    ambient: 0x9a4a3a, hemiSky: 0xff9a7a, hemiGround: 0x3a0a05,
    ground: 0x8a6a5a,
    roadBed: 0x1a1214, pavers: [0x2a2224, 0x3a2c2a, 0x221a1c, 0x33272a], curb: 0x1a1214,
    rune: 0xff4a14, runeGlow: 0xdc2626
  }
};
