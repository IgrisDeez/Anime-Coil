import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSprintBest, recordSprint, SPRINT_BEST_KEY } from '../src/sprint-record.ts';

test('Sprint record validates storage and keeps a separate versioned key', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  assert.equal(loadSprintBest(storage), undefined);
  data.set(SPRINT_BEST_KEY, '{bad json');
  assert.equal(loadSprintBest(storage), undefined);
  data.set(SPRINT_BEST_KEY, JSON.stringify({ score: 22.5, kills: 1, survival: 10 }));
  assert.equal(loadSprintBest(storage), undefined);
  data.set(SPRINT_BEST_KEY, JSON.stringify({ score: 220, kills: 1, survival: 181 }));
  assert.equal(loadSprintBest(storage), undefined);
  const result = { score: 220, kills: 1, survival: 20 };
  assert.equal(recordSprint(result, undefined, storage).newRecord, true);
  assert.deepEqual(loadSprintBest(storage), result);
  assert.equal(data.has('anime-coil-best'), false);
});

test('Sprint ties use kills then survival and denied storage does not prevent the run', () => {
  const old = { score: 500, kills: 2, survival: 170 };
  assert.equal(recordSprint({ score: 500, kills: 1, survival: 180 }, old).newRecord, false);
  assert.equal(recordSprint({ score: 500, kills: 2, survival: 169 }, old).newRecord, false);
  assert.equal(recordSprint({ score: 500, kills: 2, survival: 180 }, old).newRecord, true);
  const denied = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); } };
  assert.equal(loadSprintBest(denied), undefined);
  assert.deepEqual(recordSprint(old, undefined, denied).best, old);
});
