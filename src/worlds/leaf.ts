import * as THREE from "three";
import { WorldBuilder } from "./builder";
import { shop, lantern, flag, cable } from "./architecture";
export function leaf(b:WorldBuilder) {
  b.ground("#889471","#6d8667");
  // Connected gently winding paving made from broad low-contrast strips.
  for(let i=-6;i<=6;i++){const x=i*17,z=Math.sin(i*.55)*10;b.flat("#b1a083",x,z,19,15,Math.cos(i*.55)*-.13).position.y=-.485;b.flat("#a79c7d",z,x,13,19,Math.cos(i*.55)*.12);}
  const homes=[[-157,-111,-.75,24,14],[-100,-166,-.45,20,18],[-35,-187,-.1,27,12],[47,-186,.15,23,17],[118,-153,.65,25,15],[171,-85,1.1,19,20],[-190,-27,-1.35,24,13],[-177,68,-1.9,27,12],[179,59,1.9,22,16],[-110,152,-2.5,25,13],[14,170,3.14,21,15],[115,148,2.45,23,13]];
  homes.forEach(([x,z,yaw,w,h],i)=>{const g=b.landmark(`village-district-${i}`,x,z,yaw);shop(b,g,["#d4b28c","#d7ba97","#bea07d"][i%3],["#758573","#ab7560","#647776"][i%3],["ICHIRAKU","LEAF MARKET","TEA HOUSE","HERBALIST"][i%4],w,h);lantern(b,g,-w*.62,10);b.tree(g,w*.74,-4,.9+i%3*.18);if(i%3===0)flag(b,g,-w*.58,12,0,"#b3795e",i);
    if(b.detail.secondary){b.box(g,"#947352",-w*.35,1,11,4,2,2);for(let k=0;k<3;k++)b.part(g,"ball","#c29d68",-w*.43+k,2.1,11,.45,.45,.45);b.box(g,"#886c51",w*.6,2.5,-3,.55,5,.55);}
  });
  for(let i=0;i<10;i++){const a=i*.64+.2,r=211+(i%3)*14,g=b.landmark(`grove-${i}`,Math.sin(a)*r,Math.cos(a)*r);b.tree(g,0,0,1.6+(i%3)*.2);if(b.detail.secondary)b.tree(g,9,4,.8);}
  for(const x of [-151,153]){const g=b.landmark(`channel-${x}`,x,4);b.box(g,"#586f66",0,-.25,0,10,.3,54,"glow");for(const side of [-1,1])b.box(g,"#9f997e",side*6,.5,0,2,1,56);for(let i=-3;i<=3;i++)b.box(g,"#977654",0,1.4+Math.cos(i*.4)*.6,i*2.5,17,.5,2.3);for(const side of [-1,1]){b.box(g,"#785d46",side*8,3.1,0,.4,.5,19);for(const z of [-8,0,8])b.box(g,"#785d46",side*8,2.3,z,.4,3,.4);}}
  const cliff=b.landmark("guardian-cliff",0,-275);b.part(cliff,"ball","#a68f71",0,26,0,91,45,31);b.part(cliff,"pebble","#b39a79",-57,20,5,35,30,27);b.part(cliff,"pebble","#927f67",61,18,-3,40,36,29);
  for(let i=0;i<4;i++){const x=-51+i*34;b.part(cliff,"ball","#c5ad87",x,34,25,12,16,6);b.part(cliff,"pebble","#af956f",x,48,26,13,8,6);b.box(cliff,"#8d795f",x,38,31,20,1.7,1);for(const sign of [-1,1]){b.box(cliff,"#776c58",x+sign*4.6,34,31,4,.9,.8);b.box(cliff,"#998365",x+sign*8,29,29,1.5,10,3);}b.part(cliff,"pebble","#b49a75",x,30,32,2.2,4.5,2.5);b.box(cliff,"#8d795f",x,24,31,6,.8,1);}
  for(const [x,z,s] of [[-135,-340,85],[115,-350,100],[-280,-370,110],[290,-410,120]]){const g=b.landmark(`mountain-${x}`,x,z);b.part(g,"cone","#8d9b85",0,25,0,s,75,s*.7);}
  const poles=b.landmark("village-utilities",0,155);for(const x of [-38,38])b.part(poles,"cylinder","#7d634c",x,6,0,.25,12,.25);cable(b,poles,new THREE.Vector3(-38,11,0),new THREE.Vector3(38,11,0));
}
