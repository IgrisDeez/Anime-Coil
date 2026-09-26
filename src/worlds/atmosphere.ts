import * as THREE from "three";
import { RADIUS } from "../simulation";
import type { MapId } from "../maps";
import { WorldBuilder } from "./builder";
import { particleColor, reaction, type EnvironmentFrame } from "./types";

export function atmosphere(b:WorldBuilder,id:MapId) {
  const count=b.detail.particles,positions=new Float32Array(count*(id==="shibuya"?6:3));
  const geo=b.geo(new THREE.BufferGeometry());geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
  const material=b.material(id==="shibuya"?new THREE.LineBasicMaterial({color:particleColor[id],transparent:true,opacity:.28,depthWrite:false}):new THREE.PointsMaterial({color:particleColor[id],size:id==="leaf"?.46:id==="tournament"?.23:.2,transparent:true,opacity:id==="leaf"?.74:.68,depthWrite:false}));
  const particles=id==="shibuya"?new THREE.LineSegments(geo,material as THREE.LineBasicMaterial):new THREE.Points(geo,material as THREE.PointsMaterial);particles.frustumCulled=false;particles.name="ambient-particles";b.group.add(particles);
  const waterUniforms={time:{value:0},pulse:{value:0},light:{value:1},tint:{value:0}};
  let waveMarks:THREE.InstancedMesh|undefined;
  if(id==="harbor") {
    const water=b.material(new THREE.ShaderMaterial({uniforms:waterUniforms,vertexShader:`varying vec3 location; uniform float time; void main(){vec3 p=position; p.y+=sin(p.x*.09+time*.7)*.035+cos(p.z*.13+time*.5)*.025;location=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`
      varying vec3 location; uniform float time; uniform float pulse; uniform float light; uniform float tint;
      void main(){
        float broad=sin(location.x*.036+location.z*.028+time*.28);
        float ripple=sin(location.x*.13-location.z*.09+time*.55+broad*.8);
        float detail=sin(location.x*.24+location.z*.17-time*.4);
        float v=clamp(.5+broad*.25+ripple*.16+detail*.06,0.,1.);
        vec3 c=mix(vec3(.17,.38,.47),vec3(.36,.59,.61),v);
        float foam=1.-smoothstep(0.,3.5,abs(length(location.xz)-${RADIUS+11.5}.));
        float glint=pow(max(0.,ripple*.5+.5),16.);
        c+=vec3(.45,.43,.31)*glint*.09;
        c=mix(c,vec3(.76,.84,.75),foam*.38);
        c=mix(c,c*vec3(.72,.44,1.),tint)*light;
        c+=pulse*.06;gl_FragColor=vec4(c,1.);
      }`}));
    const grid=b.geo(new THREE.PlaneGeometry(4000,4000,b.profile==="mobile"?20:48,b.profile==="mobile"?20:48));grid.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(grid,water);mesh.position.y=-.59;mesh.name="ocean";b.group.add(mesh);
    waveMarks=new THREE.InstancedMesh(b.geo(new THREE.RingGeometry(1,1.12,12,1,0,Math.PI)),b.material(new THREE.MeshBasicMaterial({color:"#c9e8e0",transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide})),b.profile==="mobile"?18:36);
    waveMarks.name="harbor-wavelets";waveMarks.frustumCulled=false;b.group.add(waveMarks);
  }
  const dummy=new THREE.Object3D();
  // Perimeter-only atmosphere: cloud silhouettes, traffic streaks or camera flashes.
  const accents=b.material(new THREE.MeshBasicMaterial({color:id==="shibuya"?"#c893c3":id==="tournament"?"#fff1cc":"#d6ddc5",transparent:true,opacity:id==="shibuya"?.3:.6,depthWrite:false}));
  const accentGeo=b.geo(id==="shibuya"?new THREE.BoxGeometry(1,1,1):new THREE.SphereGeometry(1,6,4));
  const accentCount=id==="tournament"?24:id==="shibuya"?12:12;
  const motion=new THREE.InstancedMesh(accentGeo,accents,accentCount);motion.frustumCulled=false;motion.name="perimeter-atmosphere";b.group.add(motion);
  const puddles=id==="shibuya"?new THREE.InstancedMesh(b.geo(new THREE.CircleGeometry(1,20)),b.material(new THREE.MeshBasicMaterial({color:"#778ba7",transparent:true,opacity:.1,depthWrite:false})),10):undefined;
  if(puddles){for(let i=0;i<10;i++){const a=i*2.4,r=25+i*6;dummy.position.set(Math.cos(a)*r,-.429,Math.sin(a)*r);dummy.rotation.set(-Math.PI/2,0,a);dummy.scale.set(4+i%3,1.5,1);dummy.updateMatrix();puddles.setMatrixAt(i,dummy.matrix);}b.group.add(puddles);}
  const birdsGeo=b.geo(new THREE.BufferGeometry());birdsGeo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(8*12),3));
  const birds=new THREE.LineSegments(birdsGeo,b.material(new THREE.LineBasicMaterial({color:"#e8ead8",transparent:true,opacity:.8})));birds.visible=id==="harbor";birds.frustumCulled=false;if(id==="harbor")b.group.add(birds);
  return (f:EnvironmentFrame)=>{
    const t=f.reducedMotion?0:f.time,fx=f.mode==="menu"?0:f.focus.x,fz=f.mode==="menu"?0:f.focus.z,rx=reaction(f.ultimate,f.reducedMotion);
    waterUniforms.time.value=t;waterUniforms.pulse.value=rx.pulse;waterUniforms.light.value=rx.light;waterUniforms.tint.value=rx.tint;
    for(let i=0;i<count;i++){
      const a=i*2.39996,rad=10+(i*17%65),drift=Math.sin(t*(id==="leaf"?.28:.17)+i)*(id==="leaf"?4.2:3);
      let x=fx+Math.cos(a)*rad+drift,z=fz+Math.sin(a)*rad+(id==="leaf"?Math.cos(t*.42+i)*2.4:0),y=id==="shibuya"?((i*.71-t*6.5)%22+22)%22:1+((i*.53+t*(id==="leaf"?-.75:.12))%9+9)%9;
      if(rx.attraction&&f.ultimate){const pull=rx.attraction*.65;x+=(f.ultimate.origin.x-x)*pull;z+=(f.ultimate.origin.z-z)*pull;y+=(28-y)*pull;}
      const stride=id==="shibuya"?6:3,offset=i*stride;positions[offset]=x;positions[offset+1]=y;positions[offset+2]=z;
      if(stride===6){positions[offset+3]=x-.12;positions[offset+4]=y+.75;positions[offset+5]=z;}
    }
    geo.attributes.position.needsUpdate=true;
    if(waveMarks){for(let i=0;i<waveMarks.count;i++){
      const drift=f.reducedMotion?0:t;
      dummy.position.set(-275+(i*79%550)+Math.sin(drift*.22+i)*2,-.545,145+(i*47%220)+Math.cos(drift*.18+i)*1.3);
      dummy.rotation.set(-Math.PI/2,0,(i%5-2)*.13);
      dummy.scale.set(3+(i%4)*1.3,2+(i%3)*.6,1);
      dummy.updateMatrix();waveMarks.setMatrixAt(i,dummy.matrix);
    }waveMarks.instanceMatrix.needsUpdate=true;}
    for(let i=0;i<accentCount;i++){
      if(id==="shibuya"){const lane=i%2?1:-1;dummy.position.set(-150+((i*39+t*6)%300),.3,lane*145);dummy.scale.set(3,.08,.22);}
      else if(id==="tournament"){const a=i*Math.PI/12;dummy.position.set(Math.sin(a)*186,12+(i%4)*2,Math.cos(a)*186);const phase = (t + i * 7.37) % 24;
        const softGlint = !f.reducedMotion && phase < .85 ? Math.sin(phase / .85 * Math.PI) * .28 : 0;
        const flash = rx.pulse>0&&!f.reducedMotion&&Math.sin(i*3+t*12)>.75?.65:softGlint;
        dummy.scale.setScalar(flash);}
      else{dummy.position.set(-260+i*47+Math.sin(t*.035+i)*10,46+(i%3)*7,-260-(i%2)*35);dummy.scale.set(18+(i%3)*5,4,8);}
      dummy.rotation.set(0,0,0);dummy.updateMatrix();motion.setMatrixAt(i,dummy.matrix);
    }motion.instanceMatrix.needsUpdate=true;
    if(id==="harbor"){const p=birdsGeo.attributes.position as THREE.BufferAttribute;for(let i=0;i<8;i++){const a=t*.055+i*.78,x=Math.cos(a)*190,z=Math.sin(a)*190,y=22+i%3*3,wing=Math.sin(t*2+i)*.5;p.setXYZ(i*4,x-1.3,y+wing,z);p.setXYZ(i*4+1,x,y,z+.25);p.setXYZ(i*4+2,x,y,z+.25);p.setXYZ(i*4+3,x+1.3,y+wing,z);}p.needsUpdate=true;}
    if(puddles)(puddles.material as THREE.MeshBasicMaterial).opacity=.075+(Math.sin(t*.6)+1)*.025;
  };
}
