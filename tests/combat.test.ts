import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arena, CHARACTERS, STEP, BASE_SPEED, RADIUS, KI_CHARGE, KI_RANGE, KI_SPEED, KI_RADIUS, KI_IMPULSE, KI_IMPULSE_DURATION, type CharacterId, type Serpent } from '../src/simulation.ts';
const input = { angle: 0, ability: false, boost: false };
function arena(id: CharacterId = 'nova') {
  const a = new Arena(id, () => .5, 0, 0);
  a.ai = s => ({ ...input, angle: s.angle });
  return a;
}
function rival(a: Arena, x: number, z: number, id = 1) {
  const s = a.createSnake(id, 'Test rival', 'cloud', {x, z}, Math.PI / 2);
  a.snakes.push(s);
  return s;
}
function bolt(a: Arena, x: number, z: number, direction = 0, ownerId = 0, remaining = KI_RANGE) {
  a.projectiles.push({id: a.projectiles.length, ownerId, x, z, previous: {x,z}, direction, radius: KI_RADIUS, remaining});
}
const advance = (a: Arena, count: number) => { for (let i=0;i<count;i++) a.step(STEP, input); };

test('display names change without changing stable IDs or equal base speeds', () => {
  assert.deepEqual(CHARACTERS.map(c=>[c.id,c.name,c.power]), [
    ['ember','Kitsu','Fox Rush'],['nova','Kairo','Ki Cannon'],['cloud','Pomu','Elastic Twist'],['eclipse','Shiro','Infinity Veil'],
  ]);
  for (const c of CHARACTERS) { const a=arena(c.id); a.step(STEP,input); assert.equal(a.player.x, BASE_SPEED*STEP); }
});
test('Ki Cannon charges once, locks aim, launches from the moving head, and starts a ten second cooldown', () => {
  const a=arena(); a.step(0,{...input,ability:true});
  assert.equal(a.player.charge?.remaining, KI_CHARGE);
  assert.equal(a.player.cooldown,10);
  assert.equal(a.activate(a.player),false);
  for(let i=0;i<17;i++) a.step(STEP,{...input,angle:Math.PI/2});
  assert.equal(a.projectiles.length,0);
  const headX=a.player.x;
  a.step(STEP,{...input,angle:Math.PI/2});
  assert.equal(a.projectiles.length,1);
  assert.equal(a.projectiles[0].direction,0);
  assert.ok(a.projectiles[0].x>headX);
  assert.equal(a.player.charge,undefined);
  assert.equal(a.events.filter(e=>e.type==='ki-launch').length,1);
  assert.equal(a.player.boosting,false);
});
test('Cannon range, speed and radius are fixed for small and large casters; self is excluded', () => {
  for(const mass of [18,1000]) {
    const a=arena(); a.player.mass=mass; bolt(a,0,0);
    a.step(.1,input);
    assert.ok(Math.abs(a.projectiles[0].x-KI_SPEED*.1)<1e-8);
    assert.ok(Math.abs(a.projectiles[0].remaining-(KI_RANGE-KI_SPEED*.1))<1e-8);
    assert.equal(a.projectiles[0].radius,KI_RADIUS);
    advance(a,31);
    assert.equal(a.projectiles.length,0);
    assert.equal(a.player.alive,true);
    assert.equal(a.player.knockback,undefined);
  }
});
test('a cannon hit knocks back once without direct damage, shedding or a kill', () => {
  const a=arena(), target=rival(a,10,0);
  bolt(a,9.3,0); a.step(0,input);
  assert.equal(target.alive,true);
  assert.equal(target.mass,18);
  assert.equal(a.food.length,0);
  assert.equal(a.player.kills,0);
  assert.equal(a.projectiles.length,0);
  assert.equal(target.knockback?.x,KI_IMPULSE);
  assert.equal(a.events.filter(e=>e.type==='ki-impact').length,1);
  const x=target.x;
  advance(a,24);
  assert.ok(Math.abs(target.x-x-4)<1e-7);
  assert.equal(target.knockback,undefined);
  assert.equal(a.events.filter(e=>e.type==='ki-impact').length,0);
});
test('swept shots hit a coil between endpoints and stop at the nearest rival', () => {
  const a=arena(), far=rival(a,15,8,2), near=rival(a,8,8,1);
  // Both heads are away from the shot, but their trails cross its path.
  bolt(a,3,0); a.step(.2,input);
  assert.ok(near.knockback);
  assert.equal(far.knockback,undefined);
  assert.equal(a.projectiles.length,0);
});
test('equal contact distances resolve by stable snake ID, not array order', () => {
  const a=arena(), high=rival(a,10,2,9), low=rival(a,10,-2,3);
  // Keep the target snakes separated from one another, equidistant from the shot.
  high.body=high.body.map((_,i)=>({x:10+i*.72,z:2})); high.angle=Math.PI;
  low.body=low.body.map((_,i)=>({x:10+i*.72,z:-2})); low.angle=Math.PI;
  high.mass=low.mass=100;
  bolt(a,8,0); a.step(.05,input);
  assert.equal(a.events.find(e=>e.type==='ki-impact')?.targetId,3);
});
test('a later impulse replaces rather than adds to existing knockback', () => {
  const a=arena(), target=rival(a,10,0);
  target.knockback={x:20,z:0,remaining:.2};
  bolt(a,10,-.7,Math.PI/2); a.step(0,input);
  assert.ok(Math.abs(target.knockback!.x)<1e-8);
  assert.equal(target.knockback!.z,20);
  assert.equal(target.knockback!.remaining,.4);
});
test('knockback uses ordinary boundary deaths and cannot tunnel through a rival coil', () => {
  const a=arena(), target=rival(a,RADIUS-1.2,0);
  target.knockback={x:20,z:0,remaining:.4};
  a.step(.1,input);
  assert.equal(target.alive,false);
  assert.equal(a.player.kills,0);
  assert.ok(a.food.length>0);
  const b=arena(), shoved=rival(b,8,0), wall=rival(b,10,8,2);
  shoved.knockback={x:20,z:0,remaining:.4};
  b.step(.3,input);
  assert.equal(shoved.alive,false);
  assert.equal(b.events.filter(e=>e.type==='death'&&e.id===shoved.id).length,1);
  assert.equal(wall.alive,true);
});
test('normal head and boundary collisions still kill Kairo during charge', () => {
  const a=arena(); rival(a,1,0); a.step(0,{...input,ability:true});
  assert.equal(a.player.alive,false); assert.equal(a.player.charge,undefined);
  const b=arena(); b.player.x=RADIUS-1; b.step(STEP,{...input,ability:true});
  assert.equal(b.player.alive,false); assert.equal(b.player.charge,undefined);
});
test('pause preserves charges, shots and impulses; fresh arenas and ultimates clear them', () => {
  const a=arena(); a.activate(a.player); bolt(a,40,30);
  a.player.knockback={x:20,z:0,remaining:.4}; a.state='paused';
  const before=JSON.stringify([a.player,a.projectiles]);
  a.step(1,{...input,ability:true}); assert.equal(JSON.stringify([a.player,a.projectiles]),before);
  assert.equal(a.activate(a.player),false);
  a.state='playing'; assert.equal(a.activateNuke(a.player),true);
  assert.equal(a.player.charge,undefined); assert.equal(a.player.knockback,undefined); assert.equal(a.projectiles.length,0);
  const fresh=arena(); assert.equal(fresh.projectiles.length,0); assert.equal(fresh.player.cooldown,0); assert.equal(fresh.player.charge,undefined);
});
test('already launched shots survive a bot caster death but unfinished charges do not', () => {
  const a=arena('ember'), caster=rival(a,RADIUS-1,0);
  caster.character='nova'; caster.angle=0; a.activate(caster);
  bolt(a,40,20,0,caster.id);
  a.step(STEP,input);
  assert.equal(caster.alive,false); assert.equal(caster.charge,undefined);
  assert.equal(a.projectiles.length,1);
});
test('Kairo bots target a forward rival rather than nearby food', () => {
  const a=new Arena('ember',()=>.5,0,0);
  const caster=rival(a,0,20); caster.character='nova'; caster.angle=0; caster.botClock=10;
  rival(a,12,20,2); a.reindex();
  assert.equal(a.ai(caster,STEP).ability,true);
  caster.angle=Math.PI; assert.equal(a.ai(caster,STEP).ability,false);
  caster.angle=0; caster.cooldown=1; assert.equal(a.ai(caster,STEP).ability,false);
  caster.cooldown=0; a.step(STEP,input); assert.ok(caster.charge);
});
test('Pomu doubles steering for three seconds with no automatic boost or free mass', () => {
  const a=arena('cloud'), b=arena('ember');
  a.step(STEP,{...input,ability:true,angle:Math.PI/2});
  b.step(STEP,{...input,angle:Math.PI/2});
  assert.ok(Math.abs(a.player.angle-b.player.angle*2)<1e-8);
  assert.equal(a.player.boosting,false); assert.equal(a.player.active,3);
  a.player.mass=30; a.step(STEP,{...input,boost:true}); assert.ok(a.player.mass<30);
  advance(a,181); assert.equal(a.player.active,0);
});
test('Shiro slow is exactly 40%, does not stack, and leaves impulses and steering intact', () => {
  const a=arena('eclipse'), target=rival(a,8,8);
  target.angle=0; a.activate(a.player);
  target.knockback={x:20,z:0,remaining:KI_IMPULSE_DURATION};
  a.step(STEP,input);
  const expected=BASE_SPEED*.6*STEP+20*(STEP-STEP*STEP/(2*.4));
  assert.ok(Math.abs(target.x-8-expected)<1e-8);
  assert.equal(target.frozen,false); assert.equal(a.player.cooldown,12-STEP);
});
test('Cannon expires at the boundary before reaching anything outside', () => {
  const a=arena(); bolt(a,RADIUS-1,0); a.step(.1,input); assert.equal(a.projectiles.length,0);
});
