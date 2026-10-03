import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHead,createHeadOutline,createTransformedHead,createTransformedHeadOutline} from '../src/models.ts';
import {transformationCoilFinish,bodySkinAppearance} from '../src/coil-skins.ts';
import {cartoonInfluence} from '../src/worlds/types.ts';
import {SkybreakerCinematic} from '../src/skybreaker.ts';
import {Arena,NUKE_DURATION} from '../src/simulation.ts';
import {ultimateFrame,UltimateCueTracker} from '../src/ultimate-presentation.ts';

test('transformed heads and outlines are cached apart from normal heads',()=>{
  for(const id of ['ember','cloud'] as const){
    const normal=createHead(id),form=createTransformedHead(id),again=createTransformedHead(id);
    assert.notEqual(form,normal);assert.notEqual(form,again);
    assert.equal((form.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh).geometry,(again.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh).geometry);
    const outline=createTransformedHeadOutline(id),second=createTransformedHeadOutline(id);
    assert.equal(outline.geometry,second.geometry);
    assert.notEqual(outline.geometry,createHeadOutline(id).geometry);
    const bounds=new THREE.Box3().setFromObject(form),shell=new THREE.Box3().setFromObject(outline);
    assert.ok(shell.min.y<bounds.max.y&&shell.max.y>bounds.min.y);
  }
});

test('temporary pearl and gold finishes do not mutate an equipped cosmetic',()=>{
  const saved=bodySkinAppearance('spiritweave','#ed844e');
  const fox=transformationCoilFinish('nine-tail'),cloud=transformationCoilFinish('skybreaker');
  assert.notEqual(fox.base,cloud.base);assert.notEqual(fox.base,fox.accent);
  assert.deepEqual(bodySkinAppearance('spiritweave','#ed844e'),saved);
});

test('Skybreaker timeline is a 5.6-second cinematic with deduplicated cues',()=>{
  const tracker=new UltimateCueTracker();
  for(const [time,stage,cue] of [[0,'summon',undefined],[.9,'charge','windup'],[2.5,'launch','throw'],[3.4,'impact',undefined],[4.3,'recovery','release']] as const){
    assert.equal(ultimateFrame('skybreaker',time).stage,stage);
    assert.deepEqual(tracker.consume('skybreaker',time),cue?[cue]:[]);
    assert.deepEqual(tracker.consume('skybreaker',time),[]);
    const reduced=ultimateFrame('skybreaker',time,true);
    assert.equal(reduced.cameraWeight,0);assert.equal(reduced.flash,0);
  }
  assert.equal(cartoonInfluence(24),0);
  assert.equal(cartoonInfluence(0),1);
});

test('Skybreaker focal effect stays pooled, mobile-bounded, pause-stable, and disposes once',()=>{
  for(const profile of ['desktop','mobile'] as const){
    const scene=new THREE.Scene(),fx=new SkybreakerCinematic(scene,profile),arena=new Arena('cloud',()=>.5,0,0);
    const camera=new THREE.PerspectiveCamera(43,profile==='mobile'?390/844:16/9,.1,600);
    arena.activateNuke(arena.player);
    const draws=fx.group.children.filter(child=>child instanceof THREE.Mesh).length;
    assert.ok(draws<=(profile==='mobile'?16:24));
    for(const time of [.4,1.4,2.8,3.4,4.5,NUKE_DURATION]){
      arena.cinematic!.time=time;camera.position.set(0,48,27);camera.lookAt(0,0,0);
      fx.update(arena,camera,false);
      assert.equal(fx.group.visible,true);
      fx.group.traverse(child=>{if(child instanceof THREE.InstancedMesh)assert.ok(child.count<=child.instanceMatrix.count);});
    }
    camera.position.set(0,48,27);camera.lookAt(0,0,0);
    arena.cinematic!.time=1.4;fx.update(arena,camera,false,true);
    assert.equal(camera.position.y,48);
    const before=JSON.stringify(fx.group.toJSON());fx.update(arena,camera,false,true);
    assert.equal(JSON.stringify(fx.group.toJSON()),before);
    arena.cinematic=undefined;fx.update(arena,camera,false);assert.equal(fx.group.visible,false);
    fx.dispose();fx.dispose();assert.equal(scene.children.length,0);
  }
});

test('Skybreaker keeps its giant fist in frame on desktop and portrait viewports',()=>{
  for(const aspect of [16/9,390/844]){
    const scene=new THREE.Scene(),fx=new SkybreakerCinematic(scene,aspect<1?'mobile':'desktop');
    const arena=new Arena('cloud',()=>.5,0,0),camera=new THREE.PerspectiveCamera(43,aspect,.1,600);
    arena.activateNuke(arena.player);arena.cinematic!.time=2.2;
    camera.position.set(0,48,27);camera.lookAt(0,0,0);fx.update(arena,camera,false);
    fx.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const fist=fx.group.getObjectByName('skybreaker-fist')!;
    const center=new THREE.Box3().setFromObject(fist).getCenter(new THREE.Vector3()).project(camera);
    assert.ok(Number.isFinite(center.x)&&Math.abs(center.x)<.8);
    assert.ok(Number.isFinite(center.y)&&Math.abs(center.y)<.8);
    const fullSize=fist.scale.x;
    camera.position.set(0,48,27);camera.lookAt(0,0,0);fx.update(arena,camera,false,true);
    fx.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const quietCenter=new THREE.Box3().setFromObject(fist).getCenter(new THREE.Vector3()).project(camera);
    assert.ok(Math.abs(quietCenter.x)<.8&&Math.abs(quietCenter.y)<.8);
    assert.ok(fist.scale.x<fullSize);
    fx.dispose();
  }
});
