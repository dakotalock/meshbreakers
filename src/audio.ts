/** Short, layered effects; all audio starts after a player gesture. */
export class Sound {
  enabled = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  unlock() {
    if (!this.ctx) {
      const Audio =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (Audio) {
        this.ctx = new Audio();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -16;
        limiter.knee.value = 12;
        limiter.ratio.value = 5;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.16;
        this.master.connect(limiter);
        limiter.connect(this.ctx.destination);
      }
    }
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }
  private tone(
    frequency: number,
    time: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    end = frequency,
  ) {
    const c = this.ctx!,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, time);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(25, end),
      time + duration,
    );
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(volume, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    o.connect(g);
    g.connect(this.master!);
    o.start(time);
    o.stop(time + duration + 0.01);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  private noise(
    time: number,
    duration: number,
    volume: number,
    frequency: number,
  ) {
    const c = this.ctx!,
      buffer = c.createBuffer(
        1,
        Math.ceil(c.sampleRate * duration),
        c.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start(time);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  play = (kind: string) => {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (["hit", "heavy", "death"].includes(kind)) {
      const heavy = kind !== "hit";
      this.noise(
        t,
        heavy ? 0.24 : 0.12,
        heavy ? 0.22 : 0.15,
        heavy ? 700 : 1900,
      );
      this.tone(heavy ? 110 : 170, t, heavy ? 0.28 : 0.16, 0.2, "sine", 35);
      this.tone(1250, t + 0.005, 0.11, 0.032, "triangle", 760);
      return;
    }
    if (kind === "shoot") {
      this.noise(t, 0.09, 0.1, 4200);
      this.tone(1500, t, 0.1, 0.045, "sawtooth", 250);
      return;
    }
    if (kind === "shock" || kind === "stun") {
      this.noise(t, 0.19, 0.08, 2400);
      this.tone(730, t, 0.16, 0.04, "triangle", 180);
      return;
    }
    const notes: Record<string, number[]> = {
      heal: [523.25, 659.25, 783.99],
      shield: [392, 587.33],
      mark: [880, 659.25],
      boost: [392, 493.88, 587.33],
      cast: [293.66, 440, 587.33],
      dice: [700, 980, 1250],
      click: [830],
      ultimate: [196, 293.66, 392, 493.88, 587.33, 783.99],
      win: [293.66, 392, 493.88, 587.33, 783.99],
    };
    const chord = notes[kind] ?? notes.click,
      long = kind === "ultimate" || kind === "win";
    chord.forEach((f, i) =>
      this.tone(
        f,
        t + i * (long ? 0.07 : 0.036),
        long ? 0.62 : kind === "click" ? 0.055 : 0.26,
        kind === "click" ? 0.025 : long ? 0.065 : 0.045,
        "sine",
        f * 0.997,
      ),
    );
    if (kind === "shield") this.noise(t, 0.18, 0.025, 3200);
    if (kind === "dice")
      for (let i = 0; i < 3; i++)
        this.noise(t + i * 0.035, 0.035, 0.08, 1800 + i * 400);
    if (long) this.tone(98, t, 0.65, 0.1, "sine", 73.42);
  };
}
