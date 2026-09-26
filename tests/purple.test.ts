import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Arena,
  STEP,
  NUKE_BLAST,
  NUKE_DURATION,
  NUKE_COOLDOWN,
  dist2,
} from "../src/simulation.ts";
const idle = { angle: 0, boost: false, ability: false };
function advance(a: Arena, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) a.step(STEP, idle);
}
function setup() {
  const a = new Arena("eclipse", () => 0.4, 0, 0);
  for (let i = 1; i <= 20; i++) {
    const angle = (i * Math.PI) / 10;
    a.snakes.push(
      a.createSnake(
        i,
        `Rival ${i}`,
        "eclipse",
        { x: Math.cos(angle) * 100, z: Math.sin(angle) * 100 },
        angle,
      ),
    );
  }
  return a;
}
test("Hollow Purple is exclusive to a living player Shiro", () => {
  const a = setup();
  assert.equal(a.activateNuke(a.snakes[1]), false);
  for (const character of ["ember", "cloud"] as const) {
    const other = new Arena(character, Math.random, 0, 0);
    other.step(STEP, { ...idle, nuke: true });
    assert.equal(other.cinematic, undefined);
  }
  a.player.alive = false;
  assert.equal(a.activateNuke(a.player), false);
});
test("V captures distant opponents globally and does not allow premature collision deaths", () => {
  const a = setup(),
    bot = a.snakes[1],
    distance = dist2(bot, a.player);
  a.activate(a.player); // Both powers can overlap without premature erasure.
  a.step(STEP, { ...idle, nuke: true, ability: true, boost: true });
  advance(a, 3);
  assert.ok(dist2(bot, a.player) < distance * 0.01);
  assert.equal(a.snakes.filter((s) => s.alive).length, 21);
  assert.equal(a.player.x, 0);
  assert.equal(a.player.mass, 18);
  assert.equal(a.player.kills, 0);
  assert.equal(a.activate(a.player), false);
});
test("blast kills all twenty exactly once, drops energy, keeps player safe, delays respawn", () => {
  const a = setup();
  a.step(STEP, { ...idle, nuke: true });
  advance(a, NUKE_BLAST);
  assert.equal(a.snakes.filter((s) => s.alive).length, 1);
  assert.equal(a.player.kills, 20);
  assert.equal(a.state, "playing");
  assert.equal(a.food.length, 180);
  assert.ok(a.cinematic?.detonated);
  advance(a, 1);
  assert.equal(a.player.kills, 20);
  assert.equal(a.food.length, 180);
  assert.equal(a.snakes.filter((s) => s.alive).length, 1);
});
test('both ultimates emit one credited event at each defeated rival position', () => {
  for (const character of ['eclipse', 'nova'] as const) {
    const a = setup();
    a.player.character = character;
    a.step(STEP, { ...idle, nuke: true });
    while (!a.cinematic?.detonated) a.step(STEP, idle);
    const events = a.events.filter(e => e.type === 'player-elimination');
    assert.equal(events.length, 20);
    assert.equal(new Set(events.map(e => e.id)).size, 20);
    assert.equal(new Set(events.map(e => e.sequence)).size, 20);
    for (const e of events) {
      const victim = a.snakes.find(s => s.id === e.id)!;
      assert.deepEqual([e.x, e.z], [victim.x, victim.z]);
    }
    assert.equal(a.player.kills, 20);
    a.step(STEP, idle);
    assert.equal(a.events.filter(e => e.type === 'player-elimination').length, 0);
    assert.equal(a.player.kills, 20);
  }
});
test("bots return three seconds after the blast while cooldown rejects a second activation", () => {
  const a = new Arena("eclipse");
  a.step(STEP, { ...idle, nuke: true });
  advance(a, NUKE_DURATION);
  assert.equal(a.cinematic, undefined);
  assert.ok(a.nukeCooldown > NUKE_COOLDOWN - NUKE_DURATION - 0.1);
  assert.equal(a.snakes.filter((s) => s.alive).length, 1);
  advance(a, 1);
  assert.equal(a.snakes.filter((s) => s.alive).length, 21);
  assert.equal(a.player.kills, 20);
  assert.equal(a.activateNuke(a.player), false);
  // Safe expiry without introducing collision outcomes into a timer test.
  a.snakes = [a.player];
  a.botCount = 0;
  for (let i = 0; i < Math.ceil(NUKE_COOLDOWN / STEP); i++)
    a.step(STEP, { ...idle, angle: a.player.angle + 0.04 });
  assert.equal(a.activateNuke(a.player), true);
});
test("pause freezes the cutscene and cooldown; restarting clears all nuke state", () => {
  const a = setup();
  a.step(STEP, { ...idle, nuke: true });
  advance(a, 1.5);
  const time = a.cinematic!.time,
    cd = a.nukeCooldown,
    positions = structuredClone(a.snakes);
  a.state = "paused";
  advance(a, 10);
  assert.equal(a.cinematic!.time, time);
  assert.equal(a.nukeCooldown, cd);
  assert.deepEqual(a.snakes, positions);
  a.state = "playing";
  advance(a, 2);
  assert.equal(a.player.kills, 20);
  const fresh = new Arena("eclipse");
  assert.equal(fresh.cinematic, undefined);
  assert.equal(fresh.nukeCooldown, 0);
  assert.equal(fresh.player.kills, 0);
  assert.equal(fresh.snakes.length, 21);
});

for (const character of ["nova", "eclipse"] as const) {
  test(`${character} ultimate preserves immunity, global wipe, cooldown and recovery`, () => {
    const a = new Arena(character);
    assert.equal(a.activateNuke(a.snakes[1]), false);
    const positions = a.snakes.slice(1).map(s => ({ x: s.x, z: s.z, body: structuredClone(s.body) }));
    a.step(STEP, { ...idle, nuke: true, ability: true });
    assert.equal(a.cinematic?.kind, character === "nova" ? "spirit" : "purple");
    const before = a.nukeCooldown;
    assert.equal(a.activateNuke(a.player), false);
    assert.equal(a.nukeCooldown, before);
    advance(a, 3);
    assert.equal(a.player.alive, true);
    assert.equal(a.snakes.filter(s => s.alive).length, 21);
    if (character === "eclipse") assert.ok(a.snakes.slice(1).every(s => dist2(s, a.player) < 150));
    else assert.deepEqual(a.snakes.slice(1).map(s => ({x:s.x,z:s.z,body:s.body})), positions);
    advance(a, .5);
    assert.equal(a.player.kills, 20);
    assert.equal(a.snakes.filter(s => s.alive).length, 1);
    assert.ok(a.food.length > 0);
    advance(a, 2.2);
    assert.equal(a.cinematic, undefined);
    advance(a, 0.8);
    assert.equal(a.snakes.filter(s => s.alive).length, 21);
    assert.equal(a.player.alive, true);
    assert.equal(a.activateNuke(a.player), false);
    const fresh = new Arena(character);
    assert.equal(fresh.cinematic, undefined);
    assert.equal(fresh.nukeCooldown, 0);
  });
}

test("Spirit Bomb captures a safe impact point at arena edges and pause preserves it", () => {
  const a = new Arena("nova", Math.random, 0, 0);
  a.player.x = 113; a.player.z = 0; a.player.angle = 0;
  assert.equal(a.activateNuke(a.player), true);
  const shot = structuredClone(a.cinematic!);
  assert.ok(Math.hypot(shot.impact.x,shot.impact.z) <= 97);
  a.state = "paused"; advance(a, 10);
  assert.deepEqual(a.cinematic, shot);
  a.state = "playing"; advance(a, 3.5);
  assert.equal(a.player.alive, true);
  assert.deepEqual(a.cinematic!.impact, shot.impact);
});
