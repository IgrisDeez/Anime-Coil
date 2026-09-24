import * as THREE from "three";
import { WorldBuilder } from "./builder";
import { shop, cable, flag } from "./architecture";
export function harbor(b:WorldBuilder) {
  b.ground("#cbbb98","#538e99");
  // A continuous crescent quay anchors the waterfront facades to land.
  const quayGeo=b.geo(new THREE.RingGeometry(128,267,64,1,0,Math.PI));quayGeo.rotateX(-Math.PI/2);
  const quay=new THREE.Mesh(quayGeo,b.material(new THREE.MeshBasicMaterial({color:"#b7ab8b"})));quay.position.y=-.46;b.group.add(quay);
  for(let i=0;i<20;i++){const a=i*Math.PI/19;b.box(b.group,"#938d7b",Math.cos(a)*129,-.25,-Math.sin(a)*129,6,.4,3);}

  for(const x of [-29,29]){b.flat("#baa787",x,0,12,181).position.y=-.485;for(let z=-85;z<=85;z+=9)b.flat("#aa9a7e",x,z,11,.13);}
  const district=[[-171,-99,-.95],[-117,-153,-.55],[-49,-181,-.2],[22,-184,.1],[94,-165,.45],[157,-114,.9],[-183,-20,-1.45],[179,-29,1.45]];
  district.forEach(([x,z,yaw],i)=>{const g=b.landmark(`harbor-street-${i}`,x,z,yaw);b.box(g,"#9b8568",0,-.1,0,33,.5,29);shop(b,g,["#cda083","#8cafaa","#d0b76e","#ac99aa"][i%4],["#a66f55","#687f8a","#98665b"][i%3],["GRAND LINE","SAILMAKER","TRADING POST","PORT CAFE"][i%4],23,12+(i%3)*4);b.tree(g,18,-4,1,true);
    for(let k=0;k<(b.detail.secondary?5:2);k++){const px=-14+k*3.3;b.part(g,"cylinder","#977354",px,1.3,12,1.1,2.6,1.1);b.part(g,"cylinder","#4f6066",px,.7,12,1.14,.18,1.14);b.part(g,"cylinder","#4f6066",px,1.9,12,1.14,.18,1.14);}
    b.box(g,"#b69268",13,1.3,12,3,2.6,3);b.box(g,"#745e4a",13,1.3,13.6,2.8,.18,.15);
    if(i%3===0)flag(b,g,-14,12,0,"#cca179",i);
  });
  for(const x of [-151,151]){const g=b.landmark(`pier-${x}`,x,80);b.box(g,"#ad906b",0,1,0,21,1.5,61);for(let i=-5;i<=5;i++)b.box(g,"#78674f",0,1.81,i*5,20,.08,.12);for(const side of [-1,1])for(let i=-2;i<=2;i++)b.part(g,"cylinder","#7b654e",side*10,1,i*13,.6,5,.6);for(const side of [-1,1])cable(b,g,new THREE.Vector3(side*10,3,-25),new THREE.Vector3(side*10,3,25),"#b9ab86");}
  // Three different ships occupy the seaward half, leaving the arena silhouette open.
  [[-137,210,.4],[20,236,-.2],[179,183,-.5]].forEach(([x,z,yaw],i)=>{
    const landmark=b.landmark(`ship-${i}`,x,z,yaw),g=new THREE.Group();landmark.add(g);
    b.part(g,"ball","#745746",0,2,0,12,6,26);b.box(g,"#b39468",0,6,0,19,1,39);b.box(g,"#997654",0,9,-13,16,6,12);b.box(g,"#c9a477",0,13,-13,17,1,13);
    for(const px of [-9,9]){b.box(g,"#c3a580",px,8,0,.7,3,34);for(const pz of [-12,-5,2,9])b.part(g,"cylinder","#434e55",px,4,pz,.75,.4,.75).rotation.z=Math.PI/2;}
    for(const pz of [-8,11]){b.part(g,"cylinder","#6c5744",0,23,pz,.5,35,.5);b.box(g,"#6c5744",0,36,pz,24,.45,.45);
      // Bulged sail panels with seams, made from a small custom grid.
      const geo=b.geo(new THREE.PlaneGeometry(21,19,6,5)),pos=geo.attributes.position;
      for(let j=0;j<pos.count;j++){const vx=pos.getX(j),vy=pos.getY(j);pos.setZ(j,Math.sin((vx/21+.5)*Math.PI)*Math.cos(vy/19)*2.5);}geo.computeVertexNormals();
      const mat=b.swayMaterial(i%2?"#e6dfbb":"#f0dfb4"),sail=new THREE.Mesh(geo,mat);sail.position.set(0,26,pz);g.add(sail);
      for(const side of [-1,1])cable(b,g,new THREE.Vector3(side*10,7,pz+5),new THREE.Vector3(0,38,pz),"#b9ae8c");
    }
    b.sign(g,i===1?"DAWN VOYAGER":"GRAND LINE", "#f5d398",0,11,18,14,3);
    b.box(g,"#55798a",3,43,-8,6,3,.15);
    // Anchor silhouette at the bow.
    b.box(g,"#4e6870",0,5,26,.5,6,.5);b.box(g,"#4e6870",0,3,26,5,.5,.5);for(const side of [-1,1])b.beam(g,"#4e6870",new THREE.Vector3(side*2.5,3,26),new THREE.Vector3(side*3.5,5,26),.25);
    b.moving(g,f=>{g.position.y=f.reducedMotion?0:Math.sin(f.time*.7+i)*.35;g.rotation.z=f.reducedMotion?0:Math.sin(f.time*.45+i)*.014;});
  });
  for(const [x,z,s] of [[-295,315,60],[290,355,75],[60,400,92]]){const g=b.landmark(`island-${x}`,x,z);b.part(g,"ball","#719b92",0,8,0,s,19,s*.48);b.part(g,"pebble","#6f9087",0,24,0,s*.55,35,s*.3);}
}
