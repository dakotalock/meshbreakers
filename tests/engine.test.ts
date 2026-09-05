import { describe, expect, it } from "vitest";
import * as G from "../src/engine";
import { HEROES, heroDef, MODS } from "../src/content";
function first(seed = "TEST", starter = "rook") {
  return G.createRun(seed, starter);
}
describe("deterministic runs and legal progression", () => {
  it("replays the same world, dice, and actions from a seed", () => {
    const a = first("DAKOTA7"),
      b = first("DAKOTA7");
    expect(a).toEqual(b);
    G.reroll(a);
    G.reroll(b);
    expect(a).toEqual(b);
    expect(first("DAKOTA8").maps).not.toEqual(a.maps);
  });
  it("generates 5 connected floors with recruits and safehouses before bosses", () => {
    for (let i = 0; i < 80; i++) {
      const r = first("MAP" + i);
      expect(r.maps).toHaveLength(100);
      for (let act = 1; act <= 5; act++) {
        const nodes = r.maps.filter((n) => n.act === act);
        for (const n of nodes) {
          if (n.row < 7) expect(n.next.length).toBeGreaterThan(0);
          for (const id of n.next) {
            const next = nodes.find((x) => x.id === id)!;
            expect(next.row).toBe(n.row + 1);
          }
        }
        expect(nodes.some((n) => n.type === "recruit")).toBe(true);
        expect(
          nodes.filter((n) => n.row === 6).every((n) => n.type === "rest"),
        ).toBe(true);
      }
    }
  });
  it("rejects skipping ahead, including direct boss entry", () => {
    const r = first();
    expect(G.enterNode(r, "3-7-1")).toBe(false);
    r.screen = "map";
    expect(G.enterNode(r, "1-7-1")).toBe(false);
    const id = G.availableNodes(r)[0].id;
    expect(G.enterNode(r, id)).toBe(true);
  });
  it("round-trips a mid-fight save including locked dice and the RNG state", () => {
    const r = first();
    G.lockDie(r, 0);
    G.reroll(r);
    expect(G.loadRun(JSON.stringify(r))).toEqual(r);
    expect(G.loadRun("{")).toBeNull();
    expect(G.loadRun(JSON.stringify({ ...r, version: 1 }))).toBeNull();
  });
});
describe("combat economy and timing", () => {
  it("keeps locked dice, decrements rerolls, and refuses a third reroll", () => {
    const r = first();
    const value = r.battle!.dice[0].value;
    G.lockDie(r, 0);
    expect(G.reroll(r)).toBe(true);
    expect(r.battle!.dice[0].value).toBe(value);
    expect(G.reroll(r)).toBe(true);
    expect(G.reroll(r)).toBe(false);
  });
  it("does not spend dice or charge when a skill or target is invalid", () => {
    const r = first("T", "iri");
    r.battle!.dice[0].value = 2;
    const before = JSON.stringify(r);
    expect(
      G.playSkill(r, r.party[0].uid, "mark", 0, r.battle!.enemies[0].uid).ok,
    ).toBe(false);
    expect(JSON.stringify(r)).toBe(before);
    expect(G.playSkill(r, r.party[0].uid, "shot", 0, "bogus").ok).toBe(false);
    expect(JSON.stringify(r)).toBe(before);
  });
  it("uses each basic ability once per turn and earns ultimate charge", () => {
    const r = first(),
      h = r.party[0],
      e = r.battle!.enemies[0],
      charge = h.charge;
    expect(G.playSkill(r, h.uid, "strike", 0, e.uid).ok).toBe(true);
    expect(r.battle!.dice[0].used).toBe(true);
    expect(h.charge).toBe(charge + 1);
    expect(G.playSkill(r, h.uid, "strike", 1, e.uid).ok).toBe(false);
  });
  it("Block protects through the enemy phase and expires at the next turn", () => {
    const r = first(),
      h = r.party[0];
    h.shield = 100;
    const hp = h.hp;
    G.endTurn(r);
    expect(h.hp).toBe(hp);
    expect(h.shield).toBe(3);
    expect(r.battle!.round).toBe(2);
  });
  it("piercing damage bypasses Block without consuming it", () => {
    const r = first("I", "iri"),
      e = r.battle!.enemies[0];
    e.hp = e.maxHp = 50;
    e.shield = 100;
    const h = r.party[0];
    G.playSkill(r, h.uid, "shot", 0, e.uid);
    expect(e.hp).toBeLessThan(50);
    expect(e.shield).toBe(100);
  });
  it("Shock kills before an enemy can act and prevents a lethal attack", () => {
    const r = first(),
      h = r.party[0];
    h.hp = 1;
    h.shield = 0;
    for (const e of r.battle!.enemies) {
      e.hp = 1;
      e.shock = 2;
    }
    G.endTurn(r);
    expect(r.screen).toBe("reward");
    expect(h.hp).toBe(1);
  });
  it("jam cancels the action and prevents consecutive stunlock", () => {
    const r = first(),
      h = r.party[0];
    h.shield = 100;
    r.party = [G.makeHero(r, "sable")];
    const s = r.party[0],
      e = r.battle!.enemies[0];
    r.battle!.dice[0].value = 6;
    expect(G.playSkill(r, s.uid, "jam", 0, e.uid).ok).toBe(true);
    const effects = G.endTurn(r);
    expect(e.staggered).toBe(true);
    expect(
      effects.some((f) => f.target === e.uid && f.label === "ACTION CANCELLED"),
    ).toBe(true);
    r.battle!.dice[0].value = 6;
    expect(G.playSkill(r, s.uid, "jam", 0, e.uid).ok).toBe(false);
  });
  it("an ultimate requires full charge, costs no die, and cannot double fire", () => {
    const r = first(),
      h = r.party[0];
    expect(G.playSkill(r, h.uid, "u", null, h.uid).ok).toBe(false);
    h.charge = 6;
    expect(G.playSkill(r, h.uid, "u", null, h.uid).ok).toBe(true);
    expect(r.battle!.dice.every((d) => !d.used)).toBe(true);
    expect(h.charge).toBe(0);
    expect(G.playSkill(r, h.uid, "u", null, h.uid).ok).toBe(false);
  });
  it("backup core is consumed only once per fight", () => {
    const r = first();
    r.relics.push("core");
    r.party[0].hp = 1;
    r.party[0].shield = 0;
    G.endTurn(r);
    expect(r.battle!.overdrive).toBe(true);
    expect(r.screen).toBe("lost");
  });
});
describe("recruitment, upgrades, events, and endings", () => {
  it("caps the party, permits explicit replacements, and carries recruits to the route", () => {
    const r = first();
    G.offerRecruits(r);
    expect(G.recruit(r, r.recruits[0])).toBe(true);
    G.offerRecruits(r);
    expect(G.recruit(r, r.recruits[0])).toBe(true);
    G.offerRecruits(r);
    const candidate = r.recruits[0];
    expect(G.recruit(r, candidate)).toBe(false);
    const old = r.party[0].uid;
    expect(G.recruit(r, candidate, old)).toBe(true);
    expect(r.party).toHaveLength(3);
    expect(r.party.some((h) => h.uid === old)).toBe(false);
  });
  it("applies permanent upgrades and refuses a fourth stack", () => {
    const r = first(),
      h = r.party[0];
    for (let i = 0; i < 3; i++) {
      r.screen = "upgrade";
      expect(G.upgrade(r, h.uid, "vitality")).toBe(true);
    }
    expect(h.maxHp).toBe(heroDef(h.defId).hp + 30);
    r.screen = "upgrade";
    expect(G.upgrade(r, h.uid, "vitality")).toBe(false);
  });
  it("charges shop prices exactly once and prevents relic repurchase", () => {
    const r = first();
    r.screen = "shop";
    r.shop = ["battery"];
    r.gold = 100;
    expect(G.buy(r, "battery")).toBe(true);
    expect(r.gold).toBe(5);
    expect(G.buy(r, "battery")).toBe(false);
    expect(G.buy(r, "upgrade")).toBe(false);
  });
  it("grants the displayed event reward and keeps risk events nonlethal", () => {
    const r = first();
    r.screen = "event";
    r.eventId = "graffiti";
    r.party[0].hp = 2;
    const gold = r.gold;
    expect(G.eventChoice(r, 0)).toBe(true);
    expect(r.gold).toBe(gold + 40);
    expect(r.party[0].hp).toBe(1);
    expect(r.screen).toBe("map");
  });
  it("finishing the last boss reaches victory", () => {
    const r = first();
    r.act = 5;
    r.nodeId = "5-7-1";
    r.battle!.nodeType = "boss";
    for (const e of r.battle!.enemies) {
      e.hp = 1;
      e.shock = 9;
    }
    G.endTurn(r);
    expect(r.screen).toBe("won");
  });
  it("all sixteen heroes have legal, distinct kits", () => {
    expect(HEROES).toHaveLength(16);
    for (const h of HEROES) {
      expect(h.skills).toHaveLength(4);
      expect(h.skills.filter((s) => s.ultimate)).toHaveLength(1);
      expect(new Set(h.skills.map((s) => s.id)).size).toBe(4);
    }
    expect(MODS).toHaveLength(4);
  });
});
