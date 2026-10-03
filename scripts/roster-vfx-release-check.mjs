import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const out=path.resolve('docs/roster-vfx-1.7.6');await fs.mkdir(out,{recursive:true});
const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[],errors=[];
try{
 for(const [label,width,height] of [['desktop',1440,900],['phone',390,844]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage(),requests=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.url().endsWith('.glb'))requests.push(r.url());});
  await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
  await page.goto('http://127.0.0.1:4175/?simBench&perfDebug');await page.waitForFunction(()=>!!window.simPerf);
  assert.ok((await page.title()).includes(version));assert.equal(requests.length,5);assert.ok(requests.every(r=>r.includes(width<600?'mobile':'desktop')));
  for(const [id,name,kind] of [['ember','Kitsu','fox'],['nova','Kairo','spirit'],['cloud','Pomu','skybreaker'],['eclipse','Shiro','purple']]){
   await page.locator(`.character[data-character="${id}"]`).click();
   const menu=await page.evaluate(({name})=>{const v=simPerf.view,p=v.diagnostics().profile,h=v.heroHead.getObjectByName(`${name}_Hair_${p}`);return {profile:p,hair:!!h,locks:h?.userData.lockCount,texture:h?.material.map?.image.width,portrait:document.querySelector(`#portrait-${v.heroId}`).src.startsWith('data:image/')};},{name});
   assert.equal(menu.hair,true);assert.equal(menu.locks,id==='ember'?27:25);assert.equal(menu.texture,width<600?256:512);assert.equal(menu.portrait,true);
   await page.screenshot({path:path.join(out,`${label}-${name.toLowerCase()}-menu.png`)});
   await page.evaluate(id=>{simPerf.reset('ordinary',false,false);document.querySelector(`.character[data-character="${id}"]`).click();document.querySelector('#restart').click();const a=simPerf.arena;a.state='paused';for(const s of a.snakes)s.character=id;simPerf.view.start(a);simPerf.view.render(a,0,1,1/60,false,0);},id);
   const crowd=await page.evaluate(({name})=>{const v=simPerf.view,p=v.diagnostics().profile,heads=[...v.visuals.values()].filter(h=>h.character===v.visuals.get(0).character),a=heads[0].head.getObjectByName(`${name}_Hair_${p}`),b=heads[1].head.getObjectByName(`${name}_Hair_${p}`),ae=heads[0].eyes[0],be=heads[1].eyes[0],old=be.scale.y;ae.scale.y=.05;const independent=be.scale.y===old;return {count:heads.length,shared:a.geometry===b.geometry&&a.material===b.material&&a.material.map===b.material.map,independent};},{name});
   assert.equal(crowd.count,21);assert.equal(crowd.shared,true);assert.equal(crowd.independent,true);results.push({label,id,menu,crowd});
   await page.screenshot({path:path.join(out,`${label}-${name.toLowerCase()}-crowd.png`)});
   await page.evaluate(()=>{const a=simPerf.arena;a.state='playing';a.activateNuke(a.player);a.state='paused';});
   for(const [stage,time] of [['charge',2.15],['launch',2.95],['impact',3.48],['recovery',4.85]]){
    const data=await page.evaluate(time=>{const a=simPerf.arena;a.cinematic.time=time;a.cinematic.detonated=time>=3.4;const before=JSON.stringify(a);simPerf.view.render(a,0,1,1/60,false,0);return {stateUnchanged:JSON.stringify(a)===before,blast:simPerf.view.ultimateDiagnostics};},time);assert.equal(data.stateUnchanged,true);results.push({label,id,stage,...data});
    await page.screenshot({path:path.join(out,`${label}-${kind}-${stage}.png`)});
   }
   const switches=await page.evaluate(async({name})=>{const v=simPerf.view,a=simPerf.arena,out=[];for(const choice of ['low','high','low','high']){const time=a.cinematic.time,before=JSON.stringify(a);let done;const pending=new Promise(r=>done=r),previous=v.onHeadProfileLoad;v.onHeadProfileLoad=(loading,ready)=>{previous(loading,ready);if(!loading)done(ready);};const expected=choice==='low'?'mobile':'desktop';if(v.diagnostics().profile===expected){v.onHeadProfileLoad=previous;continue;}v.setGraphicsChoice(choice);const ready=await pending;v.onHeadProfileLoad=previous;v.render(a,0,1,1/60,false,0);out.push({ready,time:a.cinematic.time,preserved:before===JSON.stringify(a)&&time===a.cinematic.time,hair:!!v.visuals.get(0).head.getObjectByName(`${name}_Hair_${expected}`)});}return out;},{name});
   for(const s of switches){assert.equal(s.ready,true);assert.equal(s.preserved,true);assert.equal(s.hair,true);}results.push({label,id,switches});
   const recovery=await page.evaluate(({name})=>{const a=simPerf.arena,v=simPerf.view;a.cinematic=undefined;v.render(a,0,1,1/60,false,0);const h=v.visuals.get(0);return {normal:h.head.visible,form:h.formHead?.visible??false,hair:!!h.head.getObjectByName(`${name}_Hair_${v.diagnostics().profile}`)};},{name});assert.deepEqual(recovery,{normal:true,form:false,hair:true});
   await page.evaluate(()=>{const a=simPerf.arena,v=simPerf.view;a.player.alive=false;v.render(a,0,1,1/60,false,0);a.player.alive=true;v.render(a,0,1,1/60,false,0);});assert.equal(await page.evaluate(()=>simPerf.view.visuals.get(0).head.visible),true);
   await page.evaluate(()=>{document.querySelector('#restart').click();simPerf.arena.state='paused';});assert.equal(await page.evaluate(()=>!!simPerf.arena.cinematic),false);await page.evaluate(()=>document.querySelector('#quit').click());assert.equal(await page.locator('#menu').isVisible(),true);
   await page.evaluate(choice=>simPerf.view.setGraphicsChoice(choice),width<600?'low':'high');
   await page.waitForFunction(p=>simPerf.view.diagnostics().profile===p,width<600?'mobile':'desktop');results.push({label,id,recovery,lifecycle:'passed'});
  }
  assert.equal(requests.length,10);assert.equal(new Set(requests).size,10);assert.equal(requests.filter(r=>r.includes('roster/candidates')||r.includes('hair-review')).length,0);
  const cycles=await page.evaluate(()=>{const out=[];for(let i=0;i<8;i++){simPerf.reset('ordinary',false,false);simPerf.view.setMap('shibuya');simPerf.view.render(simPerf.arena,0,1,1/60,true,0);out.push({...simPerf.view.renderer.info.memory});}return out;});assert.deepEqual(cycles.at(-1),cycles.at(-2));results.push({label,requests,cycles});await context.close();
  const comfort=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),p=await comfort.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.addInitScript(()=>localStorage.setItem('anime-coil-game-settings-v1',JSON.stringify({version:1,motion:'reduced',reducedFlashes:true,cinematicCamera:false})));await p.goto('http://127.0.0.1:4175/?simBench');await p.waitForFunction(()=>!!window.simPerf);
  await p.evaluate(()=>{simPerf.reset('stress',false,false);const a=simPerf.arena;a.player.x=110;a.player.z=0;a.player.previous={x:110,z:0};a.player.body[0]={x:110,z:0};a.state='playing';a.activateNuke(a.player);a.cinematic.time=3.48;a.state='paused';});
  const flags=await p.evaluate(()=>({motion:document.body.classList.contains('reduced-motion'),camera:simPerf.view.cinematicCameraEnabled,flash:document.querySelector('#flash-toggle').getAttribute('aria-pressed')}));assert.deepEqual(flags,{motion:true,camera:false,flash:'true'});results.push({label,comfort:flags});await p.screenshot({path:path.join(out,label+'-boundary-large-reduced.png')});await comfort.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.route('**/assets/heads/**/*.glb',r=>r.abort());await page.goto('http://127.0.0.1:4175/?simBench');await page.waitForFunction(()=>!!window.simPerf);
 const fallback=await page.evaluate(()=>({message:document.querySelector('#head-loading').textContent,head:!!simPerf.view.heroHead,approvedKitsu:!!simPerf.view.heroHead.getObjectByName('KitsuHead_mobile')}));assert.equal(fallback.head,true);assert.equal(fallback.approvedKitsu,true);assert.ok(fallback.message.includes('unavailable'));results.push({fallback});await context.close();assert.deepEqual(errors,[]);
}finally{await fs.writeFile(path.join(out,'validation.json'),JSON.stringify({version,results,errors},null,2));await browser.close();}
console.log(JSON.stringify({version,checks:results.length,errors,status:'passed'}));
