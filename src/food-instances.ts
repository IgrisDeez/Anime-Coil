import * as THREE from 'three';
import type { Food } from './simulation';
import type { FrameProfiler } from './frame-profiler';
import { dirtyRange } from './instance-updates';

/** Original food animation, evaluated after the static instance transform. */
export const FOOD_BOB_AMPLITUDE=.12;
export const FOOD_YAW_SPEED=.6;
export function foodAnimation(time:number,id:number,reduced:boolean){return {y:.25+(reduced?0:Math.sin(time*2+id)*FOOD_BOB_AMPLITUDE),yaw:id+(reduced?0:time*FOOD_YAW_SPEED)};}
export class FoodInstances {
  readonly time={value:0};
  readonly motion={value:1};
  private readonly ids=new Float64Array(1700).fill(NaN);
  private readonly x=new Float64Array(1700).fill(NaN);
  private readonly z=new Float64Array(1700).fill(NaN);
  private readonly scale=new Float32Array(1700);
  readonly phase=new THREE.InstancedBufferAttribute(new Float32Array(1700),1).setUsage(THREE.DynamicDrawUsage);
  constructor(mesh:THREE.InstancedMesh){
    mesh.geometry.setAttribute('foodPhase',this.phase);
    const material=mesh.material as THREE.MeshBasicMaterial;
    material.onBeforeCompile=shader=>{
      shader.uniforms.foodTime=this.time;shader.uniforms.foodMotion=this.motion;
      shader.vertexShader='attribute float foodPhase; uniform float foodTime; uniform float foodMotion;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float foodYaw=foodTime*.6*foodMotion;
        float foodCos=cos(foodYaw),foodSin=sin(foodYaw);
        transformed.xz=mat2(foodCos,-foodSin,foodSin,foodCos)*transformed.xz;`);
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          mvPosition=instanceMatrix*mvPosition;
        #endif
        mvPosition.y+=sin(foodTime*2.0+foodPhase)*.12*foodMotion;
        mvPosition=modelViewMatrix*mvPosition;
        gl_Position=projectionMatrix*mvPosition;`);
    };
    material.customProgramCacheKey=()=> 'food-bob-yaw-v1';
  }
  update(mesh:THREE.InstancedMesh,food:readonly Food[],time:number,reduced:boolean,profiler?:FrameProfiler){
    this.time.value=time;this.motion.value=reduced?0:1;
    let first=food.length,last=-1,phaseFirst=food.length,phaseLast=-1;
    const a=mesh.instanceMatrix.array as Float32Array;
    for(let i=0;i<food.length;i++){
      const f=food[i],scale=f.value>1?1.45:1;
      if(this.ids[i]===f.id&&this.x[i]===f.x&&this.z[i]===f.z&&this.scale[i]===Math.fround(scale))continue;
      if(this.ids[i]!==f.id){this.phase.setX(i,f.id);phaseFirst=Math.min(phaseFirst,i);phaseLast=i;}
      this.ids[i]=f.id;this.x[i]=f.x;this.z[i]=f.z;this.scale[i]=scale;
      const o=i*16,c=Math.cos(f.id)*scale,s=Math.sin(f.id)*scale;
      a.fill(0,o,o+16);a[o]=a[o+10]=c;a[o+2]=-s;a[o+8]=s;a[o+5]=scale;a[o+12]=f.x;a[o+13]=.25;a[o+14]=f.z;a[o+15]=1;
      first=Math.min(first,i);last=i;
      if(profiler?.enabled){profiler.counts.matrices++;profiler.counts.updatedInstances++;}
    }
    if(last>=first)dirtyRange(mesh.instanceMatrix,first*16,(last-first+1)*16,profiler);
    if(phaseLast>=phaseFirst)dirtyRange(this.phase,phaseFirst,phaseLast-phaseFirst+1,profiler);
    if(last>=first){mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=FOOD_BOB_AMPLITUDE;}
  }
}
