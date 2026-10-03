// Development-only staging using the actual renderer, arena, current Kitsu and Shibuya.
import * as THREE from 'three';
import {GameRenderer} from '../src/renderer';
import {Arena,CHARACTERS,STEP,RADIUS} from '../src/simulation';
import {FoxCinematic} from '../src/fox-procedural-review';
import {KuramaReviewCinematic} from '../src/kurama-review';
import {kuramaAssets} from '../src/kurama-assets';
import {kitsuHeads,selectKitsuProfile} from '../src/kitsu-head';
import {profileFor,type DetailProfile} from '../src/worlds/types';
import {distribution} from '../src/frame-profiler';
const params=new URLSearchParams(location.search),status=document.querySelector('#status')!;
let profile:DetailProfile=profileFor(innerWidth),candidate=!params.has('baseline'),reduced=false,camera=true,boundary=false,crowd=false,large=false,time=2.15,replaying=false;
selectKitsuProfile(profile);await kitsuHeads.preload(profile);const ready=candidate?await kuramaAssets.preload(profile):false;
const view=new GameRenderer(document.querySelector('canvas')!);view.setGraphicsChoice(profile==='mobile'?'low':'high');view.profiler.enabled=true;
type Internals={fox:FoxCinematic|KuramaReviewCinematic;visuals:Map<number,{head:THREE.Object3D;formHead?:THREE.Object3D;eyes:THREE.Object3D[]}>};
const internal=view as unknown as Internals;
function replaceFox(){internal.fox.dispose();internal.fox=candidate?new KuramaReviewCinematic(view.scene,profile):new FoxCinematic(view.scene,profile);if(internal.fox instanceof KuramaReviewCinematic){const gl=view.renderer.getContext();internal.fox.setMultisampleFade(gl.getParameter(gl.SAMPLES));}}
if(candidate)replaceFox();
let arena:Arena;
function reset(){let seed=812;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);arena=new Arena('ember',random,20,850);
 for(const s of arena.snakes){s.character=crowd?'ember':CHARACTERS[s.id%4].id;s.mass=large?360:48;const x=(s.id%7-3)*24,z=(Math.floor(s.id/7)-1)*34;s.x=x;s.z=z;s.angle=s.id*.4;s.previous={x,z};s.previousAngle=s.angle;s.body=Array.from({length:large?360:48},(_,i)=>({x:x+Math.sin(s.angle-i*.09)*i*.08,z:z+Math.cos(s.angle-i*.09)*i*.08}));}
 arena.player.character='ember';arena.player.x=boundary?RADIUS-1:0;arena.player.z=0;arena.player.angle=0;arena.player.previous={x:arena.player.x,z:0};arena.player.body=arena.player.body.map((_,i)=>({x:arena.player.x-i*.7,z:0}));
 view.start(arena);view.mode='game';if(time<5.6)arena.activateNuke(arena.player);return arena;}
function stamp(t:number){time=t;if(t<5.6&&!arena.cinematic){reset();}if(t>=5.6){arena.cinematic=undefined;}else{arena.cinematic!.time=t;arena.cinematic!.detonated=t>=3.4;}draw();return snapshot();}
function draw(){view.cinematicCameraEnabled=camera;view.render(arena,0,1,STEP,reduced,0);}
function snapshot(){const fx=internal.fox,orb=fx.group.getObjectByName('fox-bomb-core') as THREE.Mesh;
 return {candidate,profile,time,population:arena.snakes.filter(s=>s.alive).length,segments:arena.snakes.reduce((n,s)=>n+s.body.length-1,0),food:arena.food.length,reduced,camera,boundary,crowd,large,asset:kuramaAssets.stats(profile),staging:JSON.parse(JSON.stringify(fx.staging)),orbRadius:orb.scale.x,draws:view.measureDrawCalls(),resources:{...view.renderer.info.memory},diagnostics:view.diagnostics(),restored:[...internal.visuals].filter(([,v])=>v.head.visible).map(([id])=>id)};
}
async function quality(p:DetailProfile){profile=p;status.textContent='Loading selected graphics profile…';await Promise.all([kitsuHeads.preload(p),candidate?kuramaAssets.preload(p):Promise.resolve(true)]);view.setGraphicsChoice(p==='mobile'?'low':'high');stamp(time);status.textContent=candidate?'Approved 1.7.4 · sculpt ready':'Current 1.7.3';return snapshot();}
async function select(value:boolean){candidate=value;if(candidate)await kuramaAssets.preload(profile);replaceFox();reset();stamp(time);document.querySelector('#candidate')!.setAttribute('aria-pressed',String(value));document.querySelector('#baseline')!.setAttribute('aria-pressed',String(!value));return snapshot();}
function options(values:{reduced?:boolean;camera?:boolean;boundary?:boolean;crowd?:boolean;large?:boolean}){reduced=values.reduced??reduced;camera=values.camera??camera;boundary=values.boundary??boundary;crowd=values.crowd??crowd;large=values.large??large;reset();return stamp(time);}
function lifecycle(kind:string){replaying=false;if(kind==='death')arena.player.alive=false;else if(kind==='quit')view.mode='menu';else{time=5.61;reset();}draw();return snapshot();}
async function sample(warmMs=3000,sampleMs=8000,runs=3){replaying=false;const reports=[];const render=()=>{view.profiler.beginFrame();draw();view.profiler.endFrame();};const interval=async(ms:number)=>{const start=performance.now();while(performance.now()-start<ms){await new Promise(requestAnimationFrame);render();}};
 await interval(warmMs);for(let i=0;i<runs;i++){view.resetMeasurements();await interval(sampleMs);reports.push({run:i+1,...view.diagnostics()});}return {warmMs,sampleMs,runs,reports,metadata:{seed:812,population:arena.snakes.length,food:850,segments:arena.snakes.reduce((n,s)=>n+s.body.length-1,0),time,profile,candidate,viewport:[innerWidth,innerHeight],dpr:view.renderer.getPixelRatio()},draws:view.measureDrawCalls(),resources:{...view.renderer.info.memory}};}
function graphics(){const gl=view.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};}
document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(b=>b.onclick=()=>{replaying=false;stamp(Number(b.dataset.time));});
document.querySelectorAll<HTMLButtonElement>('[data-lifecycle]').forEach(b=>b.onclick=()=>lifecycle(b.dataset.lifecycle!));
(document.querySelector('#replay') as HTMLButtonElement).onclick=()=>{time=.01;reset();replaying=true;};
(document.querySelector('#candidate') as HTMLButtonElement).onclick=()=>void select(true);(document.querySelector('#baseline') as HTMLButtonElement).onclick=()=>void select(false);
(document.querySelector('#quality') as HTMLSelectElement).value=profile==='mobile'?'low':'high';(document.querySelector('#quality') as HTMLSelectElement).onchange=e=>void quality((e.target as HTMLSelectElement).value==='low'?'mobile':'desktop');
for(const key of ['motion','camera','edge','crowd','large'])document.querySelector<HTMLInputElement>('#'+key)!.onchange=e=>{const checked=(e.target as HTMLInputElement).checked;options({[key==='motion'?'reduced':key==='edge'?'boundary':key]:checked});};
let previous=performance.now();function loop(now:number){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(replaying){time+=dt;if(time>=5.6){replaying=false;time=5.61;}stamp(time);}requestAnimationFrame(loop);}
const api={view,stamp,select,quality,options,lifecycle,sample,snapshot,graphics,distribution,get arena(){return arena;}};(window as unknown as {kuramaReview:typeof api}).kuramaReview=api;
reset();stamp(time);status.textContent=candidate?(ready?'Approved 1.7.4 · sculpt ready':'Asset unavailable · procedural fallback'):'Current 1.7.3';requestAnimationFrame(loop);
