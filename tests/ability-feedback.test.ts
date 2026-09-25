import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena, CHARACTERS } from '../src/simulation.ts';
import { abilityFeedback } from '../src/ability-feedback.ts';
import { SkillEffects } from '../src/skill-effects.ts';

test('HUD distinguishes ready, charge, duration, cooldown and disabled states',()=>{
  const a=new Arena('nova',()=>.5,0,0);
  assert.equal(abilityFeedback(a.player,false,true).state,'ready');
  a.activate(a.player);
  assert.equal(abilityFeedback(a.player,false,true).state,'charging');
  assert.equal(abilityFeedback(a.player,false,true).disabled,true);
  a.player.charge=undefined;
  assert.equal(abilityFeedback(a.player,false,true).state,'cooldown');
  a.player.character='cloud'; a.player.active=1.5;
  const active=abilityFeedback(a.player,false,true);
  assert.equal(active.label,'Active 1.5s'); assert.equal(active.progress,.5);
  for(const [cinematic,playing] of [[true,true],[false,false]]) assert.equal(abilityFeedback(a.player,cinematic,playing).state,'disabled');
  a.player.alive=false; assert.equal(abilityFeedback(a.player,false,true).state,'disabled');
});

test('skill effect pools are bounded, freeze with pause, and never mutate gameplay',()=>{
  for(const c of CHARACTERS) {
    const a=new Arena(c.id,()=>.5,0,0), fx=new SkillEffects();
    a.activate(a.player);
    fx.ingest(Array.from({length:500},()=>a.events[0]));
    const before=JSON.stringify([a.snakes,a.events,a.projectiles]);
    fx.update(a,1,.1,false);
    const meshes=fx.group.children as THREE.InstancedMesh[];
    for(const m of meshes) assert.ok(m.count<=m.instanceMatrix.count);
    const normalCount=meshes.reduce((n,m)=>n+m.count,0);
    const matrices=meshes.map(m=>Array.from(m.instanceMatrix.array));
    fx.update(a,1,0,false);
    assert.deepEqual(meshes.map(m=>Array.from(m.instanceMatrix.array)),matrices);
    assert.equal(JSON.stringify([a.snakes,a.events,a.projectiles]),before);
    fx.update(a,2,.1,true);
    assert.ok(meshes.reduce((n,m)=>n+m.count,0)<normalCount);
    fx.update(undefined,3,.1,false);
    assert.equal(meshes.reduce((n,m)=>n+m.count,0),0);
    let disposals=0;
    for(const m of meshes) { m.geometry.addEventListener('dispose',()=>disposals++); (m.material as THREE.Material).addEventListener('dispose',()=>disposals++); }
    fx.dispose(); fx.dispose(); assert.equal(disposals,8);
  }
});

test('ultimate transitions clear pending E particles and projectiles',()=>{
  const a=new Arena('nova',()=>.5,0,0), fx=new SkillEffects();
  a.activate(a.player); fx.ingest(a.events); fx.update(a,0,0,false);
  a.activateNuke(a.player); fx.ingest(a.events); fx.update(a,0,0,false);
  assert.equal(fx.group.visible,false);
  assert.equal((fx.group.children as THREE.InstancedMesh[]).reduce((n,m)=>n+m.count,0),0);
  fx.dispose();
});
