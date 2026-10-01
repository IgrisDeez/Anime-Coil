import * as THREE from 'three';
import type { MapDefinition } from './maps';
import { RADIUS } from './simulation';

export interface LobbyFrame {
  position: THREE.Vector3;
  target: THREE.Vector3;
  heroPosition: THREE.Vector3;
  environmentScale: number;
}

/** Fit the complete character into the measured showcase, rather than the whole window. */
export function frameLobby(bounds: THREE.Box3, map: MapDefinition, width: number, height: number, screenHeight: number, fov: number, points?: readonly THREE.Vector3[]): LobbyFrame {
  const center = bounds.getCenter(new THREE.Vector3());
  const azimuth = Math.atan2(map.preview.camera[0] - map.preview.focus[0], map.preview.camera[2] - map.preview.focus[2]);
  const elevation = THREE.MathUtils.degToRad(28);
  const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const up = new THREE.Vector3().crossVectors(direction, right);
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tx = tangent * Math.max(1, width) / Math.max(1, screenHeight) * .8;
  const ty = tangent * Math.max(1, height) / Math.max(1, screenHeight) * .7;
  let distance = 0;
  // A small envelope covers the existing blink, selection bounce and idle turn.
  const candidates = points ?? boxCorners(bounds);
  const corner = new THREE.Vector3();
  for (const point of candidates) {
    corner.copy(point).sub(center);
    distance = Math.max(distance, corner.dot(direction) + (Math.abs(corner.dot(right)) + .35) / tx,
      corner.dot(direction) + (Math.abs(corner.dot(up)) + .35) / ty);
  }
  distance *= 1.04;
  // The eye stays inside the arena's unobstructed interior; scenery surrounds it.
  const environmentScale = Math.max(.32, distance * Math.cos(elevation) / (RADIUS * .72));
  const heroPosition = new THREE.Vector3(-center.x, -.45 * environmentScale - bounds.min.y + .04, -center.z);
  const target = center.clone().add(heroPosition);
  return { position: direction.multiplyScalar(distance).add(target), target, heroPosition, environmentScale };
}

function boxCorners(bounds: THREE.Box3) {
  const points: THREE.Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z));
  return points;
}

const geometryPoints = new WeakMap<THREE.BufferGeometry, readonly THREE.Vector3[]>();
function vertices(geometry: THREE.BufferGeometry) {
  const cached = geometryPoints.get(geometry);
  if (cached) return cached;
  const positions = geometry.getAttribute('position'), points: THREE.Vector3[] = [], unique = new Set<string>();
  if (positions) for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), key = `${x},${y},${z}`;
    if (!unique.has(key)) { unique.add(key); points.push(new THREE.Vector3(x,y,z)); }
  }
  geometryPoints.set(geometry, points);
  return points;
}

/** Cache actual vertices once per selection so empty box corners never force a distant camera. */
export function lobbyFitPoints(root: THREE.Group) {
  const points: THREE.Vector3[] = [], instance = new THREE.Matrix4(), transform = new THREE.Matrix4();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const corners = vertices(object.geometry);
    if (object instanceof THREE.InstancedMesh) {
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, instance); transform.multiplyMatrices(object.matrixWorld, instance);
        for (const corner of corners) points.push(corner.clone().applyMatrix4(transform));
      }
    } else for (const corner of corners) points.push(corner.clone().applyMatrix4(object.matrixWorld));
  });
  return points;
}

export function stageLobbyEnvironment(group: THREE.Group, menu: boolean, scale: number) {
  group.scale.setScalar(menu ? scale : 1);
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
}
