import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeathPresentation } from '../src/death-presentation.ts';

test('death presentation follows authoritative seconds, ticks once per second, and holds while paused', () => {
  const view = new DeathPresentation();
  assert.equal(view.update(false, 3, 0, false).secondChanged, true);
  assert.equal(view.update(false, 2.99, .2, false).seconds, 3);
  assert.equal(view.update(false, 2.7, .2, false).secondChanged, false);
  const pause = view.update(false, 2, 0, true);
  assert.equal(pause.seconds, 2);
  assert.equal(pause.secondChanged, true);
  assert.equal(pause.flash, view.update(false, 2, 0, true).flash);
  assert.equal(view.update(false, 1.9, .2, false).secondChanged, false);
  assert.equal(view.update(false, .99, .2, false).secondChanged, true);
});

test('respawn fades without delaying the alive state and repeated cycles reset cleanly', () => {
  const view = new DeathPresentation();
  view.update(false, 3, 0, false);
  const returned = view.update(true, 0, 0, false);
  assert.equal(returned.dead, false);
  assert.equal(returned.visible, true);
  assert.equal(returned.fading, true);
  assert.equal(view.update(true, 0, .3, false).visible, true);
  const finished = view.update(true, 0, .3, false);
  assert.equal(finished.visible, false);
  view.update(false, 3, 0, false);
  assert.equal(view.update(false, 3, .2, true).flash, 1);
  view.reset();
  assert.deepEqual(view.update(true, 0, 0, false), { dead: false, visible: false, fading: false, seconds: 0, secondChanged: false, flash: 0, opacity: 0, offsetY: 0 });
});
