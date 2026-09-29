import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpiritCinematic, spiritEffectCounts, spiritOrbHeight } from '../src/spirit.ts';
import { Arena } from '../src/simulation.ts';

test('Spirit Bomb uses one seamless procedural orb and two tapered charge ribbons', () => {
  const scene = new THREE.Scene();
  new SpiritCinematic(scene);
  const patches: THREE.InstancedMesh[] = [];
  const ribbons: THREE.Mesh[] = [];
  scene.traverse(object => {
    if (object instanceof THREE.InstancedMesh && object.count === 12) patches.push(object);
    if (object instanceof THREE.Mesh && object.name === 'spirit-gather-ribbon') ribbons.push(object);
  });
  assert.equal(patches.length, 0, 'patchy overlay spheres are removed');
  const shells: THREE.Mesh[] = [];
  scene.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) shells.push(object); });
  assert.equal(shells.length, 1);
  assert.equal(ribbons.length, 2);
  assert.equal(ribbons[0].geometry.getAttribute('position').count, 5 * 32 * 2);
  assert.equal(ribbons[0].geometry.index!.count, 5 * 31 * 6);
});

test('mobile Spirit Bomb preserves each stage with fewer secondary instances', () => {
  assert.deepEqual(spiritEffectCounts('desktop'), { clouds: 36, petals: 48, motes: 100, ribbonsPerColor: 5, rays: 32 });
  assert.deepEqual(spiritEffectCounts('mobile'), { clouds: 24, petals: 24, motes: 60, ribbonsPerColor: 3, rays: 20 });
});

test('Spirit Bomb charges over its caster and travels toward the captured impact', () => {
  const scene = new THREE.Scene();
  const effect = new SpiritCinematic(scene);
  const arena = new Arena('nova', () => .5, 0, 0);
  const camera = new THREE.PerspectiveCamera(43, 16 / 9, .1, 600);
  arena.player.x = 70;
  arena.player.z = 10;
  const impact = { x: 40, z: 30 };
  let shell: THREE.Mesh | undefined;
  let ribbon: THREE.Mesh | undefined;
  scene.traverse(object => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) shell = object;
    if (object instanceof THREE.Mesh && object.name === 'spirit-gather-ribbon') ribbon = object;
  });
  assert.ok(shell);
  assert.ok(ribbon);
  for (const [time, progress] of [[.5, 0], [2.4, 0], [2.9, .25], [3.3, .81]]) {
    arena.cinematic = { kind: 'spirit', time, detonated: false, impact };
    camera.position.set(0, 48, 27);
    camera.lookAt(0, 0, 0);
    effect.update(arena, camera, false);
    assert.ok(Math.abs(shell.parent!.position.x - (70 - 30 * progress)) < .001);
    assert.ok(Math.abs(shell.parent!.position.z - (10 + 20 * progress)) < .001);
    if (time < 2.4) {
      const ribbonEnd = ribbon.geometry.getAttribute('position') as THREE.BufferAttribute;
      assert.ok(Math.abs(ribbonEnd.getY(63) - shell.parent!.position.y) < .001);
    }
  }
});

test('Spirit Bomb stays above the ground until its captured impact', () => {
  const radius = 19.2;
  for (const flight of [0, .25, .5, .75, .95, 1]) {
    const bottom = spiritOrbHeight(1, flight, radius) - radius;
    assert.ok(bottom >= .28 - 1e-9, `flight ${flight} bottoms at ${bottom}`);
  }
  assert.ok(spiritOrbHeight(1, 0, radius) > spiritOrbHeight(1, 1, radius) + 15);
});

test('Spirit Bomb releases pooled render resources only once', () => {
  const scene = new THREE.Scene();
  const effect = new SpiritCinematic(scene);
  assert.equal(scene.children.length, 1);
  effect.dispose();
  effect.dispose();
  assert.equal(scene.children.length, 0);
});
