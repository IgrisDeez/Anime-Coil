import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';import {RosterHeadCache,ROSTER_NAMES,validateRosterHead,type RosterId} from '../src/roster-head';import type {DetailProfile} from '../src/worlds/types';
async function load(id:RosterId,profile:DetailProfile){const name=ROSTER_NAMES[id].toLowerCase(),b=await readFile(`assets/roster/candidates/${name}/${name}-head-${profile}.glb`);return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
test('all six actual roster exports satisfy schema, mount, eye, orientation, finite geometry and budgets',async()=>{
  for(const id of ['nova','cloud','eclipse'] as const)for(const profile of ['desktop','mobile'] as const){const head=await load(id,profile),stats=validateRosterHead(head,id,profile);assert.ok(stats.trianglesWithCoil<=(profile==='desktop'?6000:4000));assert.ok(stats.drawsWithCoil<=12);
    const eye=head.getObjectByName(ROSTER_NAMES[id]+'EyesPivot_'+profile)!;assert.equal(eye.children.length,id==='eclipse'?0:4);
  }
});
test('selected profiles load once; clones share immutable resources while blinking independently',async()=>{
  const requests:string[]=[];const cache=new RosterHeadCache(async(id,p)=>{requests.push(id+'|'+p);return load(id,p);});
  const owned=new Set<THREE.BufferGeometry|THREE.Material>(),events=new Map<THREE.BufferGeometry|THREE.Material,number>();
  function observe(head:THREE.Object3D){head.traverse(o=>{if(o instanceof THREE.Mesh)for(const resource of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(!owned.has(resource)){owned.add(resource);resource.addEventListener('dispose',()=>events.set(resource,(events.get(resource)??0)+1));}});}
  for(const id of ['nova','cloud','eclipse'] as const){await Promise.all([cache.preload(id,'mobile'),cache.preload(id,'mobile')]);assert.equal(cache.stats(id,'desktop'),undefined);
    const a=cache.create(id,'mobile')!,b=cache.create(id,'mobile')!,meshesA:THREE.Mesh[]=[],meshesB:THREE.Mesh[]=[];a.traverse(o=>{if(o instanceof THREE.Mesh)meshesA.push(o)});b.traverse(o=>{if(o instanceof THREE.Mesh)meshesB.push(o)});
    meshesA.forEach((m,i)=>{assert.equal(m.geometry,meshesB[i].geometry);assert.equal(m.material,meshesB[i].material);});
    const name=ROSTER_NAMES[id]+'EyesPivot_mobile';a.getObjectByName(name)!.scale.y=.05;assert.equal(b.getObjectByName(name)!.scale.y,1);
    observe(a);observe(cache.outline(id,'mobile')!);
    a.removeFromParent();assert.equal(events.size,0);await cache.preload(id,'desktop');observe(cache.create(id,'desktop')!);observe(cache.outline(id,'desktop')!);assert.equal(b.getObjectByName(name)!.scale.y,1);
  }
  assert.equal(requests.length,6);cache.dispose();cache.dispose();assert.equal(cache.create('nova','mobile'),undefined);
  assert.equal(events.size,owned.size);for(const resource of owned)assert.equal(events.get(resource),1);
});
test('failed and malformed loads preserve synchronous fallback, and teardown owns late results once',async()=>{
  const failed=new RosterHeadCache(async()=>{throw Error('offline');});assert.equal(await failed.preload('nova','desktop'),false);assert.equal(failed.create('nova','desktop'),undefined);failed.dispose();
  const malformed=await load('cloud','mobile');malformed.getObjectByName('PomuSculptMount_mobile')!.position.y=2;const bad=new RosterHeadCache(async()=>malformed);assert.equal(await bad.preload('cloud','mobile'),false);bad.dispose();
  let complete!:(head:THREE.Group)=>void;const late=new RosterHeadCache(()=>new Promise(r=>complete=r)),pending=late.preload('nova','desktop');late.dispose();const head=await load('nova','desktop');let events=0;head.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.addEventListener('dispose',()=>events++);});complete(head);assert.equal(await pending,false);assert.equal(events,9);late.dispose();assert.equal(events,9);
});
