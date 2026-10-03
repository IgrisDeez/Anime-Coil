import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {DetailProfile} from './worlds/types';

export type RosterId='nova'|'cloud'|'eclipse';
export const ROSTER_NAMES={nova:'Kairo',cloud:'Pomu',eclipse:'Shiro'} as const;
export type RosterLoader=(id:RosterId,profile:DetailProfile)=>Promise<THREE.Group>;
const EYE_BATCHES=['EyeWhites','Pupils','Iris','Highlights'] as const;
const COMMON=['Skin','Hair','Mouth','Blush'];
const KEYS:Record<RosterId,readonly string[]>={nova:[...COMMON,'FaceInk',...EYE_BATCHES],cloud:[...COMMON,'FaceInk','Hat','HatBand',...EYE_BATCHES],eclipse:[...COMMON,'Fabric','Trim']};
function resources(head:THREE.Object3D){const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();head.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});return {geometries,materials};}
function disposeImported(head:THREE.Object3D){const r=resources(head);r.geometries.forEach(g=>g.dispose());r.materials.forEach(m=>m.dispose());}
export function validateRosterHead(head:THREE.Group,id:RosterId,profile:DetailProfile){
  const name=ROSTER_NAMES[id],root=head.getObjectByName(name+'Head_'+profile),mount=head.getObjectByName(name+'SculptMount_'+profile),eyes=head.getObjectByName(name+'EyesPivot_'+profile);
  if(!root||root.userData.schemaVersion!==1||root.userData.characterId!==id||root.position.lengthSq()>1e-8)throw Error('Invalid roster root');
  if(!mount||mount.parent!==root||Math.abs(mount.position.y-.12)>1e-5||Math.abs(mount.position.x)+Math.abs(mount.position.z)>1e-5)throw Error('Invalid coil mount');
  if(!eyes||eyes.parent!==mount||!eyes.userData.previewEye||Math.abs(eyes.position.y-1.28)>1e-5)throw Error('Invalid blink pivot');
  if(id!=='eclipse'&&(eyes.children.length!==4||EYE_BATCHES.some(k=>head.getObjectByName(`${name}_${k}_${profile}`)?.parent!==eyes)))throw Error('Missing independent eye batches');
  let triangles=0,draws=0;const keys=new Set<string>();
  head.traverse(o=>{
    if(o instanceof THREE.Camera||o instanceof THREE.Light||o instanceof THREE.SkinnedMesh)throw Error('Unexpected runtime node');
    if(!(o instanceof THREE.Mesh))return;
    const key=o.userData.batch;
    if(!KEYS[id].includes(key)||keys.has(key)||Array.isArray(o.material)||o.name!==`${name}_${key}_${profile}`)throw Error('Unexpected head batch');
    if(o.position.lengthSq()>1e-8||o.scale.distanceTo(new THREE.Vector3(1,1,1))>1e-5||o.quaternion.angleTo(new THREE.Quaternion())>1e-5)throw Error('Unapplied mesh transform');
    const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal');
    if(!p||!n||p.count!==n.count)throw Error('Missing geometry');
    for(const a of [p,n])for(const v of a.array)if(!Number.isFinite(v))throw Error('Nonfinite geometry');
    for(let i=0;i<n.count;i++){const len=n.getX(i)**2+n.getY(i)**2+n.getZ(i)**2;if(len<.5||len>1.5)throw Error('Invalid normal');}
    const color=o.geometry.getAttribute('color');if(color)for(let i=0;i<color.count;i++)for(let c=0;c<color.itemSize;c++){const v=color.getComponent(i,c);if(!Number.isFinite(v)||v<0||v>1.001)throw Error('Invalid vertex paint');}
    triangles+=(o.geometry.index?.count??p.count)/3;draws++;keys.add(key);
  });
  if(triangles+352>(profile==='mobile'?4000:6000)||draws+1>12||keys.size!==KEYS[id].length)throw Error('Head exceeds budget or lacks details');
  head.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(head),size=b.getSize(new THREE.Vector3());
  if(b.min.y<.28||b.max.y>3.2||size.x<2||size.x>3||size.z>2.6||size.z<1.25)throw Error('Invalid attachment bounds');
  if(id!=='eclipse'&&new THREE.Box3().setFromObject(head.getObjectByName(`${name}_Pupils_${profile}`)!).getCenter(new THREE.Vector3()).z<.55)throw Error('Face must point +Z');
  return {triangles,draws,trianglesWithCoil:triangles+352,drawsWithCoil:draws+1,bounds:{min:b.min.toArray(),max:b.max.toArray()}};
}
function silhouette(head:THREE.Group){
  const pieces:THREE.BufferGeometry[]=[];head.updateMatrixWorld(true);
  head.traverse(o=>{if(!(o instanceof THREE.Mesh)||!o.userData.silhouette)return;
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld),p=g.getAttribute('position'),n=g.getAttribute('normal'),indices:number[]=[];
    for(let i=0;i<(g.index?.count??p.count);i+=3){const a=g.index?.getX(i)??i,b=g.index?.getX(i+1)??i+1,c=g.index?.getX(i+2)??i+2;
      if(o.userData.batch==='Hat'||Math.min(p.getY(a),p.getY(b),p.getY(c))>1.45&&(p.getZ(a)+p.getZ(b)+p.getZ(c))/3<.4)indices.push(a,b,c);
    }
    if(!indices.length){g.dispose();return;}g.setIndex(indices);
    for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)+n.getX(i)*.007,p.getY(i)+n.getY(i)*.007,p.getZ(i)+n.getZ(i)*.007);
    const expanded=g.toNonIndexed();g.dispose();for(const key of Object.keys(expanded.attributes))if(key!=='position'&&key!=='normal')expanded.deleteAttribute(key);pieces.push(expanded);
  });
  const result=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(!result)throw Error('Missing silhouette');result.computeBoundingSphere();return result;
}
/** Shared sculpted roster resources with independent clone transforms. */
export class RosterHeadCache {
  private pending=new Map<string,Promise<boolean>>();
  private assets=new Map<string,{head:THREE.Group;outline:THREE.BufferGeometry;stats:ReturnType<typeof validateRosterHead>}>();
  private materials=new Map<string,THREE.MeshLambertMaterial>();
  private disposed=false;
  readonly outlineMaterial=new THREE.MeshBasicMaterial({color:'#25232c',side:THREE.BackSide});
  constructor(private loader:RosterLoader){}
  preload(id:RosterId,profile:DetailProfile){
    if(this.disposed)return Promise.resolve(false);const key=id+'|'+profile;let promise=this.pending.get(key);
    if(!promise){promise=this.loader(id,profile).then(head=>{
      try{const stats=validateRosterHead(head,id,profile);if(this.disposed){disposeImported(head);return false;}
        const outline=silhouette(head),imported=new Set<THREE.Material>();head.getObjectByName(ROSTER_NAMES[id]+'EyesPivot_'+profile)!.position.z+=.035;
        head.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const old=o.material as THREE.MeshStandardMaterial,k=id+'|'+o.userData.batch;imported.add(old);
          let mat=this.materials.get(k);if(!mat){mat=new THREE.MeshLambertMaterial({color:old.color,vertexColors:!!o.geometry.getAttribute('color'),side:old.side,emissive:old.color,emissiveIntensity:o.userData.batch==='Skin'?.12:o.userData.batch==='Hair'?.07:.025});this.materials.set(k,mat);}o.material=mat;o.userData.sharedRoster=true;
        });imported.forEach(m=>m.dispose());this.assets.set(key,{head,outline,stats});return true;
      }catch(e){disposeImported(head);throw e;}
    }).catch(()=>false);this.pending.set(key,promise);}return promise;
  }
  create(id:RosterId,profile:DetailProfile){return this.assets.get(id+'|'+profile)?.head.clone(true);}
  outline(id:RosterId,profile:DetailProfile){const a=this.assets.get(id+'|'+profile);if(!a)return;const mesh=new THREE.Mesh(a.outline,this.outlineMaterial);mesh.userData.sharedSilhouette=true;return mesh;}
  stats(id:RosterId,profile:DetailProfile){return this.assets.get(id+'|'+profile)?.stats;}
  dispose(){if(this.disposed)return;this.disposed=true;const geometries=new Set<THREE.BufferGeometry>();for(const a of this.assets.values()){resources(a.head).geometries.forEach(g=>geometries.add(g));geometries.add(a.outline);}geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.outlineMaterial.dispose();this.assets.clear();this.materials.clear();}
}
