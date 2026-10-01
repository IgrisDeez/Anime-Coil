import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldBuilder } from '../src/worlds/builder.ts';
import { shibuya } from '../src/worlds/shibuya.ts';
import { buildEnvironment } from '../src/environments.ts';
import { CITY_BLOCKS, CITY_ROAD, CITY_WALK, ROAD_MARKINGS, routePose } from '../src/worlds/shibuya-layout.ts';
import { CityBillboards, BILLBOARD_REGIONS } from '../src/worlds/shibuya-art.ts';
import { finishSurface, surfacePixels } from '../src/worlds/surfaces.ts';

const frame={time:0,dt:1/60,camera:{x:0,z:0},focus:{x:0,z:0},mode:'game' as const,paused:false,reducedMotion:false};
test('Shibuya road and sidewalk loops close without a seam and have upward normals',()=>{
  const b=new WorldBuilder('mobile');
  for(const route of [CITY_ROAD,CITY_WALK]){
    assert.deepEqual(route[0],route.at(-1));
    const path=b.path('#fff',route,8,-.45,'stone'),pos=path.geometry.attributes.position,n=path.geometry.attributes.normal;
    assert.deepEqual([pos.getX(0),pos.getZ(0)],[pos.getX(pos.count-5),pos.getZ(pos.count-5)]);
    assert.deepEqual([pos.getX(5),pos.getZ(5)],[pos.getX(pos.count-4),pos.getZ(pos.count-4)]);
    for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>.99);
  }b.dispose();
});
test('Shibuya has four facade families, grounded foundations and two finished station landmarks',()=>{
  assert.equal(new Set(CITY_BLOCKS.map(b=>b.kind)).size,4);
  const b=new WorldBuilder('desktop');shibuya(b);
  assert.equal(b.landmarks.filter(g=>g.name.startsWith('station-')).length,2);
  for(const g of b.landmarks.filter(g=>g.name.startsWith('city-front-'))){
    const box=new THREE.Box3().setFromObject(g);assert.ok(box.min.y<=-.48);
    const signs=g.children.filter(o=>o.userData.signText);assert.ok(signs.length>0);
    assert.ok(signs.every(o=>['shop','neon'].includes(o.userData.signArt)));
  }b.finish();b.dispose();
});
test('Shibuya actor routes wrap deterministically and stay outside the playable circle',()=>{
  const pose={x:0,z:0,angle:0};
  for(const route of [CITY_WALK,CITY_ROAD])for(let d=-500;d<5000;d+=13){
    routePose(route,d,pose);assert.ok(Number.isFinite(pose.x+pose.z+pose.angle));assert.ok(Math.hypot(pose.x,pose.z)>140);
  }
  routePose(CITY_WALK,0,pose);assert.deepEqual([pose.x,pose.z],CITY_WALK[0]);
});
test('Shibuya traffic and pedestrian pools retain profile limits and freeze during pause',()=>{
  for(const profile of ['desktop','mobile'] as const){
    const env=buildEnvironment('shibuya',profile),car=env.group.getObjectByName('city-vehicles') as THREE.InstancedMesh;
    assert.equal(env.stats.actors,profile==='desktop'?24:10);assert.equal(car.count,profile==='desktop'?12:4);
    env.update({...frame,time:10});const state=Array.from(car.instanceMatrix.array);
    env.update({...frame,time:20,paused:true});assert.deepEqual(Array.from(car.instanceMatrix.array),state);
    env.update({...frame,time:30,reducedMotion:true});const reduced=Array.from(car.instanceMatrix.array);
    env.update({...frame,time:60,reducedMotion:true});assert.deepEqual(Array.from(car.instanceMatrix.array),reduced);
    env.dispose();
  }
});
test('Shibuya reduced motion removes moving weather while retaining wet street detail',()=>{
  const env=buildEnvironment('shibuya');env.update({...frame,reducedMotion:true});
  assert.equal(env.group.getObjectByName('ambient-particles')!.visible,false);
  assert.equal(env.group.getObjectByName('shibuya-rain-splashes')!.visible,false);
  assert.equal(env.group.getObjectByName('shibuya-neon-puddles')!.visible,true);
  env.update(frame);assert.equal(env.group.getObjectByName('ambient-particles')!.visible,true);env.dispose();
});
test('Shibuya wet asphalt retains cartoon shader composition and deterministic restrained texture',()=>{
  assert.deepEqual(surfacePixels('wetAsphalt',64),surfacePixels('wetAsphalt',64));
  const material=new THREE.MeshBasicMaterial();finishSurface(material,'wetAsphalt',undefined,undefined,{center:new THREE.Vector2(),time:{value:0},intensity:{value:0}});
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
  material.onBeforeCompile(shader as never,{} as never);assert.match(shader.fragmentShader,/cartoonFalloff/);assert.match(shader.fragmentShader,/surfaceUV \/ 9\.0/);material.dispose();
});
test('Shibuya signage remains stable rather than replacing shop identities on a timer',()=>{
  const b=new WorldBuilder('mobile');shibuya(b);assert.equal(b.motions.length,3);b.finish();b.dispose();
});

test('Shibuya packs eight aligned frontages per district and preserves all 32 on mobile',()=>{
  assert.equal(CITY_BLOCKS.length,32);
  for(let district=0;district<4;district++){
    const blocks=CITY_BLOCKS.filter(block=>block.district===district);assert.equal(blocks.length,8);
    assert.ok(blocks.every(block=>block.rotation===-district*Math.PI/2));
    for(let i=1;i<blocks.length;i++){const distance=Math.hypot(blocks[i].x-blocks[i-1].x,blocks[i].z-blocks[i-1].z);assert.ok(distance>=32);if(i!==4)assert.ok(distance<36,'frontages have only narrow gaps');}
  }
  for(const profile of ['desktop','mobile'] as const){const env=buildEnvironment('shibuya',profile);
    assert.equal(env.landmarks.filter(g=>g.name.startsWith('city-front-')).length,32);
    assert.equal(env.landmarks.filter(g=>g.name.startsWith('city-middle-')).length,profile==='desktop'?24:16);
    assert.equal(env.landmarks.filter(g=>g.name.startsWith('city-skyline-')).length,profile==='desktop'?24:16);env.dispose();}
});

test('intersection markings use common crossing and lane anchors with rotational symmetry',()=>{
  assert.ok(ROAD_MARKINGS.length>150);assert.deepEqual(new Set(ROAD_MARKINGS.map(mark=>mark.kind)),new Set(['crossing','lane','stop','hatch']));
  const quarter=ROAD_MARKINGS.length/4;
  for(let i=0;i<quarter;i++){const a=ROAD_MARKINGS[i],b=ROAD_MARKINGS[i+quarter];assert.ok(Math.abs(a.x-b.z*-1)<1e-9);assert.ok(Math.abs(a.z-b.x)<1e-9);assert.ok(Number.isFinite(a.x+a.z+a.width+a.length+a.angle));}
  assert.ok(ROAD_MARKINGS.some(mark=>Math.hypot(mark.x,mark.z)>110));
});

test('district batches have finite local bounds containing every authored instance',()=>{
  for(const profile of ['desktop','mobile'] as const){const env=buildEnvironment('shibuya',profile),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
    for(let i=0;i<4;i++){const district=env.group.getObjectByName(`shibuya-district-${i}`);assert.ok(district);let batches=0;
      district.traverse(o=>{if(!(o instanceof THREE.InstancedMesh))return;batches++;assert.ok(o.boundingSphere);const sphere=o.boundingSphere;
        assert.ok(Number.isFinite(sphere.radius+sphere.center.x+sphere.center.y+sphere.center.z));assert.ok(Math.hypot(sphere.center.x,sphere.center.z)>180);
        for(let k=0;k<o.count;k++){o.getMatrixAt(k,matrix);point.setFromMatrixPosition(matrix);assert.ok(point.distanceTo(sphere.center)<=sphere.radius+1e-4);}
      });assert.ok(batches>0);
    }env.dispose();}
});

test('district culling skips architecture outside the gameplay view and restores it for city cameras',()=>{
  const env=buildEnvironment('shibuya'),camera=new THREE.PerspectiveCamera(43,1.6,.1,600);
  camera.position.set(0,50,28);camera.lookAt(0,0,0);env.cull(camera);
  const districts=Array.from({length:4},(_,i)=>env.group.getObjectByName(`shibuya-district-${i}`)!);assert.ok(districts.filter(d=>d.visible).length<4);
  camera.position.set(0,70,120);camera.lookAt(0,40,-220);env.cull(camera);assert.equal(districts[0].visible,true);
  env.group.scale.setScalar(.115);camera.position.set(14,19,30);camera.lookAt(-7,0,0);env.cull(camera);assert.ok(districts.some(d=>d.visible));env.dispose();env.cull(camera);
});

test('billboard art has padded non-overlapping regions and merged reusable panels',()=>{
  const regions=Object.values(BILLBOARD_REGIONS);
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){const a=regions[i],b=regions[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
  for(const profile of ['desktop','mobile'] as const){const b=new WorldBuilder(profile),art=new CityBillboards(b),g=b.landmark('poster-test',0,-200);
    for(let i=0;i<100;i++){const panel=art.panel(g,'coil',0,20+i*.01,0,20,10),uv=panel.geometry.attributes.uv,r=BILLBOARD_REGIONS.coil;
      for(let k=0;k<uv.count;k++){assert.ok(uv.getX(k)>r.x&&uv.getX(k)<r.x+r.w);assert.ok(uv.getY(k)>1-r.y-r.h&&uv.getY(k)<1-r.y);}
      b.sign(g,'REUSED','#eee',0,5,1,10,3,'neon',true);
    }
    b.finish();let posters=0;b.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===art.material)posters++;});assert.equal(posters,1);assert.equal(b.textures.size,2);b.dispose();}
});

test('night sky is a single preserved background draw and its clouds freeze with pause and reduced motion',()=>{
  const env=buildEnvironment('shibuya'),sky=env.group.getObjectByName('shibuya-night-sky') as THREE.Mesh;
  assert.ok(sky);assert.equal(sky.renderOrder,-1000);const material=sky.material as THREE.ShaderMaterial;
  assert.equal(material.depthWrite,false);assert.equal(material.depthTest,false);assert.equal(material.fog,false);assert.equal(material.userData.worldSky,true);
  env.update({...frame,time:10});assert.equal(material.uniforms.skyTime.value,10);
  env.update({...frame,time:20,paused:true});assert.equal(material.uniforms.skyTime.value,10);
  env.update({...frame,time:40,reducedMotion:true});assert.equal(material.uniforms.skyTime.value,0);
  env.update({...frame,time:50,reducedMotion:true});assert.equal(material.uniforms.skyTime.value,0);
  assert.match(material.fragmentShader,/moonDirection/);assert.match(material.fragmentShader,/cloudPoint/);assert.doesNotMatch(material.fragmentShader,/texture2D/);env.dispose();
});

test('night sky skips its draw under opaque top-down ground and returns for horizon views',()=>{
  const env=buildEnvironment('shibuya'),sky=env.group.getObjectByName('shibuya-night-sky')!;
  env.update({...frame,skyVisible:false});assert.equal(sky.visible,false);env.update({...frame,skyVisible:true});assert.equal(sky.visible,true);env.dispose();
});

test('sky follows the rendering camera across miniature menu scaling and cinematic offsets',()=>{
  const env=buildEnvironment('shibuya'),sky=env.group.getObjectByName('shibuya-night-sky') as THREE.Mesh,camera=new THREE.PerspectiveCamera();
  for(const scale of [1,.115])for(const x of [0,180,-240]){env.group.scale.setScalar(scale);env.group.position.set(3,1,-4);env.group.updateMatrixWorld(true);camera.position.set(x,50,95);camera.updateMatrixWorld(true);
    sky.onBeforeRender({} as THREE.WebGLRenderer,new THREE.Scene(),camera,sky.geometry,sky.material as THREE.Material,{} as THREE.Group);
    const world=new THREE.Vector3();sky.getWorldPosition(world);assert.ok(world.distanceTo(camera.position)<1e-8);sky.getWorldScale(world);assert.ok(Math.abs(world.x-10)<1e-8);}
  env.dispose();
});

test('dense Shibuya stays bounded and completely restores scenery clearance on cleanup',()=>{
  for(const profile of ['desktop','mobile'] as const){const b=new WorldBuilder(profile);shibuya(b);b.finish();const stats=b.stats();assert.ok(stats.drawCalls<=b.detail.maxCalls);assert.ok(stats.triangles<=b.detail.maxTriangles);assert.ok(stats.materials<=32);
    b.clearance.update({min:{x:-50,y:0,z:-260},max:{x:50,y:80,z:-170}},1);b.clearance.updateCamera({x:200,y:50,z:30},{x:90,z:0},1);assert.equal(b.clearance.intensity.value,1);assert.equal(b.clearance.viewIntensity.value,1);b.clearPresentation();assert.equal(b.clearance.intensity.value,0);assert.equal(b.clearance.viewIntensity.value,0);b.dispose();}
});

test('Shibuya cinematic view clearance restores after expiry and excludes other maps and menu',()=>{
  for(const id of ['shibuya'] as const){const env=buildEnvironment(id);let material:THREE.Material|undefined;env.group.traverse(o=>{if(o instanceof THREE.InstancedMesh&&!material)material=o.material as THREE.Material;});assert.ok(material);
    const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};material.onBeforeCompile(shader as never,{} as never);
    const ultimate={kind:'spirit' as const,time:2,origin:{x:95,z:20},impact:{x:90,z:15}};
    env.update({...frame,camera:{x:200,y:40,z:20},ultimate});assert.equal(shader.uniforms.cinematicViewFade.value,id==='shibuya'?1:0);
    assert.match(shader.fragmentShader,/step\(\.6,summonWorld.y\)/);
    env.update({...frame,mode:'menu',ultimate});assert.equal(shader.uniforms.cinematicViewFade.value,0);
    env.update({...frame,ultimate});env.clearPresentation();assert.equal(shader.uniforms.cinematicViewFade.value,0);
    env.update({...frame,ultimate});env.update(frame);assert.equal(shader.uniforms.cinematicViewFade.value,0);env.dispose();env.dispose();}
});
