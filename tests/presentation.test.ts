import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arena, HEAD_RADIUS, RADIUS, STEP, serpentScale, type GameEvent } from '../src/simulation.ts';
import { COMPASS_THEMES, CompassState, SpiritCompass, edgeWarning, projectMarker } from '../src/minimap.ts';
import { BoostMotion, boostKind, boostStatus, HudMotion, MotionPreference, breathing } from '../src/presentation.ts';
import { HudChanges, Leaderboard } from '../src/hud-feedback.ts';
import { LifeReactions } from '../src/life-reactions.ts';
import { VisualClock } from '../src/worlds/types.ts';

const frame = (time = 0, reducedMotion = false, paused = false) => ({ time, dt: paused ? 0 : STEP, reducedMotion, paused });

test('boost and Fox Rush share eased presentation strength without mutating gameplay', () => {
  const arena = new Arena('ember', () => .5, 0, 0), motion = new BoostMotion();
  assert.equal(boostStatus(arena.player), 'unavailable');
  arena.player.mass = 24; assert.equal(boostStatus(arena.player), 'ready');
  arena.player.boosting = true;
  assert.equal(boostStatus(arena.player), 'boosting');
  assert.equal(boostKind(arena.player, true, false), 'normal');
  const normalState = JSON.stringify(arena.player);
  motion.update('normal', .5);
  assert.equal(JSON.stringify(arena.player), normalState);
  assert.ok(motion.fov(false) > 47 && motion.fov(false) < 48);
  assert.ok(motion.fov(true) < 45);
  assert.ok(motion.cameraOffset(true) < motion.cameraOffset(false));
  arena.player.active = 3;
  assert.equal(boostKind(arena.player, true, false), 'fox');
  const foxState = JSON.stringify(arena.player);
  motion.update('fox', .5);
  assert.equal(JSON.stringify(arena.player), foxState);
  assert.ok(motion.fov(false) > 49 && motion.fov(false) <= 50);
  assert.ok(motion.lean(false) > .15);
  assert.equal(motion.lean(true), 0);
  assert.equal(boostKind(arena.player, true, true), 'none');
  assert.equal(boostKind(arena.player, false, false), 'none');
  const held = motion.intensity;
  motion.update('none', 0); assert.equal(motion.intensity, held);
  motion.update('none', 1); assert.ok(motion.intensity < held);
  motion.reset(); assert.equal(motion.fov(false), 43);
  assert.equal(motion.cameraOffset(false), 0);
  arena.player.boosting = false; arena.player.mass = 18;
  assert.equal(boostStatus(arena.player), 'ready'); // Fox Rush is free at minimum mass.
  arena.player.active = 0; assert.equal(boostStatus(arena.player), 'unavailable');
  arena.player.alive = false; assert.equal(boostStatus(arena.player), 'respawning');
});

test('compass themes are distinct and boundary warning uses the growing head safe radius', () => {
  assert.deepEqual(Object.keys(COMPASS_THEMES), ['shibuya', 'leaf', 'tournament', 'harbor']);
  assert.equal(new Set(Object.values(COMPASS_THEMES).map(t => t.inner)).size, 4);
  for (const mass of [18, 400]) {
    const safe = RADIUS - HEAD_RADIUS * serpentScale(mass);
    assert.equal(edgeWarning(safe * .87, 0, mass), 0);
    assert.ok(Math.abs(edgeWarning(0, safe * .94, mass) - .5) < 1e-10);
    assert.equal(edgeWarning(safe * 2, 0, mass), 1);
  }
});

test('compass projects readonly snapshots without prediction or changing gameplay', () => {
  const a = new Arena('ember', () => .5, 0, 0), state = new CompassState();
  state.sync(a, true);
  a.player.previous = { x: 0, z: 0 }; a.player.x = RADIUS; a.player.z = 0;
  a.player.previousAngle = Math.PI - .1; a.player.angle = -Math.PI + .1;
  const before = JSON.stringify(a);
  state.sync(a);
  const p = { x: 0, y: 0, angle: 0 }, m = state.markers.get(0)!;
  projectMarker(m, .5, p); assert.equal(p.x, 171.5); assert.equal(p.y, 120); assert.ok(Math.abs(p.angle - Math.PI) < 1e-8);
  projectMarker(m, 8, p); assert.equal(p.x, 223);
  projectMarker(m, -1, p); assert.equal(p.x, 120);
  assert.equal(JSON.stringify(a), before);
});

test('compass snaps spawns and cinematic transitions, removes deaths, and resets cleanly', () => {
  const a = new Arena('nova', () => .5, 0, 0), state = new CompassState();
  a.player.x = 30; state.sync(a); assert.equal(state.markers.get(0)!.fromX, 30);
  a.activateNuke(a.player); a.player.x = 40; state.sync(a); assert.equal(state.markers.get(0)!.fromX, 40);
  a.cinematic = undefined; a.player.x = 50; state.sync(a); assert.equal(state.markers.get(0)!.fromX, 50);
  a.player.alive = false; state.sync(a); assert.equal(state.markers.size, 0);
  for (let i = 0; i < 40; i++) { state.reset(); state.sync(new Arena('ember', () => .5, 0, 0)); assert.equal(state.markers.size, 1); }
});

function fakeCanvas() {
  let draws = 0;
  const arcs: number[][] = [];
  const context = new Proxy({ drawImage: () => { draws++; }, arc: (...v: number[]) => arcs.push(v), createRadialGradient: () => ({ addColorStop() {} }) }, {
    get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; },
  });
  const canvas = { width: 240, height: 240, getContext: () => context, parentElement: { style: { setProperty() {} } }, ownerDocument: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } };
  return { canvas: canvas as unknown as HTMLCanvasElement, arcs, draws: () => draws };
}

test('compass redraws at no more than 30 Hz, freezes while paused, and handles live reduced motion and map changes', () => {
  const fake = fakeCanvas(), compass = new SpiritCompass(fake.canvas), a = new Arena('ember', () => .5, 0, 0);
  compass.state.sync(a);
  for (let i = 0; i < 144; i++) compass.draw(frame(i / 144), .5);
  assert.ok(fake.draws() <= 31);
  const draws = fake.draws();
  for (let i = 0; i < 10; i++) compass.draw(frame(143 / 144, false, true), 0);
  assert.equal(fake.draws(), draws);
  compass.draw(frame(143 / 144, true, true), 0); assert.equal(fake.draws(), draws + 1);
  assert.equal(fake.arcs.at(-1)![2], 9.5); // Static player halo.
  for (const map of Object.keys(COMPASS_THEMES) as (keyof typeof COMPASS_THEMES)[]) { compass.setMap(map); compass.draw(frame(1, true, true), 0); }
  a.player.alive = false; compass.state.sync(a); compass.draw(frame(1, true, true), 0);
  assert.equal(compass.state.markers.size, 0);
  compass.dispose(); compass.dispose(); assert.equal(compass.state.markers.size, 0);
});

class FakeElement {
  children: FakeElement[] = []; parent?: FakeElement; textContent = ''; className = '';
  ownerDocument = { createElement: () => new FakeElement() };
  animations: { currentTime: number; cancelled: boolean; pause(): void; cancel(): void }[] = [];
  append(...nodes: FakeElement[]) { for (const node of nodes) this.insertBefore(node, null); }
  insertBefore(node: FakeElement, next: FakeElement | null) { node.remove(); const i = next ? this.children.indexOf(next) : this.children.length; this.children.splice(i, 0, node); node.parent = this; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = undefined; }
  animate() { const a = { currentTime: 0, cancelled: false, pause() {}, cancel() { this.cancelled = true; } }; this.animations.push(a); return a; }
  get element() { return this as unknown as HTMLElement; }
}

test('HUD reactions fire once for score increases, rank changes and readiness; pause preserves transitions', () => {
  const changes = new HudChanges();
  assert.deepEqual(changes.update(180, 21, 0, 0, true), { score: false, rank: false, skillReady: false, ultimateReady: false });
  const gain = changes.update(190, 20, 1, 1, true); assert.equal(gain.score, true); assert.equal(gain.rank, true);
  assert.equal(changes.update(180, 20, 0, 0, false).skillReady, false);
  assert.equal(changes.update(180, 20, 0, 0, true).skillReady, true);
  assert.equal(changes.update(180, 20, 0, 0, true).ultimateReady, false);
  changes.reset(); assert.equal(changes.update(1000, 1, 0, 0, true).score, false);
});

test('HUD animation handles follow visual time, coalesce pulses, cancel on reduced motion and clean up', () => {
  const motion = new HudMotion(), node = new FakeElement(), clock = new VisualClock();
  motion.pulse(node.element); motion.pulse(node.element); assert.equal(motion.count, 1);
  clock.advance(.1, false, false); motion.update(frame(clock.time));
  assert.equal(node.animations[0].currentTime, 100);
  clock.advance(.1, true, false); motion.update(frame(clock.time, false, true));
  assert.equal(node.animations[0].currentTime, 100);
  motion.update(frame(clock.time, true)); assert.equal(motion.count, 0); assert.equal(node.animations[0].cancelled, true);
  motion.pulse(node.element); assert.equal(motion.count, 0);
  motion.update(frame(.2)); motion.pulse(node.element); motion.update(frame(1)); assert.equal(motion.count, 0);
  for (let i = 0; i < 40; i++) { motion.pulse(node.element); motion.clear(); assert.equal(motion.count, 0); }
});

test('leaderboard keeps keyed nodes, updates readable names and ranks, and bounds rows and motion handles', () => {
  const root = new FakeElement(), motion = new HudMotion(), board = new Leaderboard(root.element, motion);
  const list = Array.from({ length: 8 }, (_, id) => ({ id, name: `Spirit ${id}`, mass: 40 - id }));
  board.update(list); assert.equal(root.children.length, 5);
  const original = root.children.slice(); board.update(list); assert.deepEqual(root.children, original);
  board.update([list[1], list[0], ...list.slice(2)]);
  assert.equal(root.children[1], original[0]); assert.equal(root.children[1].children[0].textContent, '2');
  assert.equal(root.children[1].children[1].textContent, 'Spirit 0'); assert.equal(root.children[1].className, 'leader-row you');
  for (let i = 0; i < 40; i++) { board.update(list.slice(3)); board.clear(); assert.equal(root.children.length, 0); assert.equal(motion.count, 0); }
});

test('life reactions coalesce pickups, bound spawns and deaths, freeze with dt zero, and suppress ultimate wipes', () => {
  const fx = new LifeReactions(), a = new Arena('ember', () => .5, 0, 0);
  fx.update(a.snakes, 0, false); assert.equal(fx.slots.some(s => s.active), false);
  fx.ingest(Array.from({ length: 500 }, () => ({ type: 'collect', id: 0, x: 0, z: 0 } as GameEvent)));
  assert.equal(fx.slots.filter(s => s.active).length, 1);
  for (let i = 0; i < 20; i++) a.spawnBot(i);
  fx.update(a.snakes, .1, false); assert.equal(fx.slots.filter(s => s.active && s.kind === 'spawn').length, 8);
  const snapshot = JSON.stringify(fx.slots); fx.update(a.snakes, 0, false); assert.equal(JSON.stringify(fx.slots), snapshot);
  fx.ingest([...a.snakes.map(s => ({ type: 'death', id: s.id, x: s.x, z: s.z } as GameEvent)), { type: 'blast', id: 0, x: 0, z: 0 }]);
  assert.equal(fx.slots.some(s => s.active), false);
  fx.ingest([{ type: 'death', id: 1, x: 0, z: 0 }]); fx.update(a.snakes, .1, true); assert.equal(fx.slots.some(s => s.active && s.kind === 'death'), true);
  fx.clear(); fx.ingest([{ type: 'player-respawn', id: 0, x: 2, z: 3 }]);
  assert.equal(fx.slots.some(s => s.active && s.kind === 'spawn' && s.x === 2 && s.z === 3), true);
  for (let i = 0; i < 40; i++) { fx.reset(); fx.update(a.snakes, 0, false); assert.equal(fx.slots.some(s => s.active), false); }
});

test('decorative breathing never exceeds three percent and vanishes when frozen, active, or reduced', () => {
  for (let i = 0; i < 1000; i++) for (const boost of [true, false]) {
    assert.ok(Math.abs(breathing(i * .1, i % 21, boost, false)) <= .03);
    assert.equal(breathing(i * .1, i, boost, true), 0);
  }
});

test('motion preference responds to OS changes and removes its single listener', () => {
  const old = globalThis.matchMedia; let listener: (() => void) | undefined;
  const query = { matches: false, addEventListener: (_: string, fn: () => void) => { listener = fn; }, removeEventListener: (_: string, fn: () => void) => { assert.equal(fn, listener); listener = undefined; } };
  globalThis.matchMedia = (() => query) as unknown as typeof matchMedia;
  try {
    const pref = new MotionPreference(); assert.equal(pref.reduced, false);
    query.matches = true; listener!(); assert.equal(pref.reduced, true);
    query.matches = false; listener!(); assert.equal(pref.reduced, false);
    pref.dispose(); assert.equal(listener, undefined);
  } finally { globalThis.matchMedia = old; }
});
