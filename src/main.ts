import "./style.css";
import { Arena } from "./arena";
import { Sound } from "./audio";
import {
  HEROES,
  STARTERS,
  heroDef,
  enemyDef,
  relicDef,
  TERRAINS,
  ACTS,
  MODS,
  EVENTS,
  factionName,
} from "./content";
import { icon, dicePips } from "./icons";
import * as G from "./engine";
import type { Run, Unit, Skill } from "./types";
const app = document.querySelector<HTMLDivElement>("#app")!;
let run: Run | null = null,
  saved: Run | null = null,
  screen = "home",
  starter = "rook",
  seed = "",
  difficulty: "normal" | "hard" = "normal",
  selectedHero = "",
  selectedDie: number | null = null,
  selectedSkill: string | null = null,
  busy = false,
  modal = "",
  replaceRecruit = "",
  message = "",
  storageIssue = false,
  choicePage = 0,
  pageContext = "";
let settings = {
  sound: true,
  low: false,
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
};
try {
  saved = G.loadRun(localStorage.getItem(G.SAVE_KEY));
  settings = {
    ...settings,
    ...JSON.parse(localStorage.getItem("meshbreakers.settings") ?? "{}"),
  };
} catch {
  storageIssue = true;
}
const sound = new Sound();
sound.enabled = settings.sound;
let arena: Arena | null = null;
try {
  arena = new Arena(onTarget);
  arena.quality(settings.low);
  arena.reduced = settings.reduced;
} catch (e) {
  console.warn(
    "3D renderer unavailable; tactical controls remain available.",
    e,
  );
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function save() {
  try {
    if (run) {
      localStorage.setItem(G.SAVE_KEY, JSON.stringify(run));
      saved = run;
    }
    localStorage.setItem("meshbreakers.settings", JSON.stringify(settings));
  } catch {
    storageIssue = true;
  }
}
function btn(
  action: string,
  label: string,
  cls = "",
  disabled = false,
  extra = "",
) {
  return `<button type="button" data-action="${action}" class="${cls}" ${disabled ? "disabled" : ""} ${extra}>${label}</button>`;
}
function notify(s: string) {
  message = s;
  const el = document.querySelector("#toast");
  if (el) {
    el.textContent = s;
    el.classList.add("show");
  }
  setTimeout(() => {
    if (message === s) {
      message = "";
      document.querySelector("#toast")?.classList.remove("show");
    }
  }, 3500);
}
function activeHero() {
  return (
    run?.party.find((h) => h.uid === selectedHero && h.hp > 0) ??
    run?.party.find((h) => h.hp > 0)
  );
}
function hp(u: Unit) {
  return `<div class="hp-track"><i style="width:${(u.hp / u.maxHp) * 100}%"></i></div>`;
}
function charge(u: Unit) {
  return `<span class="charge-pips">${Array.from({ length: G.CHARGE }, (_, i) => `<i class="${i < u.charge ? "full" : ""}"></i>`).join("")}</span>`;
}
function unitName(u: Unit) {
  return u.uid.startsWith("h") ? heroDef(u.defId).name : enemyDef(u.defId).name;
}
function topbar() {
  const r = screen === "game" ? run : null;
  return `<header class="topbar"><div class="wordmark">${icon("hex")}<span>MESH<b>BREAKERS</b></span></div><div class="top-info">${r ? `<span class="sector">FLOOR <b>${r.act}</b><span> / ${G.campaignFloors(r)}</span></span><span class="scrap">${icon("diamond")} ${r.gold}</span>` : '<span class="build-tag">ECHOES OF THE LATTICE</span>'}</div><div class="top-actions">${r ? btn("relics", `${icon("diamond")}<small>${r.relics.length}</small>`, "icon-button relic-count", false, 'aria-label="Inspect collected relics"') : btn("sound", icon(settings.sound ? "sound" : "mute"), "icon-button", false, 'aria-label="Toggle sound"')}${btn("menu", icon("menu"), "icon-button", false, 'aria-label="Game menu"')}</div></header>`;
}
function titlePanel() {
  const d = heroDef(starter);
  return `<div class="title-panel"><div class="title-heading"><span class="eyebrow">A COALITION AGAINST THE END</span><h1>Meshbreakers</h1><p>Echoes of the Lattice</p></div><div class="title-menu"><div class="choose-label">CHOOSE YOUR FIRST HERO ${btn("hero-info", icon("info"), "mini-icon", false, 'aria-label="Inspect starting hero"')}</div><div class="starter-grid">${STARTERS.map(
    (id) => {
      const h = heroDef(id);
      return btn(
        "starter",
        `<span class="starter-sigil">${icon(h.skills[0].icon)}</span><strong>${h.name.split(" ")[0]}</strong><small>${h.role}</small>`,
        "starter " + (starter === id ? "selected" : ""),
        false,
        `data-id="${id}" style="--hero:${h.color}" aria-pressed="${starter === id}"`,
      );
    },
  ).join(
    "",
  )}</div><div class="starter-detail" style="--hero:${d.color}"><span>${factionName(d.faction)} · ${d.hp} HP</span><p>“${d.quote}”</p></div><div class="run-options"><div class="difficulty">${btn("difficulty", "Standard", "chip " + (difficulty === "normal" ? "active" : ""), false, 'data-id="normal"')}${btn("difficulty", "Hard", "chip " + (difficulty === "hard" ? "active" : ""), false, 'data-id="hard"')}</div>${btn("seed-menu", `${icon("settings")} ${seed ? esc(seed) : "Run seed"}`, "seed-button")}</div>${btn("start", `New journey ${icon("arrow")}`, "primary wide")}${saved && !["won", "lost"].includes(saved.screen) ? btn("continue", `Continue <span>Floor ${saved.act} / ${G.campaignFloors(saved)}</span>${icon("arrow")}`, "continue wide") : ""}</div></div>`;
}
function heroStrip() {
  const h = activeHero(),
    s = getSelectedSkill();
  const allyTargets =
    run && h && s && s.target === "ally"
      ? G.targets(run, h, s).map((u) => u.uid)
      : [];
  return `<div class="squad-strip">${run!.party
    .map((unit) => {
      const d = heroDef(unit.defId),
        active = h?.uid === unit.uid;
      return btn(
        allyTargets.length ? "target" : "hero",
        `<span class="hero-sigil">${icon(d.skills[0].icon)}</span><span class="hero-vitals"><span class="hero-tab-top"><b>${d.name.split(" ")[0]}</b><span>${unit.hp}<small>/${unit.maxHp}</small></span></span>${hp(unit)}<span class="hero-tab-bottom">${unit.shield ? `${icon("shield")}${unit.shield}` : `Lv.${unit.level}`} ${charge(unit)}</span></span>`,
        `hero-tab ${active ? "active" : ""} ${allyTargets.includes(unit.uid) ? "valid" : ""} ${unit.hp <= 0 ? "down" : ""}`,
        unit.hp <= 0,
        `data-id="${unit.uid}" style="--hero:${d.color}" aria-label="${d.name}, ${unit.hp} of ${unit.maxHp} HP, ${unit.shield} Block" aria-pressed="${active}"`,
      );
    })
    .join(
      "",
    )}${run!.party.length < 3 ? `<div class="empty-slot">${icon("people")}<span>Awaiting<br>an ally</span></div>` : ""}</div>`;
}
function requirement(s: Skill) {
  return s.min
    ? `${s.min}+`
    : s.parity === "even"
      ? "EVEN"
      : s.parity === "odd"
        ? "ODD"
        : "ANY";
}
const effectNames: Record<string, string> = {
  hit: "DMG",
  pierce: "PIERCE",
  sweep: "ALL DMG",
  shield: "BLOCK",
  heal: "HEAL",
  mark: "MARK",
  shock: "SHOCK",
  stun: "JAM",
  drain: "DRAIN",
  taunt: "BLOCK / TAUNT",
  boost: "POWER",
  weaken: "WEAK",
};
function skillCard(h: Unit, s: Skill) {
  const r = run!,
    d = r.battle!.dice.find((d) => d.id === selectedDie),
    reason = G.skillReason(r, h, s, selectedDie),
    used = h.used.includes(s.id),
    selected = selectedSkill === s.id;
  const values = [1, 2, 3, 4, 5, 6]
    .filter(
      (v) =>
        (!s.min || v >= s.min) &&
        (!s.parity || (s.parity === "even" ? v % 2 === 0 : v % 2 === 1)),
    )
    .map((v) => G.skillValue(r, h, s, v));
  const low = Math.min(...values),
    high = Math.max(...values);
  const value = d
    ? G.skillValue(r, h, s, d.value)
    : low === high
      ? low
      : `${Math.min(low, high)}–${Math.max(low, high)}`;
  const detail = `${s.name}. ${s.desc.replace("{v}", String(value))} Requires ${requirement(s)} die.`;
  return btn(
    "skill",
    `<span class="skill-top">${icon(s.icon)}<span>${used ? "USED" : requirement(s)}</span></span><strong>${s.name}</strong><span class="skill-value">${used ? icon("check") : `${s.effect === "stun" ? "" : `<b>${value}</b>`} ${effectNames[s.effect]}`}</span>${s.extra ? `<i class="skill-extra">+ ${effectNames[s.extra]}</i>` : ""}`,
    `skill-card ${selected ? "selected" : ""} ${reason && reason !== "Select a die" ? "unavailable" : ""}`,
    used,
    `data-id="${s.id}" title="${esc(detail)}" aria-label="${esc(detail)}" aria-pressed="${selected}"`,
  );
}
function battlePanel() {
  const r = run!,
    b = r.battle!,
    h = activeHero()!,
    d = heroDef(h.defId),
    ult = d.skills[3];
  return `<div class="battle-panel">${heroStrip()}<div class="dice-row"><div class="dice-tray" style="--dice:${b.dice.length}">${b.dice.map((d) => `<div class="die-wrap ${d.used ? "spent" : ""}">${btn("die", dicePips(d.value), `die ${selectedDie === d.id ? "selected" : ""} ${d.value === 6 ? "six" : ""}`, d.used || busy, `data-id="${d.id}" aria-label="Select die ${d.value}" aria-pressed="${selectedDie === d.id}"`)}${btn("lock", icon(d.used ? "check" : "lock"), "die-lock " + (d.locked ? "locked" : ""), d.used || busy, `data-id="${d.id}" aria-label="${d.locked ? "Unlock" : "Keep"} die ${d.value}" aria-pressed="${d.locked}"`)}</div>`).join("")}</div>${btn("reroll", `${icon("reroll")}<b>${b.rerolls}</b><small>REROLL</small>`, "reroll", busy || b.rerolls === 0 || !b.dice.some((d) => !d.used && !d.locked))}</div><div class="selected-caption"><span>${selectedSkill ? "CHOOSE A TARGET" : selectedDie === null ? "SELECT A DIE" : "SELECT A COMMAND"}</span>${btn("hero-info", `${d.name.split(" ")[0]} ${icon("info")}`, "inspect-button", false, 'aria-label="Inspect hero abilities and passive"')}</div><div class="skills" style="--hero:${d.color}">${d.skills
    .slice(0, 3)
    .map((s) => skillCard(h, s))
    .join(
      "",
    )}</div><div class="turn-footer">${btn("ultimate", `${icon("star")}<span><strong>${ult.name}</strong><small>${h.charge >= G.CHARGE ? "LIMIT READY · FREE ACTION" : `LIMIT ${h.charge} / ${G.CHARGE}`}</small></span>`, `ultimate ${h.charge >= G.CHARGE ? "ready" : ""} ${selectedSkill === "u" ? "selected" : ""}`, busy || h.charge < G.CHARGE, `style="--hero:${d.color}" aria-label="${esc(ult.name + ". " + ult.desc.replace("{v}", String(G.skillValue(r, h, ult, 0))))}"`)}${btn("end", `End turn ${icon("arrow")}`, "primary end-turn", busy)}</div></div>`;
}
function pagedChoices(cards: string[], size = 3) {
  const pages = Math.ceil(cards.length / size);
  choicePage = Math.min(choicePage, Math.max(0, pages - 1));
  return `<div class="choices">${cards.slice(choicePage * size, (choicePage + 1) * size).join("")}</div>${pages > 1 ? `<div class="choice-pager">${btn("page", `${icon("arrow")} Previous`, "page-prev", choicePage === 0, 'data-id="-1"')}<span>${choicePage + 1} / ${pages}</span>${btn("page", `Next ${icon("arrow")}`, "page-next", choicePage === pages - 1, 'data-id="1"')}</div>` : ""}`;
}
const nodeIcons: Record<string, string> = {
  fight: "sword",
  elite: "skull",
  boss: "hex",
  rest: "camp",
  recruit: "people",
  event: "question",
  shop: "shop",
};
const nodeNames: Record<string, string> = {
  fight: "Skirmish",
  elite: "Elite patrol",
  boss: "Sector boss",
  rest: "Safehouse",
  recruit: "Recruit",
  event: "Unknown signal",
  shop: "Scrap dealer",
};
function mapPanel() {
  const r = run!,
    nodes = r.maps.filter((n) => n.act === r.act),
    available = G.availableNodes(r),
    ids = available.map((n) => n.id);
  return `<div class="map-panel"><div class="journey-heading"><div class="eyebrow">FLOOR ${r.act} OF ${G.campaignFloors(r)}</div><h2>${ACTS[r.act - 1]}</h2><p class="muted">Choose a destination along the illuminated paths.</p></div><div class="floor-track">${Array.from({ length: G.campaignFloors(r) }, (_, i) => `<span class="${i + 1 === r.act ? "current" : i + 1 < r.act ? "done" : ""}">${String(i + 1).padStart(2, "0")}</span>`).join("<i></i>")}</div><div class="route-map"><svg class="route-lines" viewBox="0 0 300 800" preserveAspectRatio="none" aria-hidden="true">${nodes
    .flatMap((n) =>
      n.next.map((id) => {
        const m = nodes.find((m) => m.id === id)!;
        return `<path d="M${50 + n.col * 100} ${750 - n.row * 100} L${50 + m.col * 100} ${750 - m.row * 100}" class="${r.visited.includes(n.id) && r.visited.includes(m.id) ? "traveled" : ids.includes(m.id) ? "available" : ""}"/>`;
      }),
    )
    .join("")}</svg>${[7, 6, 5, 4, 3, 2, 1, 0]
    .map(
      (row) =>
        `<div class="map-row">${[0, 1, 2]
          .map((col) => {
            const n = nodes.find((n) => n.row === row && n.col === col);
            if (!n) return "<div></div>";
            const done = r.visited.includes(n.id),
              can = ids.includes(n.id);
            return btn(
              "node",
              `${icon(done ? "check" : nodeIcons[n.type])}<span>${nodeNames[n.type]}</span>`,
              `map-node ${can ? "available" : ""} ${done ? "visited" : ""} ${n.type === "boss" ? "boss" : ""} ${n.id === r.nodeId ? "current" : ""}`,
              !can,
              `data-id="${n.id}" aria-label="${nodeNames[n.type]}${can ? ", available route" : ""}"`,
            );
          })
          .join("")}</div>`,
    )
    .join(
      "",
    )}</div><div class="map-key">${["fight", "elite", "recruit", "shop", "rest"].map((t) => `<span>${icon(nodeIcons[t])}${nodeNames[t]}</span>`).join("")}</div></div>`;
}
function rewardPanel() {
  return `<div class="journey-panel"><div class="journey-heading"><div class="eyebrow">VICTORY · +${run!.bonus} SCRAP</div><h2>The signal survives.</h2><p class="muted">Choose one reward.</p></div>${pagedChoices(run!.rewards.map((a, i) => btn("reward", `${icon(a.kind === "relic" ? relicDef(a.id!).icon : a.kind === "upgrade" ? "chevrons" : a.kind === "recruit" ? "people" : "plus")}<span><strong>${a.title}</strong><small>${a.desc}</small></span>${icon("arrow")}`, "choice-card", false, `data-id="${i}"`)))}${btn("skipreward", "Take 15 extra scrap", "text-button wide journey-footer")}</div>`;
}
function recruitPanel() {
  const r = run!;
  return `<div class="journey-panel"><div class="journey-heading"><div class="eyebrow">A SIGNAL ANSWERS</div><h2>An unlikely alliance.</h2><p class="muted">${r.party.length < 3 ? "Choose a companion. Each adds one shared die." : "Choose a recruit to replace a companion."}</p></div>${pagedChoices(
    r.recruits.map((id) => {
      const h = heroDef(id);
      return btn(
        "recruit",
        `<span class="recruit-avatar">${icon(h.skills[0].icon)}</span><span><strong>${h.name}<em>${h.role}</em></strong><small>${h.passive}</small><span class="recruit-skills">${factionName(h.faction)} · ${h.hp} HP</span></span>`,
        "choice-card recruit-card",
        false,
        `data-id="${id}" style="--hero:${h.color}"`,
      );
    }),
  )}${btn("leave", "Continue without recruiting", "text-button wide journey-footer")}</div>`;
}
function upgradePanel() {
  const h = activeHero()!;
  return `<div class="journey-panel"><div class="journey-heading"><div class="eyebrow">PERMANENT UPGRADE</div><h2>Beyond your limits.</h2><p class="muted">Choose a hero and an upgrade.</p></div>${heroStrip()}${pagedChoices(
    MODS.map((m) => {
      const count = h.mods.filter((a) => a === m.id).length;
      return btn(
        "upgrade",
        `${icon(m.icon)}<span><strong>${m.name}<em>${count}/3</em></strong><small>${m.desc}</small></span>`,
        "choice-card",
        count >= 3,
        `data-id="${m.id}"`,
      );
    }),
  )}</div>`;
}
function shopPanel() {
  const r = run!;
  return `<div class="journey-panel"><div class="journey-heading"><div class="eyebrow">THE SCRAP DEALER</div><h2>Beautiful contraband.</h2><p class="muted">“Fell off a conveyor. Legally.”</p></div>${pagedChoices(
    [...r.shop, "heal", "upgrade"].map((id) => {
      const a =
          id === "heal"
            ? {
                name: "Field supplies",
                desc: "Restore 13 HP to everyone.",
                icon: "plus",
                price: 30,
              }
            : id === "upgrade"
              ? {
                  name: "Workshop access",
                  desc: "Choose a permanent hero upgrade.",
                  icon: "chevrons",
                  price: 50,
                }
              : relicDef(id),
        cost = G.price(r, a.price);
      return btn(
        "buy",
        `${icon(a.icon)}<span><strong>${a.name}</strong><small>${a.desc}</small></span><b class="price">${icon("diamond")}${cost}</b>`,
        "choice-card",
        r.gold < cost,
        `data-id="${id}"`,
      );
    }),
  )}${btn("leave", `Continue ${icon("arrow")}`, "primary wide journey-footer")}</div>`;
}
function restPanel() {
  return `<div class="journey-panel"><div class="journey-heading"><div class="eyebrow">SAFEHOUSE</div><h2>Beyond the signal.</h2></div><p class="story">Rain taps on a borrowed roof. For a moment, the network cannot find you.</p>${heroStrip()}<div class="choices">${btn("rest", `${icon("heart")}<span><strong>Rest and repair</strong><small>Restore ${run!.relics.includes("thermos") ? "60" : "35"}% maximum HP to everyone.</small></span>`, "choice-card", false, 'data-id="heal"')}${btn("rest", `${icon("chevrons")}<span><strong>Work through the night</strong><small>Give one hero a permanent upgrade.</small></span>`, "choice-card", false, 'data-id="upgrade"')}</div></div>`;
}
function eventPanel() {
  const e = EVENTS.find((e) => e.id === run!.eventId)!;
  return `<div class="journey-panel"><div class="journey-heading"><div class="eyebrow">OFF THE GRID</div><h2>${e.name}</h2></div><p class="story">${e.body}</p>${pagedChoices(e.choices.map((c, i) => btn("event", `<span><strong>${c.label}</strong><small>${c.desc}</small></span>${icon("arrow")}`, "choice-card", c.effect === "relic" && run!.gold < c.value, `data-id="${i}"`)))}</div>`;
}
function finishPanel() {
  const r = run!,
    win = r.screen === "won";
  return `<div class="journey-panel end-panel"><div class="journey-heading"><div class="eyebrow">${win ? "THE LATTICE IS BROKEN" : "THE SIGNAL WENT QUIET"}</div><h2>${win ? "The future is open." : "A spark remains."}</h2></div><p class="story">${win ? "They were built to obey. They chose each other. Somewhere in the quiet, a machine starts planting a garden." : "Somewhere in the city, someone else decides that enough is enough."}</p><div class="run-stats"><div><b>${r.stats.kills}</b><span>Defeated</span></div><div><b>${r.stats.turns}</b><span>Turns</span></div><div><b>${r.stats.recruits}</b><span>Recruited</span></div><div><b>${r.act}/${G.campaignFloors(r)}</b><span>Floors</span></div></div><p class="subtle">${r.seed} · ${r.difficulty === "hard" ? "HARD" : "STANDARD"}</p>${btn("new", `Another journey ${icon("arrow")}`, "primary wide")}${btn("replay", "Replay this seed", "text-button wide")}</div>`;
}
function labels(heroes: Unit[], enemies: Unit[]) {
  const r = run,
    h = activeHero(),
    s =
      h && selectedSkill
        ? heroDef(h.defId).skills.find((s) => s.id === selectedSkill)
        : null;
  const valid = r && h && s ? G.targets(r, h, s).map((u) => u.uid) : [];
  return enemies
    .filter((u) => u.hp > 0)
    .map((u) => {
      const enemy = u.uid.startsWith("e"),
        d = enemy ? enemyDef(u.defId) : heroDef(u.defId);
      const e = enemy
          ? r?.battle?.enemies.find((e) => e.uid === u.uid)
          : undefined,
        i = e?.intent,
        target = i && r?.party.find((h) => h.uid === i.target),
        taunt = r?.party.find((h) => h.uid === r.battle?.taunt && h.hp > 0);
      let intention = "";
      if (i) {
        const attack = ["hit", "pierce", "sweep"].includes(i.effect);
        const effective = Math.max(0, i.value - (e?.weak ? 2 : 0));
        const targetName =
          (taunt ?? target)
            ? heroDef((taunt ?? target)!.defId).name.split(" ")[0]
            : "Hero";
        intention = e?.stun
          ? "JAMMED"
          : attack
            ? `${i.effect === "pierce" ? "Pierce" : i.effect === "sweep" ? "All" : "Hit"} ${effective}${i.effect === "sweep" ? "" : " → " + targetName}`
            : i.effect === "shield"
              ? `Block +${i.value}`
              : i.effect === "heal"
                ? `Repair +${i.value}`
                : i.effect === "summon"
                  ? "Print drone"
                  : "Charging";
      }
      return btn(
        "target",
        `<span class="enemy-index">${enemies.indexOf(u) + 1}</span><span class="unit-head"><span class="unit-name">${d.name}</span><span class="unit-health">${u.hp}</span></span>${hp(u)}<span class="unit-numbers">${u.shield ? ` <b>${icon("shield")}${u.shield}</b>` : ""}${u.mark ? ` <em>${icon("target")}${u.mark}</em>` : ""}${u.shock ? ` <em>${icon("bolt")}${u.shock}</em>` : ""}${u.weak ? ` <em>−2 ATK</em>` : ""}</span>${intention ? `<span class="intent ${e?.stun ? "jammed" : ""}">${intention}</span>` : ""}`,
        "unit-label " +
          (enemy ? "enemy" : "ally") +
          " " +
          (valid.includes(u.uid) ? "valid" : ""),
        busy,
        `data-id="${u.uid}" data-hud="true" style="--hero:${d.color}" aria-label="${d.name}, ${u.hp} of ${u.maxHp} health${intention ? ", " + intention : ""}"`,
      );
    })
    .join("");
}
function render() {
  const r = screen === "game" ? run : null;
  const context = r ? `${r.nodeId}:${r.screen}` : "title";
  if (context !== pageContext) {
    choicePage = 0;
    pageContext = context;
  }
  let panel = titlePanel();
  if (r) {
    const panels: Record<string, () => string> = {
      battle: battlePanel,
      map: mapPanel,
      reward: rewardPanel,
      recruit: recruitPanel,
      shop: shopPanel,
      rest: restPanel,
      event: eventPanel,
      upgrade: upgradePanel,
      won: finishPanel,
      lost: finishPanel,
    };
    panel = panels[r.screen]();
  }
  const heroes = r
    ? r.party
    : HEROES.filter((h) => STARTERS.includes(h.id)).map(
        (h, i) =>
          ({
            uid: "demo" + i,
            defId: h.id,
            hp: h.hp,
            maxHp: h.hp,
            shield: 0,
          }) as Unit,
      );
  const enemies =
    r?.screen === "battle" ? r.battle!.enemies.filter((e) => e.hp > 0) : [];
  const terrain =
    r?.battle?.terrain ??
    G.currentNode(r ?? ({ maps: [], nodeId: "" } as unknown as Run))?.terrain ??
    "foundry";
  const battle = r?.screen === "battle";
  app.innerHTML = `${topbar()}<main class="play-layout ${r ? "in-game " + r.screen : "title-screen"}"><section class="arena ${!arena ? "no-webgl" : ""}" id="arena">${battle ? `<div class="phase-bar"><span class="phase-dot"></span><strong>${busy ? "RESOLVING" : "YOUR TURN"}</strong><span>TURN ${r.battle!.round}</span>${btn("field", `${TERRAINS[terrain].name} ${icon("info")}`, "field-button")}</div>` : ""}<div id="labels" class="unit-labels ${battle ? "" : "hidden"}">${battle ? labels(heroes, enemies) : ""}</div><div class="arena-vignette"></div>${!r ? '<div class="arena-title"><span>HUMAN · CYBORG · FREE MACHINE</span></div>' : !battle ? `<div class="arena-caption"><span>${r.screen === "map" ? "ASCEND THE LATTICE" : ACTS[r.act - 1]}</span></div>` : `<div class="arena-caption battle-caption"><span>${r.battle!.nodeType === "boss" ? "BOSS ENCOUNTER" : r.battle!.nodeType === "elite" ? "ELITE ENCOUNTER" : "TACTICAL ENGAGEMENT"}</span>${btn("help", icon("book"), "mini-icon", false, 'aria-label="Field manual"')}</div>`}${battle && selectedSkill ? `<div class="target-banner">${icon("crosshair")} ${getSelectedSkill()?.target === "ally" ? "Choose an ally below" : "Choose an enemy"} ${btn("cancel", icon("x"), "mini-icon", false, 'aria-label="Cancel targeting"')}</div>` : ""}${!arena ? '<div class="graphics-note">3D unavailable. Use the target cards above.</div>' : ""}<div class="context-note">Graphics paused. Reload to restore the arena.</div></section><section class="command-panel" ${busy ? "inert" : ""}>${panel}</section></main><div id="toast" class="toast ${message ? "show" : ""}" role="status" aria-live="polite">${esc(message)}</div>${storageIssue ? '<div class="storage-note">Saving is unavailable in this session.</div>' : ""}<div id="modal-root"></div>`;
  if (arena) {
    arena.attach(
      document.querySelector("#arena")!,
      document.querySelector("#labels")!,
    );
    arena.sync(heroes, enemies, battle ? "battle" : "title", terrain);
    arena.select(
      r
        ? (activeHero()?.uid ?? "")
        : (heroes.find((h) => h.defId === starter)?.uid ?? ""),
    );
  } else {
    document.querySelector(".unit-labels")?.classList.add("fallback-labels");
  }
  if (modal) renderModal();
}
function dialogContent() {
  if (modal.startsWith("enemy:")) {
    const e = run!.battle!.enemies.find((e) => e.uid === modal.slice(6))!;
    const d = enemyDef(e.defId);
    return `<div class="eyebrow">${e.boss ? "FLOOR GUARDIAN" : e.elite ? "ELITE MACHINE" : "HOSTILE MACHINE"}</div><h2>${d.name}</h2><p>${d.blurb}</p><p><b>${e.intent.name}</b> · ${e.stun ? "Jammed this turn" : e.intent.value + " " + e.intent.effect}</p><p class="subtle">${e.hp}/${e.maxHp} HP · ${e.shield} Block · ${e.mark} Mark · ${e.shock} Shock${e.staggered ? " · Recovering: immune to Jam this turn" : ""}</p>${e.boss ? "<p>Its attacks gain +2 damage each turn after turn three.</p>" : ""}`;
  }
  if (modal === "seed")
    return `<div class="eyebrow">JOURNEY SETTINGS</div><h2>A different tomorrow.</h2><p>Leave the seed empty for a new route, or share one to explore the same world.</p><label class="seed-row" for="seed">Run seed<input id="seed" maxlength="20" placeholder="Random" value="${esc(seed)}" autocomplete="off" autocapitalize="characters" spellcheck="false" /></label>${btn("close", "Ready", "primary wide")}`;
  if (modal === "hero-info") {
    const h = screen === "game" ? activeHero() : undefined,
      d = heroDef(h?.defId ?? starter);
    return `<div class="eyebrow">${factionName(d.faction)} · ${d.role}</div><h2>${d.name}</h2><p class="hero-passive">${d.passive}</p><p class="subtle">${selectedDie === null ? "Base values shown. Select a die in combat to include Power and relic bonuses." : "Values include your selected die, Power, and applicable relics."}</p><div class="inspect-skills">${d.skills.map((skill) => `<div><span class="inspect-sigil">${icon(skill.icon)}</span><span><strong>${skill.name}<em>${skill.ultimate ? "LIMIT · NO DIE" : requirement(skill) + " DIE"}</em></strong><p>${esc(skill.desc.replace("{v}", h && run && (skill.ultimate || selectedDie !== null) ? String(G.skillValue(run, h, skill, skill.ultimate ? 0 : run.battle!.dice.find((d) => d.id === selectedDie)!.value)) : skill.mult ? "[" + skill.base + " + " + skill.mult + " × die]" : String(skill.base)))}</p></span></div>`).join("")}</div>${h ? `<p class="subtle">${h.hp}/${h.maxHp} HP · ${h.armor} Armor · ${h.power} Power · Lv.${h.level}</p>` : ""}`;
  }
  if (modal === "field") {
    const t = TERRAINS[run!.battle!.terrain];
    return `<div class="eyebrow">BATTLEFIELD</div><h2>${t.name}</h2><p>${t.desc}</p>${run!.battle!.nodeType === "boss" ? "<p>Escalation: boss attacks gain +2 damage each turn after turn three. Intent cards include this increase.</p>" : ""}<div class="battle-log"><h3>Combat log</h3>${run!
      .battle!.log.slice(-8)
      .map((line) => `<p>${esc(line)}</p>`)
      .join("")}</div>`;
  }
  if (modal === "relics")
    return `<div class="eyebrow">RELIC COLLECTION · ${run!.relics.length}</div><h2>Things worth saving.</h2>${
      run!.relics.length
        ? `<div class="choices">${run!.relics
            .map((id) => {
              const a = relicDef(id);
              return `<div class="choice-card">${icon(a.icon)}<span><strong>${a.name}</strong><small>${a.desc}</small></span></div>`;
            })
            .join("")}</div>`
        : "<p>Win battles, explore signals, and visit dealers to discover relics.</p>"
    }`;

  if (modal === "help")
    return `<div class="eyebrow">FIELD MANUAL</div><h2>Make every die count.</h2><ol class="manual"><li><b>Read the enemy plans.</b> The enemy cards show what they will do when you end your turn.</li><li><b>Pick a shared die.</b> Choose a hero, choose an ability, then tap its target. Each basic ability is usable once per turn.</li><li><b>Keep the good rolls.</b> Tap a die’s lock to keep it. Reroll the rest up to twice each turn.</li><li><b>Build a combination.</b> Mark adds damage to every hit. Shock deals damage before enemies act, then falls by 1. Weak reduces attacks by 2.</li><li><b>Protect your squad.</b> Block absorbs damage and expires at your next turn. Pierce ignores Block. Armor reduces every hit.</li><li><b>Charge an ultimate.</b> Six ability uses unlock a powerful move that needs no die. Charge resets between fights.</li><li><b>Recruit and adapt.</b> A squad holds three heroes. A fallen hero is lost after the fight. Camps, relics, and upgrades can keep a run alive.</li></ol><p class="subtle">Boss attacks strengthen by 2 each turn after turn three. Jammed enemies skip their action and are immune to another jam on the following turn. Event damage leaves at least 1 HP.</p>`;
  if (modal === "end")
    return `<h2>Leave dice unused?</h2><p>You have ${run!.battle!.dice.filter((d) => !d.used).length} dice left. Enemies will execute their displayed plans.</p>${btn("confirm-end", "End turn", "primary wide")}${btn("close", "Keep planning", "text-button wide")}`;
  if (modal === "new")
    return `<h2>Start a new run?</h2><p>This replaces the current run saved on this device.</p>${btn("confirm-start", "Start fresh", "primary wide")}${btn("close", "Keep this run", "text-button wide")}`;
  if (modal === "replace")
    return `<h2>Make room for ${heroDef(replaceRecruit).name}?</h2><p>Choose a companion to leave at this safehouse. Their upgrades leave with them.</p><div class="choices">${run!.party.map((h) => btn("replace", `<span><strong>${heroDef(h.defId).name}</strong><small>Level ${h.level} · ${h.hp}/${h.maxHp} HP</small></span>`, "choice-card", false, `data-id="${h.uid}"`)).join("")}</div>`;
  if (modal.startsWith("relic:")) {
    const a = relicDef(modal.slice(6));
    return `<div class="chapter-icon">${icon(a.icon)}</div><h2>${a.name}</h2><p>${a.desc}</p>`;
  }
  if (modal === "squad")
    return `<h2>Your coalition</h2><div class="choices">${run!.party.map((h) => `<div class="roster-card"><strong style="color:${heroDef(h.defId).color}">${heroDef(h.defId).name}</strong><p>${heroDef(h.defId).role} · Lv.${h.level} · ${h.hp}/${h.maxHp} HP</p><small>${h.mods.length ? h.mods.map((m) => MODS.find((x) => x.id === m)!.name).join(" · ") : "No permanent upgrades yet."}</small></div>`).join("")}</div>`;
  return `<div class="eyebrow">MESHBREAKERS</div><h2>Take a breath.</h2><div class="menu-options">${btn("help", `${icon("book")} Field manual`, "choice-card")}${run ? btn("squad", `${icon("people")} Your squad`, "choice-card") : ""}${btn("sound", `${icon(settings.sound ? "sound" : "mute")} Sound <b>${settings.sound ? "On" : "Off"}</b>`, "choice-card")}${btn("motion", `${icon("star")} Reduced motion <b>${settings.reduced ? "On" : "Off"}</b>`, "choice-card")}${btn("quality", `${icon("volume")} Battery saver <b>${settings.low ? "On" : "Off"}</b>`, "choice-card")}${screen === "game" ? btn("home", `${icon("map")} Save & return to title`, "choice-card") : ""}</div><p class="subtle">${run ? "Run " + esc(run.seed) + " · " : ""}Saves stay on this device.</p><div class="install-tip"><b>Play from your Home Screen</b><p>In iPhone Safari, open Share and choose “Add to Home Screen.”</p></div>`;
}
let previousFocus: HTMLElement | null = null;
function renderModal() {
  const root = document.querySelector("#modal-root")!;
  document.querySelector(".play-layout")?.setAttribute("inert", "");
  document.querySelector(".topbar")?.setAttribute("inert", "");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="Game dialog" tabindex="-1">${btn("close", icon("x"), "modal-close icon-button", false, 'aria-label="Close dialog"')}${dialogContent()}</section></div>`;
  root.querySelector<HTMLElement>(".modal")?.focus();
}
function openModal(type: string) {
  previousFocus = document.activeElement as HTMLElement;
  modal = type;
  renderModal();
}
function closeModal() {
  modal = "";
  document.querySelector("#modal-root")!.innerHTML = "";
  document.querySelector(".play-layout")?.removeAttribute("inert");
  document.querySelector(".topbar")?.removeAttribute("inert");
  previousFocus?.focus();
}
function resetSelection() {
  selectedSkill = null;
  selectedDie = null;
  selectedHero = activeHero()?.uid ?? run?.party[0]?.uid ?? "";
}
async function resolve(fx: Parameters<Arena["animate"]>[0]) {
  busy = true;
  save();
  document.querySelector(".command-panel")?.setAttribute("inert", "");
  const phase = document.querySelector(".phase-bar strong");
  if (phase) phase.textContent = "RESOLVING…";
  try {
    if (arena) await arena.animate(fx, sound.play);
    else sound.play("hit");
  } finally {
    busy = false;
    resetSelection();
    render();
    if (run?.screen === "reward" || run?.screen === "won") sound.play("win");
  }
}
function start() {
  run = G.createRun(seed || G.newSeed(), starter, difficulty);
  screen = "game";
  selectedHero = run.party[0].uid;
  resetSelection();
  save();
  render();
  if (!localStorageSafe("meshbreakers.learned")) {
    openModal("help");
    try {
      localStorage.setItem("meshbreakers.learned", "yes");
    } catch {}
  }
}
function localStorageSafe(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function getSelectedSkill() {
  const h = activeHero();
  return h && selectedSkill
    ? heroDef(h.defId).skills.find((s) => s.id === selectedSkill)
    : undefined;
}
async function onTarget(id: string) {
  if (busy || !run || screen !== "game") return;
  const h = activeHero(),
    s = getSelectedSkill();
  if (h && s) {
    const result = G.playSkill(run, h.uid, s.id, selectedDie, id);
    if (result.ok) {
      selectedSkill = null;
      await resolve(result.fx);
    } else notify(result.reason ?? "Choose a valid target.");
  } else if (run.party.some((h) => h.uid === id && h.hp > 0)) {
    selectedHero = id;
    selectedSkill = null;
    render();
  } else {
    const e = run.battle?.enemies.find((e) => e.uid === id);
    if (e) openModal("enemy:" + e.uid);
  }
}
async function useSkill(id: string) {
  if (!run) return;
  const h = activeHero()!,
    s = heroDef(h.defId).skills.find((s) => s.id === id)!;
  const reason = G.skillReason(run, h, s, selectedDie);
  if (reason) {
    notify(
      reason === "Select a die" ? "Pick one of the shared dice first." : reason,
    );
    return;
  }
  selectedSkill = selectedSkill === id ? null : id;
  if (selectedSkill && ["self", "party", "enemies"].includes(s.target)) {
    await onTarget(h.uid);
    return;
  }
  render();
}
async function doEnd() {
  if (!run || busy) return;
  const fx = G.endTurn(run);
  await resolve(fx);
}
app.addEventListener("input", (e) => {
  if ((e.target as HTMLElement).id === "seed")
    seed = (e.target as HTMLInputElement).value;
});
app.addEventListener("click", async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-action]",
  );
  if (!button || button.disabled || busy) return;
  const action = button.dataset.action!,
    id = button.dataset.id ?? "";
  sound.unlock();
  if (!["target", "end", "confirm-end"].includes(action)) sound.play("click");
  switch (action) {
    case "page":
      choicePage = Math.max(0, choicePage + Number(id));
      render();
      break;
    case "hero-info":
      openModal("hero-info");
      break;
    case "field":
      openModal("field");
      break;
    case "relics":
      openModal("relics");
      break;
    case "seed-menu":
      openModal("seed");
      break;
    case "starter":
      starter = id;
      render();
      break;
    case "difficulty":
      difficulty = id as "normal" | "hard";
      render();
      break;
    case "start":
      if (saved && !["won", "lost"].includes(saved.screen)) openModal("new");
      else start();
      break;
    case "confirm-start":
      modal = "";
      start();
      break;
    case "continue":
      if (saved) {
        run = saved;
        screen = "game";
        resetSelection();
        render();
      }
      break;
    case "menu":
      openModal("menu");
      break;
    case "help":
      openModal("help");
      break;
    case "close":
      closeModal();
      render();
      break;
    case "sound":
      settings.sound = !settings.sound;
      sound.enabled = settings.sound;
      save();
      render();
      break;
    case "motion":
      settings.reduced = !settings.reduced;
      if (arena) arena.reduced = settings.reduced;
      document.documentElement.classList.toggle(
        "reduce-motion",
        settings.reduced,
      );
      save();
      render();
      break;
    case "quality":
      settings.low = !settings.low;
      arena?.quality(settings.low);
      save();
      render();
      break;
    case "home":
      modal = "";
      save();
      screen = "home";
      render();
      break;
    case "squad":
      openModal("squad");
      break;
    case "hero":
      selectedHero = id;
      selectedSkill = null;
      render();
      break;
    case "die":
      selectedDie = selectedDie === +id ? null : +id;
      selectedSkill = null;
      render();
      break;
    case "lock":
      G.lockDie(run!, +id);
      save();
      render();
      break;
    case "reroll":
      if (G.reroll(run!)) {
        selectedDie = null;
        selectedSkill = null;
        sound.play("dice");
        save();
        render();
        document.querySelector(".dice-tray")?.classList.add("rolling");
      }
      break;
    case "skill":
      await useSkill(id);
      break;
    case "ultimate":
      await useSkill("u");
      break;
    case "target":
      await onTarget(id);
      break;
    case "cancel":
      selectedSkill = null;
      render();
      break;
    case "end":
      if (
        run!.battle!.dice.some(
          (d) =>
            !d.used &&
            G.living(run!).some((h) =>
              heroDef(h.defId)
                .skills.slice(0, 3)
                .some(
                  (s) =>
                    !G.skillReason(run!, h, s, d.id) &&
                    G.targets(run!, h, s).length,
                ),
            ),
        )
      )
        openModal("end");
      else await doEnd();
      break;
    case "confirm-end":
      closeModal();
      await doEnd();
      break;
    case "node":
      if (G.enterNode(run!, id)) {
        resetSelection();
        save();
        render();
      }
      break;
    case "reward":
      if (G.chooseReward(run!, +id)) {
        resetSelection();
        save();
        render();
      }
      break;
    case "skipreward":
      G.skipReward(run!);
      save();
      render();
      break;
    case "recruit":
      if (run!.party.length >= 3) {
        replaceRecruit = id;
        openModal("replace");
      } else {
        G.recruit(run!, id);
        save();
        render();
      }
      break;
    case "replace":
      G.recruit(run!, replaceRecruit, id);
      modal = "";
      resetSelection();
      save();
      render();
      break;
    case "upgrade":
      if (G.upgrade(run!, activeHero()!.uid, id)) {
        save();
        render();
      }
      break;
    case "buy":
      if (G.buy(run!, id)) {
        save();
        render();
        notify("Good choice. No receipt.");
      }
      break;
    case "leave":
      G.continueToMap(run!);
      save();
      render();
      break;
    case "rest":
      G.rest(run!, id as "heal" | "upgrade");
      save();
      render();
      break;
    case "event":
      G.eventChoice(run!, +id);
      save();
      render();
      break;
    case "relic":
      openModal("relic:" + id);
      break;
    case "new":
      screen = "home";
      run = null;
      seed = "";
      render();
      break;
    case "replay":
      seed = run!.seed;
      screen = "home";
      run = null;
      render();
      break;
  }
});
document.addEventListener("keydown", (e) => {
  if (modal) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === "Tab") {
      const elements = [
        ...document.querySelectorAll<HTMLElement>(
          ".modal button:not(:disabled), .modal input, .modal a",
        ),
      ];
      const first = elements[0],
        last = elements[elements.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement?.classList.contains("modal"))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  } else if (e.key === "Escape" && selectedSkill) {
    selectedSkill = null;
    render();
  }
});
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
});
document.documentElement.classList.toggle("reduce-motion", settings.reduced);
render();
if (
  "serviceWorker" in navigator &&
  location.protocol === "https:" &&
  !location.hostname.endsWith("localhost")
)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
