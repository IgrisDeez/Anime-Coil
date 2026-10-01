/** Read-only extraction of the other existing game heads for Blender scale review. */
import {writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createHead} from '../src/models';
import {CHARACTERS} from '../src/simulation';
const characters=[];
for(const id of ['nova','cloud','eclipse'] as const){
 const root=createHead(id);root.updateMatrixWorld(true);const meshes=[];
 root.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;
  const geo=o.geometry,p=geo.getAttribute('position'),c=geo.getAttribute('color');
  const material=o.material as THREE.MeshToonMaterial;
  const vertices:number[][]=[],colors:number[][]=[];
  for(let i=0;i<p.count;i++){
   vertices.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray().map(n=>Number(n.toFixed(5))));
 if(c&&material.vertexColors)colors.push([c.getX(i),c.getY(i),c.getZ(i)].map(n=>Number(n.toFixed(5))));
  }
  const indices=geo.index?Array.from(geo.index.array):Array.from({length:p.count},(_,i)=>i);
  meshes.push({vertices,indices,color:material.color.toArray(),colors});
 });
 characters.push({id,name:CHARACTERS.find(c=>c.id===id)!.name,meshes});
}
for(const character of characters)await writeFile(new URL(`../assets/kitsu/candidates/chibi-naruto/existing-head-${character.id}.json`,import.meta.url),JSON.stringify(character));
console.log(characters.map(c=>({name:c.name,meshCount:c.meshes.length,triangles:c.meshes.reduce((n,m)=>n+m.indices.length/3,0)})));
