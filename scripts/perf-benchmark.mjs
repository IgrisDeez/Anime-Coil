// Usage: PLAYWRIGHT_MODULE=<module URL/path> node scripts/perf-benchmark.mjs <stage> <port> <output-dir>
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [sourceStage='current',port='4175',out='../v167-review']=process.argv.slice(2);
const stage=sourceStage+(process.env.PERF_LABEL||'');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PERF_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:Number(process.env.PERF_DPR||1)});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${port}/tests/perf-harness.html?perfDebug${process.env.PERF_HEAD_BASELINE==='1'?'&proceduralHead':''}`);await page.waitForFunction(()=>!!window.perf);
 const hardware=await page.evaluate(()=>perf.graphics());console.log(stage,'graphics',JSON.stringify(hardware));
 await fs.writeFile(path.join(out,stage+'-graphics.json'),JSON.stringify(hardware,null,2));
 for(const stress of (process.env.PERF_ORDINARY_ONLY==='1'?[false]:[false,true])) {
  await page.evaluate(stress=>perf.reset(stress),stress);const label=stress?'stress':'ordinary';
  const data=await page.evaluate(([warm,sample,runs])=>perf.sample(warm,sample,runs),[Number(process.env.PERF_WARM_MS||10000),Number(process.env.PERF_SAMPLE_MS||30000),Number(process.env.PERF_RUNS||3)]);
  await fs.writeFile(path.join(out,`${stage}-${label}.json`),JSON.stringify({stage,hardware,...data},null,2));
  console.log(stage,label,JSON.stringify(data.reports.map(r=>({cpu:r.performance.cpuMs,raf:r.performance.rafMs,stages:r.performance.stages,counts:{matrices:r.performance.matrices,bytes:r.performance.uploadBytes,calls:r.performance.calls,segments:r.segments,population:r.population,food:r.food},gpu:r.gpu}))));
  const drawCalls=await page.evaluate(()=>perf.view.measureDrawCalls?.()??null);await fs.writeFile(path.join(out,`${stage}-${label}-draws.json`),JSON.stringify(drawCalls,null,2));
  const upload=await page.evaluate(()=>perf.verifyUploads());await fs.writeFile(path.join(out,`${stage}-${label}-uploads.json`),JSON.stringify(upload,null,2));
  await page.screenshot({timeout:60000,path:path.join(out,`${stage}-${label}.png`)});
 }
 await context.close();
}finally{await fs.writeFile(path.join(out,`${stage}-errors.json`),JSON.stringify(errors,null,2));await browser.close();}
