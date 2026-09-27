import { test } from "node:test";
import assert from "node:assert/strict";
import { Arena, BASE_SPEED, RADIUS, SPRINT_DURATION, STEP, type CharacterId } from "../src/simulation.ts";
import { SKY_PUNCH_FIRST, SKY_PUNCH_INTERVAL, SKY_PUNCH_RANGE, SKY_PUNCH_RADIUS, SKY_PUNCH_SPEED, TRANSFORMATION_DURATION, ULTIMATES, ultimateFor } from "../src/ultimates.ts";

const idle = { angle: 0, boost: false, ability: false };
function arena(character: CharacterId) {
  const a = new Arena(character, () => .5, 0, 0);
  a.ai = snake => ({ ...idle, angle: snake.angle });
  return a;
}
function rival(a: Arena, x: number, z: number, id: number) {
  const s = a.createSnake(id, `Rival ${id}`, "cloud", { x, z }, Math.PI / 2);
  a.snakes.push(s);
  return s;
}
function advance(a: Arena, steps: number, angle = 0) {
  for (let i = 0; i < steps; i++) a.step(STEP, { ...idle, angle });
}

test("ultimate definitions preserve character IDs and separate cinematic forms", () => {
  assert.deepEqual(Object.keys(ULTIMATES), ["eclipse", "nova", "ember", "cloud"]);
  assert.equal(ultimateFor("ember").id, "nine-tail");
  assert.equal(ultimateFor("cloud").id, "skybreaker");
  assert.equal(ultimateFor("nova").id, "spirit");
  assert.equal(ultimateFor("eclipse").id, "purple");
  assert.ok(Object.values(ULTIMATES).every(ultimate => ultimate.cooldown === 30));
});

test("Nine-Tail Cloak is player-only, lasts eight active seconds, and free boost does not stack with Fox Rush", () => {
  const a = arena("ember");
  const bot = rival(a, 50, 40, 1);
  assert.equal(a.activateNuke(bot), false);
  assert.equal(a.activateNuke(a.player), true);
  assert.equal(a.transformation?.kind, "nine-tail");
  assert.equal(a.nukeCooldown, 30);
  a.step(0, { ...idle, ability: true });
  const x = a.player.x;
  a.step(STEP, idle);
  assert.equal(a.player.boosting, true);
  assert.equal(a.player.mass, 18);
  assert.ok(Math.abs(a.player.x - x - BASE_SPEED * 1.7 * STEP) < 1e-8);
  advance(a, Math.round((TRANSFORMATION_DURATION - STEP) / STEP));
  assert.equal(a.transformation, undefined);
  assert.ok(Math.abs(a.nukeCooldown - 22) < 1e-9);
  assert.equal(bot.alive, true);
});

test("Nine-Tail head contacts credit one rival, while player immunity never protects the arena edge", () => {
  const a = arena("ember"), target = rival(a, 1.2, 0, 1);
  a.activateNuke(a.player);
  a.step(0, idle);
  assert.equal(target.alive, false);
  assert.equal(a.player.alive, true);
  assert.equal(a.player.kills, 1);
  assert.equal(a.events.filter(e => e.type === "player-elimination").length, 1);
  assert.equal(a.events.filter(e => e.type === "transform-hit" && e.ultimate === "nine-tail").length, 1);
  assert.ok(a.food.length > 0);

  const edge = arena("ember");
  edge.player.x = RADIUS - 1;
  edge.activateNuke(edge.player);
  edge.step(0, idle);
  assert.equal(edge.player.alive, false);
  assert.equal(edge.transformation, undefined);
  assert.equal(edge.playerRespawnRemaining, 3);
});

test("Nine-Tail only weaponizes Kitsu's head; the trailing coil remains non-lethal", () => {
  const a = arena("ember"), target = rival(a, 4, 0, 1);
  a.activateNuke(a.player);
  a.reindex();
  target.body = target.body.map((_, i) => ({ x: target.x + i * .72, z: target.z }));
  // The rival is far from Kitsu's head, and no body-to-body damage rule exists.
  a.step(0, idle);
  assert.equal(target.alive, true);
  assert.equal(a.player.kills, 0);
});

test("both forms absorb rival collision damage and Ki knockback but still receive boundary deaths", () => {
  for (const character of ["ember", "cloud"] as const) {
    const a = arena(character), target = rival(a, -4, 0, 1);
    a.activateNuke(a.player);
    // The rival head touches the player's trailing coil. The player is safe; ordinary credit remains.
    a.step(0, idle);
    assert.equal(a.player.alive, true);
    assert.equal(target.alive, false);
    assert.equal(a.player.kills, 1);
  }

  const a = arena("cloud");
  rival(a, 70, 50, 1);
  a.activateNuke(a.player);
  a.projectiles.push({ id: 0, ownerId: 1, x: -1, z: 0, previous: { x: -1, z: 0 }, direction: 0, remaining: 24, radius: .65 });
  a.step(0, idle);
  assert.equal(a.player.knockback, undefined);
  assert.equal(a.events.some(e => e.type === "ki-impact" && e.targetId === 0), true);
});

test("Skybreaker launches captured forward punches on schedule and eliminates only the first swept target", () => {
  const a = arena("cloud"), first = rival(a, 10, 0, 1), second = rival(a, 17, 0, 2);
  assert.equal(a.activateNuke(a.player), true);
  advance(a, 20);
  assert.equal(a.skyPunches.length, 0);
  a.step(STEP, idle);
  assert.equal(a.skyPunches.length, 1);
  assert.equal(a.skyPunches[0].direction, 0);
  assert.equal(a.events.filter(e => e.type === "transform-launch").length, 1);
  assert.equal(a.player.mass, 18);
  let hitEvents = 0;
  for (let i = 0; i < 10; i++) { a.step(STEP, idle); hitEvents += a.events.filter(e => e.type === "transform-hit").length; }
  assert.equal(first.alive, false);
  assert.equal(second.alive, true);
  assert.equal(a.player.kills, 1);
  assert.equal(hitEvents, 1);
  assert.equal(a.player.active, 0, "V must not replace Pomu's E state");
});

test("Skybreaker keeps E steering, normal boost cost, fixed projectile parameters, and later aim", () => {
  const a = arena("cloud");
  a.activateNuke(a.player);
  a.step(0, { ...idle, ability: true });
  assert.equal(a.player.active, 3);
  a.player.mass = 30;
  a.step(STEP, { ...idle, boost: true });
  assert.ok(a.player.mass < 30);
  const launches: number[] = [];
  const capture = () => { for (const event of a.events) if (event.type === "transform-launch") launches.push(event.direction!); };
  for (let i = 0; i < 20; i++) { a.step(STEP, idle); capture(); }
  for (let i = 0; i < 39; i++) { a.step(STEP, { ...idle, angle: Math.PI / 2 }); capture(); }
  assert.equal(launches.length, 2);
  assert.equal(launches[0], 0, "the first punch captures the activation-facing direction");
  assert.ok(Math.abs(launches[1] - Math.PI / 2) < 0.05, "later punches capture the then-current facing");
  assert.equal(SKY_PUNCH_FIRST, .35);
  assert.equal(SKY_PUNCH_INTERVAL, .65);
  assert.equal(SKY_PUNCH_RANGE, 18);
  assert.equal(SKY_PUNCH_SPEED, 46);
  assert.equal(SKY_PUNCH_RADIUS, 1.1);
});

test("Skybreaker swept contacts tie-break by stable snake ID and clean up on expiry, pause, death, and practice", () => {
  const a = arena("cloud"), high = rival(a, 10, 1.5, 9), low = rival(a, 10, -1.5, 3);
  high.body = high.body.map((_, i) => ({ x: 10 + i * .72, z: 1.5 }));
  low.body = low.body.map((_, i) => ({ x: 10 + i * .72, z: -1.5 }));
  a.activateNuke(a.player);
  a.skyPunches.push({ id: 0, x: 8, z: 0, previous: { x: 8, z: 0 }, direction: 0, remaining: SKY_PUNCH_RANGE, radius: SKY_PUNCH_RADIUS });
  a.step(.05, idle);
  assert.equal(low.alive, false);
  assert.equal(high.alive, true);
  assert.equal(a.player.kills, 1);

  const timed = arena("cloud"); timed.activateNuke(timed.player);
  timed.state = "paused"; const before = JSON.stringify([timed.transformation, timed.nukeCooldown, timed.skyPunches]);
  timed.step(2, idle); assert.equal(JSON.stringify([timed.transformation, timed.nukeCooldown, timed.skyPunches]), before);
  timed.state = "playing"; advance(timed, 480); assert.equal(timed.transformation, undefined); assert.equal(timed.skyPunches.length, 0);
  const practice = new Arena("cloud", () => .5, 0, 0, "practice"); assert.equal(practice.activateNuke(practice.player), false);
});

test("a sprint deadline ends an active transformation before another playable step", () => {
  const a = new Arena("ember", () => .5, 0, 0, "sprint");
  a.elapsed = SPRINT_DURATION - STEP;
  assert.equal(a.activateNuke(a.player), true);
  a.step(STEP, idle);
  assert.equal(a.state, "over");
  assert.equal(a.endReason, "time");
  assert.equal(a.elapsed, SPRINT_DURATION);
  assert.equal(a.transformation, undefined);
  assert.equal(a.skyPunches.length, 0);
});
