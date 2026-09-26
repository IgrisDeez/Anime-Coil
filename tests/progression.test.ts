import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGES, PALETTES, PROGRESSION_KEY, Progression, TRAILS,
  type ProgressionStorage,
} from '../src/progression.ts';
import { MAPS } from '../src/maps.ts';
import type { GameEvent } from '../src/simulation.ts';

const collect = (id = 0): GameEvent => ({ type: 'collect', id, x: 0, z: 0 });
const kill = (id: number, sequence: number): GameEvent => ({ type: 'player-elimination', id, sequence, x: 0, z: 0 });

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: ProgressionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
  return { values, storage };
}

test('four fixed challenges have unique rewards and original cosmetics stay available', () => {
  assert.deepEqual(CHALLENGES.map((c) => c.target), [100, 600, 10, 4]);
  assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, 4);
  assert.equal(PALETTES.length, 3);
  assert.equal(TRAILS.length, 3);
  assert.deepEqual(new Progression().state.unlocked, { palettes: ['original'], trails: ['original'] });
});

test('only player pickups and unique credited eliminations advance eligible matches', () => {
  const progression = new Progression();
  progression.beginMatch('endless');
  progression.recordStep([collect(3), { type: 'death', id: 2, x: 0, z: 0 }, kill(2, 1), kill(2, 1), kill(2, 2)], 2, true);
  assert.equal(progression.state.progress.collectedOrbs, 0);
  assert.equal(progression.state.progress.creditedEliminations, 2);
  assert.equal(progression.state.progress.survivedSeconds, 2);
  progression.recordStep(Array.from({ length: 100 }, () => collect()), 0, true);
  assert.equal(progression.state.progress.collectedOrbs, 100);
  assert.equal(progression.isUnlocked('palette', 'sunset'), true);
  assert.equal(progression.equipPalette('sunset'), true);
  assert.equal(progression.equipTrail('petals'), false);
  progression.finishMatch('leaf', false);
  progression.recordStep([collect(), kill(4, 3)], 10, true);
  assert.equal(progression.state.progress.creditedEliminations, 2);
});

test('survival time, kill reward, and completed sprints unlock each reward once', () => {
  const progression = new Progression();
  progression.beginMatch('sprint');
  progression.recordStep(Array.from({ length: 10 }, (_, index) => kill(index + 1, index + 1)), 599, true);
  assert.equal(progression.isUnlocked('trail', 'petals'), true);
  assert.equal(progression.isUnlocked('palette', 'moonlit'), false);
  progression.recordStep([], 1, true);
  progression.recordStep([], 500, true);
  assert.equal(progression.state.progress.survivedSeconds, 600);
  assert.equal(progression.isUnlocked('palette', 'moonlit'), true);
  progression.finishMatch('shibuya', false);
  assert.deepEqual(progression.state.progress.completedSprintMaps, []);
  for (const map of MAPS) {
    progression.beginMatch('sprint');
    progression.finishMatch(map.id, true);
    progression.beginMatch('sprint');
    progression.finishMatch(map.id, true);
  }
  assert.deepEqual(progression.state.progress.completedSprintMaps, MAPS.map((map) => map.id));
  assert.equal(progression.isUnlocked('trail', 'starlight'), true);
  assert.equal(progression.equipTrail('starlight'), true);
});

test('practice and inactive steps do not advance lifetime challenges or complete sprint maps', () => {
  const progression = new Progression();
  const events = [collect(), kill(7, 1)];
  progression.recordStep(events, 60, true);
  progression.beginMatch('practice');
  progression.recordStep(events, 600, true);
  progression.finishMatch('harbor', true);
  assert.deepEqual(progression.state.progress, {
    collectedOrbs: 0, survivedSeconds: 0, creditedEliminations: 0, completedSprintMaps: [],
  });
  progression.beginMatch('endless');
  progression.recordStep([], 5, false);
  assert.equal(progression.state.progress.survivedSeconds, 0);
});

test('saved data roundtrips, validates corruption, and keeps unlocked choices', () => {
  const { storage, values } = memoryStorage();
  const progression = new Progression(storage);
  progression.beginMatch('endless');
  progression.recordStep(Array.from({ length: 100 }, () => collect()), 600, true);
  progression.finishMatch('leaf', false);
  assert.equal(progression.equipPalette('moonlit'), true);
  assert.equal(progression.equipTrail('petals'), false);
  assert.equal(values.has(PROGRESSION_KEY), true);
  const restored = new Progression(storage);
  assert.equal(restored.state.cosmetics.palette, 'moonlit');
  assert.equal(restored.state.progress.collectedOrbs, 100);
  values.set(PROGRESSION_KEY, JSON.stringify({ version: 1, progress: {
    collectedOrbs: -5, survivedSeconds: Infinity, creditedEliminations: 3,
    completedSprintMaps: ['harbor', 'harbor', 'unknown', 'shibuya'],
  }, cosmetics: { palette: 'sunset', trail: 'starlight' } }));
  const validated = new Progression(storage);
  assert.deepEqual(validated.state.progress.completedSprintMaps, ['shibuya', 'harbor']);
  assert.equal(validated.state.progress.collectedOrbs, 0);
  assert.equal(validated.state.progress.survivedSeconds, 0);
  assert.equal(validated.state.cosmetics.palette, 'original');
  assert.equal(validated.state.cosmetics.trail, 'original');
  values.set(PROGRESSION_KEY, '{bad-json');
  assert.equal(new Progression(storage).state.progress.collectedOrbs, 0);
});

test('unavailable storage never blocks earning or equipping cosmetics', () => {
  const denied: ProgressionStorage = {
    getItem() { throw Error('storage denied'); },
    setItem() { throw Error('storage denied'); },
  };
  const progression = new Progression(denied);
  progression.beginMatch('endless');
  assert.doesNotThrow(() => progression.recordStep(Array.from({ length: 100 }, () => collect()), 1, true));
  assert.equal(progression.equipPalette('sunset'), true);
  assert.equal(progression.state.cosmetics.palette, 'sunset');
  const leaked = progression.state;
  leaked.progress.completedSprintMaps.push('harbor');
  leaked.cosmetics.palette = 'original';
  assert.equal(progression.state.cosmetics.palette, 'sunset');
  assert.deepEqual(progression.state.progress.completedSprintMaps, []);
});
