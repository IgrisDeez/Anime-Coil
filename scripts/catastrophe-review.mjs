import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const root=path.resolve('docs/ultimate-catastrophe');await fs.mkdir(root,{recursive:true});
const quick=process.argv.includes('--quick'),errors=[],results=[];
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
  for(const [label,width,height] of (quick?[['desktop',1440,900]]:[['desktop',1440,900],['phone',390,844]])){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
    await page.goto('http://127.0.0.1:4175/tests/ultimate-review.html');await page.waitForFunction(()=>!!window.ultimateReview);
    await page.evaluate(()=>document.body.classList.add('capture'));
    for(const kind of ['fox','spirit','purple','skybreaker']){
      await page.evaluate(k=>ultimateReview.setKind(k),kind);
      for(const candidate of quick?[true]:[false,true]){
        await page.evaluate(v=>ultimateReview.select(v),candidate);
        for(const [phase,time] of (quick?[['impact',3.48],['expansion',3.7]]:[['charge',2.15],['compression',3.3],['impact',3.4],['expansion',3.65],['long-range',3.95],['aftermath',4.55],['complete',5.61]])){
          const data=await page.evaluate(t=>{ultimateReview.stamp(t);const s=ultimateReview.stamp(t);delete s.simulation;return s;},time);
          results.push({label,candidate,phase,...data});
          if(candidate && time>=3.4&&time<4.8){
            const total=(data.draws[kind]??0)+(data.draws['ultimate-blast']??0);
            assert.ok(total<=(width<600?16:24),`${label} ${kind} ${phase} submitted ${total}`);
          }
          await page.screenshot({path:path.join(root,`${label}-${kind}-${candidate?'candidate':'v175'}-${phase}.png`)});
        }
      }
      if(!quick)for(const [name,options] of [['reduced',{reduced:true}],['flashes',{reduced:false,flashes:true}],['camera-off',{flashes:false,camera:false}],['boundary-crowd',{camera:true,boundary:true,large:true,crowd:true}]]){
        await page.evaluate(o=>ultimateReview.options(o),options);await page.evaluate(()=>{ultimateReview.stamp(3.7);ultimateReview.stamp(3.7)});
        await page.screenshot({path:path.join(root,`${label}-${kind}-${name}.png`)});
      }
      await page.evaluate(()=>ultimateReview.options({reduced:false,flashes:false,camera:true,boundary:false,large:false,crowd:false}));
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
}finally {await fs.writeFile(path.join(root,quick?'quick.json':'captures.json'),JSON.stringify({results,errors},null,2));await browser.close();}
console.log(JSON.stringify({renders:results.length,errors}));
