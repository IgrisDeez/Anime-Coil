import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Progression } from '../src/progression.ts';
import { progressSnapshot, sessionSummary, UnlockNotices } from '../src/session-summary.ts';
import { defaultSettings, loadGameSettings, visualComfort } from '../src/game-settings.ts';

test('older settings retain valid bindings and receive independent comfort defaults', () => {
  const saved = JSON.stringify({ version: 1, keys: { boost: 'KeyB', ability: 'KeyR', ultimate: 'KeyT' }, graphics: 'low', motion: 'system' });
  const settings = loadGameSettings({ getItem: () => saved, setItem() {} });
  assert.equal(settings.keys.ability, 'KeyR');
  assert.equal(settings.graphics, 'low');
  assert.equal(settings.touchHand, 'left');
  assert.equal(settings.touchSize, 'standard');
  assert.equal(settings.cinematicCamera, true);
  assert.equal(settings.reducedFlashes, false);
  assert.equal(defaultSettings().motion, 'system');
});

test('invalid touch and comfort settings fall back individually', () => {
  const saved = JSON.stringify({ version: 1, keys: defaultSettings().keys, touchHand: 'up', touchSize: 'huge', cinematicCamera: 'no', reducedFlashes: 1 });
  const settings = loadGameSettings({ getItem: () => saved, setItem() {} });
  assert.deepEqual([settings.touchHand, settings.touchSize, settings.cinematicCamera, settings.reducedFlashes], ['left', 'standard', true, false]);
});

test('reduced motion takes precedence over separate flash and camera choices', () => {
  const settings = defaultSettings();
  assert.deepEqual(visualComfort(settings, false), { softenImpact: false, cameraEnabled: true });
  settings.reducedFlashes = true;
  assert.deepEqual(visualComfort(settings, false), { softenImpact: true, cameraEnabled: true });
  settings.reducedFlashes = false; settings.cinematicCamera = false;
  assert.deepEqual(visualComfort(settings, false), { softenImpact: false, cameraEnabled: false });
  assert.deepEqual(visualComfort(settings, true), { softenImpact: true, cameraEnabled: false });
});

test('session summary reports earned progress and unlocked rewards once', () => {
  const progression = new Progression();
  const before = progressSnapshot(progression.state);
  const after = { ...before, orbs: 100, skins: ['original', 'neon'] };
  const summary = sessionSummary('endless', before, after);
  assert.ok(summary.progress.some(line => line.includes('+100')));
  assert.deepEqual(summary.unlocks, ['Neon Spirit']);
  assert.deepEqual(sessionSummary('practice', before, after), { progress: [], unlocks: [] });
  const notices = new UnlockNotices();
  notices.add(summary.unlocks); notices.add(summary.unlocks);
  assert.equal(notices.take(false), undefined);
  assert.equal(notices.take(true), 'Neon Spirit');
  assert.equal(notices.take(true), undefined);
  notices.reset(); notices.add(summary.unlocks);
  assert.equal(notices.count, 1);
});
