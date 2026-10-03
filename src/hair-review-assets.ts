// Shared textured-head cache used by the approved game assets and isolated review fixtures.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {KitsuHeadCache,validateKitsuHead} from './kitsu-head';
import {RosterHeadCache,ROSTER_NAMES,validateRosterHead} from './roster-head';
import type {CharacterId} from './simulation';
import type {DetailProfile} from './worlds/types';

export const HAIR_NAMES={ember:'Kitsu',...ROSTER_NAMES} as const;
export type HairLoader=(id:CharacterId,profile:DetailProfile)=>Promise<THREE.Group>;
const keyFor=(id:CharacterId,profile:DetailProfile)=>id+'|'+profile;

export function validateHairHead(head:THREE.Group,id:CharacterId,profile:DetailProfile){
  const stats=id==='ember'?validateKitsuHead(head,profile):validateRosterHead(head,id,profile);
  const hair=head.getObjectByName(`${HAIR_NAMES[id]}_Hair_${profile}`) as THREE.Mesh|undefined;
  if(!hair||hair.userData.hairRevision!=='layered-textured-review')throw Error('Missing revised hair');
  const uv=hair.geometry.getAttribute('uv'),p=hair.geometry.getAttribute('position');
  if(!uv||uv.count!==p.count||uv.itemSize!==2)throw Error('Missing hair flow UVs');
  for(const value of uv.array)if(!Number.isFinite(value)||value<0||value>1)throw Error('Invalid hair flow UV');
  const material=hair.material as THREE.MeshStandardMaterial,map=material.map,size=profile==='desktop'?512:256;
  if(!map||map.colorSpace!==THREE.SRGBColorSpace||map.image.width!==size||map.image.height!==size)throw Error('Wrong hair texture profile');
  if(hair.userData.lockCount!==(id==='ember'?27:25))throw Error('Missing shaped locks');
  return {...stats,textureSize:size,locks:hair.userData.lockCount as number};
}

function disposeSource(head:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  head.traverse(o=>{if(!(o instanceof THREE.Mesh))return;geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}
  });
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}

function tipOutline(head:THREE.Group){
  const pieces:THREE.BufferGeometry[]=[];head.updateMatrixWorld(true);
  head.traverse(o=>{if(!(o instanceof THREE.Mesh)||!o.userData.silhouette)return;
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),indices:number[]=[];
    for(let i=0;i<(g.index?.count??p.count);i+=3){
      const a=g.index?.getX(i)??i,b=g.index?.getX(i+1)??i+1,c=g.index?.getX(i+2)??i+2;
      if(o.userData.batch==='Hair'){
        // Outline tips and outer rear faces; never exposed root caps or seams
        // between overlapping clumps. All locks have the same padded flow UV.
        // Blender's V coordinate is inverted by glTF export.
        const t=[a,b,c].reduce((sum,k)=>sum+(.975-(uv.getY(k)*2)%1)/.95,0)/3;
        if(t<.45||Math.min(p.getY(a),p.getY(b),p.getY(c))<1.5||(p.getZ(a)+p.getZ(b)+p.getZ(c))/3>.40)continue;
        const center=new THREE.Vector3((p.getX(a)+p.getX(b)+p.getX(c))/3,(p.getY(a)+p.getY(b)+p.getY(c))/3-2.1,(p.getZ(a)+p.getZ(b)+p.getZ(c))/3+.10);
        const normal=new THREE.Vector3(n.getX(a)+n.getX(b)+n.getX(c),n.getY(a)+n.getY(b)+n.getY(c),n.getZ(a)+n.getZ(b)+n.getZ(c));
        if(center.dot(normal)<.10)continue;
      }else if(o.userData.batch!=='Hat'&&(Math.min(p.getY(a),p.getY(b),p.getY(c))<1.5||(p.getZ(a)+p.getZ(b)+p.getZ(c))/3>.35))continue;
      indices.push(a,b,c);
    }
    if(!indices.length){g.dispose();return;}g.setIndex(indices);
    for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)+n.getX(i)*.004,p.getY(i)+n.getY(i)*.004,p.getZ(i)+n.getZ(i)*.004);
    const shell=g.toNonIndexed();g.dispose();for(const key of Object.keys(shell.attributes))if(key!=='position'&&key!=='normal')shell.deleteAttribute(key);pieces.push(shell);
  });
  const result=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(!result)throw Error('Missing hair silhouette');result.computeBoundingSphere();return result;
}

/** Reuses the working head caches; owns only the new profile-specific hair maps. */
export class HairReviewCache {
  private kitsu:KitsuHeadCache;
  private roster:RosterHeadCache;
  private pending=new Map<string,Promise<boolean>>();
  private paint=new Map<string,{texture:THREE.Texture;material:THREE.MeshLambertMaterial;outline:THREE.BufferGeometry}>();
  private disposed=false;
  constructor(private loader:HairLoader){
    this.kitsu=new KitsuHeadCache(p=>this.load('ember',p));
    this.roster=new RosterHeadCache((id,p)=>this.load(id,p));
  }
  private async load(id:CharacterId,profile:DetailProfile){
    const head=await this.loader(id,profile);
    try{validateHairHead(head,id,profile);}catch(error){disposeSource(head);throw error;}
    if(this.disposed){disposeSource(head);throw Error('Head cache closed');}
    const hair=head.getObjectByName(`${HAIR_NAMES[id]}_Hair_${profile}`) as THREE.Mesh;
    const texture=(hair.material as THREE.MeshStandardMaterial).map!;
    const material=new THREE.MeshLambertMaterial({color:'#ffffff',map:texture,emissive:'#ffffff',emissiveMap:texture,emissiveIntensity:id==='ember'?.22:.07});
    material.name=HAIR_NAMES[id]+'_Shared_Hair_'+profile;
    const outline=tipOutline(head);
    this.paint.set(keyFor(id,profile),{texture,material,outline});return head;
  }
  preload(id:CharacterId,profile:DetailProfile){
    if(this.disposed)return Promise.resolve(false);
    const key=keyFor(id,profile);let pending=this.pending.get(key);
    if(!pending){pending=(id==='ember'?this.kitsu.preload(profile):this.roster.preload(id,profile)).then(ok=>{
      if(!ok){const paint=this.paint.get(key);if(paint){paint.material.dispose();paint.texture.dispose();paint.outline.dispose();this.paint.delete(key);}}
      return ok;
    });this.pending.set(key,pending);}return pending;
  }
  create(id:CharacterId,profile:DetailProfile){
    const paint=this.paint.get(keyFor(id,profile));
    const head=id==='ember'?this.kitsu.create(profile):this.roster.create(id,profile);
    if(!head||!paint)return;
    (head.getObjectByName(`${HAIR_NAMES[id]}_Hair_${profile}`) as THREE.Mesh).material=paint.material;
    return head;
  }
  outline(id:CharacterId,profile:DetailProfile){
    const paint=this.paint.get(keyFor(id,profile));if(!paint||!this.stats(id,profile))return;
    const mesh=new THREE.Mesh(paint.outline,id==='ember'?this.kitsu.outlineMaterial:this.roster.outlineMaterial);mesh.userData.sharedSilhouette=true;return mesh;
  }
  stats(id:CharacterId,profile:DetailProfile){return id==='ember'?this.kitsu.stats(profile):this.roster.stats(id,profile);}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.kitsu.dispose();this.roster.dispose();
    const textures=new Set<THREE.Texture>();for(const paint of this.paint.values()){paint.material.dispose();paint.outline.dispose();textures.add(paint.texture);}
    textures.forEach(t=>t.dispose());this.paint.clear();
  }
}
