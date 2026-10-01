import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { WorldBuilder } from "../src/worlds/builder.ts";
import { shibuya } from "../src/worlds/shibuya.ts";
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
