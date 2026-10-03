import * as THREE from 'three';
import { RADIUS } from './simulation';
import type { DetailProfile } from './worlds/types';
import { AFTERMATH, type UltimateVisualFrame } from './ultimate-visual';
import type { UltimateKind } from './ultimate-presentation';

const STYLES = { fox: 0, spirit: 1, purple: 2, skybreaker: 3 } as const;
const PALETTES = {
  fox: ['#fff2ba', '#ff9b27', '#72494a'], spirit: ['#f0ffff', '#40bcff', '#546d8b'],
  purple: ['#fbeaff', '#ac59ff', '#5b486f'], skybreaker: ['#fff6dc', '#ef997e', '#806c81'],
} as const;
const COLORS = Object.fromEntries(Object.entries(PALETTES).map(([kind, colors]) => [kind, colors.map(c => new THREE.Color(c))])) as Record<UltimateKind, THREE.Color[]>;
export function blastCounts(profile: DetailProfile, reduced = false) {
  return reduced ? { bursts: 1, waves: 1, streaks: 0, fragments: 0, sparks: 8, smoke: 4 }
    : profile === 'mobile' ? { bursts: 4, waves: 2, streaks: 16, fragments: 16, sparks: 32, smoke: 10 }
      : { bursts: 9, waves: 3, streaks: 32, fragments: 32, sparks: 64, smoke: 24 };
}
const COUNTS = { desktop: blastCounts('desktop'), mobile: blastCounts('mobile'), quiet: blastCounts('mobile', true) };
export function blastReach(x: number, z: number) { return Math.max(240, (RADIUS + Math.hypot(x, z)) * 1.16); }
export function blastSeed(kind: UltimateKind, x: number, z: number) {
  let h = Math.imul(STYLES[kind] + 1, 0x9e3779b1) ^ Math.imul(Math.round(x * 100), 0x85ebca6b) ^ Math.imul(Math.round(z * 100), 0xc2b2ae35);
  h ^= h >>> 16; return h >>> 0;
}
const common = `uniform float age, duration, style, reach, quiet, softened, keyframe;
  uniform vec3 anchor, gather, hot, energy, ash;
  attribute vec4 eventSeed; attribute vec4 eventData;
  varying vec2 point; varying float opacity, heat, category, noiseSeed;
  float ease(float x){x=clamp(x,0.,1.);return 1.-(1.-x)*(1.-x)*(1.-x);}
  vec3 rightAxis(){return vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);}
  vec3 upAxis(){return vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);}
  void project(vec3 p){gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`;
const fragment = `uniform vec3 hot, energy, ash; uniform float style, age, softened;
  varying vec2 point; varying float opacity, heat, category, noiseSeed;`;

function ribbonGeometry() {
  const g = new THREE.BufferGeometry(), p: number[] = [], uv: number[] = [], ix: number[] = [];
  for (let i = 0; i <= 8; i++) { const x = i / 8; p.push(x, -1, 0, x, 1, 0); uv.push(x, 0, x, 1);
    if (i < 8) { const n = i * 2; ix.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); } }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); return g;
}

/** Four GPU batches shared by every ultimate. Events are seeded once per cast. */
export class UltimateBlast {
  readonly group = new THREE.Group();
  private batches: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private disposed = false;
  private seed = -1;
  private style: UltimateKind = 'fox';
  private identity = new THREE.Matrix4();
  private uniforms = {
    age: { value: -3.4 }, duration: { value: 1.5 }, style: { value: 0 }, reach: { value: 240 },
    quiet: { value: 0 }, softened: { value: 0 }, keyframe: { value: 0 },
    anchor: { value: new THREE.Vector3() }, gather: { value: new THREE.Vector3() },
    hot: { value: new THREE.Color() }, energy: { value: new THREE.Color() }, ash: { value: new THREE.Color() },
  };
  constructor(scene?: THREE.Scene) {
    this.group.name = 'ultimate-blast';
    this.add('core-bursts', new THREE.PlaneGeometry(1, 1), 9, common + `
      void main(){point=uv*2.-1.;noiseSeed=eventSeed.z;category=0.;
        bool mainHit=eventData.x<.5;float elapsed=age-eventData.y;
        if(mainHit&&keyframe>.5)elapsed=0.;
        float life=mainHit?.42:eventData.z;float t=max(0.,elapsed);
        float radius=mainHit?(42.+ease(t/.18)*55.):(8.+eventSeed.y*13.)*ease(t/.1);
        if(style>2.5)radius*=.84+.16*sin(t*23.);
        vec3 centre=anchor+vec3(cos(eventSeed.x)*eventData.w,mainHit?9.:4.+eventSeed.y*10.,sin(eventSeed.x)*eventData.w);
        if(mainHit)centre.y+=ease(t/.18)*8.;
        opacity=step(0.,elapsed)*(1.-smoothstep(mainHit?.055:.09,life,t));
        if(mainHit&&keyframe>.5)opacity=1.;
        opacity*=mix(1.,.16,softened);radius=mix(radius,34.,quiet);
        heat=mainHit?1.:.65;project(centre+(rightAxis()*point.x+upAxis()*point.y)*radius);
      }`, fragment + `
      void main(){float a=atan(point.y,point.x),r=length(point);
        float teeth=.76+.13*sin(a*(style<.5?7.:style<1.5?11.:style<2.5?5.:9.)+noiseSeed*6.)+.07*sin(a*17.+noiseSeed*19.);
        float edge=1.-smoothstep(teeth-.11,teeth,r);
        float centre=1.-smoothstep(.12,.53,r);
        float slit=style>1.5&&style<2.5?smoothstep(.025,.07,abs(point.x+point.y*.48+sin(point.y*19.)*.015))*smoothstep(.02,.05,abs(point.y-point.x*.3-.13)):1.;
        vec3 color=mix(energy,hot,centre*.94);float alpha=opacity*edge*mix(.26,.98,centre)*slit;
        if(alpha<.012)discard;gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`);
    this.add('warped-waves', new THREE.RingGeometry(.9, 1, 96), 3, common + `
      void main(){point=uv;noiseSeed=eventSeed.z;category=0.;float elapsed=age-eventData.y;
        float t=max(0.,elapsed),theta=atan(position.y,position.x);
        float radius=mix(18.+reach*eventData.w*ease(t/(.72+eventSeed.y*.3)),82.,quiet);
        float warp=1.+(.06+style*.01)*sin(theta*5.+eventSeed.z*7.)+.035*sin(theta*11.+age*2.);
        if(style>2.5)radius+=sin(t*17.)*12.*exp(-t*3.);
        vec3 pos=vec3(position.x*radius*warp,-.14+eventData.x*.025,position.y*radius*warp);
        pos.y+=style>.5&&style<1.5?sqrt(max(0.,1.-dot(position.xy,position.xy)))*radius*.62:style<.5?sin(theta*3.+eventSeed.z)*3.*ease(t/.15):0.;
        opacity=step(0.,elapsed)*(1.-smoothstep(.25,duration-eventData.y,t))*(.75-eventData.x*.17);
        opacity*=mix(1.,.24,softened);heat=max(0.,1.-t*.9);project(anchor+pos);
      }`, fragment + `
      void main(){float r=length(point*2.-1.);float edge=smoothstep(.78,.88,r)*(1.-smoothstep(.99,1.,r));
        float a=atan(point.y-.5,point.x-.5);float broken=style>1.5&&style<2.5?step(-.3,sin(a*7.+noiseSeed*12.)):1.;
        float modulation=.7+.3*sin(a*13.+noiseSeed*8.);float alpha=opacity*edge*modulation*broken;
        if(alpha<.012)discard;gl_FragColor=vec4(mix(energy,hot,heat*.55),alpha);
        #include <colorspace_fragment>
      }`);
    this.add('trails-fragments-sparks', ribbonGeometry(), 128, common + `
      void main(){point=uv;category=quiet>.5?2.:eventData.x;noiseSeed=eventSeed.z;
        float t=max(0.,age-eventData.y),theta=eventSeed.x;
        vec3 dir=vec3(cos(theta),0.,sin(theta)),side=vec3(-sin(theta),0.,cos(theta));
        float durationHere=eventData.z;float fade=1.-smoothstep(durationHere*.46,durationHere,t);
        vec3 centre;float width,lengthAlong;heat=1.-clamp(t/durationHere,0.,1.);
        if(age<0.){
          float q=quiet>.5?.45:fract(-age*(.6+eventSeed.y*.3)+eventSeed.z);
          float radius=3.+q*(style>1.5&&style<2.5?72.:56.);
          centre=gather+dir*radius+vec3(0.,(eventSeed.w-.3)*radius*.5,0.);
          width=category<.5?.18+.2*(1.-q):.25+eventSeed.y*.5;lengthAlong=category<.5?3.+q*5.:width*2.;
          opacity=(.18+.5*(1.-q))*smoothstep(-3.25,-1.6,age);
        }else{
          float speed=mix(70.,reach*.84,eventSeed.y),distance=3.+speed*t;
          centre=anchor+dir*distance+vec3(0.,3.+eventSeed.w*22.*t-9.*t*t,0.);
          if(category<.5){lengthAlong=(24.+eventSeed.w*65.)*ease(t/.11)*fade;width=(.65+eventSeed.y*2.)*fade;}
          else if(category<1.5){width=(1.2+eventSeed.w*3.)*fade;lengthAlong=width*(1.3+eventSeed.y);centre.y+=sin(theta*3.)*t*4.;}
          else{width=(.18+eventSeed.w*.6)*fade;lengthAlong=width*(2.+eventSeed.y*3.);centre.y+=eventSeed.y*5.;}
          opacity=step(eventData.y,age)*fade*(category<.5?.88:category<1.5?.8:.65);
          if(quiet>.5){centre=anchor+dir*(24.+eventSeed.y*60.)+vec3(0.,2.+t*2.,0.);width=.5;lengthAlong=1.;}
        }
        float q=position.x;vec3 pos;
        if(category<.5){
          float bend=sin(q*3.14159)*(style<.5?lengthAlong*.22:style>2.5?lengthAlong*.34:style>1.5?lengthAlong*.08:lengthAlong*.04);
          pos=centre+dir*(q*lengthAlong)+side*(bend+position.y*width*sin(q*3.14159));
          if(style>.5&&style<1.5){pos=centre+dir*(q*lengthAlong)+side*(position.y*width*sin(q*3.14159));pos.y+=q*lengthAlong*(.035+eventSeed.w*.075);}
          else if(style>2.5){float loop=q*5.2;pos=centre+dir*(q*lengthAlong+sin(loop)*lengthAlong*.15)+side*((1.-cos(loop))*lengthAlong*.2+position.y*width*sin(q*3.14159));pos.y+=sin(q*3.14159)*11.;}
          else pos.y+=sin(q*3.14159)*(style<.5?7.+eventSeed.w*10.:2.);
          if(style>1.5&&style<2.5)pos+=side*sin(q*29.+eventSeed.z*11.)*width*2.;
        }else{
          vec3 right=rightAxis(),up=upAxis();float spin=eventSeed.z*6.28+t*(category<1.5?2.:.2);
          pos=centre+(right*cos(spin)+up*sin(spin))*(q-.5)*lengthAlong+(up*cos(spin)-right*sin(spin))*position.y*width;
        }
        opacity*=mix(1.,.48,softened);project(pos);
      }`, fragment + `
      void main(){float across=abs(point.y*2.-1.);float alpha=opacity;
        if(category<.5)alpha*=1.-smoothstep(.5,1.,across);
        else if(category<1.5){float cut=abs(point.x-.5)*2.+across*.55;alpha*=1.-smoothstep(.6,1.,cut);}
        else{alpha*=1.-smoothstep(.25,1.,length(vec2((point.x-.5)*2.,across)));}
        vec3 color=mix(mix(ash,energy,.55),hot,heat*(category<.5?.65:.4));
        if(alpha<.012)discard;gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`);
    this.add('afterglow-clouds', new THREE.PlaneGeometry(1, 1), 24, common + `
      void main(){point=uv*2.-1.;noiseSeed=eventSeed.z;category=0.;float t=max(0.,age-eventData.y);
        float grow=ease(t/.35),fade=1.-smoothstep(.5,duration-eventData.y,t);
        float radius=(12.+eventSeed.y*reach*.46)*grow;
        vec3 centre=anchor+vec3(cos(eventSeed.x)*radius,4.+eventSeed.w*11.+t*4.,sin(eventSeed.x)*radius);
        float size=(9.+eventSeed.w*13.)*grow;
        opacity=step(eventData.y,age)*fade*grow*mix(.34,.15,softened);
        heat=max(0.,1.-t*1.5)*.22;project(centre+(rightAxis()*point.x+upAxis()*point.y*.72)*size);
      }`, fragment + `
      void main(){float a=atan(point.y,point.x),r=length(point);
        float edge=.74+.1*sin(a*5.+noiseSeed*13.)+.07*sin(a*9.-noiseSeed*7.);
        float alpha=opacity*(1.-smoothstep(edge-.09,edge,r));
        if(alpha<.012)discard;vec3 color=mix(ash,energy,heat)+vec3(.1)*(point.y*.5+.5);
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`);
    this.clear(); scene?.add(this.group);
  }
  private add(name: string, geometry: THREE.BufferGeometry, capacity: number, vertexShader: string, fragmentShader: string) {
    geometry.setAttribute('eventSeed', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4));
    geometry.setAttribute('eventData', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4));
    const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = 'ultimate-' + name; mesh.frustumCulled = false; mesh.renderOrder = 3;
    for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, this.identity);
    this.batches.push(mesh); this.group.add(mesh);
  }
  private seedEvents(seed: number) {
    let state = seed || 1;
    const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
    for (let batch = 0; batch < this.batches.length; batch++) {
      const mesh = this.batches[batch], a = mesh.geometry.getAttribute('eventSeed') as THREE.InstancedBufferAttribute;
      const data = mesh.geometry.getAttribute('eventData') as THREE.InstancedBufferAttribute;
      for (let i = 0; i < mesh.instanceMatrix.count; i++) {
        const angle = (i * 2.399963 + random() * .75) % (Math.PI * 2), speed = .15 + random() * .85, noise = random(), size = random();
        a.setXYZW(i, angle, speed, noise, size);
        if (batch === 0) data.setXYZW(i, i === 0 ? 0 : 1, i === 0 ? 0 : .1 + noise * .3, .3 + speed * .28, i === 0 ? 0 : 30 + speed * 145);
        else if (batch === 1) data.setXYZW(i, i, [.04, .16, .32][i], .9, 1 - i * .13);
        else if (batch === 2) {
          // Interleaving preserves the same visible event prefix when quality changes.
          const type = i % 4 < 1 ? 0 : i % 4 < 2 ? 1 : 2;
          data.setXYZW(i, type, type === 0 ? .055 + noise * .15 : .12 + noise * .23,
            type === 0 ? .58 + speed * .28 : type === 1 ? .9 + speed * .5 : 1.1 + speed * .36, 0);
        } else data.setXYZW(i, 0, .18 + noise * .26, 1.5, 0);
      }
      a.needsUpdate = true; data.needsUpdate = true;
    }
  }
  update(frame: Readonly<UltimateVisualFrame>, x: number, z: number, gather: Readonly<{x:number;y:number;z:number}>, profile: DetailProfile) {
    const f = frame, alive = f.active && (f.keyframe || !f.detonated || f.age < AFTERMATH[f.kind]);
    this.group.visible = !this.disposed && alive && f.time > .55;
    if (!this.group.visible) { this.clear(); return; }
    const seed = blastSeed(f.kind, x, z);
    if (this.seed !== seed) { this.seed = seed; this.seedEvents(seed); }
    if (this.style !== f.kind || this.uniforms.hot.value.getHex() === 0xffffff) {
      this.style = f.kind; const palette = COLORS[f.kind];
      this.uniforms.hot.value.copy(palette[0]); this.uniforms.energy.value.copy(palette[1]); this.uniforms.ash.value.copy(palette[2]);
    }
    this.uniforms.age.value = f.detonated ? f.age : Math.min(-.0001, f.age);
    this.uniforms.duration.value = AFTERMATH[f.kind]; this.uniforms.style.value = STYLES[f.kind];
    this.uniforms.reach.value = blastReach(x, z); this.uniforms.anchor.value.set(x, 0, z);
    this.uniforms.gather.value.set(gather.x, gather.y, gather.z);
    this.uniforms.quiet.value = f.reducedMotion ? 1 : 0; this.uniforms.softened.value = f.reducedMotion || f.reducedFlashes ? 1 : 0;
    this.uniforms.keyframe.value = f.keyframe ? 1 : 0;
    const counts = f.reducedMotion ? COUNTS.quiet : COUNTS[profile];
    const [bursts, waves, trails, clouds] = this.batches;
    bursts.count = f.detonated ? counts.bursts : 0; waves.count = f.detonated ? counts.waves : 0;
    trails.count = counts.streaks + counts.fragments + counts.sparks; clouds.count = f.detonated ? counts.smoke : 0;
    for (const mesh of this.batches) mesh.visible = mesh.count > 0;
  }
  diagnostics() { return { seed: this.seed, reach: this.uniforms.reach.value, batches: this.batches.map(m => ({ name: m.name, count: m.visible && this.group.visible ? m.count : 0, capacity: m.instanceMatrix.count, triangles: (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3 * (m.visible && this.group.visible ? m.count : 0) })) }; }
  clear() { this.group.visible = false; for (const mesh of this.batches) { mesh.count = 0; mesh.visible = false; } }
  dispose() { if (this.disposed) return; this.disposed = true; this.clear(); for (const mesh of this.batches) { mesh.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); } this.group.removeFromParent(); }
}

/** Applied after framing, with no feedback into gameplay or next-frame camera state. */
export class UltimateCameraPunch {
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private back = new THREE.Vector3();
  private portraitEye = new THREE.Vector3();
  private portraitFocus = new THREE.Vector3();
  private portraitBase=new THREE.Quaternion();
  private portraitTarget=new THREE.Quaternion();
  apply(camera: THREE.PerspectiveCamera, frame: Readonly<UltimateVisualFrame>, anchor?: Readonly<{x:number;y:number;z:number}>, framingFocus?: Readonly<{x:number;y:number;z:number}>) {
    if (!frame.active || !frame.cameraEnabled || frame.reducedMotion || !frame.detonated) return;
    if(camera.aspect<.8&&anchor){
      const focus=framingFocus??anchor;this.portraitFocus.set(focus.x,8,focus.z);
      this.back.subVectors(camera.position,this.portraitFocus);
      const distance=this.back.length(),angle=Math.atan2(this.back.z,this.back.x);
      this.portraitEye.set(focus.x+Math.cos(angle)*distance*.48,8+distance*.88,focus.z+Math.sin(angle)*distance*.48);
      const weight=.8*(1-THREE.MathUtils.smoothstep(frame.time,4.3,5.5));
      this.portraitBase.copy(camera.quaternion);camera.position.lerp(this.portraitEye,weight);camera.lookAt(this.portraitFocus);this.portraitTarget.copy(camera.quaternion);camera.quaternion.copy(this.portraitBase).slerp(this.portraitTarget,weight);
    }
    if(frame.age>=.3)return;
    const t = frame.keyframe ? 0 : frame.age, envelope = Math.exp(-t * 15) * (1 - THREE.MathUtils.smoothstep(t, .17, .3));
    const strength = frame.kind === 'skybreaker' ? 1.25 : frame.kind === 'purple' ? 1.1 : 1.6;
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion); this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.back.set(0, 0, 1).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(this.right, Math.sin(t * 77 + 1.2) * envelope * strength)
      .addScaledVector(this.up, Math.sin(t * 93 + .7) * envelope * strength * .55)
      .addScaledVector(this.back, envelope * strength * 1.3);
    camera.rotateZ(Math.sin(t * 64) * envelope * .012);
    camera.fov -= 3.5 * envelope; camera.updateProjectionMatrix();
  }
}
