import * as THREE from 'three';
import type {WorldBuilder} from './builder';
import {CITY_BLOCKS} from './shibuya-layout';
/** A bounded shader pool at restaurant vents, updated by the visual cadence. */
export function shibuyaSteam(b:WorldBuilder){
  const clock={value:0},motion={value:1},count=b.profile==='mobile'?8:16;
  const geometry=b.geo(new THREE.PlaneGeometry(1,1)),phase=new Float32Array(count);
  geometry.setAttribute('steamPhase',new THREE.InstancedBufferAttribute(phase,1));
  const material=b.material(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    uniforms:{steamTime:clock,steamMotion:motion},vertexShader:`uniform float steamTime,steamMotion;attribute float steamPhase;varying vec2 p;varying float life;
      void main(){p=uv*2.-1.;float t=mix(.35,fract(steamTime*.13+steamPhase),steamMotion);life=sin(t*3.14159)*.19;
        vec3 point=position;point.xy*=1.+t*3.;point.y+=t*9.;point.x+=sin(t*7.+steamPhase*4.)*t*1.5;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(point,1.);}`,
    fragmentShader:`varying vec2 p;varying float life;void main(){float r=length(p);float alpha=life*(1.-smoothstep(.2,1.,r));if(alpha<.005)discard;gl_FragColor=vec4(.63,.68,.8,alpha);}`
  }));
  const steam=new THREE.InstancedMesh(geometry,material,count),dummy=new THREE.Object3D();steam.name='shibuya-restaurant-steam';
  for(let i=0;i<count;i++){const block=CITY_BLOCKS[5+Math.floor(i/4)*8],front=block.depth/2+3;phase[i]=(i%4)*.23;dummy.position.set(block.x+Math.sin(block.rotation)*front,5.4,block.z+Math.cos(block.rotation)*front);dummy.rotation.y=block.rotation;dummy.updateMatrix();steam.setMatrixAt(i,dummy.matrix);}
  steam.computeBoundingSphere();steam.boundingSphere!.radius+=12;
  const group=new THREE.Group();group.add(steam);b.moving(group,f=>{clock.value=f.reducedMotion?0:f.time;motion.value=f.reducedMotion?0:1;});
}
