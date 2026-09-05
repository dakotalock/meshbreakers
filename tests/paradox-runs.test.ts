import {expect,it} from "vitest";
import {sim} from "./support/player";
import * as G from "../src/engine";
it("plays complete Hard and Paradox campaigns with legal decisions and resumable saves",()=>{
  const report=[];
  for(const difficulty of ["hard","paradox"] as const){
    const results=[];
    for(const starter of ["rook","iri","nyx"])for(let i=0;i<8;i++){
      const r=sim("CLOCKWORK"+i,starter,difficulty);
      results.push({won:r.screen==="won",floor:r.act,cycle:G.cycleOf(r),node:r.nodeId,party:r.party.map(h=>h.defId)});
    }
    expect(results.some(r=>r.won && !r.party.includes("lyra"))).toBe(true);
    report.push({difficulty,wins:results.filter(r=>r.won).length,total:results.length,cycles:[1,2,3].map(c=>results.filter(r=>r.cycle===c).length),furthest:Math.max(...results.map(r=>(r.cycle-1)*5+r.floor))});
    expect(results.every(r=>r.floor>=1)).toBe(true);
  }
  console.log("Hard / Paradox campaign smoke:",JSON.stringify(report));
});
