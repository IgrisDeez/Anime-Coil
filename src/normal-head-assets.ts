import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {HairReviewCache,HAIR_NAMES} from './hair-review-assets';
import {kitsuHeads} from './kitsu-head';
import {CHARACTERS} from './simulation';
import type {DetailProfile} from './worlds/types';

/** Approved sculpted heads; immutable resources are shared across all instances. */
export const normalHeads=new HairReviewCache(async(id,profile)=>{
  const name=HAIR_NAMES[id].toLowerCase();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`${import.meta.env?.BASE_URL??'/'}assets/heads/${name}/${name}-head-${profile}.glb`,{signal:controller.signal});
    if(!response.ok)throw Error(`Head HTTP ${response.status}`);
    return (await new GLTFLoader().parseAsync(await response.arrayBuffer(),'')).scene;
  }finally{clearTimeout(timer);}
});

export async function preloadNormalHeads(profile:DetailProfile){
  const ready=await Promise.all(CHARACTERS.map(c=>normalHeads.preload(c.id,profile)));
  // Retain Kitsu's approved previous head when its revised asset cannot load.
  if(!ready[CHARACTERS.findIndex(c=>c.id==='ember')])await kitsuHeads.preload(profile);
  return ready.every(Boolean);
}
if(import.meta.hot)import.meta.hot.dispose(()=>normalHeads.dispose());
if(typeof window!=='undefined')window.addEventListener('pagehide',event=>{if(!event.persisted)normalHeads.dispose();});
