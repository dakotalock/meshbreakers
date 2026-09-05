import { describe, expect, it } from "vitest";
import * as G from "../src/engine";
import { HEROES, ENEMIES, RELICS, heroDef } from "../src/content";
import { buildCharacter } from "../src/models";
import * as THREE from "three";

function combat(hero = "rook") {
  const r = G.createRun("ECHOES", "rook");
  if (hero !== "rook") r.party = [G.makeHero(r, hero)];
  for (const e of r.battle!.enemies) {
    e.hp = e.maxHp = 300;
    e.armor = 0;
    e.shield = 0;
  }
  r.battle!.terrain = "foundry";
  return r;
}
function use(
  r: ReturnType<typeof combat>,
  skill: string,
  value: number,
  target = r.battle!.enemies[0].uid,
) {
  const d = r.battle!.dice.find((d) => !d.used)!;
  d.value = value;
  const result = G.playSkill(r, r.party[0].uid, skill, d.id, target);
  expect(result.ok).toBe(true);
  return result;
}
describe("five-floor campaign compatibility", () => {
  it("the third boss awards a reward and the fifth boss ends the new run", () => {
    const r = combat();
    r.act = 3;
    r.nodeId = "3-7-1";
    r.battle!.nodeType = "boss";
    for (const e of r.battle!.enemies) {
      e.hp = 1;
      e.shock = 5;
    }
    G.endTurn(r);
    expect(r.screen).toBe("reward");
    G.skipReward(r);
    expect(r.act).toBe(4);
    expect(G.availableNodes(r).map((n) => n.id)).toEqual(["4-0-1"]);
    const bosses = r.maps.filter((n) => n.type === "boss");
    expect(bosses.map((n) => n.encounter[0])).toEqual([
      "doorman",
      "census",
      "seraph",
      "archivist",
      "lattice",
    ]);
  });
  it("boss escalation is included in fixed-damage intents and damage resolution", () => {
    const r = G.createRun("ESCALATE", "rook");
    r.act = 2;
    r.nodeId = "2-6-1";
    r.screen = "map";
    G.enterNode(r, "2-7-1");
    const boss = r.battle!.enemies.find((e) => e.boss)!;
    const first = boss.intent.value;
    for (let i = 0; i < 3; i++) {
      r.party[0].hp = r.party[0].maxHp;
      r.party[0].shield = 200;
      G.endTurn(r);
    }
    expect(boss.intent.effect).toBe("sweep");
    expect(boss.intent.value).toBe(first + 2);
    const normal = G.createRun("HARD", "rook"),
      hard = G.createRun("HARD", "rook", "hard");
    expect(hard.battle!.enemies[0].hp).toBeGreaterThan(
      normal.battle!.enemies[0].hp,
    );
    expect(hard.battle!.enemies[0].intent.value).toBeGreaterThan(
      normal.battle!.enemies[0].intent.value,
    );
  });
  it("preserves an existing three-floor save, its dice, party, and ending", () => {
    const r = combat();
    r.maps = r.maps.filter((n) => n.act <= 3);
    r.maps.find((n) => n.id === "3-7-1")!.encounter = ["lattice", "ward"];
    G.lockDie(r, 0);
    const old = JSON.stringify(r),
      loaded = G.loadRun(old)!;
    expect(JSON.stringify(loaded)).toBe(old);
    expect(G.campaignFloors(loaded)).toBe(3);
    loaded.act = 3;
    loaded.nodeId = "3-7-1";
    loaded.battle!.nodeType = "boss";
    for (const e of loaded.battle!.enemies) {
      e.hp = 1;
      e.shock = 5;
    }
    G.endTurn(loaded);
    expect(loaded.screen).toBe("won");
  });
});
describe("new hero identities and relic combinations", () => {
  it("Vale makes low dice useful without adding the bonus to ultimates", () => {
    const r = combat("vale"),
      h = r.party[0],
      s = heroDef("vale").skills[0],
      u = heroDef("vale").skills[3];
    expect(G.skillValue(r, h, s, 2)).toBe(8);
    expect(G.skillValue(r, h, s, 3)).toBe(5);
    expect(G.skillValue(r, h, u, 0)).toBe(22);
    const enemy = r.battle!.enemies[0];
    enemy.shield = 50;
    use(r, "lunge", 2);
    expect(enemy.hp).toBe(292);
    expect(enemy.shield).toBe(50);
  });
  it("Mara triages wounded allies and combines with Mercy engine", () => {
    const r = combat("mara"),
      h = r.party[0];
    r.relics = ["mercy"];
    h.hp = 8;
    use(r, "triage", 2, h.uid);
    expect(h.hp).toBe(18);
  });
  it("Sol benefits from existing Shock on a target", () => {
    const r = combat("sol"),
      e = r.battle!.enemies[0];
    e.shock = 2;
    use(r, "lance", 4);
    expect(e.hp).toBe(289);
  });
  it("Vesper gains bonus charge only on the first basic ability of a turn", () => {
    const r = combat("vesper"),
      h = r.party[0];
    h.charge = 0;
    use(r, "rift", 3);
    expect(h.charge).toBe(2);
    use(r, "delay", 4, h.uid);
    expect(h.charge).toBe(3);
    h.charge = 6;
    for (const e of r.battle!.enemies) e.staggered = true;
    expect(G.playSkill(r, h.uid, "u", null, h.uid).ok).toBe(false);
    r.battle!.enemies[1].staggered = false;
    expect(G.playSkill(r, h.uid, "u", null, h.uid).ok).toBe(true);
    expect(r.battle!.enemies.map((e) => e.stun)).toEqual([false, true]);
  });
  it("Atlas protects himself while covering another hero", () => {
    const r = combat("atlas"),
      h = r.party[0],
      ally = G.makeHero(r, "rook");
    r.party.push(ally);
    use(r, "cover", 2, ally.uid);
    expect(h.shield).toBe(3);
    expect(ally.shield).toBe(7);
  });
  it("Moth combines Mark, Shock, Oracle lens, and Prism capacitor", () => {
    const r = combat("moth"),
      e = r.battle!.enemies[0];
    r.relics = ["scope", "prism"];
    use(r, "thread", 5);
    expect(e.mark).toBe(5);
    expect(e.shock).toBe(3);
  });
  it("Small rebellion and Phase whetstone change preview and applied damage together", () => {
    const r = combat("iri");
    r.relics = ["cinder", "scalpel"];
    const e = r.battle!.enemies[0];
    e.shield = 50;
    use(r, "shot", 1);
    expect(e.hp).toBe(289);
    expect(e.shield).toBe(50);
  });
  it("ultimate relics trigger once per ultimate, not once per affected ally", () => {
    const r = combat(),
      h = r.party[0],
      ally = G.makeHero(r, "nyx");
    r.party.push(ally);
    h.hp = 10;
    ally.hp = 10;
    h.charge = 6;
    h.shield = 0;
    r.relics = ["afterglow", "mantle"];
    const fx = G.playSkill(r, h.uid, "u", null, h.uid).fx;
    expect(fx.filter((f) => f.kind === "ultimate")).toHaveLength(1);
    expect(h.hp).toBe(14);
    expect(ally.hp).toBe(14);
    expect(h.shield).toBe(26);
    expect(ally.shield).toBe(16);
  });
  it("new battle-start relics apply on entry and the clock expires after turn one", () => {
    const r = combat();
    r.relics = ["aegis", "clock"];
    r.screen = "map";
    const next = G.availableNodes(r).find((n) => n.type === "fight")!;
    G.enterNode(r, next.id);
    expect(r.party[0].armor).toBe(1);
    expect(r.battle!.rerolls).toBe(3);
    r.party[0].shield = 100;
    G.endTurn(r);
    expect(r.battle!.rerolls).toBe(2);
  });
  it("Singing wire adds its tick damage only to marked targets", () => {
    const r = combat();
    r.relics = ["resonance"];
    const [a, b] = r.battle!.enemies;
    a.shock = b.shock = 3;
    a.mark = 1;
    G.endTurn(r);
    expect(a.hp).toBe(295);
    expect(b.hp).toBe(297);
    expect(a.shock).toBe(2);
  });
  it("victory recovery stacks on elites and never revives fallen allies", () => {
    const r = combat(),
      h = r.party[0],
      dead = G.makeHero(r, "iri");
    r.party.push(dead);
    dead.hp = 0;
    h.hp = 5;
    r.relics = ["rations", "banner"];
    r.battle!.nodeType = "elite";
    for (const e of r.battle!.enemies) {
      e.hp = 1;
      e.shock = 5;
    }
    G.endTurn(r);
    expect(h.hp).toBe(14);
    expect(r.party).toHaveLength(1);
  });
  it("Giantkiller only increases hits on elite or boss targets", () => {
    const r = combat();
    r.relics = ["hunter"];
    const e = r.battle!.enemies[0];
    e.elite = true;
    use(r, "strike", 3);
    expect(e.hp).toBe(290);
  });
  it("every expanded content identifier is unique", () => {
    for (const entries of [HEROES, ENEMIES, RELICS])
      expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(RELICS).toHaveLength(28);
  });
});
it("all character rigs build finite geometry within a bounded mobile draw budget", () => {
  const r = combat();
  for (const d of [...HEROES, ...ENEMIES]) {
    const root = new THREE.Group(),
      u = { ...r.party[0], defId: d.id };
    const rig = buildCharacter(
      root,
      u,
      ENEMIES.includes(d as (typeof ENEMIES)[number]),
    );
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root),
      size = bounds.getSize(new THREE.Vector3());
    expect(Number.isFinite(size.x + size.y + size.z)).toBe(true);
    expect(size.y).toBeGreaterThan(0.4);
    expect(size.y).toBeLessThan(5);
    let meshes = 0;
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        meshes++;
        o.geometry.dispose();
      }
    });
    expect(meshes).toBeLessThan(110);
    expect(rig.body.parent).toBe(root);
  }
});
