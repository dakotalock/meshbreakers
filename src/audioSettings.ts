import type { Music } from "./music";
import type { Sound } from "./audio";

export type AudioSettings = { sound: boolean; music: boolean; musicVolume: number };

/** True when both effects and music are off. */
export function isMuted(settings: AudioSettings): boolean {
  return !settings.sound && !settings.music;
}

/** Topbar mute: if anything is audible, silence both; otherwise restore both. */
export function toggleMute(
  settings: AudioSettings,
  sound: Pick<Sound, "enabled">,
  music: Pick<Music, "configure">,
): boolean {
  const enable = isMuted(settings);
  settings.sound = enable;
  settings.music = enable;
  sound.enabled = settings.sound;
  music.configure(settings.music, settings.musicVolume);
  return enable;
}
