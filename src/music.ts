/** Original recorded score. Web Audio gives iOS a real, independent music volume. */
export const TRACKS = {
  title: {title: "A Light Between Seconds", scene: "Title theme"},
  battle: {title: "A Hundred Small Rebellions", scene: "Battle theme"},
  boss: {title: "The Hour That Devours", scene: "Boss theme"},
  refuge: {title: "Somewhere the Rain Can Find Us", scene: "Journey & refuge"},
  victory: {title: "Tomorrow Is Ours", scene: "Victory"},
} as const;
export type Cue = keyof typeof TRACKS;
export class Music {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<Cue, AudioBuffer>();
  private pending = new Map<Cue, Promise<AudioBuffer>>();
  private playing: {source: AudioBufferSourceNode; gain: GainNode; cue: Cue} | null = null;
  private cue: Cue = "title";
  private enabled = true;
  private volume = .35;
  private request = 0;
  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : .35;
    if (this.master && this.context) this.master.gain.setTargetAtTime(enabled ? this.volume : 0, this.context.currentTime, .15);
    if (enabled && !this.playing) void this.activate();
  }
  unlock() {
    if (!this.context) {
      const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      if (!Ctx) return;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume().catch(() => {});
    if (!this.playing) void this.activate();
  }
  setCue(cue: Cue) {
    if (this.cue === cue) return;
    this.cue = cue;
    void this.activate();
  }
  visibility(hidden: boolean) {
    if (!this.context) return;
    if (hidden) void this.context.suspend().catch(() => {});
    else void this.context.resume().catch(() => {});
  }
  private async buffer(cue: Cue): Promise<AudioBuffer> {
    if (this.buffers.has(cue)) return this.buffers.get(cue)!;
    if (this.pending.has(cue)) return this.pending.get(cue)!;
    const task = (async () => {
      const response = await fetch(`./music/${cue}.mp3`);
      if (!response.ok) throw new Error("Music unavailable");
      const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(cue, buffer);
      // Two decoded cues keep crossfades smooth without keeping the entire score in RAM.
      while (this.buffers.size > 2) this.buffers.delete(this.buffers.keys().next().value!);
      return buffer;
    })();
    this.pending.set(cue, task);
    try { return await task; } finally { this.pending.delete(cue); }
  }
  private async activate() {
    if (!this.context || !this.enabled || this.playing?.cue === this.cue) return;
    const ticket = ++this.request, cue = this.cue;
    try {
      const buffer = await this.buffer(cue);
      if (ticket !== this.request || !this.enabled) return;
      const c = this.context, source = c.createBufferSource(), gain = c.createGain(), now = c.currentTime;
      source.buffer = buffer; source.loop = cue !== "victory";
      source.connect(gain); gain.connect(this.master!);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(1, now + 1.8);
      const old = this.playing;
      if (old) {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + 1.8);
        old.source.stop(now + 1.9);
      }
      this.playing = {source, gain, cue};
      source.onended = () => {
        source.disconnect(); gain.disconnect();
        if (this.playing?.source === source) {
          this.playing = null;
          if (this.cue === "victory") this.setCue("refuge");
        }
      };
      source.start();
    } catch { /* Audio is optional; offline first loads and blocked audio never block play. */ }
  }
}
