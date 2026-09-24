import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MAPS } from "../src/maps.ts";
import { buildEnvironment, type EnvironmentFrame } from "../src/environments.ts";
import { PROFILES, profileFor, reaction, VisualClock } from "../src/worlds/types.ts";
import { createHead } from "../src/models.ts";
import { RADIUS } from "../src/simulation.ts";

const frame:EnvironmentFrame={time:0,dt:1/60,camera:{x:0,y:50,z:30},focus:{x:0,z:0},mode:"game",paused:false,reducedMotion:false};
const shot=(kind:"spirit"|"purple",time=2):NonNullable<EnvironmentFrame["ultimate"]>=>({kind,time,origin:{x:90,z:10},impact:{x:95,z:12}});
function snapshot(group:THREE.Group) {
  const state:unknown[]=[];
  group.updateMatrixWorld(true);
  group.traverse(o=>{
    state.push(o.type,o.name,o.matrixWorld.elements);
    if(o instanceof THREE.InstancedMesh)state.push(Array.from(o.instanceMatrix.array),o.instanceColor&&Array.from(o.instanceColor.array));
    if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.LineSegments)state.push(Array.from(o.geometry.attributes.position.array));
  });
  return JSON.stringify(state);
}
test("visual clock stops during pause and hidden tabs; mobile choice handles touch and width",()=>{
  const c=new VisualClock();c.advance(.016,false,false);const t=c.time;
  c.advance(30,true,false);c.advance(30,false,true);assert.equal(c.time,t);
  c.advance(.016,false,false);assert.equal(c.time,.032);
  assert.equal(profileFor(1280),"desktop");assert.equal(profileFor(390),"mobile");assert.equal(profileFor(1024,true),"mobile");
});
test("ultimate lighting and attraction reset with absent cinematic and reduced motion",()=>{
  assert.ok(reaction(shot("spirit"),false).light<1);
  assert.ok(reaction(shot("spirit"),false).attraction>0);
  assert.ok(reaction(shot("purple"),false).tint>0);
  assert.equal(reaction(shot("purple"),false).attraction,0);
  assert.equal(reaction(shot("purple",3.4),false).pulse,1);
  for(const kind of ["spirit","purple"] as const)assert.deepEqual(reaction(shot(kind),true),reaction(undefined,false));
  assert.deepEqual(reaction(undefined,false),{tint:0,light:1,attraction:0,pulse:0});
});
for(const profile of ["desktop","mobile"] as const)for(const map of MAPS){
  test(`${map.id}/${profile}: deterministic, within budget and clear landmarks`,()=>{
    // Three.js UUIDs vary; authored transforms, colors and buffers must not.
    const a=buildEnvironment(map.id,profile),b=buildEnvironment(map.id,profile);
    assert.equal(snapshot(a.group),snapshot(b.group));
    assert.ok(a.stats.drawCalls<=PROFILES[profile].maxCalls);assert.ok(a.stats.triangles<=PROFILES[profile].maxTriangles);assert.ok(a.stats.materials<=32);
    for(const landmark of a.landmarks){const bounds=new THREE.Box3().setFromObject(landmark);assert.ok(Math.hypot(Math.max(bounds.min.x,Math.min(0,bounds.max.x)),Math.max(bounds.min.z,Math.min(0,bounds.max.z)))>RADIUS+5);}
    a.dispose();b.dispose();
  });
  test(`${map.id}/${profile}: bounded animation, paused snapshots, reduced motion and response reset`,()=>{
    const env=buildEnvironment(map.id,profile),fresh=buildEnvironment(map.id,profile);
    for(const time of [0,2,3.4,5.6,60,36000]){
      env.update({...frame,time,ultimate:shot("spirit",2)});
      env.group.traverse(o=>{if(o instanceof THREE.Points||o instanceof THREE.LineSegments){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));assert.ok(Math.abs(p.getX(i))<400&&Math.abs(p.getZ(i))<400&&Math.abs(p.getY(i))<100);}}});
    }
    const paused=snapshot(env.group);env.update({...frame,time:50000,paused:true});assert.equal(snapshot(env.group),paused);
    env.update({...frame,time:3,ultimate:shot("purple",3.4)});env.update(frame);fresh.update(frame);assert.equal(snapshot(env.group),snapshot(fresh.group));
    env.update({...frame,time:1,reducedMotion:true});const reduced=snapshot(env.group);env.update({...frame,time:90,reducedMotion:true});assert.equal(snapshot(env.group),reduced);
    env.dispose();fresh.dispose();
  });
  test(`${map.id}/${profile}: textures, particles, lines and instances disposed once; heads untouched`,()=>{
    const head=createHead("eclipse"),env=buildEnvironment(map.id,profile),resources=new Set<THREE.BufferGeometry|THREE.Material|THREE.Texture|THREE.InstancedMesh>();
    let sharedDisposals=0;head.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.addEventListener("dispose",()=>sharedDisposals++);(o.material as THREE.Material).addEventListener("dispose",()=>sharedDisposals++);}});
    env.group.traverse(o=>{
      if(o instanceof THREE.InstancedMesh)resources.add(o);
      if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.LineSegments){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);const map=(m as THREE.MeshBasicMaterial).map;if(map)resources.add(map);}}
    });
    const counts=new Map<object,number>();for(const resource of resources)(resource as THREE.EventDispatcher<{dispose:{}}>).addEventListener("dispose",()=>counts.set(resource,(counts.get(resource)??0)+1));
    env.dispose();env.dispose();env.update(frame);
    assert.equal(sharedDisposals,0);for(const r of resources)assert.equal(counts.get(r),1);
  });
}
