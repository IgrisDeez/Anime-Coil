import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { MAPS, loadMap, saveMap, type MapStorage, type MapId } from "../src/maps.ts";
import { buildEnvironment } from "../src/environments.ts";
import { RADIUS } from "../src/simulation.ts";

test("one arena with Shibuya as the initial and invalid-value fallback", () => {
  assert.equal(MAPS.length, 1);
  assert.equal(new Set(MAPS.map((m) => m.id)).size, 1);
  assert.equal(loadMap(), "shibuya");
  assert.equal(loadMap({ getItem: () => "old-map", setItem() {} }), "shibuya");
});
test('retired and invalid saved maps migrate only the map preference', () => {
  for (const saved of ['leaf', 'tournament', 'harbor', 'invalid', 'shibuya', null]) {
    const writes: [string, string][] = [];
    const storage = { getItem: () => saved, setItem: (key: string, value: string) => writes.push([key, value]) };
    assert.equal(loadMap(storage), 'shibuya');
    assert.deepEqual(writes, saved && saved !== 'shibuya' ? [['anime-coil-map', 'shibuya']] : []);
  }
  assert.equal(loadMap({ getItem: () => 'leaf', setItem() { throw Error('write blocked'); } }), 'shibuya');
});
test('environment creation rejects retired and invalid runtime IDs', () => {
  for (const id of ['leaf', 'tournament', 'harbor', 'invalid'])
    assert.throws(() => buildEnvironment(id as MapId), /Unsupported arena/);
});
test("each map preference roundtrips; unavailable storage does not block play", () => {
  let value: string | null = null;
  const storage: MapStorage = {
    getItem: () => value,
    setItem: (_key, v) => {
      value = v;
    },
  };
  for (const m of MAPS) {
    saveMap(m.id, storage);
    assert.equal(loadMap(storage), m.id);
  }
  const denied: MapStorage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.equal(loadMap(denied), "shibuya");
  assert.doesNotThrow(() => saveMap("shibuya", denied));
});
for (const def of MAPS) {
  test(`${def.name}: all landmarks stay outside the playable disk`, () => {
    const env = buildEnvironment(def.id);
    assert.ok(env.landmarks.length > 0);
    env.group.updateMatrixWorld(true);
    for (const landmark of env.landmarks) {
      const box = new THREE.Box3().setFromObject(landmark);
      const x = Math.max(box.min.x, Math.min(0, box.max.x)),
        z = Math.max(box.min.z, Math.min(0, box.max.z));
      assert.ok(
        Math.hypot(x, z) > RADIUS + 5,
        `${def.id} landmark intrudes into arena`,
      );
    }
    env.dispose();
  });
  test(`${def.name}: switching away disposes every owned mesh resource exactly once`, () => {
    const env = buildEnvironment(def.id),
      resources = new Set<THREE.BufferGeometry | THREE.Material>();
    env.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        resources.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          resources.add(m);
      }
    });
    const disposed = new Map<object, number>();
    for (const resource of resources)
      resource.addEventListener("dispose", () =>
        disposed.set(resource, (disposed.get(resource) ?? 0) + 1),
      );
    env.dispose();
    env.dispose();
    assert.equal(env.group.children.length, 0);
    for (const resource of resources) assert.equal(disposed.get(resource), 1);
  });
}
