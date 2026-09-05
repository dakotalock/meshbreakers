import {describe, it, expect} from "vitest";
import * as G from "../src/engine";
import {heroDef, MODS, EVENTS} from "../src/content";
import type {Run, Progress} from "../src/types";
const unlocked: Progress = {version:1,hardCleared:true,paradoxCleared:false};
function paradox() {return G.createRun("UNWRITTEN", "rook", "paradox", unlocked);}
function boss(r: Run) {
  r.act=5; r.nodeId="5-6-1"; r.screen="map";
  expect(G.enterNode(r,"5-7-1")).toBe(true);
}
function finishBoss(r: Run) {
  boss(r);
  for(const e of r.battle!.enemies) {e.hp=1; e.shock=5;}
  G.endTurn(r);
}
function timeBattle() {
  const r=G.createRun("REPRISE","rook");
  r.party=[G.makeHero(r,"lyra"),G.makeHero(r,"rook"),G.makeHero(r,"nyx")];
  r.screen="map";r.nodeId="";r.visited=[]; G.enterNode(r,"1-0-1");
  r.battle!.terrain="foundry";
  for(const e of r.battle!.enemies){e.hp=e.maxHp=300;e.armor=0;e.shield=0;}
  return r;
}
describe("three timelines",()=>{
  it("unlocks only from a Hard victory and recovers the previous finished Hard save",()=>{
    const p=G.loadProgress(null), r=G.createRun("UNLOCK","rook");
    expect(()=>G.createRun("LOCKED","rook","paradox",p)).toThrow(/Hard/);
    r.screen="won"; G.recordVictory(p,r);expect(p.hardCleared).toBe(false);
    r.difficulty="hard";r.screen="battle";G.recordVictory(p,r);expect(p.hardCleared).toBe(false);
    r.screen="won";expect(G.loadProgress(null,r).hardCleared).toBe(true);
    G.recordVictory(p,r);expect(G.loadProgress(JSON.stringify(p))).toEqual(p);
    expect(G.createRun("OPEN","rook","paradox",p).cycle).toBe(1);
  });
  it("requires three final bosses, preserves the coalition twice and safely resumes both checkpoints",()=>{
    let r=paradox();r.party.push(G.makeHero(r,"nyx"));
    r.party[0].mods=["power","power","vitality"];r.party[0].maxHp+=10;r.party[0].level=4;
    r.relics=["battery","rations","afterglow"];r.gold=333;
    const team=r.party.map(h=>({uid:h.uid,mods:[...h.mods],level:h.level,maxHp:h.maxHp}));
    const p=G.loadProgress(null);
    for(let cycle=1;cycle<=3;cycle++){
      finishBoss(r);G.recordVictory(p,r);
      expect(r.screen).toBe(cycle<3?"rewind":"won");
      expect(p.paradoxCleared).toBe(cycle===3);
      expect(r.battle!.enemies[0].defId).toBe("aion");
      if(cycle===3)break;
      r=G.loadRun(JSON.stringify(r))!;expect(r).not.toBeNull();
      const gold=r.gold, routes=JSON.stringify(r.maps), relics=[...r.relics];
      expect(G.rewindCycle(r)).toBe(true);
      expect(r.cycle).toBe(cycle+1);expect(r.act).toBe(1);expect(r.screen).toBe("map");
      expect(r.gold).toBe(gold);expect(r.relics).toEqual(relics);
      expect(r.party.map(h=>({uid:h.uid,mods:h.mods,level:h.level,maxHp:h.maxHp}))).toEqual(team);
      expect(r.party.every(h=>h.hp===h.maxHp)).toBe(true);
      expect(JSON.stringify(r.maps)).not.toBe(routes);
      expect(G.availableNodes(r).map(n=>n.id)).toEqual(["1-0-1"]);
      expect(G.loadRun(JSON.stringify(r))).toEqual(r);
      expect(G.rewindCycle(r)).toBe(false);
    }
    expect(p.hardCleared).toBe(true);expect(G.rewindCycle(r)).toBe(false);
  });
  it("increases enemies each cycle without increasing the number of actions they take",()=>{
    const values=[];
    for(let cycle=1;cycle<=3;cycle++){
      const r=paradox();r.cycle=cycle;boss(r);
      const e=r.battle!.enemies[0];
      r.party[0].hp=r.party[0].maxHp=500;r.party[0].shield=500;
      G.endTurn(r);
      values.push({hp:e.maxHp,claw:e.intent.value});
      expect(e.intent.name).toBe("Chronal claw");expect(e.intent.effect).toBe("pierce");
    }
    expect(values[1].hp).toBeGreaterThan(values[0].hp);expect(values[2].hp).toBeGreaterThan(values[1].hp);
    expect(values[1].claw).toBeGreaterThan(values[0].claw);expect(values[2].claw).toBeGreaterThan(values[1].claw);
  });
  it("keeps legacy saves and rejects impossible timeline numbers",()=>{
    const r=paradox();r.cycle=4;expect(G.loadRun(JSON.stringify(r))).toBeNull();
    r.cycle=2;r.difficulty="normal";expect(G.loadRun(JSON.stringify(r))).toBeNull();
    delete r.cycle;expect(G.loadRun(JSON.stringify(r))?.cycle).toBeUndefined();
  });
});
describe("Lyra, the Unwritten",()=>{
  it("restores turn-start dice, rerolls, HP and basic actions while retaining enemy damage and other heroes' charge",()=>{
    const r=timeBattle(), [lyra,rook]=r.party,b=r.battle!,e=b.enemies[0];
    expect(lyra.charge).toBe(2);
    const dice=structuredClone(b.anchor!.dice), rerolls=b.rerolls, hp=rook.hp;
    G.reroll(r);lyra.charge=6;rook.charge=4;
    const d=b.dice[0];d.value=6;
    expect(G.playSkill(r,lyra.uid,"needle",d.id,e.uid).ok).toBe(true);
    const enemyHP=e.hp;rook.hp-=8;rook.used=["strike"];lyra.charge=6;
    const result=G.playSkill(r,lyra.uid,"u",null,lyra.uid);
    expect(result.ok).toBe(true);expect(b.dice).toEqual(dice);expect(b.rerolls).toBe(rerolls);
    expect(rook.hp).toBe(hp);expect(rook.charge).toBe(4);expect(lyra.charge).toBe(0);
    expect(r.party.every(h=>h.used.length===0)).toBe(true);expect(e.hp).toBe(enemyHP);
    expect(b.rewound).toBe(true);lyra.charge=6;
    expect(G.playSkill(r,lyra.uid,"u",null,lyra.uid).ok).toBe(false);
    const reloaded=G.loadRun(JSON.stringify(r))!;
    expect(G.skillReason(reloaded,reloaded.party[0],heroDef("lyra").skills[3],null)).toMatch(/already used/);
  });
  it("prevents the first fatal hit, but cannot prevent a second fatal hit in the same fight",()=>{
    const r=timeBattle(), h=r.party[0];h.hp=1;h.shield=0;h.armor=0;
    r.battle!.enemies=r.battle!.enemies.slice(0,1);
    const e=r.battle!.enemies[0];e.intent={effect:"pierce",value:100,target:h.uid,name:"Test fatal hit"};
    const fx=G.endTurn(r);expect(h.hp).toBe(12);expect(h.revived).toBe(true);expect(fx.some(f=>f.kind==="rewind")).toBe(true);
    e.intent={effect:"pierce",value:100,target:h.uid,name:"Second fatal hit"};
    G.endTurn(r);expect(h.hp).toBe(0);
  });
  it("appears very rarely after floor one and never duplicates an owned recruit",()=>{
    const r=timeBattle();r.party=r.party.filter(h=>h.defId!=="lyra");
    for(let i=0;i<100;i++){r.act=1;G.offerRecruits(r);expect(r.recruits).not.toContain("lyra");}
    r.act=2;let sightings=0;
    for(let i=0;i<1000;i++){G.offerRecruits(r);if(r.recruits.includes("lyra"))sightings++;expect(new Set(r.recruits).size).toBe(r.recruits.length);}
    expect(sightings).toBeGreaterThan(3);expect(sightings).toBeLessThan(35);
    r.party.push(G.makeHero(r,"lyra"));
    for(let i=0;i<100;i++){G.offerRecruits(r);expect(r.recruits).not.toContain("lyra");}
  });
});
it("does not trap a fully upgraded coalition in shops, camps, events or rewards",()=>{
  const r=paradox();for(const h of r.party)h.mods=MODS.flatMap(m=>[m.id,m.id,m.id]);
  expect(G.canUpgrade(r)).toBe(false);r.screen="shop";r.gold=500;
  expect(G.buy(r,"upgrade")).toBe(false);expect(r.gold).toBe(500);
  r.screen="rest";expect(G.rest(r,"upgrade")).toBe(false);expect(G.rest(r,"heal")).toBe(true);
  const event=EVENTS.find(e=>e.choices.some(c=>c.effect==="upgrade"))!;
  r.screen="event";r.eventId=event.id;
  expect(G.eventChoice(r,event.choices.findIndex(c=>c.effect==="upgrade"))).toBe(true);expect(r.screen).toBe("map");
});
