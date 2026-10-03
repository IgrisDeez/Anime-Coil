import * as THREE from "three";
import { Arena, NUKE_BLAST, NUKE_DURATION } from "../simulation";
import { ultimateFrame } from '../ultimate-presentation';
import type { DetailProfile } from '../worlds/types';
import { ruptureSheetGeometry } from '../vfx-geometry';

const smooth = (start: number, end: number, value: number) => THREE.MathUtils.smoothstep(value, start, end);

// One branching ground scar, reused around the blast with different instance transforms.
// The dark centre and luminous edges are vertex colours, so this stays one draw call.
function fractureGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const bends = [0, .13, -.11, .2, -.05, .15, -.1, .03];
  for (let i = 0; i < bends.length; i++) {
    const x = i / (bends.length - 1), width = (.6 + Math.sin(x * Math.PI) * .35) * (1 - x * .78);
    for (const [offset, color] of [[-width, [.66, .28, .9]], [0, [.075, .025, .13]], [width, [.66, .28, .9]]] as const) {
      positions.push(x, 0, bends[i] + offset);
      colors.push(...color);
    }
    if (i === 0) continue;
    const a = (i - 1) * 3, b = i * 3;
    indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

// Persistent effect geometry: no frame-time mesh creation or map-owned assets.
export class PurpleCinematic {
  group = new THREE.Group();
  private core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private inner: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private cavity: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private red: THREE.Mesh;
  private blue: THREE.Mesh;
  private rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] =
    [];
  private sparks: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private filaments: THREE.LineSegments[] = [];
  private shards: THREE.InstancedMesh;
  private sheets: THREE.InstancedMesh;
  private fractures: THREE.InstancedMesh;
  private corona: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private reflections: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
  private dummy = new THREE.Object3D();
  private basePosition = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();
  private baseQuaternion = new THREE.Quaternion();
  private targetQuaternion = new THREE.Quaternion();
  private profile: DetailProfile;
  private light = new THREE.PointLight("#a347ff", 0, 200, 1);
  constructor(scene: THREE.Scene, profile: DetailProfile = 'desktop') {
    this.profile = profile;
    const sphere = new THREE.SphereGeometry(1, 32, 20);
    const material = (color: string) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    this.core = new THREE.Mesh(sphere, material("#c65cff"));
    this.inner = new THREE.Mesh(sphere, material('#fff0ff'));
    this.cavity = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({color:'#27123d',transparent:true,opacity:.6,depthWrite:false}));
    this.red = new THREE.Mesh(sphere, material("#ff325d"));
    this.blue = new THREE.Mesh(sphere, material("#258aff"));
    this.group.add(this.core, this.inner, this.cavity, this.red, this.blue, this.light);
    for (let i = 0; i < 2; i++) {
      const reflection = new THREE.Mesh(new THREE.CircleGeometry(1, 24), material(i ? '#469cff' : '#ff597b'));
      reflection.rotation.x = -Math.PI / 2; this.reflections.push(reflection); this.group.add(reflection);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 2 * 3), 3));
      const filament = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color:i ? '#7cbfff' : '#ff789b', transparent:true, opacity:.75}));
      filament.frustumCulled = false; this.filaments.push(filament); this.group.add(filament);
    }
    this.shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), material('#bb78ff'), 24);
    this.sheets = new THREE.InstancedMesh(ruptureSheetGeometry(), new THREE.MeshBasicMaterial({color:'#c59cff',transparent:true,opacity:.62,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),16);
    for (const mesh of [this.shards,this.sheets]) { mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(mesh); }
    this.fractures = new THREE.InstancedMesh(fractureGeometry(), new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}),28);
    this.fractures.name = 'purple-ground-fractures';
    this.fractures.frustumCulled = false;
    this.fractures.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.fractures);
    this.corona = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
      uniforms: {time:{value:0}, alpha:{value:0}}, transparent:true, depthWrite:false,
      blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
      vertexShader:`varying vec3 vPosition; varying vec3 vNormal;
        uniform float time;
        void main(){vPosition=position;vNormal=normalize(normalMatrix*normal);
          float tear=sin(position.x*13.+time*5.)*sin(position.y*11.-time*4.)*.055;
          tear+=sin(position.z*19.+position.x*7.)*.035;
          vec3 p=position*(1.+tear);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`varying vec3 vPosition; varying vec3 vNormal; uniform float time; uniform float alpha;
        void main(){float rim=pow(1.-abs(normalize(vNormal).z),1.55);
          float vein=pow(max(0.,sin(vPosition.x*21.+vPosition.z*13.+time*7.)
            *cos(vPosition.y*17.-time*5.)),7.);
          vec3 color=mix(vec3(.35,.055,.82),vec3(1.,.86,1.),clamp(rim*.6+vein*.7,0.,1.));
          gl_FragColor=vec4(color,alpha*clamp(rim*.75+vein*.35,0.,1.));}`,
    }));
    this.corona.name = 'purple-impact-corona';
    this.group.add(this.corona);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.025, 6, 96),
        material(i % 2 ? "#7750ff" : "#e1afff"),
      );
      this.rings.push(ring);
      this.group.add(ring);
    }
    const positions = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const a = i * 2.39996,
        y = 1 - (2 * (i + 0.5)) / 240,
        r = Math.sqrt(1 - y * y);
      positions.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#d8b6ff",
        size: 0.65,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.group.add(this.sparks);
    this.group.visible = false;
    scene.add(this.group);
  }
  setProfile(profile: DetailProfile) { this.profile = profile; }
  update(
    arena: Arena | undefined,
    camera: THREE.PerspectiveCamera,
    menu: boolean,
    reduced = false,
  ) {
    const shot = !menu && arena?.cinematic;
    this.group.visible = !!shot && shot.kind === "purple";
    if (!shot || !arena || shot.kind !== "purple") return;
    const t = shot.time, p = arena.player, blast = Math.max(0, t - NUKE_BLAST);
    const detonated = t >= NUKE_BLAST;
    const frame = ultimateFrame('purple', t, reduced);
    const charge = Math.min(1, t / NUKE_BLAST), fade = Math.max(0, 1 - blast / (NUKE_DURATION - NUKE_BLAST));
    const merge = THREE.MathUtils.smoothstep(t, 1.2, 2.5), compress = THREE.MathUtils.smoothstep(t, 2.5, NUKE_BLAST);
    const rupture = detonated ? 1 - smooth(.16, 1.05, blast) : 0;
    const front = detonated ? Math.min(125, 7 + blast * 93) : 0;
    this.group.position.set(p.x, 0, p.z);
    this.core.material.color.set("#c65cff");
    this.sparks.material.color.set("#d8b6ff");
    this.light.color.set("#a347ff");
    const height = 5;
    this.core.position.y = height;
    this.sparks.position.y = height;
    const chargeSize = (.4 + charge * charge * 6) * 2.4 * (1 - compress * .55);
    this.core.scale.setScalar(detonated ? 5 + blast * 22 : chargeSize);
    this.core.material.opacity = detonated ? rupture * (reduced ? .16 : .3) : .48 + merge * .19;
    this.inner.visible = t >= 1.2 && t < NUKE_BLAST;
    this.inner.position.y = height; this.inner.scale.setScalar(chargeSize * .42);
    this.inner.material.opacity = .25 + merge * .5;
    this.cavity.visible = detonated && blast < .9; this.cavity.position.y = height;
    this.cavity.scale.setScalar(3 + Math.min(blast, .75) * 20);
    this.cavity.material.opacity = (1 - smooth(.08, .9, blast)) * (reduced ? .25 : .55);
    this.corona.visible = detonated && rupture > .01;
    this.corona.position.y = height;
    this.corona.scale.setScalar(6 + Math.min(blast, 1.25) * 49);
    this.corona.material.uniforms.time.value = reduced ? 0 : t;
    this.corona.material.uniforms.alpha.value = rupture * (reduced ? .18 : .58);
    this.red.visible = this.blue.visible = t < 2.6;
    const orbit = 8 * (1 - merge) + .7 * merge, spin = reduced ? 0 : t * (t < 1.2 ? .8 : 2.7);
    this.red.position.set(Math.cos(spin) * orbit, height, Math.sin(spin) * orbit);
    this.blue.position.set(-this.red.position.x, height, -this.red.position.z);
    this.red.scale.setScalar((1.2 + merge * .25) * 1.5);
    this.blue.scale.copy(this.red.scale);
    this.reflections.forEach((reflection, i) => {
      reflection.visible = t < 2.6;
      const source = i ? this.blue : this.red;
      reflection.position.set(source.position.x, -.32, source.position.z);
      reflection.scale.setScalar(3.2 + merge * 2);
      reflection.material.opacity = (reduced ? .07 : .16) * (1 - compress);
    });
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.material.color.set(i % 2 ? "#7750ff" : "#e1afff");
      const delay = i * .115, waveAge = Math.max(0, blast - delay);
      ring.visible = !detonated || (blast >= delay && waveAge < 1.2);
      ring.position.y = detonated ? (i === 4 ? height : -.24 + i * .014) : height;
      ring.scale.setScalar(
        detonated ? Math.min(134, 5 + waveAge * (118 + i * 9)) : (3 + i * 1.4 + merge * 3) * 1.4,
      );
      ring.rotation.set(
        detonated && i === 4 ? 0 : Math.PI / 2 + (detonated ? 0 : i * .5),
        reduced ? 0 : detonated ? i * .3 : t * 0.4 + i,
        0,
      );
      ring.material.opacity = detonated
        ? (1 - smooth(.35, 1.2, waveAge)) * (i === 4 ? .28 : .6) * (reduced ? .35 : 1)
        : (.15 + merge * .22) * (reduced ? .6 : 1);
    }
    this.filaments.forEach((line, side) => {
      line.visible = !reduced && (t < NUKE_BLAST || blast < .95);
      (line.material as THREE.LineBasicMaterial).color.set(detonated ? side ? '#f1bdff' : '#a990ff' : side ? '#7cbfff' : '#ff789b');
      (line.material as THREE.LineBasicMaterial).opacity = detonated ? .8 * (1 - smooth(.25, .95, blast)) : .75;
      const positions = line.geometry.attributes.position as THREE.BufferAttribute;
      const count = this.profile === 'mobile' ? 12 : 24;
      line.geometry.setDrawRange(0, count * 2);
      for (let i = 0; i < count; i++) {
        if (detonated) {
          const bolt = Math.floor(i / 4), branch = i % 4, a = (bolt + side * count / 4) * Math.PI * 8 / count;
          const reach = Math.min(front * .9, 75), r0 = 3 + reach * branch / 4, r1 = 3 + reach * (branch + 1) / 4;
          const bend0 = branch ? Math.sin(bolt * 5 + branch * 9) * 1.5 : 0;
          const bend1 = Math.sin(bolt * 5 + (branch + 1) * 9) * 1.5;
          positions.setXYZ(i * 2, Math.cos(a) * r0 - Math.sin(a) * bend0, 5 + branch * 2.3, Math.sin(a) * r0 + Math.cos(a) * bend0);
          positions.setXYZ(i * 2 + 1, Math.cos(a) * r1 - Math.sin(a) * bend1, 5 + (branch + 1) * 2.3, Math.sin(a) * r1 + Math.cos(a) * bend1);
        } else {
          const a = i / count * Math.PI * 2 + spin * (side ? -1 : 1);
          const radius = t < 2.5 ? orbit : 1.4 + i % 4 * 1.2;
          const wobble = Math.sin(t * 13 + i * 3.2) * (t < 2.5 ? .08 : .5);
          const offset = side ? Math.PI : 0;
          positions.setXYZ(i * 2, Math.cos(a+offset) * radius, height + Math.sin(a*2) * 1.1, Math.sin(a+offset) * radius);
          positions.setXYZ(i * 2 + 1, Math.cos(a+offset+.28) * (radius + wobble), height + Math.sin((a+.28)*2) * 1.1 + wobble, Math.sin(a+offset+.28) * (radius+wobble));
        }
      }
      positions.needsUpdate = true;
    });
    this.shards.count = reduced ? 0 : this.profile === 'mobile' ? 12 : 24;
    this.sheets.count = reduced ? 0 : this.profile === 'mobile' ? 8 : 16;
    this.fractures.count = reduced ? 8 : this.profile === 'mobile' ? 16 : 28;
    this.shards.visible = this.sheets.visible = detonated && !reduced && fade > .01 && rupture > .01;
    this.fractures.visible = detonated && blast < 1.65;
    (this.fractures.material as THREE.MeshBasicMaterial).opacity = (1 - smooth(.65, 1.65, blast)) * (reduced ? .25 : .72);
    for (let i = 0; i < this.fractures.count; i++) {
      const angle = i * 2.399963 + (i % 3) * .11;
      const reach = front * (.48 + i % 5 * .095);
      this.dummy.position.set(0, -.19 + (i % 3) * .006, 0);
      this.dummy.rotation.set(0, -angle, 0);
      this.dummy.scale.set(reach, 1, 1.1 + i % 4 * .7);
      this.dummy.updateMatrix(); this.fractures.setMatrixAt(i, this.dummy.matrix);
    }
    this.fractures.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.shards.count; i++) {
      const a = i * 2.39996, radius = 3 + blast * (28 + i % 5 * 7);
      this.dummy.position.set(Math.cos(a) * radius, 1.2 + i % 5 * .7 + blast * 4, Math.sin(a) * radius);
      this.dummy.rotation.set(blast + i, a, i * .3); this.dummy.scale.setScalar((1.4 + i % 3 * .5) * fade);
      this.dummy.updateMatrix(); this.shards.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < this.sheets.count; i++) {
      const a = i * Math.PI * 2 / this.sheets.count, radius = 2 + Math.min(blast, 1.1) * 48;
      this.dummy.position.set(Math.cos(a) * radius, 1.5 + blast * 5, Math.sin(a) * radius);
      this.dummy.rotation.set(0, -a, .18+i*.13); this.dummy.scale.set(5 + blast * 21, (10 + i % 3 * 3) * rupture, 1);
      this.dummy.updateMatrix(); this.sheets.setMatrixAt(i, this.dummy.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = this.sheets.instanceMatrix.needsUpdate = true;
    this.sparks.visible = !reduced && (!detonated || rupture > .01);
    this.sparks.scale.setScalar(detonated ? 10 + blast * 57 : 35 * (1 - merge) + 8);
    this.sparks.rotation.y = reduced ? 0 : t * 0.4;
    this.sparks.material.opacity = detonated ? rupture : 1;
    this.light.intensity = reduced ? 0 : detonated ? rupture * 38 : 4 + merge * 16;
    if (frame.cameraWeight > 0) {
      const zoom = t < 1.2 ? 43 : t < 2.5 ? 43 + merge * 10 : t < NUKE_BLAST ? 53 + compress * 31 : 94 + blast * 8;
      const width = Math.max(1, .85 / camera.aspect);
      this.basePosition.copy(camera.position); this.baseQuaternion.copy(camera.quaternion);
      this.targetPosition.set(p.x + Math.cos(p.angle + .6) * zoom * .36,
        Math.max(29, zoom * width), p.z + Math.sin(p.angle + .6) * zoom * .36 + zoom * .58);
      camera.position.lerpVectors(this.basePosition, this.targetPosition, frame.cameraWeight);
      camera.lookAt(p.x, blast ? 0 : 3, p.z);
      this.targetQuaternion.copy(camera.quaternion);
      camera.quaternion.copy(this.baseQuaternion).slerp(this.targetQuaternion, frame.cameraWeight);
    }
  }
}
