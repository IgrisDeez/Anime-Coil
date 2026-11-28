import * as THREE from "three";
import { Arena, NUKE_BLAST, NUKE_DURATION } from "./simulation";
import { ultimateFrame } from './ultimate-presentation';
import type { DetailProfile } from './worlds/types';
import { ruptureSheetGeometry } from './vfx-geometry';
import type { UltimateVisualFrame } from './ultimate-visual';

const smooth = (start: number, end: number, value: number) => THREE.MathUtils.smoothstep(value, start, end);

// One branching ground scar, reused around the blast with different instance transforms.
// The dark centre and luminous edges are vertex colours, so this stays one draw call.
function fractureGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const bends = [0, -.045, .13, .08, .37, .29, .55, .47];
  for (let i = 0; i < bends.length; i++) {
    const x = i / (bends.length - 1);
    const width = (.13 + Math.sin(x * Math.PI) * .38) * (1 - x * .93);
    const edge = [.23 * (1 - x), .06 * (1 - x), .48 * (1 - x)];
    for (const [offset, color] of [[-width, edge], [0, [.022, .008, .043]], [width, [.045, .016, .088]]] as const) {
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

/** A shaded attraction or repulsion seed with one thin surface current. */
function polaritySurface(repulsion: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, alpha: { value: 0 }, polarity: { value: repulsion ? 1 : 0 } },
    transparent: true, depthWrite: false,
    vertexShader: `
      varying vec3 surface, viewNormal;
      void main() {
        surface = position;
        viewNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      varying vec3 surface, viewNormal;
      uniform float time, alpha, polarity;
      void main() {
        vec3 p = normalize(surface);
        float rim = pow(1. - max(0., normalize(viewNormal).z), 2.4);
        float drift = mix(-1., 1., polarity) * time * 1.15;
        float shear = p.y + mix(.41, -.56, polarity) * p.x + .18 * sin(3.6 * p.x + 2.2 * p.z + drift);
        float filament = 1. - smoothstep(.014, .072, abs(shear));
        float span = smoothstep(-.86, -.40, p.z) * (1. - smoothstep(.54, .85, p.y));
        float shade = .34 + .66 * max(0., dot(normalize(viewNormal), normalize(vec3(-.47, .56, .70))));
        vec3 dark = mix(vec3(.002, .012, .056), vec3(.063, .003, .012), polarity);
        vec3 tint = mix(vec3(.024, .60, .94), vec3(.86, .033, .098), polarity);
        vec3 hot = mix(vec3(.63, .95, 1.), vec3(1., .78, .59), polarity);
        vec3 col = dark + tint * (.13 * shade + .64 * rim + .13 * filament * span);
        col = mix(col, hot, filament * span * (.63 + rim * .24));
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// Persistent effect geometry: no frame-time mesh creation or map-owned assets.
export class PurpleCinematic {
  group = new THREE.Group();
  private core: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private cavity: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private red: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private blue: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
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
  private disposed=false;
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
    this.core = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
      defines:{MOBILE_CORE:profile==='mobile'?1:0},
      uniforms:{time:{value:0},compression:{value:0},alpha:{value:1}},transparent:true,depthWrite:false,
      vertexShader:'varying vec3 p;varying vec3 n;void main(){p=normalize(position);n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
        varying vec3 p; varying vec3 n;
        uniform float time, compression, alpha;
        void main(){
          vec3 v = normalize(p);
          float clock = time * (.58 - compression * .51);
          float slash = dot(v, vec3(.55, .77, -.27)) + .17 * sin(v.x * 6. + v.z * 3. - clock);
          float edge = 1. - max(0., normalize(n).z);
          float rim = edge * edge * edge;
          float span = .4 + .6*smoothstep(.15, .58, normalize(n).z);
          float seam = (1. - smoothstep(.012, .060, abs(slash))) * span;
          #if MOBILE_CORE == 0
            float fractured = dot(v, vec3(-.18, .7, .59)) + .14 * sin(v.x * 7. + clock);
            seam += (1. - smoothstep(.017, .06, abs(fractured))) * smoothstep(.05, .73, -v.x) * .57;
          #endif
          float pull = .23 + .77 * smoothstep(.14, .83, max(0., v.y + .31 * v.x));
          vec3 ink = vec3(.006, .002, .014) + vec3(.083, .010, .17) * pull * (1. - .92 * compression);
          vec3 violet = vec3(.43, .062, .93);
          vec3 colour = ink + violet * (rim * (.73 + .24 * compression) + seam * (.47 - .19 * compression));
          colour = mix(colour, vec3(.81, .64, 1.), clamp(seam * (.35 + compression*.40 + rim*.20), 0., .84));
          gl_FragColor = vec4(colour, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }));
    this.core.name='purple-compressed-core';
    this.cavity = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({color:'#27123d',transparent:true,opacity:.6,depthWrite:false}));
    this.red = new THREE.Mesh(sphere, polaritySurface(true));
    this.red.name = 'purple-red-repulsion';
    this.blue = new THREE.Mesh(sphere, polaritySurface(false));
    this.blue.name = 'purple-blue-attraction';
    this.group.add(this.core, this.cavity, this.red, this.blue, this.light);
    for (let i = 0; i < 2; i++) {
      const reflection = new THREE.Mesh(new THREE.CircleGeometry(1, 24), material(i ? '#469cff' : '#ff597b'));
      reflection.rotation.x = -Math.PI / 2; this.reflections.push(reflection); this.group.add(reflection);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 2 * 3), 3));
      const filament = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color:i ? '#7cbfff' : '#ff789b', transparent:true, opacity:.75}));
      filament.frustumCulled = false; this.filaments.push(filament); this.group.add(filament);
    }
    this.shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), material('#bb78ff'), 24);
    this.sheets = new THREE.InstancedMesh(ruptureSheetGeometry(), new THREE.MeshBasicMaterial({color:'#c59cff',transparent:true,opacity:.62,side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false,blending:THREE.AdditiveBlending}),16);
    for (const mesh of [this.shards,this.sheets]) { mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(mesh); }
    this.fractures = new THREE.InstancedMesh(fractureGeometry(), new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.75,side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false}),28);
    this.fractures.name = 'purple-ground-fractures';
    this.fractures.frustumCulled = false;
    this.fractures.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.fractures);
    this.corona = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
      uniforms: {time:{value:0}, alpha:{value:0}}, transparent:true, depthWrite:false,
      blending:THREE.AdditiveBlending, side:THREE.DoubleSide, forceSinglePass:true,
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
  setProfile(profile: DetailProfile) {if(this.profile===profile)return;this.profile=profile;this.core.material.defines.MOBILE_CORE=profile==='mobile'?1:0;this.core.material.needsUpdate=true;}
  clear(){this.group.visible=false;this.light.intensity=0;this.core.material.uniforms.alpha.value=0;}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.clear();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    this.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.LineSegments){
      geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
      if(o instanceof THREE.InstancedMesh)o.dispose();
    }});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group.removeFromParent();
  }
  update(
    arena: Arena | undefined,
    camera: THREE.PerspectiveCamera,
    menu: boolean,
    reduced = false,
    cinematicCamera = true,
    visual?: Readonly<UltimateVisualFrame>,
  ) {
    const shot = !menu && arena?.player.alive && arena.state!=='over' && arena.cinematic;
    this.group.visible = !this.disposed && !!shot && shot.kind === "purple";
    if (!this.group.visible || !shot || !arena || shot.kind !== "purple") {this.clear();return;}
    const t = shot.time, p = arena.player, blast = Math.max(0, t - NUKE_BLAST);
    const detonated = t >= NUKE_BLAST;
    const frame = ultimateFrame('purple', t, reduced);
    const managed = visual?.managed === true;
    const softened = reduced || visual?.reducedFlashes;
    const charge = Math.min(1, t / NUKE_BLAST), fade = Math.max(0, 1 - blast / (NUKE_DURATION - NUKE_BLAST));
    const merge = THREE.MathUtils.smoothstep(t, 1.2, 2.5), compress = THREE.MathUtils.smoothstep(t, 2.5, NUKE_BLAST);
    const rupture = detonated ? 1 - smooth(.16, 1.05, blast) : 0;
    const front = detonated ? Math.min(125, 7 + blast * 93) : 0;
    this.group.position.set(p.x, 0, p.z);
    this.core.material.uniforms.time.value = softened ? 0 : t;
    this.core.material.uniforms.compression.value=reduced?0:compress;

    this.sparks.material.color.set("#d8b6ff");
    this.light.color.set("#a347ff");
    const height = 5;
    this.core.position.y = height;
    this.sparks.position.y = height;
    const fusion = smooth(1.43, 2.26, t);
    const handoff = 1 - smooth(0, .075, blast);
    const chargeSize = (.4 + charge * charge * 6) * 2.65 * (1 - compress * .64);
    const radius = Math.max(.5, chargeSize * (.38 + .62 * fusion)) * (detonated && managed ? .36 + handoff * .64 : 1);
    const fold = softened ? 0 : compress * .16 * (1 - smooth(3.12, NUKE_BLAST, t));
    if (detonated && !managed) this.core.scale.setScalar(5 + blast * 22);
    else this.core.scale.set(radius * (1 + fold), radius * (1 - fold), radius);
    this.core.visible = fusion > .015 && (!detonated || !managed || handoff > .01);
    this.core.material.uniforms.alpha.value = detonated && !managed
      ? rupture * (reduced ? .16 : .3) : .99 * fusion * handoff;
    this.cavity.visible = detonated && blast < .9; this.cavity.position.y = height;
    this.cavity.scale.setScalar(3 + Math.min(blast, .75) * 20);
    this.cavity.material.opacity = (1 - smooth(.08, .9, blast)) * (reduced ? .25 : .55);
    this.corona.visible = detonated && rupture > .01;
    this.corona.position.y = height;
    this.corona.scale.setScalar(6+Math.min(blast,1.25)*49);
    this.corona.material.uniforms.time.value = reduced ? 0 : t;
    this.corona.material.uniforms.alpha.value = rupture*(reduced?.18:.58);
    const redBirth = smooth(.54, 1.07, t), blueBirth = smooth(.08, .60, t);
    const absorb = 1 - smooth(1.82, 2.44, t);
    const orbit = 8 * (1 - merge) + .7 * merge;
    const spin = reduced ? 0 : t * (.78 + 1.72 * smooth(1.08, 1.96, t));
    this.red.position.set(Math.cos(spin + .27) * orbit, height + 1.35 * (1 - merge), Math.sin(spin + .27) * orbit);
    this.blue.position.set(-Math.cos(spin) * orbit, height - .65 * (1 - merge), -Math.sin(spin) * orbit);
    this.red.scale.setScalar(Math.max(.12, (1.9 + merge * .45) * redBirth));
    this.blue.scale.setScalar(Math.max(.12, (2.2 + merge * .36) * blueBirth));
    this.reflections.forEach((reflection, i) => {
      const source = i ? this.blue : this.red;
      const alpha = (i ? blueBirth : redBirth) * absorb;
      source.visible = alpha > .015;
      source.material.uniforms.alpha.value = alpha;
      source.material.uniforms.time.value = softened ? 0 : t;
      reflection.visible = source.visible;
      reflection.position.set(source.position.x, -.32, source.position.z);
      reflection.scale.setScalar(source.scale.x * 1.42);
      reflection.material.opacity = (reduced ? .06 : .14) * alpha;
    });
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.material.color.set(i % 2 ? "#7750ff" : "#e1afff");
      const delay = i * .115, waveAge = Math.max(0, blast - delay);
      const orbiting = i < (reduced || compress > .55 ? 1 : 2) && fusion > .08;
      ring.visible = detonated ? blast >= delay && waveAge < 1.2 : orbiting;
      ring.position.y = detonated ? (i === 4 ? height : -.24 + i * .014) : height;
      ring.scale.setScalar(
        detonated ? Math.min(134, 5 + waveAge * (118 + i * 9)) : radius * (i === 0 ? 1.34 : 1.58),
      );
      ring.rotation.set(
        detonated && i === 4 ? 0 : Math.PI / 2 + (detonated ? 0 : i === 0 ? -.54 : .67),
        reduced ? 0 : detonated ? i * .3 : i === 0 ? -.32 + t * .31 : .92 - t * .28,
        0,
      );
      ring.material.opacity = detonated
        ? (1 - smooth(.35, 1.2, waveAge)) * (i === 4 ? .28 : .6) * (reduced ? .35 : 1)
        : (i === 0 ? .55 : .28) * fusion * (1 - compress * .61) * (softened ? .5 : 1);
    }
    this.filaments.forEach((line, side) => {
      if(visual?.managed&&detonated){line.visible=false;return;}
      const source = side ? this.blue : this.red;
      line.visible = !reduced && (detonated ? blast < .95 : source.visible);
      if (!line.visible) return;
      (line.material as THREE.LineBasicMaterial).color.set(detonated ? side ? '#f1bdff' : '#a990ff' : side ? '#7cbfff' : '#ff789b');
      (line.material as THREE.LineBasicMaterial).opacity = detonated ? .8 * (1 - smooth(.25, .95, blast)) : source.material.uniforms.alpha.value * (softened ? .25 : .65);
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
          const strand = Math.floor(i / 4), q = i % 4 / 4;
          const spinDir = side ? -1 : 1;
          const turn = strand * 2.399963 + spin * spinDir;
          for (let endpoint = 0; endpoint < 2; endpoint++) {
            const progress = q + endpoint * .25;
            const phase = turn + progress * 1.46 * spinDir;
            const growth = side ? 1 - progress : progress;
            const radius = source.scale.x * (1.08 + growth * .53 + (strand % 3) * .14);
            positions.setXYZ(i * 2 + endpoint, source.position.x + Math.cos(phase) * radius,
              source.position.y + Math.sin(phase + turn) * radius * .40,
              source.position.z + Math.sin(phase) * radius);
          }
        }
      }
      positions.needsUpdate = true;
    });
    this.shards.count = reduced || (visual?.managed&&detonated) ? 0 : this.profile === 'mobile' ? 12 : 24;
    this.sheets.count = reduced || (visual?.managed&&detonated) ? 0 : this.profile === 'mobile' ? 8 : 16;
    this.fractures.count = reduced ? 8 : this.profile === 'mobile' ? (managed ? 8 : 16) : (managed ? 14 : 28);
    this.shards.visible = this.sheets.visible = detonated && !reduced && fade > .01 && rupture > .01;
    this.fractures.visible = detonated && blast < 1.65;
    (this.fractures.material as THREE.MeshBasicMaterial).opacity = (1 - smooth(.21, 1.45, blast)) * (reduced ? .25 : .63);
    if (this.fractures.visible) {
      for (let i = 0; i < this.fractures.count; i++) {
        const main = i < 4, side = i % 2 ? 1 : -1;
        const angle = p.angle + (side > 0 ? .12 : 3.5) + Math.sin(i * 2.399963) * (main ? .56 : 1.43);
        const reach = Math.min(88, front * 1.12) * (main ? 1 - i * .06 : .20 + i % 5 * .081);
        const offset = main ? .55 : 2.3 + i % 4 * 1.04;
        this.dummy.position.set(Math.cos(angle) * offset, -.19 + (i % 3) * .006, Math.sin(angle) * offset);
        this.dummy.rotation.set(0, -angle, 0);
        this.dummy.scale.set(reach, 1, main ? 2.05 : .68 + i % 4 * .27);
        this.dummy.updateMatrix();
        this.fractures.setMatrixAt(i, this.dummy.matrix);
      }
      this.fractures.instanceMatrix.needsUpdate = true;
    }
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
    this.sparks.visible = !reduced && (detonated ? rupture > .01 : fusion > .12 && compress < .86);
    this.sparks.scale.setScalar(detonated ? 10 + blast * 57 : radius * (1.5 + (1 - fusion) * .8));
    this.sparks.rotation.y = reduced ? 0 : t * 0.4;
    this.sparks.material.opacity = detonated ? rupture : fusion * (1 - compress) * (softened ? .24 : .52);
    this.light.intensity = reduced ? 0 : detonated ? rupture * 38 : 4 + merge * 16;
    if(visual?.managed && detonated){
      this.corona.visible=false;this.cavity.visible=false;for(const ring of this.rings)ring.visible=false;
      this.shards.visible=false;this.sheets.visible=false;this.sparks.visible=false;for(const line of this.filaments)line.visible=false;
      this.light.intensity=visual.reducedFlashes||reduced?0:Math.max(0,1-blast/.16)*8;
    }
    if (frame.cameraWeight > 0 && cinematicCamera) {
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
