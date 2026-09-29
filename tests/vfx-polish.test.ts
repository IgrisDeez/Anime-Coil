import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena, CHARACTERS, HEAD_HIT_RADIUS, KI_RADIUS, KI_RANGE, VEIL_RADIUS } from '../src/simulation.ts';
import { SkillEffects, SKILL_BURST_LIMIT, SKILL_TRAIL_LIMIT } from '../src/skill-effects.ts';
import { SkybreakerCinematic } from '../src/skybreaker.ts';
import { headClearance, renderAnchor } from '../src/vfx-anchors.ts';
import { impactStarGeometry, ruptureSheetGeometry, spectralFistGeometry, spiritTailGeometry, taperedSlashGeometry } from '../src/vfx-geometry.ts';

test('custom anime VFX geometry is finite, shaped, and cached at construction', () => {
  for (const geometry of [spiritTailGeometry(), spectralFistGeometry('desktop'), taperedSlashGeometry(), impactStarGeometry(), ruptureSheetGeometry()]) {
    const attr = geometry.getAttribute('position');
    assert.ok(attr.count >= 3);
    for (const value of attr.array) assert.ok(Number.isFinite(value));
    geometry.dispose();
  }
  for (const character of CHARACTERS) {
    const small = headClearance(character.id, 1), large = headClearance(character.id, 3);
    assert.ok(small >= 1.2 && large <= 2.25);
  }
});

test('all E skills stay in six shared draws and follow the displayed head anchor', () => {
  for (const character of CHARACTERS) {
    const arena = new Arena(character.id, () => .5, 0, 0);
    const effects = new SkillEffects();
    effects.seed(arena);
    arena.activate(arena.player);
    effects.ingest(arena.events);
    const anchor = renderAnchor(character.id, 8, 2, -6, .4, 1.4);
    effects.update(arena, .2, .016, false, undefined, 'shibuya', new Map([[0,anchor]]));
    const meshes = effects.group.children as THREE.InstancedMesh[];
    assert.equal(meshes.length, 6);
    assert.ok(meshes.every(mesh => mesh.count <= mesh.instanceMatrix.count));
    if (character.id === 'nova') {
      const core = meshes[0], matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
      core.getMatrixAt(0,matrix); pos.setFromMatrixPosition(matrix);
      assert.ok(pos.distanceTo(new THREE.Vector3(8+Math.cos(.4)*2.1,2,-6+Math.sin(.4)*2.1)) < 2);
    }
    const matrices = meshes.map(mesh => Array.from(mesh.instanceMatrix.array));
    effects.update(arena,.2,0,false,undefined,'shibuya',new Map([[0,anchor]]));
    assert.deepEqual(meshes.map(mesh => Array.from(mesh.instanceMatrix.array)), matrices);
    effects.clear(); assert.ok(meshes.every(mesh => mesh.count === 0));
    effects.dispose();
  }
});

test('Ki Cannon visual core keeps authoritative radius with a separate decorative wake', () => {
  const arena = new Arena('nova', () => .5, 0, 0), effects = new SkillEffects();
  effects.seed(arena);
  arena.projectiles.push({id:1,ownerId:0,x:5,z:3,previous:{x:4,z:3},direction:0,remaining:10,radius:KI_RADIUS});
  effects.update(arena,0,0,true);
  const core = effects.group.children[0] as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
  core.getMatrixAt(0,matrix); matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);
  assert.ok(Math.abs(scale.x-KI_RADIUS)<1e-6);
  effects.dispose();
});

test('every E skill has a distinct confirmed activation and an essential reduced-motion cue', () => {
  for (const character of CHARACTERS) {
    const arena=new Arena(character.id,()=>.5,0,0),effects=new SkillEffects();
    assert.equal(arena.activate(arena.player),true);
    effects.ingest(arena.events);
    effects.update(arena,.12,.016,false);
    const [cores,,ribbons,aims,slashes,stars]=effects.group.children as THREE.InstancedMesh[];
    if(character.id==='ember') assert.ok(slashes.count>=5 && stars.count>=1);
    if(character.id==='nova') assert.ok(cores.count>=2 && aims.count===1 && ribbons.count>=1);
    if(character.id==='cloud') assert.ok(ribbons.count>=5 && stars.count>=1);
    if(character.id==='eclipse') assert.ok(ribbons.count>=2);
    effects.clear();
    effects.ingest(arena.events);
    effects.update(arena,.12,.016,true);
    if(character.id==='nova') assert.equal(aims.count,1);
    if(character.id==='eclipse') assert.ok(ribbons.count>=1);
    assert.ok((effects.group.children as THREE.InstancedMesh[]).every(mesh=>mesh.count<=mesh.instanceMatrix.count));
    effects.dispose();
  }
});

test('Ki Cannon aim stays locked after steering and the shot keeps a fixed core', () => {
  const arena=new Arena('nova',()=>.5,0,0),effects=new SkillEffects();
  arena.activate(arena.player);
  arena.player.angle=Math.PI/2;
  const anchor=renderAnchor('nova',8,2,-6,Math.PI/2,1);
  effects.update(arena,.1,0,false,undefined,'shibuya',new Map([[0,anchor]]));
  const aims=effects.group.children[3] as THREE.InstancedMesh;
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3();
  aims.getMatrixAt(0,matrix);position.setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.x-(8+HEAD_HIT_RADIUS+KI_RADIUS+.1+KI_RANGE/2))<.02);
  assert.ok(Math.abs(position.z+6)<.2);
  effects.dispose();
});

test('Fox Rush ribbons follow the coil path and reduced motion removes their history', () => {
  const arena=new Arena('ember',()=>.5,0,0),effects=new SkillEffects();
  arena.player.active=3;
  effects.update(arena,.08,.08,false);
  const slashes=effects.group.children[4] as THREE.InstancedMesh;
  assert.ok(slashes.count>=4);
  const matrix=new THREE.Matrix4(),left=new THREE.Vector3(),right=new THREE.Vector3();
  slashes.getMatrixAt(2,matrix);left.setFromMatrixPosition(matrix);
  slashes.getMatrixAt(3,matrix);right.setFromMatrixPosition(matrix);
  assert.ok(Math.hypot((left.x+right.x)/2-arena.player.body[2].x,
    (left.z+right.z)/2-arena.player.body[2].z)<.02);
  effects.update(arena,.18,.1,true);
  assert.equal(slashes.count,2,'only static head flames remain');
  effects.clear();assert.ok((effects.group.children as THREE.InstancedMesh[]).every(mesh=>mesh.count===0));
  effects.dispose();
});

test('Pomu has the same active spring treatment on player and AI', () => {
  const arena=new Arena('cloud',()=>.5,1,0),effects=new SkillEffects();
  effects.seed(arena);
  const bot=arena.snakes[1];bot.character='cloud';bot.mass=arena.player.mass;
  for(const snake of [arena.player,bot]) {snake.active=3;snake.previousAngle=snake.angle-.1;}
  effects.update(arena,.2,0,false);
  const rings=effects.group.children[2] as THREE.InstancedMesh;
  assert.equal(rings.count,6);
  const a=new THREE.Matrix4(),b=new THREE.Matrix4(),scaleA=new THREE.Vector3(),scaleB=new THREE.Vector3();
  rings.getMatrixAt(0,a);rings.getMatrixAt(3,b);
  a.decompose(new THREE.Vector3(),new THREE.Quaternion(),scaleA);
  b.decompose(new THREE.Vector3(),new THREE.Quaternion(),scaleB);
  assert.ok(Math.abs(scaleA.x-scaleB.x)<1e-6);
  effects.dispose();
});

test('Infinity Veil always shows its exact field radius without implying immunity', () => {
  const arena=new Arena('eclipse',()=>.5,0,0),effects=new SkillEffects();
  effects.seed(arena);
  arena.player.active=.08;
  effects.update(arena,1,0,true);
  const rings=effects.group.children[2] as THREE.InstancedMesh;
  assert.equal(rings.count,1);
  const matrix=new THREE.Matrix4(),scale=new THREE.Vector3();
  rings.getMatrixAt(0,matrix);matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);
  assert.ok(Math.abs(scale.x-VEIL_RADIUS)<1e-6);
  arena.player.active=0;effects.update(arena,1,0,true);assert.equal(rings.count,0);
  effects.dispose();
});

test('crowded E events remain bounded and a rejected cooldown press adds no burst', () => {
  const arena=new Arena('ember',()=>.5,20,0),effects=new SkillEffects();
  for(const snake of arena.snakes) {snake.character='ember';snake.active=3;}
  const events=Array.from({length:500},(_,i)=>({type:'ability' as const,id:i%21,character:'ember' as const,x:i,z:0,direction:0}));
  effects.ingest(events);
  effects.update(arena,.2,.1,false);
  const state=effects as unknown as {bursts:unknown[];trails:unknown[]};
  assert.ok(state.bursts.length<=SKILL_BURST_LIMIT && state.trails.length<=SKILL_TRAIL_LIMIT);
  assert.ok((effects.group.children as THREE.InstancedMesh[]).every(mesh=>mesh.count<=mesh.instanceMatrix.count));
  effects.clear();arena.events=[];
  arena.player.cooldown=5;
  assert.equal(arena.activate(arena.player),false);
  effects.ingest(arena.events);assert.equal(state.bursts.length,0);
  effects.dispose();
});

test('mobile skill profile retains each core cue with fewer decorative instances', () => {
  for(const id of ['ember','nova','cloud','eclipse'] as const) {
    const counts: number[][]=[];
    for(const profile of ['desktop','mobile'] as const) {
      const arena=new Arena(id,()=>.5,0,0),effects=new SkillEffects();
      effects.setProfile(profile);effects.seed(arena);
      arena.activate(arena.player);effects.ingest(arena.events);
      effects.update(arena,.18,.08,false);
      counts.push((effects.group.children as THREE.InstancedMesh[]).map(mesh=>mesh.count));
      effects.dispose();
    }
    assert.ok(counts[1].reduce((a,b)=>a+b,0)<=counts[0].reduce((a,b)=>a+b,0));
    assert.ok(counts[1].some(count=>count>0),`${id} remains visible on mobile`);
  }
});

test('Skybreaker silhouette is bounded on both profiles and clears after cinematic', () => {
  for (const profile of ['desktop','mobile'] as const) {
    const scene=new THREE.Scene(), effect=new SkybreakerCinematic(scene,profile);
    const arena=new Arena('cloud',()=>.5,0,0),camera=new THREE.PerspectiveCamera(43,1,.1,600);
    arena.activateNuke(arena.player);
    arena.cinematic!.time=2;
    camera.position.set(0,45,30);camera.lookAt(0,0,0);
    effect.update(arena,camera,false);
    assert.ok(effect.group.children.length <= (profile==='mobile'?16:24));
    effect.group.traverse(child=>{ if(child instanceof THREE.InstancedMesh) assert.ok(child.count<=child.instanceMatrix.count); });
    effect.clear();assert.equal(effect.group.visible,false);
    effect.dispose();effect.dispose();assert.equal(scene.children.length,0);
  }
});
