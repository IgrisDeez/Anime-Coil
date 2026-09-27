import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHead,createHeadOutline,createTransformedHead,createTransformedHeadOutline} from '../src/models.ts';
import {transformationCoilFinish,bodySkinAppearance} from '../src/coil-skins.ts';
import {cartoonInfluence,formVisualIntensity} from '../src/worlds/types.ts';
import {TransformationEffects} from '../src/transformation-effects.ts';
import {Arena} from '../src/simulation.ts';

test('transformed heads and outlines are cached separately from normal heads',()=>{
  for(const id of ['ember','cloud'] as const){
    const normal=createHead(id),form=createTransformedHead(id),again=createTransformedHead(id);
    assert.notEqual(form,normal);
    assert.notEqual(form,again);
    assert.equal((form.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh).geometry,(again.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh).geometry);
    const outline=createTransformedHeadOutline(id),second=createTransformedHeadOutline(id);
    assert.equal(outline.geometry,second.geometry);
    assert.notEqual(outline.geometry,createHeadOutline(id).geometry);
    const bounds=new THREE.Box3().setFromObject(form);
    const shell=new THREE.Box3().setFromObject(outline);
    assert.ok(shell.min.y<bounds.max.y && shell.max.y>bounds.min.y);
  }
});

test('form coil finishes are temporary definitions; equipped skins remain unchanged',()=>{
  const saved=bodySkinAppearance('spiritweave','#ed844e');
  const fox=transformationCoilFinish('nine-tail'),cloud=transformationCoilFinish('skybreaker');
  assert.notEqual(fox.base,cloud.base);
  assert.notEqual(fox.base,fox.accent);
  assert.equal(saved.texture,'spiritweave');
  assert.deepEqual(bodySkinAppearance('spiritweave','#ed844e'),saved);
});

test('cartoon influence stops at 24 units and form staging stays inside eight seconds',()=>{
  assert.equal(cartoonInfluence(0),1);
  assert.equal(cartoonInfluence(20),1);
  assert.ok(cartoonInfluence(22)>0 && cartoonInfluence(22)<1);
  assert.equal(cartoonInfluence(24),0);
  assert.equal(formVisualIntensity(0),0);
  assert.equal(formVisualIntensity(.25),1);
  assert.ok(Math.abs(formVisualIntensity(7.65)-1)<1e-12);
  assert.equal(formVisualIntensity(8),0);
});

test('form impact pool deduplicates victims, freezes in pause time, and clears on expiry',()=>{
  const arena=new Arena('ember',()=>.5,0,0),effects=new TransformationEffects('mobile');
  arena.activateNuke(arena.player);
  effects.ingest([{type:'transform-hit',id:0,targetId:4,ultimate:'nine-tail',x:1,z:2},{type:'transform-hit',id:0,targetId:4,ultimate:'nine-tail',x:1,z:2}],1);
  effects.update(arena,1,false);
  const stars=effects.group.children.find(child=>child instanceof THREE.InstancedMesh&&child.geometry.getAttribute('position').count===17) as THREE.InstancedMesh;
  assert.equal(stars.count,1);
  effects.update(arena,1,false);assert.equal(stars.count,1);
  effects.update(arena,1.5,false);assert.equal(stars.count,0);
  effects.clear();assert.equal(stars.count,0);
  effects.dispose();
});

test('many confirmed form contacts never exceed pooled geometry or draw budgets',()=>{
  for(const profile of ['desktop','mobile'] as const){
    const arena=new Arena('ember',()=>.5,0,0),effects=new TransformationEffects(profile);
    arena.activateNuke(arena.player);
    effects.ingest(Array.from({length:20},(_,index)=>({type:'transform-hit' as const,id:0,targetId:index+1,ultimate:'nine-tail' as const,x:index,z:0})),2);
    effects.update(arena,2,false);
    assert.ok(effects.group.children.length<=(profile==='mobile'?16:24));
    for(const child of effects.group.children)if(child instanceof THREE.InstancedMesh)assert.ok(child.count<=child.instanceMatrix.count);
    effects.clear();
    effects.dispose();
  }
});
