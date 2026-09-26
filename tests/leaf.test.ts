import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WorldBuilder } from "../src/worlds/builder.ts";
import { leaf, leafCanalRadius, LEAF_CANAL_BANK_HALF_WIDTH } from "../src/worlds/leaf.ts";
import { shop } from "../src/worlds/architecture.ts";
import { RADIUS } from "../src/simulation.ts";

test("Hidden Leaf canal is continuous, face-up, and outside the safe arena",()=>{
  for(const profile of ["desktop","mobile"] as const){
    const b=new WorldBuilder(profile);leaf(b);
    const water=b.group.getObjectByName("canal-water") as THREE.Mesh;
    assert.ok(water);
    const position=water.geometry.attributes.position;
    assert.equal(position.count,(profile==="mobile"?72:112)*6);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      assert.ok(Number.isFinite(x+y+z));
      assert.ok(Math.hypot(x,z)>RADIUS+6);
      assert.ok(water.geometry.attributes.normal.getY(i)>.9);
    }
    for(let i=0;i<=360;i++)assert.ok(leafCanalRadius(i*Math.PI/180)-LEAF_CANAL_BANK_HALF_WIDTH>RADIUS+6);
    assert.equal(b.landmarks.filter(g=>g.name.startsWith("canal-bridge-")).length,4);
    b.finish();b.dispose();
  }
});

test("village roofs fit rectangular shops at the wall eave",()=>{
  const b=new WorldBuilder("desktop"),building=b.landmark("roof-check",190,0);
  shop(b,building,"#d4b28c","#758573","LEAF MARKET",24,14,15);
  const roof=building.children.find(o=>o instanceof THREE.Mesh && o.geometry.type==="ExtrudeGeometry") as THREE.Mesh;
  assert.ok(roof);
  const bounds=new THREE.Box3().setFromObject(roof);
  assert.ok(Math.abs(bounds.min.y-14.06)<.01);
  assert.ok(Math.abs(bounds.max.y-17.26)<.01);
  assert.ok(Math.abs(bounds.max.x-bounds.min.x-27)<.01);
  assert.ok(Math.abs(bounds.max.z-bounds.min.z-18.5)<.01);
  b.finish();b.dispose();
});
