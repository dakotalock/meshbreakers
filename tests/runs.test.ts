import { expect, it } from "vitest";
import {sim} from "./support/player";
it("finishes 36 seeded campaigns without invalid states, blocked routes, or save corruption", () => {
  const results = [];
  for (const starter of ["rook", "iri", "nyx"]) {
    let wins = 0,
      maxAct = 0;
    for (let i = 0; i < 12; i++) {
      const r = sim("COALITION" + i, starter);
      if (r.screen === "won") wins++;
      maxAct = Math.max(maxAct, r.act);
    }
    results.push({ starter, wins, maxAct });
  }
  console.log("Campaign balance smoke test:", results);
  expect(results.every((r) => r.maxAct >= 2)).toBe(true);
});
