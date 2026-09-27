import * as THREE from "three";
import { WorldBuilder } from "./builder";
import { shop, lantern, flag, cable } from "./architecture";
import { addWorldLife } from "./life";

export const LEAF_CANAL_CENTER = 140;
export const LEAF_CANAL_BANK_HALF_WIDTH = 15;
export function leafCanalRadius(angle:number) {
  return LEAF_CANAL_CENTER + 2*Math.sin(angle*3) + 1.5*Math.sin(angle*7);
}

/** A single continuous ribbon avoids the detached water/rail fragments of the old canal. */
function canalRibbon(b:WorldBuilder,name:string,innerOffset:number,outerOffset:number,y:number,color:string,style:"stone"|"sand"|"glow") {
  const positions:number[]=[],uvs:number[]=[];
  const segments=b.profile==="mobile"?72:112;
  for(let i=0;i<segments;i++){
    const a=i/segments*Math.PI*2,next=(i+1)/segments*Math.PI*2;
    const vertex=(angle:number,offset:number) => {
      const r=leafCanalRadius(angle)+offset;
      return [Math.cos(angle)*r,y,Math.sin(angle)*r] as const;
    };
    const inner=vertex(a,innerOffset),innerNext=vertex(next,innerOffset);
    const outer=vertex(a,outerOffset),outerNext=vertex(next,outerOffset);
    for(const point of [inner,innerNext,outerNext,inner,outerNext,outer]){
      positions.push(...point);uvs.push(point[0]/8,point[2]/8);
    }
  }
  const geometry=b.geo(new THREE.BufferGeometry());
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  const material=style==="glow"?b.material(new THREE.MeshBasicMaterial({color:"white"})):b.surfaceMaterial(style);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.userData.color=color;
  b.group.add(mesh);
}

function bridge(b:WorldBuilder,angle:number,index:number) {
  const radius=leafCanalRadius(angle);
  const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  // Local +Z follows the canal radius, joining both roads through the full bank width.
  const g=b.landmark(`canal-bridge-${index}`,x,z,Math.PI/2-angle);
  for(let i=-4;i<=4;i++)b.box(g,i%2?"#ab865e":"#bb9569",i*2.12,-.518,0,1.94,.10,30.8,"wood");
  for(const side of [-1,1]){
    b.box(g,"#856d53",side*9.2,.02,0,.28,.95,30.8,"wood");
    for(let z=-14;z<=14;z+=5)b.box(g,"#856d53",side*9.2,.2,z,.34,1.25,.34,"wood");
  }
}

export function leaf(b:WorldBuilder) {
  b.ground("#85977a","#789076","grass");
  // Uneven, quiet grass islands break up the flat square outside the playable disk.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6+.19,r=205+(i%3)*23;
    const patch=b.part(b.group,"disk",i%2?"#7e9673":"#849b78",Math.cos(a)*r,-.649,Math.sin(a)*r,31+(i%3)*8,20+(i%2)*9,1,"grass");
    patch.rotation.x=-Math.PI/2;patch.rotation.z=a;
  }
  // Interior roads end exactly at each bridge's inner deck edge.
  const crossings=[0,Math.PI/2,Math.PI,Math.PI*1.5];
  crossings.forEach((angle,i)=>{
    const x=Math.cos(angle),z=Math.sin(angle),inner=leafCanalRadius(angle)-14.35;
    const road=b.path(i%2?"#939d80":"#979f82",[[0,0],[x*inner*.56,z*inner*.56],[x*inner,z*inner]],4.6,-.468,"sand");road.name=`leaf-inner-road-${i}`;
  });
  b.disk("#929d80",0,0,2.5,-.452);
  // Outer roads begin at the far bridge edge and continue toward the village shops.
  crossings.forEach((angle,i)=>{
    const dx=Math.cos(angle),dz=Math.sin(angle),outer=leafCanalRadius(angle)+14.35;
    const road=b.path(i%2?"#9ca084":"#a19f83",[[dx*outer,dz*outer],[dx*(outer+24),dz*(outer+24)],[dx*196,dz*196]],8,-.615,"sand");road.name=`leaf-outer-road-${i}`;
  });
  canalRibbon(b,"canal-bank",-LEAF_CANAL_BANK_HALF_WIDTH,LEAF_CANAL_BANK_HALF_WIDTH,-.64,"#a69b7b","sand");
  canalRibbon(b,"canal-water",-8,8,-.596,"#4f8b8c","glow");
  canalRibbon(b,"canal-inner-edge",-9,-8,-.574,"#b8b19a","stone");
  canalRibbon(b,"canal-outer-edge",8,9,-.574,"#b8b19a","stone");
  canalRibbon(b,"canal-water-glint",-1.1,-.75,-.568,"#83b7ac","glow");
  for(let i=0;i<4;i++)bridge(b,i*Math.PI/2,i);
  // A bounded ring of shallow highlights makes the canal current legible without reflections.
  const currentGroup=new THREE.Group(),currentCount=b.profile==="mobile"?16:28;
  const current=new THREE.InstancedMesh(b.geo(new THREE.BoxGeometry(1,.025,.32)),b.material(new THREE.MeshBasicMaterial({color:"#b5ded0",transparent:true,opacity:.48,depthWrite:false})),currentCount);
  current.name="village-canal-current";current.frustumCulled=false;currentGroup.add(current);b.group.add(currentGroup);
  const currentDummy=new THREE.Object3D();
  const updateCurrent=(time:number,reduced:boolean)=>{for(let i=0;i<currentCount;i++){const a=(i/currentCount)*Math.PI*2+(reduced?0:time*.028);const r=leafCanalRadius(a);currentDummy.position.set(Math.cos(a)*r,-.548,Math.sin(a)*r);currentDummy.rotation.set(0,-a,0);currentDummy.scale.set(1,.8,1);currentDummy.updateMatrix();current.setMatrixAt(i,currentDummy.matrix);}current.instanceMatrix.needsUpdate=true;};
  updateCurrent(0,true);b.moving(currentGroup,f=>updateCurrent(f.time,f.reducedMotion));

  const homes=[[-157,-111,-.75,24,14],[-100,-166,-.45,20,18],[-35,-187,-.1,27,12],[47,-186,.15,23,17],[118,-153,.65,25,15],[171,-85,1.1,19,20],[-190,-27,-1.35,24,13],[-177,68,-1.9,27,12],[179,59,1.9,22,16],[-110,152,-2.5,25,13],[14,170,3.14,21,15],[115,148,2.45,23,13]];
  homes.forEach(([x,z,yaw,w,h],i)=>{const g=b.landmark(`village-district-${i}`,x,z,yaw);shop(b,g,["#d4b28c","#d7ba97","#bea07d"][i%3],["#758573","#ab7560","#647776"][i%3],["ICHIRAKU","LEAF MARKET","TEA HOUSE","HERBALIST"][i%4],w,h);lantern(b,g,-w*.62,10);b.tree(g,w*.74,-4,.9+i%3*.18);if(i%3===0)flag(b,g,-w*.58,12,0,"#b3795e",i);
    if(b.detail.secondary){b.box(g,"#947352",-w*.35,1,11,4,2,2);for(let k=0;k<3;k++)b.part(g,"ball","#c29d68",-w*.43+k,2.1,11,.45,.45,.45);b.box(g,"#886c51",w*.6,2.5,-3,.55,5,.55);}
  });
  for(let i=0;i<10;i++){const a=i*.64+.2,r=211+(i%3)*14,g=b.landmark(`grove-${i}`,Math.sin(a)*r,Math.cos(a)*r);b.tree(g,0,0,1.6+(i%3)*.2);if(b.detail.secondary)b.tree(g,9,4,.8);}
  const cliff=b.landmark("guardian-cliff",0,-275);b.part(cliff,"pebble","#a68f71",0,26,0,91,45,31,"rock");b.part(cliff,"pebble","#b39a79",-57,20,5,35,30,27,"rock");b.part(cliff,"pebble","#927f67",61,18,-3,40,36,29,"rock");
  // Overlapping rock shelves and shrubs make the guardian cliff read as terrain.
  for(let i=0;i<11;i++){
    const x=-81+i*16,z=13+Math.sin(i*1.8)*8;
    b.part(cliff,"pebble",i%2?"#9d886f":"#b3a080",x,5+(i%3)*2,z,15+(i%3)*3,8+(i%2)*3,11,"rock");
    if(i%2===0)b.part(cliff,"ball","#6c8d68",x,11,z+2,8,4.5,7,"foliage");
  }
  for(let i=0;i<4;i++){const x=-51+i*34;b.part(cliff,"ball","#c5ad87",x,34,25,12,16,6);b.part(cliff,"pebble","#af956f",x,48,26,13,8,6);b.box(cliff,"#8d795f",x,38,31,20,1.7,1);for(const sign of [-1,1]){b.box(cliff,"#776c58",x+sign*4.6,34,31,4,.9,.8);b.box(cliff,"#998365",x+sign*8,29,29,1.5,10,3);}b.part(cliff,"pebble","#b49a75",x,30,32,2.2,4.5,2.5);b.box(cliff,"#8d795f",x,24,31,6,.8,1);}
  for(const [x,z,s] of [[-135,-340,85],[115,-350,100],[-280,-370,110],[290,-410,120]]){const g=b.landmark(`mountain-${x}`,x,z);b.part(g,"cone","#8d9b85",0,25,0,s,75,s*.7);}
  const poles=b.landmark("village-utilities",0,155);for(const x of [-38,38])b.part(poles,"cylinder","#7d634c",x,6,0,.25,12,.25);cable(b,poles,new THREE.Vector3(-38,11,0),new THREE.Vector3(38,11,0));
  addWorldLife(b,"leaf");
}
