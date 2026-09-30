import * as THREE from 'three';
import type { Arena } from './simulation';
import type { RenderAnchor } from './vfx-anchors';

/** Presentation snapshot: never feeds positions back into the simulation. */
export class CastSnapshot {
  private shot?: Arena['cinematic'];
  private owner?: Arena;
  readonly position = new THREE.Vector3();
  angle = 0;
  capture(arena: Arena, anchor?: RenderAnchor) {
    if (this.shot !== arena.cinematic || this.owner !== arena) {
      this.shot = arena.cinematic; this.owner = arena;
      this.position.set(anchor?.x ?? arena.player.x, anchor?.y ?? 0, anchor?.z ?? arena.player.z);
      this.angle = arena.player.angle;
    }
  }
  clear() { this.shot = undefined; this.owner = undefined; this.position.set(0,0,0); this.angle = 0; }
}

/** Blend eye and focus, rather than blending a quaternion made from an already blended eye. */
export class CinematicCamera {
  private eye = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private focus = new THREE.Vector3();
  blend(camera: THREE.PerspectiveCamera, target: THREE.Vector3, look: THREE.Vector3, weight: number) {
    if (weight <= 0) return;
    this.eye.copy(camera.position); camera.getWorldDirection(this.direction);
    this.focus.copy(this.eye).addScaledVector(this.direction, -this.eye.y / Math.min(-.001,this.direction.y));
    camera.position.lerpVectors(this.eye,target,weight);
    this.focus.lerp(look,weight); camera.lookAt(this.focus);
  }
  clear() { this.eye.set(0,0,0); this.direction.set(0,0,0); this.focus.set(0,0,0); }
}

/** Fit a cached world bounds box against both axes of the projected viewport. */
export class CinematicFit {
  private back = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private corner = new THREE.Vector3();
  fit(out:THREE.Vector3, camera:THREE.PerspectiveCamera, bounds:THREE.Box3, look:THREE.Vector3, angle:number, elevation:number, minimum:number) {
    this.back.set(Math.cos(angle),elevation,Math.sin(angle)).normalize();
    this.right.set(this.back.z,0,-this.back.x).normalize(); this.up.crossVectors(this.back,this.right).normalize();
    const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),tanX=tanY*camera.aspect;
    let distance=minimum;
    for(let i=0;i<8;i++) {
      this.corner.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).sub(look);
      const depth=this.corner.dot(this.back);
      distance=Math.max(distance,depth+Math.abs(this.corner.dot(this.right))/(tanX*.82),depth+Math.abs(this.corner.dot(this.up))/(tanY*.76));
    }
    out.copy(look).addScaledVector(this.back,distance); out.y=Math.max(out.y,32);
    if(Math.hypot(out.x,out.z)>100)out.y=Math.max(out.y,64);
  }
}

/** Derivative-matched bow: exits forward, then curves around the muzzle on clamped edge casts. */
export function foxFlight(out: THREE.Vector3, tangent: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3, progress: number, radius: number) {
  const reverse = end.z < start.z;
  const lateral = reverse ? 26 : 0, lift = reverse ? 15 : 3;
  out.set(THREE.MathUtils.lerp(start.x,end.x,progress)+Math.sin(Math.PI*progress)*lateral,
    THREE.MathUtils.lerp(start.y,radius+.28,progress)+Math.sin(Math.PI*progress)*lift,
    THREE.MathUtils.lerp(start.z,end.z,progress)+(reverse ? Math.sin(Math.PI*progress)*24 : 0));
  tangent.set(end.x-start.x+Math.cos(Math.PI*progress)*Math.PI*lateral,
    radius+.28-start.y+Math.cos(Math.PI*progress)*Math.PI*lift,
    end.z-start.z+(reverse ? Math.cos(Math.PI*progress)*Math.PI*24 : 0)).normalize();
}
