import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {KitsuHeadCache} from '../src/kitsu-head';
for(const profile of ['desktop','mobile'] as const){
const b=await readFile(`public/assets/kitsu/kitsu-head-${profile}.glb`);
const cache=new KitsuHeadCache(async()=> (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene);
await cache.preload(profile);const h=cache.create(profile)!,eye=h.getObjectByName('Kitsu_EyeWhites_'+profile) as T.Mesh,p=eye.geometry.getAttribute('position'),ix=eye.geometry.index,ray=new T.Raycaster(),skin=h.getObjectByName('Kitsu_Skin_'+profile) as T.Mesh;
let min=Infinity,max=-Infinity,highest:any,lowest:any;const blocked:Record<string,number>={};const meshes:T.Mesh[]=[];h.traverse(o=>{if(o instanceof T.Mesh&&!/EyeWhites|Pupils|Iris|Highlights/.test(o.name))meshes.push(o)});
for(let step=0;step<=20;step++){
h.getObjectByName('EyesPivot_'+profile)!.scale.y=.08+.92*step/20;h.updateMatrixWorld(true);
for(let i=0;i<(ix?.count??p.count);i+=3){
const a=new T.Vector3().fromBufferAttribute(p,ix?.getX(i)??i),bb=new T.Vector3().fromBufferAttribute(p,ix?.getX(i+1)??i+1),c=new T.Vector3().fromBufferAttribute(p,ix?.getX(i+2)??i+2);
for(let u=0;u<=4;u++)for(let w=0;w<=4-u;w++){
const v=a.clone().multiplyScalar(u/4).addScaledVector(bb,w/4).addScaledVector(c,1-(u+w)/4).applyMatrix4(eye.matrixWorld);
ray.set(new T.Vector3(v.x,v.y,2),new T.Vector3(0,0,-1));const hit=ray.intersectObject(skin,false)[0];if(hit){const d=v.z-hit.point.z;if(d<min){min=d;lowest={step,v:v.toArray()}}if(d>max){max=d;highest={step,v:v.toArray()}}}
if(step===20){const dir=new T.Vector3(-.17,-.47,-.87).normalize();ray.set(v.clone().addScaledVector(dir,-5),dir);const hit=ray.intersectObjects(meshes,false)[0];if(hit&&hit.distance<5-.001)blocked[hit.object.name]=(blocked[hit.object.name]||0)+1;}
}
}
}
console.log({profile,min,max,lowest,highest,blocked});cache.dispose();
}
