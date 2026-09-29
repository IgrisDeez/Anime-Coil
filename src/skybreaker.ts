import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Arena, NUKE_BLAST, NUKE_DURATION } from './simulation';
import { ultimateFrame } from './ultimate-presentation';
import { impactStarGeometry } from './vfx-geometry';
import type { DetailProfile } from './worlds/types';

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
  private basePosition = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();
  private baseQuaternion = new THREE.Quaternion();
  private targetQuaternion = new THREE.Quaternion();
  private fistGeometry: THREE.BufferGeometry;
  private disposed = false;
  constructor(scene: THREE.Scene, private profile: DetailProfile = 'desktop') {
    const mat = (color: string, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide});
    this.fistGeometry = giantFistGeometry();
    this.fist = new THREE.Mesh(this.fistGeometry, new THREE.MeshToonMaterial({color:'#fffaf0', emissive:'#bdb1e2', emissiveIntensity:.22}));
    this.ink = new THREE.Mesh(this.fistGeometry, new THREE.MeshBasicMaterial({color:'#463653', side:THREE.BackSide}));
    this.ink.scale.setScalar(1.045);
    this.cuff = new THREE.Mesh(new THREE.TorusGeometry(1, .19, 6, 24), mat('#b49ad8'));
    this.arm = new THREE.Mesh(new THREE.CylinderGeometry(.8, .55, 1, 12), mat('#f8ede8'));
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat('#3f3658', .24));
    this.dent = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat('#b79fcf', .3));
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
    this.group.add(this.ink, this.fist, this.cuff, this.arm, this.shadow, this.dent, this.smoke, this.stars);
    this.group.visible = false;
    scene.add(this.group);
  }
  setProfile(profile: DetailProfile) { this.profile = profile; }
  clear() { this.group.visible = false; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.group.parent?.remove(this.group);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        materials.add(object.material as THREE.Material);
        if (object instanceof THREE.InstancedMesh) object.dispose();
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }
  update(arena: Arena | undefined, camera: THREE.PerspectiveCamera, menu: boolean, reduced = false) {
    const shot = !menu && arena?.cinematic;
    this.group.visible = !this.disposed && !!shot && shot.kind === 'skybreaker';
    if (!this.group.visible || !shot || !arena) return;
    const t = shot.time, blast = Math.max(0, t - NUKE_BLAST), p = arena.player;
    const windup = smooth(.9, 2.5, t), strike = smooth(2.5, NUKE_BLAST, t);
    const fade = 1 - smooth(4.2, NUKE_DURATION, t);
    const summon = smooth(0, .9, t);
    const target = shot.impact;
    this.group.position.set(target.x, 0, target.z);
    const shoulderX = p.x - target.x, shoulderZ = p.z - target.z;
    const headX = shoulderX * (1 - strike), headZ = shoulderZ * (1 - strike);
    const y = reduced ? (t < 2.5 ? 8 + windup * 7 : 15 - strike * 11) : (t < 2.5 ? 7 + windup * 23 : 30 - strike * 26);
    const fistSize = reduced ? 1.5 + summon * 6 + windup * 3 : 2 + summon * 11 + windup * 5;
    this.fist.visible = this.ink.visible = t < NUKE_BLAST;
    this.fist.position.set(headX, y, headZ);
    this.fist.rotation.set(-.38 - strike * .85, p.angle + Math.PI / 2, reduced ? 0 : Math.sin(t * 7) * .06 * windup);
    this.fist.scale.setScalar(fistSize);
    this.ink.position.copy(this.fist.position); this.ink.rotation.copy(this.fist.rotation);
    this.ink.scale.setScalar(fistSize * 1.045);
    this.cuff.visible = this.arm.visible = this.fist.visible;
    this.cuff.position.set(headX, y - fistSize * .47, headZ);
    this.cuff.rotation.x = Math.PI / 2;
    this.cuff.scale.setScalar(fistSize * .4);
    this.arm.position.set((shoulderX + headX) * .5, y*.5, (shoulderZ + headZ) * .5);
    this.arm.scale.set(fistSize*.13, Math.max(2,y*.5), fistSize*.13);
    this.shadow.visible = t < NUKE_BLAST;
    this.shadow.position.set(0,-.3,0);
    this.shadow.scale.setScalar(5 + windup * 11 + strike * 10);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = .1 + strike * .23;
    this.dent.visible = blast > 0;
    this.dent.position.set(0,-.31,0);
    this.dent.scale.setScalar(6 + blast * 27);
    (this.dent.material as THREE.MeshBasicMaterial).opacity = .27 * fade;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.visible = blast > i * .12 && (i === 0 || (!reduced && this.profile === 'desktop'));
      ring.position.set(0, -.27 + i * .012, 0);
      const age = Math.max(0, blast - i*.12);
      ring.scale.setScalar(3 + age * (115 + i*13));
      (ring.material as THREE.MeshBasicMaterial).opacity = .72 * Math.max(0, 1 - age / 1.45);
    }
    const smokeCount = reduced ? 8 : this.profile === 'mobile' ? 14 : 24;
    this.smoke.count = blast > 0 ? smokeCount : (reduced ? 4 : 12);
    for (let i = 0; i < this.smoke.count; i++) {
      const a = i * 2.399963, radius = blast > 0 ? 7 + blast * (28 + i%5*3) : 2.5 + i%4;
      this.dummy.position.set(Math.cos(a)*radius, blast > 0 ? 1+Math.sin(Math.min(1,blast)*Math.PI)*5+i%3 : 1.5+i%3*.8, Math.sin(a)*radius);
      this.dummy.scale.setScalar((blast > 0 ? 2.7+i%4*.6 : .65) * (blast > 0 ? fade : summon));
      this.dummy.rotation.set(0,0,0); this.dummy.updateMatrix(); this.smoke.setMatrixAt(i,this.dummy.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
    this.stars.count = !reduced && blast > 0 ? (this.profile === 'mobile' ? 8 : 20) : 0;
    for (let i = 0; i < this.stars.count; i++) {
      const a = i * 2.399963, radius = 5 + blast * (20+i%3*6);
      this.dummy.position.set(Math.cos(a)*radius,.2,Math.sin(a)*radius);
      this.dummy.rotation.set(0,a,0); this.dummy.scale.setScalar((3+i%3*.7)*fade);
      this.dummy.updateMatrix(); this.stars.setMatrixAt(i,this.dummy.matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    const frame = ultimateFrame('skybreaker', t, reduced);
    if (frame.cameraWeight > 0) {
      const aspect = Math.max(1, .86/camera.aspect);
      const impactBlend=smooth(NUKE_BLAST,NUKE_BLAST+.45,t);
      const baseDistance=t<NUKE_BLAST?54+windup*4:THREE.MathUtils.lerp(58,72+blast*9,impactBlend);
      const distance=baseDistance*(1+(aspect-1)*(1-impactBlend));
      const centerX=THREE.MathUtils.lerp(p.x,target.x,strike),centerZ=THREE.MathUtils.lerp(p.z,target.z,strike);
      this.basePosition.copy(camera.position); this.baseQuaternion.copy(camera.quaternion);
      this.targetPosition.set(centerX + Math.cos(p.angle+.7)*distance*.34,
        Math.max(29,distance*aspect), centerZ + Math.sin(p.angle+.7)*distance*.34+distance*.6);
      camera.position.lerpVectors(this.basePosition,this.targetPosition,frame.cameraWeight);
      camera.lookAt(centerX,t < NUKE_BLAST ? 22*(1-strike)+4*strike : 0,centerZ);
      this.targetQuaternion.copy(camera.quaternion);
      camera.quaternion.copy(this.baseQuaternion).slerp(this.targetQuaternion,frame.cameraWeight);
    }
  }
}
