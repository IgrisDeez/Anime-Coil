import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Arena, STEP, NUKE_BLAST, NUKE_DURATION, RADIUS, SPRINT_DURATION, BASE_SPEED } from '../src/simulation.ts';
import { FoxCinematic, foxTailGeometry } from '../src/fox.ts';
import { createFoxSummon } from '../src/fox-model.ts';
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
      a.cinematic!.time=time;a.cinematic!.detonated=time>=NUKE_BLAST;camera.position.set(0,48,27);camera.lookAt(0,0,0);
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
  assert.ok(orb.scale.x>11);
  assert.ok(new THREE.Vector3().copy(fx.staging.bombCenter).distanceTo(fx.staging.muzzle)>orb.scale.x+2.7);
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
  const mouthToBomb=new THREE.Vector3().copy(fx.staging.bombCenter).sub(fx.staging.muzzle);
  assert.ok(Math.abs(mouthToBomb.length()-orb.scale.x-2.8)<1e-8,'charge has radius-based muzzle clearance');
  assert.ok(mouthToBomb.normalize().distanceTo(fx.staging.firingDirection)<1e-8,'charge follows the displayed jaw direction');
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

test('golden fox has closed finite sculpted volumes, separate jaws, limb markings, and isolated materials',()=>{
  const a=createFoxSummon(),b=createFoxSummon();
  assert.equal(a.meshes.length,4);
  assert.equal(a.muzzle.parent,a.head);
  assert.ok(a.head.position.y>15&&Math.abs(a.leftPaw.position.x)>3);
  for(let i=0;i<a.meshes.length;i++){
    const mesh=a.meshes[i];assert.notEqual(mesh.material,b.meshes[i].material);
    for(const attribute of ['position','normal','color','uv']){
      const buffer=mesh.geometry.getAttribute(attribute);
      for(const value of buffer.array)assert.ok(Number.isFinite(value));
    }
    const normals=mesh.geometry.getAttribute('normal');
    for(let j=0;j<normals.count;j++)assert.ok(Math.hypot(normals.getX(j),normals.getY(j),normals.getZ(j))>.9);
  }
  const torso=a.meshes[0].geometry.boundingBox!;
  assert.ok(torso.min.y<.2&&torso.max.y>15&&torso.max.x>6,'bent legs connect the chest to grounded feet');
  assert.ok(a.meshes[1].geometry.boundingBox!.max.z>5,'jaw is a long fox muzzle');
  const tail=foxTailGeometry();assert.ok(tail.index&&tail.getAttribute('color'));
  const color=tail.getAttribute('color');let hasInk=false;
  for(let i=0;i<color.count;i++)if(color.getX(i)<.1&&color.getY(i)<.05)hasInk=true;
  assert.equal(hasInk,true,'tail fan retains dark inner stripes');tail.dispose();
  for(const model of [a,b])for(const mesh of model.meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}
});

test('fox muzzle anchor follows charge poses and launch wake follows the actual trajectory',()=>{
  const scene=new THREE.Scene(),fx=new FoxCinematic(scene),a=new Arena('ember',()=>.5,0,0),camera=new THREE.PerspectiveCamera(43,16/9,.1,600);
  a.activateNuke(a.player);
  const orb=fx.group.getObjectByName('fox-bomb-core') as THREE.Mesh;
  for(const time of [.9,1.5,2.4,2.5]){
    a.cinematic!.time=time;camera.position.set(0,48,27);camera.lookAt(0,0,0);fx.update(a,camera,false);
    const anchor=fx.group.getObjectByName('fox-muzzle-anchor')!.getWorldPosition(new THREE.Vector3());
    assert.ok(anchor.distanceTo(fx.staging.muzzle)<1e-8);
    const displacement=new THREE.Vector3().copy(fx.staging.bombCenter).sub(anchor);
    assert.ok(Math.abs(displacement.length()-orb.scale.x-2.8)<1e-8);
    assert.ok(displacement.normalize().distanceTo(fx.staging.firingDirection)<1e-8);
  }
  a.cinematic!.time=3.1;fx.update(a,camera,false);fx.group.updateMatrixWorld(true);
  const wake=fx.group.children.find(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.ConeGeometry) as THREE.Mesh;
  const tip=new THREE.Vector3(0,.5,0).applyMatrix4(wake.matrixWorld);
  assert.ok(tip.distanceTo(fx.staging.bombCenter)<1e-8,'the cone tip touches the moving bomb');
  a.cinematic!.time=2.4;camera.position.set(0,48,27);camera.lookAt(0,0,0);const normalPose=camera.quaternion.clone();
  fx.update(a,camera,false,false,false);
  assert.deepEqual(camera.position.toArray(),[0,48,27]);assert.equal(camera.quaternion.angleTo(normalPose),0,'Camera Off preserves gameplay framing');
  assert.ok(Math.hypot(fx.staging.bombCenter.x-a.player.x,fx.staging.bombCenter.z-a.player.z)>orb.scale.x+4,'retained-camera charge clears the player');
  fx.clear();assert.equal(fx.staging.active,false);assert.deepEqual({...fx.staging.muzzle},{x:0,y:0,z:0});
  assert.equal(orb.visible,false);fx.dispose();
});

test('staged fox cameras fit model and orb bounds on desktop, short windows and phones, including arena edges',()=>{
  const fx=new FoxCinematic(new THREE.Scene()),camera=new THREE.PerspectiveCamera(43,16/9,.1,600);
  for(const edge of [false,true])for(const aspect of [16/9,2.5,390/844]){
    const a=new Arena('ember',()=>.5,0,0);if(edge){a.player.x=RADIUS-1;a.player.z=0;}
    a.activateNuke(a.player);const impact={...a.cinematic!.impact};
    camera.aspect=aspect;camera.updateProjectionMatrix();
    for(const time of [.9,1.5,2.4,2.7,3.3,3.5,4.1]){
      a.cinematic!.time=time;a.cinematic!.detonated=time>=3.4;camera.position.set(a.player.x,48,27);camera.lookAt(a.player.x,0,0);fx.update(a,camera,false);camera.updateMatrixWorld(true);
      const bounds=fx.staging.summonBounds;
      for(let i=0;i<8;i++){
        const point=new THREE.Vector3(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).project(camera);
        assert.ok(Math.abs(point.x)<.98&&Math.abs(point.y)<.98&&point.z<1,`fox framing ${edge}/${aspect}/${time}`);
      }
      if(time<3.4){
        const point=new THREE.Vector3().copy(fx.staging.bombCenter).project(camera);assert.ok(Math.abs(point.x)<.95&&Math.abs(point.y)<.95,'bomb remains in frame');
      }
      assert.deepEqual(a.cinematic!.impact,impact,'visual edge staging cannot move the damage anchor');
    }
    // Connected stage boundaries have no hard camera position or orientation cuts.
    for(const boundary of [.55,.65,.9,1.55,2.5,3.4,4.3,4.35,5.6]){
      a.cinematic!.time=boundary-.001;a.cinematic!.detonated=boundary-.001>=3.4;camera.position.set(a.player.x,48,27);camera.lookAt(a.player.x,0,0);fx.update(a,camera,false);const before=camera.position.clone(),rotation=camera.quaternion.clone();
      a.cinematic!.time=boundary+.001;a.cinematic!.detonated=boundary+.001>=3.4;camera.position.set(a.player.x,48,27);camera.lookAt(a.player.x,0,0);fx.update(a,camera,false);
      assert.ok(before.distanceTo(camera.position)<1.5,`position continuity at ${boundary}`);assert.ok(rotation.angleTo(camera.quaternion)<.03,`rotation continuity at ${boundary}`);
    }
    a.cinematic!.time=5.2;camera.position.set(a.player.x,48,27);camera.lookAt(a.player.x,0,0);fx.update(a,camera,false);camera.updateMatrixWorld(true);
    const returningPlayer=new THREE.Vector3(a.player.x,1.5,a.player.z).project(camera);
    assert.ok(Math.abs(returningPlayer.x)<.98&&Math.abs(returningPlayer.y)<.98,'recovery restores a readable player view');
  }
  fx.dispose();
});

test('fox frozen poses and repeated clear/reactivation reset anchors, shader state and every pooled layer',()=>{
  const fx=new FoxCinematic(new THREE.Scene()),camera=new THREE.PerspectiveCamera(43,16/9,.1,600);
  const resetCamera=()=>{camera.position.set(0,48,27);camera.lookAt(0,0,0);};
  for(let cycle=0;cycle<6;cycle++){
    const a=new Arena('ember',()=>.5,0,0);a.activateNuke(a.player);a.cinematic!.time=2.1;
    resetCamera();fx.update(a,camera,false);fx.group.updateMatrixWorld(true);
    const pose=JSON.stringify(fx.group.toJSON()),anchor=JSON.stringify(fx.staging);
    a.state='paused';a.step(STEP,idle);resetCamera();fx.update(a,camera,false);fx.group.updateMatrixWorld(true);
    assert.equal(JSON.stringify(fx.group.toJSON()),pose);assert.equal(JSON.stringify(fx.staging),anchor);
    a.cinematic!.time=3.65;a.cinematic!.detonated=true;resetCamera();fx.update(a,camera,false);
    fx.clear();assert.equal(fx.staging.active,false);
    assert.deepEqual({...fx.staging.bombCenter},{x:0,y:0,z:0});
    for(const part of fx.group.children)if(part instanceof THREE.Mesh||part instanceof THREE.Points||part instanceof THREE.LineSegments){
      assert.equal(part.visible,false,'every transient layer is hidden after cleanup');
      if(part instanceof THREE.InstancedMesh)assert.equal(part.count,0);
      if(part.material instanceof THREE.ShaderMaterial){assert.equal(part.material.uniforms.time.value,0);assert.equal(part.material.uniforms.alpha.value,0);}
    }
    resetCamera();fx.update(undefined,camera,false);assert.equal(fx.group.visible,false);
    a.state='playing';a.cinematic!.time=1.5;a.cinematic!.detonated=false;
    resetCamera();fx.update(a,camera,false);assert.equal(fx.group.visible,true);
    a.player.alive=false;fx.update(a,camera,false);assert.equal(fx.staging.active,false,'death clears a stale cinematic');
    a.player.alive=true;a.state='over';fx.update(a,camera,false);assert.equal(fx.staging.active,false,'match end clears a stale cinematic');
  }
  fx.dispose();
});
