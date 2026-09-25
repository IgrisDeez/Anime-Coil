import { CHARACTERS, KI_CHARGE, type Serpent } from './simulation';
export function abilityFeedback(player: Serpent, cinematic: boolean, playing: boolean) {
  const c=CHARACTERS.find(c=>c.id===player.character)!;
  const disabled=!player.alive || !playing || cinematic || player.cooldown>0;
  if(!player.alive || !playing || cinematic) return {state:'disabled',label:'Unavailable',progress:0,disabled:true};
  if(player.charge) return {state:'charging',label:`Charging ${player.charge.remaining.toFixed(1)}s`,progress:1-player.charge.remaining/KI_CHARGE,disabled};
  if(player.active>0 && player.character!=='nova') return {state:'active',label:`Active ${player.active.toFixed(1)}s`,progress:player.active/c.duration,disabled};
  if(player.cooldown>0) return {state:'cooldown',label:`${player.cooldown.toFixed(1)}s`,progress:1-player.cooldown/c.cooldown,disabled};
  return {state:'ready',label:'Ready',progress:1,disabled};
}
