import fs from 'node:fs/promises';import path from 'node:path';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const root=path.resolve('docs/ultimate-polish');await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[],errors=[];
try{for(const [label,width,height] of [['desktop',1440,900],['phone',390,844]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4175/tests/ultimate-review.html');await page.waitForFunction(()=>!!window.ultimateReview);await page.evaluate(()=>document.body.classList.add('capture'));
 for(const kind of ['fox','spirit','skybreaker','purple']){
  await page.evaluate(k=>ultimateReview.setKind(k),kind);
  for(const candidate of [false,true]){await page.evaluate(c=>ultimateReview.select(c),candidate);
   for(const [phase,time] of [['charge',2.15],['release',2.95],['hit',3.48],['shockwave',3.72],['recovery',4.85],['complete',5.61]]){
    const data=await page.evaluate(t=>{const s=ultimateReview.stamp(t);delete s.simulation;return s},time);results.push({label,phase,...data});
    if(phase!=='complete')await page.screenshot({path:path.join(root,`${label}-${kind}-${candidate?'polished':'baseline'}-${phase}.png`)});
   }
  }
  for(const [name,options] of [['reduced',{reduced:true}],['camera-off',{reduced:false,camera:false}],['boundary-large-crowd',{camera:true,boundary:true,large:true,crowd:true}]]){
   await page.evaluate(o=>ultimateReview.options(o),options);const s=await page.evaluate(()=>{const s=ultimateReview.stamp(3.48);delete s.simulation;return s});results.push({label,phase:name,...s});await page.screenshot({path:path.join(root,`${label}-${kind}-${name}.png`)});
  }
  await page.evaluate(()=>ultimateReview.options({reduced:false,camera:true,boundary:false,large:false,crowd:false}));
  for(const action of ['death','respawn','restart','quit']){await page.evaluate(()=>ultimateReview.stamp(2.15));const s=await page.evaluate(a=>{const s=ultimateReview.lifecycle(a);delete s.simulation;return s},action);results.push({label,phase:action,...s});}
  await page.evaluate(()=>ultimateReview.stamp(2.15));for(const profile of ['mobile','desktop',width<600?'mobile':'desktop']){const s=await page.evaluate(p=>{return ultimateReview.quality(p).then(s=>{delete s.simulation;return s})},profile);results.push({label,phase:'profile-'+profile,...s});}
 }
 console.log(label,'captured',errors.length,'errors');await context.close();
}}finally{await fs.writeFile(path.join(root,'captures.json'),JSON.stringify(results,null,2));await fs.writeFile(path.join(root,'browser-errors.json'),JSON.stringify(errors,null,2));await browser.close();}
if(errors.length)process.exitCode=1;
