import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, SpatialGrid, STEP, type CharacterId, type MatchMode } from '../src/simulation';
import { Arena as BaselineArena } from './fixtures/v167-simulation';
import { SimulationProfiler } from '../src/simulation-profiler';
function rng(){let state=812,calls=0;return {random:()=>{calls++;return (state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296;},snapshot:()=>[state,calls]};}
function snapshot(a:any){return JSON.stringify(Object.fromEntries(Object.keys(a).filter(k=>typeof a[k]!=='function').map(k=>[k,k==='bodyGrid'||k==='foodGrid'?[a[k].size,[...a[k].cells]]:a[k]])));}
export function compare(id:CharacterId,mode:MatchMode,ticks=720,setup?:(a:any)=>void){const x=rng(),y=rng(),a=new Arena(id,x.random,mode==='practice'?0:5,80,mode),b=new BaselineArena(id,y.random,mode==='practice'?0:5,80,mode);setup?.(a);setup?.(b);
 for(let i=0;i<ticks;i++){if(i===80){a.state=b.state='paused';}if(i===84){a.state=b.state='playing';}const input={angle:i*.009,boost:i%90<20,ability:i%100===0,nuke:i===250};a.step(STEP,input);b.step(STEP,input);assert.equal(snapshot(a),snapshot(b),id+'/'+mode+' tick '+i);assert.deepEqual(x.snapshot(),y.snapshot());}
}
for(const id of ['ember','nova','cloud','eclipse'] as const)for(const mode of ['endless','sprint','bounty','practice'] as const)test('exact v1.6.7 numeric, grid, RNG and event parity: '+id+'/'+mode,()=>compare(id,mode));
test('projectile/knockback substeps, simultaneous deaths and delayed respawns retain exact outcomes',()=>compare('nova','endless',650,a=>{for(const s of a.snakes)if(s.id>0){s.x=5+s.id*.3;s.z=0;s.body.forEach((p:any,i:number)=>{p.x=s.x-i*.72;p.z=0;});}a.reindex();}));
test('timed deadlines and ultimate completion preserve exact ordered events',()=>compare('eclipse','sprint',600,a=>{a.elapsed=178;a.activateNuke(a.player);}));
test('large starting coils preserve exact radii and following arithmetic',()=>compare('cloud','endless',180,a=>{for(const s of a.snakes){s.mass=360;while(s.body.length<360)s.body.push({...s.body.at(-1)});}a.reindex();}));
test('spatial query preserves x/z cell traversal and insertion order',()=>{const grid=new SpatialGrid<any>(5);const p=[{x:7,z:7,id:0},{x:-2,z:-2,id:1},{x:6,z:6,id:2},{x:-2,z:7,id:3}];p.forEach(x=>grid.add(x));assert.deepEqual(grid.query({x:0,z:0},20).map(x=>x.id),[1,3,0,2]);const retained=grid.query({x:0,z:0},20);grid.query({x:0,z:0},1);assert.equal(retained.length,4);grid.clear();assert.deepEqual(grid.query({x:0,z:0},20),[]);});
test('profiling is opt-in, pause-safe, bounded and detachable without state changes',()=>{const x=rng(),y=rng(),a=new Arena('nova',x.random,2,20),b=new Arena('nova',y.random,2,20),p=new SimulationProfiler();p.enabled=true;p.attach(a);for(let i=0;i<90;i++){p.beginFrame();const input={angle:i*.01,boost:false,ability:i===1};a.step(STEP,input);b.step(STEP,input);p.endFrame();assert.equal(snapshot(a),snapshot(b));}assert.equal(p.snapshot().tickCpuMs.samples,90);assert.deepEqual(p.snapshot().ticksPerFrame,{'1':90});p.detach();p.detach();assert.equal(Object.hasOwn(a,'step'),false);p.reset();assert.equal(p.snapshot().tickCpuMs.samples,0);});

test('internal index reuse independently suppresses food and body rebuilds, explicit refresh stays authoritative',()=>{
 const a=new Arena('ember',()=>.5,0,3);let body=0,food=0;const bc=a.bodyGrid.clear.bind(a.bodyGrid),fc=a.foodGrid.clear.bind(a.foodGrid);a.bodyGrid.clear=()=>{body++;bc();};a.foodGrid.clear=()=>{food++;fc();};
 a.reindex(true);assert.equal(body,0);assert.equal(food,0);a.player.body[2].x+=.25;a.reindex(true);assert.equal(body,1);assert.equal(food,0);
 a.player.mass++;a.reindex(true);assert.equal(body,2);a.food[0].x+=30;a.reindex();assert.equal(food,1);assert.equal(body,3);
 a.spawnFood({x:20,z:20});a.reindex(true);assert.equal(food,2);assert.equal(body,3);a.bodyGrid.clear();a.reindex(true);assert.equal(body,5);
});
test('equal-length food replacement and cap trimming cannot leave an internal index stale',()=>{
 const a=new Arena('ember',()=>.5,0,0),b=new BaselineArena('ember',()=>.5,0,0);for(let i=0;i<1600;i++){a.spawnFood({x:60,z:60});b.spawnFood({x:60,z:60});}a.reindex();b.reindex();a.spawnFood({x:40,z:40});b.spawnFood({x:40,z:40});a.food.splice(0,1);b.food.splice(0,1);a.reindex(true);b.reindex();assert.equal(snapshot(a),snapshot(b));
});
test('projectile merging preserves near-equal head/body contact order and dead-target exclusion',()=>{
 for(const epsilon of [0,1e-10,-1e-10])compare('nova','endless',80,a=>{const s=a.snakes[1];s.x=8;s.z=0;s.angle=0;s.botClock=100;s.target=0;s.body.forEach((p:any,i:number)=>{p.x=8+epsilon+i*.00001;p.z=0;});a.projectiles.push({id:200,ownerId:0,x:5,z:0,previous:{x:5,z:0},direction:0,remaining:24,radius:.65});a.reindex();});
});
test('nonstandard externally configured grid sizes retain the original projectile path',()=>compare('nova','endless',180,a=>{a.bodyGrid.size=6;a.reindex();a.activate(a.player);}));
test('identical recorded catch-up schedules preserve each tick and event batch',()=>{
 const x=rng(),y=rng(),a=new Arena('nova',x.random,4,40),b=new BaselineArena('nova',y.random,4,40);let accumulator=0,tick=0;const eventsA:string[]=[],eventsB:string[]=[];
 for(let frame=0;frame<300;frame++){const dt=Math.min([.004,.016,.032,.08,.13][frame%5],.1);accumulator+=dt;while(accumulator>=STEP){const input={angle:tick*.004,boost:tick%50<10,ability:tick%160===0};a.step(STEP,input);b.step(STEP,input);eventsA.push(JSON.stringify(a.events));eventsB.push(JSON.stringify(b.events));assert.equal(snapshot(a),snapshot(b));accumulator-=STEP;tick++;}}assert.deepEqual(eventsA,eventsB);assert.deepEqual(x.snapshot(),y.snapshot());
});
test('disabled detailed diagnostics retain normal profiler behavior without method wrappers',()=>{const a=new Arena('ember',()=>.5,0,0),p=new SimulationProfiler();p.enabled=false;p.attach(a);assert.equal(Object.hasOwn(a,'step'),false);p.beginFrame();a.step(STEP,{angle:0,boost:false,ability:false});p.endFrame();assert.equal(p.snapshot().tickCpuMs.samples,0);p.detach();});
test('profiling rings retain slow ticks and remain bounded over repeated resets',()=>{const a=new Arena('ember',()=>.5,0,0),p=new SimulationProfiler();p.enabled=true;p.attach(a);a.state='paused';for(let i=0;i<8300;i++){p.beginFrame();a.step(STEP,{angle:0,boost:false,ability:false});p.endFrame();}assert.equal(p.snapshot().tickCpuMs.samples,8192);assert.equal(p.snapshot().perFrame.body.samples,8192);p.reset();p.detach();assert.equal(p.snapshot().tickCpuMs.samples,0);});

test('full live benchmark population preserves complete state at every one of 6002 ticks',()=>{
 const x=rng(),y=rng(),a=new Arena('ember',x.random,20,850),b=new BaselineArena('ember',y.random,20,850);
 for(let tick=0;tick<6002;tick++){const input={angle:tick*.0035,boost:tick%360<70,ability:tick%240===0};a.step(STEP,input);b.step(STEP,input);assert.equal(snapshot(a),snapshot(b),'live tick '+tick);assert.deepEqual(x.snapshot(),y.snapshot());}
});
