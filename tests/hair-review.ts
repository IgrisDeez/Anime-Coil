// Review-only injection. Production createHead and Kitsu's approved cache are untouched.
import * as THREE from 'three';import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GameRenderer} from '../src/renderer';import {Arena,CHARACTERS,STEP} from '../src/simulation';
import {createHead,createHeadOutline} from '../src/models';import {lobbyFitPoints} from '../src/lobby-framing';
import type {CharacterId} from '../src/simulation';
import {HairReviewCache,HAIR_NAMES} from '../src/hair-review-assets';
import {previewBlink} from '../src/presentation';
import {kitsuHeads,selectKitsuProfile} from '../src/kitsu-head';import {kuramaAssets} from '../src/kurama-assets';
import {RosterHeadCache,ROSTER_NAMES} from '../src/roster-head';import {profileFor,type DetailProfile} from '../src/worlds/types';
const loader=new GLTFLoader(),requests:string[]=[],status=document.querySelector('#status')!;
const cache=new HairReviewCache(async(id,p)=>{const n=HAIR_NAMES[id].toLowerCase(),url=`/assets/roster/hair-review/${n}/${n}-head-${p}.glb`;requests.push(url);return (await loader.loadAsync(url)).scene;});
const beforeCache=new RosterHeadCache(async(id,p)=>{const n=ROSTER_NAMES[id].toLowerCase();return (await loader.loadAsync(`/assets/roster/candidates/${n}/${n}-head-${p}.glb`)).scene;});
let profile=profileFor(innerWidth),character:CharacterId='ember',candidate=true,mode:'menu'|'game'|'portrait'='menu',reduced=false,crowd=false,large=false;
async function preload(){
 status.textContent='Loading selected graphics profile...';selectKitsuProfile(profile);
 (document.querySelector('#profile') as HTMLSelectElement).value=profile;
 const ids=['ember','nova','cloud','eclipse'] as const,loads=Promise.all(ids.map(id=>cache.preload(id,profile)));
 await Promise.all([loads,kitsuHeads.preload(profile),kuramaAssets.preload(profile),...(['nova','cloud','eclipse'] as const).map(id=>beforeCache.preload(id,profile))]);
 const ok=await loads,failed=ids.filter((_,i)=>!ok[i]).map(id=>HAIR_NAMES[id]);
 status.textContent=failed.length?`Current head used for ${failed.join(', ')}; revised asset unavailable.`:'Textured hair candidates awaiting visual review - Shibuya';
}
await preload();const view=new GameRenderer(document.querySelector('canvas')!);view.setGraphicsChoice(profile==='desktop'?'high':'low');view.profiler.enabled=true;
let arena:Arena;const internals=view as unknown as {previewEyes:THREE.Object3D[];lobbyBounds:THREE.Box3;lobbyPoints:THREE.Vector3[];visualClock:{time:number}};
function eyes(head:THREE.Object3D){const out:THREE.Object3D[]=[];head.traverse(o=>{if(o.userData.previewEye)out.push(o)});return out;}
function head(id:CharacterId){const next=candidate?cache.create(id,profile):id==='ember'?kitsuHeads.create(profile):beforeCache.create(id,profile);if(!next)return createHead(id);
 const base=createHead(id),color=new THREE.Color(CHARACTERS.find(c=>c.id===id)!.color);base.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material)||!(o.material instanceof THREE.MeshToonMaterial)||!o.material.color.equals(color))return;o.geometry.computeBoundingBox();if(o.geometry.boundingBox!.max.y<.81)next.add(o.clone());});next.userData.hairCandidate=candidate?profile:'before-'+profile;return next;}
function outline(id:CharacterId){return (candidate?cache.outline(id,profile):id==='ember'?kitsuHeads.outline(profile):beforeCache.outline(id,profile))??createHeadOutline(id);}
function replace(old:THREE.Object3D,next:THREE.Object3D){next.position.copy(old.position);next.quaternion.copy(old.quaternion);next.scale.copy(old.scale);next.visible=old.visible;old.parent?.add(next);old.removeFromParent();}
function apply(){for(const visual of view.visuals.values()){if(visual.head.userData.hairCandidate===(candidate?profile:'before-'+profile))continue;const id=visual.character as CharacterId,normal=head(id),ink=outline(id);replace(visual.head,normal);replace(visual.headOutline,ink);visual.head=normal;visual.headOutline=ink;visual.eyes=eyes(normal);}}
function reset(){let seed=812;arena=new Arena(character,()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),20,850);for(const s of arena.snakes){s.character=crowd?character:CHARACTERS[s.id%4].id;s.mass=large?360:48;s.angle=-Math.PI/2;s.x=(s.id%7-3)*18;s.z=(Math.floor(s.id/7)-1)*28;s.previous={x:s.x,z:s.z};s.previousAngle=s.angle;s.body=Array.from({length:large?360:48},(_,i)=>({x:s.x+Math.sin(i*.15)*i*.1,z:s.z-i*.44}));}arena.player.character=character;arena.player.x=0;arena.player.z=4;arena.player.previous={x:0,z:4};arena.player.body=Array.from({length:large?360:48},(_,i)=>({x:Math.sin(i*.11)*i*.1,z:4-i*.44}));arena.state='paused';view.start(arena);}
function menu(){view.clearEffects();view.setHero(character);{const old=view.heroHead!,ink=view.hero.children.find(o=>o.userData.sharedSilhouette)!;const next=head(character),nextInk=outline(character);replace(old,next);replace(ink,nextInk);view.heroHead=next;internals.previewEyes=eyes(next);view.hero.updateMatrixWorld(true);internals.lobbyBounds.setFromObject(view.hero);internals.lobbyPoints=lobbyFitPoints(view.hero);view.updateLobbyViewport();}view.mode='menu';}
function draw(){if(mode==='portrait'){const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff4e6','#555d90',3));const sun=new THREE.DirectionalLight('#ffffff',3);sun.position.set(-4,8,7);scene.add(sun);const h=head(character);h.rotation.y=-.2;scene.add(h);const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,30);camera.position.set(0,2.8,innerWidth<700?8:5);camera.lookAt(0,1.3,0);view.renderer.setClearColor('#e5e9cf',1);view.renderer.render(scene,camera);return;}
 view.render(arena,0,1,STEP,reduced,0);if(mode==='game'){apply();for(const [id,v] of view.visuals)for(const eye of v.eyes)eye.scale.y=previewBlink(1.8+id*.37,v.character,reduced||!!arena.cinematic);view.renderer.render(view.scene,view.camera);}}
function snapshot(){const heads=[...view.visuals.values()].map(v=>({id:v.character,candidate:v.head.userData.hairCandidate??false,visible:v.head.visible,transformed:v.formHead?.visible??false}));return {character,profile,candidate,mode,reduced,crowd,large,requests:[...requests],stats:cache.stats(character,profile),heads,heroCandidate:view.heroHead?.userData.hairCandidate??false,draws:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles,resources:{...view.renderer.info.memory}};}
function show(next:typeof mode){mode=next;if(mode==='menu')menu();else if(mode==='game'){if(!arena)reset();view.mode='game';}draw();return snapshot();}
function setCharacter(id:CharacterId){character=id;reset();return show(mode);}
function select(value:boolean){candidate=value;reset();return show(mode);}
async function quality(p:DetailProfile){profile=p;await preload();view.setGraphicsChoice(p==='desktop'?'high':'low');return show(mode);}
function options(v:{reduced?:boolean;crowd?:boolean;large?:boolean}){reduced=v.reduced??reduced;crowd=v.crowd??crowd;large=v.large??large;reset();return show(mode);}
function stamp(t:number){mode='game';view.mode='game';if(t<5.6){if(!arena.cinematic){arena.state='playing';arena.activateNuke(arena.player);arena.state='paused';}arena.cinematic!.time=t;arena.cinematic!.detonated=t>=3.4;}else arena.cinematic=undefined;draw();return snapshot();}
function lifecycle(action:string){if(action==='death')arena.player.alive=false;else if(action==='respawn'){arena.player.alive=true;arena.cinematic=undefined;}else if(action==='restart')reset();else if(action==='quit')return show('menu');draw();return snapshot();}
function independence(){const a=cache.create(character,profile)!,b=cache.create(character,profile)!,ae=eyes(a)[0],be=eyes(b)[0];ae.scale.y=.05;let shared=true;a.traverse(o=>{if(o instanceof THREE.Mesh){const peer=b.getObjectByName(o.name) as THREE.Mesh;shared&&=o.geometry===peer.geometry&&o.material===peer.material;}});return {shared,independent:be.scale.y===1};}
async function sample(warmMs=1200,durationMs=2500){
 mode='game';view.mode='game';const times:number[]=[];
 await new Promise<void>(resolve=>{const start=performance.now();function frame(){const t=performance.now(),begin=performance.now();draw();if(t-start>=warmMs)times.push(performance.now()-begin);if(t-start<warmMs+durationMs)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
 times.sort((a,b)=>a-b);return {...snapshot(),cpu:{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],frames:times.length},population:{snakes:arena.snakes.length,mass:arena.player.mass,food:arena.food.length},state:JSON.stringify(arena.snakes.map(s=>[s.id,s.mass,s.x,s.z,s.alive])),time:arena.cinematic?.time};
}
const api={view,cache,setCharacter,select,quality,options,show,stamp,lifecycle,snapshot,independence,sample,get arena(){return arena;}};(window as unknown as {hairReview:typeof api}).hairReview=api;
(document.querySelector('#character') as HTMLSelectElement).onchange=e=>setCharacter((e.target as HTMLSelectElement).value as CharacterId);
for(const id of ['candidate','baseline'])document.querySelector<HTMLButtonElement>('#'+id)!.onclick=()=>select(id==='candidate');for(const m of ['menu','game','portrait'] as const)document.querySelector<HTMLButtonElement>('#'+m)!.onclick=()=>show(m);
(document.querySelector('#profile') as HTMLSelectElement).onchange=e=>void quality((e.target as HTMLSelectElement).value as DetailProfile);
for(const k of ['reduced','crowd','large'])document.querySelector<HTMLInputElement>('#'+k)!.onchange=e=>options({[k]:(e.target as HTMLInputElement).checked});
addEventListener('pagehide',()=>{cache.dispose();beforeCache.dispose();},{once:true});reset();show('menu');
