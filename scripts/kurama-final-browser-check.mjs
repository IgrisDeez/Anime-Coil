import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const root=path.resolve('docs/kurama-review'),browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),errors=[],results={};
try {
 const context=await browser.newContext({viewport:{width:1248,height:1250},deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 for(const [file,width,height] of [['four-views',1248,1320],['reference-comparison',1248,1280],['cinematic-sheet',1940,870],['before-after',1440,1290],['scale-study',1340,1330]]){
  await page.setViewportSize({width,height});await page.goto(`http://127.0.0.1:4175/docs/kurama-review/${file}.html`);await page.locator('img').evaluateAll(async images=>await Promise.all(images.map(i=>i.decode())));await page.screenshot({fullPage:true,path:path.join(root,file+'.png')});
 }
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4175/tests/kurama-review.html');await page.waitForFunction(()=>!!window.kuramaReview);
 results.requests=[];page.on('request',req=>{if(req.url().includes('/kurama-'))results.requests.push(req.url());});
 const profileSnapshots=[];
 for(const profile of ['mobile','desktop','mobile','desktop'])profileSnapshots.push(await page.evaluate(p=>kuramaReview.quality(p),profile));results.profileSnapshots=profileSnapshots;
 await page.evaluate(()=>{kuramaReview.stamp(5.61);kuramaReview.arena.activate(kuramaReview.arena.player);kuramaReview.arena.player.boosting=true;kuramaReview.view.render(kuramaReview.arena,.6,1,1/60,false,1);document.body.classList.add('capture');});await page.screenshot({path:path.join(root,'desktop-fox-rush.png')});
 // Actual main-game menu and portrait loading, without changing user storage.
 await page.goto('http://127.0.0.1:4175/');await page.waitForFunction(()=>document.querySelectorAll('img[id^="portrait-"]').length>=4&&[...document.querySelectorAll('img[id^="portrait-"]')].every(i=>i.complete&&i.naturalWidth>0));await page.screenshot({path:path.join(root,'desktop-main-menu.png')});results.mainMenuTitle=await page.title();
 const failed=await browser.newContext({viewport:{width:390,height:844}}),offline=await failed.newPage();await offline.route('**/assets/kurama/kurama-mobile.glb',route=>route.abort());await offline.goto('http://127.0.0.1:4175/tests/kurama-review.html');await offline.waitForFunction(()=>!!window.kuramaReview);results.failedLoad=await offline.evaluate(()=>({feedback:document.querySelector('#status').textContent,asset:kuramaReview.snapshot().asset,beast:!!kuramaReview.view.scene.getObjectByName('fox-summon')}));await offline.screenshot({path:path.join(root,'phone-failed-load-fallback.png')});await failed.close();
 await context.close();
}finally{await fs.writeFile(path.join(root,'final-browser-check.json'),JSON.stringify({results,errors},null,2));await browser.close();}
console.log(JSON.stringify({errors,failedLoad:results.failedLoad,mainMenuTitle:results.mainMenuTitle,requests:results.requests}));
