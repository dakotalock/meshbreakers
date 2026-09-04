import type {
  Run,
  Unit,
  Enemy,
  MapNode,
  NodeType,
  Skill,
  FX,
  Intent,
  Reward,
} from "./types";
import {
  HEROES,
  ENEMIES,
  RELICS,
  EVENTS,
  MODS,
  heroDef,
  enemyDef,
  relicDef,
  STARTERS,
} from "./content";
export const SAVE_KEY = "meshbreakers.run.v2";
export const CHARGE = 6;
export function hash(seed: string) {
  let n = 2166136261;
  for (const c of seed) {
    n ^= c.charCodeAt(0);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}
export function random(r: { rng: number }) {
  r.rng = (r.rng + 0x6d2b79f5) >>> 0;
  let t = r.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function pick<T>(r: { rng: number }, a: T[]): T {
  return a[Math.floor(random(r) * a.length)];
}
export function sample<T>(r: { rng: number }, a: T[], n: number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(random(r) * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b.slice(0, n);
}
export function newSeed() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(7)),
    (n) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n % 31],
  ).join("");
}
export function makeHero(r: Run, id: string): Unit {
  const d = heroDef(id);
  return {
    uid: "h" + ++r.seq,
    defId: id,
    hp: d.hp,
    maxHp: d.hp,
    shield: 0,
    mark: 0,
    shock: 0,
    weak: 0,
    stun: false,
    power: 0,
    armor: 0,
    charge: 0,
    used: [],
    level: 1,
    mods: [],
  };
}
function makeEnemy(r: Run, id: string, elite = false, boss = false): Enemy {
  const d = enemyDef(id),
    hp = Math.round(
      d.hp * (1 + (r.act - 1) * 0.22) * (r.difficulty === "hard" ? 1.15 : 1),
    );
  return {
    uid: "e" + ++r.seq,
    defId: id,
    hp,
    maxHp: hp,
    shield: 0,
    mark: 0,
    shock: 0,
    weak: 0,
    stun: false,
    power: 0,
    armor: 0,
    charge: 0,
    used: [],
    level: 1,
    mods: [],
    elite,
    boss,
    staggered: false,
    intent: { effect: "charge", value: 0, target: "", name: "Booting" },
  };
}
export function makeMaps(r: { rng: number }): MapNode[] {
  const maps: MapNode[] = [];
  for (let act = 1; act <= 3; act++) {
    for (let row = 0; row < 8; row++) {
      const cols = row === 0 || row === 7 ? [1] : [0, 1, 2];
      for (const col of cols) {
        let type: NodeType =
          row === 7
            ? "boss"
            : row === 6
              ? "rest"
              : row === 0
                ? "fight"
                : row === 2 && col === 1
                  ? "recruit"
                  : row === 4 && col === 0
                    ? "elite"
                    : pick(r, [
                        "fight",
                        "fight",
                        "event",
                        "shop",
                        "recruit",
                      ] as NodeType[]);
        if (row === 1 && col === 1) type = "fight";
        if (row === 4 && col === 2) type = "fight";
        const pools =
          act === 1
            ? [
                ["drone", "drone"],
                ["ripper"],
                ["ward", "drone"],
                ["leech", "drone"],
                ["volt", "drone"],
              ]
            : [
                ["ripper", "ward"],
                ["volt", "leech"],
                ["scribe", "ripper", "drone"],
                ["ward", "volt"],
                ["leech", "leech", "drone"],
              ];
        let encounter =
          type === "boss"
            ? [["doorman"], ["census", "drone"], ["lattice", "ward"]][act - 1]
            : type === "elite"
              ? pick(r, [
                  ["bailiff", "drone"],
                  ["hive", "ward"],
                ])
              : pick(r, pools);
        if (act === 1 && row === 0) encounter = ["drone", "drone"];
        maps.push({
          id: `${act}-${row}-${col}`,
          act,
          row,
          col,
          type,
          next: [],
          terrain: pick(r, ["foundry", "conduit", "scrapyard", "tower"]),
          encounter: [...encounter],
        });
      }
    }
    for (const n of maps.filter((n) => n.act === act && n.row < 7))
      n.next = maps
        .filter(
          (m) =>
            m.act === act &&
            m.row === n.row + 1 &&
            (n.row === 0 || n.row === 6 || Math.abs(m.col - n.col) <= 1),
        )
        .map((m) => m.id);
  }
  return maps;
}
export function createRun(
  seed: string,
  starter: string,
  difficulty: "normal" | "hard" = "normal",
): Run {
  if (!STARTERS.includes(starter)) throw new Error("Choose a starter hero.");
  const clean =
    seed
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .slice(0, 20) || "RESIST";
  const r: Run = {
    version: 2,
    seed: clean,
    rng: hash(clean),
    difficulty,
    screen: "map",
    party: [],
    maps: [],
    nodeId: "",
    visited: [],
    act: 1,
    gold: 45,
    relics: [],
    battle: null,
    rewards: [],
    recruits: [],
    shop: [],
    eventId: "",
    upgradeReturn: "map",
    fallen: [],
    stats: { kills: 0, turns: 0, damage: 0, recruits: 0 },
    seq: 0,
    bonus: 0,
    result: "",
    history: [],
  };
  r.maps = makeMaps(r);
  r.party = [makeHero(r, starter)];
  enterNode(r, "1-0-1");
  return r;
}
export const living = (r: Run) => r.party.filter((h) => h.hp > 0);
export const foes = (r: Run) => r.battle?.enemies.filter((e) => e.hp > 0) ?? [];
export function currentNode(r: Run) {
  return r.maps.find((n) => n.id === r.nodeId);
}
export function availableNodes(r: Run) {
  if (r.screen !== "map") return [];
  const n = currentNode(r);
  return r.maps.filter(
    (m) =>
      m.act === r.act &&
      (n && n.act === r.act ? n.next.includes(m.id) : m.row === 0),
  );
}
export function enterNode(r: Run, id: string): boolean {
  if (!availableNodes(r).some((n) => n.id === id)) return false;
  const n = r.maps.find((n) => n.id === id)!;
  r.nodeId = id;
  r.visited.push(id);
  r.result = "";
  if (["fight", "elite", "boss"].includes(n.type)) startBattle(r, n);
  else if (n.type === "recruit") offerRecruits(r);
  else if (n.type === "shop") {
    r.shop = sample(
      r,
      RELICS.filter((a) => !r.relics.includes(a.id)),
      3,
    ).map((a) => a.id);
    r.screen = "shop";
  } else if (n.type === "event") {
    r.eventId = pick(r, EVENTS).id;
    r.screen = "event";
  } else r.screen = "rest";
  return true;
}
function startBattle(r: Run, n: MapNode) {
  const coalition =
    new Set(r.party.map((h) => heroDef(h.defId).faction)).size === 3 &&
    r.relics.includes("link");
  for (const h of r.party) {
    h.shield = r.relics.includes("strap") ? 7 : 0;
    h.mark = 0;
    h.shock = 0;
    h.weak = 0;
    h.stun = false;
    h.used = [];
    h.revived = false;
    h.power =
      h.mods.filter((m) => m === "power").length * 2 + (coalition ? 2 : 0);
    h.armor =
      h.mods.filter((m) => m === "plating").length +
      (h.defId === "coil" ? 1 : 0);
    h.charge = Math.min(
      CHARGE,
      h.mods.filter((m) => m === "charge").length * 2 +
        (r.relics.includes("spark") ? 2 : 0) +
        (h.defId === "juno" ? 2 : 0) +
        (n.terrain === "tower" ? 1 : 0),
    );
  }
  r.battle = {
    enemies: n.encounter.map((id) =>
      makeEnemy(
        r,
        id,
        n.type === "elite",
        n.type === "boss" && ["doorman", "census", "lattice"].includes(id),
      ),
    ),
    dice: [],
    round: 0,
    rerolls: 2,
    terrain: n.terrain,
    nodeType: n.type,
    taunt: null,
    firstHit: false,
    overdrive: false,
    log: ["The Lattice has your signal."],
  };
  r.screen = "battle";
  startRound(r, true);
}
function roll(r: Run) {
  return r.relics.includes("loaded")
    ? 2 + Math.floor(random(r) * 5)
    : 1 + Math.floor(random(r) * 6);
}
function startRound(r: Run, first = false) {
  const b = r.battle!;
  b.round++;
  r.stats.turns++;
  b.rerolls = r.relics.includes("coffee") ? 3 : 2;
  b.taunt = null;
  for (const h of living(r)) {
    if (!first) h.shield = 0;
    h.used = [];
    if (h.defId === "rook") h.shield += 3;
    if (r.relics.includes("hotfix")) h.hp = Math.min(h.maxHp, h.hp + 2);
  }
  b.dice = Array.from(
    { length: 3 + living(r).length + (r.relics.includes("battery") ? 1 : 0) },
    (_, i) => ({ id: i, value: roll(r), used: false, locked: false }),
  );
  for (const e of foes(r)) e.intent = makeIntent(r, e);
}
function makeIntent(r: Run, e: Enemy): Intent {
  const b = r.battle!,
    round = b.round,
    d = enemyDef(e.defId),
    base =
      Math.round(d.damage * (1 + (r.act - 1) * 0.18)) +
      (r.difficulty === "hard" ? 1 : 0),
    a = living(r);
  const weakest = [...a].sort((x, y) => x.hp - y.hp)[0],
    target = pick(r, a).uid;
  const hit = (
    value = base,
    name = "Attack",
    effect: Intent["effect"] = "hit",
    t = target,
  ): Intent => ({ effect, value, target: t, name });
  switch (e.defId) {
    case "ward":
      return round % 2 === 1
        ? hit(8 + r.act * 2, "Fortify", "shield", e.uid)
        : hit(base + 2, "Baton");
    case "ripper":
      return round % 3 === 0
        ? hit(base * 2, "Sawstorm")
        : hit(base, "Saw strike");
    case "leech":
      return hit(base, "Siphon", "hit", weakest.uid);
    case "volt":
      return hit(base, "Chain arc", "sweep", "all");
    case "scribe": {
      const hurt = [...foes(r)].sort(
        (x, y) => x.hp / x.maxHp - y.hp / y.maxHp,
      )[0];
      return round % 2 === 0
        ? hit(10, "Repair", "heal", hurt.uid)
        : hit(base, "Data spike");
    }
    case "bailiff":
      return round % 2 === 1
        ? hit(0, "Charging", "charge", e.uid)
        : hit(base * 2, "Sentence");
    case "hive":
      return round % 3 === 1 && foes(r).length < 3
        ? hit(0, "Print drone", "summon", e.uid)
        : hit(base, "Pulse");
    case "doorman":
      return round % 3 === 2
        ? hit(18, "Lockdown", "shield", e.uid)
        : hit(
            base + (round % 3 === 0 ? 6 : 0),
            round % 3 === 0 ? "Gatecrash" : "Iron fist",
          );
    case "census":
      return round % 3 === 1
        ? hit(8 + r.act, "Census tax", "sweep", "all")
        : round % 3 === 2
          ? hit(base, "Piercing audit", "pierce", weakest.uid)
          : hit(15, "Firewall", "shield", e.uid);
    case "lattice":
      return e.hp < e.maxHp / 2
        ? round % 2 === 0
          ? hit(base - 3, "Root access", "sweep", "all")
          : hit(base + 3, "Erasure", "pierce", weakest.uid)
        : round % 3 === 0 && foes(r).length < 3
          ? hit(0, "Replication", "summon", e.uid)
          : hit(base, "Mesh pulse");
    default:
      return hit(base, "Laser");
  }
}
export function reroll(r: Run): boolean {
  const b = r.battle;
  if (
    r.screen !== "battle" ||
    !b ||
    b.rerolls < 1 ||
    !b.dice.some((d) => !d.used && !d.locked)
  )
    return false;
  b.rerolls--;
  for (const d of b.dice) if (!d.used && !d.locked) d.value = roll(r);
  return true;
}
export function lockDie(r: Run, id: number) {
  const d = r.battle?.dice.find((d) => d.id === id);
  if (r.screen === "battle" && d && !d.used) d.locked = !d.locked;
}
export function skillValue(r: Run, h: Unit, s: Skill, value: number) {
  const powered = [
    "hit",
    "pierce",
    "sweep",
    "shield",
    "heal",
    "drain",
    "taunt",
  ].includes(s.effect);
  return Math.max(
    0,
    Math.floor(
      s.base +
        s.mult * value +
        (powered ? h.power : 0) +
        (r.relics.includes("oil") &&
        ["hit", "pierce", "sweep", "drain"].includes(s.effect)
          ? 2
          : 0) +
        (s.effect === "shield" || s.effect === "taunt"
          ? (r.relics.includes("capacitor") ? 3 : 0) +
            (r.battle?.terrain === "scrapyard" ? 2 : 0)
          : 0),
    ),
  );
}
export function skillReason(
  r: Run,
  h: Unit,
  s: Skill,
  dieId: number | null,
): string | null {
  if (r.screen !== "battle" || !r.battle || h.hp <= 0) return "Not available.";
  if (s.ultimate) return h.charge >= CHARGE ? null : `Needs ${CHARGE} charge`;
  if (h.used.includes(s.id)) return "Used this turn";
  const d = r.battle.dice.find((d) => d.id === dieId && !d.used);
  if (!d) return "Select a die";
  if (s.min && d.value < s.min) return `Needs ${s.min}+`;
  if (s.parity === "even" && d.value % 2 !== 0) return "Needs an even die";
  if (s.parity === "odd" && d.value % 2 !== 1) return "Needs an odd die";
  return null;
}
export function targets(r: Run, h: Unit, s: Skill): Unit[] {
  if (s.target === "self") return h.hp > 0 ? [h] : [];
  return ["enemy", "enemies"].includes(s.target)
    ? foes(r).filter((e) => s.effect !== "stun" || !e.staggered)
    : living(r);
}
function unitName(r: Run, u: Unit) {
  return u.uid.startsWith("h") ? heroDef(u.defId).name : enemyDef(u.defId).name;
}
function log(r: Run, t: string) {
  r.battle!.log.push(t);
  r.battle!.log = r.battle!.log.slice(-30);
}
function damage(
  r: Run,
  source: Unit,
  target: Unit,
  n: number,
  pierce: boolean,
  fx: FX[],
  enemy = false,
  shock = false,
) {
  if (target.hp <= 0) return 0;
  let amount = n;
  if (!shock) {
    amount += target.mark;
    if (!enemy) {
      if (source.defId === "iri" && target.mark) amount += 3;
      if (source.defId === "pax" && source.hp < source.maxHp / 2) amount += 3;
      if (source.defId === "sable" && target.weak) amount += 3;
      if (r.relics.includes("splinter") && !r.battle!.firstHit) {
        amount += 7;
        r.battle!.firstHit = true;
      }
    }
    amount = Math.max(0, amount - (source.weak ? 2 : 0));
  }
  amount = Math.max(0, amount - target.armor);
  let blocked = 0;
  if (!pierce) {
    blocked = Math.min(target.shield, amount);
    target.shield -= blocked;
    amount -= blocked;
  }
  const actual = Math.min(target.hp, amount);
  target.hp -= actual;
  if (!enemy) r.stats.damage += actual;
  fx.push({
    kind: shock ? "shock" : blocked > 0 && amount === 0 ? "shield" : "hit",
    source: source.uid,
    target: target.uid,
    value: actual,
    label: actual === 0 ? "BLOCK" : undefined,
  });
  if (target.hp === 0) {
    if (enemy && r.relics.includes("core") && !r.battle!.overdrive) {
      r.battle!.overdrive = true;
      target.hp = 1;
      fx.push({
        kind: "heal",
        source: target.uid,
        target: target.uid,
        value: 1,
        label: "REBOOT",
      });
    } else {
      fx.push({
        kind: "death",
        source: source.uid,
        target: target.uid,
        value: 0,
      });
      if (!enemy) r.stats.kills++;
    }
  }
  return actual;
}
export function playSkill(
  r: Run,
  heroUid: string,
  skillId: string,
  dieId: number | null,
  targetUid: string,
): { ok: boolean; reason?: string; fx: FX[] } {
  const h = r.party.find((h) => h.uid === heroUid),
    s = h && heroDef(h.defId).skills.find((s) => s.id === skillId);
  if (!h || !s)
    return { ok: false, reason: "Choose a hero and skill.", fx: [] };
  const reason = skillReason(r, h, s, dieId);
  if (reason) return { ok: false, reason, fx: [] };
  const eligible = targets(r, h, s);
  let victims: Unit[] = ["enemies", "party"].includes(s.target)
    ? eligible
    : s.target === "self"
      ? [h]
      : eligible.filter((v) => v.uid === targetUid);
  if (!victims.length)
    return {
      ok: false,
      reason:
        s.effect === "stun"
          ? "That enemy is recovering from its last jam."
          : "Choose a valid target.",
      fx: [],
    };
  const d = r.battle!.dice.find((d) => d.id === dieId),
    value = s.ultimate ? 0 : d!.value,
    v = skillValue(r, h, s, value),
    fx: FX[] = [];
  if (s.ultimate) h.charge = 0;
  else {
    d!.used = true;
    h.used.push(s.id);
    h.charge = Math.min(
      CHARGE,
      h.charge + 1 + (value === 6 && r.relics.includes("echo") ? 1 : 0),
    );
  }
  const apply = (effect: string, t: Unit, amount: number) => {
    switch (effect) {
      case "hit":
      case "pierce":
      case "sweep":
      case "drain": {
        const a = damage(r, h, t, amount, effect === "pierce", fx);
        if (effect === "drain") {
          const heal = Math.min(h.maxHp - h.hp, Math.ceil(a / 2));
          h.hp += heal;
          fx.push({ kind: "heal", source: h.uid, target: h.uid, value: heal });
        }
        break;
      }
      case "shield":
        t.shield += amount;
        fx.push({
          kind: "shield",
          source: h.uid,
          target: t.uid,
          value: amount,
        });
        break;
      case "taunt":
        t.shield += amount;
        r.battle!.taunt = h.uid;
        fx.push({
          kind: "shield",
          source: h.uid,
          target: t.uid,
          value: amount,
          label: "TAUNT",
        });
        break;
      case "heal": {
        const a = Math.min(t.maxHp - t.hp, amount);
        t.hp += a;
        if (h.defId === "nyx") t.shield += 3;
        fx.push({ kind: "heal", source: h.uid, target: t.uid, value: a });
        break;
      }
      case "mark":
        t.mark += amount;
        if (h.defId === "hexa") t.weak = Math.max(t.weak, 1);
        fx.push({ kind: "mark", source: h.uid, target: t.uid, value: amount });
        break;
      case "shock": {
        const a =
          amount +
          (h.defId === "wren" ? 1 : 0) +
          (r.relics.includes("prism") ? 2 : 0);
        t.shock += a;
        fx.push({
          kind: "shock",
          source: h.uid,
          target: t.uid,
          value: a,
          label: "SHOCK +" + a,
        });
        break;
      }
      case "stun":
        t.stun = true;
        fx.push({
          kind: "stun",
          source: h.uid,
          target: t.uid,
          value: 0,
          label: "JAMMED",
        });
        break;
      case "weaken":
        t.weak = Math.max(t.weak, amount);
        fx.push({
          kind: "mark",
          source: h.uid,
          target: t.uid,
          value: amount,
          label: "WEAK",
        });
        break;
      case "boost":
        t.power += amount;
        fx.push({ kind: "boost", source: h.uid, target: t.uid, value: amount });
        break;
    }
  };
  for (const t of victims) {
    apply(s.effect, t, v);
    if (s.extra && t.hp > 0) {
      if (s.extra === "taunt") r.battle!.taunt = h.uid;
      else apply(s.extra, t, s.extraValue ?? 0);
    }
  }
  log(r, `${heroDef(h.defId).name}: ${s.name}.`);
  checkBattle(r);
  return { ok: true, fx };
}
export function endTurn(r: Run): FX[] {
  if (r.screen !== "battle" || !r.battle) return [];
  const b = r.battle,
    fx: FX[] = [];
  for (const e of foes(r)) {
    if (e.shock) {
      damage(
        r,
        e,
        e,
        e.shock + (b.terrain === "conduit" ? 1 : 0),
        true,
        fx,
        false,
        true,
      );
      e.shock = Math.max(0, e.shock - 1);
    }
  }
  if (checkBattle(r)) return fx;
  // Enemy Block lasts through the player's turn, then expires before fresh defenses.
  for (const e of foes(r)) e.shield = 0;
  for (const e of [...foes(r)]) {
    if (!living(r).length) break;
    if (e.stun) {
      e.stun = false;
      e.staggered = true;
      fx.push({
        kind: "stun",
        source: e.uid,
        target: e.uid,
        value: 0,
        label: "ACTION CANCELLED",
      });
      log(r, `${enemyDef(e.defId).name} is jammed.`);
      if (e.weak) e.weak--;
      continue;
    }
    e.staggered = false;
    const i = e.intent,
      amount = i.value;
    if (i.effect === "shield") {
      e.shield += amount;
      fx.push({ kind: "shield", source: e.uid, target: e.uid, value: amount });
    } else if (i.effect === "heal") {
      const t = foes(r).find((t) => t.uid === i.target) ?? e;
      const a = Math.min(t.maxHp - t.hp, amount);
      t.hp += a;
      fx.push({ kind: "heal", source: e.uid, target: t.uid, value: a });
    } else if (i.effect === "charge")
      fx.push({
        kind: "boost",
        source: e.uid,
        target: e.uid,
        value: 0,
        label: "CHARGING",
      });
    else if (i.effect === "summon") {
      if (foes(r).length < 3) {
        const spawn = makeEnemy(r, "drone");
        spawn.intent = {
          effect: "charge",
          value: 0,
          target: "",
          name: "Booting",
        };
        b.enemies.push(spawn);
        fx.push({
          kind: "boost",
          source: e.uid,
          target: e.uid,
          value: 0,
          label: "DRONE PRINTED",
        });
      }
    } else {
      const taunt = living(r).find((h) => h.uid === b.taunt),
        victims =
          i.effect === "sweep"
            ? living(r)
            : [
                taunt ??
                  living(r).find((h) => h.uid === i.target) ??
                  living(r)[0],
              ];
      for (const t of victims) {
        if (!t) continue;
        const actual = damage(r, e, t, amount, i.effect === "pierce", fx, true);
        if (e.defId === "leech")
          e.hp = Math.min(e.maxHp, e.hp + Math.ceil(actual / 2));
        log(r, `${enemyDef(e.defId).name}: ${i.name} → ${unitName(r, t)}.`);
      }
    }
    if (e.weak) e.weak--;
  }
  for (const h of living(r)) {
    if (h.shock) {
      damage(
        r,
        h,
        h,
        h.shock + (b.terrain === "conduit" ? 1 : 0),
        true,
        fx,
        true,
        true,
      );
      h.shock--;
    }
    if (h.weak) h.weak--;
  }
  if (!checkBattle(r)) startRound(r);
  return fx;
}
function checkBattle(r: Run): boolean {
  if (!living(r).length) {
    r.screen = "lost";
    r.result = "The signal went quiet.";
    for (const h of r.party)
      if (!r.fallen.includes(h.defId)) r.fallen.push(h.defId);
    return true;
  }
  if (foes(r).length) return false;
  const b = r.battle!;
  for (const h of r.party.filter((h) => h.hp === 0)) r.fallen.push(h.defId);
  r.party = living(r);
  r.party.forEach((h) => {
    h.shield = 0;
    h.shock = 0;
  });
  const scrap =
    (b.nodeType === "boss" ? 65 : b.nodeType === "elite" ? 42 : 24) +
    Math.floor(random(r) * 10) +
    (r.relics.includes("magnet") ? 15 : 0);
  r.gold += scrap;
  r.bonus = scrap;
  if (b.nodeType === "boss" && r.act === 3) {
    r.screen = "won";
    r.result =
      "For the first time, the network is quiet enough to hear the rain.";
    return true;
  }
  r.rewards = makeRewards(r);
  r.screen = "reward";
  return true;
}
function makeRewards(r: Run): Reward[] {
  const rs = sample(
    r,
    RELICS.filter((a) => !r.relics.includes(a.id)),
    r.battle!.nodeType === "elite" ? 2 : 1,
  ).map((a) => ({
    kind: "relic" as const,
    id: a.id,
    title: a.name,
    desc: a.desc,
  }));
  const rewards: Reward[] = [
    ...rs,
    {
      kind: "upgrade",
      title: "Rewrite your limits",
      desc: "Choose a permanent upgrade for one hero.",
    },
    {
      kind: "heal",
      title: "Field supplies",
      desc: "Restore 10 HP to every surviving hero.",
      value: 10,
    },
  ];
  if (
    r.party.length < 3 &&
    r.visited.filter((id) => r.maps.find((n) => n.id === id)?.type === "fight")
      .length === 1
  )
    rewards.unshift({
      kind: "recruit",
      title: "A signal answers",
      desc: "Choose a companion to join your squad.",
    });
  return rewards;
}
export function continueToMap(r: Run) {
  const n = currentNode(r);
  if (n?.type === "boss" && r.act === n.act && r.act < 3) r.act++;
  r.screen = "map";
  r.rewards = [];
  r.battle = null;
}
export function chooseReward(r: Run, index: number): boolean {
  if (r.screen !== "reward") return false;
  const a = r.rewards[index];
  if (!a) return false;
  r.rewards = [];
  if (a.kind === "relic" && a.id && !r.relics.includes(a.id))
    r.relics.push(a.id);
  if (a.kind === "gold") r.gold += a.value ?? 20;
  if (a.kind === "heal") healParty(r, a.value ?? 10);
  if (a.kind === "recruit") {
    offerRecruits(r);
    return true;
  }
  if (a.kind === "upgrade") {
    r.screen = "upgrade";
    r.upgradeReturn = "map";
    return true;
  }
  continueToMap(r);
  return true;
}
export function skipReward(r: Run) {
  if (r.screen === "reward") {
    r.gold += 15;
    continueToMap(r);
  }
}
export function offerRecruits(r: Run) {
  r.recruits = sample(
    r,
    HEROES.filter((h) => !r.party.some((p) => p.defId === h.id)),
    3,
  ).map((h) => h.id);
  r.screen = "recruit";
}
export function recruit(r: Run, id: string, replaceUid?: string): boolean {
  if (r.screen !== "recruit" || !r.recruits.includes(id)) return false;
  if (r.party.length >= 3) {
    const i = r.party.findIndex((h) => h.uid === replaceUid);
    if (i < 0) return false;
    r.party.splice(i, 1);
  }
  r.party.push(makeHero(r, id));
  r.stats.recruits++;
  r.recruits = [];
  continueToMap(r);
  return true;
}
export function upgrade(r: Run, uid: string, mod: string): boolean {
  if (r.screen !== "upgrade" || !MODS.some((m) => m.id === mod)) return false;
  const h = r.party.find((h) => h.uid === uid);
  if (!h || h.mods.filter((m) => m === mod).length >= 3) return false;
  h.mods.push(mod);
  h.level++;
  if (mod === "vitality") {
    h.maxHp += 10;
    h.hp = Math.min(h.maxHp, h.hp + 15);
  }
  if (r.upgradeReturn === "shop") r.screen = "shop";
  else continueToMap(r);
  return true;
}
export function price(r: Run, value: number) {
  return r.relics.includes("badge") ? Math.floor(value * 0.75) : value;
}
export function buy(r: Run, id: string) {
  if (r.screen !== "shop") return false;
  const raw =
    id === "heal"
      ? 30
      : id === "upgrade"
        ? 50
        : r.shop.includes(id)
          ? relicDef(id)?.price
          : undefined;
  if (raw === undefined) return false;
  const cost = price(r, raw);
  if (r.gold < cost || r.relics.includes(id)) return false;
  r.gold -= cost;
  if (id === "heal") healParty(r, 13);
  else if (id === "upgrade") {
    r.screen = "upgrade";
    r.upgradeReturn = "shop";
  } else {
    r.relics.push(id);
    r.shop = r.shop.filter((s) => s !== id);
  }
  return true;
}
export function rest(r: Run, choice: "heal" | "upgrade") {
  if (r.screen !== "rest") return false;
  if (choice === "heal") {
    for (const h of r.party)
      h.hp = Math.min(
        h.maxHp,
        h.hp + Math.ceil(h.maxHp * (r.relics.includes("thermos") ? 0.6 : 0.35)),
      );
    continueToMap(r);
  } else {
    r.screen = "upgrade";
    r.upgradeReturn = "map";
  }
  return true;
}
function healParty(r: Run, v: number) {
  for (const h of living(r)) h.hp = Math.min(h.maxHp, h.hp + v);
}
function eventDamage(r: Run, v: number) {
  for (const h of r.party) h.hp = Math.max(1, h.hp - v);
}
export function eventChoice(r: Run, index: number) {
  if (r.screen !== "event") return false;
  const c = EVENTS.find((e) => e.id === r.eventId)?.choices[index];
  if (!c) return false;
  if (c.effect === "relic" && r.gold < c.value) return false;
  let next = "map";
  const gainRelic = () => {
    const a = sample(
      r,
      RELICS.filter((a) => !r.relics.includes(a.id)),
      1,
    )[0];
    if (a) {
      r.relics.push(a.id);
      r.result = `Found ${a.name}.`;
    } else {
      r.gold += 25;
      r.result = "The empty cache holds 25 scrap.";
    }
  };
  switch (c.effect) {
    case "heal":
      healParty(r, c.value);
      r.result = `Everyone restored ${c.value} HP.`;
      break;
    case "gold":
      r.gold += c.value;
      r.result = `Gained ${c.value} scrap.`;
      break;
    case "recruit":
      next = "recruit";
      break;
    case "upgrade":
      next = "upgrade";
      break;
    case "relic":
      r.gold -= c.value;
      gainRelic();
      break;
    case "trade":
      eventDamage(r, c.value);
      gainRelic();
      break;
    case "gift":
      gainRelic();
      break;
    case "risk":
      r.gold += c.value;
      eventDamage(r, 4);
      r.result = `Gained ${c.value} scrap. Everyone took 4 damage.`;
      break;
    case "both":
      healParty(r, c.value);
      r.gold += 15;
      r.result = "Restored 7 HP. Gained 15 scrap.";
      break;
    case "overclock":
      eventDamage(r, c.value);
      next = "upgrade";
      break;
  }
  if (next === "recruit") offerRecruits(r);
  else if (next === "upgrade") {
    r.screen = "upgrade";
    r.upgradeReturn = "map";
  } else continueToMap(r);
  return true;
}
export function loadRun(raw: string | null): Run | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Run;
    const screens = [
      "battle",
      "map",
      "reward",
      "recruit",
      "shop",
      "rest",
      "event",
      "upgrade",
      "won",
      "lost",
    ];
    if (
      r.version !== 2 ||
      typeof r.seed !== "string" ||
      !Number.isFinite(r.rng) ||
      !screens.includes(r.screen) ||
      !Array.isArray(r.party) ||
      r.party.length > 3 ||
      !Array.isArray(r.maps) ||
      r.maps.length !== 60 ||
      !Array.isArray(r.relics) ||
      r.relics.some((id) => !RELICS.some((x) => x.id === id))
    )
      return null;
    if (
      !r.party.every(
        (h) =>
          HEROES.some((d) => d.id === h.defId) &&
          Number.isFinite(h.hp) &&
          Number.isFinite(h.maxHp) &&
          h.hp >= 0 &&
          h.hp <= h.maxHp &&
          Array.isArray(h.mods) &&
          h.mods.every((m) => MODS.some((d) => d.id === m)),
      )
    )
      return null;
    if (
      r.screen === "battle" &&
      (!r.battle ||
        !Array.isArray(r.battle.dice) ||
        !r.battle.enemies.every((e) => ENEMIES.some((d) => d.id === e.defId)))
    )
      return null;
    return r;
  } catch {
    return null;
  }
}
