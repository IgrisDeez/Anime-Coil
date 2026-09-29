import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Arena, NUKE_BLAST, NUKE_DURATION } from './simulation';
import { ultimateFrame } from './ultimate-presentation';
import type { DetailProfile } from './worlds/types';

const smooth = (a: number, b: number, t: number) => THREE.MathUtils.smoothstep(t, a, b);

/** Locally owned, merged vertex-colour sculpture; three pose groups cost only four draws. */
function foxBody(): { beast: THREE.Group; head: THREE.Group; leftPaw: THREE.Group; rightPaw: THREE.Group } {
  const beast = new THREE.Group();
  const color = { gold: '#ef9427', light: '#ffd05e', shadow: '#b84a1f', ink: '#35202b', ivory: '#fff0b8', eye: '#fbe58b' };
  const sculpt = (name: string, parent: THREE.Group, build: (add: (shape: 'round' | 'cone', shade: keyof typeof color,
    x: number, y: number, z: number, sx: number, sy: number, sz: number, rx?: number, ry?: number, rz?: number) => void) => void) => {
    const parts: THREE.BufferGeometry[] = [];
    const add = (shape: 'round' | 'cone', shade: keyof typeof color, x: number, y: number, z: number,
      sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) => {
      const geometry = shape === 'round' ? new THREE.SphereGeometry(1, 12, 9) : new THREE.ConeGeometry(1, 2, 7);
      geometry.scale(sx, sy, sz); geometry.rotateX(rx); geometry.rotateY(ry); geometry.rotateZ(rz); geometry.translate(x, y, z);
      const rgb = new THREE.Color(color[shade]); const values = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < values.length; i += 3) { values[i] = rgb.r; values[i + 1] = rgb.g; values[i + 2] = rgb.b; }
      geometry.setAttribute('color', new THREE.BufferAttribute(values, 3)); parts.push(geometry);
    };
    build(add);
    const geometry = mergeGeometries(parts, false)!; parts.forEach(piece => piece.dispose());
    const mesh = new THREE.Mesh(geometry, new THREE.MeshToonMaterial({vertexColors:true, emissive:'#6b2a12', emissiveIntensity:.16, transparent:true}));
    mesh.name = name; parent.add(mesh);
  };
  sculpt('fox-torso', beast, add => {
    add('round','gold',0,6,-1.6,4.5,5.7,4.2,-.12);
    add('round','light',0,7.5,2,3.25,4,1.8,-.17);
    add('round','shadow',0,3.2,-3.5,3.7,2.6,2.6);
    for (const side of [-1,1]) {
      add('round','gold',side*3.1,7.7,-.1,2.35,3.1,2.7,0,0,side*.18);
      add('cone','light',side*2.1,8.8,2.9,.65,1.5,.55,.45,0,side*.23);
    }
  });
  const head = new THREE.Group(); head.name = 'fox-head'; head.position.set(0,11.8,1.15); beast.add(head);
  sculpt('fox-face',head,add => {
    add('round','gold',0,.35,0,3.7,3.05,2.9,-.13);
    add('round','light',0,-1.15,2.1,2.7,1.35,2.1,-.16);
    add('round','gold',0,-1.05,3.55,1.82,.82,2.02,-.12);
    add('round','ink',0,-1.95,4.57,1.3,.24,1.3);
    add('round','ink',0,-.68,5.28,.72,.4,.5);
    for (const side of [-1,1]) {
      add('cone','gold',side*2.65,3.25,-.7,1.3,2.55,1.05,0,0,-side*.19);
      add('cone','shadow',side*2.68,3.3,.1,.62,1.67,.33,0,0,-side*.2);
      add('cone','gold',side*3.35,-.55,.25,1.36,1.6,1.2,.05,0,-side*.9);
      add('round','shadow',side*1.67,.2,2.7,1.55,.63,.5,0,0,-side*.22);
      add('round','ink',side*1.56,.18,3.08,1.2,.26,.2,0,0,side*.28);
      add('round','eye',side*1.55,-.02,3.24,.74,.13,.09,0,0,side*.22);
      add('round','ink',side*1.37,-.03,3.36,.13,.16,.07);
      for (let i=0;i<2;i++) add('cone','shadow',side*(2.75+i*.38),-1.35-i*.32,2.8-i*.47,.48,.78,.4,0,0,-side*.6);
    }
  });
  const paws: THREE.Group[] = [];
  for (const side of [-1,1]) {
    const paw = new THREE.Group(); paw.name = side < 0 ? 'fox-left-paw' : 'fox-right-paw';
    paw.position.set(side*3.55,7.7,1.4); beast.add(paw); paws.push(paw);
    sculpt(`${paw.name}-sculpt`,paw,add => {
      add('round','gold',side*.45,-2.3,.65,1.25,2.85,1.35,-.42,0,side*.13);
      add('round','light',side*.75,-4.45,2.22,1.6,.8,1.85);
      for(let i=0;i<3;i++) add('cone','ivory',side*.75+(i-1)*.88,-4.62,3.96,.25,.52,.8,Math.PI*.42);
      add('round','shadow',side*.5,-2.7,1.9,.25,1.4,.17,-.4);
    });
  }
  return { beast, head, leftPaw:paws[0], rightPaw:paws[1] };
}

/** Rounded chakra tails sweep upward and back; identical topology enables instancing. */
export function foxTailGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  const segments=20, sides=8;
  for(let row=0;row<=segments;row++) {
    const t=row/segments, radius=(.14+.34*Math.sin(Math.PI*Math.pow(t,.8)))*Math.pow(1-t,.48)+.008;
    const x=.3*Math.sin(t*Math.PI*1.2), y=.16*Math.sin(t*Math.PI)+.33*t*t;
    for(let side=0;side<=sides;side++) {
      const a=side/sides*Math.PI*2;
      positions.push(x+Math.cos(a)*radius,y+Math.sin(a)*radius,t*2.5);
      if(row<segments&&side<sides){const n=row*(sides+1)+side;indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

/** A separate, bounded summon/launch renderer; simulation time owns every stage. */
export class FoxCinematic {
  readonly group = new THREE.Group();
  private sculpture = foxBody();
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
  private baseQuaternion = new THREE.Quaternion();
  private targetQuaternion = new THREE.Quaternion();
  private disposed = false;
  constructor(scene: THREE.Scene, private profile: DetailProfile = 'desktop') {
    const glow = (color: string, opacity = .7) => new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide});
    this.tails = new THREE.InstancedMesh(foxTailGeometry(), glow('#ffb14b', .84), 9);
    this.tailEdges = new THREE.InstancedMesh(this.tails.geometry, glow('#5d2930', .8), 9);
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
    this.wake.rotation.x = Math.PI / 2;
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
  clear() { this.group.visible = false; }
  update(arena: Arena | undefined, camera: THREE.PerspectiveCamera, menu: boolean, reduced = false) {
    const shot = !menu && arena?.cinematic;
    this.group.visible = !this.disposed && !!shot && shot.kind === 'fox';
    if (!this.group.visible || !shot || !arena) return;
    const t = shot.time, p = arena.player, b = Math.max(0, t - NUKE_BLAST);
    const facing = Math.atan2(shot.impact.z - p.z, shot.impact.x - p.x);
    const manifest = smooth(0, .9, t), charge = smooth(.9, 2.5, t), launch = smooth(2.5, 3.4, t);
    const fade = 1 - smooth(4.3, NUKE_DURATION, t), frame = ultimateFrame('fox', t, reduced);
    this.group.position.set(p.x, 0, p.z); this.group.rotation.y = Math.PI / 2 - facing;
    this.group.updateMatrixWorld(true);
    this.impact.set(shot.impact.x, .2, shot.impact.z); this.group.worldToLocal(this.impact);
    this.beast.position.set(0, reduced ? 0 : -5 * (1 - manifest), -10);
    this.beast.scale.setScalar((reduced ? 1 : .84 + manifest * .16) * 1.8);
    const tension = smooth(.65,2.4,t)*(1-smooth(2.5,3.35,t));
    this.beast.rotation.x = reduced ? .035 : .035+tension*.085;
    this.sculpture.head.rotation.x = reduced ? .06 : .06+tension*.13;
    this.sculpture.leftPaw.rotation.x = reduced ? -.12 : -.12-tension*.22;
    this.sculpture.rightPaw.rotation.x = reduced ? -.12 : -.12-tension*.25;
    this.sculpture.leftPaw.rotation.z = reduced ? -.04 : -.04-tension*.055;
    this.sculpture.rightPaw.rotation.z = reduced ? .04 : .04+tension*.055;
    for(const material of this.beastMaterials)material.opacity=manifest*fade;
    for (let i = 0; i < 9; i++) {
      const rank=i-4,spread=rank*.285,flex=reduced?0:Math.sin(t*1.2+i*.65)*.045*tension;
      this.dummy.position.set(rank*.38,4.5+Math.abs(rank)*.23,-3.4-(i%2)*.28);
      this.dummy.rotation.set(.59+Math.abs(rank)*.07+flex,Math.PI+spread+flex,rank*.045);
      this.dummy.scale.set(4.35+Math.abs(rank)*.2,4.25,7.7-Math.abs(rank)*.26+(i%2)*.3);
      this.dummy.updateMatrix(); this.tailEdges.setMatrixAt(i, this.dummy.matrix);
      this.dummy.scale.multiplyScalar(.945); this.dummy.updateMatrix(); this.tails.setMatrixAt(i, this.dummy.matrix);
    }
    this.tails.instanceMatrix.needsUpdate = this.tailEdges.instanceMatrix.needsUpdate = true;
    const radius = (.6 + charge * 3.5) * 2.8;
    // Keep the growing bomb ahead of the fox's muzzle, then launch it from
    // that visible charge point along the existing path to the impact.
    const chargeX = 3.5 + radius*.24, chargeY = 14.5 + radius*.18, chargeZ = 8 + radius*1.34;
    this.orb.visible = t >= .65 && t < NUKE_BLAST;
    this.orb.position.set(THREE.MathUtils.lerp(chargeX,this.impact.x,launch), THREE.MathUtils.lerp(chargeY,radius+.28,launch)+launch*(1-launch)*3,
      chargeZ + (this.impact.z - chargeZ) * launch);
    this.orb.scale.setScalar(radius);
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
    this.orb.material.uniforms.alpha.value = Math.min(1, (t-.65) / .3);
    this.orb.material.uniforms.pressure.value = reduced ? .25 : charge;
    this.shell.material.uniforms.time.value = reduced ? 0 : t;
    this.wake.visible = !reduced && t >= 2.5 && t < 3.4;
    this.wake.position.copy(this.orb.position); this.wake.position.z -= 6 * launch;
    this.wake.scale.set(radius * .8, 1 + launch * 17, radius * .8);
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
      ring.visible = b > 0 ? shot.detonated && age<1.9 : i === 0;
      ring.position.set(b > 0 ? this.impact.x : 0, .15 + i * .17, b > 0 ? this.impact.z : -8);
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
        const a=i*2.39996, r=4+((i*.37-t*4)%11+11)%11;
        for (let j=0;j<2;j++) {const d=r+j*1.1; lines.setXYZ(i*2+j,chargeX+Math.cos(a)*d,chargeY+Math.sin(a)*d*.65,chargeZ-Math.sin(a*.7)*d);}
      }
    }
    lines.needsUpdate=true;
    const particles=this.embers.geometry.attributes.position as THREE.BufferAttribute;
    const count=reduced?8:this.profile==='mobile'?40:96;
    this.embers.geometry.setDrawRange(0,count); this.embers.material.opacity=manifest*fade*.75;
    for(let i=0;i<count;i++) {
      const a=i*2.39996, drift=reduced?0:t;
      const r=b>0?4+b*(17+i%16):6+i%14;
      particles.setXYZ(i,(b>0?this.impact.x:0)+Math.cos(a)*r,
        b>0?2+((i*.83+drift*4)%25):(i*.83+drift*3)%18,
        (b>0?this.impact.z:-8)+Math.sin(a)*r);
    }
    particles.needsUpdate=true;
    if (frame.cameraWeight>0) {
      this.basePosition.copy(camera.position); this.baseQuaternion.copy(camera.quaternion);
      const focus=smooth(2.5,3.45,t),zoom=(73+focus*29)*Math.max(1,.65/camera.aspect);
      this.look.set((chargeX*.38)*(1-focus)+this.impact.x*focus*.55,15*(1-focus)+3*focus,3*(1-focus)+this.impact.z*focus*.55);
      this.group.localToWorld(this.look);
      this.target.set(this.look.x+Math.cos(facing+.72)*zoom*.85,zoom*.77,this.look.z+Math.sin(facing+.72)*zoom*.85);
      if (shot.detonated && b < .11 && !reduced) this.target.y += (1-b/.11)*1.6;
      camera.position.lerpVectors(this.basePosition,this.target,frame.cameraWeight);
      camera.lookAt(this.look); this.targetQuaternion.copy(camera.quaternion);
      camera.quaternion.copy(this.baseQuaternion).slerp(this.targetQuaternion,frame.cameraWeight);
    }
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
