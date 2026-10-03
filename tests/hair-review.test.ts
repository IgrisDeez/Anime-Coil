import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {HairReviewCache,HAIR_NAMES,validateHairHead} from '../src/hair-review-assets';
import type {CharacterId} from '../src/simulation';
import type {DetailProfile} from '../src/worlds/types';

// Node has no image decoder. Verify embedded PNG dimensions here; browser
// review separately decodes and renders the real pixels with WebGL.
Object.assign(globalThis,{self:globalThis,createImageBitmap:async(blob:Blob)=>{
  const data=new DataView(await blob.arrayBuffer());
  assert.equal(data.getUint32(0),0x89504e47);assert.equal(data.getUint32(12),0x49484452);
  return {width:data.getUint32(16),height:data.getUint32(20),close(){}};
}});
const IDS=['ember','nova','cloud','eclipse'] as const;
async function parse(file:string){const bytes=await readFile(file);return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;}
async function load(id:CharacterId,profile:DetailProfile){const n=HAIR_NAMES[id].toLowerCase();return parse(`assets/roster/hair-review/${n}/${n}-head-${profile}.glb`);}
async function before(id:CharacterId,profile:DetailProfile){const n=HAIR_NAMES[id].toLowerCase();return parse(id==='ember'?`public/assets/kitsu/${n}-head-${profile}.glb`:`assets/roster/candidates/${n}/${n}-head-${profile}.glb`);}
function triangles(mesh:THREE.Mesh){
  const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index,out:string[]=[];
  for(let i=0;i<(index?.count??p.count);i+=3){const points:string[]=[];
    for(let j=0;j<3;j++){const k=index?.getX(i+j)??i+j;points.push([p.getX(k),p.getY(k),p.getZ(k)].map(v=>v.toFixed(5)).join(','));}
    out.push(points.sort().join('|'));
  }return out.sort();
}

test('eight real exports retain non-hair geometry, orientation, pivots, profile budgets and one packed diffuse map',async()=>{
  for(const id of IDS)for(const profile of ['desktop','mobile'] as const){
    const next=await load(id,profile),old=await before(id,profile),stats=validateHairHead(next,id,profile);
    assert.ok(stats.triangles+352<=(profile==='desktop'?6000:4000));assert.ok(stats.draws+1<=12);
    let maps=0;next.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
      const m=o.material as THREE.MeshStandardMaterial;if(m.map)maps++;
      if(o.userData.batch!=='Hair'){const previous=old.getObjectByName(o.name) as THREE.Mesh;assert.ok(previous,o.name);assert.deepEqual(triangles(o),triangles(previous),o.name);}
    });assert.equal(maps,1);
    const nextPivot=next.getObjectByName((id==='ember'?'EyesPivot_':HAIR_NAMES[id]+'EyesPivot_')+profile)!;
    assert.equal(nextPivot.children.length,id==='eclipse'?0:4);
  }
});

test('profile maps and all clone resources are shared, blinks independent, and teardown disposes each owned resource once',async()=>{
  const requests:string[]=[];const cache=new HairReviewCache((id,p)=>{requests.push(id+'|'+p);return load(id,p);});
  const events=new Map<object,number>(),owned=new Set<THREE.BufferGeometry|THREE.Material|THREE.Texture>();
  function observe(head:THREE.Object3D){head.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const m=o.material as THREE.MeshLambertMaterial;
    for(const r of [o.geometry,m,...(m.map?[m.map]:[])])if(!owned.has(r)){owned.add(r);r.addEventListener('dispose',()=>events.set(r,(events.get(r)??0)+1));}
  });}
  for(const id of IDS){
    assert.deepEqual(await Promise.all([cache.preload(id,'mobile'),cache.preload(id,'mobile')]),[true,true]);assert.equal(cache.stats(id,'desktop'),undefined);
    const a=cache.create(id,'mobile')!,b=cache.create(id,'mobile')!;observe(a);observe(cache.outline(id,'mobile')!);
    a.traverse(o=>{if(o instanceof THREE.Mesh){const peer=b.getObjectByName(o.name) as THREE.Mesh;assert.equal(o.geometry,peer.geometry);assert.equal(o.material,peer.material);}});
    const pivot=(id==='ember'?'EyesPivot_':HAIR_NAMES[id]+'EyesPivot_')+'mobile';a.getObjectByName(pivot)!.scale.y=.05;assert.equal(b.getObjectByName(pivot)!.scale.y,1);
    a.removeFromParent();assert.equal(events.size,0);assert.equal(await cache.preload(id,'desktop'),true);
    const desktop=cache.create(id,'desktop')!;observe(desktop);observe(cache.outline(id,'desktop')!);
    const material=(a.getObjectByName(`${HAIR_NAMES[id]}_Hair_mobile`) as THREE.Mesh).material as THREE.MeshLambertMaterial;
    const high=(desktop.getObjectByName(`${HAIR_NAMES[id]}_Hair_desktop`) as THREE.Mesh).material as THREE.MeshLambertMaterial;
    assert.notEqual(material.map,high.map);assert.equal(material.map!.image.width,256);assert.equal(high.map!.image.width,512);
  }
  assert.equal(requests.length,8);cache.dispose();cache.dispose();assert.equal(events.size,owned.size);for(const r of owned)assert.equal(events.get(r),1);
});

test('failed, malformed and late textured assets fall back and release their image resources once',async()=>{
  const failed=new HairReviewCache(async()=>{throw Error('offline');});assert.equal(await failed.preload('cloud','mobile'),false);assert.equal(failed.create('cloud','mobile'),undefined);failed.dispose();
  const bad=await load('nova','mobile');const hair=bad.getObjectByName('Kairo_Hair_mobile') as THREE.Mesh;hair.geometry.getAttribute('uv').setX(0,NaN);
  let disposed=0;((hair.material as THREE.MeshStandardMaterial).map!).addEventListener('dispose',()=>disposed++);
  const invalid=new HairReviewCache(async()=>bad);assert.equal(await invalid.preload('nova','mobile'),false);invalid.dispose();assert.equal(disposed,1);
  let resolve!:(head:THREE.Group)=>void;const late=new HairReviewCache(()=>new Promise(r=>resolve=r));const pending=late.preload('eclipse','desktop');late.dispose();
  const head=await load('eclipse','desktop'),map=((head.getObjectByName('Shiro_Hair_desktop') as THREE.Mesh).material as THREE.MeshStandardMaterial).map!;let count=0;map.addEventListener('dispose',()=>count++);
  resolve(head);assert.equal(await pending,false);assert.equal(count,1);late.dispose();assert.equal(count,1);
});
