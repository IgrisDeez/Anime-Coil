import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CHARACTERS } from "../src/simulation.ts";
import { createHead, createHeadOutline } from "../src/models.ts";
import { MAPS } from "../src/maps.ts";
import { buildEnvironment } from "../src/environments.ts";

for (const character of CHARACTERS) {
  test(`${character.name} head outline is a shared, finite black silhouette`, () => {
    const head = createHead(character.id);
    const outlineA = createHeadOutline(character.id);
    const outlineB = createHeadOutline(character.id);

    assert.equal(outlineA.geometry, outlineB.geometry);
    assert.equal(outlineA.material, outlineB.material);
    assert.equal((outlineA.material as THREE.MeshBasicMaterial).color.getHexString(), "17151d");
    assert.equal((outlineA.material as THREE.MeshBasicMaterial).side, THREE.BackSide);
    assert.ok(outlineA.geometry.attributes.position.count > 0);
    outlineA.geometry.computeBoundingBox();
    assert.ok(outlineA.geometry.boundingBox!.min.y > 1, "silhouette should frame the hairstyle, not the face");
    for (const value of outlineA.geometry.attributes.position.array)
      assert.ok(Number.isFinite(value));

    let sharedDisposed = 0;
    head.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      part.geometry.addEventListener("dispose", () => sharedDisposed++);
      (part.material as THREE.Material).addEventListener("dispose", () => sharedDisposed++);
    });
    // Renderer-owned clones can be detached without disposing the cached shape.
    outlineA.removeFromParent();
    outlineB.removeFromParent();
    assert.equal(sharedDisposed, 0);
  });
}

test("Shiro blindfold curves across the face and wraps toward both temples", () => {
  const head = createHead("eclipse");
  let band: THREE.Mesh | undefined;
  head.traverse((part) => {
    if (part instanceof THREE.Mesh && part.userData.blindfold) band = part;
  });
  assert.ok(band, "Gojo model should have a dedicated blindfold mesh");
  const positions = band!.geometry.attributes.position;
  let centerDepth = -Infinity, edgeDepth = Infinity;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    if (Math.abs(x) < 0.01) centerDepth = Math.max(centerDepth, z);
    if (Math.abs(x) > 0.9) edgeDepth = Math.min(edgeDepth, z);
  }
  assert.ok(centerDepth > edgeDepth, "the band should follow the curved face instead of being flat");
  assert.ok(positions.count > 300, "the curved band should be smoothly segmented");
});




test("map disposal leaves cached head silhouette geometry and material alive", () => {
  const outline = createHeadOutline("ember");
  let geometryDisposals = 0, materialDisposals = 0;
  outline.geometry.addEventListener("dispose", () => geometryDisposals++);
  (outline.material as THREE.Material).addEventListener("dispose", () => materialDisposals++);
  for (const map of MAPS) buildEnvironment(map.id).dispose();
  assert.equal(geometryDisposals, 0);
  assert.equal(materialDisposals, 0);
  assert.ok(outline.geometry.attributes.position.count > 0);
});
