/**
 * AudioSystem: Procedural Web Audio API sound synthesizer for Forgebound TD.
 * Provides rich fantasy sound effects (buffs, clashing, building, fanfare)
 * without needing external asset downloads.
 *
 * Signal chain:  voices -> sfxBus -> tone (lowpass) -> limiter -> master -> speakers
 *                music  ----------------------------------------> master
 *
 * Every sound passes through a voice gate (see POLICY) that rate-limits it in real time,
 * caps how many copies overlap, and drops low-priority combat chatter when the mix is busy.
 * This keeps 4x speed and big client FX replays from piling hundreds of oscillators on top
 * of each other.
 */

type SoundKey =
  | 'build' | 'upgrade' | 'achievement' | 'sell'
  | 'healBuff' | 'armorBuff' | 'attackBuff' | 'frost' | 'auraSpeed'
  | 'alert' | 'rulebreaker' | 'teleport' | 'guardianShot' | 'focus'
  | 'gold' | 'evolution' | 'hit' | 'fireball' | 'slash' | 'bossSlam'
  | 'victory' | 'defeat' | 'stun' | 'healPulse' | 'shred';

/** 0 = combat chatter (first to go), 1 = gameplay events, 2 = UI / jingles (never dropped for load). */
type Priority = 0 | 1 | 2;

interface VoicePolicy {
  /** Minimum real seconds between two starts of this sound. */
  gap: number;
  /** Max overlapping copies of this sound. */
  max: number;
  prio: Priority;
  /** Random pitch spread (fraction) so repeats don't sound like a machine gun. */
  jitter: number;
}

const POLICY: Record<SoundKey, VoicePolicy> = {
  build:        { gap: 0.05, max: 2, prio: 2, jitter: 0 },
  upgrade:      { gap: 0.08, max: 2, prio: 2, jitter: 0 },
  achievement:  { gap: 0.5,  max: 1, prio: 2, jitter: 0 },
  sell:         { gap: 0.05, max: 2, prio: 2, jitter: 0 },
  alert:        { gap: 0.25, max: 1, prio: 2, jitter: 0 },
  focus:        { gap: 0.1,  max: 1, prio: 2, jitter: 0 },
  evolution:    { gap: 0.3,  max: 1, prio: 2, jitter: 0 },
  victory:      { gap: 0.5,  max: 1, prio: 2, jitter: 0 },
  defeat:       { gap: 0.5,  max: 1, prio: 2, jitter: 0 },
  rulebreaker:  { gap: 0.15, max: 2, prio: 1, jitter: 0.03 },
  teleport:     { gap: 0.15, max: 2, prio: 1, jitter: 0.03 },
  bossSlam:     { gap: 0.25, max: 1, prio: 1, jitter: 0.03 },
  gold:         { gap: 0.09, max: 2, prio: 1, jitter: 0 },
  healBuff:     { gap: 0.1,  max: 2, prio: 0, jitter: 0.04 },
  armorBuff:    { gap: 0.1,  max: 2, prio: 0, jitter: 0.05 },
  attackBuff:   { gap: 0.1,  max: 2, prio: 0, jitter: 0.05 },
  frost:        { gap: 0.12, max: 2, prio: 0, jitter: 0.05 },
  auraSpeed:    { gap: 0.15, max: 1, prio: 0, jitter: 0.04 },
  guardianShot: { gap: 0.07, max: 3, prio: 0, jitter: 0.05 },
  hit:          { gap: 0.06, max: 3, prio: 0, jitter: 0.08 },
  slash:        { gap: 0.07, max: 2, prio: 0, jitter: 0.08 },
  fireball:     { gap: 0.12, max: 2, prio: 0, jitter: 0.06 },
  stun:         { gap: 0.15, max: 1, prio: 0, jitter: 0.05 },
  healPulse:    { gap: 0.2,  max: 1, prio: 0, jitter: 0.03 },
  shred:        { gap: 0.12, max: 1, prio: 0, jitter: 0.06 }
};

/** Total overlapping voices above which lower-priority sounds are dropped. */
const BUSY_LIMIT: Record<Priority, number> = { 0: 8, 1: 14, 2: Infinity };

/** Scheduling lead so voices never start "in the past" (which clicks). */
const LEAD = 0.005;

interface ToneOpts {
  type: OscillatorType;
  from: number;
  /** Exponential glide target. */
  to?: number;
  /** Glide time; defaults to the full duration. */
  glide?: number;
  /** Hard pitch step: jump to `freq` at `at` seconds after start. */
  step?: { at: number; freq: number };
  dur: number;
  peak: number;
  delay?: number;
  attack?: number;
  /** Lowpass cutoff to tame bright waveforms (sawtooth / square). */
  lowpass?: number;
}

interface NoiseOpts {
  filter: BiquadFilterType;
  from: number;
  to?: number;
  q?: number;
  dur: number;
  peak: number;
  delay?: number;
  attack?: number;
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public enabled: boolean = true;
  private musicInterval: number | null = null;
  public musicPlaying: boolean = false;

  /** Per-sound last start time and active voice end times (AudioContext time). */
  private voices = new Map<SoundKey, { last: number; ends: number[] }>();

  constructor() {
    // Initialized on first user interaction due to browser autoplay policies
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      // Brick-wall-ish limiter so stacked hits squash instead of clipping.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -18;
      limiter.knee.value = 8;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.15;
      limiter.connect(master);

      // Gentle top-end roll-off: removes the fizzy, piercing harmonics of raw oscillators.
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 7500;
      tone.Q.value = 0.5;
      tone.connect(limiter);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.75;
      this.sfxBus.connect(tone);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 1;
      this.musicBus.connect(master);

      const len = Math.floor(ctx.sampleRate * 1.0);
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Voice management ---

  /** Decides whether a sound may start now; returns its volume scale (0 = drop). */
  private admit(key: SoundKey, now: number, dur: number): number {
    const policy = POLICY[key];
    let state = this.voices.get(key);
    if (!state) {
      state = { last: -Infinity, ends: [] };
      this.voices.set(key, state);
    }
    state.ends = state.ends.filter(e => e > now);

    if (now - state.last < policy.gap) return 0;
    if (state.ends.length >= policy.max) return 0;

    let busy = 0;
    for (const s of this.voices.values()) {
      for (const e of s.ends) if (e > now) busy++;
    }
    if (busy >= BUSY_LIMIT[policy.prio]) return 0;

    state.last = now;
    state.ends.push(now + dur);
    // Overlapping copies of the same sound get progressively quieter.
    return 1 / (1 + 0.35 * (state.ends.length - 1));
  }

  /**
   * Runs `build` if the sound passes the voice gate.
   * `build` receives the start time, a volume scale and a pitch multiplier.
   */
  private play(key: SoundKey, dur: number, build: (t: number, vol: number, pitch: number) => void) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.sfxBus) return;

    const now = this.ctx.currentTime;
    const vol = this.admit(key, now, dur);
    if (vol <= 0) return;

    const jitter = POLICY[key].jitter;
    const pitch = jitter > 0 ? 1 + (Math.random() * 2 - 1) * jitter : 1;
    build(now + LEAD, vol, pitch);
  }

  private envelope(g: GainNode, start: number, end: number, peak: number, attack: number) {
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }

  private tone(t: number, vol: number, o: ToneOpts, out: AudioNode = this.sfxBus!) {
    const ctx = this.ctx!;
    const start = t + (o.delay ?? 0);
    const end = start + o.dur;

    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.from, start);
    if (o.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(o.to, start + (o.glide ?? o.dur));
    }
    if (o.step) {
      osc.frequency.setValueAtTime(o.step.freq, start + o.step.at);
    }

    const g = ctx.createGain();
    this.envelope(g, start, end, o.peak * vol, o.attack ?? 0.006);

    let filter: BiquadFilterNode | null = null;
    if (o.lowpass) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.lowpass;
      filter.Q.value = 0.7;
      osc.connect(filter);
      filter.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(out);

    osc.onended = () => {
      osc.disconnect();
      filter?.disconnect();
      g.disconnect();
    };
    osc.start(start);
    osc.stop(end + 0.02);
  }

  private noise(t: number, vol: number, o: NoiseOpts) {
    const ctx = this.ctx!;
    const start = t + (o.delay ?? 0);
    const end = start + o.dur;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.Q.value = o.q ?? 0.8;
    filter.frequency.setValueAtTime(o.from, start);
    if (o.to !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(o.to, end);
    }

    const g = ctx.createGain();
    this.envelope(g, start, end, o.peak * vol, o.attack ?? 0.004);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus!);

    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
    const offset = Math.random() * Math.max(0, this.noiseBuffer!.duration - o.dur - 0.05);
    src.start(start, offset);
    src.stop(end + 0.02);
  }

  // --- Sound Effects ---

  playBuild() {
    this.play('build', 0.18, (t, v) => {
      this.tone(t, v, { type: 'triangle', from: 220, to: 580, glide: 0.12, dur: 0.16, peak: 0.16 });
      this.noise(t, v, { filter: 'lowpass', from: 900, to: 200, dur: 0.08, peak: 0.08 });
    });
  }

  playUpgrade() {
    const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
    this.play('upgrade', 0.35, (t, v) => {
      notes.forEach((freq, idx) => {
        this.tone(t, v, { type: 'sine', from: freq, delay: idx * 0.05, dur: 0.18, peak: 0.1 });
      });
    });
  }

  playAchievement() {
    // Triumphant royal fanfare arpeggio: C5 -> E5 -> G5 -> C6 -> E6 -> G6
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    this.play('achievement', 1.1, (t, v) => {
      notes.forEach((freq, idx) => {
        const dur = idx === notes.length - 1 ? 0.65 : 0.28;
        this.tone(t, v, { type: idx >= 4 ? 'triangle' : 'sine', from: freq, delay: idx * 0.08, dur, peak: 0.13 });
      });
    });
  }

  playSell() {
    this.play('sell', 0.14, (t, v) => {
      this.tone(t, v, { type: 'sawtooth', from: 400, to: 180, dur: 0.13, peak: 0.1, lowpass: 1500 });
    });
  }

  playHealBuff() {
    this.play('healBuff', 0.15, (t, v, p) => {
      this.tone(t, v, { type: 'sine', from: 523.25 * p, to: 783.99 * p, dur: 0.15, peak: 0.07, attack: 0.012 }); // C5 -> G5
    });
  }

  playArmorBuff() {
    // Metal clang
    this.play('armorBuff', 0.12, (t, v, p) => {
      this.tone(t, v, { type: 'triangle', from: 800 * p, to: 250 * p, dur: 0.11, peak: 0.1 });
      this.noise(t, v, { filter: 'bandpass', from: 3200 * p, q: 4, dur: 0.05, peak: 0.05 });
    });
  }

  playAttackBuff() {
    // Fire whoosh
    this.play('attackBuff', 0.14, (t, v, p) => {
      this.noise(t, v, { filter: 'bandpass', from: 500 * p, to: 1400 * p, q: 1.2, dur: 0.13, peak: 0.09, attack: 0.02 });
      this.tone(t, v, { type: 'sawtooth', from: 300 * p, to: 600 * p, dur: 0.12, peak: 0.04, lowpass: 1200 });
    });
  }

  playFrostSlow() {
    // Ice crystal tink
    this.play('frost', 0.18, (t, v, p) => {
      this.tone(t, v, { type: 'sine', from: 1200 * p, to: 700 * p, dur: 0.17, peak: 0.06 });
    });
  }

  playAuraSpeedPulse() {
    this.play('auraSpeed', 0.1, (t, v, p) => {
      this.tone(t, v, { type: 'triangle', from: 440 * p, to: 880 * p, glide: 0.08, dur: 0.09, peak: 0.05 });
    });
  }

  playAlert() {
    this.play('alert', 0.2, (t, v) => {
      this.tone(t, v, { type: 'sine', from: 659.25, to: 1046.50, glide: 0.12, dur: 0.18, peak: 0.12 }); // E5 -> C6
    });
  }

  playRulebreaker() {
    // Heavy arcane transformation hum
    this.play('rulebreaker', 0.27, (t, v, p) => {
      this.tone(t, v, { type: 'square', from: 150 * p, to: 500 * p, glide: 0.22, dur: 0.25, peak: 0.08, lowpass: 1100, attack: 0.015 });
      this.tone(t, v, { type: 'sine', from: 75 * p, to: 250 * p, glide: 0.22, dur: 0.25, peak: 0.08, attack: 0.015 });
    });
  }

  playTeleport() {
    // Celestial rising whoosh
    this.play('teleport', 0.27, (t, v, p) => {
      this.tone(t, v, { type: 'sine', from: 300 * p, to: 1200 * p, glide: 0.22, dur: 0.25, peak: 0.1, attack: 0.02 });
      this.noise(t, v, { filter: 'bandpass', from: 600, to: 3000, q: 1.5, dur: 0.25, peak: 0.04, attack: 0.05 });
    });
  }

  playGuardianShot() {
    this.play('guardianShot', 0.15, (t, v, p) => {
      // Layer 1: crisp arcane ping
      this.tone(t, v, { type: 'triangle', from: 880 * p, to: 320 * p, glide: 0.12, dur: 0.13, peak: 0.08 });
      // Layer 2: sub-bass punch
      this.tone(t, v, { type: 'sine', from: 160 * p, to: 60 * p, glide: 0.1, dur: 0.12, peak: 0.1, attack: 0.003 });
    });
  }

  playFocusTarget() {
    this.play('focus', 0.26, (t, v) => {
      // Tone 1: Alert ping D5 -> A5
      this.tone(t, v, { type: 'sine', from: 587.33, step: { at: 0.06, freq: 880.0 }, dur: 0.22, peak: 0.12 });
      // Tone 2: Lock-on harmonic D6
      this.tone(t, v, { type: 'triangle', from: 1174.66, delay: 0.06, dur: 0.18, peak: 0.06 });
    });
  }

  playGoldGain() {
    // Coin chime
    this.play('gold', 0.2, (t, v) => {
      [987.77, 1318.51].forEach((freq, idx) => {
        this.tone(t, v, { type: 'sine', from: freq, delay: idx * 0.06, dur: 0.13, peak: 0.07, attack: 0.003 });
      });
    });
  }

  playEvolution() {
    // Glorious fanfare ascension
    const chords = [
      [392.00, 493.88, 587.33], // G major
      [523.25, 659.25, 783.99], // C major
      [587.33, 739.99, 880.00]  // D major high
    ];
    this.play('evolution', 0.65, (t, v) => {
      chords.forEach((chord, cIdx) => {
        chord.forEach(freq => {
          this.tone(t, v, { type: 'triangle', from: freq, delay: cIdx * 0.16, dur: 0.3, peak: 0.06 });
        });
      });
    });
  }

  playHit() {
    // Soft body thump instead of a buzzing sawtooth
    this.play('hit', 0.08, (t, v, p) => {
      this.noise(t, v, { filter: 'lowpass', from: 1400 * p, to: 300, dur: 0.06, peak: 0.1, attack: 0.002 });
      this.tone(t, v, { type: 'sine', from: 140 * p, to: 50 * p, dur: 0.08, peak: 0.1, attack: 0.002 });
    });
  }

  playFireball() {
    this.play('fireball', 0.4, (t, v, p) => {
      this.noise(t, v, { filter: 'lowpass', from: 1800 * p, to: 180, dur: 0.38, peak: 0.13, attack: 0.01 });
      this.tone(t, v, { type: 'sine', from: 200 * p, to: 40 * p, dur: 0.35, peak: 0.12, attack: 0.004 });
    });
  }

  playSlash() {
    // Airy blade swish
    this.play('slash', 0.1, (t, v, p) => {
      this.noise(t, v, { filter: 'bandpass', from: 2600 * p, to: 700 * p, q: 1.4, dur: 0.09, peak: 0.08, attack: 0.008 });
    });
  }

  playBossSlam() {
    // Deep sub-bass earthquake impact
    this.play('bossSlam', 0.6, (t, v, p) => {
      this.tone(t, v, { type: 'sine', from: 110 * p, to: 28, dur: 0.55, peak: 0.3, attack: 0.004 });
      this.tone(t, v, { type: 'sawtooth', from: 120 * p, to: 25, dur: 0.45, peak: 0.08, lowpass: 500 });
      this.noise(t, v, { filter: 'lowpass', from: 700, to: 80, dur: 0.5, peak: 0.16, attack: 0.003 });
    });
  }

  playVictory() {
    const notes = [
      { f: 523.25, d: 0.15 },
      { f: 659.25, d: 0.15 },
      { f: 783.99, d: 0.2 },
      { f: 1046.5, d: 0.5 }
    ];
    this.play('victory', 1.0, (t, v) => {
      let offset = 0;
      notes.forEach(n => {
        this.tone(t, v, { type: 'triangle', from: n.f, delay: offset, dur: n.d, peak: 0.15 });
        offset += n.d * 0.9;
      });
    });
  }

  playDefeat() {
    const notes = [
      { f: 400, d: 0.25 },
      { f: 370, d: 0.25 },
      { f: 330, d: 0.3 },
      { f: 260, d: 0.6 }
    ];
    this.play('defeat', 1.3, (t, v) => {
      let offset = 0;
      notes.forEach(n => {
        this.tone(t, v, { type: 'sawtooth', from: n.f, delay: offset, dur: n.d, peak: 0.12, lowpass: 1400, attack: 0.01 });
        offset += n.d * 0.9;
      });
    });
  }

  playStun() {
    // Crackling electric zap
    this.play('stun', 0.18, (t, v, p) => {
      this.tone(t, v, { type: 'sawtooth', from: 880 * p, to: 220 * p, dur: 0.17, peak: 0.06, lowpass: 2400 });
      this.noise(t, v, { filter: 'highpass', from: 3000, dur: 0.06, peak: 0.04 });
    });
  }

  playHealPulse() {
    // Soft warm shimmer
    this.play('healPulse', 0.24, (t, v, p) => {
      this.tone(t, v, { type: 'sine', from: 523.25 * p, to: 783.99 * p, dur: 0.22, peak: 0.05, attack: 0.03 });
    });
  }

  playShred() {
    // Metallic fracture
    this.play('shred', 0.13, (t, v, p) => {
      this.tone(t, v, { type: 'triangle', from: 320 * p, to: 140 * p, dur: 0.12, peak: 0.08 });
      this.noise(t, v, { filter: 'bandpass', from: 2200 * p, q: 3, dur: 0.05, peak: 0.04 });
    });
  }

  toggleMusic(): boolean {
    this.initCtx();
    this.musicPlaying = !this.musicPlaying;
    if (this.musicPlaying) {
      this.startAmbientMusic();
    } else {
      this.stopAmbientMusic();
    }
    return this.musicPlaying;
  }

  private startAmbientMusic() {
    if (this.musicInterval) clearInterval(this.musicInterval);
    const chords = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [196, 246.94, 293.66], // G
      [164.81, 196, 246.94]  // Em
    ];
    let chordIdx = 0;

    const playChord = () => {
      if (!this.ctx || !this.musicBus || !this.musicPlaying) return;
      const current = chords[chordIdx % chords.length];
      chordIdx++;

      const t = this.ctx.currentTime + LEAD;
      current.forEach(freq => {
        this.tone(t, 1, { type: 'sine', from: freq, dur: 3.8, peak: 0.025, attack: 1.2 }, this.musicBus!);
      });
    };

    playChord();
    this.musicInterval = window.setInterval(playChord, 3800);
  }

  private stopAmbientMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const audio = new AudioSystem();
