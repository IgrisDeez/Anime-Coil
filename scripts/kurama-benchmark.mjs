// Interleaved baseline/candidate held-stage samples: 21 snakes, 987 segments, 850 food.
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const out=path.resolve('docs/kurama-review/performance');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),errors=[];
try {
 for(const [profile,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4175/tests/kurama-review.html');await page.waitForFunction(()=>!!window.kuramaReview);
  const hardware=await page.evaluate(()=>kuramaReview.graphics());
  // Reverse order between profiles to reduce warm-up/thermal bias.
  for(const [phase,time] of [['ordinary-21',5.61],['charge',2.15],['launch',2.95],['impact',3.55],['recovery',4.85]]){
   for(const candidate of profile==='desktop'?[false,true]:[true,false]){
    await page.evaluate(v=>kuramaReview.select(v),candidate);await page.evaluate(t=>kuramaReview.stamp(t),time);
    const data=await page.evaluate(()=>kuramaReview.sample(Number(2000),Number(4000),3));
    const label=`${profile}-${candidate?'candidate':'baseline'}-${phase}`;await fs.writeFile(path.join(out,label+'.json'),JSON.stringify({hardware,phase,...data},null,2));
    console.log(label,JSON.stringify({cpu:data.reports.map(r=>r.performance.cpuMs),draws:data.draws,resources:data.resources,triangles:data.reports.at(-1).triangles}));
   }
  }
  await context.close();
 }
}finally{await fs.writeFile(path.join(out,'errors.json'),JSON.stringify(errors,null,2));await browser.close();}
