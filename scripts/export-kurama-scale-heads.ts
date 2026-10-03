import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {kitsuHeads,selectKitsuProfile} from '../src/kitsu-head.ts';
import {createHead} from '../src/models.ts';
import {serpentScale} from '../src/simulation.ts';
class BlobReader {result:ArrayBuffer|string|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}}
(globalThis as unknown as {FileReader:unknown}).FileReader=BlobReader;
const out='assets/kurama/candidates/chibi-review/scale-heads';await mkdir(out,{recursive:true});
selectKitsuProfile('desktop');await kitsuHeads.preload('desktop',async()=>{const b=await readFile('public/assets/kitsu/kitsu-head-desktop.glb');return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;});
for(const id of ['ember','eclipse','cloud','nova'] as const){const head=createHead(id);head.name='ScaleStudy_'+id;head.scale.setScalar(serpentScale(48));const result=await new GLTFExporter().parseAsync(head,{binary:true,onlyVisible:true});await writeFile(`${out}/${id}.glb`,Buffer.from(result as ArrayBuffer));}
console.log(JSON.stringify({foxScale:1.8,headScale:serpentScale(48),mass:48,attachment:'Current createHead output including original coil, Kitsu eye clearance applied'}));
