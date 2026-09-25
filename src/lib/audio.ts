/* Tiny WebAudio foley rig — everything synthesised, nothing autoplayed. */

type Ctx = AudioContext & { resume(): Promise<void> };

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

let peelSrc: AudioBufferSourceNode | null = null;
let peelBP: BiquadFilterNode | null = null;
let peelHP: BiquadFilterNode | null = null;
let peelGain: GainNode | null = null;

function ensure(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC() as Ctx;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 1.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseSource(c: Ctx) {
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

export const foley = {
  enabled: false,

  unlock() {
    ensure();
  },

  setEnabled(v: boolean) {
    this.enabled = v;
    if (v) {
      ensure();
    } else {
      this.peelStop(0.05);
    }
  },

  /* sticky tack as the finger takes hold */
  peelStart() {
    if (!this.enabled) return;
    const c = ensure();
    if (!c || !master) return;
    this.peelStop(0.04);
    peelSrc = noiseSource(c);
    peelHP = c.createBiquadFilter();
    peelHP.type = "highpass";
    peelHP.frequency.value = 420;
    peelBP = c.createBiquadFilter();
    peelBP.type = "bandpass";
    peelBP.frequency.value = 700;
    peelBP.Q.value = 1.6;
    peelGain = c.createGain();
    peelGain.gain.value = 0;
    peelSrc.connect(peelHP).connect(peelBP).connect(peelGain).connect(master);
    peelSrc.start();
    peelGain.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.05);
  },

  /* adhesive giving way — pitch rises with progress */
  peelUpdate(p: number) {
    if (!this.enabled || !ctx || !peelBP || !peelGain || !peelHP) return;
    const t = ctx.currentTime;
    peelBP.frequency.setTargetAtTime(650 + p * 3200, t, 0.05);
    peelHP.frequency.setTargetAtTime(350 + p * 900, t, 0.05);
    peelGain.gain.setTargetAtTime(0.035 + p * 0.055, t, 0.06);
  },

  peelStop(ramp = 0.09) {
    if (!ctx || !peelSrc || !peelGain) return;
    const src = peelSrc;
    const g = peelGain;
    try {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(0, ctx.currentTime, ramp * 0.4);
      src.stop(ctx.currentTime + ramp + 0.12);
    } catch {
      /* already stopped */
    }
    peelSrc = null;
    peelGain = null;
    peelBP = null;
    peelHP = null;
  },

  pop() {
    if (!this.enabled) return;
    const c = ensure();
    if (!c || !master) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(760, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.22);

    const s = noiseSource(c);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2400;
    f.Q.value = 0.9;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.09, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    s.connect(f).connect(ng).connect(master);
    s.start(t);
    s.stop(t + 0.12);
  },

  /* sticker slapped back onto the wall */
  snap() {
    if (!this.enabled) return;
    const c = ensure();
    if (!c || !master) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(72, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.26);
  },

  click() {
    if (!this.enabled) return;
    const c = ensure();
    if (!c || !master) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.05);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.09);
  },

  /* the whole wall coming off */
  fanfare() {
    if (!this.enabled) return;
    const c = ensure();
    if (!c || !master) return;
    const t = c.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    notes.forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = i > 2 ? "triangle" : "sawtooth";
      o.frequency.value = f;
      const at = t + i * 0.075;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.075, at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.5);
      o.connect(g).connect(master!);
      o.start(at);
      o.stop(at + 1.6);
    });
    const s = noiseSource(c);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(5200, t + 0.7);
    f.Q.value = 0.7;
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.1, t + 0.35);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    s.connect(f).connect(g2).connect(master);
    s.start(t);
    s.stop(t + 1.2);
  },
};
