import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DetailProfile } from './worlds/types';

const PALETTE = { Skin:'#ffc09a', Hair:'#ffd04d', Fabric:'#292b3e', Metal:'#bac0d1', Details:'#515366', CheekMarks:'#da7156', Mouth:'#994b36', EyeWhites:'#fff2ec', Pupils:'#221c29', Highlights:'#fffaf5' };
export const KITSU_BUDGET = { desktop:6000, mobile:4000 };
type Asset = { head:THREE.Group; outline:THREE.BufferGeometry; triangles:number; draws:number };
export type HeadLoader = (profile:DetailProfile)=>Promise<THREE.Group>;

/** Owns each imported resource once. Clones own transforms only. */
export class KitsuHeadCache {
  private promises = new Map<DetailProfile,Promise<boolean>>();
  private assets = new Map<DetailProfile,Asset>();
  private materials = new Map<string,THREE.MeshLambertMaterial>();
  private disposed = false;
  readonly outlineMaterial = new THREE.MeshBasicMaterial({color:'#25232c',side:THREE.BackSide});
  constructor(private loader:HeadLoader=loadGLB) {}
  preload(profile:DetailProfile, loader:HeadLoader=this.loader):Promise<boolean> {
    if(this.disposed)return Promise.resolve(false);
    let promise=this.promises.get(profile);
    if(!promise){
      promise=loader(profile).then(head=>{
        try {
          const stats=validateKitsuHead(head,profile);
          if(this.disposed){disposeImported(head);return false;}
          const outline=makeOutline(head);
          const imported=new Set<THREE.Material>();
          head.traverse(o=>{if(o instanceof THREE.Mesh){
            const key=o.userData.batch as keyof typeof PALETTE;
            const old=o.material as THREE.Material;imported.add(old);
            let material=this.materials.get(key);
            if(!material){material=new THREE.MeshLambertMaterial({color:PALETTE[key],emissive:PALETTE[key],emissiveIntensity:key==='Hair'?.22:key==='Skin'?.15:.025});this.materials.set(key,material);}
            o.material=material;
          }});
          imported.forEach(m=>m.dispose());
          this.assets.set(profile,{head,outline,...stats});return true;
        }catch(error){disposeImported(head);throw error;}
      }).catch(error=>{console.warn('Kitsu asset unavailable; using procedural head',error);return false;});
      this.promises.set(profile,promise);
    }
    return promise;
  }
  create(profile:DetailProfile){return this.assets.get(profile)?.head.clone(true);}
  outline(profile:DetailProfile){const asset=this.assets.get(profile);if(!asset)return;const mesh=new THREE.Mesh(asset.outline,this.outlineMaterial);mesh.userData.sharedSilhouette=true;return mesh;}
  stats(profile:DetailProfile){const a=this.assets.get(profile);return a?{triangles:a.triangles,draws:a.draws}:undefined;}
  dispose(){
    if(this.disposed)return;this.disposed=true;
    const geometries=new Set<THREE.BufferGeometry>();
    for(const asset of this.assets.values()){asset.head.traverse(o=>{if(o instanceof THREE.Mesh)geometries.add(o.geometry);});geometries.add(asset.outline);}
    geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.outlineMaterial.dispose();this.assets.clear();this.materials.clear();
  }
}
export function validateKitsuHead(head:THREE.Group,profile:DetailProfile){
  if(!head.getObjectByName('KitsuHead_'+profile))throw new Error('Missing KitsuHead root');
  const eyes=head.getObjectByName('EyesPivot_'+profile);
  if(!eyes||eyes.children.length!==3||!eyes.userData.previewEye||Math.abs(eyes.position.y-1.28)>.01)throw new Error('Missing blink pivot');
  let draws=0,triangles=0;const batches=new Set<string>();
  head.traverse(o=>{
    if(o instanceof THREE.Camera||o instanceof THREE.Light||o instanceof THREE.SkinnedMesh)throw new Error('Unexpected runtime node');
    if(!(o instanceof THREE.Mesh))return;
    if(Array.isArray(o.material)||!(o.userData.batch in PALETTE))throw new Error('Unexpected material batch');
    if(o.scale.distanceTo(new THREE.Vector3(1,1,1))>.0001||o.quaternion.angleTo(new THREE.Quaternion())>.0001)throw new Error('Unapplied mesh transform');
    const position=o.geometry.getAttribute('position'),normal=o.geometry.getAttribute('normal');
    if(!position||!normal||position.count!==normal.count)throw new Error('Missing geometry normals');
    for(const attr of [position,normal])for(let i=0;i<attr.array.length;i++)if(!Number.isFinite(attr.array[i]))throw new Error('Nonfinite geometry');
    for(let i=0;i<normal.count;i++){const n=new THREE.Vector3().fromBufferAttribute(normal,i);if(n.lengthSq()<.5||n.lengthSq()>1.5)throw new Error('Invalid normal');}
    triangles+=(o.geometry.index?.count??position.count)/3;draws++;batches.add(o.userData.batch);
  });
  if(draws>12||triangles+352>KITSU_BUDGET[profile]||batches.size!==10)throw new Error('Head exceeds profile budget or lacks details');
  head.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(head),size=bounds.getSize(new THREE.Vector3());
  if(bounds.min.y<.25||bounds.max.y>3.2||size.x<2.4||size.x>3.2||size.z>2.5)throw new Error('Invalid attachment bounds');
  const pupils=head.getObjectByName('Kitsu_Pupils_'+profile);if(!pupils||new THREE.Box3().setFromObject(pupils).getCenter(new THREE.Vector3()).z<.55)throw new Error('Face must point +Z');
  return {triangles,draws};
}
function disposeImported(head:THREE.Group){const g=new Set<THREE.BufferGeometry>(),m=new Set<THREE.Material>();head.traverse(o=>{if(o instanceof THREE.Mesh){g.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])m.add(material);}});g.forEach(x=>x.dispose());m.forEach(x=>x.dispose());}
function makeOutline(head:THREE.Group){
  head.updateMatrixWorld(true);const pieces:THREE.BufferGeometry[]=[];
  head.traverse(o=>{if(!(o instanceof THREE.Mesh)||!o.userData.silhouette)return;
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const position=g.getAttribute('position');const indices:number[]=[];
    for(let i=0;i<(g.index?.count??position.count);i+=3){const a=g.index?.getX(i)??i,b=g.index?.getX(i+1)??i+1,c=g.index?.getX(i+2)??i+2;if(Math.min(position.getY(a),position.getY(b),position.getY(c))>1.52&&(position.getZ(a)+position.getZ(b)+position.getZ(c))/3<.35)indices.push(a,b,c);}
    g.setIndex(indices);
    // A narrow normal offset avoids outlining the intersections of hair clumps.
    const normals=g.getAttribute('normal');
    for(let i=0;i<position.count;i++)position.setXYZ(i,position.getX(i)+normals.getX(i)*.007,position.getY(i)+normals.getY(i)*.007,position.getZ(i)+normals.getZ(i)*.007);
    // Drop unused vertices so bounds describe the actual restrained crown shell.
    const expanded=g.toNonIndexed();g.dispose();for(const key of Object.keys(expanded.attributes))if(key!=='position'&&key!=='normal')expanded.deleteAttribute(key);pieces.push(expanded);
  });
  const result=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(!result)throw new Error('Missing silhouette');result.computeBoundingSphere();return result;
}
async function loadGLB(profile:DetailProfile){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {const response=await fetch(`${import.meta.env?.BASE_URL??'/'}assets/kitsu/kitsu-head-${profile}.glb`,{signal:controller.signal});if(!response.ok)throw new Error(`Head HTTP ${response.status}`);const buffer=await response.arrayBuffer();return (await new GLTFLoader().parseAsync(buffer,'')).scene;}
  finally {clearTimeout(timer);}
}
export const kitsuHeads=new KitsuHeadCache();
let active:DetailProfile='desktop';
export const activeKitsuProfile=()=>active;
export const selectKitsuProfile=(profile:DetailProfile)=>{active=profile;};
if(import.meta.hot)import.meta.hot.dispose(()=>kitsuHeads.dispose());
if(typeof window!=='undefined')window.addEventListener('pagehide',event=>{if(!event.persisted)kitsuHeads.dispose();});

