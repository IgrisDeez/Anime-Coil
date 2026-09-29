import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena, NUKE_BLAST, NUKE_DURATION } from '../src/simulation.ts';
import { PurpleCinematic } from '../src/purple.ts';
import { SpiritCinematic } from '../src/spirit.ts';
import { cinematicImpactAnchor, FoxImpactPresentation, PurpleImpactPresentation, SkybreakerImpactPresentation, SpiritImpactPresentation, UltimateCueTracker, ultimateFrame } from '../src/ultimate-presentation.ts';
import { ui } from '../src/ui.ts';

test('impact artwork follows each renderer focal point rather than damage coverage', () => {
  const out={x:0,y:0,z:0}, player={x:-12,z:7}, impact={x:32,z:-5};
  cinematicImpactAnchor('purple',impact,player,out);
  assert.deepEqual(out,{x:-12,y:5,z:7},'Purple rupture is centered on Shiro');
  cinematicImpactAnchor('skybreaker',impact,player,out);
  assert.deepEqual(out,{x:32,y:0,z:-5},'Skybreaker ground dent is centered on the impact');
  for(const kind of ['spirit','fox'] as const){
    cinematicImpactAnchor(kind,impact,player,out);
    assert.deepEqual(out,{x:32,y:1.5,z:-5},`${kind} retains its established anchor`);
  }
});

test('Purple and Skybreaker use distinct latched graphic frames and reset after recovery', () => {
  for (const [kind, impact] of [
    ['purple', new PurpleImpactPresentation()],
    ['skybreaker', new SkybreakerImpactPresentation()],
  ] as const) {
    assert.equal(impact.update(kind, 3.38, false, true).phase, 'none');
    assert.equal(impact.update(kind, 3.58, false, true).phase, 'keyframe', 'a slow render still shows the keyframe');
    assert.equal(impact.update(kind, 3.59, false, true).phase, 'monochrome');
    assert.equal(impact.update(kind, 3.8, false, true).phase, 'restore');
    const after = impact.update(kind, 4.05, false, true);
    assert.equal(after.phase, 'residual');
    assert.equal(after.grayscale, 0);
    assert.equal(impact.update(undefined, 0, false, true).phase, 'none');
    assert.equal(impact.update(kind, 3.4, false, true).phase, 'keyframe');
  }
  assert.match(ui, /purple-impact-art/);
  assert.match(ui, /skybreaker-impact-art/);
  assert.match(ui, /purple-ink-cavity/);
  assert.match(ui, /skybreaker-ink-fist/);
});

test('new impact frames hold on pause, reduce safely, and never cross between attacks', () => {
  const purple = new PurpleImpactPresentation(), skybreaker = new SkybreakerImpactPresentation();
  assert.equal(purple.update('purple', 3.4, false, false).phase, 'keyframe');
  assert.equal(purple.update('purple', 3.4, false, false).phase, 'keyframe');
  assert.equal(purple.update('purple', 3.4, false, true).phase, 'keyframe');
  assert.equal(purple.update('skybreaker', 3.4, false, true).phase, 'none');
  assert.equal(skybreaker.update('skybreaker', 3.4, false, true).phase, 'keyframe');
  skybreaker.reset();
  const reduced = skybreaker.update('skybreaker', 3.4, true, true);
  assert.equal(reduced.phase, 'monochrome');
  assert.ok(reduced.grayscale < 1);
  assert.equal(skybreaker.update('spirit', 3.4, false, true).phase, 'none');
});

test('fox impact uses a latched keyframe, short monochrome hold, and complete color reset', () => {
  const fox = new FoxImpactPresentation();
  assert.equal(fox.update('fox', 3.38, false, true).phase, 'none');
  assert.equal(fox.update('fox', 3.53, false, true).phase, 'keyframe', 'slow frame cannot skip impact');
  assert.equal(fox.update('fox', 3.54, false, true).phase, 'monochrome');
  assert.equal(fox.update('fox', 3.67, false, true).phase, 'restore');
  const residual = fox.update('fox', 4.02, false, true);
  assert.equal(residual.phase, 'residual');
  assert.equal(residual.grayscale, 0);
  assert.equal(residual.contrast, 1);
  assert.equal(fox.update(undefined, 0, false, true).phase, 'none');
  assert.equal(fox.update('fox', 3.4, false, true).phase, 'keyframe');
});

test('fox impact freezes while paused, simplifies under reduced motion, and cannot affect Spirit Bomb', () => {
  const fox = new FoxImpactPresentation();
  assert.equal(fox.update('fox', 3.4, false, false).phase, 'keyframe');
  assert.equal(fox.update('fox', 3.4, false, false).phase, 'keyframe');
  assert.equal(fox.update('fox', 3.4, false, true).phase, 'keyframe');
  assert.equal(fox.update('fox', 3.42, false, true).phase, 'keyframe');
  assert.equal(fox.update('fox', 3.45, false, true).phase, 'monochrome');
  fox.reset();
  assert.equal(fox.update('fox', 3.4, true, true).phase, 'monochrome');
  assert.equal(fox.update('spirit', 3.4, false, true).phase, 'none');
});

test('Spirit impact keyframe survives a low-FPS step and then enters monochrome aftermath', () => {
  const impact = new SpiritImpactPresentation();
  assert.equal(impact.update('spirit', 3.38, false, true).phase, 'none');
  assert.equal(impact.update('spirit', 3.52, false, true).phase, 'keyframe');
  assert.equal(impact.update('spirit', 3.53, false, true).phase, 'monochrome');
  assert.equal(impact.update('spirit', 3.72, false, true).phase, 'restore');
  assert.equal(impact.update('spirit', 4.08, false, true).phase, 'residual');
  assert.equal(impact.update(undefined, 0, false, true).phase, 'none');
  assert.equal(impact.update('spirit', 3.4, false, true).phase, 'keyframe');
});

test('Spirit keyframe holds during pause and reduced motion skips the impact drawing', () => {
  const impact = new SpiritImpactPresentation();
  assert.equal(impact.update('spirit', 3.4, false, false).phase, 'keyframe');
  assert.equal(impact.update('spirit', 3.4, false, false).phase, 'keyframe');
  assert.equal(impact.update('spirit', 3.4, false, true).phase, 'keyframe');
  assert.equal(impact.update('spirit', 3.42, false, true).phase, 'keyframe');
  assert.equal(impact.update('spirit', 3.44, false, true).phase, 'monochrome');
  impact.reset();
  const reduced = impact.update('spirit', 3.4, true, true);
  assert.equal(reduced.phase, 'monochrome');
  assert.notEqual(reduced.phase, 'keyframe');
  assert.ok(reduced.grayscale < 1);
});

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

test('Hollow Purple rupture expands across the arena, then clears its pooled layers', () => {
  for (const profile of ['desktop', 'mobile'] as const) {
    const scene = new THREE.Scene(), effect = new PurpleCinematic(scene, profile);
    const arena = new Arena('eclipse', () => .5, 0, 0);
    const camera = new THREE.PerspectiveCamera(43, 16 / 9, .1, 600);
    const scars = effect.group.getObjectByName('purple-ground-fractures') as THREE.InstancedMesh;
    const corona = effect.group.getObjectByName('purple-impact-corona') as THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
    assert.ok(scars && corona);
    assert.equal(scars.geometry.getAttribute('color').count, scars.geometry.getAttribute('position').count);
    const sizes: number[] = [];
    for (const time of [3.4, 4.25, 5.6]) {
      arena.cinematic = {kind:'purple', time, detonated:time>=NUKE_BLAST, impact:{x:0,z:0}};
      camera.position.set(0,48,27); camera.lookAt(0,0,0);
      effect.update(arena,camera,false);
      assert.equal(scars.visible,time < 5.6);
      assert.equal(corona.visible,time < 5.6);
      sizes.push(corona.scale.x);
      assert.equal(scars.count, profile === 'mobile' ? 16 : 28);
    }
    assert.ok(sizes[1] > sizes[0] * 5, 'impact corona becomes arena-scale');
    assert.equal(corona.material.uniforms.alpha.value,0);
    assert.equal((scars.material as THREE.MeshBasicMaterial).opacity,0);
    effect.update(arena,camera,false,true);
    assert.equal(scars.count,8);
    assert.equal(corona.material.uniforms.time.value,0);
    assert.equal(effect.group.children.filter(child => child instanceof THREE.LineSegments && child.visible).length,0);
    effect.update(undefined,camera,true);
    assert.equal(effect.group.visible,false);
  }
});
