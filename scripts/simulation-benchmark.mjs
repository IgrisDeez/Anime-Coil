import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [label='baseline',port='4176',out='../v168-review',scenario='ordinary']=process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PERF_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+port+'/?perfDebug&simBench');await page.waitForFunction(()=>!!window.simPerf);
 await page.waitForTimeout(10000);
 const metadata=await page.evaluate(()=>{const gl=simPerf.view.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {browser:navigator.userAgent,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],dpr:simPerf.view.renderer.getPixelRatio(),map:simPerf.view.mapId};});
 const baseline=label.startsWith('baseline'),replayFile=process.env.PERF_REPLAY;const replay=replayFile?JSON.parse(await fs.readFile(replayFile,'utf8')):undefined;
 await page.evaluate(({scenario,baseline,profile})=>simPerf.reset(scenario,baseline,profile),{scenario,baseline,profile:process.env.PERF_DETAIL!=='0'});
 const warm=await page.evaluate(schedule=>simPerf.run(600,schedule,true),replay?.warm.deltas);
 const reports=[];for(let i=0;i<3;i++) {const r=await page.evaluate(schedule=>simPerf.run(1800,schedule),replay?.reports[i].deltas);if(replay&&JSON.stringify(r.state)!==JSON.stringify(replay.reports[i].state))throw Error('Authoritative replay mismatch in run '+(i+1));reports.push(r);const p=r.diagnostics.performance;console.log(label,scenario,i+1,JSON.stringify({cpu:p.cpuMs,latency:p.cpuLatency,sim:p.simulation.tickCpuMs,index:p.simulation.perFrame.index,abilities:p.simulation.perFrame.abilities,catchup:p.simulation.ticksPerFrame,ticks:r.endTick-r.startTick,population:r.state.population,segments:r.state.segments,food:r.state.food}));}
 await fs.writeFile(path.join(out,label+'-'+scenario+'.json'),JSON.stringify({label,metadata,warm,reports,errors},null,2));
 await page.screenshot({path:path.join(out,label+'-'+scenario+'.png'),timeout:60000});
 await context.close();
}finally {await fs.writeFile(path.join(out,label+'-'+scenario+'-errors.json'),JSON.stringify(errors));await browser.close();}
