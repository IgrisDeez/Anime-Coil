import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpeedWindView, windAnchor, windLineCount } from '../src/speed-wind.ts';
import type { PresentationFrame } from '../src/presentation.ts';

const frame:PresentationFrame={time:1,dt:1/60,paused:false,reducedMotion:false};

test('wind remains at the screen edge, scales with boost, and has a stronger fox state',()=>{
  const point={x:0,y:0};
  for(const [w,h] of [[1280,720],[390,844]])for(let i=0;i<26;i++){
    windAnchor(i,w,h,point);
    assert.ok(Math.max(Math.abs(point.x-w/2)/(w/2),Math.abs(point.y-h/2)/(h/2))>.68);
  }
  assert.ok(windLineCount(1,true,false,false,1280)>windLineCount(1,false,false,false,1280));
  assert.ok(windLineCount(.4,false,false,false,1280)<windLineCount(1,false,false,false,1280));
  assert.ok(windLineCount(1,true,false,false,390)<windLineCount(1,true,false,false,1280));
  assert.equal(windLineCount(1,true,true,false,1280),0);
  assert.equal(windLineCount(1,true,false,true,1280),0);
});

test('wind streaks follow projected heading and clear on pause or reduced motion',()=>{
  const curves:{sx:number;sy:number;ex:number;ey:number}[]=[];
  let sx=0,sy=0,clears=0;
  const context={
    setTransform(){},clearRect(){clears++;},beginPath(){},moveTo(x:number,y:number){sx=x;sy=y;},
    quadraticCurveTo(_cx:number,_cy:number,ex:number,ey:number){curves.push({sx,sy,ex,ey});},stroke(){},
    globalAlpha:1,lineCap:'round',lineWidth:1,strokeStyle:'',
  };
  const canvas={clientWidth:1280,clientHeight:720,width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement;
  const view=new SpeedWindView(canvas);
  view.draw(frame,1,false,'shibuya',1,0);
  assert.ok(curves.length>0);
  assert.ok(curves.every(c=>c.sx>c.ex && Math.abs(c.sy-c.ey)<20));
  curves.length=0;
  view.draw(frame,1,true,'leaf',0,-1);
  assert.ok(curves.length>18);
  assert.ok(curves.every(c=>c.sy<c.ey && Math.abs(c.sx-c.ex)<20));
  curves.length=0;
  view.draw({...frame,paused:true},1,true,'leaf',0,-1);
  view.draw({...frame,reducedMotion:true},1,true,'leaf',0,-1);
  assert.equal(curves.length,0);
  view.clear();assert.ok(clears>=4);
});

test('equipped trails visibly tint the wind layer without another animation loop',()=>{
  const colors:string[]=[];
  const context={setTransform(){},clearRect(){},beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){colors.push(this.strokeStyle);},globalAlpha:1,lineCap:'round',lineWidth:1,strokeStyle:''};
  const canvas={clientWidth:1280,clientHeight:720,width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement;
  const view=new SpeedWindView(canvas);
  view.setTrail('petals');view.draw(frame,1,false,'shibuya',1,0);
  assert.ok(colors.includes('#ee9ca9'));
  colors.length=0;
  view.setTrail('starlight');view.draw(frame,1,false,'shibuya',1,0);
  assert.ok(colors.includes('#9bd8ef'));
});
