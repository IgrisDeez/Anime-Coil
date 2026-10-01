import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODE_DESCRIPTIONS, deathDescription } from '../src/game-copy';
import { CHARACTERS, RESPAWN_DELAY, SPRINT_DURATION } from '../src/simulation';
import { ULTIMATES } from '../src/ultimates';
import { ui } from '../src/ui';
test('Help and Details use the same character and ultimate explanations', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  for (const c of CHARACTERS) {
    assert.ok(ui.includes(c.description));
    assert.ok(ui.includes(ULTIMATES[c.id].description));
  }
  assert.match(main, /hero-description[\s\S]{0,80}c.description/);
  assert.match(main, /ultimate-description[\s\S]{0,80}ultimate.description/);
});
test('mode explanations include respawns, the real timer and Bounty scoring restrictions', () => {
  assert.ok(MODE_DESCRIPTIONS.endless.includes(`${RESPAWN_DELAY} seconds`));
  assert.ok(MODE_DESCRIPTIONS.sprint.includes(`${SPRINT_DURATION / 60} minutes`));
  assert.match(MODE_DESCRIPTIONS.bounty, /100 points and 20 charge/);
  assert.match(MODE_DESCRIPTIONS.bounty, /200 points and 15 charge/);
  assert.match(MODE_DESCRIPTIONS.bounty, /Ultimate eliminations earn no points or charge/);
  assert.match(MODE_DESCRIPTIONS.bounty, /respawn while time remains/);
});
test('collision feedback describes the actual cause', () => {
  assert.equal(deathDescription('You crossed the spirit barrier.'), 'You crossed the arena boundary.');
  assert.equal(deathDescription('Head-on clash. Both spirits fell.'), 'You collided head-on with another snake.');
  assert.equal(deathDescription('You crashed into Kairo.'), 'You crashed into Kairo.');
});
