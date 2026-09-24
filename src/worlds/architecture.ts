import * as THREE from "three";
import { WorldBuilder } from "./builder";
export function shop(b:WorldBuilder,g:THREE.Group,c:string,roof:string,label:string,w=20,h=12,d=15) {
  b.box(g,c,0,h/2,0,w,h,d);b.box(g,"#695344",0,1,0,w+1,2,d+1);
  b.roof(g,roof,w+3,h+2.5,d+4);
  for(const x of [-w*.34,w*.34]) {b.box(g,"#e5c48a",x,h*.48,d/2+.12,w*.2,h*.42,.3,"glow");b.box(g,"#655344",x,h*.48,d/2+.4,.22,h*.42,.2);}
  b.box(g,"#514950",0,3,d/2+.15,w*.17,6,.4);b.sign(g,label,"#f6d9a0",0,h-1,d/2+.4,w*.8,2.7);
  b.box(g,roof,0,h*.58,d/2+2,w+1,.45,4);b.shadow(g,1,2,w*.7,d*.7);
  if(b.detail.secondary)for(const x of [-w/2,w/2])b.box(g,"#785a42",x,h*.48,d/2+.3,.45,h,.5);
}
export function lantern(b:WorldBuilder,g:THREE.Group,x:number,z:number) {
  b.part(g,"cylinder","#625153",x,4,z,.18,8,.18);b.box(g,"#625153",x+.7,7.8,z,1.5,.2,.25);b.part(g,"ball","#f4c782",x+1.3,7,z,.7,1,.7,"glow");
}
export function flag(b:WorldBuilder,parent:THREE.Group,x:number,y:number,z:number,color:string,phase=0) {
  b.part(parent,"cylinder","#81796b",x,y/2,z,.12,y,.12);
  const g=new THREE.Group();g.position.set(x,y-1,z);parent.add(g);
  b.box(g,color,1.5,0,0,3,2,.12);b.box(g,"#efdcb0",1.5,0,.09,.4,1,.08);
  b.moving(g,f=>{g.rotation.z=f.reducedMotion?0:Math.sin(f.time*1.1+phase)*.06;});
}
export function cable(b:WorldBuilder,g:THREE.Group,a:THREE.Vector3,c:THREE.Vector3,color="#514747") {
  let prev=a.clone();for(let i=1;i<=8;i++){const t=i/8,next=a.clone().lerp(c,t);next.y-=Math.sin(t*Math.PI)*1.7;b.beam(g,color,prev,next,.065);prev=next;}
}
