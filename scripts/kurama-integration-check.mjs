// Exercise the actual application preload, renderer and lifecycle after promotion.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const out=path.resolve('docs/kurama-1.7.4');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),results=[],errors=[];
try{
 for(const [label,width,height,profile] of [['desktop',1440,900,'desktop'],['phone',390,844,'mobile']]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage(),requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',req=>{if(/(?:kurama-|kitsu-head-).*\.glb/.test(req.url()))requests.push(req.url());});
  await page.goto('http://127.0.0.1:4175/?simBench&perfDebug');await page.waitForFunction(()=>!!window.simPerf);
  assert.ok((await page.title()).includes('1.7.4'));assert.equal(requests.filter(u=>u.includes('/kurama-')).length,1);assert.ok(requests.every(u=>u.includes(profile)));
  await page.screenshot({path:path.join(out,label+'-menu.png')});
  await page.evaluate(()=>{simPerf.reset('ordinary',false,false);const a=simPerf.arena;a.state='playing';a.activateNuke(a.player);a.state='paused';});
  for(const [stage,time] of [['summon',.75],['charge',2.15],['launch',2.95],['impact',3.55],['recovery',4.85]]){
   const snapshot=await page.evaluate(t=>{const a=simPerf.arena;a.cinematic.time=t;a.cinematic.detonated=t>=3.4;simPerf.view.render(a,0,1,1/60,false,0);const fx=simPerf.view.fox;return {time:a.cinematic.time,staging:JSON.parse(JSON.stringify(fx.staging)),draws:simPerf.view.measureDrawCalls(),sculpt:!!fx.group.getObjectByName('Kurama_Head_'+simPerf.view.diagnostics().profile)};},time);
   assert.equal(snapshot.sculpt,true);results.push({label,stage,...snapshot});await page.screenshot({path:path.join(out,`${label}-${stage}.png`)});
  }
  const before=await page.evaluate(()=>{const a=simPerf.arena;a.cinematic.time=2.15;a.cinematic.detonated=false;simPerf.view.render(a,0,1,1/60,false,0);const origin=JSON.parse(JSON.stringify(simPerf.view.fox.staging.summonOrigin)),x=a.player.x,angle=a.player.angle;a.player.x+=7;a.player.angle+=.2;return {origin,x,angle};});
  for(const quality of ['low','high','low','high']){
   await page.evaluate(q=>simPerf.view.setGraphicsChoice(q),quality);
   await page.waitForFunction(p=>!!simPerf.view.fox.group.getObjectByName('Kurama_Head_'+p),quality==='low'?'mobile':'desktop');
   const after=await page.evaluate(()=>{simPerf.view.render(simPerf.arena,0,1,1/60,false,0);return {time:simPerf.arena.cinematic.time,origin:JSON.parse(JSON.stringify(simPerf.view.fox.staging.summonOrigin))};});assert.equal(after.time,2.15);assert.deepEqual(after.origin,before.origin);
  }
  for(const p of ['mobile','desktop'])assert.equal(requests.filter(u=>u.includes('/kurama-'+p+'.glb')).length,1);
  await page.evaluate(b=>{simPerf.arena.player.x=b.x;simPerf.arena.player.angle=b.angle;},before);
  const normal=await page.evaluate(()=>{simPerf.arena.cinematic=undefined;simPerf.view.render(simPerf.arena,0,1,1/60,false,0);const v=simPerf.view.visuals.get(simPerf.arena.player.id);return {normal:v.head.visible,transformed:v.formHead?.visible??false};});assert.deepEqual(normal,{normal:true,transformed:false});
  await page.screenshot({path:path.join(out,label+'-restored.png')});
  await page.evaluate(()=>{simPerf.arena.player.alive=false;simPerf.view.render(simPerf.arena,0,1,1/60,false,0);});
  const respawn=await page.evaluate(()=>{simPerf.arena.player.alive=true;simPerf.view.render(simPerf.arena,0,1,1/60,false,0);return simPerf.view.visuals.get(simPerf.arena.player.id).head.visible;});assert.equal(respawn,true);
  await page.evaluate(()=>document.querySelector('#restart').click());const restart=await page.evaluate(()=>({cinematic:!!simPerf.arena.cinematic,alive:simPerf.arena.player.alive}));assert.deepEqual(restart,{cinematic:false,alive:true});
  await page.evaluate(()=>document.querySelector('#quit').click());assert.equal(await page.locator('#menu').isVisible(),true);await page.screenshot({path:path.join(out,label+'-quit.png')});
  results.push({label,normal,respawn,restart,requests});await context.close();
 }
 // Load-failure path in the real application, with the approved bomb still available.
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.route('**/assets/kurama/kurama-mobile.glb',r=>r.abort());
 await page.goto('http://127.0.0.1:4175/?simBench');await page.waitForFunction(()=>!!window.simPerf);
 const fallback=await page.evaluate(()=>({message:document.querySelector('#head-loading')?.textContent,procedural:!simPerf.view.fox.group.getObjectByName('Kurama_Head_mobile'),beast:!!simPerf.view.fox.group.getObjectByName('fox-summon')}));assert.ok(fallback.message?.includes('unavailable'));assert.equal(fallback.procedural,true);assert.equal(fallback.beast,true);results.push({fallback});await page.screenshot({path:path.join(out,'phone-fallback.png')});await context.close();
 assert.deepEqual(errors,[]);
}finally{await fs.writeFile(path.join(out,'browser-validation.json'),JSON.stringify({results,errors},null,2));await browser.close();}
console.log(JSON.stringify({checks:'passed',errors,results:results.length}));
