import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {UltimatePressure,pressureFrame} from '../src/ultimate-pressure';
import {Arena} from '../src/simulation';import {FoxCinematic} from '../src/fox';import {SpiritCinematic} from '../src/spirit';import {PurpleCinematic} from '../src/purple';import {SkybreakerCinematic} from '../src/skybreaker';
test('pressure front starts at the authoritative impact and reduced motion keeps one subdued cue',()=>{
  assert.equal(pressureFrame(3.399).visible,false);assert.equal(pressureFrame(3.4).visible,true);assert.equal(pressureFrame(4.46).visible,false);
  const effect=new UltimatePressure('fox'),geometries=effect.group.children.map(o=>(o as THREE.Mesh).geometry);
  for(const profile of ['desktop','mobile'] as const)for(const t of [3.4,3.48,3.7,4.3]){
    effect.update(t,20,-13,profile,false);assert.equal(effect.group.position.x,20);assert.equal(effect.group.position.z,-13);
    const strokes=effect.group.children[1] as THREE.InstancedMesh;assert.ok(strokes.count<=18);assert.ok(Array.from(strokes.instanceMatrix.array).every(Number.isFinite));
    assert.deepEqual(effect.group.children.map(o=>(o as THREE.Mesh).geometry),geometries);
  }
  effect.update(3.48,20,-13,'mobile',true);assert.equal((effect.group.children[1] as THREE.InstancedMesh).count,0);assert.equal(pressureFrame(3.48,true).radius,23);assert.ok(pressureFrame(3.48,true).opacity<=.15);
  let disposal=0;for(const g of geometries)g.addEventListener('dispose',()=>disposal++);effect.dispose();effect.dispose();assert.equal(disposal,2);
});
test('all ultimate visual stages preserve simulation state, reuse resources, and clear on death',()=>{
  for(const [character,Ctor] of [['ember',FoxCinematic],['nova',SpiritCinematic],['eclipse',PurpleCinematic],['cloud',SkybreakerCinematic]] as const){
    const scene=new THREE.Scene(),effect=new Ctor(scene),arena=new Arena(character,()=>.5,0,0),camera=new THREE.PerspectiveCamera(43,1,.1,1000);arena.activateNuke(arena.player);
    const geometries=new Set<THREE.BufferGeometry>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.LineSegments)geometries.add(o.geometry);});
    for(const profile of ['desktop','mobile','desktop'] as const)for(const reduced of [false,true])for(const time of [.75,2.15,2.95,3.48,3.72,4.85]){
      arena.cinematic!.time=time;arena.cinematic!.detonated=time>=3.4;const before=JSON.stringify(arena);camera.position.set(0,50,30);camera.lookAt(0,0,0);const cameraPosition=camera.position.clone(),cameraRotation=camera.quaternion.clone();effect.setProfile(profile);effect.update(arena,camera,false,reduced,false);
      assert.ok(camera.position.equals(cameraPosition));assert.ok(camera.quaternion.equals(cameraRotation));
      assert.equal(JSON.stringify(arena),before);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.LineSegments){assert.ok(geometries.has(o.geometry));for(const v of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(v));if(o instanceof THREE.InstancedMesh)assert.ok(o.count<=o.instanceMatrix.count);}});
    }
    const disposals=new Map<THREE.BufferGeometry,number>();for(const g of geometries)g.addEventListener('dispose',()=>disposals.set(g,(disposals.get(g)??0)+1));
    arena.player.alive=false;effect.update(arena,camera,false);assert.ok(scene.children.every(g=>!g.visible));effect.dispose();effect.dispose();for(const n of disposals.values())assert.equal(n,1);
  }
});
