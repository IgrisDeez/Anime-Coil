// Repeat >10% exploratory differences in alternating order after closing Blender.
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const scope=process.argv.slice(2),out=path.resolve(process.env.KURAMA_PERF_OUTPUT||'docs/kurama-review/'+(scope.length?'performance-confirm':'performance-repeat'));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),errors=[];
try {
 for(const [profile,width,height] of [['desktop',1440,900],['mobile',390,844]].filter(row=>!scope[0]||row[0]===scope[0])){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4175/tests/kurama-review.html');await page.waitForFunction(()=>!!window.kuramaReview);
  const hardware=await page.evaluate(()=>kuramaReview.graphics());
  for(const [phase,time] of [['ordinary-21',5.61],['charge',2.15],['launch',2.95],['impact',3.55],['recovery',4.85]].filter(row=>!scope[1]||row[0]===scope[1])){
   const samples=[];
   for(const candidate of [false,true,true,false]){
    await page.evaluate(v=>kuramaReview.select(v),candidate);await page.evaluate(t=>kuramaReview.stamp(t),time);
    const data=await page.evaluate(()=>kuramaReview.sample(4000,6000,1));samples.push(data);
    console.log(profile,phase,candidate?'candidate':'baseline',JSON.stringify(data.reports[0].performance.cpuMs));
   }
   await fs.writeFile(path.join(out,`${profile}-${phase}.json`),JSON.stringify({hardware,phase,samples},null,2));
  }
  await context.close();
 }
}finally{await fs.writeFile(path.join(out,'errors.json'),JSON.stringify(errors,null,2));await browser.close();}
