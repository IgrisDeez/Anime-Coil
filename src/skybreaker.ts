import * as THREE from 'three';
import { CastSnapshot, CinematicCamera, CinematicFit } from './cinematic-staging';
import type { RenderAnchor } from './vfx-anchors';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Arena, NUKE_BLAST, NUKE_DURATION } from './simulation';
import { ultimateFrame } from './ultimate-presentation';
import { impactStarGeometry } from './vfx-geometry';
import type { DetailProfile } from './worlds/types';
import type { UltimateVisualFrame } from './ultimate-visual';
import {pomuUltimateAssets} from './living-assets';
import {HAKI} from './haki-palette';

export function gear5Expression(time:number,reduced=false){
  if(reduced)return {x:1,y:1,bounce:0,eyePop:0};
  const summon=1-smooth(.1,.9,time),balloon=smooth(.9,1.8,time)*(1-smooth(2.2,2.5,time));
  const flatten=smooth(4.3,4.55,time)*(1-smooth(4.65,5.45,time));
  return {x:1+balloon*.32+flatten*.43-summon*.08,y:1-balloon*.13-flatten*.37+summon*.14,
    bounce:Math.sin(time*15)*summon*.28+Math.sin((time-4.3)*17)*flatten*.10,
    eyePop:smooth(1.3,1.42,time)*(1-smooth(1.52,1.68,time))};
}

const smooth = (a: number, b: number, t: number) => THREE.MathUtils.smoothstep(t, a, b);

function giantFistGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const rounded = (x:number,y:number,z:number,w:number,h:number,d:number,r:number) => {
    const geometry = new RoundedBoxGeometry(w,h,d,3,r);
    geometry.translate(x,y,z);parts.push(geometry);
  };
  rounded(0,0,0,.96,.78,1.08,.16);
  rounded(0,-.04,-.58,.72,.62,.3,.1);
  for(let i=0;i<4;i++)rounded((i-1.5)*.235,.13,.64,.235,.47,.34,.095);
  rounded(.58,-.08,.14,.34,.48,.5,.14);
  const merged=mergeGeometries(parts,false);
  parts.forEach(part=>part.dispose());
  if(!merged)throw new Error('Could not build Skybreaker fist');
  merged.computeVertexNormals();merged.computeBoundingSphere();
  return merged;
}

/** Pomu's one-shot cartoon slam. Every object is cached and all motion follows cinematic time. */
export class SkybreakerCinematic {
  readonly group = new THREE.Group();
  private fist: THREE.Group;
  private fallbackFist:THREE.Mesh;
  private ink: THREE.Mesh;
  private cuff: THREE.Mesh;
  private arm: THREE.Mesh;
  private shadow: THREE.Mesh;
  private dent: THREE.Mesh;
  private rings: THREE.Mesh[] = [];
  private smoke: THREE.InstancedMesh;
  private stars: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private targetPosition = new THREE.Vector3();
  private cameraFocus = new THREE.Vector3();
  private cameraBounds = new THREE.Box3();
  private corner = new THREE.Vector3();
  private fit = new CinematicFit();
  private cameraBlend = new CinematicCamera();
  private cast = new CastSnapshot();
  private creases: THREE.LineSegments;
  private curls: THREE.InstancedMesh;
  private wind: THREE.LineSegments;
  private lightning:THREE.LineSegments;
  private sculpted=false;
  private wrist=new THREE.Vector3();
  private wristAnchor=new THREE.Vector3(0,-.015,-.82);
  private contactAnchor=new THREE.Vector3(0,.12,.81);
  private localFistBounds=new THREE.Box3();
  private contact=new THREE.Vector3();
  private direction=new THREE.Vector3();
  private right=new THREE.Vector3();
  private up=new THREE.Vector3();
  private poseMatrix=new THREE.Matrix4();
  private roll=new THREE.Quaternion();
  private strikeAxis=new THREE.Vector3(0,0,1);
  private path=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  private armUniforms={armStart:{value:new THREE.Vector3()},armEnd:{value:new THREE.Vector3()},armControlA:{value:new THREE.Vector3()},armControlB:{value:new THREE.Vector3()},armRadius:{value:1}};
  private boltUniforms={boltTime:{value:0},boltStrength:{value:0}};
  private staged = {active:false,casterPosition:new THREE.Vector3(),fistCenter:new THREE.Vector3(),impact:new THREE.Vector3(),fistBounds:new THREE.Box3(),knuckleContact:new THREE.Vector3(),wristPosition:new THREE.Vector3(),strikeDirection:new THREE.Vector3(),armEndTangent:new THREE.Vector3(),expression:gear5Expression(0)};
  get staging() {return this.staged as Readonly<typeof this.staged>;}
  private fistGeometry: THREE.BufferGeometry;
  private disposed = false;
  constructor(scene: THREE.Scene, private profile: DetailProfile = 'desktop') {
    const mat = (color: string, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide, forceSinglePass:true});
    this.fistGeometry = giantFistGeometry();
    this.fist = new THREE.Group();this.fallbackFist=new THREE.Mesh(this.fistGeometry,new THREE.MeshToonMaterial({color:'#281820'}));this.fist.add(this.fallbackFist);
    this.ink = new THREE.Mesh(this.fistGeometry, new THREE.MeshBasicMaterial({color:HAKI.ink, side:THREE.BackSide}));
    this.ink.scale.setScalar(1.045);
    this.cuff = new THREE.Mesh(new THREE.TorusGeometry(1, .19, 6, 24), mat('#fff6ee'));
    const armGeometry=new THREE.BufferGeometry();
    armGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(21*9*3),3));
    armGeometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(21*9*3),3));
    const armPositions=armGeometry.attributes.position as THREE.BufferAttribute,armNormals=armGeometry.attributes.normal as THREE.BufferAttribute;
    for(let row=0;row<=20;row++)for(let side=0;side<=8;side++){const a=side/8*Math.PI*2,i=row*9+side;armPositions.setXYZ(i,Math.cos(a),row/20,Math.sin(a));armNormals.setXYZ(i,Math.cos(a),0,Math.sin(a));}
    const armIndices=[];for(let row=0;row<20;row++)for(let side=0;side<8;side++){const a=row*9+side;armIndices.push(a,a+9,a+1,a+1,a+9,a+10);}armGeometry.setIndex(armIndices);
    this.arm = new THREE.Mesh(armGeometry,new THREE.MeshToonMaterial({color:'#f8ede8'})); this.arm.frustumCulled=false;
    const armMaterial=this.arm.material as THREE.MeshToonMaterial;
    armMaterial.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.armUniforms);
      shader.vertexShader=String.raw`uniform vec3 armStart,armEnd,armControlA,armControlB;uniform float armRadius;
        vec3 armPoint(float q){float r=1.-q;return armStart*r*r*r+3.*armControlA*r*r*q+3.*armControlB*r*q*q+armEnd*q*q*q;}
        vec3 armTangent(float q){float r=1.-q;return normalize(3.*r*r*(armControlA-armStart)+6.*r*q*(armControlB-armControlA)+3.*q*q*(armEnd-armControlB)+vec3(.00001));}
        vec3 armU(float q){vec3 t=armTangent(q);return normalize(cross(t,abs(t.z)<.9?vec3(0,0,1):vec3(0,1,0)));}
        `+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',String.raw`#include <beginnormal_vertex>
        vec3 armAxis=armU(position.y);vec3 armV=normalize(cross(armTangent(position.y),armAxis));objectNormal=armAxis*position.x+armV*position.z;`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',String.raw`#include <begin_vertex>
        transformed=armPoint(position.y)+(armAxis*position.x+armV*position.z)*armRadius*(.23+position.y*.77);`);
    };armMaterial.customProgramCacheKey=()=> 'gear5-elastic-arm-v178';
    this.arm.name='skybreaker-elastic-arm';this.fist.name='skybreaker-fist';
    const creaseGeo=new THREE.BufferGeometry(),creaseVertices=[];
    for(let i=0;i<4;i++){const x=(i-1.5)*.235;creaseVertices.push(x-.07,.372,.7,x+.07,.372,.7,x-.07,-.04,.79,x+.07,-.04,.79);}
    creaseVertices.push(.44,-.1,.45,.64,-.22,.37,-.34,-.23,.49,.24,-.23,.49);
    creaseGeo.setAttribute('position',new THREE.Float32BufferAttribute(creaseVertices,3));
    this.creases=new THREE.LineSegments(creaseGeo,new THREE.LineBasicMaterial({color:HAKI.ink}));
    const curlPoints=[];for(let i=0;i<25;i++){const a=i/24*Math.PI*2.8,r=.35+i/24*.65;curlPoints.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0));}
    this.curls=new THREE.InstancedMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curlPoints),24,.12,5,false),mat('#fffaf3',.8),12);
    this.curls.frustumCulled=false;this.curls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const windGeo=new THREE.BufferGeometry();windGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12*6),3));
    const windPosition=windGeo.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;windPosition.setXYZ(i*2,Math.cos(a),0,Math.sin(a));windPosition.setXYZ(i*2+1,Math.cos(a)*1.3,1,Math.sin(a)*1.3);}
    const windMat=new THREE.LineBasicMaterial({color:'#fff2dd',transparent:true,opacity:.7});windMat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.armUniforms);shader.vertexShader='uniform vec3 armEnd;uniform float armRadius;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=armEnd+vec3(position.x*armRadius*6.,3.+position.y*12.,position.z*armRadius*6.);');};windMat.customProgramCacheKey=()=> 'gear5-speed-lines';
    this.wind=new THREE.LineSegments(windGeo,windMat);this.wind.frustumCulled=false;
    const boltGeo=new THREE.BufferGeometry(),bolts:number[]=[];
    for(let i=0;i<10;i++)for(let j=0;j<4;j++)for(const q of [j/4,(j+1)/4]){const a=i*Math.PI/5,r=.7+q*.6;bolts.push(Math.cos(a)*r,Math.sin(a)*r,q);}
    boltGeo.setAttribute('position',new THREE.Float32BufferAttribute(bolts,3));
    const boltMat=new THREE.LineBasicMaterial({color:HAKI.rim,transparent:true,opacity:.75});boltMat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.boltUniforms);shader.vertexShader='uniform float boltTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z=(position.z-.5)*.45;transformed.xy*=1.+.06*sin(boltTime*8.+position.z*19.);transformed.x+=sin(position.z*37.+position.y*7.)*.055;');};boltMat.customProgramCacheKey=()=> 'gear5-haki-lightning';
    this.lightning=new THREE.LineSegments(boltGeo,boltMat);this.lightning.frustumCulled=false;this.lightning.name='gear5-haki-lightning';
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat(HAKI.ink, .24));
    this.dent = new THREE.Mesh(new THREE.CircleGeometry(1,72),new THREE.ShaderMaterial({
      uniforms:{age:{value:0},alpha:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
      vertexShader:'varying vec2 inkPoint;void main(){inkPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 inkPoint;uniform float age;uniform float alpha;
        void main(){float a=atan(inkPoint.y,inkPoint.x),r=length(inkPoint);
          float rebound=sin(min(age,1.)*3.14159);float warp=sin(a*9.+r*12.)*.026*rebound;
          float seams=pow(max(0.,sin((r+warp)*32.-age*5.)),18.);
          float lip=1.-smoothstep(.012,.05,abs(r-(.42+rebound*.16+sin(a*11.)*.025)));
          float spokes=pow(max(0.,sin(a*13.+r*6.)),26.)*smoothstep(.25,.5,r)*(1.-smoothstep(.75,.97,r));
          float ink=max(lip,max(seams*.38,spokes*.7))*(1.-smoothstep(.87,1.,r));
          gl_FragColor=vec4(mix(vec3(.12,.025,.045),vec3(.71,.07,.14),seams),alpha*ink);}`
    }));this.dent.name='skybreaker-ink-rebound';
    this.shadow.rotation.x = this.dent.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1.04, 72), mat(i === 1 ? HAKI.ink : HAKI.energy, .7));
      ring.rotation.x = -Math.PI / 2;
      this.rings.push(ring);
      this.group.add(ring);
    }
    const puffGeo = new THREE.SphereGeometry(1, 8, 6);
    this.smoke = new THREE.InstancedMesh(puffGeo, mat('#e7dcf1', .68), 32);
    this.stars = new THREE.InstancedMesh(impactStarGeometry(), mat(HAKI.rim, .85), 20);
    for (const mesh of [this.smoke, this.stars]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.group.add(this.ink, this.fist, this.cuff, this.arm, this.shadow, this.dent, this.smoke, this.stars, this.creases, this.curls, this.wind,this.lightning);
    this.group.visible = false;
    scene.add(this.group);
    this.fistGeometry.computeBoundingBox();this.localFistBounds.copy(this.fistGeometry.boundingBox!);
    this.setProfile(profile);
  }
  setProfile(profile: DetailProfile) {
    this.profile=profile;const sculpt=pomuUltimateAssets.fist(profile);
    if(sculpt){
      this.wristAnchor.copy(sculpt.getObjectByName('PomuFistWrist_'+profile)!.position);this.contactAnchor.copy(sculpt.getObjectByName('PomuFistContact_'+profile)!.position);
      this.localFistBounds.setFromObject(sculpt);this.fist.clear();this.fist.add(...sculpt.children);this.sculpted=true;}
    else if(this.sculpted){this.fist.clear();this.fist.add(this.fallbackFist);this.sculpted=false;this.wristAnchor.set(0,-.015,-.82);this.contactAnchor.set(0,.12,.81);this.fistGeometry.computeBoundingBox();this.localFistBounds.copy(this.fistGeometry.boundingBox!);}
  }
  clear() {

    this.group.visible=false;this.group.position.set(0,0,0);this.group.rotation.set(0,0,0);this.cast.clear();this.cameraBlend.clear();this.staged.active=false;
    this.staged.casterPosition.set(0,0,0);this.staged.fistCenter.set(0,0,0);this.staged.impact.set(0,0,0);
    this.staged.fistBounds.makeEmpty();this.staged.expression=gear5Expression(5.6);
    for(const child of this.group.children){child.visible=false;child.position.set(0,0,0);child.rotation.set(0,0,0);if(child instanceof THREE.InstancedMesh)child.count=0;}
    const material=this.dent.material as THREE.ShaderMaterial;material.uniforms.age.value=material.uniforms.alpha.value=0;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;this.clear();

    this.group.parent?.remove(this.group);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    geometries.add(this.fistGeometry);materials.add(this.fallbackFist.material as THREE.Material);
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        if(!object.geometry.userData.sharedLivingAsset){geometries.add(object.geometry);materials.add(object.material as THREE.Material);}
        if (object instanceof THREE.InstancedMesh) object.dispose();
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
  update(arena: Arena | undefined, camera: THREE.PerspectiveCamera, menu: boolean, reduced = false, cinematicCamera = true, anchor?: RenderAnchor, visual?: Readonly<UltimateVisualFrame>) {
    const shot = !menu && arena?.player.alive && arena.state!=='over' && arena.cinematic;
    this.group.visible = !this.disposed && !!shot && shot.kind === 'skybreaker';
    if (!this.group.visible || !shot || !arena) {this.clear();return;}
    this.cast.capture(arena,anchor);this.staged.active=true;this.staged.casterPosition.copy(this.cast.position);
    const t = shot.time, blast = Math.max(0, t - NUKE_BLAST);
    const windup = smooth(.9, 2.5, t), strike = smooth(2.65, NUKE_BLAST, t),retract=smooth(4.3,5.6,t);
    const fade = 1 - smooth(4.2, NUKE_DURATION, t);
    const summon = smooth(0, .9, t);
    const target = shot.impact;
    this.group.position.set(target.x, 0, target.z);

    this.staged.impact.set(target.x,0,target.z);
    const shoulderX = (anchor?.x ?? this.cast.position.x)-target.x, shoulderZ = (anchor?.z ?? this.cast.position.z)-target.z;
    const shoulderY=anchor?.y ?? 1;
    const bend=reduced?0:Math.sin(Math.PI*strike)*9;
    const sideOffset=reduced?5:10+windup*8;
    const headX = shoulderX * (1 - strike)-Math.sin(this.cast.angle)*(bend+sideOffset*(1-strike))+(shoulderX-Math.sin(this.cast.angle)*5)*retract;
    const headZ = shoulderZ * (1 - strike)+Math.cos(this.cast.angle)*(bend+sideOffset*(1-strike))+(shoulderZ+Math.cos(this.cast.angle)*5)*retract;
    const baseSize=reduced?1.5+summon*4+windup*2:2+summon*4+smooth(1.65,2.5,t)*12;
    const fistSize=baseSize*(1-retract*.94);
    // Animate the knuckle contact, then offset the root by its authored anchor.
    // The final cubic tangent is vertical for every captured snake heading.
    const high=reduced?5+windup*4:10+windup*25;
    const [p0,p1,p2,p3]=this.path;
    p0.set(headX,high,headZ);p1.set(headX*.72,high-3,headZ*.72);p2.set(0,14,0);p3.set(0,-.46,0);
    const u=1-strike;
    this.contact.copy(p0).multiplyScalar(u*u*u).addScaledVector(p1,3*u*u*strike).addScaledVector(p2,3*u*strike*strike).addScaledVector(p3,strike*strike*strike);
    this.direction.copy(p1).sub(p0).multiplyScalar(3*u*u).addScaledVector(this.corner.copy(p2).sub(p1),6*u*strike).addScaledVector(this.corner.copy(p3).sub(p2),3*strike*strike).normalize();
    this.corner.set(Math.cos(this.cast.angle)*.92,-.30,Math.sin(this.cast.angle)*.92).normalize();
    this.direction.lerp(this.corner,1-smooth(0,.42,strike)).normalize();
    if(retract>0){this.contact.lerp(p0,retract);this.direction.lerp(this.corner,retract).normalize();}
    this.right.set(Math.sin(this.cast.angle),0,-Math.cos(this.cast.angle));
    this.right.addScaledVector(this.direction,-this.right.dot(this.direction)).normalize();
    this.up.crossVectors(this.direction,this.right).normalize();
    this.poseMatrix.makeBasis(this.right,this.up,this.direction);this.fist.quaternion.setFromRotationMatrix(this.poseMatrix);
    const wobble=reduced?0:Math.sin(t*3)*.035*windup*(1-strike)+Math.sin((t-4.3)*17)*retract*(1-retract)*.28;
    this.roll.setFromAxisAngle(this.strikeAxis,wobble);this.fist.quaternion.multiply(this.roll);
    const compression=reduced?0:smooth(2.05,2.5,t)*(1-strike),squash=reduced?0:smooth(3.30,3.4,t)*(1-smooth(3.50,3.75,t));
    this.fist.scale.set(fistSize*(1+compression*.12+squash*.09),fistSize*(1+compression*.12+squash*.07),fistSize*(1-compression*.24-squash*.12));
    this.corner.copy(this.contactAnchor).multiply(this.fist.scale).applyQuaternion(this.fist.quaternion);
    this.fist.position.copy(this.contact).sub(this.corner);this.fist.visible=t<5.55;this.ink.visible=this.fist.visible&&!this.sculpted;
    this.fist.updateMatrix();
    this.staged.fistCenter.copy(this.fist.position).add(this.group.position);
    this.staged.knuckleContact.copy(this.contact).add(this.group.position);this.staged.strikeDirection.copy(this.direction);
    this.staged.fistBounds.copy(this.localFistBounds).applyMatrix4(this.fist.matrix).translate(this.group.position);this.staged.expression=gear5Expression(t,reduced);
    this.ink.position.copy(this.fist.position);this.ink.quaternion.copy(this.fist.quaternion);this.ink.scale.copy(this.fist.scale).multiplyScalar(1.045);
    this.creases.visible=this.fist.visible&&!this.sculpted;this.creases.position.copy(this.fist.position);this.creases.quaternion.copy(this.fist.quaternion);this.creases.scale.copy(this.fist.scale);
    this.arm.visible=this.fist.visible;this.cuff.visible=this.fist.visible&&t<3.4;
    this.wrist.copy(this.wristAnchor).applyMatrix4(this.fist.matrix);this.staged.wristPosition.copy(this.wrist).add(this.group.position);
    this.cuff.position.copy(this.wrist);this.cuff.quaternion.copy(this.fist.quaternion);this.cuff.scale.setScalar(fistSize*.27);
    this.arm.position.set(0,0,0);this.arm.scale.setScalar(1);
    this.armUniforms.armStart.value.set(shoulderX,shoulderY,shoulderZ);this.armUniforms.armEnd.value.copy(this.wrist);this.armUniforms.armRadius.value=fistSize*.255;
    const reach=this.armUniforms.armStart.value.distanceTo(this.wrist),curve=Math.max(2,reach*.34);
    this.armUniforms.armControlA.value.copy(this.armUniforms.armStart.value).lerp(this.wrist,.24);this.armUniforms.armControlA.value.y+=reduced?2:8;
    this.armUniforms.armControlB.value.copy(this.wrist).addScaledVector(this.direction,-curve);
    this.staged.armEndTangent.copy(this.wrist).sub(this.armUniforms.armControlB.value).normalize();
    this.lightning.visible=!reduced&&!visual?.reducedFlashes&&t>1.7&&t<2.5;this.lightning.position.copy(this.fist.position);this.lightning.rotation.copy(this.fist.rotation);this.lightning.scale.copy(this.fist.scale);this.boltUniforms.boltTime.value=t;
    this.shadow.visible = t < NUKE_BLAST;
    this.shadow.position.set(0,-.3,0);
    this.shadow.rotation.x=-Math.PI/2;this.shadow.scale.setScalar(5+windup*14-strike*7);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = .1 + strike * .23;
    this.dent.visible = blast > 0&&!(visual?.managed&&shot.detonated);
    this.dent.position.set(0,-.31,0);
    this.dent.rotation.x=-Math.PI/2;this.dent.scale.setScalar(reduced?20:20+Math.sin(Math.min(1,blast/.7)*Math.PI)*12+blast*9);
    const dentMaterial=this.dent.material as THREE.ShaderMaterial;dentMaterial.uniforms.age.value=reduced?0:blast;dentMaterial.uniforms.alpha.value=.62*fade;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.visible = blast > i * .12 && (i === 0 || (!reduced && this.profile === 'desktop'));
      ring.position.set(0, -.27 + i * .012, 0);ring.rotation.x=-Math.PI/2;
      const age = Math.max(0, blast - i*.12);
      ring.scale.setScalar(3 + age * (115 + i*13));
      (ring.material as THREE.MeshBasicMaterial).opacity = .72 * Math.max(0, 1 - age / 1.45);
    }
    const smokeCount = reduced ? 8 : this.profile === 'mobile' ? 14 : 24;
    (this.smoke.material as THREE.MeshBasicMaterial).color.set(blast>0?HAKI.ash:'#fffaf3');
    (this.curls.material as THREE.MeshBasicMaterial).color.set(blast>0?HAKI.rim:'#fffaf3');
    this.smoke.visible=true;
    this.smoke.count = visual?.managed&&shot.detonated?0:blast > 0 ? smokeCount : (this.profile==='mobile'&&t>=.9?0:4);
    this.smoke.visible=this.smoke.count>0;
    for (let i = 0; i < this.smoke.count; i++) {
      const delay=i%5*.055,age=Math.max(0,blast-delay),linger=Math.min(1,Math.max(0,(2.2-delay-age)/(.6+i%3*.1)));
      const a = i * 2.399963, radius = blast > 0 ? 7 + age * (28 + i%5*3) : 2.5 + i%4;
      this.dummy.position.set((blast>0?0:shoulderX)+Math.cos(a)*radius, blast > 0 ? 1+Math.sin(Math.min(1,age)*Math.PI)*7+i%3 : shoulderY+1.5+i%3*.8, (blast>0?0:shoulderZ)+Math.sin(a)*radius);
      const size=(blast > 0 ? 3.2+i%4*.7 : .65)*(blast > 0 ? linger*Math.min(1,age/.2) : summon);
      this.dummy.scale.set(size*(1+i%3*.18),size*.8,size*1.2);
      this.dummy.rotation.set(0,0,0); this.dummy.updateMatrix(); this.smoke.setMatrixAt(i,this.dummy.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
    this.stars.visible=!reduced && blast>0;
    this.stars.count = visual?.managed&&shot.detonated?0:!reduced && blast > 0 ? (this.profile === 'mobile' ? 8 : 20) : 0;
    for (let i = 0; i < this.stars.count; i++) {
      const a = i * 2.399963, radius = 5 + blast * (20+i%3*6);
      this.dummy.position.set(Math.cos(a)*radius,.2,Math.sin(a)*radius);
      this.dummy.rotation.set(0,a,0); this.dummy.scale.setScalar((3+i%3*.7)*fade);
      this.dummy.updateMatrix(); this.stars.setMatrixAt(i,this.dummy.matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    this.curls.visible=!reduced;this.curls.count=reduced||(visual?.managed&&shot.detonated)||this.profile==='mobile'?0:6;
    this.curls.visible=this.curls.count>0;
    for(let i=0;i<this.curls.count;i++){
      const a=i*2.39996,age=Math.max(0,blast-i%4*.06),r=blast>0?10+age*(20+i%3*4):3+i%3;
      const linger=blast>0?Math.max(0,1-age/(1.65+i%3*.18)):summon;
      this.dummy.position.set((blast>0?0:shoulderX)+Math.cos(a)*r,blast>0?4+age*7:shoulderY+1.6+i%2,(blast>0?0:shoulderZ)+Math.sin(a)*r);
      this.dummy.rotation.set(0,-this.cast.angle,a*.2+(reduced?0:t*.25));this.dummy.scale.setScalar((blast>0?3.5:.6)*linger);this.dummy.updateMatrix();this.curls.setMatrixAt(i,this.dummy.matrix);
    }this.curls.instanceMatrix.needsUpdate=true;
    this.wind.visible=!reduced && t>2.5 && t<3.4;
    const frame = ultimateFrame('skybreaker', t, reduced);
    if(visual?.managed && blast>=0 && shot.detonated){
      for(const ring of this.rings)ring.visible=false;this.smoke.visible=false;this.stars.visible=false;this.curls.visible=false;
    }
    if (frame.cameraWeight > 0 && cinematicCamera) {
      const recovery=smooth(3.4,4.1,t);
      this.cameraBounds.min.set(shoulderX+target.x-3,0,shoulderZ+target.z-3);this.cameraBounds.max.set(shoulderX+target.x+3,5,shoulderZ+target.z+3);
      this.cameraBounds.union(this.staged.fistBounds);
      this.cameraBounds.expandByPoint(this.corner.copy(this.armUniforms.armControlA.value).add(this.group.position));
      this.cameraBounds.expandByPoint(this.corner.copy(this.armUniforms.armControlB.value).add(this.group.position));
      this.cameraBounds.getCenter(this.cameraFocus);this.corner.set(target.x,7,target.z);this.cameraFocus.lerp(this.corner,recovery*.65);
      const settle=smooth(4.05,4.5,t);
      this.fit.fit(this.targetPosition,camera,this.cameraBounds,this.cameraFocus,this.cast.angle+.85,.48+recovery*.4,18+windup*37+recovery*(32-24*settle));
      this.cameraBlend.blend(camera,this.targetPosition,this.cameraFocus,frame.cameraWeight);
    }
  }
}
