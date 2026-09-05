import { describe, expect, it } from "vitest";
import * as G from "../src/engine";
import * as J from "../src/journey";
import type { Difficulty } from "../src/types";

describe("difficulty selection and saved journeys", () => {
  it("keeps a selected Hard preference across reloads without changing a Standard save", () => {
    const saved = G.createRun("DHUPZUD", "rook");
    const before = JSON.stringify(saved), progress = G.loadProgress(null);
    const selected = J.restoreDifficulty("hard", progress, G.loadRun(before));
    const fresh = G.createRun(saved.seed, "rook", selected, progress);
    expect(selected).toBe("hard");
    expect(fresh.battle!.enemies[0].maxHp).toBeGreaterThan(saved.battle!.enemies[0].maxHp);
    expect(G.loadRun(JSON.stringify(fresh))!.difficulty).toBe("hard");
    expect(JSON.stringify(saved)).toBe(before);
  });

  it("requires confirmation before a selected Hard mode resumes a Standard squad", () => {
    const saved = G.createRun("CONTINUE", "rook");
    saved.party[0].hp = 17;
    saved.relics = ["battery"];
    G.lockDie(saved, 0);
    const before = JSON.stringify(saved);
    expect(J.resumeJourney(saved, "hard")).toBeNull();
    expect(JSON.stringify(saved)).toBe(before);
    const continued = J.resumeJourney(saved, "hard", true)!;
    expect(continued).toBe(saved);
    expect(continued.difficulty).toBe("normal");
    expect(JSON.stringify(continued)).toBe(before);
  });

  it("continues a matching mode immediately, but never continues a finished run", () => {
    const saved = G.createRun("CONTINUE", "rook", "hard");
    expect(J.resumeJourney(saved, "hard")).toBe(saved);
    for (const screen of ["won", "lost"] as const) {
      saved.screen = screen;
      expect(J.canContinue(saved)).toBe(false);
      expect(J.resumeJourney(saved, "hard", true)).toBeNull();
    }
    expect(J.resumeJourney(null, "hard")).toBeNull();
  });

  it("replays each seed at its original difficulty and restarts Paradox at timeline one", () => {
    const progress = {version: 1 as const, hardCleared: true, paradoxCleared: false};
    for (const difficulty of ["normal", "hard", "paradox"] as Difficulty[]) {
      const original = G.createRun("REPLAY", "rook", difficulty, progress);
      if (difficulty === "paradox") original.cycle = 3;
      const settings = J.replaySettings(original);
      const replay = G.createRun(settings.seed, "rook", settings.difficulty, progress);
      expect(replay.seed).toBe(original.seed);
      expect(replay.difficulty).toBe(original.difficulty);
      expect(G.cycleOf(replay)).toBe(1);
    }
  });

  it("restores legacy Hard saves sensibly and cannot unlock Paradox through a preference", () => {
    const progress = G.loadProgress(null), hard = G.createRun("LEGACY", "rook", "hard");
    expect(J.restoreDifficulty(null, progress, hard)).toBe("hard");
    expect(J.restoreDifficulty("invalid", progress, hard)).toBe("hard");
    expect(J.restoreDifficulty("paradox", progress, null)).toBe("normal");
    expect(progress.hardCleared).toBe(false);
    expect(J.restoreDifficulty("paradox", {...progress, hardCleared: true}, hard)).toBe("paradox");
  });

  it("unlocks Paradox from the resumed run's actual Hard victory", () => {
    const progress = G.loadProgress(null);
    const original = G.createRun("UNLOCK", "rook", "hard");
    const resumed = J.resumeJourney(G.loadRun(JSON.stringify(original)), "normal", true)!;
    resumed.act = 5;
    resumed.nodeId = "5-6-1";
    resumed.screen = "map";
    G.enterNode(resumed, "5-7-1");
    for (const enemy of resumed.battle!.enemies) {enemy.hp = 1; enemy.shock = 5;}
    G.endTurn(resumed);
    expect(resumed.screen).toBe("won");
    G.recordVictory(progress, resumed);
    expect(progress.hardCleared).toBe(true);
    expect(G.loadProgress(null, G.loadRun(JSON.stringify(resumed))).hardCleared).toBe(true);
  });
});
