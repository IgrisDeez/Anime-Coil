import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const baseline=process.argv.includes('--baseline'),port=baseline?4177:4175;
const out=path.resolve(`docs/living-shibuya-1.7.7/${baseline?'before':'after'}`);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[],errors=[];
function monitor(page){page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
async function open(page){await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));await page.goto(`http://127.0.0.1:${port}/?simBench&perfDebug`);await page.waitForFunction(()=>!!window.simPerf);}
try{
 for(const [label,width,height] of [['desktop',1440,900],['phone',390,844]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage(),requests=[];monitor(page);
  page.on('request',r=>{if(r.url().endsWith('.glb'))requests.push(r.url());});await open(page);
  assert.equal(requests.length,baseline?5:7);assert.ok(requests.every(r=>r.includes(width<600?'mobile':'desktop')));
  for(const [id,name,kind] of [['ember','Kitsu','fox'],['nova','Kairo','spirit'],['cloud','Pomu','skybreaker'],['eclipse','Shiro','purple']]){
   await page.locator(`.character[data-character="${id}"]`).click();
   // Hold the same lobby time so before/after views use identical framing and breathing.
   await page.evaluate(()=>{if(simPerf.arena)simPerf.arena.state='paused';simPerf.view.render(simPerf.arena,6,1,0,true,0);});
   const menu=await page.evaluate(name=>{const v=simPerf.view,p=v.diagnostics().profile,h=v.heroHead.getObjectByName(`${name}_Hair_${p}`);return {profile:p,hair:!!h,locks:h?.userData.lockCount,texture:h?.material.map?.image.width,portrait:document.querySelector(`#portrait-${v.heroId}`).src.startsWith('data:image/'),world:v.diagnostics().environment};},name);
   assert.equal(menu.hair,true);assert.equal(menu.locks,id==='ember'?27:25);assert.equal(menu.texture,width<600?256:512);assert.equal(menu.portrait,true);
   if(!baseline){assert.ok(menu.world.drawCalls<=(width<600?80:120));assert.ok(menu.world.triangles<=(width<600?75000:150000));assert.ok(menu.world.materials<=32);assert.equal(menu.world.actors,width<600?24:72);}
   await page.screenshot({path:path.join(out,`${label}-${name.toLowerCase()}-menu.png`)});
   await page.evaluate(id=>{simPerf.reset('ordinary',false,false);document.querySelector(`.character[data-character="${id}"]`).click();document.querySelector('#restart').click();const a=simPerf.arena;a.state='paused';for(const s of a.snakes)s.character=id;simPerf.view.start(a);simPerf.view.render(a,6,1,0,false,0);},id);
   const crowd=await page.evaluate(name=>{const v=simPerf.view,p=v.diagnostics().profile,heads=[...v.visuals.values()].filter(h=>h.character===v.visuals.get(0).character),a=heads[0].head.getObjectByName(`${name}_Hair_${p}`),b=heads[1].head.getObjectByName(`${name}_Hair_${p}`),ae=heads[0].eyes[0],be=heads[1].eyes[0],old=be.scale.y;ae.scale.y=.05;const independent=be.scale.y===old;return {count:heads.length,shared:a.geometry===b.geometry&&a.material===b.material&&a.material.map===b.material.map,independent};},name);
   assert.deepEqual(crowd,{count:21,shared:true,independent:true});results.push({label,id,menu,crowd});
   await page.screenshot({path:path.join(out,`${label}-${name.toLowerCase()}-crowd.png`)});
   await page.evaluate(()=>{const a=simPerf.arena;a.state='playing';a.activateNuke(a.player);a.state='paused';});
   for(const [stage,time] of [['summon',.65],['eye-pop',1.45],['charge',2.15],['anticipation',2.6],['launch',3.05],['impact',3.48],['rebound',3.82],['recovery',4.6]]){
    const data=await page.evaluate(time=>{const a=simPerf.arena,v=simPerf.view;a.cinematic.time=time;a.cinematic.detonated=time>=3.4;a.state='playing';const before=JSON.stringify(a);v.prepareUltimateFrame(a,false,false,true,true);v.render(a,6,1,0,false,0);const stateUnchanged=JSON.stringify(a)===before;a.state='paused';return {stateUnchanged,blast:v.ultimateDiagnostics,draws:v.measureDrawCalls(),form:v.visuals.get(0).formHead?.userData.gear5??false,world:v.diagnostics().environment};},time);
    assert.equal(data.stateUnchanged,true);
    if(!baseline&&id==='cloud'){assert.equal(data.form,true);const effect=data.draws.skybreaker??0,shared=data.draws['ultimate-blast']??0;console.log(label,stage,JSON.stringify(data.draws));assert.ok(effect+shared+8<=(width<600?16:24),`Pomu effect draws ${effect+shared+8}`);}
    results.push({label,id,stage,...data});if(id==='cloud'||stage==='impact')await page.screenshot({path:path.join(out,`${label}-${kind}-${stage}.png`)});
   }
   if(!baseline){
    const switches=await page.evaluate(async name=>{const v=simPerf.view,a=simPerf.arena,out=[];for(const choice of ['low','high','low','high']){const time=a.cinematic.time,before=JSON.stringify(a),field=v.environment.cartoon?.time.value;let done;const pending=new Promise(r=>done=r),previous=v.onHeadProfileLoad;v.onHeadProfileLoad=(loading,ready)=>{previous(loading,ready);if(!loading)done(ready);};const expected=choice==='low'?'mobile':'desktop';if(v.diagnostics().profile===expected){v.onHeadProfileLoad=previous;continue;}v.setGraphicsChoice(choice);const ready=await pending;v.onHeadProfileLoad=previous;v.render(a,6,1,0,false,0);out.push({ready,time:a.cinematic.time,preserved:before===JSON.stringify(a)&&time===a.cinematic.time,hair:!!v.visuals.get(0).head.getObjectByName(`${name}_Hair_${expected}`),form:v.visuals.get(0).formHead?.userData.gear5??false});}return out;},name);
    for(const s of switches){assert.equal(s.ready,true);assert.equal(s.preserved,true);assert.equal(s.hair,true);if(id==='cloud')assert.equal(s.form,true);}results.push({label,id,switches});
   }
   const recovery=await page.evaluate(name=>{const a=simPerf.arena,v=simPerf.view;a.cinematic=undefined;v.render(a,6,1,0,false,0);const h=v.visuals.get(0);return {normal:h.head.visible,form:h.formHead?.visible??false,hair:!!h.head.getObjectByName(`${name}_Hair_${v.diagnostics().profile}`)};},name);assert.deepEqual(recovery,{normal:true,form:false,hair:true});
   await page.evaluate(()=>{const a=simPerf.arena,v=simPerf.view;a.player.alive=false;v.render(a,6,1,0,false,0);a.player.alive=true;v.render(a,6,1,0,false,0);});assert.equal(await page.evaluate(()=>simPerf.view.visuals.get(0).head.visible),true);
   await page.evaluate(()=>{document.querySelector('#restart').click();simPerf.arena.state='paused';});assert.equal(await page.evaluate(()=>!!simPerf.arena.cinematic),false);await page.evaluate(()=>document.querySelector('#quit').click());assert.equal(await page.locator('#menu').isVisible(),true);
   if(!baseline){await page.evaluate(choice=>simPerf.view.setGraphicsChoice(choice),width<600?'low':'high');await page.waitForFunction(p=>simPerf.view.diagnostics().profile===p,width<600?'mobile':'desktop');}results.push({label,id,recovery,lifecycle:'passed'});
  }
  if(!baseline){assert.equal(requests.length,14);assert.equal(new Set(requests).size,14);const cycles=await page.evaluate(()=>{const out=[];for(let i=0;i<8;i++){simPerf.reset('ordinary',false,false);simPerf.view.setMap('shibuya');simPerf.view.render(simPerf.arena,6,1,0,true,0);out.push({...simPerf.view.renderer.info.memory});}return out;});assert.deepEqual(cycles.at(-1),cycles.at(-2));results.push({label,requests,cycles});}
  await context.close();
  if(!baseline){
   const comfort=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),p=await comfort.newPage();monitor(p);await p.addInitScript(()=>localStorage.setItem('anime-coil-game-settings-v1',JSON.stringify({version:1,motion:'reduced',reducedFlashes:true,cinematicCamera:false})));await open(p);
   await p.locator('.character[data-character="cloud"]').click();await p.evaluate(()=>{simPerf.reset('stress',false,false);document.querySelector('.character[data-character="cloud"]').click();document.querySelector('#restart').click();const a=simPerf.arena;a.player.x=110;a.player.z=0;a.player.previous={x:110,z:0};a.player.body[0]={x:110,z:0};a.player.mass=1800;a.state='playing';a.activateNuke(a.player);a.cinematic.time=3.48;a.cinematic.detonated=true;simPerf.view.prepareUltimateFrame(a,true,true,false,true);simPerf.view.render(a,6,1,0,true,0);a.state='paused';});
   const flags=await p.evaluate(()=>({motion:document.body.classList.contains('reduced-motion'),camera:simPerf.view.cinematicCameraEnabled,flash:document.querySelector('#flash-toggle').getAttribute('aria-pressed')}));assert.deepEqual(flags,{motion:true,camera:false,flash:'true'});results.push({label,comfort:flags});await p.screenshot({path:path.join(out,label+'-boundary-large-reduced.png')});await comfort.close();
  }
 }
 if(!baseline){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/assets/shibuya/*.glb',r=>r.abort());await page.route('**/assets/pomu/*.glb',r=>r.abort());await open(page);
  const fallback=await page.evaluate(()=>({message:document.querySelector('#head-loading').textContent,head:!!simPerf.view.heroHead,procedural:!simPerf.view.skybreaker.sculpted,actors:simPerf.view.diagnostics().environment.actors}));assert.equal(fallback.head,true);assert.equal(fallback.procedural,true);assert.ok(fallback.message.includes('unavailable'));results.push({fallback});await page.locator('.character[data-character="cloud"]').click();await page.evaluate(()=>{document.querySelector('#restart').click();const a=simPerf.arena;a.state='playing';a.activateNuke(a.player);a.cinematic.time=2.15;simPerf.view.render(a,6,1,0,false,0);a.state='paused';});await page.screenshot({path:path.join(out,'phone-fallback.png')});await context.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({cases:results.length,errors}));
}finally{await fs.writeFile(path.join(out,'validation.json'),JSON.stringify({results,errors},null,2));await browser.close();}
