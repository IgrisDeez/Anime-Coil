import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const root=path.resolve('docs/kurama-review');await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],results=[];
try{
 for(const [label,width,height] of [['desktop',1440,900],['phone',390,844]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4175/tests/kurama-review.html');await page.waitForFunction(()=>!!window.kuramaReview);
  await page.screenshot({path:path.join(root,`${label}-review-ui.png`)});
  await page.evaluate(()=>document.body.classList.add('capture'));
  for(const candidate of [false,true]){
   await page.evaluate(value=>kuramaReview.select(value),candidate);
   for(const [phase,time] of [['summon',.75],['charge',2.15],['launch',2.95],['impact',3.55],['recovery',4.85],['complete',5.61]]){
    const data=await page.evaluate(t=>kuramaReview.stamp(t),time);results.push({label,phase,...data});
    await page.screenshot({path:path.join(root,`${label}-${candidate?'candidate':'baseline'}-${phase}.png`)});
   }
  }
  await page.evaluate(()=>kuramaReview.stamp(2.15));
  for(const [name,settings] of [['crowd',{crowd:true}],['large',{crowd:true,large:true}],['reduced-motion',{reduced:true}],['camera-off',{reduced:false,camera:false}],['boundary',{camera:true,boundary:true}]]){
   await page.evaluate(o=>kuramaReview.options(o),settings);const data=await page.evaluate(()=>kuramaReview.snapshot());results.push({label,phase:name,...data});await page.screenshot({path:path.join(root,`${label}-${name}.png`)});
  }
  await page.evaluate(()=>kuramaReview.options({camera:true,boundary:false,crowd:false,large:false,reduced:false}));
  for(const action of ['death','respawn','restart','quit']){await page.evaluate(()=>kuramaReview.stamp(2.15));const data=await page.evaluate(a=>kuramaReview.lifecycle(a),action);results.push({label,phase:action,...data});await page.screenshot({path:path.join(root,`${label}-${action}.png`)});}
  // All profile transitions run at held charge time, with the current scene retained.
  await page.evaluate(()=>kuramaReview.stamp(2.15));
  for(const profile of ['desktop','mobile','desktop']){const data=await page.evaluate(p=>kuramaReview.quality(p),profile);results.push({label,phase:'profile-'+profile,...data});}
  console.log(label,JSON.stringify({errors:errors.length,hardware:await page.evaluate(()=>kuramaReview.graphics()),asset:await page.evaluate(()=>kuramaReview.snapshot().asset)}));
  await context.close();
 }
}finally{await fs.writeFile(path.join(root,'captures.json'),JSON.stringify(results,null,2));await fs.writeFile(path.join(root,'browser-errors.json'),JSON.stringify(errors,null,2));await browser.close();}
