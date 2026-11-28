import * as THREE from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CastSnapshot, CinematicCamera, CinematicFit } from "./cinematic-staging";
import type { RenderAnchor } from "./vfx-anchors";
import { Arena, NUKE_BLAST, NUKE_DURATION, serpentScale } from "./simulation";
import { ultimateFrame } from './ultimate-presentation';
import type { DetailProfile } from './worlds/types';
import type { UltimateVisualFrame } from './ultimate-visual';

export function spiritEffectCounts(profile: DetailProfile) {
  return profile === 'mobile'
    ? { clouds: 24, petals: 24, motes: 60, ribbonsPerColor: 3, rays: 20 }
    : { clouds: 36, petals: 48, motes: 100, ribbonsPerColor: 5, rays: 32 };
}

export function spiritOrbHeight(charge: number, flight: number, radius: number): number {
  const lifted = 10 + Math.max(0, Math.min(1, charge)) * 28;
  const descent = Math.max(0, Math.min(1, flight));
  return THREE.MathUtils.lerp(lifted, radius + .28, descent * descent * (3 - 2 * descent));
}

// Spirit Bomb owns an independent, pooled effect. No Gojo meshes or animation paths.
export class SpiritCinematic {
  private root = new THREE.Group();
  get presentationGroup(){return this.root;}
  private orb = new THREE.Group();
  private arms = new THREE.Group();
  private shoulders: THREE.Group[] = [];
  private shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private cloud: THREE.InstancedMesh;
  private petals: THREE.InstancedMesh;
  private motes: THREE.InstancedMesh;
  private ribbons: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private rays: THREE.LineSegments;
  private shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private marker: THREE.Mesh;
  private wave: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private shock: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private dummy = new THREE.Object3D();
  private targetPosition = new THREE.Vector3();
  private cast = new CastSnapshot();
  private cameraBlend = new CinematicCamera();
  private cameraFit = new CinematicFit();
  private cameraBounds = new THREE.Box3();
  private cameraFocus = new THREE.Vector3();
  private corner = new THREE.Vector3();
  private tangent = new THREE.Vector3();
  private ribbonSide = new THREE.Vector3();
  private ribbonLift = new THREE.Vector3();
  private up = new THREE.Vector3(0,1,0);
  private staged = {active:false,casterPosition:new THREE.Vector3(),orbCenter:new THREE.Vector3(),wakeDirection:new THREE.Vector3()};
  get staging(): Readonly<{active:boolean;casterPosition:Readonly<THREE.Vector3>;orbCenter:Readonly<THREE.Vector3>;wakeDirection:Readonly<THREE.Vector3>}> { return this.staged; }
  get group() { return this.root; }
  private profile: DetailProfile;
  private disposed = false;
  constructor(scene: THREE.Scene, profile: DetailProfile = 'desktop') {
    this.profile = profile;
    const sphere = new THREE.SphereGeometry(1, 32, 24);
    const basic = (color: string, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false});
    this.shell = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, compression:{value:0} },
      vertexShader: `
        varying vec3 surfacePoint;
        varying vec3 viewPosition;
        varying vec3 viewNormal;
        void main() {
          surfacePoint = normalize(position);
          viewNormal = normalMatrix * normal;
          vec4 viewPoint = modelViewMatrix * vec4(position, 1.);
          viewPosition = viewPoint.xyz;
          gl_Position = projectionMatrix * viewPoint;
        }`,
      fragmentShader: `
        uniform float time;
        uniform float compression;
        varying vec3 surfacePoint;
        varying vec3 viewPosition;
        varying vec3 viewNormal;
        void main() {
          vec3 p = normalize(surfacePoint);
          // Cross two bent Cartesian waves to wrap around a sphere without a UV seam.
          float bend = sin(dot(p, vec3(-3.2, 3.1, 2.4)) - time * .72);
          float turn = cos(dot(p, vec3(5.4, 1.2, -4.2)) + bend * 1.5 + time * .41);
          float u = dot(p, vec3(.55, .70, .30)) + bend * .22 + turn * .1;
          float lane = sin(u * 15.5 - time * .84 + sin(u * 6.4 + turn) * 1.08);
          float crossLane = sin(dot(p, vec3(9.8, -3.9, 12.4)) + turn * 3.2 + time * 1.15);
          float sheet = smoothstep(-.24, .88, lane);
          float front = 1. - smoothstep(.07, .27 + fwidth(lane), abs(lane));
          float broken = smoothstep(-.65, .72, crossLane);
          float lit = smoothstep(-.62, .84, dot(p, vec3(-.46, .63, .56)));
          vec3 navy = vec3(.025, .11, .32);
          vec3 blue = vec3(.08, .50, .89);
          vec3 ion = vec3(.22, .85, 1.);
          vec3 whiteHot = vec3(.93, 1., 1.);
          vec3 color = mix(navy, blue, lit * .74 + broken * .15);
          color = mix(color, ion, sheet * (.58 + .27 * lit));
          color = mix(color, whiteHot, (front * .83 + sheet * .16) * (.43 + .26 * broken + compression * .14));
          float rim = pow(1. - abs(dot(normalize(viewNormal), normalize(viewPosition))), 4.);
          color = mix(color, whiteHot, rim * (.45 + sheet * .38));
          gl_FragColor = vec4(color, 1.);
        }`,
    }));
    this.shell.name='spirit-orb-surface';
    this.halo = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({color:'#94dcff',transparent:true,opacity:.16,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide}));
    this.halo.scale.setScalar(1.075);
    this.orb.add(this.shell,this.halo);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(0, .5, side * .8);
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.3,.65,4,8), new THREE.MeshToonMaterial({color:"#f7a248"}));
      sleeve.position.y = .5;
      const hand = new THREE.Mesh(sphere, new THREE.MeshToonMaterial({color:"#ffdfbb"}));
      hand.position.y = 1.18; hand.scale.setScalar(.34);
      pivot.add(sleeve,hand); this.arms.add(pivot); this.shoulders.push(pivot);
    }
    const lobes:THREE.BufferGeometry[]=[];
    for(let i=0;i<3;i++){const g=new THREE.SphereGeometry(1,12,8);g.scale(i===0?1:.7,i===0?.9:.72,i===0?1:.8);g.translate(i===0?0:i===1?-.65:.6,i===0?0:.18,i===0?0:i===1?.2:-.25);lobes.push(g);}
    const cloudGeometry=mergeGeometries(lobes,false)!;for(const lobe of lobes)lobe.dispose();
    this.cloud = new THREE.InstancedMesh(cloudGeometry,new THREE.MeshToonMaterial({color:'#dceff5',emissive:'#8aabbd',emissiveIntensity:.12,transparent:true,opacity:.82,depthWrite:false}),36);
    const accentGeometry=new THREE.IcosahedronGeometry(1,0);
    this.petals = new THREE.InstancedMesh(accentGeometry,basic("#dbd2c5",.85),48);
    this.motes = new THREE.InstancedMesh(accentGeometry,basic("#bbf5ff"),100);
    for(const mesh of [this.cloud,this.petals,this.motes]) { mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    for(let parity=0;parity<2;parity++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5*32*2*3), 3).setUsage(THREE.DynamicDrawUsage));
      const coordinates = new Float32Array(5*32*2*2);
      const indices = new Uint16Array(5*31*6);
      for(let n=0;n<5;n++) {
        for(let j=0;j<32;j++) {
          const vertex = (n*32+j)*2;
          coordinates.set([0, j/31, 1, j/31], vertex*2);
          if(j<31) indices.set([vertex,vertex+1,vertex+2,vertex+1,vertex+3,vertex+2],(n*31+j)*6);
        }
      }
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.setAttribute('uv', new THREE.BufferAttribute(coordinates, 2));
      const ribbon = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: {
          tint: { value: new THREE.Color(parity ? '#9bebff' : '#45cbff') },
          time: { value: 0 },
          strength: { value: 0 },
        },
        side: THREE.DoubleSide, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, forceSinglePass: true,
        vertexShader: `
          varying vec2 ribbonUv;
          void main() {
            ribbonUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          }`,
        fragmentShader: `
          uniform vec3 tint;
          uniform float time;
          uniform float strength;
          varying vec2 ribbonUv;
          void main() {
            float edge = abs(ribbonUv.x * 2. - 1.);
            float border = 1. - smoothstep(.56, 1., edge);
            float core = 1. - smoothstep(.09, .43, edge);
            float pulse = smoothstep(-.35, .9, sin(ribbonUv.y * 15. - time * 6.3 + edge * 1.6));
            float taper = smoothstep(0., .17, ribbonUv.y) * (1. - smoothstep(.84, 1., ribbonUv.y));
            vec3 color = mix(tint, vec3(.87, .98, 1.), core * (.4 + .57 * pulse));
            gl_FragColor = vec4(color, strength * border * taper * (.26 + core * .44 + pulse * .30));
            #include <colorspace_fragment>
          }`,
      }));
      ribbon.name = 'spirit-gather-ribbon';
      ribbon.frustumCulled=false; this.ribbons.push(ribbon); this.root.add(ribbon);
    }
    const rayGeo = new THREE.BufferGeometry(); rayGeo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(32*6),3));
    this.rays = new THREE.LineSegments(rayGeo,new THREE.LineBasicMaterial({color:"#fff0b4",transparent:true,opacity:.9})); this.rays.frustumCulled=false;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1,48),basic("#586478",.17));
    this.shadow.rotation.x=-Math.PI/2;
    this.marker = new THREE.Mesh(new THREE.RingGeometry(2.8,3.1,48),basic("#69a9bd",.65)); this.marker.rotation.x=-Math.PI/2;
    this.wave = new THREE.Mesh(new THREE.RingGeometry(.91,1,96),basic("#ffe3a4",.75)); this.wave.rotation.x=-Math.PI/2;
    for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(.93,1,72),basic(i?'#b1eeff':'#fff3c6',.65));ring.rotation.x=-Math.PI/2;this.shock.push(ring);this.root.add(ring);}
    this.root.add(this.orb,this.arms,this.cloud,this.petals,this.motes,this.shadow,this.marker,this.wave,this.rays);
    this.root.visible=false; scene.add(this.root);
  }
  setProfile(profile: DetailProfile) { this.profile = profile; }
  clear() {

    this.root.visible=false; this.cast.clear(); this.cameraBlend.clear(); this.staged.active=false;
    this.staged.casterPosition.set(0,0,0); this.staged.orbCenter.set(0,0,0); this.staged.wakeDirection.set(0,0,0);
    this.shell.material.uniforms.time.value=0; this.shell.material.uniforms.compression.value=0;
    for(const ribbon of this.ribbons) {
      ribbon.material.uniforms.time.value=0;
      ribbon.material.uniforms.strength.value=0;
    }
    this.orb.position.set(0,0,0); this.orb.rotation.set(0,0,0);
    this.arms.rotation.set(0,0,0); for(const shoulder of this.shoulders)shoulder.rotation.set(0,0,0);
    for(const child of this.root.children)child.visible=false;
    for(const mesh of [this.cloud,this.petals,this.motes])mesh.count=0;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.clear();

    this.root.parent?.remove(this.root);
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    this.root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        resources.add(object.geometry);
        if(object instanceof THREE.InstancedMesh)object.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) resources.add(material);
      }
    });
    for (const resource of resources) resource.dispose();
  }
  update(arena: Arena | undefined, camera: THREE.PerspectiveCamera, menu: boolean, reduced = false, cinematicCamera = true, anchor?: RenderAnchor, visual?: Readonly<UltimateVisualFrame>) {
    const shot = arena?.player.alive && arena.state !== "over" ? arena.cinematic : undefined;
    this.root.visible = !this.disposed && !menu && shot?.kind === "spirit";
    if (!this.root.visible || !shot || !arena) { this.clear(); return; }
    this.cast.capture(arena,anchor); this.staged.active=true; this.staged.casterPosition.copy(this.cast.position);
    this.motes.visible=true;
    const p=arena.player, t=shot.time, impact=shot.impact, frame=ultimateFrame('spirit',t,reduced);
    const charge=Math.min(1,t/2.4), flight=Math.max(0,Math.min(1,(t-2.4)/(NUKE_BLAST-2.4)));
    const blast=Math.max(0,t-NUKE_BLAST), detonated=shot.detonated;
    const fade=Math.max(0,1-blast/(NUKE_DURATION-NUKE_BLAST));
    // Keep the charge directly over Kairo, then follow the captured impact
    // path. Camera framing must never move the attack away from its caster.
    const casterX=anchor?.x ?? this.cast.position.x, casterZ=anchor?.z ?? this.cast.position.z;
    const casterY=anchor?.y ?? .65*serpentScale(p.mass);
    const travel=flight*flight;
    const x=THREE.MathUtils.lerp(casterX,impact.x,travel);
    const z=THREE.MathUtils.lerp(casterZ,impact.z,travel);
    // Rise above Kairo during charge so the first frames stay inside the
    // gameplay camera before the cinematic camera blend has finished.
    const orbRadius=(1+charge*11)*1.6;
    const y=spiritOrbHeight(charge,flight,orbRadius);
    this.orb.visible=!detonated; this.orb.position.set(x,y,z); this.orb.scale.setScalar(orbRadius*(reduced?1:1-THREE.MathUtils.smoothstep(t,2.12,2.4)*.09-THREE.MathUtils.smoothstep(t,3.24,3.4)*.13));
    this.orb.rotation.y=reduced?0:t*.12; this.staged.orbCenter.copy(this.orb.position);
    this.shell.material.uniforms.time.value = reduced ? 0 : t;
    this.shell.material.uniforms.compression.value=reduced?0:THREE.MathUtils.smoothstep(t,1.85,2.4)+THREE.MathUtils.smoothstep(t,3.15,3.4)*.8;

    this.halo.visible=this.profile==='desktop' && !reduced;
    this.halo.material.opacity = .07 + charge * .10;
    this.arms.visible=!detonated; this.arms.position.set(casterX,casterY,casterZ);
    this.arms.scale.setScalar(serpentScale(p.mass)); this.arms.rotation.y=-(anchor?.angle ?? this.cast.angle);
    this.shoulders.forEach((arm,i)=>{arm.rotation.z= flight*-1.9; arm.rotation.x=(i?1:-1)*(.35-charge*.25);});
    this.shadow.visible=!detonated; this.shadow.position.set(x,-.36,z); this.shadow.scale.setScalar(4+charge*14+flight*8); this.shadow.material.opacity=.1+flight*.28;
    this.marker.visible=!detonated; this.marker.position.set(impact.x,-.34,impact.z);
    this.wave.visible=detonated; this.wave.position.set(impact.x,-.32,impact.z); this.wave.scale.setScalar(1+Math.min(1,blast/1.4)*155); this.wave.material.opacity=fade*.62;
    this.shock.forEach((ring,i)=>{ring.visible=detonated&&(i===0||this.profile==='desktop')&&!reduced;ring.position.set(impact.x,-.3+i*.012,impact.z);ring.scale.setScalar(2+Math.max(0,blast-i*.12)*(104+i*28));ring.material.opacity=Math.max(0,1-(blast-i*.12)/1.1)*.55;});
    this.cloud.visible=detonated;
    this.petals.visible=detonated&&!reduced;
    this.rays.visible=detonated&&this.profile==='desktop'&&!reduced;
    const detail = spiritEffectCounts(this.profile);
    this.cloud.count = visual?.managed&&detonated?0: reduced ? Math.min(12,detail.clouds) : detail.clouds;
    this.petals.count = visual?.managed&&detonated?0: reduced ? 0 : detail.petals;
    this.motes.count = visual?.managed&&detonated?0: reduced ? Math.min(18,detail.motes) : detail.motes;
    for(let i=0;i<this.cloud.count;i++) {
      const layer=i%3, delay=(i%7)*.035+layer*.045, age=Math.max(0,blast-delay);
      const growth=Math.min(1,age/(.38+layer*.12));
      const linger=Math.min(1,Math.max(0,(NUKE_DURATION-NUKE_BLAST-delay-age)/(.65+layer*.16)));
      const opening=THREE.MathUtils.smoothstep(age,.25,1.3);
      const a=i*2.39996+layer*.24, r=(5+layer*5)+(16+layer*11)*growth+opening*(5+layer*3);
      this.dummy.position.set(impact.x+Math.cos(a)*r,2+layer*7+Math.sin(i)*1.4+growth*(13+layer*3)-opening*layer*2,impact.z+Math.sin(a)*r);
      this.dummy.rotation.set(i*.17, a, age*.18);
      this.dummy.scale.set((6.2+layer*2.1+i%3*.5)*Math.max(.001,growth)*linger,(5.6+layer*2.5)*Math.max(.001,growth)*linger*(1-opening*.32),(7.2+layer*2.3)*Math.max(.001,growth)*linger);
      this.dummy.updateMatrix(); this.cloud.setMatrixAt(i,this.dummy.matrix);
    }
    (this.cloud.material as THREE.MeshToonMaterial).opacity=Math.min(1,blast/.13)*fade*.72;
    for(let i=0;i<this.petals.count;i++) {
      const a=i*2.399963, r=5+Math.min(blast,1.7)*(24+i%5*5);
      this.dummy.position.set(impact.x+Math.cos(a)*r,Math.max(.15,1+blast*(12+i%5*3)-blast*blast*13),impact.z+Math.sin(a)*r);
      this.dummy.scale.set(1.2*fade,.65*fade,1.8*fade);this.dummy.rotation.set(blast*2+i,-a,blast);this.dummy.updateMatrix();this.petals.setMatrixAt(i,this.dummy.matrix);
    }
    for(let i=0;i<this.motes.count;i++) {
      const a=i*2.39996, phase=((reduced ? 0 : t*.65)+i/this.motes.count)%1, r=detonated?10+blast*18:(1-phase)*60;
      this.dummy.position.set((detonated?impact.x:x)+Math.cos(a)*r,detonated?2+blast*(8+i%6):y*phase,(detonated?impact.z:z)+Math.sin(a)*r);
      this.dummy.scale.setScalar((.15+(i%3)*.1)*(detonated?fade:1));this.dummy.rotation.set(0,0,0);this.dummy.updateMatrix();this.motes.setMatrixAt(i,this.dummy.matrix);
    }
    for(const mesh of [this.cloud,this.petals,this.motes]) mesh.instanceMatrix.needsUpdate=true;
    const gathering = !reduced && t > .14 && t < 2.4;
    const trailing = !reduced && !detonated && flight > .06;
    const wakeFrom = Math.max(0, flight - .43);
    const wakeTo = Math.max(wakeFrom, flight - .045);
    if (trailing) {
      this.tangent.set((impact.x-casterX)*2*wakeTo, (orbRadius+.28-38)*6*wakeTo*(1-wakeTo), (impact.z-casterZ)*2*wakeTo);
      this.staged.wakeDirection.copy(this.tangent).normalize();
      if(this.staged.wakeDirection.lengthSq()<.01)this.staged.wakeDirection.set(0,-1,0);
    }
    this.ribbons.forEach((line,parity)=>{
      line.visible = gathering ? this.profile === 'desktop' || parity === 0 : trailing && parity === 0;
      if(!line.visible) return;
      line.material.uniforms.time.value = t;
      line.material.uniforms.strength.value = gathering ? .49 * THREE.MathUtils.smoothstep(t, .14, .7)
        : .79 * THREE.MathUtils.smoothstep(flight, .06, .18);
      const positions=line.geometry.attributes.position as THREE.BufferAttribute;
      const strands = gathering ? detail.ribbonsPerColor : this.profile === 'mobile' ? 2 : 3;
      line.geometry.setDrawRange(0, strands * 31 * 6);
      for(let n=0;n<strands;n++) {
        const i=n*2+parity;
        for(let j=0;j<32;j++) {
          const progress=j/31, offset=(n*32+j)*2;
          const taper=Math.pow(Math.sin(progress*Math.PI),1.1);
          if (gathering) {
            const angle=i*Math.PI/5+progress*1.85+t*.19;
            const radius=(1-progress)*(26+(i%3)*5+charge*8);
            const width=.05+taper*(.65+(i%3)*.20);
            const cx=casterX+Math.cos(angle)*radius, cz=casterZ+Math.sin(angle)*radius;
            const cy=THREE.MathUtils.lerp(1+(i%3)*2,y,Math.pow(progress,.86));
            positions.setXYZ(offset,cx-Math.sin(angle)*width,cy,cz+Math.cos(angle)*width);
            positions.setXYZ(offset+1,cx+Math.sin(angle)*width,cy,cz-Math.cos(angle)*width);
          } else {
            const trail=THREE.MathUtils.lerp(wakeFrom,wakeTo,progress);
            const tx=THREE.MathUtils.lerp(casterX,impact.x,trail*trail);
            const ty=spiritOrbHeight(charge,trail,orbRadius);
            const tz=THREE.MathUtils.lerp(casterZ,impact.z,trail*trail);
            this.tangent.set((impact.x-casterX)*2*trail,(orbRadius+.28-38)*6*trail*(1-trail),(impact.z-casterZ)*2*trail).normalize();
            if(this.tangent.lengthSq()<.01)this.tangent.set(0,-1,0);
            this.ribbonSide.crossVectors(this.up,this.tangent).normalize();
            if(this.ribbonSide.lengthSq()<.01)this.ribbonSide.set(1,0,0);
            this.ribbonLift.crossVectors(this.tangent,this.ribbonSide);
            const angle=n*Math.PI*2/strands+4.5*progress-t*3.4;
            const c=Math.cos(angle), s=Math.sin(angle);
            const radius=orbRadius*(.055+.56*progress*progress);
            const width=(.10+taper*1.8)*(this.profile==='mobile'?.84:1);
            const cx=tx+radius*(c*this.ribbonSide.x+s*this.ribbonLift.x);
            const cy=ty+radius*(c*this.ribbonSide.y+s*this.ribbonLift.y);
            const cz=tz+radius*(c*this.ribbonSide.z+s*this.ribbonLift.z);
            const wx=width*(-s*this.ribbonSide.x+c*this.ribbonLift.x);
            const wy=width*(-s*this.ribbonSide.y+c*this.ribbonLift.y);
            const wz=width*(-s*this.ribbonSide.z+c*this.ribbonLift.z);
            positions.setXYZ(offset,cx-wx,cy-wy,cz-wz);
            positions.setXYZ(offset+1,cx+wx,cy+wy,cz+wz);
          }
        }
      }
      positions.needsUpdate=true;
    });
    const rays=this.rays.geometry.attributes.position as THREE.BufferAttribute;
    const rayCount=visual?.managed&&detonated?0:detail.rays;
    this.rays.geometry.setDrawRange(0,rayCount*2);
    for(let i=0;i<rayCount;i++){const a=i*Math.PI*2/rayCount,r=12+blast*45;rays.setXYZ(i*2,impact.x,2,impact.z);rays.setXYZ(i*2+1,impact.x+Math.cos(a)*r,4+(i%4)*4,impact.z+Math.sin(a)*r);}rays.needsUpdate=true;
    (this.rays.material as THREE.LineBasicMaterial).opacity=fade*.7;
    if(visual?.managed && detonated){
      this.wave.visible=false;for(const ring of this.shock)ring.visible=false;
      this.cloud.visible=false;this.petals.visible=false;this.motes.visible=false;this.rays.visible=false;
    }
    if(frame.cameraWeight>0 && cinematicCamera){
      const release=THREE.MathUtils.smoothstep(t,2.4,3.4), recovery=THREE.MathUtils.smoothstep(t,3.4,4.1);
      this.cameraBounds.min.set(casterX-3,0,casterZ-3);this.cameraBounds.max.set(casterX+3,5,casterZ+3);
      this.corner.set(x-orbRadius,y-orbRadius,z-orbRadius);this.cameraBounds.expandByPoint(this.corner);
      this.corner.set(x+orbRadius,y+orbRadius,z+orbRadius);this.cameraBounds.expandByPoint(this.corner);
      this.cameraBounds.getCenter(this.cameraFocus);
      this.corner.set(impact.x,10,impact.z);this.cameraFocus.lerp(this.corner,recovery*.72);
      this.cameraFit.fit(this.targetPosition,camera,this.cameraBounds,this.cameraFocus,this.cast.angle+.8+release*.18,.43+recovery*.45,65+recovery*24);
      if (detonated && blast < .11 && !reduced) this.targetPosition.y += (1 - blast/.11) * 1.4;
      this.cameraBlend.blend(camera,this.targetPosition,this.cameraFocus,frame.cameraWeight);
    }
  }
}
