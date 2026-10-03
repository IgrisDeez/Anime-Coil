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
  private fist: THREE.Mesh;
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
  private staged = {active:false,casterPosition:new THREE.Vector3(),fistCenter:new THREE.Vector3(),impact:new THREE.Vector3()};
  get staging(): Readonly<{active:boolean;casterPosition:Readonly<THREE.Vector3>;fistCenter:Readonly<THREE.Vector3>;impact:Readonly<THREE.Vector3>}> { return this.staged; }
  private fistGeometry: THREE.BufferGeometry;
  private disposed = false;
  constructor(scene: THREE.Scene, private profile: DetailProfile = 'desktop') {
    const mat = (color: string, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide, forceSinglePass:true});
    this.fistGeometry = giantFistGeometry();
    this.fist = new THREE.Mesh(this.fistGeometry, new THREE.MeshToonMaterial({color:'#fffaf0', emissive:'#bdb1e2', emissiveIntensity:.22}));
    this.ink = new THREE.Mesh(this.fistGeometry, new THREE.MeshBasicMaterial({color:'#463653', side:THREE.BackSide}));
    this.ink.scale.setScalar(1.045);
    this.cuff = new THREE.Mesh(new THREE.TorusGeometry(1, .19, 6, 24), mat('#b49ad8'));
    const armGeometry=new THREE.BufferGeometry();
    armGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(21*9*3),3));
    armGeometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(21*9*3),3));
    const armIndices=[];for(let row=0;row<20;row++)for(let side=0;side<8;side++){const a=row*9+side;armIndices.push(a,a+9,a+1,a+1,a+9,a+10);}armGeometry.setIndex(armIndices);
    this.arm = new THREE.Mesh(armGeometry,new THREE.MeshToonMaterial({color:'#f8ede8'})); this.arm.frustumCulled=false;
    this.arm.name='skybreaker-elastic-arm';this.fist.name='skybreaker-fist';
    const creaseGeo=new THREE.BufferGeometry(),creaseVertices=[];
    for(let i=0;i<4;i++){const x=(i-1.5)*.235;creaseVertices.push(x-.07,.372,.7,x+.07,.372,.7,x-.07,-.04,.79,x+.07,-.04,.79);}
    creaseVertices.push(.44,-.1,.45,.64,-.22,.37,-.34,-.23,.49,.24,-.23,.49);
    creaseGeo.setAttribute('position',new THREE.Float32BufferAttribute(creaseVertices,3));
    this.creases=new THREE.LineSegments(creaseGeo,new THREE.LineBasicMaterial({color:'#74617c'}));
    const curlPoints=[];for(let i=0;i<25;i++){const a=i/24*Math.PI*2.8,r=.35+i/24*.65;curlPoints.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,0));}
    this.curls=new THREE.InstancedMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curlPoints),24,.12,5,false),mat('#fffaf3',.8),12);
    this.curls.frustumCulled=false;this.curls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const windGeo=new THREE.BufferGeometry();windGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12*6),3));
    this.wind=new THREE.LineSegments(windGeo,new THREE.LineBasicMaterial({color:'#fff2dd',transparent:true,opacity:.7}));this.wind.frustumCulled=false;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat('#3f3658', .24));
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
          gl_FragColor=vec4(mix(vec3(.33,.25,.42),vec3(.89,.84,.97),seams),alpha*ink);}`
    }));this.dent.name='skybreaker-ink-rebound';
    this.shadow.rotation.x = this.dent.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1.04, 72), mat(i === 1 ? '#a796c8' : '#fff8eb', .7));
      ring.rotation.x = -Math.PI / 2;
      this.rings.push(ring);
      this.group.add(ring);
    }
    const puffGeo = new THREE.SphereGeometry(1, 8, 6);
    this.smoke = new THREE.InstancedMesh(puffGeo, mat('#e7dcf1', .68), 32);
    this.stars = new THREE.InstancedMesh(impactStarGeometry(), mat('#ef9a80', .85), 20);
    for (const mesh of [this.smoke, this.stars]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.group.add(this.ink, this.fist, this.cuff, this.arm, this.shadow, this.dent, this.smoke, this.stars, this.creases, this.curls, this.wind);
    this.group.visible = false;
    scene.add(this.group);
  }
  setProfile(profile: DetailProfile) { this.profile = profile; }
  clear() {

    this.group.visible=false;this.group.position.set(0,0,0);this.group.rotation.set(0,0,0);this.cast.clear();this.cameraBlend.clear();this.staged.active=false;
    this.staged.casterPosition.set(0,0,0);this.staged.fistCenter.set(0,0,0);this.staged.impact.set(0,0,0);
    for(const child of this.group.children){child.visible=false;child.position.set(0,0,0);child.rotation.set(0,0,0);if(child instanceof THREE.InstancedMesh)child.count=0;}
    const material=this.dent.material as THREE.ShaderMaterial;material.uniforms.age.value=material.uniforms.alpha.value=0;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;this.clear();

    this.group.parent?.remove(this.group);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        geometries.add(object.geometry);
        materials.add(object.material as THREE.Material);
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
    const windup = smooth(.9, 2.5, t), strike = smooth(2.5, NUKE_BLAST, t);
    const fade = 1 - smooth(4.2, NUKE_DURATION, t);
    const summon = smooth(0, .9, t);
    const target = shot.impact;
    this.group.position.set(target.x, 0, target.z);

    this.staged.impact.set(target.x,0,target.z);
    const shoulderX = (anchor?.x ?? this.cast.position.x)-target.x, shoulderZ = (anchor?.z ?? this.cast.position.z)-target.z;
    const shoulderY=anchor?.y ?? 1;
    const bend=reduced?0:Math.sin(Math.PI*strike)*9;
    const headX = shoulderX * (1 - strike)-Math.sin(this.cast.angle)*bend, headZ = shoulderZ * (1 - strike)+Math.cos(this.cast.angle)*bend;
    const y = reduced ? (t < 2.5 ? 8 + windup * 7 : 15 - strike * 11) : (t < 2.5 ? 7 + windup * 23 : 30 - strike * 26);
    const fistSize = reduced ? 1.5 + summon * 6 + windup * 3 : 2 + summon * 11 + windup * 5;
    this.fist.visible = this.ink.visible = t < NUKE_BLAST;
    this.fist.position.set(headX, y, headZ);
    this.fist.rotation.set(-.38 - strike * .85, this.cast.angle + Math.PI / 2, reduced ? 0 : Math.sin(t * 3) * .045 * windup);
    const compression=reduced?0:smooth(2.05,2.5,t)*(1-strike);
    this.fist.scale.set(fistSize*(1+compression*.17-strike*.09),fistSize*(1-compression*.34+strike*.24),fistSize*(1+compression*.17-strike*.09));
    this.staged.fistCenter.set(headX+target.x,y,headZ+target.z);
    this.ink.position.copy(this.fist.position); this.ink.rotation.copy(this.fist.rotation);
    this.ink.scale.copy(this.fist.scale).multiplyScalar(1.045);
    this.creases.visible=this.fist.visible;this.creases.position.copy(this.fist.position);this.creases.rotation.copy(this.fist.rotation);this.creases.scale.copy(this.fist.scale);
    this.cuff.visible = this.arm.visible = this.fist.visible;
    this.cuff.position.set(headX, y - fistSize * .47, headZ);
    this.cuff.rotation.x = Math.PI / 2;
    this.cuff.scale.setScalar(fistSize * .4);
    this.arm.position.set(0,0,0);this.arm.scale.setScalar(1);
    const vertices=this.arm.geometry.getAttribute('position') as THREE.BufferAttribute,normals=this.arm.geometry.getAttribute('normal') as THREE.BufferAttribute;
    for(let row=0;row<=20;row++){
      const q=row/20,curve=reduced?0:Math.sin(Math.PI*q)*(6+windup*5)*(1-strike*.5),tubeRadius=fistSize*.095*(.7+q*.3);
      const cx=THREE.MathUtils.lerp(shoulderX,headX,q)-Math.sin(this.cast.angle)*curve,cz=THREE.MathUtils.lerp(shoulderZ,headZ,q)+Math.cos(this.cast.angle)*curve;
      const cy=THREE.MathUtils.lerp(shoulderY,y-fistSize*.25,q);
      for(let side=0;side<=8;side++){const a=side/8*Math.PI*2,index=row*9+side;vertices.setXYZ(index,cx+Math.cos(a)*tubeRadius,cy,cz+Math.sin(a)*tubeRadius);normals.setXYZ(index,Math.cos(a),0,Math.sin(a));}
    }
    vertices.needsUpdate=normals.needsUpdate=true;
    this.shadow.visible = t < NUKE_BLAST;
    this.shadow.position.set(0,-.3,0);
    this.shadow.rotation.x=-Math.PI/2;this.shadow.scale.setScalar(5+windup*14-strike*7);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = .1 + strike * .23;
    this.dent.visible = blast > 0;
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
    this.smoke.visible=true;
    this.smoke.count = visual?.managed&&shot.detonated?0:blast > 0 ? smokeCount : (reduced ? 4 : 12);
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
    this.curls.visible=!reduced;this.curls.count=reduced||(visual?.managed&&shot.detonated)?0:this.profile==='mobile'?6:12;
    for(let i=0;i<this.curls.count;i++){
      const a=i*2.39996,age=Math.max(0,blast-i%4*.06),r=blast>0?10+age*(20+i%3*4):3+i%3;
      const linger=blast>0?Math.max(0,1-age/(1.65+i%3*.18)):summon;
      this.dummy.position.set((blast>0?0:shoulderX)+Math.cos(a)*r,blast>0?4+age*7:shoulderY+1.6+i%2,(blast>0?0:shoulderZ)+Math.sin(a)*r);
      this.dummy.rotation.set(0,-this.cast.angle,a*.2+(reduced?0:t*.25));this.dummy.scale.setScalar((blast>0?3.5:1.4)*linger);this.dummy.updateMatrix();this.curls.setMatrixAt(i,this.dummy.matrix);
    }this.curls.instanceMatrix.needsUpdate=true;
    this.wind.visible=!reduced && t>2.5 && t<3.4;
    const windPositions=this.wind.geometry.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<12;i++){const a=i*Math.PI/6,r=fistSize*.65;windPositions.setXYZ(i*2,headX+Math.cos(a)*r,y+3,headZ+Math.sin(a)*r);windPositions.setXYZ(i*2+1,headX+Math.cos(a)*r*1.3,y+10+strike*7,headZ+Math.sin(a)*r*1.3);}windPositions.needsUpdate=true;
    const frame = ultimateFrame('skybreaker', t, reduced);
    if(visual?.managed && blast>=0 && shot.detonated){
      for(const ring of this.rings)ring.visible=false;this.smoke.visible=false;this.stars.visible=false;this.curls.visible=false;
    }
    if (frame.cameraWeight > 0 && cinematicCamera) {
      const recovery=smooth(3.4,4.1,t);
      this.cameraBounds.min.set(shoulderX+target.x-3,0,shoulderZ+target.z-3);this.cameraBounds.max.set(shoulderX+target.x+3,5,shoulderZ+target.z+3);
      this.corner.set(headX+target.x-fistSize,y-fistSize,headZ+target.z-fistSize);this.cameraBounds.expandByPoint(this.corner);
      this.corner.set(headX+target.x+fistSize,y+fistSize,headZ+target.z+fistSize);this.cameraBounds.expandByPoint(this.corner);
      this.cameraBounds.getCenter(this.cameraFocus);this.corner.set(target.x,7,target.z);this.cameraFocus.lerp(this.corner,recovery*.65);
      this.fit.fit(this.targetPosition,camera,this.cameraBounds,this.cameraFocus,this.cast.angle+.85,.48+recovery*.4,55+recovery*32);
      this.cameraBlend.blend(camera,this.targetPosition,this.cameraFocus,frame.cameraWeight);
    }
  }
}
