import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arena, NUKE_BLAST, NUKE_DURATION, RADIUS, SPRINT_DURATION, STEP } from '../src/simulation.ts';
import { ULTIMATES, ultimateFor } from '../src/ultimates.ts';

const idle = { angle: 0, boost: false, ability: false };
const advance = (arena: Arena, count: number) => { for (let i=0; i<count; i++) arena.step(STEP,idle); };

test('all four stable character IDs have 5.6-second player-only cinematics', () => {
  assert.deepEqual(Object.keys(ULTIMATES), ['eclipse','nova','ember','cloud']);
  assert.deepEqual(Object.values(ULTIMATES).map(ultimate => ultimate.id), ['purple','spirit','fox','skybreaker']);
  for (const ultimate of Object.values(ULTIMATES)) {
    assert.equal(ultimate.mode,'cinematic');
    assert.equal(ultimate.duration,NUKE_DURATION);
    assert.equal(ultimate.cooldown,30);
  }
  assert.equal(ultimateFor('cloud').name,'Skybreaker Slam');
});

test('Skybreaker freezes positions, credits each living rival once at impact, and delays respawns', () => {
  let seed=123;
  const arena = new Arena('cloud',()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),0,0);
  const a = arena.createSnake(1,'A','ember',{x:12,z:7},0);
  const b = arena.createSnake(2,'B','nova',{x:-18,z:3},0);
  arena.snakes.push(a,b);
  const positions=arena.snakes.slice(1).map(s=>JSON.stringify([s.x,s.z,s.body]));
  assert.equal(arena.activateNuke(a),false);
  assert.equal(arena.activateNuke(arena.player),true);
  assert.equal(arena.activateNuke(arena.player),false);
  assert.equal(arena.cinematic?.kind,'skybreaker');
  advance(arena,Math.round(NUKE_BLAST/STEP)-1);
  assert.deepEqual(arena.snakes.slice(1).map(s=>JSON.stringify([s.x,s.z,s.body])),positions);
  assert.equal(arena.player.kills,0);
  while(!arena.cinematic!.detonated) arena.step(STEP,idle);
  assert.equal(arena.player.kills,2);
  assert.equal(arena.player.alive,true);
  assert.deepEqual(arena.events.filter(e=>e.type==='player-elimination').map(e=>e.id),[1,2]);
  assert.ok(arena.food.length>0);
  arena.step(STEP,idle);
  assert.equal(arena.events.filter(e=>e.type==='player-elimination').length,0);
  while(arena.cinematic) arena.step(STEP,idle);
  assert.equal(arena.snakes.filter(s=>s.alive).length,1);
  advance(arena,181);
  assert.equal(arena.snakes.filter(s=>s.alive).length,3);
});

test('Skybreaker pause, boundary impact, cooldown, sprint deadline and restart are authoritative', () => {
  const arena=new Arena('cloud',()=>.5,0,0,'sprint');
  arena.elapsed=SPRINT_DURATION-STEP;
  arena.player.x=RADIUS-1;
  assert.equal(arena.activateNuke(arena.player),true);
  assert.ok(Math.hypot(arena.cinematic!.impact.x,arena.cinematic!.impact.z)<=RADIUS-18+.001);
  arena.state='paused';arena.step(2,idle);
  assert.equal(arena.cinematic!.time,0);
  assert.equal(arena.nukeCooldown,30);
  arena.state='playing';arena.step(STEP,idle);
  assert.equal(arena.state,'playing');
  while(arena.cinematic)arena.step(STEP,idle);
  assert.equal(arena.state,'over');
  assert.equal(arena.endReason,'time');
  assert.equal(arena.elapsed,SPRINT_DURATION);
  const fresh=new Arena('cloud',()=>.5,0,0);
  assert.equal(fresh.cinematic,undefined);
  assert.equal(fresh.nukeCooldown,0);
  const practice=new Arena('cloud',()=>.5,0,0,'practice');
  assert.equal(practice.activateNuke(practice.player),false);
});

test('Pomu Elastic Twist timing and turn speed are unchanged outside a cinematic',()=>{
  const a=new Arena('cloud',()=>.5,0,0);
  assert.equal(a.activate(a.player),true);
  assert.equal(a.player.active,3);
  assert.equal(a.player.cooldown,10);
  a.step(STEP,{...idle,angle:Math.PI});
  assert.ok(a.player.angle>2.65*STEP);
  assert.equal(a.player.boosting,false);
});
