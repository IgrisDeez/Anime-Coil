import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {KuramaAssetCache,kuramaAssets,validateKurama,disposeKuramaInstance} from '../src/kurama-assets.ts';
import {KuramaReviewCinematic} from '../src/kurama-review.ts';
import {FoxCinematic} from '../src/fox-procedural-review.ts';
import {Arena,STEP,RADIUS} from '../src/simulation.ts';
import type {DetailProfile} from '../src/worlds/types.ts';
async function parse(profile:DetailProfile){const b=await readFile(new URL(`../assets/kurama/candidates/chibi-review/kurama-${profile}.glb`,import.meta.url));return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
// Local tests inject file loaders instead of relying on a browser-only URL.
const ready=Promise.all((['desktop','mobile'] as const).map(p=>kuramaAssets.preload(p,parse))).then(results=>{assert.deepEqual(results,[true,true]);});
for(const profile of ['desktop','mobile'] as const)test(`${profile} Kurama: schema, budgets, outward winding, bounds and finite geometry`,async()=>{
 const source=await parse(profile),stats=validateKurama(source,profile);assert.equal(stats.bodyDraws,4);assert.equal(stats.tailDraws,2);
 assert.ok(stats.modelTriangles<=(profile==='desktop'?20000:12000));
 source.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
  const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal'),idx=o.geometry.index;
  let volume=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cross=new THREE.Vector3();
  for(let i=0;i<(idx?.count??p.count);i+=3){a.fromBufferAttribute(p,idx?.getX(i)??i);b.fromBufferAttribute(p,idx?.getX(i+1)??i+1);c.fromBufferAttribute(p,idx?.getX(i+2)??i+2);volume+=a.dot(cross.crossVectors(b,c))/6;}
  if(o.userData.batch==='Body'||o.userData.batch==='Tail')assert.ok(volume>0,'closed skin/tail faces point outward');
  assert.ok(n.count>0);assert.ok(o.geometry.groups.length<=1);
 });
});
test('Kurama cache: selected profile, deduplicated loads, immutable geometry and independent fade/pose',async()=>{
 const calls:DetailProfile[]=[],cache=new KuramaAssetCache(async p=>{calls.push(p);return parse(p);});
 assert.equal(await cache.preload('mobile'),true);assert.equal(await cache.preload('mobile'),true);assert.deepEqual(calls,['mobile']);assert.equal(cache.create('desktop'),undefined);
 const a=cache.create('mobile')!,b=cache.create('mobile')!;assert.notEqual(a.beast,b.beast);assert.notEqual(a.head,b.head);assert.ok(a.beast instanceof THREE.Group&&a.head instanceof THREE.Group&&a.leftPaw instanceof THREE.Group&&a.rightPaw instanceof THREE.Group);
 for(let i=0;i<a.meshes.length;i++){assert.equal(a.meshes[i].geometry,b.meshes[i].geometry);assert.notEqual(a.meshes[i].material,b.meshes[i].material);}
 a.head.rotation.x=.19;(a.meshes[0].material as THREE.Material).opacity=.12;assert.ok(Math.abs(b.head.rotation.x)<1e-9);assert.equal((b.meshes[0].material as THREE.Material).opacity,1);
 let disposed=0;a.meshes[0].geometry.addEventListener('dispose',()=>disposed++);disposeKuramaInstance(a);disposeKuramaInstance(b);assert.equal(disposed,0);
 cache.dispose();cache.dispose();assert.equal(disposed,1);
});
test('failed/malformed/late Kurama loads fall back and do not leak imported resources',async()=>{
 const failed=new KuramaAssetCache(async()=>{throw new Error('fixture offline');});assert.equal(await failed.preload('desktop'),false);assert.equal(failed.create('desktop'),undefined);failed.dispose();
 const source=await parse('mobile'),mesh=source.getObjectByName('Kurama_Head_mobile') as THREE.Mesh;mesh.scale.x=2;let count=0;mesh.geometry.addEventListener('dispose',()=>count++);
 const invalid=new KuramaAssetCache(async()=>source);assert.equal(await invalid.preload('mobile'),false);invalid.dispose();assert.equal(count,1);
 let complete!:(s:THREE.Group)=>void;const late=new KuramaAssetCache(()=>new Promise(resolve=>complete=resolve));const pending=late.preload('desktop');late.dispose();const delayed=await parse('desktop');let disposed=0;(delayed.getObjectByName('Kurama_Body_desktop') as THREE.Mesh).geometry.addEventListener('dispose',()=>disposed++);complete(delayed);assert.equal(await pending,false);assert.equal(disposed,1);
});
test('candidate preserves mouth clearance, trajectory, all nine poses and camera fit on desktop/phone/boundary',async()=>{
 await ready;const fx=new KuramaReviewCinematic(new THREE.Scene()),camera=new THREE.PerspectiveCamera(43,16/9,.1,600);
 for(const edge of [false,true])for(const aspect of [16/9,390/844]){
  const arena=new Arena('ember',()=>.5,0,0);if(edge)arena.player.x=RADIUS-1;arena.activateNuke(arena.player);camera.aspect=aspect;camera.updateProjectionMatrix();
  for(const time of [.9,1.5,2.4,2.8,3.3,3.5,4.5]){
   arena.cinematic!.time=time;arena.cinematic!.detonated=time>=3.4;camera.position.set(arena.player.x,48,27);camera.lookAt(arena.player.x,0,0);fx.update(arena,camera,false);camera.updateMatrixWorld(true);
   const orb=fx.group.getObjectByName('fox-bomb-core') as THREE.Mesh;
   if(time<=2.4){const d=new THREE.Vector3().copy(fx.staging.bombCenter).sub(fx.staging.muzzle);assert.ok(Math.abs(d.length()-orb.scale.x-2.8)<1e-5);assert.ok(d.normalize().distanceTo(fx.staging.firingDirection)<1e-5);}
   assert.ok(orb.position.y>=orb.scale.x+.28-1e-8);
   if(time<=3.5){const bounds=fx.staging.summonBounds;for(let i=0;i<8;i++){const p=new THREE.Vector3(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).project(camera);assert.ok(Math.abs(p.x)<.98&&Math.abs(p.y)<.98);}}
   const tails=fx.group.getObjectByName('fox-nine-tails') as THREE.InstancedMesh;const poses=new Set<string>();for(let i=0;i<9;i++){const m=new THREE.Matrix4();tails.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite));poses.add(m.elements.join(','));}assert.equal(poses.size,9);
  }
 }
 fx.dispose();
});
test('profile swaps retain cinematic time, captured origin, articulated pose and shared resource ownership',async()=>{
 await ready;const fx=new KuramaReviewCinematic(new THREE.Scene()),arena=new Arena('ember',()=>.5,0,0),camera=new THREE.PerspectiveCamera(43,16/9,.1,600);arena.activateNuke(arena.player);arena.cinematic!.time=2.1;
 const draw=()=>{camera.position.set(0,48,27);camera.lookAt(0,0,0);fx.update(arena,camera,false);};draw();const pose=fx.group.getObjectByName('fox-head')!.rotation.clone(),staging=JSON.stringify(fx.staging),time=arena.cinematic!.time;
 let count=0;const geometry=(fx.group.getObjectByName('Kurama_Head_desktop') as THREE.Mesh).geometry;geometry.addEventListener('dispose',()=>count++);
 const before=JSON.parse(staging);
 for(const profile of ['mobile','desktop','mobile','desktop'] as const){fx.setProfile(profile);assert.equal(arena.cinematic!.time,time);assert.equal(fx.group.getObjectByName('fox-head')!.rotation.x,pose.x);draw();
  for(const key of ['casterPosition','casterFacing','summonOrigin','muzzle','bombCenter','firingDirection'] as const)assert.deepEqual(JSON.parse(JSON.stringify(fx.staging[key])),before[key]);
  assert.ok(new THREE.Vector3().copy(fx.staging.cameraFocus).distanceTo(before.cameraFocus)<.15,'small LOD bounds change does not cut the camera');
 }
 fx.clear();fx.dispose();fx.dispose();assert.equal(count,0,'instance teardown does not dispose the cache');
});
test('fade selects multisample coverage or a stable single-pass fallback for each owned material',async()=>{
 await ready;const fx=new KuramaReviewCinematic(new THREE.Scene());
 for(const samples of [4,0,4]){fx.setMultisampleFade(samples);let count=0;fx.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshToonMaterial){count++;assert.equal(o.material.alphaToCoverage,samples>0);assert.equal(o.material.alphaHash,samples===0);assert.equal(o.material.transparent,false);}});assert.equal(count,5);}
 fx.setProfile('mobile');const body=fx.group.getObjectByName('Kurama_Body_mobile') as THREE.Mesh;assert.equal((body.material as THREE.MeshToonMaterial).alphaToCoverage,true);fx.dispose();
});
test('baseline and candidate produce identical authoritative outcomes and clear all lifecycle/reduced effects',async()=>{
 await ready;const a=new Arena('ember',()=>.5,2,0),b=new Arena('ember',()=>.5,2,0),cameraA=new THREE.PerspectiveCamera(43,1,.1,600),cameraB=cameraA.clone(),base=new FoxCinematic(new THREE.Scene()),candidate=new KuramaReviewCinematic(new THREE.Scene());
 a.activateNuke(a.player);b.activateNuke(b.player);
 for(let i=0;i<370;i++){for(const arena of [a,b])arena.step(STEP,{angle:0,boost:false,ability:false});cameraA.position.set(0,48,27);cameraA.lookAt(0,0,0);cameraB.copy(cameraA);base.update(a,cameraA,false);candidate.update(b,cameraB,false);assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));}
 for(const state of ['death','respawn','restart','quit'] as const){const arena=new Arena('ember',()=>.5,0,0);arena.activateNuke(arena.player);arena.cinematic!.time=2.1;candidate.update(arena,cameraB,false,true,false);const pose=cameraB.quaternion.clone();candidate.update(arena,cameraB,false,true,false);assert.equal(cameraB.quaternion.angleTo(pose),0);if(state==='death')arena.player.alive=false;else if(state==='quit')arena.state='over';else arena.cinematic=undefined;candidate.update(arena,cameraB,false);assert.equal(candidate.staging.active,false);assert.equal(candidate.group.visible,false);}
 base.dispose();candidate.dispose();
});
