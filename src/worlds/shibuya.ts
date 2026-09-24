import * as THREE from "three";
import { WorldBuilder } from "./builder";
import { lantern, cable } from "./architecture";
export function shibuya(b:WorldBuilder) {
  b.motions.push(f=>b.animateSigns(f.time,f.reducedMotion));
  b.ground("#303544","#202638");
  // Streets and broad sidewalk aprons connect the surrounding districts.
  for(const side of [-1,1]){b.box(b.group,"#343a4a",side*164,-.48,0,33,.025,320,"glow");b.box(b.group,"#3c4251",side*188,-.47,0,14,.03,320,"glow");}
  b.box(b.group,"#343a4a",0,-.48,-169,328,.025,30,"glow");
  b.box(b.group,"#3c4251",0,-.47,-188,328,.03,12,"glow");
  b.flat("#2b303d",0,0,34,227).position.y=-.485;b.flat("#2b303d",0,0,227,34).position.y=-.485;
  for(const side of [-1,1])for(let i=-5;i<=5;i++){b.flat("#686979",i*3,side*26,1.8,10);b.flat("#686979",side*26,i*3,10,1.8);}
  for(let i=-6;i<=6;i++)b.flat("#5d6171",i*3,i*3,1.7,10,-Math.PI/4);
  for(const side of [-1,1])for(let z=45;z<105;z+=15)b.flat("#756d70",side*1.7,side*z,.3,5);
  // Deliberate districts: a station frontage, shopping streets, then two skyline depths.
  const blocks=[[-170,-115,34,23],[-125,-175,24,35],[-62,-190,27,46],[6,-195,32,56],[83,-182,25,39],[148,-139,30,28],[-193,-35,25,21],[188,-37,25,23],[-181,57,29,17],[184,63,26,18],[-125,148,24,16],[119,150,27,16]];
  blocks.forEach(([x,z,w,h],i)=>{
    const yaw=Math.atan2(-x,-z),g=b.landmark(`city-front-${i}`,x,z,yaw),depth=20;
    b.box(g,["#455069","#4d4962","#354e60","#59505d"][i%4],0,h/2,0,w,h,depth);
    b.box(g,"#76818a",0,h,0,w+1,.8,depth+1);
    for(let row=0;row<Math.floor(h/5);row++)for(let col=0;col<Math.floor(w/5);col++){
      b.box(g,(row+col+i)%4?"#d7b787":"#70829f",-w/2+3+col*5,3+row*5,10.12,2.2,2.7,.16,"glow");
    }
    b.box(g,"#242837",0,3,10.3,w-2,6,.3);for(const px of [-w*.28,w*.28])b.box(g,"#edbd80",px,3,10.5,w*.28,4,.1,"glow");
    b.box(g,["#7974aa","#48999b","#a66183"][i%3],0,7,12,w+2,.6,4);
    b.sign(g,["COIL 109","COIL FM","NIGHT WALK","MOCHI CAFE","SPIRIT ARCADE","METRO"][i%6],["#a2b5ff","#f5a4c6","#84ddd4"][i%3],0,h-5,10.5,w*.86,4.5);
    if(i%3===0)b.sign(g,"OPEN / 24", "#e2bddf",w/2+1,h*.6,6,3,10);
    b.box(g,"#3d4456",-w*.2,h+2,0,5,4,5);b.part(g,"cylinder","#778498",w*.25,h+3,-3,2,6,2);
    if(b.detail.secondary){b.part(g,"cylinder","#707b8b",w*.35,h+7,-3,.08,8,.08);for(let k=0;k<3;k++)b.box(g,"#6c7688",-w*.34+k*3,h+.8,5,2,1.2,2);}
    b.shadow(g,0,2,w*.7,15);lantern(b,g,-w*.6,12);
    if(i%2===0){b.box(g,"#8f6485",w*.63,2.1,12,2.5,4.2,2);b.box(g,"#bde6e6",w*.63,2.6,13.05,1.9,2.1,.1,"glow");for(let r=0;r<3;r++)b.box(g,"#728a9b",w*.63,1.8+r*.55,13.12,1.6,.16,.1);}
  });
  for(let layer=0;layer<2;layer++)for(let i=0;i<(b.detail.secondary?12:7);i++){
    const x=-260+i*(b.detail.secondary?47:82),z=-265-layer*75-(i%3)*11,h=24+(i*17+layer*9)%65;
    const g=b.landmark(`skyline-${layer}-${i}`,x,z);b.box(g,layer?"#303b55":"#374158",0,h/2,0,28,h,23);b.box(g,"#4a5266",0,h+2,0,17,4,15);
    if(!layer)for(let k=0;k<5;k++)b.box(g,"#8d8491",-8+k*4,h*.65,11.6,1,h*.4,.1,"glow");
  }
  for(const x of [-62,65]){
    const g=b.landmark(`station-${x}`,x,151,Math.PI);b.box(g,"#535d6c",0,3,0,26,6,13);b.box(g,"#1c2335",0,2,6.6,17,4,.2);b.box(g,"#72788b",0,6.5,1,29,1.2,17);b.sign(g,"SHIBUYA / STATION", "#a0ded2",0,6.5,9.6,25,2.4);
    for(let k=0;k<5;k++)b.box(g,"#525c6a",0,.2+k*.3,5-k,16,.2,1);
    for(const side of [-1,1]){b.box(g,"#9f9392",side*16,1.2,0,6,.3,.4);for(const z of [-2,2])b.part(g,"cylinder","#a0a2a2",side*16,1,z,.14,2,.14);}
    cable(b,g,new THREE.Vector3(-17,9,-3),new THREE.Vector3(17,9,-3));
  }
}
