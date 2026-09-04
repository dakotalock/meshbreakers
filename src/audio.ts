export class Sound {
  enabled = false;
  private ctx: AudioContext | null = null;
  unlock() {
    if (!this.ctx) {
      const C =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (C) this.ctx = new C();
    }
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }
  play = (kind: string) => {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime,
      notes: Record<string, number[]> = {
        hit: [145, 65],
        death: [95, 35],
        heal: [440, 660, 880],
        shield: [260, 390],
        shock: [580, 145],
        mark: [700, 500],
        boost: [320, 480, 640],
        stun: [400, 180],
        dice: [220, 330, 440],
        click: [420, 520],
        win: [330, 440, 660, 880],
      };
    const tones = notes[kind] ?? notes.click;
    tones.forEach((f, i) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = ["hit", "death", "shock"].includes(kind) ? "sawtooth" : "sine";
      o.frequency.setValueAtTime(f, t + i * 0.05);
      o.frequency.exponentialRampToValueAtTime(
        Math.max(30, f * 0.65),
        t + i * 0.05 + 0.18,
      );
      g.gain.setValueAtTime(0.0001, t + i * 0.05);
      g.gain.exponentialRampToValueAtTime(
        kind === "hit" ? 0.035 : 0.045,
        t + i * 0.05 + 0.008,
      );
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.22);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t + i * 0.05);
      o.stop(t + i * 0.05 + 0.25);
    });
  };
}
