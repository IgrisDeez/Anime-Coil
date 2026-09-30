import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Arena,bodyRadiusAt,serpentScale} from '../src/simulation.ts';
import {breathing} from '../src/presentation.ts';
import {dirtyRange,FoodColors,SnakeInstances,writeInstance} from '../src/instance-updates.ts';
import {FoodInstances,foodAnimation} from '../src/food-instances.ts';
import {FrameProfiler,distribution,GpuTimer} from '../src/frame-profiler.ts';
import {setClass,setStyle,setAttribute,setHidden,setDisabled} from '../src/dom-presentation.ts';
import {VisualCadence} from '../src/visual-cadence.ts';
import {buildEnvironment} from '../src/environments.ts';
import {SkillEffects} from '../src/skill-effects.ts';
const mesh=(n=360)=>new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshBasicMaterial(),n);
const buffers=()=>({body:mesh(),outline:mesh(),shadow:mesh(),marks:mesh()});
const clear=(v:ReturnType<typeof buffers>)=>{for(const m of Object.values(v))m.instanceMatrix.clearUpdateRanges();};
test('empty skill pools stay hidden and active pools upload only used matrices and changed colors',()=>{
  const effects=new SkillEffects(),arena=new Arena('eclipse',()=>.41,0,0);
  const pools=effects.group.children as THREE.InstancedMesh[];
  effects.update(arena,0,0,true);
  assert.ok(pools.every(m=>!m.visible&&!m.instanceMatrix.updateRanges.length));
  arena.player.active=2;effects.update(arena,1,0,true);
  const active=pools.filter(m=>m.visible);assert.ok(active.length>0);
  for(const m of active){
    assert.deepEqual(m.instanceMatrix.updateRanges,[{start:0,count:m.count*16}]);
    m.instanceMatrix.clearUpdateRanges();m.instanceColor!.clearUpdateRanges();
  }
  const versions=active.map(m=>m.instanceColor!.version);
  effects.update(arena,1,0,true);
  assert.deepEqual(active.map(m=>m.instanceColor!.version),versions);
  assert.ok(active.every(m=>!m.instanceColor!.updateRanges.length));
  effects.clear();assert.ok(pools.every(m=>!m.visible&&m.count===0));effects.dispose();effects.dispose();
});
test('dirty ranges stay bounded and preserve offscreen pending edits',()=>{
  const a=new THREE.BufferAttribute(new Float32Array(160),16);dirtyRange(a,32,16);dirtyRange(a,80,16);
  assert.deepEqual(a.updateRanges,[{start:32,count:64}]);for(let i=0;i<10000;i++)dirtyRange(a,48,16);
  assert.equal(a.updateRanges.length,1);a.clearUpdateRanges();dirtyRange(a,0,16);assert.deepEqual(a.updateRanges,[{start:0,count:16}]);
});
test('direct transforms match ordinary and flat legacy compositions',()=>{
  const a=new THREE.BufferAttribute(new Float32Array(32),16),o=new THREE.Object3D();
  for(const flat of [false,true]){
    o.position.set(13,.4,-7);o.scale.set(1.7,.8,1);o.rotation.set(flat?-Math.PI/2:0,0,0);o.updateMatrix();
    assert.equal(writeInstance(a,0,13,.4,-7,1.7,.8,1,flat),true);
    o.matrix.elements.forEach((v,i)=>assert.ok(Math.abs(a.array[i]-v)<1e-6));
    assert.equal(writeInstance(a,0,13,.4,-7,1.7,.8,1,flat),false);
  }
});
test('unchanged snake buffers skip writes; breathing invalidates no shadows',()=>{
  const s=new Arena('ember',()=>.41,0,0).player,v=buffers(),cache=new SnakeInstances();
  cache.update(v,s,1,true,false,1,undefined,1);clear(v);
  cache.update(v,s,1,true,false,1,undefined,1);assert.ok(Object.values(v).every(m=>!m.instanceMatrix.updateRanges.length));
  cache.update(v,s,2,false,false,1,undefined,1);assert.equal(v.shadow.instanceMatrix.updateRanges.length,0);assert.equal(v.body.instanceMatrix.updateRanges.length,1);
});
test('body height, ownership marks and frozen elastic outlines keep legacy geometry',()=>{
  const s=new Arena('cloud',()=>.41,0,0).player,v=buffers(),cache=new SnakeInstances();s.frozen=true;
  cache.update(v,s,2,false,true,.97,undefined,3);
  for(let i=1;i<s.body.length;i++){
    const a=v.body.instanceMatrix.array,o=(i-1)*16,r=bodyRadiusAt(i,s.body.length,s.mass);
    assert.ok(Math.abs(a[o]-r)<1e-6);assert.ok(Math.abs(a[o+13]-(.5+breathing(2-i*.15,s.id,s.boosting,false))*serpentScale(s.mass))<1e-6);
    assert.ok(Math.abs(v.outline.instanceMatrix.array[o]-r*1.08)<1e-6);
  }assert.ok(v.marks.count>0);
});
test('growth and new fixed-step positions refresh cached snake bounds',()=>{
  const s=new Arena('ember',()=>.41,0,0).player,v=buffers(),cache=new SnakeInstances();cache.update(v,s,0,true,false,1,undefined,0);
  const previous=v.body.boundingSphere!.clone();s.body[3].x+=40;s.mass+=2;cache.update(v,s,0,true,false,1,undefined,1);
  assert.notDeepEqual(v.body.boundingSphere,previous);
  for(const p of s.body)assert.ok(v.body.boundingSphere!.containsPoint(new THREE.Vector3(p.x,0,p.z)));
  assert.ok(Object.values(v).every(m=>m.frustumCulled));
});
test('food colors upload only changed slots, including reorders and replacements',()=>{
  const m=mesh(1700),cache=new FoodColors(),food=new Arena('ember',()=>.41,0,3).food,palette=[new THREE.Color('red'),new THREE.Color('green'),new THREE.Color('blue'),new THREE.Color('white'),new THREE.Color('orange')];
  food.forEach((f,i)=>f.color=i);cache.update(m,food,palette);m.instanceColor!.clearUpdateRanges();const version=m.instanceColor!.version;
  cache.update(m,food,palette);assert.equal(m.instanceColor!.version,version);
  [food[0],food[2]]=[food[2],food[0]];cache.update(m,food,palette);assert.deepEqual(m.instanceColor!.updateRanges,[{start:0,count:9}]);
  m.instanceColor!.clearUpdateRanges();food[1]={...food[1],id:999,color:4};cache.update(m,food,palette);assert.deepEqual(m.instanceColor!.updateRanges,[{start:3,count:3}]);
});
test('food shader advances without matrix or color uploads and refreshes replacements',()=>{
  const m=mesh(1700),cache=new FoodInstances(m),food=new Arena('ember',()=>.41,0,3).food;m.count=3;
  cache.update(m,food,0,false);m.instanceMatrix.clearUpdateRanges();cache.phase.clearUpdateRanges();const version=m.instanceMatrix.version;
  cache.update(m,food,9,false);assert.equal(m.instanceMatrix.version,version);assert.equal(cache.time.value,9);
  cache.update(m,food,9,true);assert.equal(cache.motion.value,0);assert.equal(m.instanceMatrix.version,version);
  food[1]={...food[1],id:999,x:33,value:4};cache.update(m,food,9,true);
  assert.deepEqual(m.instanceMatrix.updateRanges,[{start:16,count:16}]);assert.deepEqual(cache.phase.updateRanges,[{start:1,count:1}]);
  assert.ok(m.boundingSphere!.containsPoint(new THREE.Vector3(33,.25+.12,food[1].z)));
});
test('food bob and yaw retain the exact original animation formulas',()=>{
  for(const reduced of [false,true])for(const t of [0,.2,19,104])for(const id of [0,24,812,1700]){
    const a=foodAnimation(t,id,reduced);assert.equal(a.y,.25+(reduced?0:Math.sin(t*2+id)*.12));assert.equal(a.yaw,id+(reduced?0:t*.6));
  }
  const m=mesh(1700),cache=new FoodInstances(m),shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <project_vertex>'};
  (m.material as THREE.Material).onBeforeCompile(shader as never,{} as never);
  assert.ok(shader.vertexShader.includes('mvPosition.y+=sin'));assert.equal((shader.uniforms as any).foodTime,cache.time);
});
test('secondary animation gate freezes and immediately refreshes motion changes',()=>{
  const c=new VisualCadence();assert.equal(c.due(0,false),true);assert.equal(c.due(.01,false),false);assert.equal(c.due(1/30,false),true);
  assert.equal(c.due(1/30,false),false);assert.equal(c.due(1/30,true),true);assert.equal(c.due(30,true),false);assert.equal(c.due(30,false),true);c.clear();assert.equal(c.due(30,false),true);
});
test('DOM deduplication keeps externally changed values and focus-independent attributes correct',()=>{
  let writes=0;const values=new Map<string,string>(),classes=new Set<string>();
  const node:any={style:{getPropertyValue:(k:string)=>values.get(k)||'',setProperty:(k:string,v:string)=>{writes++;values.set(k,v);}},classList:{contains:(k:string)=>classes.has(k),toggle:(k:string,on:boolean)=>{writes++;on?classes.add(k):classes.delete(k);}},getAttribute:(k:string)=>values.get(k),setAttribute:(k:string,v:string)=>{writes++;values.set(k,v);},hidden:false,disabled:false};
  for(let i=0;i<200;i++){setStyle(node,'--ink','0');setClass(node,'dead',true);setAttribute(node,'aria-label','Ready');}assert.equal(writes,3);
  values.set('--ink','1');classes.clear();setStyle(node,'--ink','0');setClass(node,'dead',true);assert.equal(writes,5);
  setHidden(node,true);setDisabled(node,true);assert.equal(node.hidden,true);assert.equal(node.disabled,true);
});
test('profiler keeps slow frames, phase separation and bounded upload distributions',()=>{
  const p=new FrameProfiler();p.enabled=true;for(let i=0;i<8300;i++){p.beginFrame();p.rafMs=i%10?16:350;p.counts.uploadBytes=64;p.phase=i%2?'normal':'post-wipe-recovery';p.endFrame();}
  const s=p.snapshot();assert.equal(s.cpuMs.samples,8192);assert.equal(s.rafMs.p95,350);assert.equal(s.uploadBytesPerFrame.median,64);assert.equal(s.uploadBytes,64);assert.equal(s.phases.recovery.cpuMs.samples,4096);
  p.reset();assert.equal(p.snapshot().cpuMs.samples,0);assert.deepEqual(distribution([]),{median:0,p95:0,samples:0});
});
test('GPU diagnostics report unavailable timing and disposal remains idempotent',()=>{
  const g=new GpuTimer({getExtension:()=>null} as any);g.begin(true);g.end();assert.equal(g.snapshot().available,false);g.dispose();g.dispose();
});
test('GPU timer rejects disjoint results and caps outstanding queries',()=>{
  let disjoint=false,available=true,created=0;const live=new Set<object>();
  const gl:any={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension:()=>({TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2}),
    createQuery:()=>{const q={id:++created};live.add(q);return q;},beginQuery:()=>{},endQuery:()=>{},
    getParameter:()=>disjoint,getQueryParameter:(_:object,k:number)=>k===3?available:2e6,deleteQuery:(q:object)=>live.delete(q)};
  const timer=new GpuTimer(gl);for(let i=0;i<31;i++){timer.begin(true);timer.end();}assert.equal(timer.snapshot().ms.median,2);
  disjoint=true;timer.begin(true);timer.end();assert.equal(timer.snapshot().ms.samples,0);assert.equal(live.size,0);
  disjoint=false;available=false;for(let i=0;i<400;i++){timer.begin(true);timer.end();}assert.equal(live.size,8);timer.dispose();timer.dispose();assert.equal(live.size,0);
});
test('render caches do not alter advancing authoritative 60 Hz outcomes',()=>{
  const rng=()=>{let seed=812;return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);};
  for(const id of ['ember','nova','cloud','eclipse'] as const){
    const original=new Arena(id,rng(),3,40),rendered=new Arena(id,rng(),3,40),views=rendered.snakes.map(()=>buffers()),caches=rendered.snakes.map(()=>new SnakeInstances()),foodMesh=mesh(1700),foodCache=new FoodInstances(foodMesh);
    for(let step=0;step<240;step++){
      const input={angle:step*.012,boost:step%80<20,ability:step%160===0};original.step(1/60,input);rendered.step(1/60,input);
      if(step===80){original.activateNuke(original.player);rendered.activateNuke(rendered.player);}
      for(const s of rendered.snakes)if(s.alive)caches[s.id].update(views[s.id],s,step/60,s.frozen,false,1,undefined,step);
      foodMesh.count=rendered.food.length;foodCache.update(foodMesh,rendered.food,step/60,false);
    }assert.equal(JSON.stringify(rendered),JSON.stringify(original));
  }
});
test('Shibuya shader weather retains finite conservative bounds and uploads no moving vertices',()=>{
  const env=buildEnvironment('shibuya');const rain=env.group.getObjectByName('ambient-particles') as THREE.LineSegments;
  const version=(rain.geometry.attributes.position as THREE.BufferAttribute).version,frame={time:1,dt:1/60,camera:{x:0,z:0},focus:{x:20,z:30},mode:'game' as const,paused:false,reducedMotion:false};
  env.update(frame);env.update({...frame,time:2});assert.equal((rain.geometry.attributes.position as THREE.BufferAttribute).version,version);assert.equal(rain.geometry.boundingSphere!.center.x,20);assert.ok(rain.frustumCulled);
  env.update({...frame,paused:true,focus:{x:90,z:90}});assert.equal(rain.geometry.boundingSphere!.center.x,20);env.dispose();env.dispose();
});
