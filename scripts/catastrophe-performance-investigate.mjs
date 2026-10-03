// Retain every exploratory measurement and repeat all CPU/GPU flags above 10%.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve('docs/ultimate-catastrophe'),flags=[];
const average=(rows,metric,k)=>{
  const usable=rows.map(s=>metric==='cpu'?s.diagnostics.performance.cpuMs:s.diagnostics.gpu.ms).filter(v=>v?.samples);
  return usable.length?usable.reduce((sum,v)=>sum+v[k],0)/usable.length:null;
};
for(const name of (await fs.readdir(path.join(root,'performance'))).filter(n=>n.endsWith('.json')&&n!=='browser-errors.json')){
  const data=JSON.parse(await fs.readFile(path.join(root,'performance',name),'utf8')),delta={};
  for(const metric of ['cpu','gpu'])for(const k of ['median','p95']){
    const a=average(data.samples.filter(s=>!s.candidate),metric,k),b=average(data.samples.filter(s=>s.candidate),metric,k);
    delta[`${metric}-${k}`]=a&&b?(b/a-1)*100:null;
  }
  if(Object.values(delta).some(v=>v!==null&&v>10.00001))flags.push({file:name,profile:name.split('-')[0],kind:data.kind,phase:data.phase,delta});
}
await fs.writeFile(path.join(root,'investigation-flags.json'),JSON.stringify(flags,null,2));
const fixed=process.argv.includes('--camera-off');
const chosen=fixed?flags.filter(r=>r.profile==='desktop'&&r.phase==='impact'):flags;
for(const flag of chosen){
  console.log('Investigating',flag.file,JSON.stringify(flag.delta));
  execFileSync(process.execPath,['scripts/catastrophe-performance.mjs',flag.profile,flag.kind,flag.phase,...(fixed?['--camera-off']:[])],{
    stdio:'inherit',windowsHide:true,
    env:{...process.env,ULTIMATE_PERF_OUTPUT:`docs/ultimate-catastrophe/${fixed?'performance-fixed-camera':'performance-repeat'}`,ULTIMATE_PERF_WARM_MS:'4000',ULTIMATE_PERF_SAMPLE_MS:'6000'}
  });
}
console.log(JSON.stringify({investigated:chosen.length,method:fixed?'fixed camera':'same cinematic camera',warmMs:4000,sampleMs:6000}));
