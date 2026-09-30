import * as THREE from 'three';

/** One shared uniform set per world; no materials or passes are created on activation. */
export class SummonClearance {
  readonly center = {value:new THREE.Vector3()};
  readonly extent = {value:new THREE.Vector3(1,1,1)};
  readonly intensity = {value:0};
  readonly viewOrigin = {value:new THREE.Vector3()};
  readonly viewTarget = {value:new THREE.Vector3()};
  readonly viewIntensity = {value:0};
  /** Dense city blocks must not engulf a cinematic camera or obstruct its focal silhouette. */
  updateCamera(camera?:Readonly<{x:number;y?:number;z:number}>,target?:Readonly<{x:number;y?:number;z:number}>,strength=0){
    this.viewIntensity.value=camera&&target?Math.max(0,Math.min(1,strength)):0;
    if(camera&&target){this.viewOrigin.value.set(camera.x,camera.y??0,camera.z);this.viewTarget.value.set(target.x,target.y??12,target.z);}
  }
  update(bounds?: Readonly<{min:Readonly<{x:number;y:number;z:number}>;max:Readonly<{x:number;y:number;z:number}>}>, strength=0) {
    this.intensity.value = bounds ? Math.max(0,Math.min(1,strength)) : 0;
    if (bounds) {
      this.center.value.copy(bounds.min).add(bounds.max).multiplyScalar(.5);
      this.extent.value.copy(bounds.max).sub(bounds.min).multiplyScalar(.5).addScalar(6);
    }
  }
  attach(material:THREE.Material) {
    const compile=material.onBeforeCompile, key=material.customProgramCacheKey();
    material.onBeforeCompile = (shader,renderer) => {
      compile.call(material,shader,renderer);
      shader.uniforms.summonCenter=this.center; shader.uniforms.summonExtent=this.extent; shader.uniforms.summonFade=this.intensity;
      shader.uniforms.cinematicViewOrigin=this.viewOrigin;shader.uniforms.cinematicViewTarget=this.viewTarget;shader.uniforms.cinematicViewFade=this.viewIntensity;
      shader.vertexShader='varying vec3 summonWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 summonPoint=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          summonPoint=instanceMatrix*summonPoint;
        #endif
        summonWorld=(modelMatrix*summonPoint).xyz;
        #include <project_vertex>`);
      shader.fragmentShader='varying vec3 summonWorld; uniform vec3 summonCenter; uniform vec3 summonExtent; uniform float summonFade; uniform vec3 cinematicViewOrigin; uniform vec3 cinematicViewTarget; uniform float cinematicViewFade;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        float clearanceDistance=max(max(abs((summonWorld-summonCenter).x/summonExtent.x),abs((summonWorld-summonCenter).y/summonExtent.y)),abs((summonWorld-summonCenter).z/summonExtent.z));
        float clearanceFade=(1.0-smoothstep(.82,1.0,clearanceDistance))*summonFade*step(.6,summonWorld.y);
        float viewClearance=0.0;
        if(cinematicViewFade>0.0){
          vec3 viewDirection=cinematicViewTarget-cinematicViewOrigin;
          float viewT=clamp(dot(summonWorld-cinematicViewOrigin,viewDirection)/max(.01,dot(viewDirection,viewDirection)),0.0,1.0);
          float viewDistance=length(summonWorld-cinematicViewOrigin-viewDirection*viewT);
          viewClearance=(1.0-smoothstep(25.0,34.0,viewDistance))*cinematicViewFade*step(.6,summonWorld.y);
        }
        clearanceFade=max(clearanceFade,viewClearance);
        float clearanceDither=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
        if(clearanceFade>clearanceDither)discard;`);
    };
    material.customProgramCacheKey=()=>key+'-summon-clearance';
  }
}
