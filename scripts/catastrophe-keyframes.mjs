// Freeze browser scheduling immediately after the real application's first kill render.
// Arena stepping, wipe logic, DOM presentation and submitted geometry remain unchanged.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const out=path.resolve('docs/ultimate-catastrophe/application');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),results=[];
try {
  for(const [label,width,height] of [['desktop',1440,900],['phone',390,844]])for(const [id,kind] of [['ember','fox'],['nova','spirit'],['eclipse','purple'],['cloud','skybreaker']]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();
    await page.addInitScript(()=>{
      const raf=window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame=callback=>raf(time=>{if(!window.freezeKillRender)callback(time);});
    });
    await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
    await page.goto('http://127.0.0.1:4175/?simBench');await page.waitForFunction(()=>!!window.simPerf);
    await page.evaluate(id=>{
      simPerf.reset('ordinary',false,false);document.querySelector(`.character[data-character="${id}"]`).click();document.querySelector('#restart').click();
      const view=simPerf.view,render=view.renderer.render.bind(view.renderer);
      view.renderer.render=(scene,camera)=>{
        render(scene,camera);
        if(view.ultimateVisual.keyframe){
          window.freezeKillRender=true;
          window.killRender={time:simPerf.arena.cinematic.time,kills:simPerf.arena.player.kills,alive:simPerf.arena.snakes.filter(s=>s.id!==0&&s.alive).length,visual:{...view.ultimateVisual},blast:view.ultimateDiagnostics};
        }
      };
      simPerf.arena.state='playing';simPerf.arena.activateNuke(simPerf.arena.player);
    },id);
    await page.waitForFunction(()=>!!window.freezeKillRender,null,{polling:50});
    const data=await page.evaluate(()=>window.killRender);
    assert.equal(data.kills,20);assert.equal(data.alive,0);assert.equal(data.visual.keyframe,true);assert.ok(data.blast.batches[0].count>0);
    await page.screenshot({path:path.join(out,`${label}-${kind}-exact-keyframe.png`)});
    results.push({label,id,kind,...data});await context.close();
  }
}finally {await fs.writeFile(path.join(out,'exact-keyframes.json'),JSON.stringify(results,null,2));await browser.close();}
console.log(JSON.stringify({exactKillFrames:results.length}));
