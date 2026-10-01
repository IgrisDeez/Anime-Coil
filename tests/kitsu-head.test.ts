import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KitsuHeadCache,validateKitsuHead,kitsuHeads,selectKitsuProfile,KITSU_EYE_CLEARANCE } from '../src/kitsu-head.ts';
import { createHead,createHeadOutline,createTransformedHead } from '../src/models.ts';
import type { DetailProfile } from '../src/worlds/types.ts';
async function parse(profile:DetailProfile){const b=await readFile(new URL(`../public/assets/kitsu/kitsu-head-${profile}.glb`,import.meta.url));return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
for (const profile of ['desktop', 'mobile'] as const) test(`${profile}: cached eye whites clear the face at vertices and triangle interiors throughout blinking`, async () => {
 const source = await parse(profile), originalZ = source.getObjectByName(`EyesPivot_${profile}`)!.position.z;
 const importedSkinSide = ((source.getObjectByName(`Kitsu_Skin_${profile}`) as THREE.Mesh).material as THREE.Material).side;
 const originalStats = validateKitsuHead(source, profile), cache = new KitsuHeadCache(async () => source);
 assert.equal(await cache.preload(profile), true);
 const head = cache.create(profile)!, eyes = head.getObjectByName(`EyesPivot_${profile}`)!;
 assert.equal(eyes.position.z, originalZ + KITSU_EYE_CLEARANCE);
 assert.deepEqual(cache.stats(profile), originalStats, 'offset adds no geometry or draw batches');
 assert.equal(await cache.preload(profile), true);
 assert.equal(cache.create(profile)!.getObjectByName(`EyesPivot_${profile}`)!.position.z, eyes.position.z, 'cache never accumulates offset');
 const white = head.getObjectByName(`Kitsu_EyeWhites_${profile}`) as THREE.Mesh;
 const skin = head.getObjectByName(`Kitsu_Skin_${profile}`) as THREE.Mesh;
 assert.equal((skin.material as THREE.Material).side, importedSkinSide, 'retain the sculpt skin faces instead of exposing the coil through the cheek');
 const p = white.geometry.getAttribute('position'), index = white.geometry.index;
 const samples = Array.from({length: p.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(p, i));
 for (let i = 0; i < (index?.count ?? p.count); i += 3) {
  const a = samples[index?.getX(i) ?? i], b = samples[index?.getX(i + 1) ?? i + 1], c = samples[index?.getX(i + 2) ?? i + 2];
  for (const weights of [[1/3,1/3,1/3], [.6,.2,.2], [.2,.6,.2], [.2,.2,.6]])
   samples.push(a.clone().multiplyScalar(weights[0]).addScaledVector(b, weights[1]).addScaledVector(c, weights[2]));
 }
 const ray = new THREE.Raycaster();
 for (let step = 0; step <= 20; step++) {
  eyes.scale.y = .08 + .92 * step / 20; head.updateMatrixWorld(true);
  for (const sample of samples) {
   const v = sample.clone().applyMatrix4(white.matrixWorld);
   ray.set(new THREE.Vector3(v.x, v.y, 2), new THREE.Vector3(0, 0, -1));
   const hit = ray.intersectObject(skin, false)[0];
   assert.ok(hit, 'face remains behind the eye');
   assert.ok(v.z - hit.point.z > .007, `clearance at blink ${eyes.scale.y}`);
   assert.ok(v.z - hit.point.z < .085, 'eyes remain close to the curved face');
  }
 }
 cache.dispose();
});
for(const profile of ['desktop','mobile'] as const)test(`${profile} Kitsu export schema, applied transforms, orientation and finite normals`,async()=>{
 const head=await parse(profile),stats=validateKitsuHead(head,profile);assert.ok(stats.triangles+352<=(profile==='desktop'?6000:4000));assert.equal(stats.draws,11);
 const eyes=head.getObjectByName('EyesPivot_'+profile)!;assert.equal(eyes.children.length,4);assert.equal(head.getObjectByName('Kitsu_Iris_'+profile)!.parent,eyes);
 const b=new THREE.Box3().setFromObject(head);assert.ok(Math.abs(b.min.x+b.max.x)<.12,'front silhouette remains balanced');
});

test('sculpt mount preserves the coil origin and eyes follow the rounded cheek surface',async()=>{
 for(const profile of ['desktop','mobile'] as const){
  const head=await parse(profile);head.updateMatrixWorld(true);
  const root=head.getObjectByName('KitsuHead_'+profile)!,mount=head.getObjectByName('KitsuSculptMount_'+profile)!;
  assert.ok(root.position.length()<.0001,'attachment origin stays fixed');assert.ok(Math.abs(mount.position.y-.12)<.0001);
  const white=head.getObjectByName('Kitsu_EyeWhites_'+profile) as THREE.Mesh,p=white.geometry.getAttribute('position');
  const skin=head.getObjectByName('Kitsu_Skin_'+profile) as THREE.Mesh,ray=new THREE.Raycaster();
  for(let i=0;i<p.count;i++){
   const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(white.matrixWorld);
   ray.set(new THREE.Vector3(v.x,v.y,2),new THREE.Vector3(0,0,-1));
   const hit=ray.intersectObject(skin,false)[0];assert.ok(hit,'rounded cheek behind each eye vertex');
   const depth=v.z-hit.point.z;
   assert.ok(depth<.055&&depth>-.025,'white embeds into the face instead of floating ahead of it');
  }
 }
});
test('preload is deduplicated, profiles cached, geometry/materials shared, blinking independent',async()=>{
 const loads:DetailProfile[]=[];const cache=new KitsuHeadCache(async p=>{loads.push(p);return parse(p);});
 const a=cache.preload('desktop');assert.equal(a,cache.preload('desktop'));assert.equal(await a,true);assert.deepEqual(loads,['desktop']);
 const first=cache.create('desktop')!,second=cache.create('desktop')!;
 assert.notEqual(first,second);const eye=first.getObjectByName('EyesPivot_desktop')!,other=second.getObjectByName('EyesPivot_desktop')!;eye.scale.y=.1;assert.equal(other.scale.y,1);
 const meshes:THREE.Mesh[]=[];first.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
 for(const mesh of meshes){const peer=second.getObjectByName(mesh.name) as THREE.Mesh;assert.equal(mesh.geometry,peer.geometry);assert.equal(mesh.material,peer.material);}
 assert.equal(await cache.preload('mobile'),true);assert.equal(await cache.preload('desktop'),true);assert.deepEqual(loads,['desktop','mobile']);
 const shell=cache.outline('desktop')!;shell.geometry.computeBoundingBox();assert.ok(shell.geometry.boundingBox!.min.y>1.5);
 let geometryDisposals=0,materialDisposals=0;meshes.forEach(o=>{o.geometry.addEventListener('dispose',()=>geometryDisposals++);(o.material as THREE.Material).addEventListener('dispose',()=>materialDisposals++);});
 const iris=first.getObjectByName('Kitsu_Iris_desktop') as THREE.Mesh;assert.ok((iris.material as THREE.MeshLambertMaterial).color.equals(new THREE.Color('#439dce')));
 const mobileIris=cache.create('mobile')!.getObjectByName('Kitsu_Iris_mobile') as THREE.Mesh;assert.equal(iris.material,mobileIris.material);
 first.removeFromParent();second.removeFromParent();assert.equal(geometryDisposals,0);cache.dispose();cache.dispose();assert.equal(geometryDisposals,11);assert.equal(materialDisposals,11);
 assert.equal(await cache.preload('desktop'),false);
});

test('missing iris, incorrect eye parenting, shifted mount and nonfinite geometry trigger fallback',async()=>{
 for(const corrupt of [
  (h:THREE.Group)=>h.getObjectByName('Kitsu_Iris_desktop')!.removeFromParent(),
  (h:THREE.Group)=>h.getObjectByName('KitsuSculptMount_desktop')!.add(h.getObjectByName('Kitsu_Iris_desktop')!),
  (h:THREE.Group)=>{h.getObjectByName('KitsuSculptMount_desktop')!.position.y=.5;},
  (h:THREE.Group)=>{(h.getObjectByName('Kitsu_Skin_desktop') as THREE.Mesh).geometry.getAttribute('position').setX(0,Infinity);},
 ]){
  const head=await parse('desktop');corrupt(head);assert.throws(()=>validateKitsuHead(head,'desktop'));
  const cache=new KitsuHeadCache(async()=>head);assert.equal(await cache.preload('desktop'),false);assert.equal(cache.create('desktop'),undefined);cache.dispose();
 }
});
test('load failures and invalid schemas resolve to synchronous procedural fallback',async()=>{
 const cache=new KitsuHeadCache(async()=>{throw new Error('deliberate network failure');});assert.equal(await cache.preload('desktop'),false);assert.equal(cache.create('desktop'),undefined);
 const invalid=new KitsuHeadCache(async()=>new THREE.Group());assert.equal(await invalid.preload('desktop'),false);
 const fallback=createHead('ember');assert.ok(fallback.children.length>0);assert.ok(createHeadOutline('ember').geometry.attributes.position.count>0);cache.dispose();invalid.dispose();
});
test('normal and transformed Kitsu remain separate across selected profiles',async()=>{
 assert.equal(await kitsuHeads.preload('desktop',parse),true);selectKitsuProfile('desktop');
 const normal=createHead('ember'),form=createTransformedHead('ember');assert.ok(normal.getObjectByName('KitsuHead_desktop'));assert.equal(form.getObjectByName('KitsuHead_desktop'),undefined);
 assert.equal(await kitsuHeads.preload('mobile',parse),true);selectKitsuProfile('mobile');assert.ok(createHead('ember').getObjectByName('KitsuHead_mobile'));assert.ok(normal.getObjectByName('KitsuHead_desktop'));
 selectKitsuProfile('desktop');assert.ok(createHead('ember').getObjectByName('KitsuHead_desktop'));
});
