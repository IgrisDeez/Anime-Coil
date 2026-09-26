import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PracticeGuide } from '../src/practice.ts';
import type { GameEvent } from '../src/simulation.ts';

test('guided practice advances on actual turns, pickups, held boost, and an accepted E', () => {
  const guide = new PracticeGuide();
  const player = { angle: 0, boosting: false, alive: true };
  guide.update(1 / 60, player, []);
  assert.equal(guide.step, 0);
  player.angle = .8; guide.update(1 / 60, player, []);
  assert.equal(guide.step, 1);
  const pickup: GameEvent = { type: 'collect', id: 0, x: 0, z: 0 };
  for(let i=0;i<5;i++) guide.update(1 / 60, player, [pickup]);
  assert.equal(guide.step, 2);
  player.boosting = true;
  for(let i=0;i<61;i++) guide.update(1 / 60, player, []);
  assert.equal(guide.step, 3);
  guide.update(1 / 60, player, [{ type:'ability', id: 9, x:0, z:0 }]);
  assert.equal(guide.step, 3);
  guide.update(1 / 60, player, [{ type:'ability', id: 0, x:0, z:0 }]);
  assert.equal(guide.complete, true);
});

test('practice skips and death never advance the guide', () => {
  const guide = new PracticeGuide();
  guide.update(3, { angle: 1, boosting: true, alive: false }, []);
  assert.equal(guide.step, 0);
  for(let i=0;i<5;i++) guide.skip();
  assert.equal(guide.step, 4);
});

test('an E skill used early still satisfies the last practice step', () => {
  const guide = new PracticeGuide();
  const player = { angle: 0, boosting: false, alive: true };
  guide.update(1 / 60, player, [{ type: 'ability', id: 0, x: 0, z: 0 }]);
  guide.skip(); guide.skip(); guide.skip();
  guide.update(1 / 60, player, []);
  assert.equal(guide.complete, true);
});
