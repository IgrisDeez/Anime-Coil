/** Offline checks for the review candidate. Never initializes the live game cache. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const base=new URL('../assets/kitsu/candidates/chibi-naruto/',import.meta.url);
const keys=['Skin','EyeWhites','Pupils','Iris','Highlights','Hair','Fabric','Metal','Details','CheekMarks','Mouth'];
const records=[];
for(const profile of ['desktop','mobile'] as const){
 const bytes=await readFile(new URL(`kitsu-head-${profile}.glb`,base));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 assert.equal(gltf.animations.length,0);
 const head=gltf.scene,root=head.getObjectByName('KitsuHead_'+profile)!;
 const mount=head.getObjectByName('KitsuSculptMount_'+profile)!;
 const eyes=head.getObjectByName('EyesPivot_'+profile)!;
 assert.ok(root&&mount&&eyes);assert.equal(root.position.length(),0);
 assert.equal(mount.parent,root);assert.equal(eyes.parent,mount);
 assert.ok(Math.abs(mount.position.y-.12)<1e-5);assert.ok(Math.abs(eyes.position.y-1.28)<1e-5);
 assert.equal(eyes.children.length,4);assert.equal(eyes.userData.previewEye,true);
 for(const key of ['EyeWhites','Pupils','Iris','Highlights'])assert.equal(head.getObjectByName(`Kitsu_${key}_${profile}`)?.parent,eyes);
 assert.equal(head.getObjectByName('Kitsu_Hair_'+profile)?.userData.lockCount,15);
 head.updateMatrixWorld(true);
 let triangles=0,draws=0,degenerates=0;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 const batches:Record<string,number>={};
 head.traverse(o=>{
  assert.ok(!(o instanceof THREE.Camera)&&!(o instanceof THREE.Light)&&!(o instanceof THREE.SkinnedMesh));
  if(!(o instanceof THREE.Mesh))return;
  draws++;assert.ok(o.geometry.index);assert.ok(!Array.isArray(o.material));
  assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.equal(o.position.length(),0);
  assert.ok(o.quaternion.angleTo(new THREE.Quaternion())<1e-6);
  assert.equal(o.children.length,0);assert.equal(o.geometry.morphAttributes.position,undefined);
  geometries.add(o.geometry);materials.add(o.material as THREE.Material);
  const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal'),idx=o.geometry.index!;
  assert.equal(n.count,p.count);triangles+=idx.count/3;batches[o.userData.batch]=idx.count/3;
  for(let i=0;i<p.count;i++){
   assert.ok([p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite));
   assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.003);
  }
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<idx.count;i+=3){a.fromBufferAttribute(p,idx.getX(i));b.fromBufferAttribute(p,idx.getX(i+1));c.fromBufferAttribute(p,idx.getX(i+2));if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-20)degenerates++;}
 });
 assert.equal(draws,11);assert.equal(materials.size,11);assert.equal(degenerates,0);
 assert.ok(triangles+352<=(profile==='mobile'?4000:6000));
 for(const key of keys)assert.ok(head.getObjectByName(`Kitsu_${key}_${profile}`));
 const bounds=new THREE.Box3().setFromObject(head),size=bounds.getSize(new THREE.Vector3());
 assert.ok(bounds.min.y>.65&&bounds.max.y<3.2);assert.ok(size.x>2.4&&size.x<2.7&&size.z<2.5);
 assert.ok(Math.abs(bounds.min.x+bounds.max.x)<.02,'left/right silhouette balance');
 const white=head.getObjectByName('Kitsu_EyeWhites_'+profile) as THREE.Mesh;
 const skin=head.getObjectByName('Kitsu_Skin_'+profile) as THREE.Mesh;
 const ray=new THREE.Raycaster(),p=white.geometry.getAttribute('position');let eyeDepthMin=Infinity,eyeDepthMax=-Infinity;
 const eyeBounds=[new THREE.Box3(),new THREE.Box3()];
 for(let i=0;i<p.count;i++){
  const local=new THREE.Vector3().fromBufferAttribute(p,i);
  eyeBounds[local.x<0?0:1].expandByPoint(local);
  const point=local.applyMatrix4(white.matrixWorld);
  assert.ok(point.z>0,'eyes stay on the +Z side of the skull');
  ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
  const hit=ray.intersectObject(skin,false)[0];assert.ok(hit,'skull behind eye');
  const depth=point.z-hit.point.z;eyeDepthMin=Math.min(eyeDepthMin,depth);eyeDepthMax=Math.max(eyeDepthMax,depth);
 }
 assert.ok(eyeDepthMin>-.04&&eyeDepthMax<.085,'eyes remain shallow against the cheeks');
 for(const bounds of eyeBounds){const s=bounds.getSize(new THREE.Vector3());const c=bounds.getCenter(new THREE.Vector3());assert.ok(Math.abs(s.x-.44)<.035);assert.ok(Math.abs(s.y-.34)<.025);assert.ok(Math.abs(Math.abs(c.x)-.36)<.012);}
 const a=head.clone(true),b=head.clone(true);
 const ae=a.getObjectByName('EyesPivot_'+profile)!,be=b.getObjectByName('EyesPivot_'+profile)!;
 ae.scale.y=.1;assert.equal(be.scale.y,1);assert.equal(eyes.scale.y,1);
 a.position.x=3;assert.equal(b.position.x,0);assert.equal(head.position.x,0);
 a.traverse(o=>{if(o instanceof THREE.Mesh){const peer=b.getObjectByName(o.name) as THREE.Mesh;assert.notEqual(o,peer);assert.equal(o.geometry,peer.geometry);assert.equal(o.material,peer.material);}});
 let disposals=0;for(const g of geometries)g.addEventListener('dispose',()=>disposals++);
 a.removeFromParent();b.removeFromParent();assert.equal(disposals,0);
 records.push({profile,triangles,trianglesWithCoil:triangles+352,headDrawsWithCoil:12,outlineDraws:1,geometryCount:geometries.size,materialCount:materials.size,bytes:bytes.length,batches,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},eyeDepthMin,eyeDepthMax,eyeBounds:eyeBounds.map(b=>({size:b.getSize(new THREE.Vector3()).toArray(),center:b.getCenter(new THREE.Vector3()).toArray()}))});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();assert.equal(disposals,geometries.size);
}
const report={status:'Separate review candidate; integration awaits visual approval',profiles:records,checks:['required nodes and eleven material batches','four independently cloned eye batches at 1.28 Y','Y up, +Z forward','original origin and 0.12 Y mount','finite positions and unit normals','no zero-area triangles','applied mesh transforms; no cameras/lights/skins/animation','desktop/mobile budgets including 352-triangle existing coil','eye dimensions and centers; shallow embedding','15 authored hair locks retained in both profiles','balanced facial and hair silhouette','clone geometry/material sharing','independent eye pivot transforms','removing clones does not dispose shared resources; owner disposes once'],limitations:['Add Iris palette entry and four-child eye schema only after approval. Existing live cache remains unchanged.','Side and rear interpretation use the original four-view reference; exact unseen Naruto anatomy is inferred.','Game load-failure, profile cache/switches, cinematic recovery, maps, crowds, CPU comparison and physical-phone review of this candidate await integration approval.']};
await writeFile(new URL('candidate-validation.json',base),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
