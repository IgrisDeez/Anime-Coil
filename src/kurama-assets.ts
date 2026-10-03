// Approved Kurama asset owner; immutable geometry shared across instances.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createFoxSummon, registerFoxSummonAssetFactory } from './fox-model';
import type { FoxSummonModel } from './fox-model';
import type { DetailProfile } from './worlds/types';

export const KURAMA_BUDGET = {desktop:20000,mobile:12000};
export type KuramaLoader = (profile:DetailProfile)=>Promise<THREE.Group>;
type Asset = {source:THREE.Group;beast:THREE.Group;tail:THREE.BufferGeometry;stats:ReturnType<typeof validateKurama>};
const tri=(g:THREE.BufferGeometry)=>(g.index?.count??g.getAttribute('position').count)/3;
function resources(root:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
 return {geometries,materials};
}
function disposeSource(root:THREE.Object3D){const r=resources(root);r.geometries.forEach(g=>g.dispose());r.materials.forEach(m=>m.dispose());}
export function kuramaFadeMaterial(){
 const material=new THREE.MeshToonMaterial({vertexColors:true,emissive:'#ffcc42',emissiveIntensity:.18,alphaHash:true,side:THREE.FrontSide});
 // A restrained color floor keeps gold readable at night while ink remains dark.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)\n totalEmissiveRadiance *= vColor.rgb;\n#endif');};
 material.customProgramCacheKey=()=> 'kurama-color-floor-v1';return material;
}

export function validateKurama(source:THREE.Group,profile:DetailProfile){
 const root=source.getObjectByName(`KuramaAsset_${profile}`),beast=source.getObjectByName('fox-summon');
 if(!root||root.position.lengthSq()>1e-8||root.userData.schemaVersion!==1||root.userData.tailCount!==9||!beast||beast.parent!==root)throw new Error('Invalid Kurama root');
 const head=beast.getObjectByName('fox-head'),left=beast.getObjectByName('fox-left-paw'),right=beast.getObjectByName('fox-right-paw'),muzzle=beast.getObjectByName('fox-muzzle-anchor');
 if(!head||!left||!right||head.parent!==beast||left.parent!==beast||right.parent!==beast||muzzle?.parent!==head)throw new Error('Invalid articulated pivots');
 if(muzzle.position.z<4||Math.abs(muzzle.position.x)>.001||muzzle.position.y>0||head.position.y<12||head.position.y>17)throw new Error('Invalid +Z mouth orientation');
 let bodyTriangles=0,tailTriangles=0,meshes=0;
 source.traverse(o=>{
  if(o instanceof THREE.Camera||o instanceof THREE.Light||o instanceof THREE.SkinnedMesh)throw new Error('Unexpected runtime object');
  if(!(o instanceof THREE.Mesh))return;meshes++;
  if(Array.isArray(o.material)||o.scale.distanceTo(new THREE.Vector3(1,1,1))>1e-6||o.quaternion.angleTo(new THREE.Quaternion())>1e-6||o.position.lengthSq()>1e-8)throw new Error('Unapplied mesh transform');
  const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal'),c=o.geometry.getAttribute('color');
  if(!p||!n||!c||p.count!==n.count||p.count!==c.count)throw new Error('Missing finite vertex data');
  for(const a of [p,n,c])for(const value of a.array)if(!Number.isFinite(value))throw new Error('Nonfinite geometry');
  for(let i=0;i<n.count;i++){const length=n.getX(i)**2+n.getY(i)**2+n.getZ(i)**2;if(length<.85||length>1.15)throw new Error('Invalid normal');}
  o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  if(o.userData.batch==='Tail'){if(o.parent!==root||o.name!==`Kurama_TailPrototype_${profile}`)throw new Error('Invalid tail prototype');tailTriangles+=tri(o.geometry);}
  else {const expected={Body:beast,Head:head,LeftPaw:left,RightPaw:right}[o.userData.batch as 'Body'];if(!expected||o.parent!==expected||o.name!==`Kurama_${o.userData.batch}_${profile}`)throw new Error('Invalid body batch');bodyTriangles+=tri(o.geometry);}
 });
 const modelTriangles=bodyTriangles+tailTriangles*18;
 if(meshes!==5||!tailTriangles||modelTriangles>KURAMA_BUDGET[profile])throw new Error('Kurama profile budget exceeded');
 for(const part of ['Body','Head','LeftPaw','RightPaw'])if(!(source.getObjectByName(`Kurama_${part}_${profile}`) instanceof THREE.Mesh))throw new Error('Missing body batch');
 source.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(beast),size=bounds.getSize(new THREE.Vector3());
 if(bounds.min.y<-.1||bounds.max.y>22||size.x<13||size.x>22||size.z<7||size.z>13||Math.abs(bounds.min.x+bounds.max.x)>.12)throw new Error('Invalid body bounds/symmetry');
 const tail=source.getObjectByName(`Kurama_TailPrototype_${profile}`) as THREE.Mesh;
 if(tail.geometry.boundingBox!.min.z<-.001||Math.abs(tail.geometry.boundingBox!.max.z-2.5)>.001)throw new Error('Tail prototype orientation');
 return {bodyTriangles,tailTriangles,modelTriangles,bodyDraws:4,tailDraws:2};
}

/** Owns immutable imported geometry; fading materials belong to each instance. */
export class KuramaAssetCache {
 private pending=new Map<DetailProfile,Promise<boolean>>();private assets=new Map<DetailProfile,Asset>();private disposed=false;
 constructor(private loader:KuramaLoader=loadKuramaGLB){}
 preload(profile:DetailProfile,loader:KuramaLoader=this.loader):Promise<boolean>{
  if(this.disposed)return Promise.resolve(false);
  let promise=this.pending.get(profile);
  if(!promise){promise=loader(profile).then(source=>{
   try {const stats=validateKurama(source,profile);if(this.disposed){disposeSource(source);return false;}
    source.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.userData.sharedKurama=true;});
    const beast=source.getObjectByName('fox-summon') as THREE.Group,tail=(source.getObjectByName(`Kurama_TailPrototype_${profile}`) as THREE.Mesh).geometry;
    this.assets.set(profile,{source,beast,tail,stats});return true;
   }catch(error){disposeSource(source);throw error;}
  }).catch(error=>{console.warn('Kurama asset unavailable; procedural fallback',error);return false;});this.pending.set(profile,promise);}
  return promise;
 }
 create(profile:DetailProfile):FoxSummonModel|undefined{
  const asset=this.assets.get(profile);if(!asset)return;
  const clone=(node:THREE.Object3D):THREE.Object3D=>{const result=node instanceof THREE.Mesh?node.clone(false):new THREE.Group().copy(node,false);for(const child of node.children)result.add(clone(child));return result;};
  const beast=clone(asset.beast) as THREE.Group,meshes:THREE.Mesh[]=[];
  beast.traverse(o=>{if(o instanceof THREE.Mesh){o.material=kuramaFadeMaterial();meshes.push(o);}});
  return {beast,head:beast.getObjectByName('fox-head') as THREE.Group,leftPaw:beast.getObjectByName('fox-left-paw') as THREE.Group,rightPaw:beast.getObjectByName('fox-right-paw') as THREE.Group,muzzle:beast.getObjectByName('fox-muzzle-anchor')!,meshes};
 }
 tail(profile:DetailProfile){return this.assets.get(profile)?.tail;}
 stats(profile:DetailProfile){return this.assets.get(profile)?.stats;}
 dispose(){if(this.disposed)return;this.disposed=true;for(const a of this.assets.values())disposeSource(a.source);this.assets.clear();}
}
async function loadKuramaGLB(profile:DetailProfile){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try {const response=await fetch(`${import.meta.env?.BASE_URL??'/'}assets/kurama/kurama-${profile}.glb`,{signal:controller.signal});if(!response.ok)throw new Error(`Kurama HTTP ${response.status}`);return (await new GLTFLoader().parseAsync(await response.arrayBuffer(),'')).scene;}
 finally{clearTimeout(timer);}
}
export const kuramaAssets=new KuramaAssetCache();
registerFoxSummonAssetFactory(profile=>kuramaAssets.create(profile));
export const createKuramaSummon=(profile:DetailProfile):FoxSummonModel=>createFoxSummon(profile);
export function disposeKuramaInstance(model:FoxSummonModel){if(model.beast.userData.kuramaInstanceDisposed)return;model.beast.userData.kuramaInstanceDisposed=true;for(const mesh of model.meshes){if(!mesh.geometry.userData.sharedKurama)mesh.geometry.dispose();for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])mat.dispose();}model.beast.removeFromParent();}
if(import.meta.hot)import.meta.hot.dispose(()=>kuramaAssets.dispose());
if(typeof window!=='undefined')window.addEventListener('pagehide',e=>{if(!e.persisted)kuramaAssets.dispose();});
