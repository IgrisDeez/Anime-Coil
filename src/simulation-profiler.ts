import type { Arena } from './simulation';
export const SIM_STAGES = ['movement-state','body','index','collision','food','ai','abilities','respawn','events-compass','events-progression','events-unlocks','events-practice','events-effects','events-stamps','events-audio'] as const;
export type SimulationStage=typeof SIM_STAGES[number];
const probes=new WeakMap<object,SimulationProfiler>();
export const simulationProbe=(arena:object)=>probes.get(arena);
const stats=(values:number[])=>{values.sort((a,b)=>a-b);return {samples:values.length,median:values[Math.floor(values.length*.5)]??0,p95:values[Math.min(values.length-1,Math.floor(values.length*.95))]??0,worst:values.at(-1)??0,above16_7:values.filter(x=>x>16.7).length,above25:values.filter(x=>x>25).length,above33_3:values.filter(x=>x>33.3).length};};
/** Opt-in method instrumentation; no per-segment timers or authoritative fields. */
export class SimulationProfiler {
 enabled=false; detailEnabled=true; backlogMs=0; events=0; substeps=0;
 private frame=new Float64Array(SIM_STAGES.length);
 private ticks=new Float64Array(8192*(SIM_STAGES.length+1));
 private frames=new Float64Array(8192*(SIM_STAGES.length+5));
 private tickCursor=0; private tickCount=0; private frameCursor=0; private frameCount=0; private frameTicks=0;
 private stack:{stage:number;start:number;child:number}[]=[];
 private tickValues=new Float64Array(SIM_STAGES.length);
 private arena:object|undefined; private restore:(()=>void)[]=[];
 attach(arena:Arena){this.detach();if(!this.enabled)return;this.arena=arena;probes.set(arena,this);
  const methods:Record<string,SimulationStage>={step:'movement-state',followBody:'body',reindex:'index',resolveCollisions:'collision',spawnFood:'food',ai:'ai',activate:'abilities',activateNuke:'abilities',stepProjectiles:'abilities',stepNuke:'abilities',updateSlows:'abilities',updateRespawns:'respawn',eliminate:'respawn'};
  for(const [name,stage] of Object.entries(methods)){const target=arena as unknown as Record<string,Function>;const original=target[name];const own=Object.hasOwn(target,name),p=this;
   target[name]=function(this:Arena,...args:unknown[]){if(!p.enabled)return original.apply(this,args);const tick=name==='step';if(tick)p.tickValues.fill(0);p.enter(stage);try{return original.apply(this,args);}finally{p.leave();if(tick)p.endTick();}};
   this.restore.push(()=>{if(own)target[name]=original;else delete target[name];});
  }
 }
 detach(){for(const restore of this.restore)restore();this.restore=[];if(this.arena)probes.delete(this.arena);this.arena=undefined;this.stack=[];}
 enter(stage:SimulationStage){if(this.enabled)this.stack.push({stage:SIM_STAGES.indexOf(stage),start:performance.now(),child:0});}
 leave(){if(!this.enabled)return;const entry=this.stack.pop()!;const total=performance.now()-entry.start,cost=total-entry.child;this.frame[entry.stage]+=cost;if(this.stack.length){this.stack[this.stack.length-1].child+=total;this.tickValues[entry.stage]+=cost;}else if(entry.stage===0)this.tickValues[entry.stage]+=cost;}
 private endTick(){const offset=this.tickCursor*(SIM_STAGES.length+1);let total=0;for(let i=0;i<SIM_STAGES.length;i++){this.ticks[offset+1+i]=this.tickValues[i];total+=this.tickValues[i];}this.ticks[offset]=total;this.tickCursor=(this.tickCursor+1)%8192;this.tickCount=Math.min(8192,this.tickCount+1);this.frameTicks++;}
 beginFrame(){if(!this.enabled)return;this.frame.fill(0);this.frameTicks=0;this.events=0;this.substeps=0;}
 endFrame(){if(!this.enabled)return;const offset=this.frameCursor*(SIM_STAGES.length+5);this.frames[offset]=this.frameTicks;this.frames[offset+1]=this.backlogMs;this.frames[offset+2]=this.events;this.frames[offset+3]=this.substeps;this.frames[offset+4]=0;for(let i=0;i<SIM_STAGES.length;i++)this.frames[offset+5+i]=this.frame[i];this.frameCursor=(this.frameCursor+1)%8192;this.frameCount=Math.min(8192,this.frameCount+1);}
 reset(){this.tickCursor=this.tickCount=this.frameCursor=this.frameCount=0;this.stack=[];this.frame.fill(0);this.tickValues.fill(0);}
 snapshot(){const column=(data:Float64Array,width:number,count:number,col:number)=>Array.from({length:count},(_,i)=>data[i*width+col]);const tw=SIM_STAGES.length+1,fw=SIM_STAGES.length+5;
  const frequency:Record<string,number>={};for(const value of column(this.frames,fw,this.frameCount,0))frequency[value]=(frequency[value]??0)+1;
  return {enabled:this.enabled,tickCpuMs:stats(column(this.ticks,tw,this.tickCount,0)),perTick:Object.fromEntries(SIM_STAGES.slice(0,8).map((s,i)=>[s,stats(column(this.ticks,tw,this.tickCount,i+1))])),perFrame:Object.fromEntries(SIM_STAGES.map((s,i)=>[s,stats(column(this.frames,fw,this.frameCount,i+5))])),ticksPerFrame:frequency,backlogMs:stats(column(this.frames,fw,this.frameCount,1)),eventCount:stats(column(this.frames,fw,this.frameCount,2)),forcedSubsteps:stats(column(this.frames,fw,this.frameCount,3))};
 }
}
