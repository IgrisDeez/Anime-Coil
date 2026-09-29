import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena, STEP, NUKE_BLAST, NUKE_DURATION, RADIUS, SPRINT_DURATION, BASE_SPEED } from '../src/simulation.ts';
import { FoxCinematic, foxTailGeometry } from '../src/fox.ts';
import { ultimateFrame, UltimateCueTracker } from '../src/ultimate-presentation.ts';
import { reaction } from '../src/worlds/types.ts';

const idle = {angle:0, boost:false, ability:false};
const advance=(a:Arena,n:number)=>{for(let i=0;i<n;i++)a.step(STEP,idle);};
test('fox summon is player-only, rejects cooldown/dead/practice, and removes the old contact payoff',()=>{
  const a=new Arena('ember',()=>.5,0,0);
  const bot=a.createSnake(1,'Rival','ember',{x:1,z:0},0);a.snakes.push(bot);
  assert.equal(a.activateNuke(bot),false);
  assert.equal(a.activateNuke(a.player),true);
  assert.equal(a.cinematic?.kind,'fox');
  assert.equal(a.nukeCooldown,30);assert.equal(a.activateNuke(a.player),false);
  advance(a,60);assert.equal(bot.alive,true);assert.equal(a.player.kills,0);
  assert.equal(a.player.x,0);assert.equal(a.player.mass,18);assert.equal(a.player.boosting,false);
  const practice=new Arena('ember',()=>.5,0,0,'practice');assert.equal(practice.activateNuke(practice.player),false);
  const dead=new Arena('ember',()=>.5,0,0);dead.player.alive=false;assert.equal(dead.activateNuke(dead.player),false);
});
test('fox freezes rivals without pull, kills once at impact, drops energy, and delays respawns',()=>{
  let seed=123; const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const a=new Arena('ember',random,20,0);a.activateNuke(a.player);
  const positions=a.snakes.slice(1).map(s=>JSON.stringify([s.x,s.z,s.body]));
  advance(a,Math.round(NUKE_BLAST/STEP)-1);
  assert.deepEqual(a.snakes.slice(1).map(s=>JSON.stringify([s.x,s.z,s.body])),positions);
  assert.equal(a.player.kills,0);
  while(!a.cinematic!.detonated)a.step(STEP,idle);assert.equal(a.player.kills,20);assert.equal(a.player.alive,true);
  const events=a.events.filter(e=>e.type==='player-elimination');assert.equal(events.length,20);
  assert.equal(new Set(events.map(e=>e.id)).size,20);assert.ok(a.food.length>0);
  a.step(STEP,idle);assert.equal(a.events.filter(e=>e.type==='player-elimination').length,0);
  while(a.cinematic)a.step(STEP,idle);
  assert.equal(a.snakes.filter(s=>s.alive).length,1);
  advance(a,61);assert.equal(a.snakes.filter(s=>s.alive).length,21);assert.equal(a.player.kills,20);
});
test('fox pause, boundary activation, sprint deadline, and fresh match lifecycle follow cinematics',()=>{
  const a=new Arena('ember',()=>.5,0,0,'sprint');a.elapsed=SPRINT_DURATION-STEP;
  a.player.x=RADIUS-1;a.activateNuke(a.player);
  assert.ok(Math.hypot(a.cinematic!.impact.x,a.cinematic!.impact.z)<=RADIUS-18+.001);
  a.state='paused';a.step(2,idle);assert.equal(a.cinematic!.time,0);assert.equal(a.nukeCooldown,30);
  a.state='playing';a.step(STEP,idle);assert.equal(a.state,'playing');assert.equal(a.player.alive,true);
  while(a.cinematic)a.step(STEP,idle);
  assert.equal(a.state,'over');assert.equal(a.endReason,'time');
  const fresh=new Arena('ember',()=>.5,0,0);assert.equal(fresh.cinematic,undefined);assert.equal(fresh.nukeCooldown,0);
});
test('Fox Rush keeps its original three-second free boost and cooldown',()=>{
  const a=new Arena('ember',()=>.5,0,0);a.activate(a.player);
  assert.equal(a.player.active,3);assert.equal(a.player.cooldown,12);
  a.step(STEP,idle);assert.ok(Math.abs(a.player.x-BASE_SPEED*1.7*STEP)<1e-8);assert.equal(a.player.mass,18);
  advance(a,180);assert.equal(a.player.active,0);
});
test('fox timeline cues deduplicate, reset, and reduced motion removes flashes and tracking',()=>{
  const tracker=new UltimateCueTracker();
  for(const [time,stage,cue] of [[0,'summon',undefined],[.9,'charge','gather'],[2.5,'launch','launch'],[3.4,'impact',undefined],[4.3,'recovery','release']] as const){
    assert.equal(ultimateFrame('fox',time).stage,stage);
    assert.deepEqual(tracker.consume('fox',time),cue?[cue]:[]);assert.deepEqual(tracker.consume('fox',time),[]);
    assert.equal(ultimateFrame('fox',time,true).flash,0);assert.equal(ultimateFrame('fox',time,true).cameraWeight,0);
  }
  tracker.reset();assert.deepEqual(tracker.consume('fox',.9),['gather']);
  assert.equal(reaction(undefined,false).light,1);
});
test('fox pooled geometry is bounded, pause-stable, shared safely, and disposed once',()=>{
  for(const profile of ['desktop','mobile'] as const){
    const scene=new THREE.Scene(),fx=new FoxCinematic(scene,profile),a=new Arena('ember',()=>.5,0,0);
    const camera=new THREE.PerspectiveCamera(43,profile==='mobile'?390/844:16/9,.1,600);
    const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    fx.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments||o instanceof THREE.Points){geometry.add(o.geometry);materials.add(o.material as THREE.Material);}});
    a.activateNuke(a.player);
    for(const time of [.3,1.5,2.6,3.5,5.2,NUKE_DURATION]){
      a.cinematic!.time=time;camera.position.set(0,48,27);camera.lookAt(0,0,0);
      fx.update(a,camera,false);assert.equal(fx.group.visible,true);
      let draws=0;fx.group.traverse(o=>{
        if(!(o instanceof THREE.Mesh||o instanceof THREE.LineSegments||o instanceof THREE.Points)||!o.visible)return;
        if(o instanceof THREE.InstancedMesh&&o.count===0)return;
        let parent=o.parent;while(parent){if(!parent.visible)return;parent=parent.parent;}
        draws++;
      });
      assert.ok(draws<=(profile==='mobile'?16:24),`${profile}/${time}: ${draws}`);
      if(time===NUKE_DURATION)assert.ok(camera.position.distanceTo(new THREE.Vector3(0,48,27))<1e-8);
    }
    camera.position.set(0,48,27);camera.lookAt(0,0,0);a.cinematic!.time=1.5;
    fx.update(a,camera,false,true);assert.equal(camera.position.y,48);
    fx.group.updateMatrixWorld(true);const before=JSON.stringify(fx.group.toJSON());fx.update(a,camera,false,true);fx.group.updateMatrixWorld(true);assert.equal(JSON.stringify(fx.group.toJSON()),before);
    a.cinematic=undefined;fx.update(a,camera,false);assert.equal(fx.group.visible,false);
    let disposed=0;geometry.forEach(g=>g.addEventListener('dispose',()=>disposed++));
    materials.forEach(m=>m.addEventListener('dispose',()=>disposed++));fx.dispose();fx.dispose();
    assert.equal(disposed,geometry.size+materials.size);assert.equal(scene.children.length,0);
  }
});

test('fox bomb grows independently of the summon and leaves a broad pooled impact',()=>{
  const scene=new THREE.Scene(),fx=new FoxCinematic(scene),a=new Arena('ember',()=>.5,0,0);
  const camera=new THREE.PerspectiveCamera(43,16/9,.1,600);
  a.activateNuke(a.player);
  const beast=fx.group.getObjectByName('fox-summon') as THREE.Group;
  const orb=fx.group.getObjectByName('fox-bomb-core') as THREE.Mesh;
  const shell=fx.group.getObjectByName('fox-bomb-shell') as THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
  assert.ok(beast && orb && shell);
  a.cinematic!.time=2.4;
  fx.update(a,camera,false);
  assert.equal(beast.scale.x,1.8);
  assert.ok(orb.scale.x>11 && orb.position.z>orb.scale.x);
  assert.equal(shell.visible,true);
  a.cinematic!.time=3.8;a.cinematic!.detonated=true;
  fx.update(a,camera,false);
  assert.equal(beast.scale.x,1.8);
  assert.equal(orb.visible,false);
  assert.equal(shell.visible,true);
  assert.ok(shell.scale.x>20 && shell.material.uniforms.alpha.value>0);
  const rings=fx.group.children.filter(o=>o instanceof THREE.Mesh && o.geometry instanceof THREE.TorusGeometry);
  assert.ok(rings.some(r=>r.scale.x>40));
  fx.dispose();
});

test('fox bomb stays above the ground during launch and leaves staged chakra aftermath',()=>{
  const scene=new THREE.Scene(),fx=new FoxCinematic(scene),a=new Arena('ember',()=>.5,0,0);
  const camera=new THREE.PerspectiveCamera(43,16/9,.1,600);
  a.activateNuke(a.player);
  const orb=fx.group.getObjectByName('fox-bomb-core') as THREE.Mesh;
  for(const time of [2.5,2.75,3,3.3]) {
    a.cinematic!.time=time;camera.position.set(0,48,27);camera.lookAt(0,0,0);fx.update(a,camera,false);
    assert.ok(orb.position.y-orb.scale.y>=.28-1e-8,`ground clearance at ${time}`);
  }
  a.cinematic!.detonated=true;
  a.cinematic!.time=3.55;fx.update(a,camera,false);
  const smoke=fx.group.children.find(o=>o instanceof THREE.InstancedMesh&&o.geometry instanceof THREE.IcosahedronGeometry) as THREE.InstancedMesh;
  const fragments=fx.group.children.find(o=>o instanceof THREE.InstancedMesh&&o.geometry instanceof THREE.TetrahedronGeometry) as THREE.InstancedMesh;
  assert.ok(smoke.count>0&&fragments.count>0);
  a.cinematic!.time=5.5;fx.update(a,camera,false);
  assert.equal(smoke.count,0);assert.equal(fragments.count,0);
  fx.dispose();
});

test('fox summon has poseable face and paws, nine distinct curved tails, and a turbulent chakra core',()=>{
  const tail=foxTailGeometry(),positions=tail.attributes.position as THREE.BufferAttribute;
  assert.ok(positions.count>100);
  for(let i=0;i<positions.count;i++) for(const value of [positions.getX(i),positions.getY(i),positions.getZ(i)]) assert.ok(Number.isFinite(value));
  assert.ok(positions.getY(positions.count-1)>positions.getY(0),'tail tip rises along a rounded curve');
  tail.dispose();
  const scene=new THREE.Scene(),fx=new FoxCinematic(scene),arena=new Arena('ember',()=>.5,0,0);
  const camera=new THREE.PerspectiveCamera(43,16/9,.1,600);camera.position.set(0,48,27);camera.lookAt(0,0,0);
  arena.activateNuke(arena.player);arena.cinematic!.time=.3;fx.update(arena,camera,false);
  const beast=fx.group.getObjectByName('fox-summon') as THREE.Group;
  const head=beast.getObjectByName('fox-head') as THREE.Group;
  const left=beast.getObjectByName('fox-left-paw') as THREE.Group;
  const right=beast.getObjectByName('fox-right-paw') as THREE.Group;
  const tails=beast.children.find(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  const orb=fx.group.getObjectByName('fox-bomb-core') as THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
  assert.ok(head&&left&&right&&tails&&orb);
  assert.equal(tails.count,9);
  const matrices=new Set<string>(),matrix=new THREE.Matrix4();
  for(let i=0;i<9;i++){tails.getMatrixAt(i,matrix);matrices.add(matrix.elements.map(n=>n.toFixed(3)).join(','));}
  assert.equal(matrices.size,9);
  const idleHead=head.rotation.x,idlePaw=left.rotation.x;
  arena.cinematic!.time=2.2;fx.update(arena,camera,false);
  assert.ok(head.rotation.x>idleHead&&left.rotation.x<idlePaw);
  assert.match(orb.material.fragmentShader,/noise3\(vec3 p\)/);
  assert.ok(orb.material.uniforms.pressure.value>.5);
  assert.ok(orb.position.z-orb.scale.z>6,'charge sits ahead of the muzzle rather than over the face');
  for(const aspect of [16/9,390/844]) {
    camera.aspect=aspect;camera.updateProjectionMatrix();camera.position.set(0,48,27);camera.lookAt(0,0,0);
    fx.update(arena,camera,false);fx.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const face=head.getWorldPosition(new THREE.Vector3()).project(camera);
    const bomb=orb.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(Math.abs(face.x)<.95&&Math.abs(face.y)<.95&&Math.abs(bomb.x)<.95&&Math.abs(bomb.y)<.95,`framed at aspect ${aspect}`);
    assert.ok(Math.hypot(face.x-bomb.x,face.y-bomb.y)>.1,`separate focal silhouettes at aspect ${aspect}`);
  }
  arena.cinematic!.time=2.2;camera.position.set(0,48,27);camera.lookAt(0,0,0);fx.update(arena,camera,false,true);
  assert.equal(head.rotation.x,.06);
  assert.equal(left.rotation.x,-.12);
  fx.dispose();
});
