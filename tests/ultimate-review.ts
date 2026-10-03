// Held shots use the real renderer and seeded 21-snake scene. No simulation overrides in production.
import * as THREE from 'three';
import {GameRenderer} from '../src/renderer';
import {Arena,CHARACTERS,RADIUS,STEP,type CharacterId} from '../src/simulation';
import {kitsuHeads,selectKitsuProfile} from '../src/kitsu-head';
import {kuramaAssets} from '../src/kurama-assets';
import {FoxCinematic} from '../src/fox';import {SpiritCinematic} from '../src/spirit';import {PurpleCinematic} from '../src/purple';import {SkybreakerCinematic} from '../src/skybreaker';
import {FoxCinematic as OldFox} from '../src/ultimate-baseline/fox';import {SpiritCinematic as OldSpirit} from '../src/ultimate-baseline/spirit';import {PurpleCinematic as OldPurple} from '../src/ultimate-baseline/purple';import {SkybreakerCinematic as OldSkybreaker} from '../src/ultimate-baseline/skybreaker';
import {FoxCinematic as V175Fox} from '../src/ultimate-baseline/v175/fox';import {SpiritCinematic as V175Spirit} from '../src/ultimate-baseline/v175/spirit';import {PurpleCinematic as V175Purple} from '../src/ultimate-baseline/v175/purple';import {SkybreakerCinematic as V175Skybreaker} from '../src/ultimate-baseline/v175/skybreaker';
import {profileFor,type DetailProfile} from '../src/worlds/types';
type Kind='fox'|'spirit'|'purple'|'skybreaker';type Effect={group?:THREE.Group;presentationGroup?:THREE.Group;dispose?:()=>void;setMultisampleFade?:(n:number)=>void};
let profile=profileFor(innerWidth),kind:Kind='fox',candidate=true,time=2.15,reduced=false,camera=true,boundary=false,large=false,crowd=false,replaying=false;
let baselineVersion='175',flashes=false;
const status=document.querySelector('#status')!;selectKitsuProfile(profile);await Promise.all([kitsuHeads.preload(profile),kuramaAssets.preload(profile)]);
const view=new GameRenderer(document.querySelector('canvas')!);view.setGraphicsChoice(profile==='mobile'?'low':'high');view.profiler.enabled=true;
const internal=view as unknown as Record<Kind,Effect>&{visuals:Map<number,{head:THREE.Group;eyes:THREE.Object3D[]}>};
const ids:Record<Kind,CharacterId>={fox:'ember',spirit:'nova',purple:'eclipse',skybreaker:'cloud'};
let arena:Arena;
function replace(){for(const key of ['fox','spirit','purple','skybreaker'] as const){const effect=internal[key];if(effect.dispose)effect.dispose();else{
 const root=effect.group??effect.presentationGroup!,geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)o.dispose();}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();
 }const Ctor=candidate?{fox:FoxCinematic,spirit:SpiritCinematic,purple:PurpleCinematic,skybreaker:SkybreakerCinematic}[key]:baselineVersion==='175'?{fox:V175Fox,spirit:V175Spirit,purple:V175Purple,skybreaker:V175Skybreaker}[key]:{fox:OldFox,spirit:OldSpirit,purple:OldPurple,skybreaker:OldSkybreaker}[key];internal[key]=new Ctor(view.scene,profile);}
 (internal.purple as Effect&{clear?:()=>void}).clear??=()=>{internal.purple.group!.visible=false;};
 const gl=view.renderer.getContext();internal.fox.setMultisampleFade?.(gl.getParameter(gl.SAMPLES));}
function reset(){let seed=812;arena=new Arena(ids[kind],()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),20,850);
 for(const s of arena.snakes){s.character=crowd?ids[kind]:CHARACTERS[s.id%4].id;s.mass=large?360:48;const x=(s.id%7-3)*24,z=(Math.floor(s.id/7)-1)*34;s.x=x;s.z=z;s.angle=s.id*.4;s.previous={x,z};s.previousAngle=s.angle;s.body=Array.from({length:large?360:48},(_,i)=>({x:x+Math.sin(s.angle-i*.09)*i*.08,z:z+Math.cos(s.angle-i*.09)*i*.08}));}
 arena.player.character=ids[kind];arena.player.x=boundary?RADIUS-1:0;arena.player.z=0;arena.player.angle=0;arena.player.previous={x:arena.player.x,z:0};arena.player.body=arena.player.body.map((_,i)=>({x:arena.player.x-i*.7,z:0}));
 view.start(arena);view.mode='game';if(time<5.6)arena.activateNuke(arena.player);arena.state='paused';}
function draw(){view.cinematicCameraEnabled=camera;view.ultimateBlastEnabled=candidate;view.reducedFlashes=flashes;view.prepareUltimateFrame(arena,reduced,flashes,camera,true);view.render(arena,0,1,STEP,reduced,0);}
function snapshot(){return {candidate,baselineVersion,kind,time,profile,reduced,flashes,camera,boundary,large,crowd,blast:view.ultimateDiagnostics,visual:{...view.ultimateVisual},draws:view.measureDrawCalls(),resources:{...view.renderer.info.memory},diagnostics:view.diagnostics(),restored:[...internal.visuals].filter(([,v])=>v.head.visible).map(([id])=>id),simulation:JSON.stringify(arena)};}
function stamp(t:number){time=t;if(t<5.6&&!arena.cinematic)reset();if(t>=5.6)arena.cinematic=undefined;else{arena.cinematic!.time=t;arena.cinematic!.detonated=t>=3.4;}draw();return snapshot();}
function setKind(k:Kind){kind=k;reset();return stamp(time);}
async function select(value:boolean,version='175'){candidate=value;baselineVersion=version;replace();reset();return stamp(time);}
async function quality(p:DetailProfile){profile=p;status.textContent='Loading profile…';await Promise.all([kitsuHeads.preload(p),kuramaAssets.preload(p)]);view.setGraphicsChoice(p==='mobile'?'low':'high');status.textContent='Held shots · 21 snakes · Shibuya';return stamp(time);}
function options(v:{reduced?:boolean;flashes?:boolean;camera?:boolean;boundary?:boolean;large?:boolean;crowd?:boolean}){reduced=v.reduced??reduced;flashes=v.flashes??flashes;camera=v.camera??camera;boundary=v.boundary??boundary;large=v.large??large;crowd=v.crowd??crowd;reset();return stamp(time);}
function lifecycle(k:string){replaying=false;if(k==='death')arena.player.alive=false;else if(k==='quit')view.mode='menu';else{time=5.61;reset();}draw();return snapshot();}
async function sample(warmMs=1500,sampleMs=2500){const interval=async(ms:number)=>{const start=performance.now();while(performance.now()-start<ms){await new Promise(requestAnimationFrame);view.profiler.beginFrame();draw();view.profiler.endFrame();}};await interval(warmMs);view.resetMeasurements();await interval(sampleMs);const result=snapshot();delete (result as Partial<typeof result>).simulation;return result;}
const api={view,stamp,setKind,select,quality,options,lifecycle,sample,snapshot,get arena(){return arena;}};(window as unknown as {ultimateReview:typeof api}).ultimateReview=api;
document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(b=>b.onclick=()=>{replaying=false;stamp(Number(b.dataset.time));});
(document.querySelector('#kind') as HTMLSelectElement).onchange=e=>setKind((e.target as HTMLSelectElement).value as Kind);
(document.querySelector('#candidate') as HTMLButtonElement).onclick=()=>void select(true);(document.querySelector('#baseline') as HTMLButtonElement).onclick=()=>void select(false);
(document.querySelector('#profile') as HTMLSelectElement).onchange=e=>void quality((e.target as HTMLSelectElement).value as DetailProfile);
for(const key of ['reduced','flashes','camera','boundary','large','crowd'])document.querySelector<HTMLInputElement>('#'+key)!.onchange=e=>options({[key]:(e.target as HTMLInputElement).checked});
(document.querySelector('#play') as HTMLButtonElement).onclick=()=>{time=.01;reset();replaying=true;};let previous=performance.now();function loop(now:number){if(replaying){time+=Math.min(.05,(now-previous)/1000);if(time>=5.6){replaying=false;time=5.61;}stamp(time);}previous=now;requestAnimationFrame(loop);}
reset();stamp(time);status.textContent='Held shots · 21 snakes · Shibuya';requestAnimationFrame(loop);
