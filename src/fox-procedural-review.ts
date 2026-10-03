// Frozen 1.7.3 procedural baseline for matched review only.
import * as THREE from 'three';
import { CastSnapshot, foxFlight } from './cinematic-staging';
import { createFoxSummon, foxTailGeometry } from './fox-model';
export { foxTailGeometry } from './fox-model';
import { Arena, NUKE_BLAST, NUKE_DURATION, RADIUS } from './simulation';
import { ultimateFrame } from './ultimate-presentation';
import type { DetailProfile } from './worlds/types';

const smooth = (a: number, b: number, t: number) => THREE.MathUtils.smoothstep(t, a, b);

type ReadonlyVector = Readonly<{ x: number; y: number; z: number }>;
export interface FoxStaging {
  readonly active: boolean;
  readonly casterPosition: ReadonlyVector;
  readonly casterFacing: number;
  readonly summonOrigin: ReadonlyVector;
  readonly summonBounds: Readonly<{ min: ReadonlyVector; max: ReadonlyVector }>;
  readonly muzzle: ReadonlyVector;
  readonly bombCenter: ReadonlyVector;
  readonly firingDirection: ReadonlyVector;
  readonly cameraFocus: ReadonlyVector;
}

/** A separate, bounded summon/launch renderer; simulation time owns every stage. */
export class FoxCinematic {
  readonly group = new THREE.Group();
  private sculpture = createFoxSummon();
  private beast = this.sculpture.beast;
  private tails: THREE.InstancedMesh;
  private tailEdges: THREE.InstancedMesh;
  private orb: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private wake: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  private flames: THREE.InstancedMesh;
  private smoke: THREE.InstancedMesh;
  private fragments: THREE.InstancedMesh;
  private beastMaterials: THREE.Material[] = [];
  private rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private ribbons: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private embers: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private dummy = new THREE.Object3D();
  private impact = new THREE.Vector3();
  private basePosition = new THREE.Vector3();
  private target = new THREE.Vector3();
  private look = new THREE.Vector3();
  private gameplayDirection = new THREE.Vector3();
  private returnFocus = new THREE.Vector3();
  private summonOrigin = new THREE.Vector3();
  private chargeAnchor = new THREE.Vector3();
  private flightDirection = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private xAxis = new THREE.Vector3(1, 0, 0);
  private zAxis = new THREE.Vector3(0, 0, 1);
  private tailTilt = new THREE.Quaternion();
  private bounds = new THREE.Box3();
  private partBounds = new THREE.Box3();
  private framingBounds = new THREE.Box3();
  private tailMatrix = new THREE.Matrix4();
  private modelMatrix = new THREE.Matrix4();
  private corner = new THREE.Vector3();
  private back = new THREE.Vector3();
  private right = new THREE.Vector3();
  private cameraUp = new THREE.Vector3();
  private localFocus = new THREE.Vector3();
  private staged = { active: false, casterPosition: new THREE.Vector3(), casterFacing: 0, summonOrigin: new THREE.Vector3(), summonBounds: { min: new THREE.Vector3(), max: new THREE.Vector3() },
    muzzle: new THREE.Vector3(), bombCenter: new THREE.Vector3(), firingDirection: new THREE.Vector3(), cameraFocus: new THREE.Vector3() };
  get staging(): FoxStaging { return this.staged; }
  private cast = new CastSnapshot();
  private disposed = false;
  constructor(scene: THREE.Scene, private profile: DetailProfile = 'desktop') {
    const glow = (color: string, opacity = .7) => new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true});
    this.tails = new THREE.InstancedMesh(foxTailGeometry(), new THREE.MeshToonMaterial({vertexColors:true,
      emissive:'#a65117',emissiveIntensity:.16,transparent:true,opacity:.94}), 9);
    this.tailEdges = new THREE.InstancedMesh(this.tails.geometry, glow('#ad4b1f', .85), 9);
    this.tails.name = 'fox-nine-tails'; this.tailEdges.name = 'fox-tail-contours';
    (this.tailEdges.material as THREE.MeshBasicMaterial).side = THREE.BackSide;
    this.tailEdges.renderOrder = 1; this.tails.renderOrder = 2;
    for (const mesh of [this.tailEdges, this.tails]) {
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.beast.add(mesh);
    }
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, alpha: { value: 1 }, pressure: { value: 0 } }, transparent: true, depthWrite: true,
      vertexShader: 'varying vec3 spherePoint; varying vec3 viewNormal; void main(){spherePoint=normalize(position);viewNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float time; uniform float alpha; uniform float pressure;
      varying vec3 spherePoint; varying vec3 viewNormal;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 p=spherePoint*3.8;float slow=time*.23;
        float warp=noise3(p*.8+vec3(slow,-slow*.4,slow*.2));
        float broad=noise3(p+vec3(warp*.8,slow,warp*.6));
        float fine=noise3(p*2.5+vec3(slow*.7,-slow*.6,warp));
        float channels=pow(smoothstep(.48,.77,broad*.72+fine*.28),2.4);
        float hot=pow(smoothstep(.7,.9,broad*.67+fine*.33),1.8);
        vec3 dark=vec3(.035,.006,.017), ember=vec3(.43,.045,.025);
        vec3 color=mix(dark,ember,channels*.86);
        color+=vec3(1.,.31,.035)*hot*(1.1+pressure*.35);
        float rim=pow(1.-abs(viewNormal.z),3.2);
        color+=vec3(.77,.17,.035)*rim*.42;
        gl_FragColor=vec4(color,alpha);}`,
    }));
    this.beast.name = 'fox-summon';
    this.orb.name = 'fox-bomb-core';
    this.shell = new THREE.Mesh(this.orb.geometry, new THREE.ShaderMaterial({
      uniforms:{time:{value:0},alpha:{value:.16}}, transparent:true, depthWrite:false,
      side:THREE.BackSide, blending:THREE.AdditiveBlending,
      vertexShader:'varying vec3 spherePoint;varying vec3 viewNormal;void main(){spherePoint=normalize(position);viewNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform float time;uniform float alpha;varying vec3 spherePoint;varying vec3 viewNormal;
        void main(){float rough=sin(dot(spherePoint,vec3(13.7,21.1,9.3))+time*1.4)*sin(dot(spherePoint,vec3(25.2,7.8,18.4))-time*.9);
          float rim=pow(1.-abs(viewNormal.z),2.5);float split=smoothstep(-.3,.65,rough);
          gl_FragColor=vec4(vec3(1.,.29,.055),alpha*rim*(.3+.7*split));}`
    }));
    this.shell.name = 'fox-bomb-shell';
    this.wake = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 12, 1, true), glow('#ffb34c', .3));
    this.flames = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2, 5), glow('#ffffff', .66), 16);
    this.flames.frustumCulled=false;this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i=0;i<16;i++) this.flames.setColorAt(i,new THREE.Color(['#ffe0a1','#f78b39','#b9472d','#ffb44e'][i%4]));
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),glow('#74534b',.48),30);
    this.fragments = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1),glow('#ffb653',.8),30);
    for (const mesh of [this.smoke,this.fragments]) { mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .025, 5, 72), glow(i === 1 ? '#9e4931' : '#ffe1a0'));
      ring.rotation.x = -Math.PI / 2; this.rings.push(ring); this.group.add(ring);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 6), 3));
    this.ribbons = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color: '#ffe3a0', transparent: true, opacity: .7}));
    this.ribbons.frustumCulled = false;
    const points = new THREE.BufferGeometry();
    points.setAttribute('position', new THREE.BufferAttribute(new Float32Array(96 * 3), 3));
    this.embers = new THREE.Points(points, new THREE.PointsMaterial({color:'#ffcb70', size:.5, transparent:true, depthWrite:false}));
    this.embers.frustumCulled = false;
    this.group.add(this.beast, this.orb, this.shell, this.wake, this.ribbons, this.embers, this.flames, this.smoke, this.fragments);
    this.beast.traverse(o=>{if(o instanceof THREE.Mesh)this.beastMaterials.push(o.material as THREE.Material);});
    this.group.name = 'fox-cinematic'; this.group.visible = false; scene.add(this.group);
  }
  setProfile(profile: DetailProfile) { this.profile = profile; }
  clear() {
    this.group.visible = false; this.staged.active = false; this.cast.clear();
    this.staged.casterPosition.set(0,0,0); this.staged.summonOrigin.set(0,0,0); this.staged.casterFacing = 0;
    this.beast.rotation.set(0,0,0); this.sculpture.head.rotation.set(0,0,0);
    this.sculpture.leftPaw.rotation.set(0,0,0); this.sculpture.rightPaw.rotation.set(0,0,0);
    this.orb.visible = this.shell.visible = this.wake.visible = false;
    this.flames.count = this.smoke.count = this.fragments.count = 0;
    this.flames.visible = this.smoke.visible = this.fragments.visible = this.ribbons.visible = this.embers.visible = false;
    for (const ring of this.rings) ring.visible = false;
    this.beast.position.set(0,0,0); this.beast.scale.setScalar(1); this.group.position.set(0,0,0); this.group.rotation.set(0,0,0);
    for (const material of this.beastMaterials) material.opacity = 0;
    this.orb.material.uniforms.time.value = this.shell.material.uniforms.time.value = 0;
    this.orb.material.uniforms.alpha.value = this.shell.material.uniforms.alpha.value = 0;
    this.orb.material.uniforms.pressure.value = 0;
    this.staged.muzzle.set(0,0,0); this.staged.bombCenter.set(0,0,0); this.staged.firingDirection.set(0,0,0);
    this.staged.cameraFocus.set(0,0,0); this.staged.summonBounds.min.set(0,0,0); this.staged.summonBounds.max.set(0,0,0);
  }
  update(arena: Arena | undefined, camera: THREE.PerspectiveCamera, menu: boolean, reduced = false, cinematicCamera = true) {
    const shot = !menu && arena?.player.alive && arena.state !== 'over' && arena.cinematic;
    this.group.visible = !this.disposed && !!shot && shot.kind === 'fox';
    if (!this.group.visible || !shot || !arena) { this.clear(); return; }
    const t = shot.time, b = Math.max(0, t - NUKE_BLAST);
    this.cast.capture(arena);
    const facing = this.cast.angle;
    const rearClearance = reduced || !cinematicCamera ? 50 : 30;
    this.summonOrigin.set(this.cast.position.x-Math.cos(facing)*rearClearance,0,this.cast.position.z-Math.sin(facing)*rearClearance);
    this.staged.casterPosition.copy(this.cast.position); this.staged.casterFacing = facing;
    this.staged.summonOrigin.copy(this.summonOrigin);
    const manifest = smooth(0, .9, t), charge = smooth(.9, 2.5, t), launch = smooth(2.5, 3.4, t);
    const fade = 1 - smooth(4.3, NUKE_DURATION, t), frame = ultimateFrame('fox', t, reduced);
    this.group.position.set(this.cast.position.x, 0, this.cast.position.z); this.group.rotation.y = Math.PI / 2 - facing;
    this.group.updateMatrixWorld(true);
    this.impact.set(shot.impact.x, .2, shot.impact.z); this.group.worldToLocal(this.impact);
    this.beast.position.copy(this.summonOrigin); this.group.worldToLocal(this.beast.position);
    this.beast.position.y = .45 - (reduced ? 0 : 4 * (1 - manifest));
    this.beast.scale.setScalar((reduced ? 1 : .84 + manifest * .16) * 1.8);
    const tension = smooth(.65,2.4,t)*(1-smooth(3.4,4.3,t));
    this.beast.rotation.x = reduced ? .025 : .025+tension*.025;
    this.sculpture.head.rotation.x = reduced ? .06 : .06+tension*.13;
    this.sculpture.leftPaw.rotation.x = reduced ? -.12 : -.12-tension*.22;
    this.sculpture.rightPaw.rotation.x = reduced ? -.12 : -.12-tension*.25;
    this.sculpture.leftPaw.rotation.z = reduced ? -.04 : -.04-tension*.055;
    this.sculpture.rightPaw.rotation.z = reduced ? .04 : .04+tension*.055;
    for(const material of this.beastMaterials)material.opacity=manifest*fade;
    this.tailTilt.setFromAxisAngle(this.xAxis, -Math.PI / 2 - .16);
    for (let i = 0; i < 9; i++) {
      const rank=i-4, flex=reduced?0:Math.sin(t*1.05+i*.72)*.023*tension;
      this.dummy.position.set(rank*.4,8.1+Math.abs(rank)*.14,-2.65-(i%2)*.43);
      this.dummy.quaternion.setFromAxisAngle(this.zAxis,-rank*.245+flex).multiply(this.tailTilt);
      this.dummy.rotateY(rank*.055);
      this.dummy.scale.set(6.3+Math.abs(rank)*.22,6.0-(i%2)*.3,9.1-Math.abs(rank)*.48+(i%2)*.16);
      this.dummy.updateMatrix(); this.tailEdges.setMatrixAt(i, this.dummy.matrix);
      this.dummy.scale.multiplyScalar(.945); this.dummy.updateMatrix(); this.tails.setMatrixAt(i, this.dummy.matrix);
    }
    this.tails.instanceMatrix.needsUpdate = this.tailEdges.instanceMatrix.needsUpdate = true;
    this.group.updateMatrixWorld(true);
    this.sculpture.muzzle.getWorldPosition(this.staged.muzzle);
    this.sculpture.muzzle.getWorldDirection(this.staged.firingDirection);
    this.updateSummonBounds(); this.staged.active = true;
    const radius = (.6 + charge * 3.5) * 2.8;
    this.chargeAnchor.copy(this.staged.muzzle).addScaledVector(this.staged.firingDirection, radius + 2.8);
    this.group.worldToLocal(this.chargeAnchor);
    const chargeX = this.chargeAnchor.x, chargeY = this.chargeAnchor.y, chargeZ = this.chargeAnchor.z;
    this.orb.visible = t >= .65 && t < NUKE_BLAST;
    foxFlight(this.orb.position,this.flightDirection,this.chargeAnchor,this.impact,launch,radius);
    this.orb.position.y = Math.max(radius + .28, this.orb.position.y);
    this.orb.scale.setScalar(radius);
    this.staged.bombCenter.copy(this.orb.position); this.group.localToWorld(this.staged.bombCenter);
    this.shell.visible = this.orb.visible || (b < 1.8 && shot.detonated);
    if (this.orb.visible) {
      this.shell.position.copy(this.orb.position);
      this.shell.scale.setScalar(radius * 1.09);
      this.shell.material.uniforms.alpha.value = .16 + charge*.07;
    } else if (this.shell.visible) {
      const dome = reduced ? 25 : 10 + b * 40;
      this.shell.position.set(this.impact.x, 2.5, this.impact.z);
      this.shell.scale.set(dome, dome * .46, dome);
      this.shell.material.uniforms.alpha.value = (reduced ? .11 : .23) * (1 - smooth(.1, 1.8, b));
    }
    this.orb.material.uniforms.time.value = reduced ? 0 : t;
    this.orb.material.uniforms.alpha.value = THREE.MathUtils.clamp((t-.65) / .3, 0, 1);
    this.orb.material.uniforms.pressure.value = reduced ? .25 : charge;
    this.shell.material.uniforms.time.value = reduced ? 0 : t;
    this.wake.visible = !reduced && t >= 2.5 && t < 3.4;
    const wakeLength = 1 + launch * 17;
    this.wake.position.copy(this.orb.position).addScaledVector(this.flightDirection,-wakeLength*.5);
    this.wake.quaternion.setFromUnitVectors(this.up,this.flightDirection);
    this.wake.scale.set(radius * .65, wakeLength, radius * .65);
    this.flames.count = shot.detonated && b < 1.75 ? (reduced ? 6 : this.profile === 'mobile' ? 8 : 16) : 0;
    for(let i=0;i<this.flames.count;i++) {
      const layer=i%3,age=Math.max(0,b-layer*.07),a=i*2.39996+layer*.21;
      const r=reduced?12:5+Math.min(1,age/1.35)*(79+layer*8);
      this.dummy.position.set(this.impact.x+Math.cos(a)*r,1.8+Math.min(10,age*(7+layer*2)),this.impact.z+Math.sin(a)*r);
      this.dummy.rotation.set(Math.sin(a)*.65,a,-Math.cos(a)*.65);
      this.dummy.scale.set(reduced?2:3+layer*.8,(reduced?2:7+layer*2)*Math.max(.001,1-age/1.75),reduced?2:2.8);
      this.dummy.updateMatrix();this.flames.setMatrixAt(i,this.dummy.matrix);
    }
    this.flames.instanceMatrix.needsUpdate=true;
    this.flames.visible=this.flames.count>0;
    this.smoke.count = shot.detonated && b < 2.1 ? reduced ? 6 : this.profile === 'mobile' ? 14 : 30 : 0;
    for(let i=0;i<this.smoke.count;i++) {
      const layer=i%3, delay=(i%6)*.045+layer*.06, age=Math.max(0,b-delay);
      const growth=Math.min(1,age/(.28+layer*.12));
      const linger=Math.min(1,Math.max(0,(2.1-delay-age)/.7));
      const a=i*2.39996, r=(5+layer*6)+growth*(18+layer*13);
      this.dummy.position.set(this.impact.x+Math.cos(a)*r,3+layer*5+growth*(8+layer*2),this.impact.z+Math.sin(a)*r);
      this.dummy.rotation.set(i*.31,a,age*.21);
      this.dummy.scale.set((4+layer*1.5)*growth*linger,(3+layer*2)*growth*linger,(5+layer*2)*growth*linger);
      this.dummy.updateMatrix();this.smoke.setMatrixAt(i,this.dummy.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate=true;
    this.smoke.visible=this.smoke.count>0;
    (this.smoke.material as THREE.MeshBasicMaterial).opacity=fade*(reduced?.3:.48);
    this.fragments.count=shot.detonated && b<1.9 ? reduced ? 0 : this.profile==='mobile' ? 14 : 30 : 0;
    for(let i=0;i<this.fragments.count;i++) {
      const a=i*2.39996, speed=15+i%7*3, r=3+b*speed;
      this.dummy.position.set(this.impact.x+Math.cos(a)*r,2+b*(7+i%5*3),this.impact.z+Math.sin(a)*r);
      this.dummy.rotation.set(b*2+i,b*1.4,i*.3);
      this.dummy.scale.setScalar((.55+i%4*.22)*Math.max(.001,1-b/1.9));
      this.dummy.updateMatrix();this.fragments.setMatrixAt(i,this.dummy.matrix);
    }
    this.fragments.instanceMatrix.needsUpdate=true;
    this.fragments.visible=this.fragments.count>0;
    for (let i = 0; i < 3; i++) {
      const ring = this.rings[i];
      const age=Math.max(0,b-i*.09);
      ring.visible = b > 0 ? shot.detonated && age<1.9 && (this.profile !== 'mobile' || i < 2) : i === 0;
      ring.position.set(b > 0 ? this.impact.x : this.beast.position.x, .15 + i * .17, b > 0 ? this.impact.z : this.beast.position.z);
      const size = b > 0 ? (reduced ? 17 + i * 6 : Math.min(135,5+age*(112-i*16))) : 10 + manifest * 8;
      ring.scale.set(size, size, b > 0 ? 3 + Math.max(0, 1-b) * 14 : 1);
      ring.material.opacity = b > 0 ? Math.min(1,age/.12)*Math.max(0, 1-age/1.9) * .77 : manifest * .45;
    }
    const lines = this.ribbons.geometry.attributes.position as THREE.BufferAttribute;
    const tailAftermath=shot.detonated && b < 1.45;
    const lineCount = reduced ? 0 : tailAftermath ? this.profile === 'mobile' ? 18 : 36 : this.profile === 'mobile' ? 24 : 48;
    this.ribbons.geometry.setDrawRange(0, lineCount * 2);
    this.ribbons.visible = !reduced && ((t > .9 && t < 2.5) || tailAftermath);
    for (let i=0;i<lineCount;i++) {
      if (tailAftermath) {
        const tail=Math.floor(i/4),segment=i%4,a=tail*Math.PI*2/9+b*.12;
        for(let j=0;j<2;j++) {
          const s=(segment+j)/4,r=8+b*42+s*(11+b*26),twist=Math.sin(s*Math.PI)*(.18+tail*.015);
          lines.setXYZ(i*2+j,this.impact.x+Math.cos(a+twist)*r,3+s*(9+b*5),this.impact.z+Math.sin(a+twist)*r);
        }
      } else {
        const a=i*2.39996, flow=((i*.17-t*.8)%1+1)%1;
        for (let j=0;j<2;j++) {
          const q=Math.max(0,flow-j*.09), distance=radius+2+q*(5+radius*.5);
          lines.setXYZ(i*2+j,chargeX+Math.cos(a)*distance,chargeY+Math.sin(a)*distance*.7,chargeZ-distance*(.35+Math.sin(a*.7)*.25));
        }
      }
    }
    lines.needsUpdate=true;
    const particles=this.embers.geometry.attributes.position as THREE.BufferAttribute;
    const count=reduced?8:this.profile==='mobile'?40:96;
    this.embers.visible = true;
    this.embers.geometry.setDrawRange(0,count); this.embers.material.opacity=manifest*fade*.75;
    for(let i=0;i<count;i++) {
      const a=i*2.39996, drift=reduced?0:t;
      const r=b>0?4+b*(17+i%16):6+i%14;
      particles.setXYZ(i,(b>0?this.impact.x:this.beast.position.x)+Math.cos(a)*r,
        b>0?2+((i*.83+drift*4)%25):(i*.83+drift*3)%18,
        (b>0?this.impact.z:this.beast.position.z)+Math.sin(a)*r);
    }
    particles.needsUpdate=true;
    this.stageCamera(camera,t,radius);
    if (frame.cameraWeight>0 && cinematicCamera) {
      this.basePosition.copy(camera.position);
      camera.getWorldDirection(this.gameplayDirection);
      this.returnFocus.copy(this.basePosition).addScaledVector(this.gameplayDirection,-this.basePosition.y / Math.min(-.001,this.gameplayDirection.y));
      if (shot.detonated && t>=NUKE_BLAST && b < .11 && !reduced) this.target.y += (1-b/.11)*1.0;
      camera.position.lerpVectors(this.basePosition,this.target,frame.cameraWeight);
      this.returnFocus.lerp(this.look,frame.cameraWeight);
      camera.lookAt(this.returnFocus);
    }
  }
  private updateSummonBounds() {
    this.bounds.makeEmpty();
    for (const mesh of this.sculpture.meshes) {
      this.partBounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld); this.bounds.union(this.partBounds);
    }
    for (let i=0;i<9;i++) {
      this.tailEdges.getMatrixAt(i,this.tailMatrix); this.modelMatrix.multiplyMatrices(this.beast.matrixWorld,this.tailMatrix);
      this.partBounds.copy(this.tails.geometry.boundingBox!).applyMatrix4(this.modelMatrix); this.bounds.union(this.partBounds);
    }
    this.staged.summonBounds.min.copy(this.bounds.min); this.staged.summonBounds.max.copy(this.bounds.max);
  }
  private stageCamera(camera: THREE.PerspectiveCamera,t:number,radius:number) {
    const chargeView=smooth(.6,1.55,t), launchView=smooth(2.5,3.4,t), aftermath=smooth(3.4,4.1,t);
    this.framingBounds.copy(this.bounds);
    // Retain the small unrevealed core and the captured blast volume in the fit;
    // adding/removing an invisible orb at .65 or 3.4 would cause a camera cut.
    this.corner.copy(this.staged.bombCenter).addScalar(radius*1.09); this.framingBounds.expandByPoint(this.corner);
    this.corner.copy(this.staged.bombCenter).addScalar(-radius*1.09); this.framingBounds.expandByPoint(this.corner);
    this.framingBounds.getCenter(this.look);
    // Move the look direction through three connected compositions, never hard cuts.
    this.localFocus.set(this.impact.x,12,this.impact.z); this.group.localToWorld(this.localFocus);
    this.look.lerp(this.localFocus,aftermath*.66);
    this.staged.cameraFocus.copy(this.look);
    const azimuth=THREE.MathUtils.lerp(.47,1.05,chargeView)+launchView*.15;
    this.back.set(Math.sin(azimuth),.22+launchView*.12,Math.cos(azimuth)).normalize();
    this.back.transformDirection(this.group.matrixWorld);
    this.right.crossVectors(this.up,this.back).normalize(); this.cameraUp.crossVectors(this.back,this.right).normalize();
    const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),tanX=tanY*camera.aspect;
    let distance=45;
    for (let i=0;i<8;i++) {
      this.corner.set(i&1?this.framingBounds.max.x:this.framingBounds.min.x,i&2?this.framingBounds.max.y:this.framingBounds.min.y,i&4?this.framingBounds.max.z:this.framingBounds.min.z).sub(this.look);
      const depth=this.corner.dot(this.back);
      distance=Math.max(distance,depth+Math.abs(this.corner.dot(this.right))/(tanX*.84),depth+Math.abs(this.corner.dot(this.cameraUp))/(tanY*.76));
    }
    distance+=aftermath*12;
    this.target.copy(this.look).addScaledVector(this.back,distance);
    this.target.y=Math.max(30,this.target.y);
    // Only raise the eye when the path leaves the tall-scenery-free arena.
    const sceneryClearance = smooth(RADIUS-24,RADIUS-8,Math.hypot(this.target.x,this.target.z));
    this.target.y = THREE.MathUtils.lerp(this.target.y,Math.max(64,this.target.y),sceneryClearance);
  }
  dispose() {
    if(this.disposed)return; this.disposed=true; this.clear();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    this.group.traverse(o=>{if(o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments){
      geometries.add(o.geometry); const list=Array.isArray(o.material)?o.material:[o.material];list.forEach(m=>materials.add(m));
      if(o instanceof THREE.InstancedMesh)o.dispose();
    }});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group.removeFromParent();
  }
}
