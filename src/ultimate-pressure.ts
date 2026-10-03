import * as THREE from 'three';
import type { DetailProfile } from './worlds/types';

/** One pressure front and one pooled batch of tapered impact strokes. No light or post pass. */
export function pressureFrame(time: number, reduced = false) {
  const age = time - 3.4;
  const opening = THREE.MathUtils.smoothstep(age, 0, .46);
  return {
    age,
    visible: age >= 0 && age < 1.05,
    radius: reduced ? 23 : 5 + 76 * (1 - (1 - opening) ** 2),
    opacity: (reduced ? .15 : .78) * (1 - THREE.MathUtils.smoothstep(age, .13, 1.05)),
    strokes: !reduced && age >= 0 && age < .68,
  };
}

function pressureStrokeGeometry() {
  // Crossed chisel planes taper to a finished point; vertex colours distinguish the hot tip.
  const p = [-.16,0,0, .16,0,0, -.38,.62,0, .38,.62,0, 0,1,0,
    0,0,-.16, 0,0,.16, 0,.62,-.38, 0,.62,.38, 0,1,0];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p,3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([
    .25,.18,.38, .25,.18,.38, .75,.7,.83, .75,.7,.83, 1,1,1,
    .25,.18,.38, .25,.18,.38, .75,.7,.83, .75,.7,.83, 1,1,1,
  ],3));
  geometry.setIndex([0,1,2, 1,3,2, 2,3,4, 5,6,7, 6,8,7, 7,8,9]);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

const PALETTES = {
  fox: ['#b480f0','#160d2a'], spirit: ['#b5f3ff','#16385e'],
  purple: ['#e0b5ff','#220e3c'], skybreaker: ['#fff2cf','#39263f'],
} as const;

export class UltimatePressure {
  readonly group = new THREE.Group();
  private disc: THREE.Mesh<THREE.CircleGeometry,THREE.ShaderMaterial>;
  private strokes: THREE.InstancedMesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  private dummy = new THREE.Object3D();
  private direction = new THREE.Vector3();
  private up = new THREE.Vector3(0,1,0);
  private disposed = false;
  constructor(kind: keyof typeof PALETTES) {
    const [hot, ink] = PALETTES[kind];
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.ShaderMaterial({
      uniforms: { age:{value:0}, alpha:{value:0}, hot:{value:new THREE.Color(hot)}, ink:{value:new THREE.Color(ink)} },
      transparent:true, depthWrite:false, side:THREE.DoubleSide, forceSinglePass:true,
      vertexShader:'varying vec2 point;void main(){point=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 point;uniform float age;uniform float alpha;uniform vec3 hot;uniform vec3 ink;
        void main(){float r=length(point),a=atan(point.y,point.x);
          float teeth=sin(a*17.+sin(a*7.)*.8)*.027*(1.-smoothstep(.12,.6,age));
          float rim=1.-smoothstep(.015,.06,abs(r-(.88+teeth)));
          float inner=1.-smoothstep(.02,.065,abs(r-.74));
          float radial=pow(max(0.,sin(a*19.+r*2.)),20.)*smoothstep(.12,.35,r)*(1.-smoothstep(.68,.8,r));
          float mask=max(rim,max(inner*.68,radial*.6));
          vec3 color=mix(ink,hot,rim*.9+radial*.55);
          gl_FragColor=vec4(color,mask*alpha);}`,
    }));
    this.disc.rotation.x=-Math.PI/2; this.disc.position.y=-.22;
    this.disc.name=kind+'-pressure-front';
    this.strokes=new THREE.InstancedMesh(pressureStrokeGeometry(),new THREE.MeshBasicMaterial({
      color:hot,vertexColors:true,transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    }),18);
    this.strokes.frustumCulled=false;this.strokes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.strokes.name=kind+'-impact-strokes';
    this.group.name=kind+'-pressure';this.group.add(this.disc,this.strokes);this.clear();
  }
  update(time:number, x:number, z:number, profile:DetailProfile, reduced:boolean) {
    const f=pressureFrame(time,reduced);this.group.visible=!this.disposed&&f.visible;
    if(!this.group.visible)return;
    this.group.position.set(x,0,z);this.disc.scale.setScalar(f.radius);
    this.disc.material.uniforms.age.value=reduced?.3:f.age;this.disc.material.uniforms.alpha.value=f.opacity;
    this.strokes.visible=f.strokes;this.strokes.count=f.strokes?(profile==='mobile'?10:18):0;
    const sweep=1-(1-THREE.MathUtils.clamp(f.age/.68,0,1))**3;
    this.strokes.material.opacity=.88*(1-THREE.MathUtils.smoothstep(f.age,.09,.68));
    for(let i=0;i<this.strokes.count;i++){
      const a=i*2.399963, elevation=.13+(i%4)*.105, radius=2+sweep*(8+i%5*3);
      this.direction.set(Math.cos(a),elevation,Math.sin(a)).normalize();
      this.dummy.position.copy(this.direction).multiplyScalar(radius);this.dummy.position.y+=1.4;
      this.dummy.quaternion.setFromUnitVectors(this.up,this.direction);
      this.dummy.scale.set(.65+i%3*.2,(9+i%4*3)*(1-sweep*.42),.65+i%3*.2);
      this.dummy.updateMatrix();this.strokes.setMatrixAt(i,this.dummy.matrix);
    }
    this.strokes.instanceMatrix.needsUpdate=true;
  }
  clear(){this.group.visible=false;this.strokes.count=0;this.disc.material.uniforms.alpha.value=0;}
  dispose(){if(this.disposed)return;this.disposed=true;this.clear();this.disc.geometry.dispose();this.disc.material.dispose();this.strokes.geometry.dispose();this.strokes.material.dispose();this.strokes.dispose();this.group.removeFromParent();}
}
