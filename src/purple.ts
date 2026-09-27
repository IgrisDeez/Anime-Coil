import * as THREE from "three";
import { Arena, NUKE_BLAST, NUKE_DURATION } from "./simulation";
import { ultimateFrame } from './ultimate-presentation';
import type { DetailProfile } from './worlds/types';
import { ruptureSheetGeometry } from './vfx-geometry';

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
    const frame = ultimateFrame('purple', t, reduced);
    const charge = Math.min(1, t / NUKE_BLAST), fade = Math.max(0, 1 - blast / (NUKE_DURATION - NUKE_BLAST));
    const merge = THREE.MathUtils.smoothstep(t, 1.2, 2.5), compress = THREE.MathUtils.smoothstep(t, 2.5, NUKE_BLAST);
    this.group.position.set(p.x, 0, p.z);
    this.core.material.color.set("#c65cff");
    this.sparks.material.color.set("#d8b6ff");
    this.light.color.set("#a347ff");
    const height = 5;
    this.core.position.y = height;
    this.sparks.position.y = height;
    const chargeSize = (.4 + charge * charge * 6) * (1 - compress * .55);
    this.core.scale.setScalar(blast > 0 ? 4 + blast * 10 : chargeSize);
    this.core.material.opacity = blast > 0 ? fade * .13 : .48 + merge * .19;
    this.inner.visible = t >= 1.2 && t < NUKE_BLAST;
    this.inner.position.y = height; this.inner.scale.setScalar(chargeSize * .42);
    this.inner.material.opacity = .25 + merge * .5;
    this.cavity.visible = blast > 0; this.cavity.position.y = height;
    this.cavity.scale.setScalar(2.3 + blast * 11); this.cavity.material.opacity = fade * .57;
    this.red.visible = this.blue.visible = t < 2.6;
    const orbit = 8 * (1 - merge) + .7 * merge, spin = reduced ? 0 : t * (t < 1.2 ? .8 : 2.7);
    this.red.position.set(Math.cos(spin) * orbit, height, Math.sin(spin) * orbit);
    this.blue.position.set(-this.red.position.x, height, -this.red.position.z);
    this.red.scale.setScalar(1.2 + merge * .25);
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
      ring.position.y = blast > 0 ? .7 : height;
      ring.scale.setScalar(
        blast > 0 ? 6 + blast * (31 + i * 12) : 3 + i * 1.4 + merge * 3,
      );
      ring.rotation.set(
        Math.PI / 2 + (blast > 0 ? i * 0.15 : i * 0.5),
        reduced ? 0 : t * 0.4 + i,
        0,
      );
      ring.material.opacity = fade * (blast > 0 ? .6 : .15 + merge * .22) * (reduced ? .6 : 1);
    }
    this.filaments.forEach((line, side) => {
      line.visible = t < NUKE_BLAST && !reduced;
      const positions = line.geometry.attributes.position as THREE.BufferAttribute;
      const count = this.profile === 'mobile' ? 12 : 24;
      line.geometry.setDrawRange(0, count * 2);
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 + spin * (side ? -1 : 1);
        const radius = t < 2.5 ? orbit : 1.4 + i % 4 * 1.2;
        const wobble = Math.sin(t * 13 + i * 3.2) * (t < 2.5 ? .08 : .5);
        const offset = side ? Math.PI : 0;
        positions.setXYZ(i * 2, Math.cos(a+offset) * radius, height + Math.sin(a*2) * 1.1, Math.sin(a+offset) * radius);
        positions.setXYZ(i * 2 + 1, Math.cos(a+offset+.28) * (radius + wobble), height + Math.sin((a+.28)*2) * 1.1 + wobble, Math.sin(a+offset+.28) * (radius+wobble));
      }
      positions.needsUpdate = true;
    });
    this.shards.count = reduced ? 0 : this.profile === 'mobile' ? 12 : 24;
    this.sheets.count = reduced ? 0 : this.profile === 'mobile' ? 8 : 16;
    this.shards.visible = this.sheets.visible = blast > 0;
    for (let i = 0; i < this.shards.count; i++) {
      const a = i * 2.39996, radius = 3 + blast * (18 + i % 5 * 5);
      this.dummy.position.set(Math.cos(a) * radius, 1.2 + i % 5 * .7 + blast * 2, Math.sin(a) * radius);
      this.dummy.rotation.set(blast + i, a, i * .3); this.dummy.scale.setScalar((1.1 + i % 3 * .35) * fade);
      this.dummy.updateMatrix(); this.shards.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < this.sheets.count; i++) {
      const a = i * Math.PI * 2 / this.sheets.count, radius = 2 + blast * 33;
      this.dummy.position.set(Math.cos(a) * radius, 2 + blast * 3, Math.sin(a) * radius);
      this.dummy.rotation.set(0, -a, .32+i*.09); this.dummy.scale.set(2.5 + blast * 12, (5 + i % 3 * 2) * fade, 1);
      this.dummy.updateMatrix(); this.sheets.setMatrixAt(i, this.dummy.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = this.sheets.instanceMatrix.needsUpdate = true;
    this.sparks.visible = !reduced;
    this.sparks.scale.setScalar(blast > 0 ? 8 + blast * 45 : 35 * (1 - merge) + 8);
    this.sparks.rotation.y = reduced ? 0 : t * 0.4;
    this.sparks.material.opacity = fade;
    this.light.intensity = reduced ? 0 : fade * (blast > 0 ? 35 : 4 + merge * 16);
    if (frame.cameraWeight > 0) {
      const zoom = t < 1.2 ? 38 : t < 2.5 ? 38 + merge * 10 : t < NUKE_BLAST ? 48 + compress * 36 : 92 + blast * 8;
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
