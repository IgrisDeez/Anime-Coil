export type CityPoint = readonly [number, number];
export type FacadeKind = 'glass' | 'shop' | 'terrace' | 'commercial';
export const CITY_NEON=['#76ccc8','#d48caf','#9baee4'] as const;
export interface CityBlock { readonly x:number; readonly z:number; readonly width:number; readonly height:number; readonly depth:number; readonly kind:FacadeKind; readonly label:string; readonly rotation:number; readonly district:number }
/** Shared road/sidewalk anchors; chamfered corners remain clear of the circular arena. */
export function cityLoop(radius:number):readonly CityPoint[] {
  const corner=radius*.64;
  return [[-corner,-radius],[corner,-radius],[radius,-corner],[radius,corner],[corner,radius],[-corner,radius],[-radius,corner],[-radius,-corner],[-corner,-radius]];
}
export const CITY_ROAD=cityLoop(166);
export const CITY_WALK=cityLoop(145);
const labels=['COIL 109','MOCHI CAFE','NEON WORKS','SPIRIT ARCADE','NIGHT WALK','RAMEN / 麺','AFTER DARK','MIDNIGHT'];
/** Four street-aligned districts; the central gap on each frontage is a street mouth. */
export const CITY_BLOCKS:readonly CityBlock[]=Array.from({length:32},(_,index)=>{
  const district=Math.floor(index/8),slot=index%8,along=[-153,-119,-85,-51,51,85,119,153][slot],rotation=-district*Math.PI/2;
  const depth=28+(slot%3)*3,radius=207+depth/2;
  return {x:along*Math.cos(rotation)+(-radius)*Math.sin(rotation),z:-along*Math.sin(rotation)+(-radius)*Math.cos(rotation),rotation,
    width:32,height:slot===4?96:34+(index*19%57),depth,kind:(['commercial','shop','glass','terrace'] as const)[slot%4],label:labels[slot],district};
});
export interface RoadMarking {readonly x:number;readonly z:number;readonly width:number;readonly length:number;readonly angle:number;readonly kind:'crossing'|'lane'|'stop'|'hatch'}
/** Authored together with street approaches, never used by collision or spawn logic. */
export const ROAD_MARKINGS:readonly RoadMarking[]=Array.from({length:4},(_,side)=>{
  const angle=side*Math.PI/2,marks:RoadMarking[]=[];
  const add=(x:number,z:number,width:number,length:number,kind:RoadMarking['kind'])=>marks.push({x:x*Math.cos(angle)+z*Math.sin(angle),z:-x*Math.sin(angle)+z*Math.cos(angle),width,length,angle,kind});
  for(let i=-9;i<=9;i++)add(i*3.6,51,1.7,15,'crossing');
  add(0,65,64,1,'stop');
  for(let r=76;r<=194;r+=14)for(const lane of [-24,0,24])add(lane,r,.6,7,'lane');
  for(let i=0;i<6;i++)add(33+i*1.8,86+i*5,.6,8,'hatch');
  return marks;
}).flat();
/** Writes into a reusable pose; distance wraps around a closed route. */
export function routePose(points:readonly CityPoint[],distance:number,out:{x:number;z:number;angle:number}) {
  let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  let remaining=((distance%total)+total)%total;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(remaining<=length){const t=remaining/length;out.x=a[0]+dx*t;out.z=a[1]+dz*t;out.angle=Math.atan2(dx,dz);return out;}
    remaining-=length;
  }
  out.x=points[0][0];out.z=points[0][1];out.angle=0;return out;
}
