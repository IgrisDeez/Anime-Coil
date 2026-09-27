import * as THREE from "three";
import type { Arena, GameEvent } from "./simulation";
import type { MapId } from './maps';
import type { DetailProfile } from "./worlds/types";
import type { RenderAnchor } from './vfx-anchors';
import { impactStarGeometry, spectralFistGeometry, spiritTailGeometry, taperedSlashGeometry } from './vfx-geometry';

const dummy = new THREE.Object3D();
const tailColors = ["#ffe392", "#ffc56b", "#fff0bd", "#ffcc72", "#ffe399", "#fff1bf", "#ffcd73", "#ffe6a2", "#ffc86e"].map(color => new THREE.Color(color));
const gloveColors = [new THREE.Color("#ffd2a2"), new THREE.Color("#ff987e"), new THREE.Color("#ffe0a7")];
const inkColors:Record<MapId,string>={shibuya:'#bd91cd',leaf:'#6f977f',tournament:'#ba977d',harbor:'#71a6ad'};
function comicTexture():THREE.Texture {
  if(typeof document==='undefined') {
    const texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);texture.needsUpdate=true;return texture;
  }
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');
  if(ctx){ctx.font='bold 68px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=12;ctx.strokeStyle='#473a4b';ctx.strokeText('ドン！',128,67);ctx.fillStyle='#fff4d6';ctx.fillText('ドン！',128,67);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}

/** Bounded, pooled meshes for the two non-cinematic spirit forms. */
export class TransformationEffects {
  readonly group = new THREE.Group();
  private tails: THREE.InstancedMesh;
  private tailInk: THREE.InstancedMesh;
  private fists: THREE.InstancedMesh;
  private fistInk: THREE.InstancedMesh;
  private ribbons: THREE.LineSegments;
  private ring: THREE.Mesh;
  private smoke: THREE.InstancedMesh;
  private worldInk: THREE.InstancedMesh;
  private impactStars: THREE.InstancedMesh;
  private impactSlashes: THREE.InstancedMesh;
  private comic: THREE.InstancedMesh;
  private hits: Array<{x:number;z:number;at:number;kind:'nine-tail'|'skybreaker'}> = [];
  private profile: DetailProfile;
  private maxPunches: number;
  private disposed = false;

  constructor(profile: DetailProfile) {
    this.profile = profile;
    this.maxPunches = 6;
    const tailGeo = spiritTailGeometry(profile === 'mobile' ? 8 : 12);
    const tailMat = new THREE.MeshToonMaterial({ color: "white", emissive:'#c88936',emissiveIntensity:.14, transparent: true, opacity: .92, depthWrite: false });
    this.tails = new THREE.InstancedMesh(tailGeo, tailMat, 11);
    this.tails.count = 0;
    this.tails.frustumCulled = false;
    this.tailInk = new THREE.InstancedMesh(tailGeo,new THREE.MeshBasicMaterial({color:'#a87946',side:THREE.BackSide,transparent:true,opacity:.36,depthWrite:false}),11);
    this.tailInk.count = 0; this.tailInk.frustumCulled = false;
    const fistGeo = spectralFistGeometry(profile);
    const fistMat = new THREE.MeshToonMaterial({ color: "white", depthWrite: false });
    this.fists = new THREE.InstancedMesh(fistGeo, fistMat, this.maxPunches + 2);
    this.fists.count = 0;
    this.fists.frustumCulled = false;
    this.fistInk = new THREE.InstancedMesh(fistGeo, new THREE.MeshBasicMaterial({color:'#413246',side:THREE.BackSide,depthWrite:false}), this.maxPunches + 2);
    this.fistInk.count = 0;
    this.fistInk.frustumCulled = false;
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((this.maxPunches + 2) * 18), 3).setUsage(THREE.DynamicDrawUsage));
    this.ribbons = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: "#ffe4a3", transparent: true, opacity: .74, depthWrite: false }));
    this.ribbons.frustumCulled = false;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, .075, 5, profile === "mobile" ? 20 : 32), new THREE.MeshBasicMaterial({ color: "#ffb95f", transparent: true, opacity: .42, depthWrite: false }));
    this.ring.rotation.x = Math.PI / 2;
    this.ring.visible = false;
    this.smoke=new THREE.InstancedMesh(new THREE.TorusGeometry(.5,.07,5,18,Math.PI*1.38),new THREE.MeshBasicMaterial({color:'#fffaf0',transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false}),8);
    this.worldInk=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.025,4,16,Math.PI*.62),new THREE.MeshBasicMaterial({color:'#6c5a75',transparent:true,opacity:.36,side:THREE.DoubleSide,depthWrite:false}),8);
    this.impactStars=new THREE.InstancedMesh(impactStarGeometry(),new THREE.MeshBasicMaterial({color:'#fff1be',transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}),12);
    this.impactSlashes=new THREE.InstancedMesh(taperedSlashGeometry(),new THREE.MeshBasicMaterial({color:'#ffde8d',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}),24);
    this.comic=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:comicTexture(),transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}),12);
    for(const mesh of [this.smoke,this.worldInk,this.impactStars,this.impactSlashes,this.comic]) {mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);}
    this.group.add(this.tailInk, this.tails, this.fistInk, this.fists, this.ribbons, this.ring,this.smoke,this.worldInk,this.impactStars,this.impactSlashes,this.comic);
  }

  setProfile(profile: DetailProfile) {
    this.profile = profile;
    this.maxPunches = 6;
  }

  clear() {
    this.tails.count = this.tailInk.count = this.fists.count = this.fistInk.count = 0;
    this.smoke.count=this.worldInk.count=this.impactStars.count=this.impactSlashes.count=this.comic.count=0;
    this.hits.length=0;
    this.ribbons.geometry.setDrawRange(0, 0);
    this.ring.visible = false;
  }

  ingest(events:readonly GameEvent[],time:number) {
    const seen=new Set<number>();
    for(const event of events) {
      if(event.type!=='transform-hit'||event.targetId===undefined||seen.has(event.targetId))continue;
      if(event.ultimate!=='nine-tail'&&event.ultimate!=='skybreaker')continue;
      seen.add(event.targetId);
      if(this.hits.length===12)this.hits.shift();
      this.hits.push({x:event.x,z:event.z,at:time,kind:event.ultimate});
    }
  }

  update(arena: Arena | undefined, time: number, reducedMotion: boolean, anchors?: ReadonlyMap<number, RenderAnchor>,mapId:MapId='shibuya') {
    this.tails.count=this.tailInk.count=this.fists.count=this.fistInk.count=0;
    this.smoke.count=this.worldInk.count=this.impactStars.count=this.impactSlashes.count=this.comic.count=0;
    this.ribbons.geometry.setDrawRange(0,0);this.ring.visible=false;
    const form = arena?.transformation;
    if (!arena || !form || !arena.player.alive) {this.hits.length=0;return;}
    const p = arena.player;
    const scale = Math.min(1.35, 1 + (p.mass - 18) / 500);
    const anchor = anchors?.get(p.id);
    const headX = anchor?.x ?? p.x, headZ = anchor?.z ?? p.z;
    const headY = anchor?.y ?? .9;
    const headAngle = anchor?.angle ?? p.angle;
    const clearance = anchor?.clearance ?? 1.35 * scale;
    const tailMotion = reducedMotion ? 0 : 1;
    for(let i=this.hits.length-1;i>=0;i--)if(time-this.hits[i].at>=.42)this.hits.splice(i,1);
    let starCount=0,slashCount=0,comicCount=0;
    for(const hit of this.hits) {
      const age=Math.max(0,time-hit.at),fade=1-age/.42;
      dummy.position.set(hit.x,.12,hit.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar((.6+age*2)*fade);dummy.updateMatrix();this.impactStars.setMatrixAt(starCount++,dummy.matrix);
      if(hit.kind==='nine-tail')for(let k=0;k<3&&slashCount<24;k++) {
        dummy.position.set(hit.x+(k-1)*.28,.16,hit.z+(k-1)*.16);dummy.rotation.set(0,k*.45,0);dummy.scale.set(.65*fade,.65*fade,.65*fade);dummy.updateMatrix();this.impactSlashes.setMatrixAt(slashCount++,dummy.matrix);
      }
      if(!reducedMotion&&comicCount<(this.profile==='mobile'?6:12)){
        dummy.position.set(hit.x,1.9+age*1.4,hit.z);dummy.rotation.set(-.48,0,0);dummy.scale.set(1.9*fade,.95*fade,1);dummy.updateMatrix();this.comic.setMatrixAt(comicCount++,dummy.matrix);
      }
    }
    this.impactStars.count=starCount;this.impactSlashes.count=slashCount;this.comic.count=comicCount;
    this.impactStars.instanceMatrix.needsUpdate=this.impactSlashes.instanceMatrix.needsUpdate=this.comic.instanceMatrix.needsUpdate=true;
    if (form.kind === "nine-tail") {
      this.tails.count = this.tailInk.count = 11;
      for (let i = 0; i < 9; i++) {
        const layer = i % 3, offset = (i - 4) * .32;
        const sway = Math.sin(time * 2 + i * .8) * .08 * tailMotion;
        const angle = headAngle + Math.PI + offset + sway;
        dummy.position.set(headX-Math.cos(headAngle)*clearance*.8-Math.sin(headAngle)*(i-4)*.24, headY+1.15+layer*.14, headZ-Math.sin(headAngle)*clearance*.8+Math.cos(headAngle)*(i-4)*.24);
        dummy.rotation.set(-.72+layer*.07, Math.PI/2-angle, (i-4)*.075);
        dummy.scale.set((.9+layer*.08)*scale, (.88+layer*.07)*scale, (2.2+layer*.08)*scale);
        dummy.updateMatrix();
        this.tails.setMatrixAt(i, dummy.matrix);
        dummy.scale.multiplyScalar(1.035);dummy.updateMatrix();this.tailInk.setMatrixAt(i,dummy.matrix);
        this.tails.setColorAt(i, tailColors[i]);
      }
      // The same tapered asset makes two narrow spectral ears with no extra draw.
      for (let i=0;i<2;i++) {
        const side=i?1:-1;
        dummy.position.set(headX-Math.sin(headAngle)*side*clearance*.58, headY+clearance*.75, headZ+Math.cos(headAngle)*side*clearance*.58);
        dummy.rotation.set(-.66,Math.PI/2-headAngle-side*.34,side*.2);
        dummy.scale.set(.45*scale,.5*scale,.48*scale); dummy.updateMatrix();
        this.tails.setMatrixAt(9+i,dummy.matrix); this.tails.setColorAt(9+i,tailColors[i?1:0]);
        dummy.scale.multiplyScalar(1.035);dummy.updateMatrix();this.tailInk.setMatrixAt(9+i,dummy.matrix);
      }
      this.tails.instanceMatrix.needsUpdate = this.tailInk.instanceMatrix.needsUpdate = true;
      if (this.tails.instanceColor) this.tails.instanceColor.needsUpdate = true;
      this.ring.visible = true;
      this.ring.position.set(headX, .08, headZ);
      const activation=Math.max(0,1-form.elapsed/.35);
      this.ring.scale.setScalar((1.5 + activation*2 + .1 * Math.sin(time * 2) * tailMotion) * scale);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = reducedMotion ? .28 : .42;
      return;
    }

    // Nearby cartoon ink stays flat and decorative; its 24-unit limit is visual only.
    (this.worldInk.material as THREE.MeshBasicMaterial).color.set(inkColors[mapId]);
    this.worldInk.count=this.profile==='mobile'?4:8;
    for(let i=0;i<this.worldInk.count;i++) {
      const a=i*Math.PI*2/this.worldInk.count;
      const r=8+(i%3)*5;
      dummy.position.set(headX+Math.cos(a)*r,-.405,headZ+Math.sin(a)*r);
      dummy.rotation.set(-Math.PI/2,0,a+(reducedMotion?0:Math.sin(time*1.2+i)*.14));
      dummy.scale.setScalar((1.35+i%2*.55)*(reducedMotion?1:1+Math.sin(time*1.3+i)*.09));
      dummy.updateMatrix();this.worldInk.setMatrixAt(i,dummy.matrix);
    }
    this.worldInk.instanceMatrix.needsUpdate=true;
    this.smoke.count=this.profile==='mobile'?4:7;
    for(let i=0;i<this.smoke.count;i++) {
      const a=i*Math.PI*2/this.smoke.count+(reducedMotion?0:time*.24);
      dummy.position.set(headX+Math.cos(a)*clearance*1.04,headY+.55+Math.sin(i*2)*.28,headZ+Math.sin(a)*clearance*1.04);
      dummy.rotation.set(Math.PI/2,a,0);dummy.scale.setScalar(.52*scale);
      dummy.updateMatrix();this.smoke.setMatrixAt(i,dummy.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate=true;

    const linePositions = this.ribbons.geometry.attributes.position as THREE.BufferAttribute;
    let lineCount = 0, fistCount = 0;
    // Chunky fists hover outside the visible head. The dark backfaces trace each knuckle.
    for (let side = -1; side <= 1; side += 2) {
      const reach = clearance + 1.05*scale;
      const x = headX + Math.cos(headAngle + side * 1.16) * reach;
      const z = headZ + Math.sin(headAngle + side * 1.16) * reach;
      dummy.position.set(x, headY+1.05*scale, z);
      dummy.rotation.set(0, Math.PI / 2 - headAngle, reducedMotion ? 0 : side * (.08+Math.sin(time*5)*.045));
      dummy.scale.set(.92*scale,.85*scale,.94*scale);
      dummy.updateMatrix();
      this.fists.setMatrixAt(fistCount, dummy.matrix);
      dummy.scale.multiplyScalar(1.095);dummy.updateMatrix();this.fistInk.setMatrixAt(fistCount,dummy.matrix);
      this.fists.setColorAt(fistCount++, gloveColors[side < 0 ? 0 : 1]);
      const armX = headX + Math.cos(headAngle + side * .8) * clearance*.7;
      const armZ = headZ + Math.sin(headAngle + side * .8) * clearance*.7;
      const midX=(armX+x)*.5,midZ=(armZ+z)*.5;
      linePositions.setXYZ(lineCount++, armX, headY, armZ);
      linePositions.setXYZ(lineCount++, midX, headY+.85*scale, midZ);
      linePositions.setXYZ(lineCount++, midX, headY+.85*scale, midZ);
      linePositions.setXYZ(lineCount++, x, headY+1.05*scale, z);
    }
    const punchCount = Math.min(arena.skyPunches.length, this.profile === "mobile" ? 3 : this.maxPunches);
    for (let i = 0; i < punchCount; i++) {
      const punch = arena.skyPunches[i];
      dummy.position.set(punch.x, 1.5, punch.z);
      dummy.rotation.set(0, Math.PI / 2 - punch.direction, 0);
      dummy.scale.set(1.08, .94, 1.3);
      dummy.updateMatrix();
      this.fists.setMatrixAt(fistCount, dummy.matrix);
      dummy.scale.multiplyScalar(1.095);dummy.updateMatrix();this.fistInk.setMatrixAt(fistCount,dummy.matrix);
      this.fists.setColorAt(fistCount++, gloveColors[punch.id % 2]);
      if (!reducedMotion) {
        linePositions.setXYZ(lineCount++, punch.previous.x, .84, punch.previous.z);
        linePositions.setXYZ(lineCount++, punch.x, .84, punch.z);
      }
    }
    this.fists.count = fistCount;
    this.fistInk.count = fistCount;
    this.fists.instanceMatrix.needsUpdate = this.fistInk.instanceMatrix.needsUpdate = true;
    if (this.fists.instanceColor) this.fists.instanceColor.needsUpdate = true;
    linePositions.needsUpdate = true;
    this.ribbons.geometry.setDrawRange(0, lineCount);
    (this.ribbons.material as THREE.LineBasicMaterial).opacity = reducedMotion ? .34 : .74;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.clear();
    this.tails.dispose(); this.tailInk.dispose(); this.fists.dispose(); this.fistInk.dispose();
    this.tails.geometry.dispose(); this.fists.geometry.dispose();
    (this.tails.material as THREE.Material).dispose();
    (this.tailInk.material as THREE.Material).dispose();
    (this.fists.material as THREE.Material).dispose();
    (this.fistInk.material as THREE.Material).dispose();
    this.ribbons.geometry.dispose(); (this.ribbons.material as THREE.Material).dispose();
    this.ring.geometry.dispose(); (this.ring.material as THREE.Material).dispose();
    for(const mesh of [this.smoke,this.worldInk,this.impactStars,this.impactSlashes]) {mesh.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}
    (this.comic.material as THREE.MeshBasicMaterial).map?.dispose();this.comic.dispose();this.comic.geometry.dispose();(this.comic.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}
