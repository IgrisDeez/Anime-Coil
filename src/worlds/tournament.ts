import * as THREE from "three";
import { WorldBuilder } from "./builder";
import { flag } from "./architecture";
import { RADIUS } from "../simulation";
export function tournament(b:WorldBuilder) {
  b.ground("#c7c1a5","#77917a");
  // Joined concourses make the stands feel like one stadium rather than islands.
  for(const [inner,outer,y,color] of ([
    [119,151,-.46,"#c3b9a2"],[151,178,-.455,"#bda98e"],[178,239,-.45,"#a99e86"],
  ] as const)){
    const terrace=new THREE.Mesh(b.geo(new THREE.RingGeometry(inner,outer,b.profile==="mobile"?80:128)),b.surfaceMaterial("stone"));
    terrace.name=`stadium-concourse-${inner}`;terrace.rotation.x=-Math.PI/2;terrace.position.y=y;terrace.userData.color=color;b.group.add(terrace);
  }
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,dx=Math.sin(a),dz=Math.cos(a);
    b.path("#d2c5a8",[[dx*121,dz*121],[dx*173,dz*173],[dx*190,dz*190]],7,-.434,"stone");
  }
  for(let n=-108;n<=108;n+=12){const d=Math.sqrt(115*115-n*n);b.flat("#b7b29b",n,0,.12,d*2);b.flat("#b7b29b",0,n,d*2,.12);}
  b.disk("#bcb49e",0,0,9,-.445);
  b.disk("#d0c7ad",0,0,6,-.437);
  // Flat perimeter inlay finishes the arena without creating an obstacle.
  const edging = new THREE.Mesh(b.geo(new THREE.RingGeometry(RADIUS+1,RADIUS+2.2,96)), b.surfaceMaterial("stone"));
  edging.name="arena-edging";edging.rotation.x=-Math.PI/2;edging.position.y=-.45;edging.userData.color="#b4a58b";b.group.add(edging);
  // Four continuous grandstands make a stadium silhouette, with clear entrance gaps.
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,g=b.landmark(`grandstand-${i}`,Math.sin(a)*210,Math.cos(a)*210,a+Math.PI);
    const rows=b.detail.secondary?6:4;
    b.box(g,"#ac9f8b",0,4,-8,94,8,32,"stone");
    for(let r=0;r<rows;r++){
      b.box(g,r%2?"#b5a88c":"#d0b997",0,3+r*2,-r*4,90,2,5,"stone");
      for(let col=0;col<30;col+=b.detail.crowdStep){const x=-43+col*3,y=4.5+r*2,z=-r*4;
        b.part(g,"pebble",["#a16b66","#688c92","#c6a56e","#8c81a2","#798f67"][((col*7+r*3+i)%5)],x,y,z,.8,1,.7,"crowd");
        b.part(g,"pebble","#d6b48a",x,y+1,z,.48,.48,.48,"crowd");
      }
    }
    for(const x of [-47,47]){b.part(g,"cylinder","#756958",x,10,-10,.6,20,.6);b.box(g,"#43897f",x,20,-10,4,1,26);}
    b.box(g,i%2?"#64948a":"#c78369",0,21,-14,99,1.8,17);b.box(g,"#ddd0ad",0,1,6,96,2,2);b.shadow(g,0,-6,52,23);
    flag(b,g,-40,25,4,i%2?"#d59472":"#7aa6a0",i);
    b.box(g,"#eee0be",0,15,7,90,.55,.6);
    for(const x of [-31,0,31]){
      b.box(g,i%2?"#83aba0":"#dea48a",x,11,7.5,12,4,.3,"fabric");
      b.part(g,"ball","#ffe0a3",x,18,7.8,.9,.9,.9,"glow");
    }
    if(i%2===0){b.tree(g,53,3,1.1,true);b.tree(g,-53,3,1.1,true);}
  }
  for(const z of [-168,168]){const g=b.landmark(`tournament-gate-${z}`,0,z,z>0?Math.PI:0);
    for(const x of [-17,17]){b.box(g,"#b96f5e",x,11,0,6,22,8,"plaster");b.box(g,"#dbbb81",x,1,0,9,2,10,"stone");}
    b.box(g,"#dfbd84",0,20,0,44,6,10);b.gableRoof(g,"#4d817e",49,23.1,19,4);b.box(g,"#4d817e",0,23,0,49,.35,19,"roof");b.sign(g,"WORLD TOURNAMENT", "#ffe1a2",0,20,5.2,35,4);
    for(const x of [-23,23]){b.part(g,"ball","#f7c883",x,15,5,.9,1.4,.9,"glow");b.box(g,"#6e8177",x,7,5,.4,13,.4);}
    b.box(g,"#7c6454",0,14,0,32,.8,1);b.shadow(g,0,2,25,12);
  }
  for(const x of [-145,145]){const g=b.landmark(`scoreboard-${x}`,x,-144,x<0?.6:-.6);for(const side of [-1,1])b.box(g,"#65717a",side*14,18,0,2,36,2);b.box(g,"#4e6475",0,31,0,40,19,3);b.sign(g,"COIL WORLD CUP", "#f5c682",0,35,1.6,35,5);b.sign(g,"SPIRIT / POWER / GLORY", "#b4ddd3",0,28,1.6,35,4);}
}


