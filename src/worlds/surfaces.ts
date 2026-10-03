import * as THREE from "three";
import type { DetailProfile } from "./types";

export const SURFACES = ['asphalt', 'plaster', 'wood', 'roof', 'stone', 'sand', 'fabric', 'grass', 'rock', 'wetAsphalt', 'facade'] as const;
export type SurfaceKind = typeof SURFACES[number];
export const SURFACE_SCALE: Record<SurfaceKind, number> = { asphalt: 5, plaster: 6, wood: 4, roof: 5, stone: 12, sand: 5, fabric: 3, grass: 7, rock: 28, wetAsphalt: 9, facade: 8 };
/** Periodic, neutral modulation: base instance colors remain the art direction. */
export function surfacePixels(kind: SurfaceKind, size: number) {
  const data = new Uint8Array(size * size * 4);
  let seed = 713 + SURFACES.indexOf(kind) * 997;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, n = noise();
    let value = .96 + (n - .5) * .06;
    if (kind === 'asphalt') value = .955 + (n - .5) * .10;
    if (kind === 'wetAsphalt') value = .94 + (n-.5)*.06 + Math.sin(u*Math.PI*4)*Math.cos(v*Math.PI*6)*.025;
    if (kind === 'facade') value = .97 - ((u*4)%1<.018 || (v*4)%1<.018 ? .10 : 0) + (n-.5)*.035;
    if (kind === 'plaster') value = .965 + Math.sin(u * Math.PI * 8) * Math.sin(v * Math.PI * 6) * .026 + (n - .5) * .04;
    if (kind === 'wood') value = .95 + Math.sin(v * Math.PI * 30 + Math.sin(u * Math.PI * 4) * .6) * .04 - ((v * 4) % 1 < .022 ? .14 : 0) + (n-.5)*.025;
    if (kind === 'roof') value = .96 - ((v * 4) % 1 < .045 || ((u * 4 + Math.floor(v * 4) * .5) % 1) < .025 ? .16 : 0) + Math.sin(v * Math.PI * 8) * .025;
    if (kind === 'stone') {
      const row = Math.floor(v * 4), shifted = (u * 4 + (row % 2) * .5) % 1;
      const grout = (shifted < .018 || (v * 4) % 1 < .018) ? .17 : 0;
      value = .97 - grout + (n - .5) * .04;
    }
    if (kind === 'sand') value = .97 + Math.sin(u * Math.PI * 6 + Math.sin(v * Math.PI * 2)) * .018 + (n - .5) * .07;
    if (kind === 'fabric') value = .98 - ((x % 4 === 0 || y % 4 === 0) ? .035 : 0);
    if (kind === 'grass') value = .95 + Math.sin(u * Math.PI * 4) * Math.cos(v * Math.PI * 6) * .035 + (n - .5) * .075 - (((x * 17 + y * 31) % 127) < 3 ? .08 : 0);
    if (kind === 'rock') value = .95 + Math.sin(u * Math.PI * 6 + Math.sin(v * Math.PI * 4)) * .05 - (v % .25 < .025 ? .095 : 0) + (n-.5)*.025;
    const i = (y * size + x) * 4, c = Math.round(Math.min(1, Math.max(.7, value)) * 255);
    data[i] = data[i + 1] = data[i + 2] = c; data[i + 3] = 255;
  }
  return data;
}
export function createSurfaceTexture(kind: SurfaceKind, profile: DetailProfile, generate = surfacePixels): THREE.DataTexture | undefined {
  try {
    const size = profile === 'mobile' ? 128 : 256;
    const texture = new THREE.DataTexture(generate(kind, size), size, size);
    texture.name = `world-${kind}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    return texture;
  } catch { return undefined; }
}
/** Object-space metre mapping survives batching, scaled props and ship animation. */
export function finishSurface(material: THREE.MeshToonMaterial | THREE.MeshBasicMaterial, kind: SurfaceKind, wind?: {value:number}, strength?: {value:number}, cartoon?: {center: THREE.Vector2; time:{value:number}; intensity:{value:number}}) {
  const ground = ['asphalt','wetAsphalt','grass','stone','sand'].includes(kind);
  material.name = `surface-${kind}`;
  material.customProgramCacheKey = () => `world-surface-${kind}`;
  material.onBeforeCompile = shader => {
    if (kind === 'fabric' && wind && strength) { shader.uniforms.surfaceWind=wind;shader.uniforms.surfaceWindStrength=strength; }
    if (ground && cartoon) { shader.uniforms.cartoonCenter={value:cartoon.center};shader.uniforms.cartoonTime=cartoon.time;shader.uniforms.cartoonIntensity=cartoon.intensity; }
    shader.vertexShader = 'uniform float surfaceWind; uniform float surfaceWindStrength; varying vec3 surfacePosition; varying vec3 surfaceNormal; varying vec3 surfaceWorldPos;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 surfacePoint = vec4(position, 1.0);
      surfaceNormal = normal;
      #ifdef USE_INSTANCING
        surfacePoint = instanceMatrix * surfacePoint;
        // Inverse scale before rotation preserves the dominant face on stretched props.
        mat3 surfaceMatrix = mat3(instanceMatrix);
        vec3 lengths = vec3(dot(surfaceMatrix[0],surfaceMatrix[0]),dot(surfaceMatrix[1],surfaceMatrix[1]),dot(surfaceMatrix[2],surfaceMatrix[2]));
        surfaceNormal = surfaceMatrix * (normal / max(lengths, vec3(.000001)));
      #endif
      surfacePosition = surfacePoint.xyz;
      surfaceWorldPos = (modelMatrix * surfacePoint).xyz;
      ${kind === 'fabric' && wind && strength ? 'transformed.z += sin(surfaceWind * .7 + position.y * .3) * surfaceWindStrength * .08;' : ''}`);
    shader.fragmentShader = `${ground && cartoon ? 'uniform vec2 cartoonCenter; uniform float cartoonTime; uniform float cartoonIntensity;' : ''} varying vec3 surfacePosition; varying vec3 surfaceNormal; varying vec3 surfaceWorldPos;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec3 face = abs(normalize(surfaceNormal));
        vec2 surfaceUV = face.y >= face.x && face.y >= face.z ? surfacePosition.xz : (face.x > face.z ? surfacePosition.zy : surfacePosition.xy);
        ${ground && cartoon ? `float cartoonDistance = length(surfaceWorldPos.xz-cartoonCenter);
        float cartoonFalloff = 1.0-smoothstep(20.0,24.0,cartoonDistance);
        float cartoonRipple = cartoonIntensity*cartoonFalloff;
        if(cartoonRipple>0.0)surfaceUV += cartoonRipple * vec2(sin(cartoonDistance*.65-cartoonTime*2.0+surfaceWorldPos.z*.17),cos(cartoonDistance*.6-cartoonTime*1.7+surfaceWorldPos.x*.13))*.23;` : ''}
        diffuseColor *= texture2D(map, surfaceUV / ${SURFACE_SCALE[kind].toFixed(1)});
        ${ground && cartoon ? 'diffuseColor.rgb *= 1.0 + cartoonRipple*.06;' : ''}
      #endif`);
  };
}
