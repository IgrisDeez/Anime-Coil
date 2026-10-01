import { Arena, STEP, type CharacterId, type Input } from '../src/simulation';
import { Arena as BaselineArena } from './fixtures/v167-simulation';
import type { GameRenderer } from '../src/renderer';
export type Scenario='ordinary'|'stress'|'projectiles'|'respawns'|'cinematic';
export function installSimulationBenchmark(callbacks:{start:()=>void;choose:(id:CharacterId)=>void;arena:()=>Arena|undefined;view:GameRenderer;constructor:(ctor:typeof Arena)=>void;random:(rng:()=>number)=>void;clock:()=>void}) {
 let active=false,tick=0,scenario:Scenario='ordinary',rngState=812,rngCalls=0,deltas:number[]=[],tape:number[]|undefined,cursor=0,startTick=0,goal=0,warming=false,resolve:((report:unknown)=>void)|undefined;
 let detailed=true;
 const rng=()=>{rngCalls++;return (rngState=(Math.imul(rngState,1664525)+1013904223)>>>0)/4294967296;};
 const input=():Input=>{
  // Development-only collision waves exercise the unchanged death/event/respawn path.
  if(scenario==='respawns'&&[700,2500,4300].includes(tick)){
   const a=callbacks.arena()!;for(const s of a.snakes)if(s.id>0&&s.alive){s.x=a.player.x+6;s.z=a.player.z;s.body[0].x=s.x;s.body[0].z=s.z;}
  }
  return {angle:tick*.0035,boost:tick%360<70,ability:scenario==='projectiles'?tick%75===0:tick%240===0,nuke:scenario==='cinematic'&&tick%1900===700};
 };
 const state=()=>{const a=callbacks.arena()!;return {tick,rngState,rngCalls,arena:JSON.stringify(a),population:a.snakes.filter(s=>s.alive).length,segments:a.snakes.reduce((n,s)=>n+(s.alive?s.body.length-1:0),0),food:a.food.length};};
 const api={
  get arena(){return callbacks.arena();},get view(){return callbacks.view;},get running(){return active;},input,
  reset(kind:Scenario='ordinary',baseline=false,profile=true){active=false;scenario=kind;tick=0;rngState=812;rngCalls=0;detailed=profile;callbacks.constructor((baseline?BaselineArena:Arena) as unknown as typeof Arena);callbacks.random(rng);callbacks.choose(kind==='projectiles'?'nova':'ember');callbacks.start();
   const a=callbacks.arena()!;if(kind==='stress')for(const s of a.snakes){s.mass=360;s.peak=360;while(s.body.length<360)s.body.push({...s.body.at(-1)!});}
   callbacks.view.profiler.simulation.detailEnabled=profile;callbacks.view.profiler.simulation.enabled=profile;callbacks.view.profiler.simulation.detach();if(profile)callbacks.view.profiler.simulation.attach(a);a.state='paused';callbacks.clock();return state();
  },
  run(ticks=1800,schedule?:number[],warm=false){if(active)throw Error('benchmark already running');deltas=[];tape=schedule;cursor=0;startTick=tick;goal=tick+ticks;warming=warm;callbacks.view.resetMeasurements();callbacks.view.profiler.enabled=true;callbacks.view.profiler.simulation.enabled=detailed;callbacks.arena()!.state='playing';callbacks.clock();active=true;return new Promise(r=>resolve=r);},
  delta(dt:number){if(!active)return dt;const value=tape?tape[cursor++]:dt;if(value===undefined)throw Error('replay schedule exhausted');deltas.push(value);return value;},
  afterTick(){if(active)tick++;},
  afterFrame(){if(!active||tick<goal)return;active=false;callbacks.arena()!.state='paused';const result={scenario,warming,startTick,endTick:tick,deltas,diagnostics:callbacks.view.diagnostics(),state:state()};callbacks.clock();resolve!(result);resolve=undefined;},
  state,
 };
 (window as any).simPerf=api;return api;
}
