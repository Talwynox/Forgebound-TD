import * as THREE from 'three';
import { VFXManager } from '../vfx/VFXManager';
import { AudioSystem } from '../engine/AudioSystem';
import { FxEvent } from './NetworkTypes';

const VFX_METHODS = [
  'spawnFloatingText',
  'spawnBeam',
  'spawnAscensionPillar',
  'spawnSlashArc',
  'spawnGroundStompShockwave',
  'spawnBurstParticles',
  'spawnHealingPulse',
  'spawnStunRing',
  'spawnFlamePuff'
] as const;

// Victory/defeat/achievement jingles are driven by each peer's own UI, so they are not relayed.
const AUDIO_METHODS = [
  'playBuild',
  'playUpgrade',
  'playSell',
  'playHealBuff',
  'playArmorBuff',
  'playAttackBuff',
  'playFrostSlow',
  'playAuraSpeedPulse',
  'playAlert',
  'playRulebreaker',
  'playTeleport',
  'playGuardianShot',
  'playFocusTarget',
  'playGoldGain',
  'playEvolution',
  'playHit',
  'playFireball',
  'playSlash',
  'playBossSlam',
  'playStun',
  'playHealPulse',
  'playShred'
] as const;

const MAX_BUFFERED_EVENTS = 400;

type AnyFn = (...args: unknown[]) => unknown;

/**
 * Replicates the Host's simulation VFX & audio to clients.
 *
 * Clients do not simulate combat, so every beam, floating number and sound the Host's
 * simulation produces is recorded here and replayed on clients with the next snapshot.
 *
 * - `record(fn)`: calls made while `fn` runs are buffered for replication (Host only).
 * - `local(fn)`:  calls made while `fn` runs are shown locally but never replicated (UI feedback).
 * - `mute(fn)`:   calls made while `fn` runs are suppressed entirely (clients applying Host events,
 *                 whose effects arrive separately via replay).
 */
export class FxRelay {
  private recordDepth = 0;
  private muteDepth = 0;
  private callDepth = 0;
  private buffer: FxEvent[] = [];
  private originals: Record<'v' | 'a', Record<string, AnyFn>> = { v: {}, a: {} };

  constructor(vfx: VFXManager, audio: AudioSystem) {
    this.wrap('v', vfx as unknown as Record<string, AnyFn>, VFX_METHODS);
    this.wrap('a', audio as unknown as Record<string, AnyFn>, AUDIO_METHODS);
  }

  private wrap(target: 'v' | 'a', obj: Record<string, AnyFn>, methods: readonly string[]) {
    for (const name of methods) {
      const original = obj[name].bind(obj) as AnyFn;
      this.originals[target][name] = original;
      obj[name] = (...args: unknown[]) => {
        if (this.muteDepth > 0) return undefined;
        // Only the outermost call is recorded (e.g. spawnFlamePuff internally spawns particles).
        if (this.recordDepth > 0 && this.callDepth === 0) {
          if (this.buffer.length >= MAX_BUFFERED_EVENTS) this.buffer.shift();
          this.buffer.push([target, name, args.map(encodeArg)]);
        }
        this.callDepth++;
        try {
          return original(...args);
        } finally {
          this.callDepth--;
        }
      };
    }
  }

  public record<T>(fn: () => T): T {
    this.recordDepth++;
    try {
      return fn();
    } finally {
      this.recordDepth--;
    }
  }

  public local<T>(fn: () => T): T {
    const saved = this.recordDepth;
    this.recordDepth = 0;
    try {
      return fn();
    } finally {
      this.recordDepth = saved;
    }
  }

  public mute<T>(fn: () => T): T {
    this.muteDepth++;
    try {
      return fn();
    } finally {
      this.muteDepth--;
    }
  }

  /** Takes all buffered events for the next snapshot. */
  public flush(): FxEvent[] {
    const events = this.buffer;
    this.buffer = [];
    return events;
  }

  public clear() {
    this.buffer = [];
  }

  public replay(events: FxEvent[]) {
    for (const [target, name, args] of events) {
      const fn = this.originals[target]?.[name];
      if (!fn) continue;
      try {
        fn(...args.map(decodeArg));
      } catch (err) {
        console.warn(`Failed to replay FX ${target}.${name}`, err);
      }
    }
  }
}

function encodeArg(arg: unknown): unknown {
  if (arg instanceof THREE.Vector3) {
    return { v3: [round2(arg.x), round2(arg.y), round2(arg.z)] };
  }
  return arg;
}

function decodeArg(arg: unknown): unknown {
  if (arg && typeof arg === 'object' && Array.isArray((arg as { v3?: unknown }).v3)) {
    const [x, y, z] = (arg as { v3: number[] }).v3;
    return new THREE.Vector3(x, y, z);
  }
  return arg;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
