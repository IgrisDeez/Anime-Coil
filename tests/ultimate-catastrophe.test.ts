import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena, STEP, NUKE_BLAST } from '../src/simulation';
import { UltimateVisualClock, AFTERMATH } from '../src/ultimate-visual';
import { UltimateBlast, UltimateCameraPunch, blastCounts, blastReach, blastSeed } from '../src/ultimate-blast';

test('world, artwork and camera share the first authoritative kill frame, including skipped renders', () => {
  for (const id of ['ember','nova','eclipse','cloud'] as const) {
    let seed=812,calls=0;
    const rng=()=>{calls++;return (seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;};
    const arena=new Arena(id,rng,20,100),controlSeed=seed,clock=new UltimateVisualClock();
    arena.activateNuke(arena.player);const shot=arena.cinematic!,kind=shot.kind;
    const beforeKill={angle:0,boost:false,ability:false};
    while(shot.time<NUKE_BLAST-.03)arena.step(STEP,beforeKill);
    const reusable=clock.update(shot,false,false,true,true);
    assert.equal(reusable.detonated,false);assert.equal(reusable.keyframe,false);
    while(shot.time<NUKE_BLAST+.12)arena.step(STEP,beforeKill);
    assert.equal(arena.player.kills,20);const state=JSON.stringify(arena),randomCalls=calls;
    const frame=clock.update(shot,false,false,true,true);
    assert.equal(frame,reusable);assert.equal(frame.kind,kind);assert.equal(frame.phase,'keyframe');
    assert.equal(frame.keyframe,true);assert.equal(frame.detonated,true);
    const blast=new UltimateBlast();blast.update(frame,shot.impact.x,shot.impact.z,{x:0,y:10,z:0},'desktop');
    assert.equal(blast.group.visible,true);assert.equal(blast.diagnostics().batches[0].count,9);
    clock.update(shot,false,false,true,true);assert.equal(frame.keyframe,false);
    assert.equal(JSON.stringify(arena),state);assert.equal(calls,randomCalls);assert.ok(controlSeed!==0);
    blast.dispose();
  }
});

test('comfort flags, paused keyframes and camera-off work independently', () => {
  const arena=new Arena('eclipse',()=>.5,0,0);arena.activateNuke(arena.player);
  const shot=arena.cinematic!;shot.time=3.4;shot.detonated=true;const clock=new UltimateVisualClock(),punch=new UltimateCameraPunch();
  let f=clock.update(shot,false,false,true,false);assert.equal(f.keyframe,true);
  assert.equal(clock.update(shot,false,false,true,false).keyframe,true);
  f=clock.update(shot,false,true,true,true);assert.equal(f.keyframe,false);assert.equal(f.grayscale,0);assert.equal(f.cameraEnabled,true);
  const camera=new THREE.PerspectiveCamera(43,390/844,.1,600);camera.position.set(0,50,30);camera.lookAt(0,0,0);
  for(const motion of [false,true]){
    const position=camera.position.clone(),quaternion=camera.quaternion.clone(),fov=camera.fov;
    f=clock.update(shot,motion,false,false,true);punch.apply(camera,f);
    assert.ok(camera.position.equals(position));assert.ok(camera.quaternion.equals(quaternion));assert.equal(camera.fov,fov);
  }
  f=clock.update(shot,false,false,true,true);punch.apply(camera,f);assert.ok(Number.isFinite(camera.fov));assert.ok(camera.fov>=39);
  assert.deepEqual(blastCounts('mobile',true),{bursts:1,waves:1,streaks:0,fragments:0,sparks:8,smoke:4});
});

test('profiles reuse seeded events, stay in triangle budgets, and release four batches exactly once', () => {
  const scene=new THREE.Scene(),blast=new UltimateBlast(scene),clock=new UltimateVisualClock();
  const arena=new Arena('ember',()=>.5,0,0);arena.activateNuke(arena.player);const shot=arena.cinematic!;
  const resources=blast.group.children.map(o=>({geometry:(o as THREE.Mesh).geometry,material:(o as THREE.Mesh).material}));
  for(const kind of ['fox','spirit','purple','skybreaker'] as const){
    shot.kind=kind;
    for(const time of [2.15,3.4,3.52,3.8,4.4,4.8]){
      shot.time=time;shot.detonated=time>=3.4;
      const frame=clock.update(shot,false,false,true,true),state=JSON.stringify(arena);
      for(const profile of ['desktop','mobile','desktop'] as const){
        blast.update(frame,90,-15,{x:3,y:20,z:0},profile);
        const d=blast.diagnostics();assert.ok(d.reach>=RANGE);assert.equal(d.seed,blastSeed(kind,90,-15));
        assert.ok(d.batches.reduce((n,b)=>n+b.triangles,0)<=(profile==='desktop'?4000:2000));
        for(let i=0;i<resources.length;i++){
          const mesh=blast.group.children[i] as THREE.InstancedMesh;
          assert.equal(mesh.geometry,resources[i].geometry);assert.equal(mesh.material,resources[i].material);
          assert.ok(mesh.count<=mesh.instanceMatrix.count);
          for(const name of ['position','eventSeed','eventData'])assert.ok(Array.from(mesh.geometry.getAttribute(name).array).every(Number.isFinite));
        }
        assert.equal(JSON.stringify(arena),state);
      }
    }
    shot.time=Math.max(4.8,3.4+AFTERMATH[kind])+.02;const f=clock.update(shot,false,false,true,true);blast.update(f,90,-15,{x:0,y:0,z:0},'desktop');
    assert.equal(blast.group.visible,false);
  }
  assert.ok(blastReach(114,0)>(115+114));
  let geometries=0,materials=0;
  for(const r of resources){r.geometry.addEventListener('dispose',()=>geometries++);(r.material as THREE.Material).addEventListener('dispose',()=>materials++);}
  blast.clear();assert.equal(blast.diagnostics().batches.every(b=>b.count===0),true);
  blast.dispose();blast.dispose();assert.equal(geometries,4);assert.equal(materials,4);assert.equal(scene.children.length,0);
});
const RANGE=240;
