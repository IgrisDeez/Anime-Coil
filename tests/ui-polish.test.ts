import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HudLifetime, HudMotion, HUD_MODE_LABELS, MATCH_HINT_DURATION, PreviewMotion, previewBlink, UI_ACCENTS } from '../src/presentation.ts';
import { ui } from '../src/ui.ts';
import { createHead } from '../src/models.ts';
import { CHARACTERS } from '../src/simulation.ts';

test('opening hint fades after four active seconds, freezes on pause, and returns on restart', () => {
  const life = new HudLifetime();
  life.start();
  assert.equal(MATCH_HINT_DURATION, 4);
  const frame = { time: 0, dt: .1, paused: false, reducedMotion: false };
  for (let i = 0; i < 35; i++) life.update(frame);
  assert.ok(life.hintOpacity > 0 && life.hintOpacity < 1);
  const hint = life.hintRemaining;
  life.update({ ...frame, dt: 10, paused: true });
  assert.equal(life.hintRemaining, hint);
  for (let i = 0; i < 5; i++) life.update({ ...frame, reducedMotion: true });
  assert.equal(life.hintOpacity, 0);
  life.start(); assert.equal(life.hintOpacity, 1);
  life.dismissHint(); assert.equal(life.hintOpacity, 0);
  life.clear(); assert.equal(life.hintRemaining, 0);
});

test('all mode labels stay inside the Energy card with stable mode IDs', () => {
  assert.deepEqual(HUD_MODE_LABELS, { endless: 'ENDLESS', sprint: '3-MINUTE SPRINT', bounty: 'BOUNTY HUNT', practice: 'GUIDED PRACTICE' });
  const scoreStart = ui.indexOf('class="hud-score"');
  const mode = ui.indexOf('id="hud-mode"');
  const right = ui.indexOf('class="hud-right"');
  assert.ok(scoreStart < mode && mode < right);
  assert.equal(ui.includes('class="hud-center"'), false);
});

test('preview reactions replace previous selections and clear for reduced motion', () => {
  const motion = new PreviewMotion();
  motion.select(); motion.update(.1, false); assert.ok(motion.reaction > 0);
  const strength = motion.reaction;
  motion.update(0, false); assert.equal(motion.reaction, strength);
  motion.select(); assert.equal(motion.reaction, 0);
  motion.update(.1, false); assert.equal(motion.reaction, strength);
  motion.update(0, true); assert.equal(motion.reaction, 0);
  motion.select(); motion.update(.2, false); motion.reset(); assert.equal(motion.reaction, 0);
});

test('blinks are bounded, disabled for Shiro and reduced motion, and never change shared models', () => {
  for (const { id } of CHARACTERS) {
    for (let i = 0; i < 1000; i++) {
      const blink = previewBlink(i / 100, id, false);
      assert.ok(blink >= .08 && blink <= 1);
      assert.equal(previewBlink(i / 100, id, true), 1);
      if (id === 'eclipse') assert.equal(blink, 1);
    }
    const a = createHead(id), b = createHead(id);
    const eyeA = a.children.find(n => n.userData.previewEye)!;
    const eyeB = b.children.find(n => n.userData.previewEye)!;
    assert.notEqual(eyeA, eyeB);
    eyeA.scale.y = .08;
    assert.equal(eyeB.scale.y, 1);
  }
});

test('selection feedback replaces handles, caps scale, and honors reduced motion', () => {
  const keys: Keyframe[][] = [];
  const animations: { cancelled: boolean }[] = [];
  const node = { animate(frames: Keyframe[]) {
    keys.push(frames);
    const handle = { cancelled: false, currentTime: 0, pause() {}, cancel() { this.cancelled = true; } };
    animations.push(handle); return handle;
  } } as unknown as HTMLElement;
  const motion = new HudMotion();
  motion.selection(node); motion.selection(node);
  assert.equal(motion.count, 1); assert.equal(animations[0].cancelled, true);
  assert.equal(keys[0][1].transform, 'scale(1.04)');
  motion.update({ time: 1, dt: .1, paused: false, reducedMotion: true });
  motion.selection(node); assert.equal(motion.count, 0);
});

test('each stable character ID has a distinct complete UI accent', () => {
  assert.equal(new Set(CHARACTERS.map(c => UI_ACCENTS[c.id].ink)).size, 4);
  for (const { id } of CHARACTERS) for (const color of Object.values(UI_ACCENTS[id])) assert.match(color, /^#[0-9a-f]{6}$/);
});
