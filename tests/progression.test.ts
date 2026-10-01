import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BODY_SKINS, CHALLENGES, PROGRESSION_KEY, Progression, TRAILS,
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
  assert.deepEqual(CHALLENGES.map((c) => c.target), [100, 600, 10, 1]);
  assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, 4);
  assert.deepEqual(BODY_SKINS.map((skin) => skin.id), ['original', 'neon', 'spiritweave']);
  assert.equal(TRAILS.length, 3);
  assert.deepEqual(new Progression().state.unlocked, { skins: ['original'], trails: ['original'] });
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
  assert.equal(progression.isUnlocked('skin', 'neon'), true);
  assert.equal(progression.equipSkin('neon'), true);
  assert.equal(progression.equipTrail('petals'), false);
  progression.finishMatch('shibuya', false);
  progression.recordStep([collect(), kill(4, 3)], 10, true);
  assert.equal(progression.state.progress.creditedEliminations, 2);
});

test('survival time, kill reward, and completed sprints unlock each reward once', () => {
  const progression = new Progression();
  progression.beginMatch('sprint');
  progression.recordStep(Array.from({ length: 10 }, (_, index) => kill(index + 1, index + 1)), 599, true);
  assert.equal(progression.isUnlocked('trail', 'petals'), true);
  assert.equal(progression.isUnlocked('skin', 'spiritweave'), false);
  progression.recordStep([], 1, true);
  progression.recordStep([], 500, true);
  assert.equal(progression.state.progress.survivedSeconds, 600);
  assert.equal(progression.isUnlocked('skin', 'spiritweave'), true);
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
  progression.finishMatch('shibuya', true);
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
  progression.finishMatch('shibuya', false);
  assert.equal(progression.equipSkin('spiritweave'), true);
  assert.equal(progression.equipTrail('petals'), false);
  assert.equal(values.has(PROGRESSION_KEY), true);
  const restored = new Progression(storage);
  assert.equal(restored.state.cosmetics.skin, 'spiritweave');
  assert.equal(restored.state.progress.collectedOrbs, 100);
  values.set(PROGRESSION_KEY, JSON.stringify({ version: 1, progress: {
    collectedOrbs: -5, survivedSeconds: Infinity, creditedEliminations: 3,
    completedSprintMaps: ['harbor', 'harbor', 'unknown', 'shibuya'],
  }, cosmetics: { palette: 'sunset', trail: 'starlight' } }));
  const validated = new Progression(storage);
  assert.deepEqual(validated.state.progress.completedSprintMaps, ['shibuya']);
  assert.equal(validated.state.progress.collectedOrbs, 0);
  assert.equal(validated.state.progress.survivedSeconds, 0);
  assert.equal(validated.state.cosmetics.skin, 'original');
  assert.equal(validated.state.cosmetics.trail, 'starlight');
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
  assert.equal(progression.equipSkin('neon'), true);
  assert.equal(progression.state.cosmetics.skin, 'neon');
  const leaked = progression.state;
  leaked.progress.completedSprintMaps.push('shibuya');
  leaked.cosmetics.skin = 'original';
  assert.equal(progression.state.cosmetics.skin, 'neon');
  assert.deepEqual(progression.state.progress.completedSprintMaps, []);
});

test('version-one color cosmetics migrate to their matching skins without losing challenge progress', () => {
  const { storage, values } = memoryStorage();
  values.set(PROGRESSION_KEY, JSON.stringify({
    version: 1,
    progress: { collectedOrbs: 100, survivedSeconds: 600, creditedEliminations: 10, completedSprintMaps: ['leaf'] },
    cosmetics: { palette: 'moonlit', trail: 'petals' },
  }));
  const progression = new Progression(storage);
  assert.equal(progression.state.cosmetics.skin, 'spiritweave');
  assert.equal(progression.state.cosmetics.trail, 'petals');
  assert.equal(progression.state.progress.collectedOrbs, 100);
  assert.equal(progression.state.progress.survivedSeconds, 600);
  assert.equal(progression.state.progress.creditedEliminations, 10);
  assert.equal(progression.equipSkin('neon'), true);
  assert.equal(JSON.parse(values.get(PROGRESSION_KEY)!).version, 2);
});
test('old sprint progress keeps only Shibuya and preserves earned Starlight and other rewards', () => {
  const { storage, values } = memoryStorage();
  for (const maps of [['leaf', 'tournament', 'harbor', 'shibuya'], ['leaf', 'tournament', 'harbor']]) {
    values.set(PROGRESSION_KEY, JSON.stringify({ version: 2,
      progress: { collectedOrbs: 100, survivedSeconds: 600, creditedEliminations: 10, completedSprintMaps: maps },
      cosmetics: { skin: 'spiritweave', trail: 'starlight' } }));
    const p = new Progression(storage);
    assert.deepEqual(p.state.progress.completedSprintMaps, maps.includes('shibuya') ? ['shibuya'] : []);
    assert.equal(p.isUnlocked('trail', 'starlight'), maps.includes('shibuya'));
    assert.equal(p.state.cosmetics.skin, 'spiritweave');
    assert.equal(p.isUnlocked('trail', 'petals'), true);
    assert.equal(p.state.cosmetics.trail, maps.includes('shibuya') ? 'starlight' : 'original');
    p.beginMatch('sprint'); p.finishMatch('shibuya', true);
    assert.equal(p.equipTrail('starlight'), true);
    assert.deepEqual(new Progression(storage).state.progress.completedSprintMaps, ['shibuya']);
  }
});
