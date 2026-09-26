import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Arena,
  BASE_SPEED,
  CHARACTERS,
  MIN_MASS,
  RADIUS,
  RESPAWN_DELAY,
  STEP,
  SpatialGrid,
  serpentScale,
  bodyRadiusAt,
  bodyHitRadiusAt,
  MAX_SIZE,
  SPRINT_DURATION,
  compareSprintResults,
  type CharacterId,
} from "../src/simulation.ts";
const input = { angle: 0, boost: false, ability: false };
const empty = (id: CharacterId = "ember") => new Arena(id, () => 0.5, 0, 0);
const sprint = (id: CharacterId = "ember") => new Arena(id, () => 0.5, 0, 0, "sprint");
const advance = (a: Arena, n: number, control = input) => {
  for (let i = 0; i < n; i++) a.step(STEP, control);
};
function rival(
  a: Arena,
  x: number,
  z: number,
  id: CharacterId = "cloud",
  angle = 0,
) {
  const s = a.createSnake(a.snakes.length, "Rival", id, { x, z }, angle);
  a.snakes.push(s);
  return s;
}
test("endless remains the default and guided practice has no bots", () => {
  const endless = empty();
  assert.equal(endless.mode, "endless");
  assert.equal(endless.remaining, undefined);
  const practice = new Arena("ember", () => 0.5, 20, 0, "practice");
  assert.equal(practice.botCount, 0);
  assert.equal(practice.snakes.length, 1);
  assert.equal(practice.mode, "practice");
});
test("sprint ends at 180 active seconds and leaves the player alive", () => {
  const a = sprint();
  a.elapsed = SPRINT_DURATION - 0.01;
  a.step(0.04, input);
  assert.equal(a.elapsed, SPRINT_DURATION);
  assert.equal(a.remaining, 0);
  assert.equal(a.state, "over");
  assert.equal(a.endReason, "time");
  assert.equal(a.player.alive, true);
  const x = a.player.x;
  a.step(1, input);
  assert.equal(a.player.x, x);
});
test("sprint continues after death, pauses the respawn timer, and respawns without resetting the run", () => {
  const a = sprint();
  a.elapsed = 50;
  a.state = "paused";
  a.step(20, input);
  assert.equal(a.elapsed, 50);
  assert.equal(a.remaining, 130);
  a.state = "playing";
  a.player.mass = 26;
  a.player.peak = 40;
  a.player.kills = 5;
  a.player.x = RADIUS + 1;
  a.step(0, input);
  assert.equal(a.state, "playing");
  assert.equal(a.endReason, undefined);
  assert.equal(a.player.alive, false);
  assert.equal(a.playerRespawnRemaining, RESPAWN_DELAY);
  assert.equal(a.elapsed, 50);
  a.step(STEP, input);
  const remaining = a.playerRespawnRemaining;
  a.state = "paused";
  a.step(1, input);
  assert.equal(a.playerRespawnRemaining, remaining);
  a.state = "playing";
  for (let i = 0; i < Math.ceil(RESPAWN_DELAY / STEP); i++) a.step(STEP, input);
  assert.equal(a.player.alive, true);
  assert.equal(a.state, "playing");
  assert.equal(a.player.mass, MIN_MASS);
  assert.equal(a.player.peak, 40);
  assert.equal(a.player.kills, 5);
  assert.ok(Math.abs(a.elapsed - (50 + STEP + Math.ceil(RESPAWN_DELAY / STEP) * STEP)) < 1e-9);
});
test("sprint deadline during an ultimate waits for recovery without extra movement", () => {
  const a = new Arena("nova", () => 0.5, 1, 0, "sprint"), bot = a.snakes[1];
  a.elapsed = SPRINT_DURATION - 1;
  assert.equal(a.activateNuke(a.player), true);
  a.step(1.5, input);
  assert.equal(a.elapsed, SPRINT_DURATION);
  assert.equal(a.state, "playing");
  assert.ok(a.cinematic);
  const playerX = a.player.x;
  a.step(2, input);
  assert.equal(bot.alive, false);
  assert.equal(a.player.kills, 1);
  assert.equal(a.state, "playing");
  a.step(2.1, input);
  assert.equal(a.cinematic, undefined);
  assert.equal(a.state, "over");
  assert.equal(a.endReason, "time");
  assert.equal(a.player.x, playerX);
  assert.equal(a.player.kills, 1);
  assert.equal(a.snakes.length, 1);
});
test("sprint records use peak energy, then kills, then survival", () => {
  const a = sprint();
  a.player.mass = 50;
  a.player.peak = 80.5;
  a.player.kills = 3;
  a.elapsed = 72;
  assert.deepEqual(a.sprintResult, { score: 805, kills: 3, survival: 72 });
  assert.ok(compareSprintResults(a.sprintResult, { score: 804, kills: 99, survival: 180 }) > 0);
  assert.ok(compareSprintResults(a.sprintResult, { score: 805, kills: 2, survival: 180 }) > 0);
  assert.ok(compareSprintResults(a.sprintResult, { score: 805, kills: 3, survival: 73 }) < 0);
  assert.equal(compareSprintResults(a.sprintResult, { score: 805, kills: 3, survival: 72 }), 0);
});
test("spatial grid searches across negative cell boundaries", () => {
  const g = new SpatialGrid<{ x: number; z: number }>();
  g.add({ x: -0.1, z: 0 });
  g.add({ x: 50, z: 0 });
  assert.equal(g.query({ x: 0, z: 0 }, 1).length, 1);
});
test("score grows head and body size gradually, with a width cap", () => {
  assert.equal(serpentScale(MIN_MASS), 1);
  assert.ok(serpentScale(50) > serpentScale(25));
  assert.ok(serpentScale(100) > serpentScale(50));
  assert.equal(serpentScale(100000), MAX_SIZE);
  assert.equal(serpentScale(0), 1);
  assert.ok(bodyRadiusAt(1, 30, 100) > bodyRadiusAt(1, 30, 18));
  assert.ok(bodyRadiusAt(29, 30, 100) < bodyRadiusAt(1, 30, 100));
  assert.equal(bodyHitRadiusAt(29, 30, 100), bodyRadiusAt(29, 30, 100) * 0.94);
});
test("larger bodies collide at their visible expanded width", () => {
  for (const mass of [18, 100]) {
    const { a, attacker, defender } = contactFixture(true, 6, 1.8);
    defender.mass = mass;
    a.step(0, input);
    assert.equal(attacker.alive, mass === 18);
  }
});
test("larger heads collide symmetrically using each snakes own size", () => {
  const a = empty(),
    other = rival(a, 2.1, 0, "cloud", Math.PI);
  a.player.mass = 100;
  a.step(0, input);
  assert.equal(a.player.alive, false);
  assert.equal(other.alive, false);
});
test("collectibles increase mass and body length and are consumed once", () => {
  const a = empty();
  a.spawnFood({ x: 0.5, z: 0 }, 10);
  advance(a, 1);
  assert.equal(a.player.mass, 24);
  assert.equal(a.player.body.length, 24);
  assert.equal(a.food.length, 0);
  advance(a, 1);
  assert.equal(a.player.mass, 24);
});
test("boost costs mass, drops food, and stops at minimum mass", () => {
  const a = empty();
  a.player.mass = 24;
  advance(a, 30, { ...input, boost: true });
  assert.ok(a.player.mass < 23);
  assert.ok(a.food.length > 0);
  assert.ok(a.player.x > BASE_SPEED * 0.5);
  a.player.mass = MIN_MASS;
  advance(a, 1, { ...input, boost: true });
  assert.equal(a.player.mass, MIN_MASS);
  assert.equal(a.player.boosting, false);
});
test("Fox Rush gives three seconds of free boost and a 12-second cooldown", () => {
  const a = empty();
  advance(a, 1, { ...input, ability: true });
  assert.equal(a.player.cooldown, 12);
  assert.equal(a.player.active, 3);
  advance(a, 179);
  assert.equal(a.player.mass, MIN_MASS);
  assert.ok(a.player.x > 30);
  advance(a, 2);
  assert.equal(a.player.active, 0);
  assert.ok(a.player.cooldown > 8.9 && a.player.cooldown < 9.1);
});
test("Ki Cannon no longer collects distant food", () => {
  const a = empty("nova");
  a.spawnFood({ x: 0, z: 7 }, 3);
  a.spawnFood({ x: 0, z: 10 }, 3);
  advance(a, 1, { ...input, ability: true });
  assert.equal(a.food.length, 2);
  assert.equal(a.player.mass, MIN_MASS);
  assert.equal(a.player.cooldown, 10);
});

test("Elastic Twist doubles angular speed", () => {
  const a = empty("cloud"),
    b = empty("ember");
  advance(a, 1, { ...input, angle: Math.PI / 2, ability: true });
  advance(b, 1, { ...input, angle: Math.PI / 2 });
  assert.ok(Math.abs(a.player.angle - b.player.angle * 2) < 1e-8);
});
test("Infinity Veil slows propulsion without freezing powers or timers", () => {
  const a = empty("eclipse"), bot = rival(a, 0, 8, "ember");
  a.ai = s => ({ ...input, angle: s.angle });
  bot.active = 2; bot.cooldown = 9;
  advance(a, 1, { ...input, ability: true });
  assert.equal(bot.frozen, false);
  assert.equal(bot.slowed, true);
  assert.ok(Math.abs(bot.x - BASE_SPEED * 1.7 * .6 * STEP) < 1e-8);
  assert.equal(bot.active, 2 - STEP);
  assert.equal(bot.cooldown, 9 - STEP);
  assert.equal(bot.boosting, true);
});

test("bots cannot activate Infinity Veil, even through direct activation", () => {
  const a = empty(),
    bot = rival(a, 0, 8, "eclipse");
  assert.equal(a.activate(bot), false);
  a.ai = () => ({ ...input, ability: true });
  advance(a, 1);
  assert.equal(bot.active, 0);
  assert.equal(bot.cooldown, 0);
  assert.equal(a.player.frozen, false);
});
test("a tail in the field does not slow a distant head", () => {
  const a = empty("eclipse"), tail = rival(a, 20, 0), far = rival(a, 70, 30);
  a.step(0, { ...input, ability: true });
  assert.equal(tail.slowed, false);
  assert.equal(far.slowed, false);
});

test("slow ends on expiry or leaving the moving field", () => {
  for (const expired of [true, false]) {
    const a = empty("eclipse"), bot = rival(a, 0, 8);
    a.ai = s => ({ ...input, angle: s.angle });
    advance(a, 1, { ...input, ability: true });
    assert.equal(bot.slowed, true);
    if (expired) a.player.active = STEP / 2;
    else { a.player.x = 80; a.player.body = a.player.body.map(p => ({ x: p.x + 80, z: p.z })); }
    const x = bot.x;
    advance(a, 1);
    assert.equal(bot.slowed, false);
    assert.ok(Math.abs(bot.x - x - BASE_SPEED * STEP) < 1e-8);
  }
});

test("ability cooldown rejects immediate reactivation for every character", () => {
  for (const c of CHARACTERS) {
    const a = empty(c.id);
    assert.equal(a.activate(a.player), true);
    assert.equal(a.activate(a.player), false);
    assert.equal(a.player.cooldown, c.cooldown);
  }
});
test("Infinity Veil has normal mutual head collisions and no immunity", () => {
  const a = empty("eclipse"), bot = rival(a, 1, 0);
  a.step(0, { ...input, ability: true });
  assert.equal(a.player.alive, false);
  assert.equal(bot.alive, false);
  assert.equal(a.player.kills, 0);
});

test("Infinity Veil does not erase overlapping bodies", () => {
  const a = empty("eclipse"), bot = rival(a, -6, 6, "cloud", Math.PI / 2);
  a.step(0, { ...input, ability: true });
  assert.equal(a.player.alive, true);
  assert.equal(bot.alive, true);
  assert.equal(a.player.kills, 0);
});

test("Infinity Veil cannot protect a head entering a rival coil", () => {
  for (const active of [true, false]) {
    const { a, attacker, defender } = contactFixture(true, 6, 1.3);
    attacker.character = "eclipse"; attacker.active = active ? 3 : 0;
    a.step(0, input);
    assert.equal(attacker.alive, false);
    assert.equal(defender.alive, true);
  }
});

test("Infinity Veil slows without damage and uses normal boundary deaths", () => {
  const a = empty("eclipse"), bot = rival(a, 0, 8);
  a.step(0, { ...input, ability: true });
  assert.equal(bot.slowed, true);
  assert.equal(bot.alive, true);
  a.player.x = RADIUS - 1;
  advance(a, 1);
  assert.equal(a.player.alive, false);
  assert.equal(a.state, "playing");
  assert.equal(a.playerRespawnRemaining, RESPAWN_DELAY);
});

test("all powers expire and become available after their cooldown", () => {
  for (const c of CHARACTERS) {
    const a = empty(c.id);
    advance(a, 1, { ...input, ability: true });
    for (let i = 0; i < Math.ceil(c.cooldown / STEP) + 2; i++)
      a.step(STEP, {
        angle: a.player.angle + 0.04,
        boost: false,
        ability: false,
      });
    assert.equal(a.state, "playing");
    assert.equal(a.player.active, 0);
    assert.equal(a.player.cooldown, 0);
    assert.equal(a.activate(a.player), true);
  }
});
test("boundary kills player and leaves collectible energy", () => {
  const a = empty();
  a.player.x = RADIUS - 1;
  a.player.body[0].x = a.player.x;
  advance(a, 1);
  assert.equal(a.state, "playing");
  assert.equal(a.player.alive, false);
  assert.equal(a.playerRespawnRemaining, RESPAWN_DELAY);
  assert.ok(a.food.length > 0);
  assert.match(a.deathReason, /barrier/);
});
test("head-to-head collision kills both participants simultaneously", () => {
  const a = empty();
  const other = rival(a, 1.5, 0, "cloud", Math.PI);
  advance(a, 1);
  assert.equal(a.player.alive, false);
  assert.equal(other.alive, false);
  assert.match(a.deathReason, /Head-on/);
});
test("a rival body is lethal; own body is safe", () => {
  const a = empty();
  a.player.body[4] = { x: 0.1, z: 0 };
  advance(a, 1);
  assert.equal(a.player.alive, true);
  const other = rival(a, 15, 0);
  other.mass = 22;
  other.body = Array.from({ length: 22 }, (_, i) => ({
    x: 15 - i * 0.72,
    z: 0,
  }));
  advance(a, 1);
  assert.equal(a.player.alive, false);
});
test("paused and over matches do not advance", () => {
  const a = empty();
  a.state = "paused";
  advance(a, 60);
  assert.equal(a.elapsed, 0);
  a.state = "over";
  advance(a, 60);
  assert.equal(a.elapsed, 0);
});

// Straight, stationary fixtures isolate contact geometry from bot steering.
function contactFixture(attackerIsPlayer: boolean, x: number, z: number) {
  const a = empty();
  const attacker = a.createSnake(
    attackerIsPlayer ? 0 : 1,
    "Attacker",
    "ember",
    { x, z },
    0,
  );
  const defender = a.createSnake(
    attackerIsPlayer ? 1 : 0,
    "Defender",
    "cloud",
    { x: 12.24, z: 0 },
    0,
  );
  a.snakes = attackerIsPlayer ? [attacker, defender] : [defender, attacker];
  a.ai = (s) => ({ angle: s.angle, boost: false, ability: false });
  return { a, attacker, defender };
}
test("passing the thin tail no longer hits an invisible full-width segment", () => {
  for (const player of [true, false]) {
    const { a, attacker, defender } = contactFixture(player, 0, 1.4);
    a.step(0, input);
    assert.equal(attacker.alive, true);
    assert.equal(defender.alive, true);
  }
});
test("a real tail contact still eliminates the attacker", () => {
  for (const player of [true, false]) {
    const { a, attacker, defender } = contactFixture(player, 0, 1.0);
    a.step(0, input);
    assert.equal(attacker.alive, false);
    assert.equal(defender.alive, true);
  }
});
test("close passes along a full-width body are safe for both player and bots", () => {
  for (const player of [true, false]) {
    const { a, attacker } = contactFixture(player, 6, 1.65);
    a.step(0, input);
    assert.equal(attacker.alive, true);
  }
});
test("actual body contact kills only the attacking head, regardless of entity order", () => {
  for (const player of [true, false]) {
    const { a, attacker, defender } = contactFixture(player, 6, 1.3);
    a.step(0, input);
    assert.equal(attacker.alive, false);
    assert.equal(defender.alive, true);
    const credited = a.events.filter(e => e.type === 'player-elimination');
    if (!player) {
      assert.equal(defender.kills, 1);
      assert.deepEqual(credited.map(e => [e.id, e.x, e.z]), [[attacker.id, attacker.x, attacker.z]]);
    } else assert.equal(credited.length, 0);
  }
});
test('bot-vs-bot deaths and player death never emit a credited elimination', () => {
  const a = empty();
  const attacker = rival(a, 6, 1.3, 'ember');
  rival(a, 12.24, 0, 'cloud');
  a.ai = s => ({ angle: s.angle, boost: false, ability: false });
  a.step(0, input);
  assert.equal(attacker.alive, false);
  assert.equal(a.player.kills, 0);
  assert.equal(a.events.filter(e => e.type === 'player-elimination').length, 0);
  const fatal = contactFixture(true, 6, 1.3).a;
  fatal.step(0, input);
  assert.equal(fatal.player.alive, false);
  assert.equal(fatal.events.filter(e => e.type === 'player-elimination').length, 0);
});
test("heads with a visible gap survive; overlapping heads both die", () => {
  for (const gap of [1.7, 1.4]) {
    const a = empty(),
      other = rival(a, gap, 0, "cloud", Math.PI);
    a.step(0, input);
    assert.equal(a.player.alive, gap === 1.7);
    assert.equal(other.alive, gap === 1.7);
  }
});
test("new matches reset timers, mass, and cooldowns", () => {
  const old = empty();
  advance(old, 1, { ...input, ability: true });
  const fresh = empty();
  assert.equal(fresh.elapsed, 0);
  assert.equal(fresh.player.cooldown, 0);
  assert.equal(fresh.player.mass, MIN_MASS);
  assert.equal(fresh.state, "playing");
});
test("bots remain gone for three seconds after death, then return", () => {
  const a = new Arena("ember", () => 0.5, 1, 0);
  const victim = a.snakes[1];
  victim.x = RADIUS + 10;
  a.step(0, input);
  assert.equal(a.snakes.filter((s) => s.id !== 0 && s.alive).length, 0);
  assert.ok(!a.snakes.some((s) => s.id === victim.id));
  a.state = "paused";
  advance(a, Math.ceil(4 / STEP));
  assert.equal(a.snakes.filter((s) => s.id !== 0 && s.alive).length, 0);
  a.state = "playing";
  advance(a, Math.ceil((RESPAWN_DELAY - STEP) / STEP));
  assert.equal(a.snakes.filter((s) => s.id !== 0 && s.alive).length, 0);
  advance(a, 2);
  assert.equal(a.snakes.filter((s) => s.id !== 0 && s.alive).length, 1);
});
test("seeded arena simulation stays finite through a long bot match", () => {
  let seed = 123;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const a = new Arena("ember", rng, 20, 850);
  for (let i = 0; i < 1800; i++) {
    a.step(STEP, {
      angle: a.player.angle + 0.044,
      boost: false,
      ability: i % 720 === 0,
    });
    if (a.state === "over") break;
  }
  assert.ok(a.snakes.length >= 1 && a.snakes.length <= 21);
  for (const s of a.snakes) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z));
    assert.ok(s.body.length <= 360);
  }
  assert.ok(a.food.length <= 1600);
});
