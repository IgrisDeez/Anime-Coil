import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const baseline=process.argv.includes('--baseline');
const out=path.resolve(`docs/ultimate-catastrophe/${baseline?'v175-application':'application'}`);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),results=[],errors=[];
try{
 for(const [label,width,height] of [['desktop',1440,900],['phone',390,844]]){
  for(const [id,kind] of [['ember','fox'],['nova','spirit'],['eclipse','purple'],['cloud','skybreaker']]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,recordVideo:{dir:path.join(out,'raw-video'),size:{width,height}}}),page=await context.newPage();
   page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
   await page.goto(`http://127.0.0.1:${baseline?4176:4175}/?simBench&perfDebug`);await page.waitForFunction(()=>!!window.simPerf);
   await page.evaluate(id=>{
    simPerf.reset('ordinary',false,false);document.querySelector(`.character[data-character="${id}"]`).click();document.querySelector('#restart').click();
    const a=simPerf.arena;a.state='playing';a.activateNuke(a.player);window.ultimateTrace=[];
    const record=()=>{const shot=simPerf.arena?.cinematic,v=simPerf.view,f=v.ultimateVisual;
      if(shot){ultimateTrace.push({time:shot.time,wallMs:performance.now(),detonated:shot.detonated,kills:simPerf.arena.player.kills,alive:simPerf.arena.snakes.filter(s=>s.id!==0&&s.alive).length,keyframe:f?.keyframe??document.querySelector('#cinematic').className.includes('impact-keyframe'),phase:f?.phase,coreVisible:v.ultimateDiagnostics?.batches[0].count>0,draws:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,fov:v.camera.fov});requestAnimationFrame(record);}
    };requestAnimationFrame(record);
   },id);
   for(const [stage,time] of [['charge',2.15],['compression',3.25],['kill-beat',3.4],['expansion',3.65],['aftermath',4.5]]){
    await page.waitForFunction(t=>simPerf.arena.cinematic?.time>=t,time);await page.screenshot({path:path.join(out,`${label}-${kind}-${stage}.png`)});
   }
   await page.waitForFunction(()=>!simPerf.arena.cinematic);
   const data=await page.evaluate(()=>({trace:ultimateTrace,kills:simPerf.arena.player.kills,head:simPerf.view.visuals.get(0).head.visible,form:simPerf.view.visuals.get(0).formHead?.visible??false,blast:simPerf.view.ultimateDiagnostics}));
   const first=data.trace.find(s=>s.detonated);assert.equal(first?.kills,20);assert.equal(first?.alive,0);if(!baseline){assert.equal(first?.keyframe,true);assert.equal(first?.coreVisible,true);}
   assert.equal(data.head,true);assert.equal(data.form,false);if(!baseline)assert.equal(data.blast.batches.every(b=>b.count===0),true);
   results.push({label,id,kind,...data});await page.screenshot({path:path.join(out,`${label}-${kind}-complete.png`)});
   const video=page.video();await context.close();await video.saveAs(path.join(out,`${label}-${kind}.webm`));
   console.log(label,kind,JSON.stringify({firstKill:first?.time,keyframe:first?.keyframe,kills:data.kills,restored:data.head}));
  }
 }
 assert.deepEqual(errors,[]);
}finally{await fs.writeFile(path.join(out,'live-wipe-validation.json'),JSON.stringify({results,errors},null,2));await browser.close();}
