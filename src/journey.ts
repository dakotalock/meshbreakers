import type { Difficulty, Progress, Run } from "./types";

export const DIFFICULTY_KEY = "meshbreakers.difficulty";

/** A title preference configures a new journey; a saved run owns its difficulty. */
export function restoreDifficulty(
  raw: string | null,
  progress: Progress,
  saved: Run | null,
): Difficulty {
  const available = (value: unknown): value is Difficulty =>
    value === "normal" || value === "hard" ||
    (value === "paradox" && progress.hardCleared);
  if (available(raw)) return raw;
  return available(saved?.difficulty) ? saved!.difficulty : "normal";
}

export function canContinue(saved: Run | null): saved is Run {
  return Boolean(saved && !["won", "lost"].includes(saved.screen));
}

/** Do not silently resume a different mode from the one the player just selected. */
export function resumeJourney(
  saved: Run | null,
  selected: Difficulty,
  confirmed = false,
): Run | null {
  if (!canContinue(saved)) return null;
  if (!confirmed && saved.difficulty !== selected) return null;
  return saved;
}

export function replaySettings(run: Run): { seed: string; difficulty: Difficulty } {
  return { seed: run.seed, difficulty: run.difficulty };
}
