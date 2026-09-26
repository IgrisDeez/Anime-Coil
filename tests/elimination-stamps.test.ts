import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EliminationStampState, STAMP_CAPACITY, STAMP_DURATION, stampPose, stampVisibleAt } from '../src/elimination-stamps.ts';
import type { GameEvent } from '../src/simulation.ts';

const kill = (id: number, sequence: number): GameEvent => ({ type: 'player-elimination', id, x: id * 3, z: -id, sequence });

test('each confirmed kill creates one stamp at the supplied death position', () => {
  const state = new EliminationStampState();
  const batch: GameEvent[] = [kill(2, 1), kill(2, 1), { type: 'death', id: 3, x: 9, z: 0 }, kill(4, 2)];
  assert.equal(state.ingest(batch), 2);
  assert.equal(state.ingest(batch), 0);
  assert.deepEqual(state.slots.filter(s => s.active).map(s => [s.id, s.x, s.z]), [[2, 6, -2], [4, 12, -4]]);
});

test('ultimate batches preserve every victim and stay within the fixed pool', () => {
  const state = new EliminationStampState();
  assert.equal(state.ingest(Array.from({ length: 20 }, (_, i) => kill(i + 1, i + 1))), 20);
  assert.equal(state.slots.filter(s => s.active).length, 20);
  assert.ok(state.slots.filter(s => s.active).every(s => s.compact));
  state.ingest(Array.from({ length: 20 }, (_, i) => kill(i + 21, i + 21)));
  assert.equal(state.slots.length, STAMP_CAPACITY);
  assert.equal(state.slots.filter(s => s.active).length, STAMP_CAPACITY);
});

test('pause freezes age, reduced motion removes bounce and rotation, restart clears history', () => {
  const state = new EliminationStampState();
  state.ingest([kill(1, 1)]);
  const stamp = state.slots[0];
  state.update(0);
  assert.equal(stamp.age, 0);
  state.update(.08);
  assert.ok(stampPose(stamp, false).scale > 1);
  assert.equal(stampPose(stamp, true).scale, 1);
  assert.equal(stampPose(stamp, true).angle, 0);
  assert.ok(stampPose(stamp, true).drift < stampPose(stamp, false).drift);
  assert.equal(stampPose(stamp, true).flecks, 0);
  assert.ok(stampPose(stamp, false).ringOpacity > 0);
  assert.ok(stampPose(stamp, false).slash > 0);
  state.update(STAMP_DURATION);
  assert.equal(stamp.active, false);
  state.clear();
  assert.equal(state.ingest([kill(1, 1)]), 1);
});

test('duplicate victim IDs within a batch create one stamp even with different sequences', () => {
  const state = new EliminationStampState();
  assert.equal(state.ingest([kill(5, 11), kill(5, 12)]), 1);
  assert.equal(state.ingest([kill(5, 12)]), 0);
  assert.equal(state.slots.filter(s => s.active).length, 1);
});

test('offscreen and HUD-covered death positions are hidden instead of clamped elsewhere', () => {
  assert.equal(stampVisibleAt(400, 350, 800, 600), true);
  assert.equal(stampVisibleAt(-10, 350, 800, 600), false);
  assert.equal(stampVisibleAt(90, 70, 800, 600), false);
  assert.equal(stampVisibleAt(700, 530, 800, 600), false);
});
