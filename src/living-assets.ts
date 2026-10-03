import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {DetailProfile} from './worlds/types';

export const CITY_FAMILIES=['Rounded','Glass','Shop','Terrace','Station','Arcade'] as const;
export type CityFamily=typeof CITY_FAMILIES[number];
export type ProfileLoader=(profile:DetailProfile)=>Promise<THREE.Group>;
const triangles=(g:THREE.BufferGeometry)=>(g.index?.count??g.attributes.position.count)/3;
const identity=new THREE.Quaternion(),unit=new THREE.Vector3(1,1,1);

export function assetResources(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}
  });return {geometries,materials,textures};
}
function disposeAsset(root:THREE.Object3D){const r=assetResources(root);r.geometries.forEach(g=>g.dispose());r.materials.forEach(m=>m.dispose());r.textures.forEach(t=>t.dispose());}
function finiteMeshes(source:THREE.Group){
  let count=0,total=0;
  source.traverse(o=>{
    if(o instanceof THREE.Camera||o instanceof THREE.Light||o instanceof THREE.SkinnedMesh)throw Error('Unexpected asset object');
    if(!(o instanceof THREE.Mesh))return;count++;
    if(Array.isArray(o.material)||o.position.lengthSq()>1e-9||o.scale.distanceTo(unit)>1e-6||o.quaternion.angleTo(identity)>1e-6)throw Error('Unapplied mesh transform');
    const p=o.geometry.attributes.position,n=o.geometry.attributes.normal,c=o.geometry.attributes.color;
    if(!p||!n||!c||p.count!==n.count||p.count!==c.count)throw Error('Missing vertex data');
    for(const attribute of [p,n,c])for(const value of attribute.array)if(!Number.isFinite(value))throw Error('Nonfinite asset geometry');
    for(let i=0;i<n.count;i++){const length=n.getX(i)**2+n.getY(i)**2+n.getZ(i)**2;if(length<.85||length>1.15)throw Error('Nonunit asset normal');}
    if(o.geometry.index)for(const value of o.geometry.index.array)if(value<0||value>=p.count)throw Error('Invalid triangle index');
    o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();total+=triangles(o.geometry);
  });return {count,total};
}
export function validateCityKit(source:THREE.Group,profile:DetailProfile){
  const root=source.getObjectByName('ShibuyaKit_'+profile);if(!root||root.userData.schemaVersion!==1||root.userData.familyCount!==6||root.position.lengthSq()>1e-9)throw Error('Invalid city kit root');
  const stats=finiteMeshes(source);if(stats.count!==14||stats.total>(profile==='desktop'?5000:4000))throw Error('City prototype budget');
  for(const family of CITY_FAMILIES){
    const g:THREE.Object3D|undefined=root.getObjectByName(`City_${family}_${profile}`);if(!g||g.parent!==root||g.userData.family!==family||g.position.lengthSq()>1e-9)throw Error('Missing architectural family');
    for(const batch of ['Stone','Windows']){const mesh:THREE.Object3D|undefined=g.getObjectByName(`City_${family}_${batch}_${profile}`);if(!(mesh instanceof THREE.Mesh)||mesh.parent!==g)throw Error('Missing city batch');}
    const size=g.userData.baseSize;if(!Array.isArray(size)||size.length!==3||size.some(v=>!Number.isFinite(v)||v<=0))throw Error('Invalid kit bounds');
    const bounds=new THREE.Box3().setFromObject(g);if(bounds.min.y<-.01||bounds.max.y>55||bounds.max.z<7||bounds.max.x<8)throw Error('City orientation/bounds');
  }
  for(const prop of ['Meeting','Furniture']){const group:THREE.Object3D|undefined=root.getObjectByName(`City_${prop}_${profile}`);if(group?.parent!==root||group.children.length!==1||!(group.children[0] instanceof THREE.Mesh))throw Error('Missing city furniture');}
  return {triangles:stats.total,draws:stats.count,families:6};
}
export function validatePomuUltimate(source:THREE.Group,profile:DetailProfile){
  const root=source.getObjectByName('PomuUltimate_'+profile),head=source.getObjectByName('PomuGear5Head_'+profile),fist=source.getObjectByName('PomuHakiFist_'+profile),mount=source.getObjectByName('PomuGear5Mount_'+profile),eyes=source.getObjectByName('PomuGear5Eyes_'+profile);
  if(!root||root.userData.schemaVersion!==1||root.userData.duration!==5.6||root.userData.killTime!==3.4||head?.parent!==root||fist?.parent!==root||mount?.parent!==head||eyes?.parent!==mount)throw Error('Invalid Gear 5 hierarchy');
  if(Math.abs(mount.position.y-.12)>1e-5||Math.abs(eyes.position.y-1.28)>1e-5||eyes.position.x!==0||eyes.position.z!==0)throw Error('Gear 5 attachment/pivot');
  const all=finiteMeshes(source);let headTriangles=352,fistTriangles=0;
  for(const batch of ['Skin','Clouds','Ink','EyeWhites','Iris','Pupils']){
    const mesh=source.getObjectByName(`PomuGear5_${batch}_${profile}`);if(!(mesh instanceof THREE.Mesh)||mesh.parent!==(batch==='EyeWhites'||batch==='Iris'||batch==='Pupils'?eyes:mount))throw Error('Missing expression batch');
    headTriangles+=triangles(mesh.geometry);
  }
  for(const batch of ['Hand','Seams']){const mesh:THREE.Object3D|undefined=fist.getObjectByName(`PomuHaki_${batch}_${profile}`);if(!(mesh instanceof THREE.Mesh)||mesh.parent!==fist)throw Error('Missing fist batch');fistTriangles+=triangles(mesh.geometry);}
  if(all.count!==8||headTriangles>(profile==='desktop'?6000:4000)||fistTriangles>(profile==='desktop'?3000:1800))throw Error('Gear 5 profile budget');
  const headBounds=new THREE.Box3().setFromObject(head),fistBounds=new THREE.Box3().setFromObject(fist);
  if(headBounds.min.y<.45||headBounds.max.y>3.1||Math.abs(headBounds.min.x+headBounds.max.x)>.05||headBounds.max.z<.75||fistBounds.min.z>-.8||fistBounds.max.z<.6||fistBounds.getSize(new THREE.Vector3()).x>1.6)throw Error('Gear 5 bounds/orientation');
  return {headTriangles,fistTriangles,headDrawsWithCoil:7,fistDrawsWithOutline:3};
}

/** Profile promises are retained, including failures. Clone removal owns no asset resources. */
class ProfileCache<T> {
  private pending=new Map<DetailProfile,Promise<boolean>>();private assets=new Map<DetailProfile,{source:THREE.Group;stats:T}>();private disposed=false;
  constructor(private loader:ProfileLoader,private validate:(source:THREE.Group,profile:DetailProfile)=>T,private prepare:(source:THREE.Group,profile:DetailProfile)=>void){}
  preload(profile:DetailProfile,loader:ProfileLoader=this.loader):Promise<boolean>{
    if(this.disposed)return Promise.resolve(false);let p=this.pending.get(profile);
    if(!p){p=loader(profile).then(source=>{
      try{const stats=this.validate(source,profile);if(this.disposed){disposeAsset(source);return false;}this.prepare(source,profile);this.assets.set(profile,{source,stats});return true;}
      catch(error){disposeAsset(source);throw error;}
    }).catch(error=>{console.warn('Living Shibuya / Gear 5 asset unavailable; procedural fallback',error);return false;});this.pending.set(profile,p);}return p;
  }
  source(profile:DetailProfile){return this.assets.get(profile)?.source;}
  stats(profile:DetailProfile){return this.assets.get(profile)?.stats;}
  dispose(){if(this.disposed)return;this.disposed=true;this.assets.forEach(a=>disposeAsset(a.source));this.assets.clear();}
}
function replaceMaterials(source:THREE.Group,create:(batch:string)=>THREE.Material){
  const originals=assetResources(source),materials=new Map<string,THREE.Material>();
  source.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const key=o.userData.batch as string;let material=materials.get(key);if(!material){material=create(key);materials.set(key,material);}o.material=material;o.geometry.userData.sharedLivingAsset=true;});
  originals.materials.forEach(m=>m.dispose());originals.textures.forEach(t=>t.dispose());
}
export class CityKitCache extends ProfileCache<ReturnType<typeof validateCityKit>>{
  constructor(loader:ProfileLoader=p=>loadGLB('shibuya/city-kit',p)){super(loader,validateCityKit,source=>replaceMaterials(source,batch=>batch==='Windows'?new THREE.MeshBasicMaterial({vertexColors:true}):new THREE.MeshLambertMaterial({vertexColors:true})));}
  family(profile:DetailProfile,family:CityFamily){return this.source(profile)?.getObjectByName(`City_${family}_${profile}`) as THREE.Group|undefined;}
  prop(profile:DetailProfile,name:'Meeting'|'Furniture'){return this.source(profile)?.getObjectByName(`City_${name}_${profile}`) as THREE.Group|undefined;}
}
export class PomuUltimateCache extends ProfileCache<ReturnType<typeof validatePomuUltimate>>{
  readonly outlineMaterial=new THREE.MeshBasicMaterial({color:'#34344b',side:THREE.BackSide});
  private outlines=new Map<DetailProfile,THREE.BufferGeometry>();
  constructor(loader:ProfileLoader=p=>loadGLB('pomu/pomu-ultimate',p)){super(loader,validatePomuUltimate,source=>{
    // Shared diffuse palette; the closed, outward-facing fist can cull its back faces.
    const mat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,emissive:'#ffffff',emissiveIntensity:.06});
    mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)\n totalEmissiveRadiance *= vColor.rgb;\n#endif');};mat.customProgramCacheKey=()=> 'gear5-vertex-palette';
    const hand=mat.clone();hand.side=THREE.FrontSide;hand.onBeforeCompile=mat.onBeforeCompile;hand.customProgramCacheKey=mat.customProgramCacheKey;
    replaceMaterials(source,batch=>batch==='Hand'?hand:mat);
  });}
  head(profile:DetailProfile){const original=this.source(profile)?.getObjectByName('PomuGear5Head_'+profile);if(!original)return;const head=original.clone(true) as THREE.Group;head.name='transformed-head-cloud';head.userData.gear5=true;
    const eyes=head.getObjectByName('PomuGear5Eyes_'+profile)!;eyes.name='eyes';eyes.position.z=0;head.userData.expressionPivot=eyes;return head;}
  outline(profile:DetailProfile){const source=this.source(profile)?.getObjectByName(`PomuGear5_Clouds_${profile}`) as THREE.Mesh|undefined;if(!source)return;let geometry=this.outlines.get(profile);if(!geometry){geometry=source.geometry.clone().translate(0,.12,0);geometry.userData.sharedLivingAsset=true;this.outlines.set(profile,geometry);}const mesh=new THREE.Mesh(geometry,this.outlineMaterial);mesh.userData.sharedSilhouette=true;return mesh;}
  fist(profile:DetailProfile){const source=this.source(profile)?.getObjectByName('PomuHakiFist_'+profile);if(!source)return;const group=source.clone(true) as THREE.Group;const hand=group.getObjectByName('PomuHaki_Hand_'+profile) as THREE.Mesh;const outline=new THREE.Mesh(hand.geometry,this.outlineMaterial);outline.scale.setScalar(1.015);group.add(outline);return group;}
  private outlineDisposed=false;
  override dispose(){super.dispose();if(!this.outlineDisposed){this.outlineDisposed=true;this.outlineMaterial.dispose();this.outlines.forEach(g=>g.dispose());this.outlines.clear();}}
}
async function loadGLB(path:string,profile:DetailProfile){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(`${import.meta.env?.BASE_URL??'/'}assets/${path}-${profile}.glb`,{signal:controller.signal});if(!response.ok)throw Error(`${path} HTTP ${response.status}`);return (await new GLTFLoader().parseAsync(await response.arrayBuffer(),'')).scene;}
  finally{clearTimeout(timer);}
}
export const cityKitAssets=new CityKitCache(),pomuUltimateAssets=new PomuUltimateCache();
export async function preloadLivingAssets(profile:DetailProfile){return Promise.all([cityKitAssets.preload(profile),pomuUltimateAssets.preload(profile)]);}
function disposeLiving(){cityKitAssets.dispose();pomuUltimateAssets.dispose();}
if(import.meta.hot)import.meta.hot.dispose(disposeLiving);
if(typeof window!=='undefined')window.addEventListener('pagehide',e=>{if(!e.persisted)disposeLiving();});
