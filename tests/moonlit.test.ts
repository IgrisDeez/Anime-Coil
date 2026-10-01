import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { LobbyLighting } from '../src/lobby-staging';
import { MAPS } from '../src/maps';
import { CHARACTERS } from '../src/simulation';
import { ui } from '../src/ui';
import { frameLobby, lobbyFitPoints, stageLobbyEnvironment } from '../src/lobby-framing';

test('Moonlit is dark from HTML startup and has no saved-theme or switching path', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/moonlit.css', import.meta.url), 'utf8');
  assert.match(html, /<html[^>]*data-theme="dark"/);
  assert.match(html, /name="theme-color" content="#101525"/);
  assert.match(css, /:root, :root\[data-theme\] \{[\s\S]*?color-scheme: dark;/);
  assert.doesNotMatch(css, /color-scheme: light|data-theme=['"]light/);
  assert.doesNotMatch(main, /anime-coil-theme|ui-theme|loadDarkTheme|darkTheme|theme-toggle/);
  assert.doesNotMatch(ui, /theme-toggle|showcase-name|map-preview-name|showcase-caption|preview-label/);
  assert.ok(ui.includes('id="settings-panel-appearance"'));
  assert.ok(ui.includes('data-section="appearance"'));
});

test('lobby framing fits complete character bounds across aspect ratios and keeps the eye inside the arena', () => {
  const sizes = [[1440,900,940,750], [920,668,448,480], [900,480,484,310], [640,390,298,240], [390,844,366,360], [320,640,296,170]];
  for (const map of MAPS) for (const [screenWidth, screenHeight, width, height] of sizes) {
    for (const headHeight of [4.6, 5.8]) {
      const bounds = new THREE.Box3(new THREE.Vector3(-3.4,-.22,-3.4), new THREE.Vector3(9.7,headHeight,8.5));
      const frame = frameLobby(bounds, map, width, height, screenHeight, 55);
      const camera = new THREE.PerspectiveCamera(55, screenWidth / screenHeight, .1, 600);
      camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld();
      for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
        const projected = new THREE.Vector3(x,y,z).add(frame.heroPosition).project(camera);
        assert.ok(Math.abs(projected.x) <= .8 * width / screenWidth);
        assert.ok(Math.abs(projected.y) <= .7 * height / screenHeight);
        assert.ok(projected.z > -1 && projected.z < 1);
      }
      const delta = frame.position.clone().sub(frame.target);
      assert.ok(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(delta.y,Math.hypot(delta.x,delta.z))) - 28) < .00001);
      assert.ok(Math.hypot(frame.position.x,frame.position.z) <= 115 * frame.environmentScale * .721);
      assert.equal(frame.target.x,0); assert.equal(frame.target.z,0);
      assert.ok(Math.abs(bounds.min.y + frame.heroPosition.y + .45 * frame.environmentScale - .04) < .00001);
    }
  }
});

test('lobby ground staging restores map transforms after compact and wide lobby cycles', () => {
  const group = new THREE.Group(), landmark = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  landmark.position.set(100,20,-90); group.add(landmark);
  for (const scale of [.32,.6,1.5,.32]) {
    stageLobbyEnvironment(group,true,scale);
    assert.deepEqual(group.position.toArray(),[0,0,0]);
    assert.deepEqual(group.scale.toArray(),[scale,scale,scale]);
    stageLobbyEnvironment(group,false,scale);
    assert.deepEqual(group.scale.toArray(),[1,1,1]);
    assert.deepEqual(group.rotation.toArray(),[0,0,0,'XYZ']);
    assert.deepEqual(landmark.position.toArray(),[100,20,-90]);
  }
  landmark.geometry.dispose(); (landmark.material as THREE.Material).dispose();
});

test('lobby fit samples transformed active instances without unused capacity inflating the camera', () => {
  const root = new THREE.Group(), mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial(),3);
  mesh.count=1; mesh.position.x=4;
  mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(2,0,3));
  mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(999,999,999));
  root.add(mesh); root.updateMatrixWorld(true);
  const points=lobbyFitPoints(root), box=new THREE.Box3().setFromPoints(points);
  assert.equal(points.length,8);
  assert.deepEqual(box.min.toArray(),[5,-1,2]); assert.deepEqual(box.max.toArray(),[7,1,4]);
  mesh.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
});

test('lobby lighting reuses its lights and restores every map after repeated menu/game transitions', () => {
  const scene = new THREE.Scene(), ambient = new THREE.HemisphereLight(), key = new THREE.DirectionalLight(), rim = new THREE.DirectionalLight();
  scene.add(ambient, key, rim);
  const lighting = new LobbyLighting(ambient, key, rim);
  for (const map of MAPS) {
    lighting.invalidate();
    for (let cycle = 0; cycle < 3; cycle++) {
      assert.equal(lighting.apply(map, true), true);
      assert.equal(rim.color.getHexString(), 'b6a2ff');
      assert.equal(lighting.apply(map, true), false);
      assert.equal(lighting.apply(map, false), true);
      assert.equal(ambient.color.getHexString(), map.ambient.slice(1));
      assert.equal(ambient.groundColor.getHexString(), map.groundLight.slice(1));
      assert.equal(ambient.intensity, map.intensity);
      assert.equal(key.color.getHexString(), map.sun.slice(1));
      assert.equal(key.intensity, map.sunIntensity);
      assert.deepEqual(key.position.toArray(), [...map.sunDirection]);
      assert.equal(rim.color.getHexString(), map.accent.slice(1));
      assert.equal(rim.intensity, map.rimIntensity);
      assert.equal(lighting.apply(map, false), false);
      assert.deepEqual(scene.children, [ambient, key, rim]);
    }
  }
});

test('lobby map changes invalidate staging without a stale same-mode lighting cache', () => {
  const lighting = new LobbyLighting(new THREE.HemisphereLight(), new THREE.DirectionalLight(), new THREE.DirectionalLight());
  assert.equal(lighting.apply(MAPS[0], true), true);
  lighting.invalidate();
  assert.equal(lighting.apply(MAPS[0], true), true);
  assert.equal(lighting.apply(MAPS[0], true), false);
  lighting.invalidate();
  assert.equal(lighting.apply(MAPS[0], true), true);
});

test('Moonlit lobby retains stable selection hooks and unique IDs with named roster entries', () => {
  const ids = [...ui.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CHARACTERS) {
    assert.ok(ui.includes(`data-character="${c.id}"`));
    assert.ok(ui.includes(`class="character-name">${c.name}</span>`));
    assert.ok(ids.includes(`portrait-${c.id}`));
  }
  assert.ok(ids.includes("map-shibuya"));
  assert.ok(ui.includes('aria-label="Arena: Shibuya"'));
  assert.doesNotMatch(ui, /data-map=|Choose your world/);
  for (const id of ['play', 'hero-name', 'menu-ability-key', 'menu-ultimate-key', 'skin-preview-controls', 'lobby-showcase']) assert.ok(ids.includes(id));
});
