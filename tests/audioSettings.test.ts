import { describe, expect, it } from "vitest";
import { isMuted, toggleMute } from "../src/audioSettings";

describe("topbar mute", () => {
  it("mutes and unmutes music and effects together", () => {
    const settings = { sound: true, music: true, musicVolume: 0.35 };
    const sound = { enabled: true };
    let musicEnabled = true;
    const music = {
      configure(enabled: boolean, volume: number) {
        musicEnabled = enabled;
        expect(volume).toBe(0.35);
      },
    };
    expect(isMuted(settings)).toBe(false);
    expect(toggleMute(settings, sound, music)).toBe(false);
    expect(settings.sound).toBe(false);
    expect(settings.music).toBe(false);
    expect(sound.enabled).toBe(false);
    expect(musicEnabled).toBe(false);
    expect(isMuted(settings)).toBe(true);
    expect(toggleMute(settings, sound, music)).toBe(true);
    expect(settings.sound).toBe(true);
    expect(settings.music).toBe(true);
    expect(sound.enabled).toBe(true);
    expect(musicEnabled).toBe(true);
  });

  it("silences a partial mix so the mute icon matches real silence", () => {
    const settings = { sound: true, music: false, musicVolume: 0.5 };
    const sound = { enabled: true };
    let musicEnabled = false;
    const music = { configure(enabled: boolean) { musicEnabled = enabled; } };
    toggleMute(settings, sound, music);
    expect(isMuted(settings)).toBe(true);
    expect(sound.enabled).toBe(false);
    expect(musicEnabled).toBe(false);
  });
});
