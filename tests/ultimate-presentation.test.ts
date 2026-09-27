import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena, NUKE_BLAST, NUKE_DURATION } from '../src/simulation.ts';
import { PurpleCinematic } from '../src/purple.ts';
import { SpiritCinematic } from '../src/spirit.ts';
import { UltimateCueTracker, ultimateFrame } from '../src/ultimate-presentation.ts';

test('each cinematic has its own staged timeline and an identical gameplay impact time', () => {
  assert.equal(ultimateFrame('purple', 1.19).stage, 'charge');
  assert.equal(ultimateFrame('purple', 1.2).stage, 'merge');
  assert.equal(ultimateFrame('purple', 2.5).stage, 'compression');
  assert.equal(ultimateFrame('spirit', 2.4).stage, 'throw');
  for (const kind of ['purple', 'spirit'] as const) {
    assert.equal(ultimateFrame(kind, NUKE_BLAST).stage, 'impact');
    assert.equal(ultimateFrame(kind, NUKE_DURATION).cameraWeight, 0);
    assert.equal(ultimateFrame(kind, NUKE_BLAST - .01).flash, 0);
    assert.ok(ultimateFrame(kind, NUKE_BLAST).flash > 0);
    assert.equal(ultimateFrame(kind, NUKE_BLAST, true).flash, 0);
    assert.equal(ultimateFrame(kind, 1, true).cameraWeight, 0);
    assert.equal(ultimateFrame(kind, 1, true).bars, 0);
  }
});

test('one-shot cues survive repeated and paused frames without replaying', () => {
  const tracker = new UltimateCueTracker();
  assert.deepEqual(tracker.consume('purple', 0), []);
  assert.deepEqual(tracker.consume('purple', 1.2), ['converge']);
  assert.deepEqual(tracker.consume('purple', 1.2), []);
  assert.deepEqual(tracker.consume('purple', 2.5), ['compress']);
  assert.deepEqual(tracker.consume(undefined), []);
  assert.deepEqual(tracker.consume('spirit', 2.41), ['throw']);
  assert.deepEqual(tracker.consume('spirit', 2.41), []);
  tracker.reset();
  assert.deepEqual(tracker.consume('spirit', 0), []);
  assert.deepEqual(tracker.consume('spirit', 2.4), ['throw']);
});

test('both pooled effects stay within profile draw budgets and restore the gameplay camera', () => {
  for (const profile of ['desktop', 'mobile'] as const) for (const kind of ['purple', 'spirit'] as const) {
    const scene = new THREE.Scene();
    const effect = kind === 'purple' ? new PurpleCinematic(scene, profile) : new SpiritCinematic(scene, profile);
    const arena = new Arena(kind === 'purple' ? 'eclipse' : 'nova', () => .5, 0, 0);
    const camera = new THREE.PerspectiveCamera(43, profile === 'mobile' ? 390 / 844 : 16 / 9, .1, 600);
    for (const time of [1, 2.6, 3.5, 5.2, NUKE_DURATION]) {
      arena.cinematic = { kind, time, detonated: time >= NUKE_BLAST, impact: { x: 22, z: 0 } };
      camera.position.set(0, 48, 27); camera.lookAt(0, 0, 0);
      effect.update(arena, camera, false);
      const draws: THREE.Object3D[] = [];
      scene.traverse(object => {
        if (object.visible && (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments)) {
          let parent = object.parent;
          while (parent) { if (!parent.visible) return; parent = parent.parent; }
          draws.push(object);
        }
      });
      assert.ok(draws.length <= (profile === 'mobile' ? 16 : 24), `${kind}/${profile}/${time}: ${draws.length} objects`);
      if (time === NUKE_DURATION) assert.ok(camera.position.distanceTo(new THREE.Vector3(0, 48, 27)) < .001);
    }
    camera.position.set(0, 48, 27); camera.lookAt(0, 0, 0);
    effect.update(arena, camera, true);
    assert.ok(scene.children.every(object => !object.visible));
  }
});

test('Spirit Bomb grows into the early camera frame before reaching throwing height', () => {
  const scene = new THREE.Scene(), effect = new SpiritCinematic(scene);
  const arena = new Arena('nova', () => .5, 0, 0);
  const camera = new THREE.PerspectiveCamera(43, 16/9, .1, 600);
  const heights: number[] = [];
  for (const time of [.1, 1.2, 2.4]) {
    arena.cinematic = {kind:'spirit',time,detonated:false,impact:{x:22,z:0}};
    camera.position.set(0,48,27); camera.lookAt(0,0,0);
    effect.update(arena,camera,false);
    let shell: THREE.Mesh | undefined;
    scene.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) shell=object; });
    assert.ok(shell);
    heights.push(shell.parent!.position.y);
  }
  assert.ok(heights[0] < heights[1] && heights[1] < heights[2]);
  assert.ok(heights[0] < 13 && heights[2] >= 27);
});
