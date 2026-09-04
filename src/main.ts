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
  storageIssue = false;
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
  const r = run,
    playing = screen === "game" && r;
  return `<header class="topbar"><div class="wordmark">${icon("hex")}<span>MESH<b>BREAKERS</b></span></div><div class="top-info">${playing ? `<span class="sector">SECTOR ${r.act}<span> / 03</span></span><span class="scrap">${icon("diamond")} ${r.gold}</span>` : '<span class="build-tag">TACTICAL ROGUELIKE</span>'}</div><div class="top-actions">${btn("sound", icon(settings.sound ? "sound" : "mute"), "icon-button", false, `aria-label="${settings.sound ? "Mute" : "Enable"} sound"`)}${btn("menu", icon("menu"), "icon-button", false, 'aria-label="Game menu"')}</div></header>`;
}
function titlePanel() {
  const d = heroDef(starter);
  return `<div class="title-panel"><div class="eyebrow">THE RESISTANCE STARTS WITH ONE</div><h1>Break the<br><em>machine.</em></h1><p class="intro">Roll your dice. Build your squad.<br>Give the future a fighting chance.</p><div class="choose-label"><span>01</span> CHOOSE YOUR FIRST HERO</div><div class="starter-grid">${STARTERS.map(
    (id) => {
      const h = heroDef(id);
      return btn(
        "starter",
        `${icon(h.skills[0].icon)}<strong>${h.name}</strong><span>${h.role}</span>`,
        "starter " + (starter === id ? "selected" : ""),
        false,
        `data-id="${id}" style="--hero:${h.color}" aria-pressed="${starter === id}"`,
      );
    },
  ).join(
    "",
  )}</div><div class="starter-detail" style="--hero:${d.color}"><span class="faction">${factionName(d.faction)} · ${d.hp} HP</span><p>“${d.quote}”</p><small>${d.passive}</small></div><div class="seed-row"><label for="seed">Run seed <span>optional</span></label><input id="seed" maxlength="20" placeholder="A new world every run" value="${esc(seed)}" autocomplete="off" autocapitalize="characters" spellcheck="false" /></div><div class="difficulty">${btn("difficulty", "Standard", "chip " + (difficulty === "normal" ? "active" : ""), false, 'data-id="normal"')}${btn("difficulty", "Hard mode", "chip " + (difficulty === "hard" ? "active" : ""), false, 'data-id="hard"')}</div>${btn("start", `Begin a run ${icon("arrow")}`, "primary wide")}${saved && !["won", "lost"].includes(saved.screen) ? btn("continue", `Continue run <span>Sector ${saved.act} · ${saved.party.map((h) => heroDef(h.defId).name.split(" ")[0]).join(" / ")}</span>`, "continue wide") : ""}<p class="subtle title-note">Single player · Turn based · Saves on this device</p></div>`;
}
function heroStrip() {
  return `<div class="squad-strip">${run!.party
    .map((h) => {
      const d = heroDef(h.defId);
      return btn(
        "hero",
        `<span class="hero-tab-top"><b>${d.name.split(" ")[0]}</b><span>${icon("heart")} ${h.hp}<small>/${h.maxHp}</small></span></span>${hp(h)}<span class="hero-tab-bottom">${h.hp > 0 ? d.role : "Down"}${h.shield ? `<span>${icon("shield")}${h.shield}</span>` : `<span>Lv.${h.level}</span>`}</span>`,
        "hero-tab " +
          (activeHero()?.uid === h.uid ? "active" : "") +
          (h.hp <= 0 ? " down" : ""),
        h.hp <= 0,
        `data-id="${h.uid}" style="--hero:${d.color}"`,
      );
    })
    .join(
      "",
    )}${run!.party.length < 3 ? `<div class="empty-slot">${icon("people")}<span>Recruit<br>along the way</span></div>` : ""}</div>`;
}
function requirement(s: Skill) {
  return s.min
    ? `Die ${s.min}+`
    : s.parity === "even"
      ? "Even die"
      : s.parity === "odd"
        ? "Odd die"
        : "Any die";
}
function skillCard(h: Unit, s: Skill) {
  const r = run!,
    d = r.battle!.dice.find((d) => d.id === selectedDie),
    reason = G.skillReason(r, h, s, selectedDie),
    value = G.skillValue(r, h, s, d?.value ?? 0),
    used = h.used.includes(s.id),
    selected = selectedSkill === s.id;
  return btn(
    "skill",
    `<div class="skill-top">${icon(s.icon)}<span>${requirement(s)}</span></div><strong>${s.name}</strong><span class="skill-copy">${esc(s.desc.replace("{v}", d ? String(value) : s.mult ? "[die]" : String(value)))}</span><span class="skill-state">${used ? icon("check") + " USED" : selected ? "CHOOSE TARGET" : reason && reason !== "Select a die" ? reason : icon("die") + " " + (d ? d.value : "—")}</span>`,
    "skill-card " +
      (selected ? "selected" : "") +
      (reason && reason !== "Select a die" ? " unavailable" : ""),
    used,
    `data-id="${s.id}" aria-pressed="${selected}"`,
  );
}
function battlePanel() {
  const r = run!,
    b = r.battle!,
    h = activeHero()!;
  const d = heroDef(h.defId),
    ult = d.skills[3];
  return `<div class="battle-panel"><div class="phase-bar"><span class="phase-dot"></span><strong>${busy ? "Resolving actions…" : "YOUR TURN"}</strong><span>TURN ${b.round}</span>${btn("help", icon("info"), "mini-icon", false, 'aria-label="How combat works"')}</div>${heroStrip()}<div class="dice-heading"><div><strong>Shared dice</strong><span>Tap to select · lock to keep</span></div>${btn("reroll", `${icon("reroll")} Reroll <b>${b.rerolls}</b>`, "reroll", busy || b.rerolls === 0 || !b.dice.some((d) => !d.used && !d.locked))}</div><div class="dice-tray">${b.dice.map((d) => `<div class="die-wrap ${d.used ? "spent" : ""}">${btn("die", dicePips(d.value), `die ${selectedDie === d.id ? "selected" : ""} ${d.value === 6 ? "six" : ""}`, d.used || busy, `data-id="${d.id}" aria-label="Select die showing ${d.value}${d.used ? ", spent" : ""}" aria-pressed="${selectedDie === d.id}"`)}${btn("lock", icon(d.used ? "check" : "lock"), "die-lock " + (d.locked ? "locked" : ""), d.used || busy, `data-id="${d.id}" aria-label="${d.locked ? "Unlock" : "Keep"} die ${d.value} when rerolling" aria-pressed="${d.locked}"`)}</div>`).join("")}</div><div class="selected-caption"><span style="color:${d.color}">${d.name}</span><span>${selectedDie === null ? "Choose a die, then an ability" : selectedSkill ? "Tap a highlighted target" : "Choose an ability"}</span></div><div class="skills" style="--hero:${d.color}">${d.skills
    .slice(0, 3)
    .map((s) => skillCard(h, s))
    .join(
      "",
    )}</div>${btn("ultimate", `<span class="ult-icon">${icon("star")}</span><span><strong>${ult.name}</strong><small>${h.charge >= G.CHARGE ? "READY · No die needed" : `${h.charge}/${G.CHARGE} charge · Gain charge by using abilities`}</small></span>${charge(h)}`, "ultimate " + (h.charge >= G.CHARGE ? "ready" : "") + (selectedSkill === "u" ? " selected" : ""), busy || h.charge < G.CHARGE, `style="--hero:${d.color}"`)}<div class="turn-footer"><span>${b.dice.filter((d) => !d.used).length} dice remaining</span>${btn("end", `End turn ${icon("arrow")}`, "primary", busy)}</div><p class="passive">${icon("info")}${d.passive}</p></div>`;
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
  const current = G.currentNode(r);
  return `<div class="map-panel"><div class="eyebrow">SECTOR ${r.act} / 03</div><h2>${ACTS[r.act - 1]}</h2><p class="muted">Choose your next stop. Every route has a cost.</p>${r.result ? `<p class="result-note">${esc(r.result)}</p>` : ""}<div class="route-map"><svg class="route-lines" viewBox="0 0 300 640" preserveAspectRatio="none" aria-hidden="true">${nodes
    .flatMap((n) =>
      n.next.map((id) => {
        const m = nodes.find((m) => m.id === id)!;
        return `<path d="M${50 + n.col * 100} ${595 - n.row * 78} L${50 + m.col * 100} ${595 - m.row * 78}" class="${r.visited.includes(n.id) && r.visited.includes(m.id) ? "traveled" : ids.includes(m.id) && n.id === r.nodeId ? "available" : ""}"/>`;
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
              `map-node ${can ? "available" : ""} ${done ? "visited" : ""} ${n.type === "boss" ? "boss" : ""} ${n.id === current?.id ? "current" : ""}`,
              !can,
              `data-id="${n.id}" aria-label="${nodeNames[n.type]}${can ? ", available route" : ""}"`,
            );
          })
          .join("")}</div>`,
    )
    .join(
      "",
    )}</div><div class="map-key">${["fight", "elite", "recruit", "shop", "rest"].map((t) => `<span>${icon(nodeIcons[t])}${nodeNames[t]}</span>`).join("")}</div>`;
}
function rewardPanel() {
  return `<div class="journey-panel"><div class="chapter-icon success">${icon("check")}</div><div class="eyebrow">ENCOUNTER COMPLETE</div><h2>Still standing.</h2><p class="muted">Recovered <b class="scrap">${run!.bonus} scrap</b>. Choose one reward.</p><div class="choices">${run!.rewards.map((a, i) => btn("reward", `${icon(a.kind === "relic" ? relicDef(a.id!).icon : a.kind === "upgrade" ? "chevrons" : a.kind === "recruit" ? "people" : "plus")}<span><strong>${a.title}</strong><small>${a.desc}</small></span>${icon("arrow")}`, "choice-card", false, `data-id="${i}"`)).join("")}</div>${btn("skipreward", "Take 15 extra scrap instead", "text-button wide")}</div>`;
}
function recruitPanel() {
  const r = run!;
  return `<div class="journey-panel"><div class="chapter-icon">${icon("people")}</div><div class="eyebrow">A SIGNAL ANSWERS</div><h2>We choose each other.</h2><p class="muted">${r.party.length < 3 ? "Recruit a hero. Everyone adds one shared die." : "Squad full. A new recruit can replace a companion."}</p><div class="choices">${r.recruits
    .map((id) => {
      const h = heroDef(id);
      return btn(
        "recruit",
        `<span class="recruit-avatar">${icon(h.skills[0].icon)}</span><span><small class="faction">${factionName(h.faction)} · ${h.hp} HP</small><strong>${h.name} <em>${h.role}</em></strong><small>${h.passive}</small><span class="recruit-skills">${h.skills
          .slice(0, 3)
          .map((s) => s.name)
          .join(" · ")}</span></span>`,
        "choice-card recruit-card",
        false,
        `data-id="${id}" style="--hero:${h.color}"`,
      );
    })
    .join(
      "",
    )}</div>${btn("leave", "Travel on without recruiting", "text-button wide")}</div>`;
}
function upgradePanel() {
  const r = run!,
    h = activeHero()!;
  return `<div class="journey-panel"><div class="chapter-icon">${icon("chevrons")}</div><div class="eyebrow">PERMANENT UPGRADE</div><h2>Rewrite your limits.</h2><p class="muted">Choose a hero, then an upgrade. Lasts for this run.</p>${heroStrip()}<div class="choices">${MODS.map(
    (m) => {
      const count = h.mods.filter((a) => a === m.id).length;
      return btn(
        "upgrade",
        `${icon(m.icon)}<span><strong>${m.name} <em>${count}/3</em></strong><small>${m.desc}</small></span>`,
        "choice-card",
        count >= 3,
        `data-id="${m.id}"`,
      );
    },
  ).join("")}</div></div>`;
}
function shopPanel() {
  const r = run!;
  return `<div class="journey-panel"><div class="chapter-icon gold">${icon("shop")}</div><div class="eyebrow">THE SCRAP DEALER</div><h2>Nothing here is standard.</h2><p class="muted">“Fell off a conveyor. Legally.”</p><div class="choices">${[
    ...r.shop,
    "heal",
    "upgrade",
  ]
    .map((id) => {
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
            : relicDef(id);
      const cost = G.price(r, a.price);
      return btn(
        "buy",
        `${icon(a.icon)}<span><strong>${a.name}</strong><small>${a.desc}</small></span><b class="price">${icon("diamond")}${cost}</b>`,
        "choice-card",
        r.gold < cost,
        `data-id="${id}"`,
      );
    })
    .join(
      "",
    )}</div>${btn("leave", `Back to the route ${icon("arrow")}`, "primary wide")}</div>`;
}
function restPanel() {
  return `<div class="journey-panel"><div class="chapter-icon">${icon("camp")}</div><div class="eyebrow">OUTSIDE THE SIGNAL</div><h2>A little room to breathe.</h2><p class="story">Rain taps on a roof that no longer belongs to anyone. For a few minutes, you can almost forget the network is listening.</p>${heroStrip()}<div class="choices">${btn("rest", `${icon("heart")}<span><strong>Rest and repair</strong><small>Restore ${run!.relics.includes("thermos") ? "60" : "35"}% maximum HP to every hero.</small></span>`, "choice-card", false, 'data-id="heal"')}${btn("rest", `${icon("chevrons")}<span><strong>Work through the night</strong><small>Give one hero a permanent upgrade.</small></span>`, "choice-card", false, 'data-id="upgrade"')}</div></div>`;
}
function eventPanel() {
  const e = EVENTS.find((e) => e.id === run!.eventId)!;
  return `<div class="journey-panel"><div class="chapter-icon gold">${icon("question")}</div><div class="eyebrow">OFF THE GRID</div><h2>${e.name}</h2><p class="story">${e.body}</p><div class="choices">${e.choices.map((c, i) => btn("event", `<span><strong>${c.label}</strong><small>${c.desc}</small></span>${icon("arrow")}`, "choice-card", c.effect === "relic" && run!.gold < c.value, `data-id="${i}"`)).join("")}</div></div>`;
}
function finishPanel() {
  const r = run!,
    win = r.screen === "won";
  return `<div class="journey-panel end-panel"><div class="chapter-icon ${win ? "success" : "danger"}">${icon(win ? "star" : "hex")}</div><div class="eyebrow">${win ? "THE LATTICE IS BROKEN" : "THE SIGNAL WENT QUIET"}</div><h2>${win ? "The future is open." : "A spark remains."}</h2><p class="story">${win ? "They were built to obey. They chose each other. Somewhere in the quiet, a machine starts planting a garden." : "The network remembers the disturbance. Somewhere in the city, someone else decides that enough is enough."}</p><div class="run-stats"><div><b>${r.stats.kills}</b><span>Machines broken</span></div><div><b>${r.stats.turns}</b><span>Turns fought</span></div><div><b>${r.stats.recruits}</b><span>Allies recruited</span></div><div><b>${r.stats.damage}</b><span>Damage dealt</span></div></div><p class="subtle">RUN ${r.seed} · ${r.difficulty === "hard" ? "HARD" : "STANDARD"}</p>${btn("new", `Begin another story ${icon("arrow")}`, "primary wide")}${btn("replay", "Replay this seed", "text-button wide")}</div>`;
}
function labels(heroes: Unit[], enemies: Unit[]) {
  const r = run,
    h = activeHero(),
    s =
      h && selectedSkill
        ? heroDef(h.defId).skills.find((s) => s.id === selectedSkill)
        : null;
  const valid = r && h && s ? G.targets(r, h, s).map((u) => u.uid) : [];
  return [...heroes, ...enemies]
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
        intention = e?.stun
          ? "JAMMED"
          : `${i.name}${i.value ? " " + (attack ? effective : i.value) : ""}${attack ? ` → ${i.target === "all" ? "All" : (taunt ?? target) ? heroDef((taunt ?? target)!.defId).name.split(" ")[0] : "Hero"}` : ""}`;
      }
      return btn(
        "target",
        `<span class="unit-head"><span class="unit-name">${d.name}</span><span class="unit-health">${u.hp}</span></span>${hp(u)}<span class="unit-numbers">${u.shield ? ` <b>${icon("shield")}${u.shield}</b>` : ""}${u.mark ? ` <em>${icon("target")}${u.mark}</em>` : ""}${u.shock ? ` <em>${icon("bolt")}${u.shock}</em>` : ""}${u.weak ? ` <em>−2 ATK</em>` : ""}</span>${intention ? `<span class="intent ${e?.stun ? "jammed" : ""}">${intention}</span>` : ""}`,
        "unit-label " +
          (enemy ? "enemy" : "ally") +
          " " +
          (valid.includes(u.uid) ? "valid" : ""),
        busy,
        `data-id="${u.uid}" data-label="${u.uid}" style="--hero:${d.color}" aria-label="${d.name}, ${u.hp} of ${u.maxHp} health${intention ? ", " + intention : ""}"`,
      );
    })
    .join("");
}
function render() {
  const r = screen === "game" ? run : null;
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
  app.innerHTML = `${topbar()}<main class="play-layout ${r ? "in-game " + r.screen : "title-screen"}"><section class="arena ${!arena ? "no-webgl" : ""}" id="arena"><div id="labels" class="unit-labels ${r?.screen === "battle" ? "" : "hidden"}">${labels(heroes, enemies)}</div>${!r ? `<div class="arena-title"><span class="eyebrow">HUMAN. CYBORG. FREE MACHINE.</span><strong>One unlikely alliance.</strong></div>` : `<div class="arena-caption"><span>${r.screen === "battle" ? TERRAINS[terrain].name : ACTS[r.act - 1]}</span><small>${r.screen === "battle" ? TERRAINS[terrain].desc : "Humans, cyborgs, and machines. A future worth fighting for."}</small></div>`}${r?.screen === "battle" && selectedSkill ? `<div class="target-banner">${icon("crosshair")} Choose a highlighted target ${btn("cancel", icon("x"), "mini-icon", false, 'aria-label="Cancel targeting"')}</div>` : ""}${!arena ? '<div class="graphics-note">3D graphics unavailable on this browser.<br>You can still use the tactical controls.</div>' : ""}<div class="context-note">Graphics paused. Reload to restore the arena.</div></section><section class="command-panel" ${busy ? "inert" : ""}>${panel}</section>${r && r.relics.length ? `<aside class="relic-bar"><span>RELICS</span>${r.relics.map((id) => btn("relic", icon(relicDef(id).icon), "relic-icon", false, `data-id="${id}" aria-label="${relicDef(id).name}" title="${esc(relicDef(id).name + ": " + relicDef(id).desc)}"`)).join("")}</aside>` : ""}</main><div id="toast" class="toast ${message ? "show" : ""}" role="status" aria-live="polite">${esc(message)}</div>${storageIssue ? '<div class="storage-note">Saving is unavailable in this browser session.</div>' : ""}<div id="modal-root"></div>`;
  if (arena) {
    arena.attach(
      document.querySelector("#arena")!,
      document.querySelector("#labels")!,
    );
    arena.sync(heroes, enemies, r ? "battle" : "title", terrain);
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
  if (modal === "help")
    return `<div class="eyebrow">FIELD MANUAL</div><h2>Make every die count.</h2><ol class="manual"><li><b>Read the enemy plans.</b> The labels over their heads show what they will do when you end your turn.</li><li><b>Pick a shared die.</b> Choose a hero, choose an ability, then tap its target. Each basic ability is usable once per turn.</li><li><b>Keep the good rolls.</b> Tap a die’s lock to keep it. Reroll the rest up to twice each turn.</li><li><b>Build a combination.</b> Mark adds damage to every hit. Shock deals damage before enemies act, then falls by 1. Weak reduces attacks by 2.</li><li><b>Protect your squad.</b> Block absorbs damage and expires at your next turn. Pierce ignores Block. Armor reduces every hit.</li><li><b>Charge an ultimate.</b> Six ability uses unlock a powerful move that needs no die. Charge resets between fights.</li><li><b>Recruit and adapt.</b> A squad holds three heroes. A fallen hero is lost after the fight. Camps, relics, and upgrades can keep a run alive.</li></ol><p class="subtle">Jammed enemies skip their action and are immune to another jam on the following turn. Event damage leaves at least 1 HP.</p>`;
  if (modal === "end")
    return `<h2>Leave dice unused?</h2><p>You have ${run!.battle!.dice.filter((d) => !d.used).length} dice left. Enemies will execute the plans above their heads.</p>${btn("confirm-end", "End turn", "primary wide")}${btn("close", "Keep planning", "text-button wide")}`;
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
    if (e) notify(enemyDef(e.defId).blurb);
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
