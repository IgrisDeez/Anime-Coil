import * as THREE from 'three';
import type { MapDefinition } from './maps';

/** Reuse the map's three lights; apply changes only on map/mode transitions. */
export class LobbyLighting {
  private previous: string | undefined;
  constructor(private ambient: THREE.HemisphereLight, private key: THREE.DirectionalLight, private rim: THREE.DirectionalLight) {}
  invalidate() { this.previous = undefined; }
  apply(map: MapDefinition, menu: boolean): boolean {
    const state = `${map.id}:${menu}`;
    if (state === this.previous) return false;
    this.previous = state;
    this.ambient.color.set(menu ? '#c9d1ff' : map.ambient);
    this.ambient.groundColor.set(map.groundLight);
    this.ambient.intensity = menu ? Math.max(1.6, map.intensity) : map.intensity;
    this.key.color.set(menu ? '#f2edff' : map.sun);
    this.key.intensity = menu ? 2.2 : map.sunIntensity;
    this.key.position.set(...(menu ? [-12, 22, 18] as const : map.sunDirection));
    this.rim.color.set(menu ? '#b6a2ff' : map.accent);
    this.rim.intensity = menu ? 1.5 : map.rimIntensity;
    this.rim.position.set(10, 10, -15);
    return true;
  }
}
