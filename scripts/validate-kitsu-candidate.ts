/** Offline review candidate checks; never replaces or initializes game assets. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {KitsuHeadCache,validateKitsuHead} from '../src/kitsu-head.ts';
import type {DetailProfile} from '../src/worlds/types.ts';
const base=new URL('../assets/kitsu/candidates/reference-rebuild/',import.meta.url);
const loads:DetailProfile[]=[];
async function parse(profile:DetailProfile){
 loads.push(profile);const b=await readFile(new URL(`kitsu-head-${profile}.glb`,base));
 return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;
}
const records=[];
for(const profile of ['desktop','mobile'] as const){
 const head=await parse(profile),stats=validateKitsuHead(head,profile);head.updateMatrixWorld(true);
 const root=head.getObjectByName('KitsuHead_'+profile)!,mount=head.getObjectByName('KitsuSculptMount_'+profile)!;
 assert.equal(root.position.length(),0);assert.ok(Math.abs(mount.position.y-.12)<.00001);
 const bounds=new THREE.Box3().setFromObject(head);assert.ok(Math.abs(bounds.min.x+bounds.max.x)<.08);
 const skin=head.getObjectByName('Kitsu_Skin_'+profile) as THREE.Mesh;
 const white=head.getObjectByName('Kitsu_EyeWhites_'+profile) as THREE.Mesh;
 const position=white.geometry.getAttribute('position'),ray=new THREE.Raycaster();
 let maxEyeProtrusion=-Infinity,minEyeProtrusion=Infinity;
 for(let i=0;i<position.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(white.matrixWorld);
  ray.set(new THREE.Vector3(p.x,p.y,2),new THREE.Vector3(0,0,-1));
  const hits=ray.intersectObject(skin,false);assert.ok(hits.length,'eye has skull volume behind it');
  const depth=p.z-hits[0].point.z;maxEyeProtrusion=Math.max(maxEyeProtrusion,depth);minEyeProtrusion=Math.min(minEyeProtrusion,depth);
 }
 assert.ok(maxEyeProtrusion<.070,'embedded eye lens stays shallow');assert.ok(minEyeProtrusion>-.050,'eye is not hidden inside skull');
 records.push({profile,...stats,trianglesWithCoil:stats.triangles+352,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},minEyeProtrusion,maxEyeProtrusion});
}
loads.length=0;const cache=new KitsuHeadCache(parse);
const p=cache.preload('desktop');assert.equal(p,cache.preload('desktop'));assert.equal(await p,true);
assert.equal(await cache.preload('mobile'),true);assert.equal(await cache.preload('desktop'),true);assert.deepEqual(loads,['desktop','mobile']);
let geometryDisposals=0,materialDisposals=0;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
for(const profile of ['desktop','mobile'] as const){
 const a=cache.create(profile)!,b=cache.create(profile)!;assert.notEqual(a,b);
 const eye=a.getObjectByName('EyesPivot_'+profile)!,other=b.getObjectByName('EyesPivot_'+profile)!;eye.scale.y=.10;assert.equal(other.scale.y,1);
 a.traverse(o=>{if(o instanceof THREE.Mesh){const peer=b.getObjectByName(o.name) as THREE.Mesh;assert.equal(o.geometry,peer.geometry);assert.equal(o.material,peer.material);geometries.add(o.geometry);materials.add(o.material as THREE.Material);}});
 const outline=cache.outline(profile)!;assert.ok(outline.geometry.getAttribute('position').count>0);geometries.add(outline.geometry);
 a.removeFromParent();b.removeFromParent();assert.equal(geometryDisposals,0);
}
for(const g of geometries)g.addEventListener('dispose',()=>geometryDisposals++);
for(const m of materials)m.addEventListener('dispose',()=>materialDisposals++);
cache.dispose();cache.dispose();assert.equal(geometryDisposals,geometries.size);assert.equal(materialDisposals,materials.size);
const failure=new KitsuHeadCache(async()=>{throw new Error('deliberate candidate load failure');});
assert.equal(await failure.preload('desktop'),false);assert.equal(failure.create('desktop'),undefined);failure.dispose();
const report={status:'candidate asset checks passed; awaiting visual approval',profiles:records,cachedLoads:loads,sharedGeometryCount:geometries.size,sharedMaterialCount:materials.size,checks:['schema','Y-up +Z-forward','attachment origin and mount','finite unit normals','profile budgets','symmetry','ray-tested eye embedding','profile caching','shared resources','independent blinking','one-time disposal','load failure']};
await writeFile(new URL('candidate-validation.json',base),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
