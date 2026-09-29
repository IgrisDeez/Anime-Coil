import * as THREE from "three";
import { Arena, NUKE_BLAST, NUKE_DURATION, serpentScale } from "./simulation";
import { ultimateFrame } from './ultimate-presentation';
import type { DetailProfile } from './worlds/types';

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
  private orb = new THREE.Group();
  private arms = new THREE.Group();
  private shoulders: THREE.Group[] = [];
  private shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private halo: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private cloud: THREE.InstancedMesh;
  private petals: THREE.InstancedMesh;
  private motes: THREE.InstancedMesh;
  private ribbons: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private rays: THREE.LineSegments;
  private shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private marker: THREE.Mesh;
  private wave: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private shock: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private wake: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private basePosition = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();
  private baseQuaternion = new THREE.Quaternion();
  private targetQuaternion = new THREE.Quaternion();
  private profile: DetailProfile;
  private disposed = false;
  constructor(scene: THREE.Scene, profile: DetailProfile = 'desktop') {
    this.profile = profile;
    const sphere = new THREE.SphereGeometry(1, 32, 24);
    const basic = (color: string, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false});
    this.shell = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec3 vPos; varying vec3 vNormal; void main(){vPos=normalize(position);vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      // Cartesian waves avoid the longitude seam and the star-shaped pole pinch.
      fragmentShader: `uniform float time; varying vec3 vPos; varying vec3 vNormal;
        void main(){vec3 p=normalize(vPos);vec3 n=normalize(vNormal);
          float flow=sin(dot(p,vec3(7.1,4.3,-5.4))*2.1-time*1.65);
          flow+=.48*sin(dot(p,vec3(-5.2,8.7,3.6))*2.4+time*1.2);
          flow+=.22*sin(dot(p,vec3(11.3,-3.9,6.5))*2.9-time*.75);
          float band=smoothstep(-.38,.82,flow);
          float fine=pow(max(0.,sin(dot(p,vec3(15.2,9.1,-12.4))+time*2.)),7.);
          float rim=pow(1.-abs(n.z),1.7);
          vec3 color=mix(vec3(.12,.37,.68),vec3(.77,.94,1.),band);
          color=mix(color,vec3(1.,.99,.92),clamp(rim*.77+fine*.22,0.,1.));
          gl_FragColor=vec4(color,1.);}`,
    }));
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
    this.cloud = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),basic("#e7f8f6",.82),36);
    this.petals = new THREE.InstancedMesh(sphere,basic("#e7cfa4",.75),48);
    this.motes = new THREE.InstancedMesh(sphere,basic("#89def7"),100);
    for(const mesh of [this.cloud,this.petals,this.motes]) { mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    for(let parity=0;parity<2;parity++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(5*32*2*3),3));
      const indices = new Uint16Array(5*31*6);
      for(let n=0;n<5;n++) for(let j=0;j<31;j++) {
        const v=(n*32+j)*2, k=(n*31+j)*6;
        indices.set([v,v+1,v+2,v+1,v+3,v+2],k);
      }
      geo.setIndex(new THREE.BufferAttribute(indices,1));
      const ribbon = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:parity?'#e5fbff':'#72d4f3',side:THREE.DoubleSide,transparent:true,opacity:.62,depthWrite:false,blending:THREE.AdditiveBlending}));
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
    this.wake=new THREE.InstancedMesh(new THREE.ConeGeometry(1,2.6,8),basic('#a8e9ff',.28),10);this.wake.frustumCulled=false;this.wake.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.orb,this.arms,this.cloud,this.petals,this.motes,this.shadow,this.marker,this.wave,this.rays,this.wake);
    this.root.visible=false; scene.add(this.root);
  }
  setProfile(profile: DetailProfile) { this.profile = profile; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.parent?.remove(this.root);
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    this.root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        resources.add(object.geometry);
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) resources.add(material);
      }
    });
    for (const resource of resources) resource.dispose();
  }
  update(arena: Arena | undefined, camera: THREE.PerspectiveCamera, menu: boolean, reduced = false) {
    const shot = arena?.cinematic;
    this.root.visible = !menu && shot?.kind === "spirit";
    if (!this.root.visible || !shot || !arena) return;
    const p=arena.player, t=shot.time, impact=shot.impact, frame=ultimateFrame('spirit',t,reduced);
    const charge=Math.min(1,t/2.4), flight=Math.max(0,Math.min(1,(t-2.4)/(NUKE_BLAST-2.4)));
    const blast=Math.max(0,t-NUKE_BLAST), detonated=shot.detonated;
    const fade=Math.max(0,1-blast/(NUKE_DURATION-NUKE_BLAST));
    // Keep the charge directly over Kairo, then follow the captured impact
    // path. Camera framing must never move the attack away from its caster.
    const travel=flight*flight;
    const x=THREE.MathUtils.lerp(p.x,impact.x,travel);
    const z=THREE.MathUtils.lerp(p.z,impact.z,travel);
    // Rise above Kairo during charge so the first frames stay inside the
    // gameplay camera before the cinematic camera blend has finished.
    const orbRadius=(1+charge*11)*1.6;
    const y=spiritOrbHeight(charge,flight,orbRadius);
    this.orb.visible=!detonated; this.orb.position.set(x,y,z); this.orb.scale.setScalar(orbRadius);
    this.orb.rotation.y=reduced?0:t*.35;
    this.shell.material.uniforms.time.value = reduced ? 0 : t;
    this.halo.visible=this.profile==='desktop' && !reduced;
    this.arms.visible=!detonated; this.arms.position.set(p.x,.65*serpentScale(p.mass),p.z);
    this.arms.scale.setScalar(serpentScale(p.mass)); this.arms.rotation.y=-p.angle;
    this.shoulders.forEach((arm,i)=>{arm.rotation.z= flight*-1.9; arm.rotation.x=(i?1:-1)*(.35-charge*.25);});
    this.shadow.visible=!detonated; this.shadow.position.set(x,-.36,z); this.shadow.scale.setScalar(4+charge*14+flight*8); this.shadow.material.opacity=.1+flight*.28;
    this.marker.visible=!detonated; this.marker.position.set(impact.x,-.34,impact.z);
    this.wave.visible=detonated; this.wave.position.set(impact.x,-.32,impact.z); this.wave.scale.setScalar(1+Math.min(1,blast/1.4)*155); this.wave.material.opacity=fade*.62;
    this.shock.forEach((ring,i)=>{ring.visible=detonated&&(i===0||this.profile==='desktop')&&!reduced;ring.position.set(impact.x,-.3+i*.012,impact.z);ring.scale.setScalar(2+Math.max(0,blast-i*.12)*(104+i*28));ring.material.opacity=Math.max(0,1-(blast-i*.12)/1.1)*.55;});
    this.cloud.visible=detonated;
    this.petals.visible=detonated&&!reduced;
    this.rays.visible=detonated&&this.profile==='desktop'&&!reduced;
    this.wake.visible=t>=2.4&&!detonated&&!reduced;
    this.wake.count=this.profile==='mobile'?6:10;
    if(this.wake.visible) for(let i=0;i<this.wake.count;i++){
      const trail=Math.max(0,flight-(i+1)*.052), trailX=THREE.MathUtils.lerp(p.x,impact.x,trail*trail), trailZ=THREE.MathUtils.lerp(p.z,impact.z,trail*trail);
      this.dummy.position.set(trailX,spiritOrbHeight(charge,trail,orbRadius),trailZ);
      this.dummy.rotation.set(0,0,-p.angle-.2);this.dummy.scale.setScalar(orbRadius*(.16-i*.01));this.dummy.updateMatrix();this.wake.setMatrixAt(i,this.dummy.matrix);
    }
    this.wake.instanceMatrix.needsUpdate=true;
    const detail = spiritEffectCounts(this.profile);
    this.cloud.count = reduced ? Math.min(12,detail.clouds) : detail.clouds;
    this.petals.count = reduced ? 0 : detail.petals;
    this.motes.count = reduced ? Math.min(18,detail.motes) : detail.motes;
    for(let i=0;i<this.cloud.count;i++) {
      const layer=i%3, delay=(i%7)*.035+layer*.045, age=Math.max(0,blast-delay);
      const growth=Math.min(1,age/(.38+layer*.12));
      const linger=Math.min(1,Math.max(0,(NUKE_DURATION-NUKE_BLAST-delay-age)/(.65+layer*.16)));
      const a=i*2.39996+layer*.24, r=(5+layer*5)+(16+layer*11)*growth;
      this.dummy.position.set(impact.x+Math.cos(a)*r,2+layer*6+Math.sin(age*2.1+i)*1.4+growth*(10+layer*3),impact.z+Math.sin(a)*r);
      this.dummy.rotation.set(i*.17, a, age*.18);
      this.dummy.scale.set((4.2+layer*2.2)*Math.max(.001,growth)*linger,(3.6+layer*2.5)*Math.max(.001,growth)*linger,(5.2+layer*2.5)*Math.max(.001,growth)*linger);
      this.dummy.updateMatrix(); this.cloud.setMatrixAt(i,this.dummy.matrix);
    }
    (this.cloud.material as THREE.MeshBasicMaterial).opacity=Math.min(1,blast/.13)*fade*.72;
    for(let i=0;i<this.petals.count;i++) {
      const a=i*Math.PI*2/48, r=5+Math.min(blast,1.7)*(20+i%5*4);
      this.dummy.position.set(impact.x+Math.cos(a)*r,1+Math.sin(Math.min(1,blast/2)*Math.PI)*(2+i%5),impact.z+Math.sin(a)*r);
      this.dummy.scale.set(1.8*fade,.4*fade,3*fade);this.dummy.rotation.set(0,-a,blast);this.dummy.updateMatrix();this.petals.setMatrixAt(i,this.dummy.matrix);
    }
    for(let i=0;i<this.motes.count;i++) {
      const a=i*2.39996, phase=(t*.65+i/this.motes.count)%1, r=detonated?10+blast*18:(1-phase)*60;
      this.dummy.position.set((detonated?impact.x:x)+Math.cos(a)*r,detonated?2+blast*(8+i%6):y*phase,(detonated?impact.z:z)+Math.sin(a)*r);
      this.dummy.scale.setScalar((.15+(i%3)*.1)*(detonated?fade:1));this.dummy.rotation.set(0,0,0);this.dummy.updateMatrix();this.motes.setMatrixAt(i,this.dummy.matrix);
    }
    for(const mesh of [this.cloud,this.petals,this.motes]) mesh.instanceMatrix.needsUpdate=true;
    this.ribbons.forEach((line,parity)=>{
      line.visible=t<2.4&&!reduced&&(this.profile==='desktop'||parity===0);
      const positions=line.geometry.attributes.position as THREE.BufferAttribute;
      const perColor = detail.ribbonsPerColor;
      line.geometry.setDrawRange(0, perColor * 31 * 6);
      for(let n=0;n<perColor;n++) {
        const i=n*2+parity;
        for(let j=0;j<32;j++) {
          const progress=j/31;
          const a=i*Math.PI/5+progress*1.05+t*.26;
          const radius=(1-progress)*65;
          const width=(.1+Math.sin(progress*Math.PI)*1.05)*(this.profile==='mobile'?.8:1);
          const offset=(n*32+j)*2;
          const cx=p.x+Math.cos(a)*radius, cz=p.z+Math.sin(a)*radius, cy=1+progress*(y-1);
          positions.setXYZ(offset,cx-Math.sin(a)*width,cy,cz+Math.cos(a)*width);
          positions.setXYZ(offset+1,cx+Math.sin(a)*width,cy,cz-Math.cos(a)*width);
        }
      }
      positions.needsUpdate=true;
    });
    const rays=this.rays.geometry.attributes.position as THREE.BufferAttribute;
    const rayCount=detail.rays;
    this.rays.geometry.setDrawRange(0,rayCount*2);
    for(let i=0;i<rayCount;i++){const a=i*Math.PI*2/rayCount,r=12+blast*45;rays.setXYZ(i*2,impact.x,2,impact.z);rays.setXYZ(i*2+1,impact.x+Math.cos(a)*r,4+(i%4)*4,impact.z+Math.sin(a)*r);}rays.needsUpdate=true;
    (this.rays.material as THREE.LineBasicMaterial).opacity=fade*.7;
    if(frame.cameraWeight>0){
      const width=Math.max(1,.85/camera.aspect), distance=detonated?103+blast*9:t<2.4?102+charge*25:87+flight*13;
      this.basePosition.copy(camera.position);this.baseQuaternion.copy(camera.quaternion);
      this.targetPosition.set(x+Math.sin(p.angle+.7)*distance*.45,Math.max(31,distance*width*.8),z+Math.cos(p.angle+.7)*distance*.9);
      if (detonated && blast < .11 && !reduced) this.targetPosition.y += (1 - blast/.11) * 1.4;
      camera.position.lerpVectors(this.basePosition,this.targetPosition,frame.cameraWeight);
      camera.lookAt(x,detonated?0:y*.75,z);
      this.targetQuaternion.copy(camera.quaternion);
      camera.quaternion.copy(this.baseQuaternion).slerp(this.targetQuaternion,frame.cameraWeight);
    }
  }
}
