// Controlled held-stage rendering comparisons, not real-match FPS.
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [stage='current',port='4175',out='../v167-review']=process.argv.slice(2);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PERF_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${port}/tests/perf-harness.html?perfDebug`);await page.waitForFunction(()=>!!window.perf);
  for(const [phase,time] of [['charge',2.2],['recovery',4.3]]){
    await page.evaluate(t=>perf.shot('nova',t,'shibuya'),time);
    const data=await page.evaluate(async()=>{
      const reports=[];let previous=performance.now();
      const interval=async(ms)=>{const start=performance.now();while(performance.now()-start<ms){await new Promise(requestAnimationFrame);const now=performance.now(),dt=(now-previous)/1000;previous=now;perf.view.render(perf.arena,0,1,dt,false,1);}};
      await interval(10000);
      for(let run=1;run<=3;run++){perf.view.resetMeasurements();await interval(30000);reports.push({run,...perf.metadata(),...perf.view.diagnostics()});}
      return {kind:'spirit',heldAuthoritativeTime:perf.arena.cinematic.time,warmMs:10000,sampleMs:30000,runs:3,reports};
    });
    await fs.writeFile(path.join(out,`${stage}-cinematic-${phase}.json`),JSON.stringify({stage,hardware:await page.evaluate(()=>perf.graphics()),...data},null,2));
    console.log(stage,phase,JSON.stringify(data.reports.map(r=>({cpu:r.performance.cpuMs,raf:r.performance.rafMs,gpu:r.gpu.ms,population:r.population,calls:r.performance.calls}))));
    const upload=await page.evaluate(()=>perf.verifyUploads());await fs.writeFile(path.join(out,`${stage}-cinematic-${phase}-uploads.json`),JSON.stringify(upload,null,2));
    await page.screenshot({path:path.join(out,`${stage}-cinematic-${phase}.png`)});
  }
  await context.close();
}finally{await fs.writeFile(path.join(out,`${stage}-cinematic-errors.json`),JSON.stringify(errors,null,2));await browser.close();}
