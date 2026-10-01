import * as THREE from 'three';

/**
 * Small canvas-generated textures that give the flat low-poly ground some grit
 * without shipping image assets.
 */

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function toTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

/** Mossy, uneven earth for the maze plateaus. */
export function createMossTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(7);

  ctx.fillStyle = '#39422c';
  ctx.fillRect(0, 0, size, size);

  // Soft blotches of damp moss and bare soil
  for (let i = 0; i < 140; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 6 + rand() * 26;
    const tones = ['rgba(28,36,22,0.35)', 'rgba(70,80,48,0.25)', 'rgba(52,40,30,0.3)', 'rgba(40,52,34,0.35)'];
    ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine grass speckle
  for (let i = 0; i < 2600; i++) {
    const shade = 40 + rand() * 60;
    ctx.fillStyle = `rgba(${shade * 0.8},${shade},${shade * 0.6},0.35)`;
    ctx.fillRect(rand() * size, rand() * size, 1, 1 + rand() * 2);
  }

  return toTexture(canvas, repeatX, repeatY);
}

/** Look of a seamless ground tile: base colour, soft patches, blade strokes, cracks and speckles. */
export interface GroundTextureStyle {
  seed: number;
  base: string;
  /** "r,g,b" tones for the soft patches. */
  patches: string[];
  /** Grass blade strokes and the RGB multipliers of living / dead blades. */
  blades: number;
  live: [number, number, number];
  dead: [number, number, number];
  deadRatio: number;
  /** Random-walk cracks (dried mud, scorched earth, glowing veins). */
  cracks?: { count: number; color: string; width: number };
  /** Tiny dots: frost, pebbles, cinders. */
  speckles?: { count: number; colors: string[]; size: number }[];
}

/** Seamless ground tile (meadow grass, frost, cracked earth, ash…) for the open ground around the battlefield. */
export function createGroundTexture(style: GroundTextureStyle, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(style.seed);

  ctx.fillStyle = style.base;
  ctx.fillRect(0, 0, size, size);

  // Draws with wrap-around copies so the tile repeats without seams
  const wrapped = (x: number, y: number, r: number, draw: (x: number, y: number) => void) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = x + ox;
        const py = y + oy;
        if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
        draw(px, py);
      }
    }
  };

  // Soft-edged patches of sod, straw, soil, frost or ash
  for (let i = 0; i < 220; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 10 + rand() * 40;
    const tone = style.patches[Math.floor(rand() * style.patches.length)];
    const alpha = 0.18 + rand() * 0.14;
    wrapped(x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${tone},${alpha})`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }

  // Short blade strokes
  ctx.lineWidth = 1;
  for (let i = 0; i < style.blades; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 2 + rand() * 5;
    const lean = (rand() - 0.5) * 3;
    const m = rand() < style.deadRatio ? style.dead : style.live;
    const shade = 45 + rand() * 55;
    ctx.strokeStyle = `rgba(${shade * m[0]},${shade * m[1]},${shade * m[2]},0.45)`;
    wrapped(x, y, len, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + lean, py - len);
      ctx.stroke();
    });
  }

  if (style.cracks) {
    ctx.strokeStyle = style.cracks.color;
    for (let i = 0; i < style.cracks.count; i++) {
      const pts: [number, number][] = [[rand() * size, rand() * size]];
      let angle = rand() * Math.PI * 2;
      const steps = 4 + Math.floor(rand() * 6);
      for (let s = 0; s < steps; s++) {
        angle += (rand() - 0.5) * 1.4;
        const [lx, ly] = pts[pts.length - 1];
        const step = 8 + rand() * 18;
        pts.push([lx + Math.cos(angle) * step, ly + Math.sin(angle) * step]);
      }
      ctx.lineWidth = style.cracks.width * (0.6 + rand() * 0.8);
      wrapped(pts[0][0], pts[0][1], 200, (px, py) => {
        const dx = px - pts[0][0];
        const dy = py - pts[0][1];
        ctx.beginPath();
        ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0] + dx, pts[k][1] + dy);
        ctx.stroke();
      });
    }
  }

  for (const sp of style.speckles ?? []) {
    for (let i = 0; i < sp.count; i++) {
      ctx.fillStyle = sp.colors[Math.floor(rand() * sp.colors.length)];
      const s = sp.size * (0.5 + rand());
      ctx.fillRect(rand() * size, rand() * size, s, s);
    }
  }

  return toTexture(canvas, repeatX, repeatY);
}

/** Alpha mask that is opaque in the middle and fades softly to every edge (for mist banks). */
export function createSoftEdgeMask(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#cccccc');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** Worn, cracked flagstones for the arena floor. */
export function createFlagstoneTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(21);

  ctx.fillStyle = '#2a2320';
  ctx.fillRect(0, 0, size, size);

  // Irregular stone slabs laid in staggered rows
  const rows = 4;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 === 0 ? 0 : -rowH * 0.5;
    while (x < size) {
      const w = rowH * (0.8 + rand() * 0.7);
      const tone = 58 + rand() * 26;
      ctx.fillStyle = `rgb(${tone},${tone * 0.9},${tone * 0.82})`;
      ctx.fillRect(x + 2, r * rowH + 2, w - 4, rowH - 4);

      // Grime & scorch stains per slab
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = `rgba(20,14,12,${0.08 + rand() * 0.12})`;
        ctx.beginPath();
        ctx.arc(x + rand() * w, r * rowH + rand() * rowH, 3 + rand() * 10, 0, Math.PI * 2);
        ctx.fill();
      }
      x += w;
    }
  }

  // Hairline cracks
  ctx.strokeStyle = 'rgba(12,8,8,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    let x = rand() * size;
    let y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rand() - 0.5) * 22;
      y += (rand() - 0.5) * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return toTexture(canvas, repeatX, repeatY);
}

/** Rough-hewn ashlar blocks for castle walls. */
export function createMasonryTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(33);

  ctx.fillStyle = '#231d19';
  ctx.fillRect(0, 0, size, size);

  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 === 0 ? 0 : -rowH;
    while (x < size) {
      const w = rowH * (1.6 + rand() * 0.9);
      const tone = 70 + rand() * 34;
      ctx.fillStyle = `rgb(${tone},${tone * 0.92},${tone * 0.84})`;
      ctx.fillRect(x + 1.5, r * rowH + 1.5, w - 3, rowH - 3);
      // Bevel highlight & soot
      ctx.fillStyle = 'rgba(255,240,220,0.07)';
      ctx.fillRect(x + 1.5, r * rowH + 1.5, w - 3, 2);
      ctx.fillStyle = `rgba(10,8,8,${0.08 + rand() * 0.18})`;
      ctx.fillRect(x + 1.5, r * rowH + rowH * 0.55, w - 3, rowH * 0.45 - 1.5);
      x += w;
    }
  }
  // Moss & grime creeping up from the bottom
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(30,38,24,${0.1 + rand() * 0.15})`;
    ctx.beginPath();
    ctx.arc(rand() * size, size - rand() * rand() * size, 4 + rand() * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  return toTexture(canvas, repeatX, repeatY);
}

/** Seamless soft cloud-noise for the mist sea drifting beneath the islands. */
export function createMistTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(57);
  ctx.clearRect(0, 0, size, size);

  // Soft blobs drawn with wrap-around copies so the texture tiles seamlessly
  // Clumped cloud banks with clear gaps between them
  const clumps = Array.from({ length: 9 }, () => [rand() * size, rand() * size]);
  for (let i = 0; i < 150; i++) {
    const [cx, cy] = clumps[i % clumps.length];
    const x = cx + (rand() - 0.5) * 170;
    const y = cy + (rand() - 0.5) * 120;
    const r = 18 + rand() * 60;
    const a = 0.12 + rand() * 0.2;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Soft round glow sprite for ember / wisp particles. */
export function createGlowSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
