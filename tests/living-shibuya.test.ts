import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {CityKitCache,PomuUltimateCache,cityKitAssets,pomuUltimateAssets,validateCityKit,validatePomuUltimate,assetResources,CITY_FAMILIES} from '../src/living-assets';
import {buildEnvironment} from '../src/environments';
import {WorldBuilder} from '../src/worlds/builder';
import {PROFILES,type DetailProfile} from '../src/worlds/types';
import {SkybreakerCinematic,gear5Expression} from '../src/skybreaker';
import {Arena,STEP,RADIUS} from '../src/simulation';
import {UltimateVisualClock} from '../src/ultimate-visual';
import {createTransformedHead,createTransformedHeadOutline} from '../src/models';
import {selectKitsuProfile} from '../src/kitsu-head';

async function parse(kind:'city'|'pomu',profile:DetailProfile){
  const path=kind==='city'?`shibuya/city-kit-${profile}.glb`:`pomu/pomu-ultimate-${profile}.glb`;
  const bytes=await readFile(new URL('../public/assets/'+path,import.meta.url));return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const city=(p:DetailProfile)=>parse('city',p),pomu=(p:DetailProfile)=>parse('pomu',p);
const ready=Promise.all((['desktop','mobile'] as const).flatMap(p=>[cityKitAssets.preload(p,city),pomuUltimateAssets.preload(p,pomu)])).then(r=>assert.ok(r.every(Boolean)));
const frame={time:2,dt:1/60,camera:{x:0,y:60,z:30},focus:{x:0,z:0},mode:'game' as const,paused:false,reducedMotion:false};
for(const profile of ['desktop','mobile'] as const)test(`${profile}: actual city and Gear 5 exports have valid orientation, finite geometry, bounds and budgets`,async()=>{
  const c=await city(profile),p=await pomu(profile);assert.equal(validateCityKit(c,profile).families,6);
  const stats=validatePomuUltimate(p,profile);assert.equal(stats.headTriangles,profile==='desktop'?5644:3812);assert.ok(stats.fistTriangles<(profile==='desktop'?3000:1800));
  const hand=p.getObjectByName(`PomuHaki_Hand_${profile}`) as THREE.Mesh,positions=hand.geometry.attributes.position,idx=hand.geometry.index!,a=new THREE.Vector3(),b=new THREE.Vector3(),v=new THREE.Vector3(),cross=new THREE.Vector3();let volume=0;
  for(let i=0;i<idx.count;i+=3){a.fromBufferAttribute(positions,idx.getX(i));b.fromBufferAttribute(positions,idx.getX(i+1));v.fromBufferAttribute(positions,idx.getX(i+2));volume+=a.dot(cross.crossVectors(b,v))/6;}assert.ok(volume>.1,'closed Haki skin faces outward');
});
test('selected profiles load once, immutable meshes are shared and expression pivots are independent',async()=>{
  const calls:string[]=[],cache=new PomuUltimateCache(p=>{calls.push(p);return pomu(p);});
  assert.deepEqual(await Promise.all([cache.preload('mobile'),cache.preload('mobile')]),[true,true]);assert.deepEqual(calls,['mobile']);assert.equal(cache.head('desktop'),undefined);
  const a=cache.head('mobile')!,b=cache.head('mobile')!,eyesA=a.getObjectByName('eyes')!,eyesB=b.getObjectByName('eyes')!;
  a.traverse(o=>{if(o instanceof THREE.Mesh){const peer=b.getObjectByName(o.name) as THREE.Mesh;assert.equal(o.geometry,peer.geometry);assert.equal(o.material,peer.material);}});
  eyesA.scale.y=.05;eyesA.position.z=.14;assert.equal(eyesB.scale.y,1);assert.equal(Math.abs(eyesB.position.z),0);
  const fa=cache.fist('mobile')!,fb=cache.fist('mobile')!;fa.rotation.x=1;assert.equal(Math.abs(fb.rotation.x),0);
  assert.equal(((fa.getObjectByName('PomuHaki_Hand_mobile') as THREE.Mesh).material as THREE.Material).side,THREE.FrontSide);
  const outline=cache.outline('mobile')!,resources=assetResources(a),fistResources=assetResources(fa),counts=new Map<object,number>();
  const owned=new Set([...resources.geometries,...resources.materials,...fistResources.geometries,...fistResources.materials,outline.geometry]);
  for(const r of owned)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)??0)+1));a.removeFromParent();fa.removeFromParent();assert.equal(counts.size,0);
  await cache.preload('desktop');await cache.preload('mobile');assert.deepEqual(calls,['mobile','desktop']);cache.dispose();cache.dispose();for(const r of owned)assert.equal(counts.get(r),1);
});
test('failed, invalid and late profile loads preserve fallback and dispose owned resources exactly once',async()=>{
  let calls=0;const failed=new CityKitCache(async()=>{calls++;throw Error('offline fixture');});assert.equal(await failed.preload('mobile'),false);assert.equal(await failed.preload('mobile'),false);assert.equal(calls,1);assert.equal(failed.family('mobile','Shop'),undefined);failed.dispose();
  const invalid=await pomu('mobile'),mesh=invalid.getObjectByName('PomuGear5_Skin_mobile') as THREE.Mesh;mesh.geometry.attributes.normal.setX(0,NaN);let disposed=0;mesh.geometry.addEventListener('dispose',()=>disposed++);
  const broken=new PomuUltimateCache(async()=>invalid);assert.equal(await broken.preload('mobile'),false);broken.dispose();assert.equal(disposed,1);
  let resolve!:(source:THREE.Group)=>void;const late=new CityKitCache(()=>new Promise(r=>resolve=r)),pending=late.preload('desktop');late.dispose();const source=await city('desktop'),g=(source.getObjectByName('City_Rounded_Stone_desktop') as THREE.Mesh).geometry;let count=0;g.addEventListener('dispose',()=>count++);resolve(source);assert.equal(await pending,false);late.dispose();assert.equal(count,1);
});
for(const profile of ['desktop','mobile'] as const)test(`${profile}: imported city keeps clearance, population, culling budgets and cache ownership over map rebuilds`,async()=>{
  await ready;const source=cityKitAssets.family(profile,'Rounded')!,shared=assetResources(source),counts=new Map<object,number>();
  for(const g of shared.geometries)g.addEventListener('dispose',()=>counts.set(g,(counts.get(g)??0)+1));
  let signature='';for(let i=0;i<3;i++){const env=buildEnvironment('shibuya',profile),stats=env.stats;if(signature)assert.equal(JSON.stringify(stats),signature);signature=JSON.stringify(stats);
    assert.ok(stats.drawCalls<=PROFILES[profile].maxCalls,JSON.stringify(stats));assert.ok(stats.triangles<=PROFILES[profile].maxTriangles);assert.ok(stats.materials<=32);assert.equal(stats.actors,profile==='desktop'?72:24);
    assert.equal(new Set(env.landmarks.filter(g=>g.name.startsWith('city-front')).map(g=>g.userData.family)).size,5);
    for(const g of env.landmarks){const b=g.userData.bounds;assert.ok(Math.hypot(Math.max(b.min[0],Math.min(0,b.max[0])),Math.max(b.min[2],Math.min(0,b.max[2])))>=RADIUS+6);}
    const umbrellas=env.group.getObjectByName('shibuya-umbrellas') as THREE.InstancedMesh;assert.equal(umbrellas.count,profile==='desktop'?64:20);
    env.update(frame);const snapshot=Array.from(umbrellas.instanceMatrix.array);env.update({...frame,time:9,paused:true});assert.deepEqual(Array.from(umbrellas.instanceMatrix.array),snapshot);
    env.dispose();env.dispose();assert.equal(counts.size,0);
  }
});
test('floor, paint and wet decals share cinematic-time deformation, reset on expiry and retain static vertex buffers',()=>{
  const b=new WorldBuilder('mobile');const floor=b.surfaceMaterial('wetAsphalt'),paint=b.flat('#fff',0,0,5,10),vertices=Array.from(paint.geometry.attributes.position.array),shader=()=>({uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <map_fragment>'});
  const f=shader(),p=shader();floor.onBeforeCompile(f as never,{} as never);(paint.material as THREE.Material).onBeforeCompile(p as never,{} as never);
  assert.match(f.vertexShader,/rubberHeight/);assert.match(p.vertexShader,/rubberHeight/);assert.equal(f.uniforms.cartoonTime,p.uniforms.cartoonTime);assert.equal(f.uniforms.cartoonIntensity,p.uniforms.cartoonIntensity);
  b.update({...frame,time:99,ultimate:{kind:'skybreaker',time:3.4,origin:{x:0,z:0},impact:{x:20,z:10}}});assert.equal(f.uniforms.cartoonTime.value,3.4);assert.equal(f.uniforms.cartoonIntensity.value,1);assert.deepEqual(Array.from(paint.geometry.attributes.position.array),vertices);
  b.update({...frame,reducedMotion:true});assert.equal(f.uniforms.cartoonIntensity.value,0);b.clearPresentation();assert.equal(f.uniforms.cartoonTime.value,0);b.dispose();
});
test('Gear 5 retains the synchronous factory, .12 mount and shader arm without per-frame geometry writes',async()=>{
  await ready;selectKitsuProfile('mobile');const a=createTransformedHead('cloud'),b=createTransformedHead('cloud'),outline=createTransformedHeadOutline('cloud');assert.equal(a.userData.gear5,true);assert.ok(outline instanceof THREE.Mesh);assert.notEqual(a.getObjectByName('eyes'),b.getObjectByName('eyes'));
  const arena=new Arena('cloud',()=>.5,0,0),fx=new SkybreakerCinematic(new THREE.Scene(),'mobile'),camera=new THREE.PerspectiveCamera(43,390/844,.1,600);arena.activateNuke(arena.player);
  const arm=fx.group.getObjectByName('skybreaker-elastic-arm') as THREE.Mesh,p=arm.geometry.attributes.position as THREE.BufferAttribute,n=arm.geometry.attributes.normal as THREE.BufferAttribute,before=Array.from(p.array),version=p.version,nVersion=n.version;
  for(const t of [0,.9,1.42,2.15,2.6,3.4,3.7,4.4,5.4]){arena.cinematic!.time=t;arena.cinematic!.detonated=t>=3.4;camera.position.set(0,50,28);camera.lookAt(0,0,0);const state=JSON.stringify(arena);fx.update(arena,camera,false);assert.equal(JSON.stringify(arena),state);assert.deepEqual(Array.from(p.array),before);assert.equal(p.version,version);assert.equal(n.version,nVersion);assert.ok(Number.isFinite(fx.staging.fistCenter.y));}
  fx.dispose();fx.dispose();selectKitsuProfile('desktop');
});
test('cartoon gags are bounded by their stages and reduced motion freezes expression',()=>{
  assert.ok(gear5Expression(1.42).eyePop>.9);assert.equal(gear5Expression(2.15).eyePop,0);assert.ok(gear5Expression(2.15).x>1.2);assert.ok(gear5Expression(4.58).y<.8);assert.deepEqual(gear5Expression(5.6),{x:1,y:1,bounce:0,eyePop:0});assert.deepEqual(gear5Expression(1.42,true),gear5Expression(4.58,true));
});
test('profile switches, boundary casts and lifecycle cleanup preserve authoritative simulation and eliminate at 3.4 only',async()=>{
  await ready;const a=new Arena('cloud',()=>.5,20,0),b=new Arena('cloud',()=>.5,20,0),fx=new SkybreakerCinematic(new THREE.Scene()),camera=new THREE.PerspectiveCamera(43,16/9,.1,600),clock=new UltimateVisualClock();a.player.x=b.player.x=RADIUS-6;a.activateNuke(a.player);b.activateNuke(b.player);
  for(let i=0;i<340;i++){a.step(STEP,{angle:0,boost:false,ability:false});b.step(STEP,{angle:0,boost:false,ability:false});if(i%30===0)fx.setProfile(i%60?'mobile':'desktop');camera.position.set(a.player.x,50,28);camera.lookAt(a.player.x,0,0);clock.update(a.cinematic,false,false,true,true);fx.update(a,camera,false,false,true,undefined,clock.frame);assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));}
  assert.equal(a.player.kills,20);assert.equal(a.cinematic,undefined);assert.equal(fx.staging.active,false);
  for(const state of ['death','respawn','restart','quit']){const arena=new Arena('cloud',()=>.5,0,0);arena.activateNuke(arena.player);arena.cinematic!.time=2;fx.update(arena,camera,false);if(state==='death')arena.player.alive=false;else if(state==='quit')arena.state='over';else arena.cinematic=undefined;fx.update(arena,camera,false);assert.equal(fx.group.visible,false);}fx.dispose();
});
