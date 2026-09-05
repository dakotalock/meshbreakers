import { expect, it } from "vitest";
import * as G from "../src/engine";
import { heroDef, EVENTS, MODS } from "../src/content";
import type { Run, Unit, Skill } from "../src/types";
function threat(r: Run, h: Unit) {
  return G.foes(r).reduce(
    (sum, e) =>
      sum +
      (e.stun
        ? 0
        : e.intent.target === h.uid || e.intent.target === "all"
          ? Math.max(0, e.intent.value - (e.weak ? 2 : 0))
          : 0),
    0,
  );
}
function score(r: Run, h: Unit, s: Skill, t: Unit, value: number) {
  const v = G.skillValue(r, h, s, value),
    b = r.battle!,
    enemy = G.foes(r).find((e) => e.uid === t.uid),
    aoe =
      s.target === "enemies"
        ? G.foes(r).length
        : s.target === "party"
          ? G.living(r).length
          : 1;
  switch (s.effect) {
    case "hit":
    case "pierce":
    case "sweep":
    case "drain": {
      const dmg = Math.max(
        0,
        v + t.mark - (s.effect === "pierce" ? 0 : t.shield),
      );
      return (
        Math.min(t.hp, dmg) * aoe +
        (t.hp <= dmg ? 16 + (enemy?.intent.value ?? 0) * 2 : 0) +
        (s.extra === "shock" ? 4 : 0) +
        (s.extra === "weaken" && enemy?.intent.effect === "hit" ? 3 : 0)
      );
    }
    case "shock":
      return Math.min(t.hp, v * 2) * aoe;
    case "shield":
    case "taunt": {
      const inc =
        s.target === "party"
          ? G.living(r).reduce(
              (sum, t) =>
                sum + Math.min(v, Math.max(0, threat(r, t) - t.shield)),
              0,
            )
          : Math.min(v, Math.max(0, threat(r, t) - t.shield));
      return inc * 1.7 + (t.hp < 10 ? inc : 0);
    }
    case "heal":
      return (
        (s.target === "party"
          ? G.living(r).reduce((sum, t) => sum + Math.min(v, t.maxHp - t.hp), 0)
          : Math.min(v, t.maxHp - t.hp)) * 1.7
      );
    case "stun":
      return Math.max(0, enemy?.intent.value ?? 0) * 1.8;
    case "mark":
      return b.dice.filter((d) => !d.used).length > 2 ? v * 2.8 * aoe : 0;
    case "boost":
      return b.round < 4 ? v * 3 * aoe : 0;
    default:
      return 0;
  }
}
function fight(r: Run) {
  let actions = 0;
  while (r.screen === "battle" && actions++ < 200) {
    let best: {
      h: Unit;
      s: Skill;
      id: number | null;
      t: Unit;
      score: number;
    } | null = null;
    for (const h of G.living(r))
      for (const s of heroDef(h.defId).skills)
        for (const d of s.ultimate
          ? [{ id: null, value: 0 }]
          : r.battle!.dice.filter((d) => !d.used)) {
          if (G.skillReason(r, h, s, d.id)) continue;
          for (const t of G.targets(r, h, s)) {
            const utility = score(r, h, s, t, d.value);
            if (!best || utility > best.score)
              best = { h, s, id: d.id, t, score: utility };
          }
        }
    if (best && best.score > 0) {
      const a = G.playSkill(r, best.h.uid, best.s.id, best.id, best.t.uid);
      expect(a.ok).toBe(true);
    } else if (r.battle!.rerolls > 0 && r.battle!.dice.some((d) => !d.used))
      G.reroll(r);
    else G.endTurn(r);
  }
  expect(actions).toBeLessThan(201);
}
function sim(seed: string, starter: string) {
  const r = G.createRun(seed, starter);
  let steps = 0;
  while (!["won", "lost"].includes(r.screen) && steps++ < 150) {
    switch (r.screen) {
      case "battle":
        fight(r);
        break;
      case "reward": {
        let i = r.rewards.findIndex(
          (x) => x.kind === "recruit" && r.party.length < 3,
        );
        if (i < 0) i = r.rewards.findIndex((x) => x.kind === "relic");
        if (i < 0) i = 0;
        G.chooseReward(r, i);
        break;
      }
      case "map": {
        const nodes = G.availableNodes(r),
          preference =
            r.party.length < 3
              ? ["recruit", "event", "rest", "shop", "fight", "elite", "boss"]
              : r.party.some((h) => h.hp < h.maxHp * 0.6)
                ? ["rest", "shop", "event", "fight", "recruit", "elite", "boss"]
                : [
                    "event",
                    "rest",
                    "fight",
                    "shop",
                    "elite",
                    "recruit",
                    "boss",
                  ];
        const n = [...nodes].sort(
          (a, b) => preference.indexOf(a.type) - preference.indexOf(b.type),
        )[0];
        expect(n).toBeDefined();
        G.enterNode(r, n.id);
        break;
      }
      case "recruit": {
        if (r.party.length >= 3) G.continueToMap(r);
        else {
          const priority = [
            "nyx",
            "coil",
            "wren",
            "iri",
            "juno",
            "rook",
            "pax",
            "sable",
            "hexa",
            "mara",
            "atlas",
            "sol",
            "vale",
            "moth",
            "vesper",
          ];
          G.recruit(
            r,
            [...r.recruits].sort(
              (a, b) => priority.indexOf(a) - priority.indexOf(b),
            )[0],
          );
        }
        break;
      }
      case "rest":
        G.rest(
          r,
          r.party.some((h) => h.hp < h.maxHp * 0.75) ? "heal" : "upgrade",
        );
        break;
      case "upgrade": {
        const h = [...r.party].sort((a, b) => a.level - b.level)[0];
        const m = ["power", "plating", "vitality", "charge"].find(
          (m) => h.mods.filter((x) => x === m).length < 3,
        );
        expect(m).toBeDefined();
        G.upgrade(r, h.uid, m!);
        break;
      }
      case "shop": {
        for (const id of [...r.shop]) G.buy(r, id);
        if (r.party.some((h) => h.hp < h.maxHp * 0.7)) G.buy(r, "heal");
        G.continueToMap(r);
        break;
      }
      case "event": {
        const ev = EVENTS.find((e) => e.id === r.eventId)!;
        let index = ev.choices.findIndex((c) =>
          r.party.length < 3
            ? c.effect === "recruit"
            : c.effect === "heal" || c.effect === "gift",
        );
        if (index < 0)
          index = ev.choices.findIndex(
            (c) => c.effect !== "relic" || r.gold >= c.value,
          );
        G.eventChoice(r, index);
        break;
      }
    }
    expect(r.party.every((h) => h.hp >= 0 && h.hp <= h.maxHp)).toBe(true);
    expect(G.loadRun(JSON.stringify(r))).not.toBeNull();
  }
  expect(["won", "lost"]).toContain(r.screen);
  return r;
}
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
