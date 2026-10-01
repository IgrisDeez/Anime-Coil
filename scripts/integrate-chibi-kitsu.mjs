/** Promote the visually approved GLBs, preserving their entire geometry binary. */
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
for(const profile of ['desktop','mobile']){
 const original=await readFile(new URL(`assets/kitsu/candidates/chibi-naruto/kitsu-head-${profile}.glb`,root));
 assert.equal(original.readUInt32LE(0),0x46546c67);assert.equal(original.readUInt32LE(4),2);
 const length=original.readUInt32LE(12);assert.equal(original.readUInt32LE(16),0x4e4f534a);
 const document=JSON.parse(original.subarray(20,20+length).toString('utf8'));
 const head=document.nodes.find(n=>n.name===`KitsuHead_${profile}`);assert.ok(head);
 head.extras={...head.extras,assetVersion:JSON.parse(await readFile(new URL('package.json',root),'utf8')).version,reviewStatus:'APPROVED',style:'Balanced Chibi Naruto'};
 const json=Buffer.from(JSON.stringify(document)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(padded);
 const binary=original.subarray(20+length),header=Buffer.alloc(20);
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+binary.length,8);
 header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const promoted=Buffer.concat([header,padded,binary]);assert.deepEqual(promoted.subarray(20+padded.length),binary);
 await writeFile(new URL(`public/assets/kitsu/kitsu-head-${profile}.glb`,root),promoted);
 console.log(profile,'approved geometry preserved; runtime bytes',promoted.length);
}
