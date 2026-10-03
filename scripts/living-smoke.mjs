import fs from 'node:fs/promises';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const out='docs/living-shibuya-1.7.7';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:4175/?simBench&perfDebug');await page.waitForFunction(()=>!!window.simPerf,{timeout:20000});
 await page.screenshot({path:out+'/initial-menu.png'});
 console.log(JSON.stringify(await page.evaluate(()=>({d:simPerf.view.diagnostics(),city:!!simPerf.view.environment.group.getObjectByName('shibuya-district-0'),form:simPerf.view.skybreaker.sculpted})),null,2));
 await page.evaluate(()=>{simPerf.reset('ordinary',false,false);document.querySelector('.character[data-character="cloud"]').click();document.querySelector('#restart').click();const a=simPerf.arena;a.state='playing';a.activateNuke(a.player);a.state='paused';a.cinematic.time=2.15;simPerf.view.render(a,0,1,1/60,false,0);});
 await page.screenshot({path:out+'/initial-charge.png'});
 console.log(JSON.stringify(await page.evaluate(()=>({d:simPerf.view.diagnostics(),form:simPerf.view.visuals.get(0).formHead.userData.gear5,staging:simPerf.view.skybreaker.staging})),null,2));
 console.log(JSON.stringify({errors}));
}finally{await browser.close();}
