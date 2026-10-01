// Development-only deterministic rendering fixture; never imported by the game.
import { GameRenderer } from '../src/renderer';
import { Arena, CHARACTERS, serpentScale, STEP } from '../src/simulation';
import { distribution } from '../src/frame-profiler';
import type { MapId } from '../src/maps';
import { kitsuHeads, selectKitsuProfile } from '../src/kitsu-head';
import { profileFor } from '../src/worlds/types';
const headProfile=profileFor(innerWidth,matchMedia('(pointer:coarse)').matches);selectKitsuProfile(headProfile);
if(!new URLSearchParams(location.search).has('proceduralHead'))await kitsuHeads.preload(headProfile);
const view=new GameRenderer(document.querySelector('canvas')!);
view.profiler.enabled=true;
let arena:Arena,stress=false,simulationStep=0;
function reset(long=false){stress=long;let seed=812;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  arena=new Arena('ember',random,20,850);for(const s of arena.snakes){s.character=CHARACTERS[s.id%4].id;s.mass=long?360:48;s.body=Array.from({length:long?360:48},()=>({x:0,z:0}));}
  simulationStep=0;pose(0);view.start(arena);view.mode='game';return metadata();}
function pose(time:number){for(const s of arena.snakes){const x=(s.id%7-3)*24+Math.sin(time*.4+s.id)*2,z=(Math.floor(s.id/7)-1)*34+Math.cos(time*.4+s.id)*2;
  s.previous.x=s.x;s.previous.z=s.z;s.x=x;s.z=z;s.angle=time*.12+s.id*.4;s.previousAngle=s.angle;
  for(let i=0;i<s.body.length;i++){const angle=s.angle-i*.09,scale=serpentScale(s.mass),r=stress?3+i*.012:i*.08;s.body[i].x=x+Math.sin(angle)*r*scale;s.body[i].z=z+Math.cos(angle)*r*scale;}}
}
function metadata(){return {seed:812,population:arena.snakes.filter(s=>s.alive).length,segments:arena.snakes.reduce((n,s)=>n+s.body.length-1,0),food:arena.food.length,stress,map:view.mapId,viewport:[innerWidth,innerHeight],dpr:view.renderer.getPixelRatio(),graphics:'auto',motion:'system',skin:'original'};}
async function sample(warmMs=10000,sampleMs=30000,runs=3){reset(stress);const reports=[];let previous=performance.now(),logical=0,lastStep=-1;
  const render=()=>{const now=performance.now(),dt=(now-previous)/1000;previous=now;logical+=dt;const step=Math.floor(logical/STEP);
    view.profiler.beginFrame();const stamp=view.profiler.stamp();if(step!==lastStep){pose((logical%30));lastStep=step;simulationStep++;}view.profiler.finish('simulation',stamp);
    view.render(arena,0,1,dt,false,simulationStep);view.profiler.endFrame();};
  const interval=async(ms:number)=>{const start=performance.now();while(performance.now()-start<ms){await new Promise(requestAnimationFrame);render();}};
  await interval(warmMs);for(let run=0;run<runs;run++){view.resetMeasurements();await interval(sampleMs);reports.push({run:run+1,...metadata(),...view.diagnostics()});}
  return {warmMs,sampleMs,runs,reports};}
function graphics(){const gl=view.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};}
function verifyUploads(){const gl=view.renderer.getContext();let bytes=0,calls=0;const original=gl.bufferSubData.bind(gl),originalData=gl.bufferData.bind(gl);
  const size=(data:ArrayBufferView|number,offset=0,length?:number)=>typeof data==='number'?data:length===undefined?data.byteLength-offset*((data as Float32Array).BYTES_PER_ELEMENT??1):length*((data as Float32Array).BYTES_PER_ELEMENT??1);
  gl.bufferSubData=((...args:unknown[])=>{calls++;bytes+=size(args[2] as ArrayBufferView,(args[3] as number)??0,args[4] as number|undefined);return (original as Function)(...args);}) as typeof gl.bufferSubData;
  gl.bufferData=((...args:unknown[])=>{calls++;bytes+=size(args[1] as ArrayBufferView|number);return (originalData as Function)(...args);}) as typeof gl.bufferData;
  try {view.render(arena,0,1,STEP,false,++simulationStep);return {calls,bytes,counts:{...view.profiler.counts}};} finally {gl.bufferSubData=original;gl.bufferData=originalData;}}
function draw(){return view.render(arena,0,1,STEP,false,simulationStep);}
function shot(id:string,time:number,map:MapId='shibuya'){reset();arena.player.character=id as typeof arena.player.character;view.start(arena);view.setMap(map);arena.activateNuke(arena.player);while(arena.cinematic&&arena.cinematic.time<time){arena.step(STEP,{angle:arena.player.angle,boost:false,ability:false});view.handleEvents(arena.events,arena);}view.render(arena,0,1,STEP,false,++simulationStep);return view.diagnostics();}
const api={view,reset,sample,metadata,graphics,verifyUploads,draw,pose,shot,distribution,get arena(){return arena;}};
(window as unknown as {perf:typeof api}).perf=api;reset();draw();
