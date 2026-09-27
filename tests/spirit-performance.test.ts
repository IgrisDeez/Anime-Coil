import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpiritCinematic, spiritEffectCounts } from '../src/spirit.ts';

test('Spirit Bomb uses one flowing procedural orb and two batched charge ribbons', () => {
  const scene = new THREE.Scene();
  new SpiritCinematic(scene);
  const patches: THREE.InstancedMesh[] = [];
  const ribbons: THREE.LineSegments[] = [];
  scene.traverse(object => {
    if (object instanceof THREE.InstancedMesh && object.count === 12) patches.push(object);
    if (object instanceof THREE.LineSegments && object.geometry.getAttribute('position').count === 5 * 31 * 2) ribbons.push(object);
  });
  assert.equal(patches.length, 0, 'patchy overlay spheres are removed');
  const shells: THREE.Mesh[] = [];
  scene.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) shells.push(object); });
  assert.equal(shells.length, 1);
  assert.equal(ribbons.length, 2);
  assert.equal(ribbons[0].geometry.getAttribute('position').count, 5 * 31 * 2);
});

test('mobile Spirit Bomb preserves each stage with fewer secondary instances', () => {
  assert.deepEqual(spiritEffectCounts('desktop'), { clouds: 36, petals: 48, motes: 100, ribbonsPerColor: 5, rays: 32 });
  assert.deepEqual(spiritEffectCounts('mobile'), { clouds: 24, petals: 24, motes: 60, ribbonsPerColor: 3, rays: 20 });
});
