import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena, CHARACTERS, KI_RADIUS } from '../src/simulation.ts';
import { SkillEffects } from '../src/skill-effects.ts';
import { TransformationEffects } from '../src/transformation-effects.ts';
import { headClearance, renderAnchor } from '../src/vfx-anchors.ts';
import { impactStarGeometry, ruptureSheetGeometry, spectralFistGeometry, spiritTailGeometry, taperedSlashGeometry } from '../src/vfx-geometry.ts';

test('custom anime VFX geometry is finite, shaped, and cached at construction', () => {
  for (const geometry of [spiritTailGeometry(), spectralFistGeometry('desktop'), taperedSlashGeometry(), impactStarGeometry(), ruptureSheetGeometry()]) {
    const attr = geometry.getAttribute('position');
    assert.ok(attr.count >= 3);
    for (const value of attr.array) assert.ok(Number.isFinite(value));
    geometry.dispose();
  }
  for (const character of CHARACTERS) {
    const small = headClearance(character.id, 1), large = headClearance(character.id, 3);
    assert.ok(small >= 1.2 && large <= 2.25);
  }
});

test('all E skills stay in six shared draws and follow the displayed head anchor', () => {
  for (const character of CHARACTERS) {
    const arena = new Arena(character.id, () => .5, 0, 0);
    const effects = new SkillEffects();
    effects.seed(arena);
    arena.activate(arena.player);
    effects.ingest(arena.events);
    const anchor = renderAnchor(character.id, 8, 2, -6, .4, 1.4);
    effects.update(arena, .2, .016, false, undefined, 'shibuya', new Map([[0,anchor]]));
    const meshes = effects.group.children as THREE.InstancedMesh[];
    assert.equal(meshes.length, 6);
    assert.ok(meshes.every(mesh => mesh.count <= mesh.instanceMatrix.count));
    if (character.id === 'nova') {
      const core = meshes[0], matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
      core.getMatrixAt(0,matrix); pos.setFromMatrixPosition(matrix);
      assert.ok(pos.distanceTo(new THREE.Vector3(8+Math.cos(.4)*2.1,2,-6+Math.sin(.4)*2.1)) < 2);
    }
    const matrices = meshes.map(mesh => Array.from(mesh.instanceMatrix.array));
    effects.update(arena,.2,0,false,undefined,'shibuya',new Map([[0,anchor]]));
    assert.deepEqual(meshes.map(mesh => Array.from(mesh.instanceMatrix.array)), matrices);
    effects.clear(); assert.ok(meshes.every(mesh => mesh.count === 0));
    effects.dispose();
  }
});

test('Ki Cannon visual core keeps authoritative radius with a separate decorative wake', () => {
  const arena = new Arena('nova', () => .5, 0, 0), effects = new SkillEffects();
  effects.seed(arena);
  arena.projectiles.push({id:1,ownerId:0,x:5,z:3,previous:{x:4,z:3},direction:0,remaining:10,radius:KI_RADIUS});
  effects.update(arena,0,0,true);
  const core = effects.group.children[0] as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
  core.getMatrixAt(0,matrix); matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);
  assert.ok(Math.abs(scale.x-KI_RADIUS)<1e-6);
  effects.dispose();
});

test('form silhouettes use rendered anchors, remain bounded on both profiles, and dispose once', () => {
  for (const profile of ['desktop','mobile'] as const) for (const character of ['ember','cloud'] as const) {
    const arena = new Arena(character, () => .5, 0, 0), effect = new TransformationEffects(profile);
    arena.activateNuke(arena.player);
    const anchor = renderAnchor(character, 12, 2, -7, .3, 2);
    effect.update(arena,.2,false,new Map([[0,anchor]]));
    const meshes = effect.group.children.filter(obj => obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments);
    assert.ok(meshes.length <= (profile === 'mobile' ? 16 : 24));
    const instances = meshes.filter(obj => obj instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
    assert.ok(instances.every(mesh => mesh.count <= mesh.instanceMatrix.count));
    const main = instances[character === 'ember' ? 0 : 2], matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
    main.getMatrixAt(0,matrix); pos.setFromMatrixPosition(matrix);
    assert.ok(pos.distanceTo(new THREE.Vector3(anchor.x,anchor.y,anchor.z)) < 5);
    effect.update(arena,.2,true,new Map([[0,anchor]]));
    effect.clear(); assert.ok(instances.every(mesh => mesh.count === 0));
    let disposals = 0;
    for (const resource of [instances[0].geometry,instances[0].material as THREE.Material]) resource.addEventListener('dispose',()=>disposals++);
    effect.dispose(); effect.dispose(); assert.equal(disposals,2);
  }
});
