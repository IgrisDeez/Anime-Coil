import * as THREE from 'three';
import type { WorldBuilder } from './builder';
import type { EnvironmentFrame } from './types';
import { CITY_BLOCKS, CITY_NEON } from './shibuya-layout';

/** Bounded rain, soft neon sheen and perimeter haze; no reflection or postprocessing pass. */
export function shibuyaWeather(b:WorldBuilder) {
  const mobile=b.profile==='mobile',count=b.detail.particles,positions=new Float32Array(count*6);
  const rainGeometry=b.geo(new THREE.BufferGeometry());rainGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  const time={value:0},focus={value:new THREE.Vector2()},tops=new Float32Array(count*2);
  for(let i=0;i<count;i++){
    const a=i*2.39996,r=10+i*17%80,x=Math.cos(a)*r,z=Math.sin(a)*r,o=i*6;
    positions[o]=x;positions[o+1]=i*.71%24;positions[o+2]=z;positions[o+3]=x-.1;positions[o+4]=i*.71%24;positions[o+5]=z;tops[i*2+1]=.8;
  }
  rainGeometry.setAttribute('rainTop',new THREE.BufferAttribute(tops,1));
  const rainMaterial=b.material(new THREE.LineBasicMaterial({color:'#93aec5',transparent:true,opacity:.2,depthWrite:false}));
  rainMaterial.onBeforeCompile=shader=>{
    shader.uniforms.rainTime=time;shader.uniforms.rainFocus={value:focus.value};
    shader.vertexShader='uniform float rainTime; uniform vec2 rainFocus; attribute float rainTop;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.xz+=rainFocus;transformed.y=mod(position.y-rainTime*7.0,24.0)+rainTop;`);
  };
  rainMaterial.customProgramCacheKey=()=> 'city-rain-v1';
  const rain=new THREE.LineSegments(rainGeometry,rainMaterial);
  rain.name='ambient-particles';rain.frustumCulled=true;rainGeometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,12,0),92);b.group.add(rain);
  const shape=b.geo(new THREE.CircleGeometry(1,mobile?16:28)),p=shape.attributes.position;
  for(let i=1;i<p.count;i++){const a=Math.atan2(p.getY(i),p.getX(i)),r=1+.12*Math.sin(a*3)+.07*Math.cos(a*7);p.setXY(i,p.getX(i)*r,p.getY(i)*r);}
  shape.computeBoundingSphere();
  const sheen=b.material(new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{opacity:{value:.14}},
    vertexShader:`varying vec2 point; varying vec3 reflectionColor; void main(){point=position.xy;reflectionColor=instanceColor;vec4 p=instanceMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*p;}`,
    fragmentShader:`uniform float opacity;varying vec2 point;varying vec3 reflectionColor;void main(){float edge=1.-smoothstep(.2,1.,length(point));float streak=.5+.5*sin(point.y*22.+point.x*2.);gl_FragColor=vec4(reflectionColor,opacity*edge*(.55+.45*streak));}`}));
  const puddles=new THREE.InstancedMesh(shape,sheen,mobile?14:28);puddles.name='shibuya-neon-puddles';puddles.frustumCulled=true;
  const dummy=new THREE.Object3D();
  for(let i=0;i<puddles.count;i++){
    if(i<6){const a=i*2.399;dummy.position.set(Math.cos(a)*(40+i*8),-.415,Math.sin(a)*(40+i*8));dummy.scale.set(3+i%3,1.2,1);}
    else{const block=CITY_BLOCKS[(i-6)%CITY_BLOCKS.length],forward=block.depth/2+22;dummy.position.set(block.x+Math.sin(block.rotation)*forward,-.34,block.z+Math.cos(block.rotation)*forward);dummy.scale.set(8+i%4,3+i%3,1);}
    puddles.setColorAt(i,new THREE.Color(CITY_NEON[(i<6?i:i-6)%3]));
    dummy.rotation.set(-Math.PI/2,0,i<6?i*1.7:CITY_BLOCKS[(i-6)%CITY_BLOCKS.length].rotation);dummy.updateMatrix();puddles.setMatrixAt(i,dummy.matrix);
  }
  puddles.computeBoundingSphere();b.group.add(puddles);
  const splashes=new THREE.InstancedMesh(b.geo(new THREE.RingGeometry(.8,1,12)),b.material(new THREE.MeshBasicMaterial({color:'#9eabbc',transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide})),mobile?8:18);
  const splashPhase=new Float32Array(splashes.count);
  for(let i=0;i<splashes.count;i++){
    const a=i*2.4,r=18+i*7%74;splashPhase[i]=i*.137;
    dummy.position.set(Math.cos(a)*r,-.405,Math.sin(a)*r);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();splashes.setMatrixAt(i,dummy.matrix);
  }
  splashes.geometry.setAttribute('splashPhase',new THREE.InstancedBufferAttribute(splashPhase,1));
  const splashMaterial=splashes.material as THREE.MeshBasicMaterial;
  splashMaterial.onBeforeCompile=shader=>{
    shader.uniforms.rainTime=time;shader.uniforms.rainFocus={value:focus.value};
    shader.vertexShader='uniform float rainTime; uniform vec2 rainFocus; attribute float splashPhase;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=mod(rainTime*.8+splashPhase,1.0);transformed.xy*=sin(phase*3.141592653589793)*(.3+phase*.6);`);
    shader.vertexShader=shader.vertexShader.replace('mvPosition = modelViewMatrix * mvPosition;', 'mvPosition.xz+=rainFocus;mvPosition = modelViewMatrix * mvPosition;');
  };
  splashMaterial.customProgramCacheKey=()=> 'city-splashes-v1';
  splashes.boundingSphere=new THREE.Sphere(new THREE.Vector3(),94);
  splashes.name='shibuya-rain-splashes';splashes.frustumCulled=true;b.group.add(splashes);
  splashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const haze=new THREE.InstancedMesh(b.geo(new THREE.SphereGeometry(1,8,5)),b.material(new THREE.MeshBasicMaterial({color:'#566681',transparent:true,opacity:.035,depthWrite:false})),mobile?4:8);
  haze.name='shibuya-perimeter-mist';haze.frustumCulled=true;
  for(let i=0;i<haze.count;i++){const a=i*Math.PI*2/haze.count;dummy.position.set(Math.cos(a)*265,4,Math.sin(a)*265);dummy.rotation.set(0,0,0);dummy.scale.set(55,4,25);dummy.updateMatrix();haze.setMatrixAt(i,dummy.matrix);}
  haze.computeBoundingSphere();b.group.add(haze);
  return (f:EnvironmentFrame)=>{
    const t=f.reducedMotion?0:f.time,fx=f.mode==='menu'?0:f.focus.x,fz=f.mode==='menu'?0:f.focus.z;
    time.value=t;focus.value.set(fx,fz);
    rainGeometry.boundingSphere!.center.set(fx,12,fz);
    splashes.boundingSphere!.center.set(fx,0,fz);
    rain.visible=!f.reducedMotion;splashes.visible=!f.reducedMotion;
  };
}
