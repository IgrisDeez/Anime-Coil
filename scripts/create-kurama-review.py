"""Create the isolated candidate from the preserved cinematic implementation.
Generate a separate re-review module without overwriting the approved runtime.
"""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
text=(root/'src/fox-procedural-review.ts').read_text(encoding='utf-8')
def change(old,new):
    global text
    if old not in text:raise ValueError('Missing baseline hook: '+old[:80])
    text=text.replace(old,new)
change("import { createFoxSummon, foxTailGeometry } from './fox-model';", "import { foxTailGeometry, type FoxSummonModel } from './fox-model';\nimport { createKuramaSummon, kuramaAssets, disposeKuramaInstance, kuramaFadeMaterial } from './kurama-assets';")
change('export class FoxCinematic','export class KuramaReviewCinematic')
change('private sculpture = createFoxSummon();\n  private beast = this.sculpture.beast;', 'private sculpture: FoxSummonModel;\n  private beast: THREE.Group;')
change('private disposed = false;', 'private disposed = false;\n  private coverageSamples=0;')
change("constructor(scene: THREE.Scene, private profile: DetailProfile = 'desktop') {", "constructor(scene: THREE.Scene, private profile: DetailProfile = 'desktop') {\n    this.sculpture=createKuramaSummon(profile);this.beast=this.sculpture.beast;")
change("new THREE.InstancedMesh(foxTailGeometry(), new THREE.MeshToonMaterial({vertexColors:true,\n      emissive:'#a65117',emissiveIntensity:.16,transparent:true,opacity:.94}), 9)", "new THREE.InstancedMesh(kuramaAssets.tail(profile)??foxTailGeometry(), kuramaFadeMaterial(), 9)")
change("glow('#ad4b1f', .85)", "glow('#9b581d', .75)")
change('vec3 dark=vec3(.035,.006,.017), ember=vec3(.43,.045,.025);', 'vec3 dark=vec3(.016,.006,.029), ember=vec3(.125,.030,.24);')
change('color+=vec3(1.,.31,.035)*hot*(1.1+pressure*.35);','color+=vec3(.28,.065,.45)*hot*(.55+pressure*.25);')
change('float rim=pow(1.-abs(viewNormal.z),3.2);','float rim=pow(1.-abs(viewNormal.z),5.8);')
change('color+=vec3(.77,.17,.035)*rim*.42;','color+=vec3(.38,.045,.60)*rim*.40;')
change('float rim=pow(1.-abs(viewNormal.z),2.5);', 'float rim=pow(1.-abs(viewNormal.z),5.5);')
change('vec3(1.,.29,.055)','vec3(.65,.12,.95)')
change("glow('#ffb34c', .3)","glow('#8b58cc', .25)")
change("['#ffe0a1','#f78b39','#b9472d','#ffb44e']", "['#c29be8','#895cc2','#513d7b','#a375d1']")
change("glow('#74534b',.48)","glow('#514859',.42)")
change("glow('#ffb653',.8)","glow('#a982e3',.7)")
change("i === 1 ? '#9e4931' : '#ffe1a0'", "i === 1 ? '#665080' : '#b497da'")
change("color: '#ffe3a0'", "color: '#ba8cef'")
change("color:'#ffcb70'", "color:'#c493f0'")
change('setProfile(profile: DetailProfile) { this.profile = profile; }', '''setMultisampleFade(samples:number){
    this.coverageSamples=samples;
    for(const m of this.beastMaterials)if(m instanceof THREE.MeshToonMaterial){m.alphaHash=samples<=0;m.alphaToCoverage=samples>0;m.transparent=false;m.needsUpdate=true;}
  }
  setProfile(profile: DetailProfile) {
    if(this.disposed||profile===this.profile)return;
    this.profile=profile;
    const promote=()=>{if(!this.disposed&&this.profile===profile)this.swapSculpt(profile);};
    if(kuramaAssets.stats(profile))promote();else void kuramaAssets.preload(profile).then(promote);
  }
  private swapSculpt(profile:DetailProfile){
    const old=this.sculpture,next=createKuramaSummon(profile);
    next.beast.position.copy(old.beast.position);next.beast.rotation.copy(old.beast.rotation);next.beast.scale.copy(old.beast.scale);
    next.head.rotation.copy(old.head.rotation);next.leftPaw.rotation.copy(old.leftPaw.rotation);next.rightPaw.rotation.copy(old.rightPaw.rotation);
    for(let i=0;i<next.meshes.length;i++)(next.meshes[i].material as THREE.Material).opacity=(old.meshes[i].material as THREE.Material).opacity;
    const geometry=kuramaAssets.tail(profile)??foxTailGeometry(),previous=this.tails.geometry;
    this.tails.geometry=geometry;this.tailEdges.geometry=geometry;if(!previous.userData.sharedKurama&&previous!==geometry)previous.dispose();
    next.beast.add(this.tails,this.tailEdges);disposeKuramaInstance(old);
    this.sculpture=next;this.beast=next.beast;this.group.add(this.beast);
    this.beastMaterials=next.meshes.map(mesh=>mesh.material as THREE.Material).concat(this.tails.material as THREE.Material,this.tailEdges.material as THREE.Material);
    this.setMultisampleFade(this.coverageSamples);
  }''')
change('this.dummy.position.set(rank*.4,8.1+Math.abs(rank)*.14,-2.65-(i%2)*.43);', 'this.dummy.position.set(rank*.34,7.2+Math.abs(rank)*.1,-2.3-(i%2)*.35);')
change('-Math.PI / 2 - .16','-Math.PI / 2 - .20')
change('-rank*.245+flex','-rank*.253+flex')
change('rank*.055','rank*.052')
change('this.dummy.scale.set(6.3+Math.abs(rank)*.22,6.0-(i%2)*.3,9.1-Math.abs(rank)*.48+(i%2)*.16);', 'this.dummy.scale.set(5.0+Math.abs(rank)*.10,5.1-(i%3)*.23,8.6-Math.abs(rank)*.35+(i%2)*.28);')
change('this.dummy.updateMatrix(); this.tailEdges.setMatrixAt(i, this.dummy.matrix);\n      this.dummy.scale.multiplyScalar(.945); this.dummy.updateMatrix(); this.tails.setMatrixAt(i, this.dummy.matrix);', 'this.dummy.updateMatrix(); this.tails.setMatrixAt(i, this.dummy.matrix);\n      this.dummy.scale.multiplyScalar(1.018); this.dummy.updateMatrix(); this.tailEdges.setMatrixAt(i, this.dummy.matrix);')
change('radius * 1.09','radius * 1.025')
change('(reduced ? .11 : .23) * (1 - smooth(.1, 1.8, b))', '(reduced ? .035 : .035+.15*(1-smooth(.04,.24,b))) * (1 - smooth(.1, 1.8, b))')
change('radius * .65, wakeLength, radius * .65','radius * .30, wakeLength, radius * .30')
change('(reduced ? 6 : this.profile === \'mobile\' ? 8 : 16)','(reduced ? 4 : this.profile === \'mobile\' ? 6 : 12)')
change('geometries.add(o.geometry); const list=', 'if(!o.geometry.userData.sharedKurama)geometries.add(o.geometry); const list=')
change('particles.setXYZ(i,(b>0?', '''if(t>.9&&t<2.5){
        const flow=reduced?.4:((i*.173-t*.65)%1+1)%1, distance=radius+1+flow*(5+radius*.32);
        particles.setXYZ(i,chargeX+Math.cos(a)*distance,chargeY+Math.sin(a)*distance*.72,chargeZ+Math.sin(i*.91)*distance*.38);
        continue;
      }
      particles.setXYZ(i,(b>0?''')
text='// Generated re-review candidate; approved fox.ts unchanged.\n'+text
(root/'src/kurama-generated-review.ts').write_text(text,encoding='utf-8')
print('Wrote isolated re-review candidate; approved fox.ts unchanged.')
