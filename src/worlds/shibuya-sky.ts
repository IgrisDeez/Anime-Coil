import * as THREE from 'three';
import type { WorldBuilder } from './builder';
/** One opaque, camera-centred background draw. No fog, textures, lights, or reflection pass. */
export function shibuyaSky(b:WorldBuilder){
  const time={value:0};
  const material=b.material(new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,uniforms:{skyTime:time},
    vertexShader:`varying vec3 direction;void main(){direction=position;vec4 view=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*view;gl_Position.z=gl_Position.w*.9999;}`,
    fragmentShader:`uniform float skyTime;varying vec3 direction;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
      void main(){vec3 d=normalize(direction);float height=max(0.,d.y);vec3 c=mix(vec3(.005,.008,.025),vec3(.001,.002,.008),smoothstep(0.,.8,height));
        float horizon=exp(-abs(d.y)*7.);c+=vec3(.003,.002,.005)*horizon;
        vec3 cloudPoint=d*5.5+vec3(skyTime*.008,0.,skyTime*.004);float cloud=noise(cloudPoint)*.65+noise(cloudPoint*2.3)*.25+noise(cloudPoint*5.)*.1;
        float cover=smoothstep(.38,.72,cloud)*smoothstep(-.08,.32,d.y);c=mix(c,vec3(.008,.011,.027),cover*.8);
        vec3 moonDirection=normalize(vec3(-.48,.38,-.78));float moonDistance=length(d-moonDirection);float moon=(1.-smoothstep(.020,.026,moonDistance))*(1.-cover*.85);c+=vec3(.27,.28,.29)*moon+vec3(.012,.015,.021)*exp(-moonDistance*23.)*(1.-cover);
        vec3 starGrid=floor(d*340.);float star=step(.998,hash(starGrid))*pow(max(0.,1.-length(fract(d*340.)-.5)*2.),6.);c+=vec3(.22,.24,.28)*star*smoothstep(.2,.7,d.y)*(1.-cover);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  material.userData.worldSky=true;
  const mesh=new THREE.Mesh(b.geo(new THREE.SphereGeometry(1,24,12)),material);mesh.name='shibuya-night-sky';mesh.frustumCulled=false;mesh.renderOrder=-1000;
  const root=new THREE.Group();root.name='shibuya-sky-root';root.add(mesh);b.group.add(root);
  // Centre in local coordinates at render time; equally valid for miniature menu worlds.
  const worldCamera=new THREE.Vector3(),worldScale=new THREE.Vector3();mesh.onBeforeRender=(_renderer,_scene,camera)=>{camera.getWorldPosition(worldCamera);mesh.position.copy(worldCamera);root.worldToLocal(mesh.position);root.getWorldScale(worldScale);mesh.scale.set(10/worldScale.x,10/worldScale.y,10/worldScale.z);mesh.updateMatrixWorld(true);};
  b.moving(root,f=>{mesh.visible=f.skyVisible!==false;time.value=f.reducedMotion?0:f.time;},true);
  return {mesh,time};
}
