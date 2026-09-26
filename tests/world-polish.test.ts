import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WorldBuilder } from "../src/worlds/builder.ts";
import { shibuya } from "../src/worlds/shibuya.ts";
import { tournament } from "../src/worlds/tournament.ts";
import { harbor } from "../src/worlds/harbor.ts";
import { RADIUS } from "../src/simulation.ts";

test("Shibuya streetlights remain outside the collision arena",()=>{
  const b=new WorldBuilder("mobile");shibuya(b);b.finish();
  const lamps=b.landmarks.filter(g=>g.name.startsWith("street-light-"));
  assert.equal(lamps.length,12);
  for(const lamp of lamps){
    const bounds=new THREE.Box3().setFromObject(lamp);
    assert.ok(Math.hypot(Math.max(bounds.min.x,Math.min(0,bounds.max.x)),Math.max(bounds.min.z,Math.min(0,bounds.max.z)))>RADIUS+6);
  }
  b.dispose();
});

test("Tournament concourses form complete flat perimeter rings",()=>{
  for(const profile of ["desktop","mobile"] as const){
    const b=new WorldBuilder(profile);tournament(b);
    const rings=b.group.children.filter(o=>o.name.startsWith("stadium-concourse-")) as THREE.Mesh[];
    assert.equal(rings.length,3);
    for(const ring of rings){
      const position=ring.geometry.attributes.position;
      ring.updateMatrixWorld();
      for(let i=0;i<position.count;i++){
        const point=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(ring.matrixWorld);
        assert.ok(Number.isFinite(point.x+point.y+point.z));
        assert.ok(Math.hypot(point.x,point.z)>RADIUS+3);
      }
    }
    b.finish();b.dispose();
  }
});

test("Tournament edging is entirely outside the playable rim",()=>{
  const b=new WorldBuilder("mobile");tournament(b);
  const edging=b.group.getObjectByName("arena-edging") as THREE.Mesh;
  assert.ok(edging);
  edging.updateMatrixWorld();
  const positions=edging.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const point=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(edging.matrixWorld);
    assert.ok(Math.hypot(point.x,point.z)>RADIUS+.9);
  }
  b.finish();b.dispose();
});

test("Harbor piers touch land and extend into the sea without blocking play",()=>{
  for(const profile of ["desktop","mobile"] as const){
    const b=new WorldBuilder(profile);harbor(b);b.finish();
    const piers=b.landmarks.filter(g=>g.name.startsWith("pier-"));
    assert.equal(piers.length,2);
    for(const pier of piers){
      const bounds=new THREE.Box3().setFromObject(pier);
      assert.ok(bounds.min.z<0 && bounds.max.z>140);
      assert.ok(Math.min(Math.abs(bounds.min.x),Math.abs(bounds.max.x))>RADIUS+6);
    }
    b.dispose();
  }
});
