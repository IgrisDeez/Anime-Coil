import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const out=path.resolve('docs/living-shibuya-1.7.7/cinematic');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),results=[],errors=[];
try{
 for(const [label,width,height] of [['desktop',1440,900],['phone',390,844]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,recordVideo:{dir:path.join(out,'raw-video'),size:{width,height}}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  await page.goto('http://127.0.0.1:4175/?simBench&perfDebug');await page.waitForFunction(()=>!!window.simPerf);await page.locator('.character[data-character="cloud"]').click();
  await page.evaluate(()=>{simPerf.reset('ordinary',false,false);document.querySelector('.character[data-character="cloud"]').click();document.querySelector('#restart').click();const a=simPerf.arena;a.state='playing';a.activateNuke(a.player);window.ultimateTrace=[];const record=()=>{const s=simPerf.arena.cinematic,v=simPerf.view;if(s){ultimateTrace.push({time:s.time,detonated:s.detonated,kills:simPerf.arena.player.kills,alive:simPerf.arena.snakes.filter(s=>s.id!==0&&s.alive).length,keyframe:v.ultimateVisual?.keyframe,draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles});requestAnimationFrame(record);}};requestAnimationFrame(record);});
  // Held-stage screenshots are captured separately. Screenshot encoding must not interrupt
  // this continuously advancing 5.6-second recording or skip its later stages.
  await page.waitForFunction(()=>!simPerf.arena.cinematic);
  const data=await page.evaluate(()=>({trace:ultimateTrace,kills:simPerf.arena.player.kills,head:simPerf.view.visuals.get(0).head.visible,form:simPerf.view.visuals.get(0).formHead?.visible??false,blast:simPerf.view.ultimateDiagnostics}));const kill=data.trace.find(f=>f.detonated);assert.equal(kill.kills,20);assert.equal(kill.alive,0);assert.equal(kill.keyframe,true);assert.equal(data.head,true);assert.equal(data.form,false);assert.ok(data.blast.batches.every(b=>!b.count));results.push({label,...data});await page.screenshot({path:path.join(out,`${label}-complete.png`)});const video=page.video();await context.close();await video.saveAs(path.join(out,`${label}-gear5-complete.webm`));console.log(label,JSON.stringify({kill:kill.time,kills:data.kills,normalHead:data.head}));
 }
 assert.deepEqual(errors,[]);
}finally{await fs.writeFile(path.join(out,'live-validation.json'),JSON.stringify({results,errors},null,2));await browser.close();}
