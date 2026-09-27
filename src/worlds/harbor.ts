import * as THREE from "three";
import { WorldBuilder } from "./builder";
import { shop, cable, flag } from "./architecture";
import { addWorldLife } from "./life";
export function harbor(b:WorldBuilder) {
  b.ground("#cbbb98","#538e99","sand");
  // A continuous crescent quay anchors the waterfront facades to land.
  const quayGeo=b.geo(new THREE.RingGeometry(128,267,b.profile==="mobile"?96:144,1,0,Math.PI));quayGeo.rotateX(-Math.PI/2);
  const quay=new THREE.Mesh(quayGeo,b.surfaceMaterial("stone"));quay.userData.color="#b7ab8b";quay.position.y=-.46;b.group.add(quay);
  const shoreGeo=b.geo(new THREE.RingGeometry(126.5,130,b.profile==="mobile"?96:144,1,0,Math.PI));shoreGeo.rotateX(-Math.PI/2);
  const shore=new THREE.Mesh(shoreGeo,b.surfaceMaterial("sand"));shore.name="harbor-shoreline";shore.position.y=-.43;shore.userData.color="#d1c19e";b.group.add(shore);
  for(let i=0;i<12;i++){const a=(i+.5)*Math.PI/12,r=136;
    b.flat("#a89a80",Math.cos(a)*r,-Math.sin(a)*r,3.4,.25,a).position.y=-.414;
  }

  // Leave the sand court uncluttered; quay planks begin beyond its rim.
  const district=[[-171,-99,-.95],[-117,-153,-.55],[-49,-181,-.2],[22,-184,.1],[94,-165,.45],[157,-114,.9],[-183,-20,-1.45],[179,-29,1.45]];
  district.forEach(([x,z,yaw],i)=>{const g=b.landmark(`harbor-street-${i}`,x,z,yaw);b.box(g,"#9b8568",0,-.1,0,33,.5,29);shop(b,g,["#cda083","#8cafaa","#d0b76e","#ac99aa"][i%4],["#a66f55","#687f8a","#98665b"][i%3],["GRAND LINE","SAILMAKER","TRADING POST","PORT CAFE"][i%4],23,12+(i%3)*4);b.tree(g,18,-4,1,true);
    for(let k=0;k<(b.detail.secondary?5:2);k++){const px=-14+k*3.3;b.part(g,"cylinder","#977354",px,1.3,12,1.1,2.6,1.1);b.part(g,"cylinder","#4f6066",px,.7,12,1.14,.18,1.14);b.part(g,"cylinder","#4f6066",px,1.9,12,1.14,.18,1.14);}
    b.box(g,"#b69268",13,1.3,12,3,2.6,3);b.box(g,"#745e4a",13,1.3,13.6,2.8,.18,.15);
    if(i%3===0)flag(b,g,-14,12,0,"#cca179",i);
  });
  // These piers now begin on the quay and reach into the water instead of floating offshore.
  for(const x of [-151,151]){const g=b.landmark(`pier-${x}`,x,67);b.box(g,"#ad906b",0,1,0,21,1.5,154,"wood");
    for(let z=-73;z<=73;z+=6)b.box(g,"#78674f",0,1.81,z,20,.08,.12);
    for(const side of [-1,1]){
      for(let z=-69;z<=69;z+=23)b.part(g,"cylinder","#715d49",side*10,1,z,.7,5,.7);
      cable(b,g,new THREE.Vector3(side*10,3,-69),new THREE.Vector3(side*10,3,69),"#c6b08a");
    }
    b.box(g,"#8c7257",0,.4,76,25,.7,4,"wood");
  }
  // Three different ships occupy the seaward half, leaving the arena silhouette open.
  [[-137,210,.4],[20,236,-.2],[179,183,-.5]].forEach(([x,z,yaw],i)=>{
    const landmark=b.landmark(`ship-${i}`,x,z,yaw),g=new THREE.Group();landmark.add(g);
    const wake=new THREE.Mesh(b.geo(new THREE.RingGeometry(11,16,32,1,Math.PI*.15,Math.PI*1.7)),b.material(new THREE.MeshBasicMaterial({color:"#d9eee2",transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide})));
    wake.rotation.x=-Math.PI/2;wake.position.set(0,-.54,16);landmark.add(wake);
    b.part(g,"ball","#745746",0,2,0,12,6,26,"wood");b.box(g,"#b39468",0,6,0,19,1,39,"wood");b.box(g,"#997654",0,9,-13,16,6,12);b.box(g,"#c9a477",0,13,-13,17,1,13);
    for(const px of [-9,9]){b.box(g,"#c3a580",px,8,0,.7,3,34);for(const pz of [-12,-5,2,9])b.part(g,"cylinder","#434e55",px,4,pz,.75,.4,.75).rotation.z=Math.PI/2;}
    for(const pz of [-8,11]){b.part(g,"cylinder","#6c5744",0,23,pz,.5,35,.5);b.box(g,"#6c5744",0,36,pz,24,.45,.45);
      // Bulged sail panels with seams, made from a small custom grid.
      const geo=b.geo(new THREE.PlaneGeometry(21,19,6,5)),pos=geo.attributes.position;
      for(let j=0;j<pos.count;j++){const vx=pos.getX(j),vy=pos.getY(j);pos.setZ(j,Math.sin((vx/21+.5)*Math.PI)*Math.cos(vy/19)*2.5);}geo.computeVertexNormals();
      const sail=new THREE.Mesh(geo,b.surfaceMaterial("fabric"));sail.userData.color=i%2?"#e6dfbb":"#f0dfb4";sail.material.side=THREE.DoubleSide;sail.position.set(0,26,pz);g.add(sail);
      for(const sx of [-7,0,7]) {const seamGeo=b.geo(new THREE.PlaneGeometry(.09,18,1,5)),sp=seamGeo.attributes.position;
        for(let k=0;k<sp.count;k++)sp.setZ(k,Math.sin(((sp.getX(k)+sx)/21+.5)*Math.PI)*Math.cos(sp.getY(k)/19)*2.5+.025);
        const seam=new THREE.Mesh(seamGeo,b.surfaceMaterial("fabric"));seam.userData.color="#ccbf9e";seam.position.set(sx,26,pz);g.add(seam);}

      for(const side of [-1,1])cable(b,g,new THREE.Vector3(side*10,7,pz+5),new THREE.Vector3(0,38,pz),"#b9ae8c");
    }
    b.sign(g,i===1?"DAWN VOYAGER":"GRAND LINE", "#f5d398",0,11,18,14,3);
    b.box(g,"#55798a",3,43,-8,6,3,.15);
    // Anchor silhouette at the bow.
    b.box(g,"#4e6870",0,5,26,.5,6,.5);b.box(g,"#4e6870",0,3,26,5,.5,.5);for(const side of [-1,1])b.beam(g,"#4e6870",new THREE.Vector3(side*2.5,3,26),new THREE.Vector3(side*3.5,5,26),.25);
    b.moving(g,f=>{g.position.y=f.reducedMotion?0:Math.sin(f.time*.6+i)*.28;g.rotation.z=f.reducedMotion?0:Math.sin(f.time*.4+i)*.012;});
  });
  for(const [x,z,s] of [[-295,315,45],[290,355,56],[60,400,64]]){const g=b.landmark(`island-${x}`,x,z);
    b.part(g,"pebble","#607f79",0,-.4,0,s*1.02,3,s*.54,"rock");
    b.part(g,"pebble","#719b92",0,2,0,s,8,s*.48);b.part(g,"pebble","#6f9087",0,11,-4,s*.45,21,s*.25);
    b.tree(g,-s*.36,s*.29,1,true);if(b.detail.secondary)b.tree(g,s*.3,s*.25,.85,true);
  }
  addWorldLife(b,"harbor");
}
