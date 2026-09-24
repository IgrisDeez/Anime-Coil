import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Arena,
  BASE_SPEED,
  CHARACTERS,
  MIN_MASS,
  RADIUS,
  STEP,
  SpatialGrid,
  serpentScale,
  bodyRadiusAt,
  bodyHitRadiusAt,
  MAX_SIZE,
  type CharacterId,
} from "../src/simulation.ts";
const input = { angle: 0, boost: false, ability: false };
const empty = (id: CharacterId = "ember") => new Arena(id, () => 0.5, 0, 0);
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
test("Fox Step gives three seconds of free boost and a 12-second cooldown", () => {
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
test("Ki Burst picks up in range once, without becoming a continuous magnet", () => {
  const a = empty("nova");
  a.spawnFood({ x: 0, z: 7 }, 3);
  a.spawnFood({ x: 0, z: 10 }, 3);
  advance(a, 1, { ...input, ability: true });
  assert.equal(a.food.length, 1);
  a.spawnFood({ x: 0, z: 6 }, 1);
  advance(a, 1);
  assert.equal(a.food.length, 2);
  assert.equal(a.player.cooldown, 14 - STEP);
});
test("Elastic Turn doubles angular speed", () => {
  const a = empty("cloud"),
    b = empty("ember");
  advance(a, 1, { ...input, angle: Math.PI / 2, ability: true });
  advance(b, 1, { ...input, angle: Math.PI / 2 });
  assert.ok(Math.abs(a.player.angle - b.player.angle * 2) < 1e-8);
});
test("Infinity Veil freezes nearby bots including their bodies, powers and timers", () => {
  const a = empty("eclipse"),
    bot = rival(a, 0, 12, "ember");
  bot.active = 2;
  bot.cooldown = 9;
  const before = structuredClone(bot);
  advance(a, 1, { ...input, ability: true });
  advance(a, 30, { ...input, angle: Math.PI });
  assert.equal(bot.frozen, true);
  assert.equal(bot.x, before.x);
  assert.equal(bot.z, before.z);
  assert.equal(bot.angle, before.angle);
  assert.deepEqual(bot.body, before.body);
  assert.equal(bot.active, 2);
  assert.equal(bot.cooldown, 9);
  assert.equal(bot.mass, before.mass);
  assert.equal(bot.boosting, false);
  assert.ok(a.player.x !== 0);
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
test("field freezes a whole snake when its tail enters; distant bots keep moving", () => {
  const a = empty("eclipse"),
    tail = rival(a, 35, 0),
    far = rival(a, 70, 30);
  advance(a, 1, { ...input, ability: true });
  assert.equal(tail.frozen, true);
  assert.equal(tail.x, 35);
  assert.equal(far.frozen, false);
  assert.notEqual(far.x, 70);
});
test("frozen bots resume after expiry or when the field moves away", () => {
  for (const expired of [true, false]) {
    const a = empty("eclipse"),
      bot = rival(a, 0, 12);
    advance(a, 1, { ...input, ability: true });
    assert.equal(bot.frozen, true);
    if (expired) a.player.active = STEP / 2;
    else {
      a.player.x = 80;
      a.player.body = a.player.body.map((p) => ({ x: p.x + 80, z: p.z }));
    }
    const before = { x: bot.x, z: bot.z };
    advance(a, 1);
    assert.equal(bot.frozen, false);
    assert.notDeepEqual({ x: bot.x, z: bot.z }, before);
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
test("Infinity contact kills on head clashes and protects Gojo", () => {
  const a = empty("eclipse"),
    bot = rival(a, 1, 0);
  a.step(0, { ...input, ability: true });
  assert.equal(a.player.alive, true);
  assert.equal(bot.alive, false);
  assert.equal(a.player.kills, 1);
  assert.equal(a.state, "playing");
  assert.ok(a.food.length > 0);
});
test("Infinity kills when any part of Gojo touches a rival body, once per rival", () => {
  const a = empty("eclipse");
  // Heads are separated; only the coils overlap along their sides.
  const bot = rival(a, -7, 1);
  a.step(0, { ...input, ability: true });
  assert.equal(a.player.alive, true);
  assert.equal(bot.alive, false);
  assert.equal(a.player.kills, 1);
});
test("Infinity protects a head entering another coil; protection ends on expiry", () => {
  for (const active of [true, false]) {
    const { a, attacker, defender } = contactFixture(true, 6, 1.3);
    attacker.character = "eclipse";
    attacker.active = active ? 8 : 0;
    a.step(0, input);
    assert.equal(attacker.alive, active);
    assert.equal(defender.alive, !active);
  }
});
test("Infinity freezes nearby snakes without killing them until contact", () => {
  const a = empty("eclipse"),
    bot = rival(a, 0, 12);
  a.step(0, { ...input, ability: true });
  assert.equal(bot.frozen, true);
  assert.equal(bot.alive, true);
  assert.equal(a.player.kills, 0);
});
test("Infinity prevents boundary death and keeps Gojo inside the arena", () => {
  const a = empty("eclipse");
  a.player.x = RADIUS - 1;
  a.step(STEP, { ...input, ability: true });
  assert.equal(a.player.alive, true);
  assert.equal(a.state, "playing");
  assert.ok(a.player.x < RADIUS - 1);
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
  assert.equal(a.state, "over");
  assert.equal(a.player.alive, false);
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
    if (!player) assert.equal(defender.kills, 1);
  }
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
test("20 bots are maintained after death", () => {
  const a = new Arena("ember", Math.random, 20, 100);
  const victim = a.snakes[1];
  victim.x = RADIUS + 10;
  advance(a, 1);
  assert.equal(a.snakes.filter((s) => s.id !== 0 && s.alive).length, 20);
  assert.ok(!a.snakes.some((s) => s.id === victim.id));
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
  assert.equal(a.snakes.length, 21);
  for (const s of a.snakes) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z));
    assert.ok(s.body.length <= 360);
  }
  assert.ok(a.food.length <= 1600);
});
