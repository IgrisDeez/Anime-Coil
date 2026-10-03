import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/denze/.codex/mcp-runtime/playwright/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.HAIR_PERF_OUTPUT||'docs/hair-review/performance');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),errors=[];
const scope=process.argv.slice(2),warmMs=Number(process.env.HAIR_WARM_MS||1500),sampleMs=Number(process.env.HAIR_SAMPLE_MS||3000);
try{for(const [profile,width,height] of [['desktop',1440,900],['mobile',390,844]].filter(v=>!scope[0]||v[0]===scope[0])){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));
 await page.goto('http://127.0.0.1:4175/tests/hair-review.html');await page.waitForFunction(()=>!!window.hairReview);
 const hardware=await page.evaluate(()=>{const gl=hairReview.view.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),dpr:devicePixelRatio,width:innerWidth,height:innerHeight};});
 for(const [id,name,crowd] of [['ember','mixed',false],['ember','kitsu',true],['nova','kairo',true],['cloud','pomu',true],['eclipse','shiro',true]].filter(v=>!scope[1]||v[1]===scope[1])){
  const samples=[];await page.evaluate(({id,crowd})=>{hairReview.setCharacter(id);hairReview.options({crowd,large:false,reduced:false});hairReview.show('game');},{id,crowd});
  for(const candidate of [false,true,true,false]){await page.evaluate(c=>hairReview.select(c),candidate);const result=await page.evaluate(({warmMs,sampleMs})=>hairReview.sample(warmMs,sampleMs),{warmMs,sampleMs});samples.push(result);console.log(profile,name,candidate?'textured':'before',JSON.stringify(result.cpu));}
  const baseline=samples.filter(s=>!s.candidate),candidate=samples.filter(s=>s.candidate),mean=(list,key)=>list.reduce((n,s)=>n+s.cpu[key],0)/list.length;
  assert.ok(samples.every(s=>s.population.snakes===21&&s.population.mass===48&&s.population.food===850));assert.ok(samples.every(s=>s.state===samples[0].state));assert.ok(samples.every(s=>s.draws===samples[0].draws),'No extra head or texture draw');
  const before={median:mean(baseline,'median'),p95:mean(baseline,'p95')},after={median:mean(candidate,'median'),p95:mean(candidate,'p95')};
  await fs.writeFile(path.join(out,`${profile}-${name}${process.env.HAIR_REPEAT?'repeat':''}.json`),JSON.stringify({profile,name,crowd,hardware,order:'ABBA',warmMs,sampleMs,baseline:'Prior Blender head candidates; approved Kitsu head',scope:'Held 21-snake game, same camera and visual time; includes review fixture second render in both paths',before,after,medianChangePercent:(after.median/before.median-1)*100,p95ChangePercent:(after.p95/before.p95-1)*100,samples},null,2));
 }await page.close();}
}finally{await fs.writeFile(path.join(out,'errors.json'),JSON.stringify(errors));await browser.close();}assert.deepEqual(errors,[]);
