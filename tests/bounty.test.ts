import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arena, BOUNTY_CHARGE_MAX, SPRINT_DURATION, STEP, RADIUS, HEAD_HIT_RADIUS, bodyHitRadiusAt, type Input } from '../src/simulation.ts';
import { BOUNTY_BEST_KEY, loadBountyBest, recordBounty } from '../src/bounty-record.ts';
import { defaultSettings, loadGameSettings, saveGameSettings, updateBinding } from '../src/game-settings.ts';

const input: Input = { angle: 0, boost: false, ability: false };
const hunt = (bots = 0) => new Arena('ember', () => .5, bots, 0, 'bounty');
function target(a: Arena, id: number, x: number, z = 0) {
  const s = a.createSnake(id, `Rival ${id}`, 'cloud', { x, z }, 0);
  a.snakes.push(s);
  return s;
}

test('Bounty Hunt counts natural food, ignores dropped food, and gates the ultimate', () => {
  const a = hunt();
  assert.equal(a.activateNuke(a.player), false);
  a.spawnFood({ x: 0, z: 0 }, 1, 0, 'natural');
  a.spawnFood({ x: 0, z: 0 }, 2, 0, 'drop');
  a.reindex(); a.step(0, input);
  assert.equal(a.bountyPoints, 1);
  assert.equal(a.bountyCharge, 1);
  assert.equal(a.events.filter(e => e.type === 'collect').length, 2);
  a.bountyCharge = BOUNTY_CHARGE_MAX;
  assert.equal(a.activateNuke(a.player), true);
  assert.equal(a.bountyCharge, 0);
  assert.equal(a.nukeCooldown, 30);
  assert.equal(a.activateNuke(a.player), false);
});

test('direct bounty credit awards points and charge once, then selects a living target', () => {
  const a = hunt(), victim = target(a, 1, -5), survivor = target(a, 2, 40, 30);
  a.bountyTargetId = victim.id;
  a.ai = s => ({ ...input, angle: s.angle });
  a.step(0, input);
  assert.equal(a.player.kills, 1);
  assert.equal(a.bountyPoints, 300);
  assert.equal(a.bountyCharge, 35);
  assert.equal(a.bountiesClaimed, 1);
  assert.equal(a.directEliminations, 1);
  assert.equal(a.bountyTargetId, survivor.id);
  assert.deepEqual(a.events.filter(e => e.type === 'player-elimination').map(e => [e.id, e.source, e.bounty]), [[1, 'collision', true]]);
  a.step(0, input);
  assert.equal(a.bountyPoints, 300);
});

test('ultimate KOs retain existing kill credit without Bounty points or recharge', () => {
  const a = hunt(), first = target(a, 1, 30), second = target(a, 2, -30);
  a.bountyTargetId = first.id;
  a.bountyCharge = 100;
  assert.equal(a.activateNuke(a.player), true);
  a.step(3.4, input);
  assert.equal(a.player.kills, 2);
  assert.equal(a.ultimateEliminations, 2);
  assert.equal(a.bountyPoints, 0);
  assert.equal(a.bountyCharge, 0);
  assert.equal(a.events.filter(e => e.type === 'player-elimination' && e.source === 'ultimate').length, 2);
  assert.equal(first.alive, false); assert.equal(second.alive, false);
});

test('death keeps Bounty points, halves unused charge, and retains the three-second respawn', () => {
  const a = hunt();
  a.bountyPoints = 321; a.bountyCharge = 35;
  a.player.x = RADIUS + 1;
  a.step(0, input);
  assert.equal(a.player.alive, false);
  assert.equal(a.bountyPoints, 321);
  assert.equal(a.bountyCharge, 17);
  assert.equal(a.playerRespawnRemaining, 3);
  for (let i = 0; i < 181; i++) a.step(STEP, input);
  assert.equal(a.player.alive, true);
  assert.equal(a.bountyPoints, 321);
});

test('Bounty timer pauses and completes after an active cinematic', () => {
  const a = hunt(); a.bountyCharge = 100; a.elapsed = SPRINT_DURATION - 1;
  a.state = 'paused'; a.step(2, input); assert.equal(a.elapsed, 179);
  a.state = 'playing'; assert.equal(a.activateNuke(a.player), true);
  a.step(1.5, input); assert.equal(a.elapsed, 180); assert.equal(a.state, 'playing');
  a.step(4.1, input); assert.equal(a.state, 'over'); assert.equal(a.endReason, 'time');
  assert.equal(a.remaining, 0);
});

test('Bounty bots have fixed profiles; ordinary modes retain their old bot behavior', () => {
  const a = hunt(20);
  assert.deepEqual(a.snakes.slice(1).map(s => s.botStyle), [
    ...Array(8).fill('forager'), ...Array(6).fill('interceptor'), ...Array(6).fill('evasive'),
  ]);
  const old = new Arena('ember', () => .5, 1, 0, 'endless');
  assert.equal(old.snakes[1].botStyle, undefined);
});

test('spawned coils have clearance from rivals when a safe start exists', () => {
  const a = hunt(20);
  for (const snake of a.snakes) for (const other of a.snakes) {
    if (snake.id === other.id || snake.id === 0) continue;
    for (const point of snake.body) for (let i = 0; i < other.body.length; i++) {
      const body = other.body[i];
      const clearance = Math.hypot(point.x - body.x, point.z - body.z) -
        (HEAD_HIT_RADIUS + bodyHitRadiusAt(i, other.body.length, other.mass));
      assert.ok(clearance > 0, `spawn ${snake.id} overlaps ${other.id}`);
    }
  }
});

test('player death carries the responsible rival name and contact position', () => {
  const a = hunt(), rival = target(a, 1, 0, 0);
  a.player.x = -5; a.player.z = 0;
  a.step(0, input);
  const death = a.events.find(e => e.type === 'death' && e.id === 0);
  assert.equal(death?.killerId, rival.id);
  assert.equal(death?.killerName, rival.name);
  assert.equal(death?.x, -5);
});

test('Bounty records are separate, validated, and use points, bounties, then direct KOs', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } };
  const previous = { points: 300, bounties: 1, directEliminations: 2, ultimateEliminations: 10, peakEnergy: 400 };
  assert.equal(recordBounty(previous, undefined, storage).newRecord, true);
  assert.equal(data.has('anime-coil-best'), false);
  assert.equal(data.has(BOUNTY_BEST_KEY), true);
  assert.deepEqual(loadBountyBest(storage), previous);
  assert.equal(recordBounty({ ...previous, bounties: 0, directEliminations: 10 }, previous).newRecord, false);
  assert.equal(recordBounty({ ...previous, bounties: 1, directEliminations: 3 }, previous).newRecord, true);
  data.set(BOUNTY_BEST_KEY, '{'); assert.equal(loadBountyBest(storage), undefined);
});

test('settings reject duplicate keys, persist choices, and survive blocked storage', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } };
  const settings = defaultSettings();
  assert.equal(updateBinding(settings, 'boost', 'KeyE'), false);
  assert.equal(updateBinding(settings, 'boost', 'Escape'), false);
  assert.equal(updateBinding(settings, 'boost', 'KeyQ'), true);
  settings.graphics = 'low'; settings.motion = 'reduced';
  saveGameSettings(settings, storage);
  assert.deepEqual(loadGameSettings(storage), settings);
  const denied = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
  assert.deepEqual(loadGameSettings(denied), defaultSettings());
  assert.doesNotThrow(() => saveGameSettings(settings, denied));
});
