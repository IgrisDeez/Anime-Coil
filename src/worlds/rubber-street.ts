import * as THREE from 'three';
export interface RubberField {center:THREE.Vector2;time:{value:number};intensity:{value:number}}
/** One displacement formula for the floor, painted markings, puddles and splashes. */
export const RUBBER_GLSL=`
uniform vec2 cartoonCenter;uniform float cartoonTime;uniform float cartoonIntensity;
float rubberHeight(vec3 p){
  if(cartoonIntensity<=0.0||p.y>.1)return 0.0;
  float d=length(p.xz-cartoonCenter),rim=1.0-smoothstep(18.0,24.0,d);
  if(d>=24.0)return 0.0;
  float age=max(0.0,cartoonTime-3.4);
  float windup=smoothstep(.9,2.5,cartoonTime)*(1.0-step(3.4,cartoonTime));
  float dent=-2.8*exp(-age*12.0)*(1.0-smoothstep(8.0,19.0,d));
  float rebound=2.1*sin(age*13.0-d*.13)*exp(-age*2.4)*rim;
  float impact=step(3.4,cartoonTime)*(dent+rebound);
  return cartoonIntensity*step(p.y,.1)*(windup*.42*sin(d*.20-cartoonTime*3.0)*rim+impact);
}`;
export function rubberUniforms(field:RubberField){return {cartoonCenter:{value:field.center},cartoonTime:field.time,cartoonIntensity:field.intensity};}
export function attachRubberStreet(material:THREE.Material,field:RubberField,worldOffset=''){
  const before=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    before.call(material,shader,renderer);Object.assign(shader.uniforms,rubberUniforms(field));
    shader.vertexShader=RUBBER_GLSL+'\n'+shader.vertexShader.replace(/uniform (?:vec2 cartoonCenter|float cartoonTime|float cartoonIntensity)\s*;/g,'');
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 mvPosition=vec4(transformed,1.0);
      #ifdef USE_BATCHING
        mvPosition=batchingMatrix*mvPosition;
      #endif
      #ifdef USE_INSTANCING
        mvPosition=instanceMatrix*mvPosition;
      #endif
      vec4 rubberWorld=modelMatrix*mvPosition;
      ${worldOffset}
      rubberWorld.y+=rubberHeight(rubberWorld.xyz);
      mvPosition=viewMatrix*rubberWorld;
      gl_Position=projectionMatrix*mvPosition;`);
  };material.customProgramCacheKey=()=>key+'-rubber-street-v177'+worldOffset;
}
/** Tessellated once at world creation. Radius and collision data are unchanged. */
export function rubberDisk(radius:number,mobile:boolean){
  const sides=mobile?72:96,rings=mobile?28:40,p:number[]=[0,0,0],uv:number[]=[.5,.5],idx:number[]=[];
  for(let j=1;j<=rings;j++)for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,r=j/rings*radius;p.push(Math.cos(a)*r,Math.sin(a)*r,0);uv.push(.5+Math.cos(a)*r/radius*.5,.5+Math.sin(a)*r/radius*.5);}
  for(let i=0;i<sides;i++)idx.push(0,1+i,1+(i+1)%sides);
  for(let j=1;j<rings;j++)for(let i=0;i<sides;i++){const a=1+(j-1)*sides+i,b=1+(j-1)*sides+(i+1)%sides,c=a+sides,d=b+sides;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
