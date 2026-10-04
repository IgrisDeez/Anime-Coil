import * as THREE from 'three';
import type { WorldBuilder } from './builder';
import {cityType} from './sign-type';

export type BillboardArt='coil'|'ramen'|'arcade'|'moon'|'radio'|'tea'|'metro'|'fashion'|'spirit'|'wave'|'night'|'garden';
export interface BillboardRegion { readonly x:number; readonly y:number; readonly w:number; readonly h:number; readonly title:string; readonly color:string }
export const BILLBOARD_REGIONS:Readonly<Record<BillboardArt,BillboardRegion>>={
  coil:{x:0,y:0,w:.5,h:.25,title:'COIL',color:'#ffd08d'},ramen:{x:.5,y:0,w:.5,h:.25,title:'RAMEN',color:'#f2a587'},
  arcade:{x:0,y:.25,w:.5,h:.25,title:'SPIRIT ARCADE',color:'#ba9def'},moon:{x:.5,y:.25,w:.5,h:.25,title:'MIDNIGHT',color:'#8bd7dd'},
  radio:{x:0,y:.5,w:.25,h:.25,title:'COIL FM',color:'#dd97ba'},tea:{x:.25,y:.5,w:.25,h:.25,title:'TEA',color:'#adcbaa'},
  metro:{x:.5,y:.5,w:.25,h:.25,title:'渋谷',color:'#94d7d0'},fashion:{x:.75,y:.5,w:.125,h:.25,title:'NEON',color:'#acbaf1'},
  spirit:{x:0,y:.75,w:.25,h:.25,title:'SPIRIT',color:'#e7bb93'},wave:{x:.25,y:.75,w:.25,h:.25,title:'WAVE',color:'#98c3df'},
  night:{x:.5,y:.75,w:.25,h:.25,title:'NIGHT WALK',color:'#c7a1d9'},garden:{x:.75,y:.75,w:.25,h:.25,title:'GARDEN',color:'#a5c9b5'}
};
/** Twelve reusable original posters. Padding belongs to each art region, not each panel. */
export class CityBillboards {
  readonly material:THREE.MeshBasicMaterial;
  readonly padding=6;
  constructor(private readonly b:WorldBuilder){
    let canvas:HTMLCanvasElement|undefined;
    try{if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=canvas.height=b.detail.atlas;const c=canvas.getContext('2d');if(c){let i=0;for(const r of Object.values(BILLBOARD_REGIONS))this.draw(c,r,i++);}else canvas=undefined;}}catch{canvas=undefined;}
    const texture=b.texture(canvas?new THREE.CanvasTexture(canvas):new THREE.DataTexture(new Uint8Array([82,117,144,255]),1,1));
    texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
    this.material=b.material(new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));this.material.userData.worldAtlas=true;
    const clock={value:0};
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.billboardTime=clock;
      shader.vertexShader='attribute vec2 alternateUV;varying vec2 billboardAlternate;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nbillboardAlternate=alternateUV;');
      shader.fragmentShader='uniform float billboardTime;\n'+shader.fragmentShader;
      shader.fragmentShader='varying vec2 billboardAlternate;\n'+shader.fragmentShader;
      // Two original ads of matching proportions crossfade through the shared atlas.
      // Shop-name signs remain stable and no canvas is redrawn during frames.
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
        float adPhase=mod(billboardTime,16.);
        float adBlend=smoothstep(6.8,8.,adPhase)*(1.-smoothstep(14.8,16.,adPhase));
        if(adBlend<=0.)diffuseColor*=texture2D(map,vMapUv);
        else if(adBlend>=1.)diffuseColor*=texture2D(map,billboardAlternate);
        else diffuseColor*=mix(texture2D(map,vMapUv),texture2D(map,billboardAlternate),adBlend);
        #endif`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float sweep=1.-smoothstep(.05,.20,abs(fract(vMapUv.x+billboardTime*.045)-.5));outgoingLight*=.94+.06*sin(billboardTime*.45)+.11*sweep;\n#include <opaque_fragment>`);
    };this.material.customProgramCacheKey=()=> 'living-city-billboard';
    const motion=new THREE.Group();motion.name='shibuya-billboard-clock';b.moving(motion,f=>{clock.value=f.reducedMotion?0:f.time;});
  }
  private draw(c:CanvasRenderingContext2D,r:BillboardRegion,index:number){
    const size=this.b.detail.atlas,x=r.x*size,y=r.y*size,w=r.w*size,h=r.h*size,p=this.padding;
    c.save();c.beginPath();c.rect(x+p,y+p,w-2*p,h-2*p);c.clip();
    const gradient=c.createLinearGradient(x,y,x+w,y+h);gradient.addColorStop(0,'#12223b');gradient.addColorStop(1,r.color);c.fillStyle=gradient;c.fillRect(x,y,w,h);
    c.strokeStyle=r.color;c.lineWidth=h*.015;
    for(let line=0;line<5;line++){c.beginPath();c.moveTo(x+w*(.08+line*.08),y+h*.12);c.lineTo(x+w*(.38+line*.09),y+h*.65);c.stroke();}
    c.fillStyle='#edf3df';c.globalAlpha=.75;c.beginPath();c.arc(x+w*.67,y+h*.38,h*.22,0,Math.PI*2);c.fill();
    c.globalAlpha=1;c.fillStyle='#20324c';
    // Graphic moon, fox crest, bowl, and skyline shapes give posters recognisable silhouettes.
    if(index%4===0){c.beginPath();c.moveTo(x+w*.57,y+h*.4);c.lineTo(x+w*.59,y+h*.15);c.lineTo(x+w*.67,y+h*.3);c.lineTo(x+w*.75,y+h*.15);c.lineTo(x+w*.77,y+h*.4);c.lineTo(x+w*.67,y+h*.54);c.closePath();c.fill();}
    else if(index%4===1){c.beginPath();c.ellipse(x+w*.67,y+h*.38,h*.21,h*.1,0,0,Math.PI);c.fill();c.fillRect(x+w*.53,y+h*.31,w*.28,h*.025);}
    else if(index%4===2){for(let k=0;k<5;k++)c.fillRect(x+w*(.53+k*.055),y+h*(.38-(k%3)*.06),w*.035,h*(.23+(k%3)*.06));}
    else{c.beginPath();c.arc(x+w*.7,y+h*.31,h*.18,0,Math.PI*2);c.fill();}
    c.fillStyle='#15243a';c.fillRect(x,y+h*.68,w,h*.32);c.fillStyle='#f1e8dd';cityType(c,r.title,h*.14,w*.78);c.textAlign='center';c.textBaseline='middle';c.fillText(r.title,x+w*.5,y+h*.84);
    c.restore();
  }
  panel(g:THREE.Group,art:BillboardArt,x:number,y:number,z:number,w:number,h:number){
    const r=BILLBOARD_REGIONS[art],size=this.b.detail.atlas,p=this.padding/size,geo=this.b.geo(new THREE.PlaneGeometry(w,h)),uv=geo.attributes.uv;
    const alternatives=Object.values(BILLBOARD_REGIONS).filter(other=>other!==r&&other.w===r.w&&other.h===r.h),other=alternatives[0]??r,alternate=new THREE.Float32BufferAttribute(new Float32Array(uv.count*2),2);
    for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);alternate.setXY(i,other.x+p+u*(other.w-2*p),1-other.y-p-(1-v)*(other.h-2*p));uv.setXY(i,r.x+p+u*(r.w-2*p),1-r.y-p-(1-v)*(r.h-2*p));}
    geo.setAttribute('alternateUV',alternate);
    const mesh=new THREE.Mesh(geo,this.material);mesh.position.set(x,y,z);mesh.userData.billboardArt=art;g.add(mesh);return mesh;
  }
}
