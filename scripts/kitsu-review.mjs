// Browser integration checks against the existing development simulation fixture.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out='../v169-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={checks:[],errors:[]};
try {
 for(const [label,width,height] of [['desktop',1440,900],['phone',390,844]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(label+': '+e.stack));
  const requests=[];page.on('request',r=>{if(r.url().endsWith('.glb'))requests.push(r.url());});
  await page.goto('http://127.0.0.1:4175/?simBench');await page.waitForFunction(()=>!!window.simPerf);
  assert.equal(requests.length,1,'initialization loads only selected profile');assert.ok(requests[0].includes(label==='phone'?'mobile':'desktop'));
  await page.screenshot({path:path.join(out,`${label}-menu-light.png`)});
  // Actual UI settings: dark theme and reduced motion.
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#settings-tab-appearance').click();await page.locator('#theme-toggle').click();
  await page.locator('#settings-dialog .close-button').click();
  await page.screenshot({path:path.join(out,`${label}-menu-dark.png`)});
  for(const map of ['shibuya']){
   await page.evaluate(map=>simPerf.view.setMap(map),map);
   await page.evaluate(()=>{simPerf.reset('ordinary',false,false);const a=simPerf.arena;a.state='paused';const v=simPerf.view;v.render(a,0,1,1/60,true,1);});
   await page.screenshot({path:path.join(out,`${label}-${map}-game.png`)});
   const result=await page.evaluate(()=>{
    const a=simPerf.arena,v=simPerf.view,profile=v.diagnostics().profile;
    let visual=v.visuals.get(0);const normal=visual.head,geometry=[];normal.traverse(o=>{if(o.isMesh)geometry.push(o.geometry);});
    let disposals=0;geometry.forEach(g=>g.addEventListener('dispose',()=>disposals++));
    if(!normal.getObjectByName('KitsuHead_'+profile))throw Error('normal model missing');
    const before=JSON.stringify(a);v.render(a,0,1,1/60,true,1);if(JSON.stringify(a)!==before)throw Error('renderer mutated authoritative state');
    a.state='playing';a.activateNuke(a.player);if(!a.cinematic)throw Error('cinematic activation');a.state='paused';a.cinematic.time=2.2;v.render(a,0,1,1/60,true,2);
    visual=v.visuals.get(0);if(visual.head.visible||!visual.formHead.visible)throw Error('form not displayed');
    a.state='playing';for(let tick=0;a.cinematic&&tick<700;tick++){a.step(1/60,{angle:a.player.angle,boost:false,ability:false});v.handleEvents(a.events,a);}a.state='paused';v.render(a,0,1,1/60,true,3);
    if(!visual.head.visible||visual.formHead.visible||visual.head!==normal)throw Error('normal recovery failed');
    a.eliminate(a.player,false,'Review death');v.handleEvents(a.events,a);v.render(a,0,1,1/60,true,4);if(v.visuals.has(0)||visual.head.parent)throw Error('dead head still attached');
    a.state='playing';for(let tick=0;!a.player.alive&&tick<600;tick++){a.step(1/60,{angle:a.player.angle,boost:false,ability:false});v.handleEvents(a.events,a);}a.state='paused';v.render(a,0,1,1/60,true,5);visual=v.visuals.get(0);if(!visual?.head.visible||!visual.head.getObjectByName('KitsuHead_'+profile))throw Error('respawn head missing');
    a.player.active=1;v.render(a,0,1,1/60,true,6);if(!visual.head.visible)throw Error('Fox Rush changed normal head');a.player.active=0;
    // Larger same-character crowd uses the same asset resources per clone.
    simPerf.reset('ordinary',false,false);const crowd=simPerf.arena;crowd.state='paused';
    for(const s of crowd.snakes){s.character='ember';s.alive=true;s.mass=360;s.body=Array.from({length:360},(_,i)=>({x:s.x+i*.05,z:s.z}));}
    v.start(crowd);v.render(crowd,0,1,1/60,true,7);
    const heads=[...v.visuals.values()].map(x=>x.head),eyes=heads.map(h=>{let result;h.traverse(o=>{if(o.userData.previewEye)result=o;});return result;});
    if(heads.length!==21||heads.some(h=>!h.getObjectByName('KitsuHead_'+profile)))throw Error('crowd heads missing '+JSON.stringify({count:heads.length,profile,names:heads[0]?.children.map(x=>x.name),snakes:a.snakes.length}));
    eyes[0].scale.y=.1;if(eyes[1].scale.y!==1)throw Error('shared blink transform');
    const first=heads[0].getObjectByName('Kitsu_Skin_'+profile),second=heads[1].getObjectByName('Kitsu_Skin_'+profile);
    if(first.geometry!==second.geometry||first.material!==second.material)throw Error('crowd resources not shared');
    v.render(crowd,0,1,1/60,true,8);
    return {profile,crowd:heads.length,normalRestored:true,deathRespawn:true,foxRush:true,independentEyes:true,shared:true,disposals,memory:v.diagnostics().memory};
   });
   assert.equal(result.disposals,0);report.checks.push({label,map,...result});
   await page.screenshot({path:path.join(out,`${label}-${map}-crowd.png`)});
  }
  const switches=await page.evaluate(async()=>{
   const v=simPerf.view,a=simPerf.arena;const urlsBefore=performance.getEntriesByType('resource').filter(x=>x.name.endsWith('.glb')).length;
   for(let i=0;i<12;i++){v.setGraphicsChoice(i%2?'high':'low');await new Promise(r=>setTimeout(r,100));}
   const first=v.diagnostics().memory;
   for(let i=0;i<20;i++){v.start(a);v.render(a,0,1,1/60,true,i+20);v.setMap(['shibuya'][0]);}
   v.setMap('shibuya');v.render(a,0,1,1/60,true,50);
   const second=v.diagnostics().memory;
   v.setHero('ember');v.mode='menu';v.clearEffects();v.render(undefined,0,1,1/60,true,51);
   if(!v.heroHead.getObjectByName('KitsuHead_'+v.diagnostics().profile))throw Error('quit/menu recovery failed');
   return {first,second,urlsBefore,urlsAfter:performance.getEntriesByType('resource').filter(x=>x.name.endsWith('.glb')).length,profile:v.diagnostics().profile};
  });
  assert.equal(requests.length,2,'each profile downloaded at most once');report.checks.push({label,profileSwitches:12,restarts:20,maps:20,quitRestored:true,...switches});
  if(label==='desktop'){
   await page.evaluate(()=>{simPerf.reset('ordinary',false,false);const a=simPerf.arena,v=simPerf.view;a.state='playing';a.activateNuke(a.player);a.cinematic.time=2.2;a.state='paused';v.setMap('shibuya');v.render(a,0,1,1/60,false,100);});
   await page.screenshot({path:path.join(out,'desktop-fox-ultimate.png')});
   await page.evaluate(()=>{const a=simPerf.arena,v=simPerf.view;a.state='playing';for(let tick=0;a.cinematic&&tick<700;tick++){a.step(1/60,{angle:a.player.angle,boost:false,ability:false});v.handleEvents(a.events,a);}a.state='paused';v.render(a,0,1,1/60,true,101);});
   await page.screenshot({path:path.join(out,'desktop-cinematic-recovery.png')});
  }
  // UI restart/quit controls also exercise real main-loop cleanup.
  await page.evaluate(()=>{simPerf.arena.state='playing';});await page.keyboard.press('Escape');await page.locator('#quit').click();
  await page.locator('#play').click();await page.keyboard.press('Escape');await page.locator('#quit').click();
  await page.waitForSelector('#menu:not([hidden])');
  await context.close();
 }
 // A missing network asset still initializes portraits/menu and gameplay.
 const fallback=await browser.newContext({viewport:{width:1440,height:900}});const p=await fallback.newPage();await p.route('**/assets/kitsu/*.glb',r=>r.abort());
 await p.goto('http://127.0.0.1:4175/?simBench');await p.waitForFunction(()=>!!window.simPerf);
 assert.equal(await p.evaluate(()=>!!simPerf.view.heroHead.getObjectByName('KitsuHead_desktop')),false);await p.locator('#play').click();
 assert.equal(await p.evaluate(()=>simPerf.view.diagnostics().snakes>0),true);report.checks.push({fallback:'network abort',menu:true,gameplay:true});await fallback.close();
 assert.deepEqual(report.errors,[]);
}finally{await fs.writeFile(path.join(out,'integration-review.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));

