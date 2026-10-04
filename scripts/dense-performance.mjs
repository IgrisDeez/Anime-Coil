import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const repeat=process.argv.includes('--repeat'),mobileOnly=process.argv.includes('--mobile'),gpuAudit=process.argv.includes('--gpu-audit'),finalRun=process.argv.includes('--final');
const normalOnly=process.argv.includes('--normal-only'),longRun=process.argv.includes('--long');
const outputArg=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
const phaseArg=process.argv.find(a=>a.startsWith('--phase='))?.slice(8);
const warmMs=longRun?6000:gpuAudit?5000:repeat?3000:1600,sampleMs=longRun?12000:gpuAudit?10000:repeat?5000:3000;
const profiles=mobileOnly?[['mobile',390,844]]:process.argv.includes('--desktop')?[['desktop',1440,900]]:[['desktop',1440,900],['mobile',390,844]];
const phases=profile=>[['normal',null],['charge',2.15],['impact',3.48],['recovery',4.4]].filter(([phase])=>(!phaseArg||phase===phaseArg)&&(!normalOnly||phase==='normal')&&(!gpuAudit||(profile==='desktop'?phase==='normal':['charge','impact'].includes(phase))));
const out=path.resolve('docs/dense-shibuya-1.7.8/'+(outputArg??(finalRun?'performance-final':gpuAudit?'performance-gpu-audit':repeat?'performance-repeat':'performance')));await fs.mkdir(out,{recursive:true});const results=[],errors=[];
try{
 for(const [profile,width,height] of profiles){
  const pages=[];
  for(const port of [4177,4175]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();pages.push({context,page,port});
   // Replace only the diagnostic page's main RAF. The simulation stays frozen at the same seed;
   // the real renderer, city cadence, GPU uploads and cinematic shaders still run on each sample.
   await page.addInitScript(()=>{window.reviewRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=()=>0;});
   page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));await page.goto(`http://127.0.0.1:${port}/?simBench&perfDebug`);await page.waitForFunction(()=>!!window.simPerf,undefined,{polling:100});
   await page.evaluate(()=>{simPerf.reset('ordinary',false,false);document.querySelector('.character[data-character="cloud"]').click();document.querySelector('#restart').click();simPerf.arena.state='playing';simPerf.view.profiler.enabled=true;});
  }
  for(const [phase,time] of phases(profile)){
   for(const index of [0,1,1,0]){
    const {page,port}=pages[index];
    const data=await page.evaluate(async({time,warmMs,sampleMs})=>{
     simPerf.reset('ordinary',false,false);document.querySelector('.character[data-character="cloud"]').click();document.querySelector('#restart').click();const a=simPerf.arena,v=simPerf.view;a.state='playing';if(time!==null){a.activateNuke(a.player);a.cinematic.time=time;a.cinematic.detonated=time>=3.4;}
     const state=JSON.stringify(a);let clock=6;
     const sample=milliseconds=>new Promise(resolve=>{const until=performance.now()+milliseconds;const frame=()=>{v.profiler.beginFrame();v.profiler.rafMs=1000/60;v.prepareUltimateFrame(a,false,false,true,true);v.render(a,clock,1,1/60,false,0);v.profiler.endFrame();clock+=1/60;if(performance.now()<until)window.reviewRAF(frame);else resolve();};window.reviewRAF(frame);});
     await sample(warmMs);v.resetMeasurements();await sample(sampleMs);const diagnostics=v.diagnostics();const draws=v.measureDrawCalls();
     const fixtureDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(state))),n=>n.toString(16).padStart(2,'0')).join('');
     return {diagnostics,draws,fixtureDigest,hidden:document.hidden,stateUnchanged:state===JSON.stringify(a),population:a.snakes.filter(s=>s.alive).length,food:a.food.length};
    },{time,warmMs,sampleMs});
    assert.equal(data.stateUnchanged,true);assert.equal(data.population,21);assert.equal(data.hidden,false);results.push({profile,phase,version:port===4177?'1.7.7':'1.7.8',...data});console.log(profile,phase,port,JSON.stringify({cpu:data.diagnostics.performance.cpuMs,gpu:data.diagnostics.gpu.ms,calls:data.diagnostics.game.calls,triangles:data.diagnostics.game.triangles,memory:data.diagnostics.memory}));
   }
  }
  for(const {context} of pages)await context.close();
 }
 assert.deepEqual(errors,[]);
 const summary=[];
 for(const [profile] of profiles)for(const [phase] of phases(profile)){
  const group=version=>results.filter(r=>r.profile===profile&&r.phase===phase&&r.version===version),before=group('1.7.7'),after=group('1.7.8');
  assert.equal(new Set([...before,...after].map(r=>r.fixtureDigest)).size,1,'both versions render the identical authoritative fixture');
  const avg=(rows,key)=>rows.reduce((s,r)=>s+key(r.diagnostics),0)/rows.length;
  const b=avg(before,d=>d.performance.cpuMs.median),a=avg(after,d=>d.performance.cpuMs.median);
  summary.push({profile,phase,before:{cpuMedian:b,cpuP95:avg(before,d=>d.performance.cpuMs.p95),draws:avg(before,d=>d.game.calls),triangles:avg(before,d=>d.game.triangles),memory:before[0].diagnostics.memory,gpu:before.map(r=>r.diagnostics.gpu)},after:{cpuMedian:a,cpuP95:avg(after,d=>d.performance.cpuMs.p95),draws:avg(after,d=>d.game.calls),triangles:avg(after,d=>d.game.triangles),memory:after[0].diagnostics.memory,gpu:after.map(r=>r.diagnostics.gpu)},cpuMedianChangePercent:(a/b-1)*100});
 }
 await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary.map(r=>({profile:r.profile,phase:r.phase,change:r.cpuMedianChangePercent})),null,2));
}finally{await fs.writeFile(path.join(out,'raw-abba.json'),JSON.stringify({method:`ABBA, frozen identical 21-snake authoritative fixture, ${warmMs/1000}s warmup + ${sampleMs/1000}s sample per run; renderer and visual city cadence advance at 60Hz; real Edge WebGL, render CPU excludes simulation and DOM.`,results,errors},null,2));await browser.close();}
