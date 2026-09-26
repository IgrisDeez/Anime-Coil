import type { MapId } from './maps';
import type { PresentationFrame } from './presentation';
import type { TrailId } from './progression';

const WIND_COLORS: Record<MapId, readonly [string, string]> = {
  shibuya: ['#adabdf', '#ddbbdc'],
  leaf: ['#a9cfb1', '#e2c58c'],
  tournament: ['#e0c09e', '#d4e9df'],
  harbor: ['#9bd9d6', '#e2f4df'],
};
const FOX_COLORS = ['#ffc27d','#ffe4ae'] as const;
const COSMETIC_COLORS: Record<Exclude<TrailId,'original'>,readonly [string,string]> = {
  petals: ['#ee9ca9','#f9d7b5'],
  starlight: ['#9bd8ef','#e6f9ff'],
};
const WIND_SLOTS = 26;

export function windLineCount(intensity:number, fox:boolean, reduced:boolean, paused:boolean, width:number) {
  if(reduced || paused || intensity <= .01) return 0;
  return Math.min(width < 700 ? (fox ? 16 : 11) : (fox ? 26 : 18),Math.ceil((fox ? 26 : 18)*intensity));
}

/** Fixed outer bands keep the middle of the arena free for enemies and food. */
export function windAnchor(index:number,width:number,height:number,out:{x:number;y:number}) {
  const lane=index%4, phase=((index*0.61803398875)%1);
  if(lane===0){out.x=width*(.025+.13*phase);out.y=height*(.08+.84*((index*.371)%1));}
  else if(lane===1){out.x=width*(.845+.13*phase);out.y=height*(.08+.84*((index*.443)%1));}
  else if(lane===2){out.x=width*(.12+.76*((index*.419)%1));out.y=height*(.035+.12*phase);}
  else {out.x=width*(.12+.76*((index*.337)%1));out.y=height*(.845+.12*phase);}
  return out;
}

/** Drawn by the existing frame loop; no timers, DOM nodes, or gameplay writes. */
export class SpeedWindView {
  private ctx:CanvasRenderingContext2D|null;
  private anchor={x:0,y:0};
  private dpr=0;
  private width=0;
  private height=0;
  private trail: TrailId = 'original';
  constructor(private canvas:HTMLCanvasElement){this.ctx=canvas.getContext('2d');}
  setTrail(trail:TrailId){this.trail=trail;}
  clear(){this.ctx?.clearRect(0,0,this.width,this.height);}
  draw(frame:Readonly<PresentationFrame>,intensity:number,fox:boolean,map:MapId,dx:number,dy:number){
    const ctx=this.ctx;if(!ctx)return;
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
    const dpr=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,width<700?1.25:1.5);
    if(width!==this.width||height!==this.height||dpr!==this.dpr){
      this.width=width;this.height=height;this.dpr=dpr;
      this.canvas.width=Math.max(1,Math.round(width*dpr));this.canvas.height=Math.max(1,Math.round(height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    ctx.clearRect(0,0,width,height);
    const count=windLineCount(intensity,fox,frame.reducedMotion,frame.paused,width);
    if(!count)return;
    const length=Math.hypot(dx,dy)||1,forwardX=dx/length,forwardY=dy/length;
    const colors=this.trail==='original'?(fox?FOX_COLORS:WIND_COLORS[map]):COSMETIC_COLORS[this.trail];
    ctx.lineCap='round';
    for(let i=0;i<count&&i<WIND_SLOTS;i++){
      windAnchor(i,width,height,this.anchor);
      const depth=.45+((i*7)%11)/15;
      const travel=((frame.time*(fox?1.7:1.15)*(0.6+depth*.65)+i*.173)%1)*46;
      const side=(i%2?1:-1),perpX=-forwardY,perpY=forwardX;
      const x=this.anchor.x-forwardX*travel,y=this.anchor.y-forwardY*travel;
      const span=(18+depth*54)*intensity*(fox?1.23:1);
      const sx=x+forwardX*span*.35,sy=y+forwardY*span*.35;
      const ex=x-forwardX*span*.65,ey=y-forwardY*span*.65;
      ctx.globalAlpha=intensity*(this.trail==='original'?(fox?.36:.28):(fox?.57:.46))*depth;
      ctx.strokeStyle=colors[i%2];ctx.lineWidth=(this.trail==='original'?(fox?3.8:3):(fox?4.4:3.8))*depth;
      ctx.beginPath();ctx.moveTo(sx,sy);
      ctx.quadraticCurveTo((sx+ex)*.5+perpX*side*7*depth,(sy+ey)*.5+perpY*side*7*depth,ex,ey);
      ctx.stroke();
      ctx.globalAlpha*=this.trail==='original'?.6:.35;ctx.lineWidth=Math.max(.6,depth*.85);ctx.strokeStyle=fox?'#fff4d7':'#fffaf0';
      ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
}
