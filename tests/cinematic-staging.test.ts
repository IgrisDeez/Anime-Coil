import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Arena,RADIUS} from '../src/simulation.ts';
import {FoxCinematic} from '../src/fox.ts';
import {SpiritCinematic} from '../src/spirit.ts';
import {SkybreakerCinematic} from '../src/skybreaker.ts';
import {foxFlight} from '../src/cinematic-staging.ts';
import {SummonClearance} from '../src/worlds/summon-clearance.ts';
import {buildEnvironment} from '../src/environments.ts';
import {renderAnchor} from '../src/vfx-anchors.ts';
const camera=()=>{const c=new THREE.PerspectiveCamera(43,16/9,.1,600);c.position.set(0,48,27);c.lookAt(0,0,0);return c;};
test('fox stays strictly behind captured activation facing at center and every arena edge',()=>{
  const fx=new FoxCinematic(new THREE.Scene());
  for(const [x,z] of [[0,0],[90,25],[-100,0],[0,105]])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/3])for(const quiet of [false,true]){
    fx.clear();const a=new Arena('ember',()=>.5,0,0);a.player.x=x;a.player.z=z;a.player.angle=angle;a.activateNuke(a.player);a.cinematic!.time=2;
    fx.update(a,camera(),false,quiet);const origin=fx.staging.summonOrigin,distance=quiet?50:30;
    assert.ok(Math.abs(origin.x-(x-Math.cos(angle)*distance))<1e-9);assert.ok(Math.abs(origin.z-(z-Math.sin(angle)*distance))<1e-9);
    const frozen={...origin};a.player.x+=7;a.player.angle+=1;fx.update(a,camera(),false,quiet);assert.deepEqual({...fx.staging.summonOrigin},frozen);
    assert.equal(fx.staging.casterFacing,angle);
  }fx.dispose();
});
test('boundary-clamped fox flight exits forward and curves laterally without crossing the face',()=>{
  const start=new THREE.Vector3(0,25,8),end=new THREE.Vector3(0,.2,-16),out=new THREE.Vector3(),tangent=new THREE.Vector3();
  foxFlight(out,tangent,start,end,0,11.48);assert.ok(tangent.z>0);
  for(let i=0;i<=100;i++){foxFlight(out,tangent,start,end,i/100,11.48);assert.ok(out.y-11.48>=.28-1e-8);if(i>20&&i<80)assert.ok(out.x>14);}
  assert.ok(Math.abs(out.x-end.x)<1e-8&&Math.abs(out.z-end.z)<1e-8);
});
test('scenery clearance composes existing shaders, supports instancing and excludes low surfaces',()=>{
  const clearance=new SummonClearance(),material=new THREE.MeshBasicMaterial();
  material.onBeforeCompile=shader=>{shader.uniforms.original={value:3};};clearance.attach(material);
  const shader:any={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};
  material.onBeforeCompile(shader,null as any);
  assert.equal(shader.uniforms.original.value,3);assert.match(shader.vertexShader,/instanceMatrix\*summonPoint/);
  assert.match(shader.fragmentShader,/step\(.6,summonWorld.y\)/);assert.match(shader.fragmentShader,/clearanceDither/);
  clearance.update({min:{x:0,y:0,z:0},max:{x:40,y:30,z:20}},1);assert.equal(clearance.intensity.value,1);assert.equal(clearance.center.value.x,20);
  clearance.update();assert.equal(clearance.intensity.value,0);material.dispose();
});
test('map clearance restores even when a restart arrives while paused',()=>{
  for(const map of ['shibuya'] as const){
    const env=buildEnvironment(map,'mobile'),frame:any={time:1,dt:0,camera:{x:0,z:0},focus:{x:0,z:0},mode:'game',paused:false,reducedMotion:false,ultimate:{kind:'fox',time:1,origin:{x:100,z:0},impact:{x:97,z:0}},summonClearance:{min:{x:110,y:0,z:-25},max:{x:150,y:40,z:25}}};
    env.update(frame);let uniform:any;env.group.traverse(o=>{if(o instanceof THREE.Mesh&&!uniform){const shader:any={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>\n#include <opaque_fragment>\n#include <map_fragment>'};(o.material as THREE.Material).onBeforeCompile(shader,null as any);uniform=shader.uniforms.summonFade;}});
    assert.equal(uniform.value,1);env.update({...frame,paused:true,ultimate:undefined,summonClearance:undefined});assert.equal(uniform.value,0);env.dispose();
  }
});
for(const kind of ['spirit','skybreaker'] as const){
  const id=kind==='spirit'?'nova':'cloud';
  test(`${kind}: displayed anchor drives caster effects and repeated lifecycle clears pooled state`,()=>{
    const fx=kind==='spirit'?new SpiritCinematic(new THREE.Scene()):new SkybreakerCinematic(new THREE.Scene());
    for(let cycle=0;cycle<4;cycle++){
      const a=new Arena(id,()=>.5,0,0);a.activateNuke(a.player);a.cinematic!.time=2;
      const anchor=renderAnchor(id,8,3,12,.4,2);fx.update(a,camera(),false,false,false,anchor);
      assert.deepEqual({...fx.staging.casterPosition},{x:8,y:3,z:12});
      fx.group.updateMatrixWorld(true);const snapshot=JSON.stringify(fx.group.toJSON());a.state='paused';fx.update(a,camera(),false,false,false,anchor);fx.group.updateMatrixWorld(true);assert.equal(JSON.stringify(fx.group.toJSON()),snapshot);
      fx.clear();fx.clear();assert.equal(fx.staging.active,false);assert.ok(fx.group.children.every(o=>!o.visible));
      fx.update(a,camera(),false,false,false,anchor);assert.equal(fx.group.visible,true);a.player.alive=false;fx.update(a,camera(),false);assert.equal(fx.group.visible,false);
    }fx.dispose();fx.dispose();
  });
  test(`${kind}: connected cameras frame edge casts, return without a snap, and obey comfort`,()=>{
    const fx=kind==='spirit'?new SpiritCinematic(new THREE.Scene()):new SkybreakerCinematic(new THREE.Scene());
    for(const aspect of [16/9,2.5,390/844])for(const edge of [false,true]){
      const a=new Arena(id,()=>.5,0,0);a.player.x=edge?RADIUS-1:0;a.player.angle=.4;a.activateNuke(a.player);
      const c=camera();c.aspect=aspect;c.updateProjectionMatrix();const reset=()=>{c.position.set(a.player.x,48,27);c.lookAt(a.player.x,0,0);};
      for(const boundary of [.55,.9,2.4,2.5,3.4,4.2,4.35,5.6]){
        a.cinematic!.time=boundary-.001;a.cinematic!.detonated=boundary-.001>=3.4;reset();fx.update(a,c,false);const eye=c.position.clone(),q=c.quaternion.clone();
        a.cinematic!.time=boundary+.001;a.cinematic!.detonated=boundary+.001>=3.4;reset();fx.update(a,c,false);
        assert.ok(eye.distanceTo(c.position)<1.5,`position ${aspect}/${edge}/${boundary}`);assert.ok(q.angleTo(c.quaternion)<.03,`rotation ${boundary}`);
      }
      a.cinematic!.time=2.2;a.cinematic!.detonated=false;reset();fx.update(a,c,false);c.updateMatrixWorld(true);
      const focal=new THREE.Vector3().copy(kind==='spirit'?(fx as SpiritCinematic).staging.orbCenter:(fx as SkybreakerCinematic).staging.fistCenter).project(c);
      assert.ok(Math.abs(focal.x)<.9&&Math.abs(focal.y)<.9);
      reset();const q=c.quaternion.clone();fx.update(a,c,false,false,false);assert.deepEqual(c.position.toArray(),[a.player.x,48,27]);assert.ok(c.quaternion.angleTo(q)<1e-8);
      reset();fx.update(a,c,false,true);assert.deepEqual(c.position.toArray(),[a.player.x,48,27]);
      a.cinematic!.time=5.2;a.cinematic!.detonated=true;reset();fx.update(a,c,false);c.updateMatrixWorld(true);const player=new THREE.Vector3(a.player.x,1.5,0).project(c);assert.ok(Math.abs(player.x)<.98&&Math.abs(player.y)<.98);
    }fx.dispose();
  });
}
test('Spirit Bomb wake follows the flight derivative and mobile retains the essential core',()=>{
  const fx=new SpiritCinematic(new THREE.Scene(),'mobile'),a=new Arena('nova',()=>.5,0,0);a.activateNuke(a.player);a.cinematic!.time=2.9;fx.update(a,camera(),false,false,false);
  const wake=fx.group.children.find(o=>o instanceof THREE.InstancedMesh&&o.geometry instanceof THREE.ConeGeometry) as THREE.InstancedMesh,m=new THREE.Matrix4();wake.getMatrixAt(wake.count-1,m);
  const axis=new THREE.Vector3(0,1,0).transformDirection(m);assert.ok(axis.distanceTo(fx.staging.wakeDirection)<1e-6);assert.ok(axis.y<0);assert.equal(wake.count,6);fx.dispose();
});
test('Skybreaker curved arm and ink rebound reuse their geometry across stages',()=>{
  const fx=new SkybreakerCinematic(new THREE.Scene()),a=new Arena('cloud',()=>.5,0,0);a.activateNuke(a.player);a.cinematic!.time=2.2;fx.update(a,camera(),false);
  const arm=fx.group.getObjectByName('skybreaker-elastic-arm') as THREE.Mesh,dent=fx.group.getObjectByName('skybreaker-ink-rebound') as THREE.Mesh;
  const geometry=arm.geometry,positions=geometry.getAttribute('position'),before=Array.from(positions.array),version=(positions as THREE.BufferAttribute).version;
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:''};(arm.material as THREE.Material).onBeforeCompile(shader as never,{} as never);
  assert.match(shader.vertexShader,/armPoint\(position.y\)/);
  assert.ok((shader.uniforms.armEnd.value as THREE.Vector3).distanceTo(shader.uniforms.armControlB.value as THREE.Vector3)>5);
  const tangent=(shader.uniforms.armEnd.value as THREE.Vector3).clone().sub(shader.uniforms.armControlB.value as THREE.Vector3).normalize();
  assert.ok(tangent.dot(fx.staging.strikeDirection)>.9999);
  a.cinematic!.time=3.7;a.cinematic!.detonated=true;fx.update(a,camera(),false);assert.equal(arm.geometry,geometry);assert.deepEqual(Array.from(positions.array),before);assert.equal((positions as THREE.BufferAttribute).version,version);assert.ok(fx.group.children.some(o=>o instanceof THREE.InstancedMesh&&o.visible&&o.count===24),'smoke reactivates after initial cleanup');assert.ok(fx.group.children.some(o=>o instanceof THREE.InstancedMesh&&o.visible&&o.count===20),'stars reactivate after cleanup');assert.ok((dent.material as THREE.ShaderMaterial).uniforms.age.value>0);fx.clear();assert.equal((dent.material as THREE.ShaderMaterial).uniforms.alpha.value,0);fx.dispose();
});
