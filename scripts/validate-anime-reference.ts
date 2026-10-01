/** Inspect staged candidate exports without changing or initializing game assets. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const base=new URL('../assets/kitsu/candidates/anime-reference/',import.meta.url);
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
 assert.ok(Math.abs(mount.position.y-.12)<1e-5);assert.ok(Math.abs(eyes.position.y-1.57)<1e-5);
 assert.equal(eyes.children.length,4);assert.equal(eyes.userData.previewEye,true);
 head.updateMatrixWorld(true);
 let triangles=0,draws=0,degenerates=0;const geometries=new Set(),materials=new Set();
 head.traverse(o=>{
  assert.ok(!(o instanceof THREE.Camera)&&!(o instanceof THREE.Light)&&!(o instanceof THREE.SkinnedMesh));
  if(!(o instanceof THREE.Mesh))return;
  draws++;assert.ok(o.geometry.index);assert.ok(!Array.isArray(o.material));
  assert.deepEqual(o.scale.toArray(),[1,1,1]);assert.equal(o.position.length(),0);
  geometries.add(o.geometry);materials.add(o.material);
  const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal'),idx=o.geometry.index!;
  assert.equal(n.count,p.count);triangles+=idx.count/3;
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
 assert.ok(bounds.min.y>.65&&bounds.max.y<3.2);assert.ok(size.x>2.2&&size.x<2.7&&size.z<2.5);
 assert.ok(Math.abs(bounds.min.x+bounds.max.x)<.12);
 const white=head.getObjectByName('Kitsu_EyeWhites_'+profile) as THREE.Mesh;
 const skin=head.getObjectByName('Kitsu_Skin_'+profile) as THREE.Mesh;
 const ray=new THREE.Raycaster(),p=white.geometry.getAttribute('position');let eyeDepthMin=Infinity,eyeDepthMax=-Infinity;
 for(let i=0;i<p.count;i++){
  const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(white.matrixWorld);
  assert.ok(point.z>0,'eyes stay on the +Z side of the skull');
  ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
  const hit=ray.intersectObject(skin,false)[0];assert.ok(hit,'skull behind eye');
  const depth=point.z-hit.point.z;eyeDepthMin=Math.min(eyeDepthMin,depth);eyeDepthMax=Math.max(eyeDepthMax,depth);
 }
 assert.ok(eyeDepthMin>-.04&&eyeDepthMax<.085);
 const a=head.clone(true),b=head.clone(true);
 const ae=a.getObjectByName('EyesPivot_'+profile)!,be=b.getObjectByName('EyesPivot_'+profile)!;
 ae.scale.y=.1;assert.equal(be.scale.y,1);assert.equal(eyes.scale.y,1);
 a.traverse(o=>{if(o instanceof THREE.Mesh){const peer=b.getObjectByName(o.name) as THREE.Mesh;assert.notEqual(o,peer);assert.equal(o.geometry,peer.geometry);assert.equal(o.material,peer.material);}});
 let disposals=0;for(const g of geometries)g.addEventListener('dispose',()=>disposals++);
 a.removeFromParent();b.removeFromParent();assert.equal(disposals,0);
 records.push({profile,triangles,trianglesWithCoil:triangles+352,headDrawsWithCoil:12,outlineDraws:1,geometryCount:geometries.size,materialCount:materials.size,bytes:bytes.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},eyeDepthMin,eyeDepthMax});
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
}
const report={status:'Staged candidate checks passed; game integration awaits visual approval',profiles:records,checks:['required nodes and eleven material batches','Y up, +Z forward','original origin and 0.12 Y mount','finite positions and unit normals','no zero-area triangles','desktop/mobile budgets including existing coil','shallow embedded eyes','clone geometry/material sharing','independent eye pivot transforms','removing clones does not dispose resources'],limitations:['Game palette, eye-pivot schema and bounds validation need updating after approval.','No new game load-failure, profile-cache, cinematic, map, crowd, CPU or phone validation: candidate is not integrated.']};
await writeFile(new URL('candidate-validation.json',base),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
