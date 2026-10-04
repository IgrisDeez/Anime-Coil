import type {CityFamily} from '../living-assets';
export type CityPoint=readonly[number,number];
export type FacadeKind='glass'|'shop'|'terrace'|'commercial';
export const CITY_NEON=['#5ed2df','#df6bb4','#95aefa'] as const;
export interface CityBlock {readonly x:number;readonly z:number;readonly width:number;readonly height:number;readonly depth:number;readonly kind:FacadeKind;readonly family:CityFamily;readonly label:string;readonly rotation:number;readonly district:number}
export interface CityStreet {readonly name:string;readonly points:readonly CityPoint[];readonly width:number}
export const CITY_JUNCTION:readonly CityPoint[]=[[-55,-74],[40,-74],[73,-36],[78,42],[50,73],[-35,78],[-79,41],[-83,-43]];
/** GO TOKYO's district relationships, with the crossing enlarged for the unchanged arena. */
export const CITY_STREETS:readonly CityStreet[]=[
 {name:'koen-approach',points:[[9,-55],[9,-158],[-22,-320]],width:38},
 {name:'bunkamura',points:[[-55,-10],[-126,-10],[-170,-36],[-315,-66]],width:44},
 {name:'dogenzaka',points:[[-112,2],[-162,34],[-318,104]],width:30},
 {name:'miyamasuzaka',points:[[55,-15],[151,-19],[335,-54]],width:38},
 {name:'station-approach',points:[[-5,55],[-5,164],[8,334]],width:42},
 {name:'center-gai',points:[[-78,-77],[-125,-118],[-125,-167],[-210,-224]],width:8},
];
export const CITY_ROAD:readonly CityPoint[]=[[-89,-190],[91,-185],[192,-89],[197,92],[91,196],[-93,202],[-195,95],[-200,-89],[-89,-190]];
export const CITY_WALK:readonly CityPoint[]=[[-52,-128],[52,-128],[128,-52],[128,52],[52,128],[-52,128],[-128,52],[-128,-52],[-52,-128]];
export const CITY_FRONTAGES=[
 {x:-66,z:-134,rotation:0,district:0,label:'CENTER GAI'},
 {x:83,z:-136,rotation:0,district:0,label:'JINNAN'},
 {x:136,z:-103,rotation:-Math.PI/2,district:1,label:'MIYASHITA'},
 {x:133,z:75,rotation:-Math.PI/2,district:1,label:'HIKARIE'},
 {x:84,z:135,rotation:Math.PI,district:2,label:'STATION'},
 {x:-94,z:135,rotation:Math.PI,district:2,label:'MARK CITY'},
 {x:-135,z:93,rotation:Math.PI/2,district:3,label:'DOGENZAKA'},
 {x:-136,z:-104,rotation:Math.PI/2,district:3,label:'BUNKAMURA'},
] as const;
const labels=['RAMEN','KARAOKE','COIL CAFE','BOOKS','ARCADE','IZAKAYA','RECORDS','TEA'];
const families:CityFamily[]=['Shop','Hotel','RoofGarden','Arcade','Civic','Glass','SlantTower','Terrace','Rounded'];
export const CITY_BLOCKS:readonly CityBlock[]=CITY_FRONTAGES.flatMap((f,section)=>{
 const hero:CityFamily|undefined=section===0?'Qfront':section===1?'Magnet':section===4?'StationTower':section===7?'Landmark109':undefined;
 const widths=hero?[11,12,26,12,13,12]:[14,15,14,17,13,13];let along=-widths.reduce((s,w)=>s+w+1.8,0)/2;
 return widths.map((w,i)=>{const offset=along+w/2;along+=w+1.8;
  const family=i===2&&hero?hero:families[(i+section)%families.length],depth=18+(section+i)%3*3;
  const frontOffset=(i%3-1)*1.25,rx=-Math.sin(f.rotation),rz=-Math.cos(f.rotation);
  return {x:f.x+offset*Math.cos(f.rotation)+rx*(depth/2+frontOffset),z:f.z-offset*Math.sin(f.rotation)+rz*(depth/2+frontOffset),rotation:f.rotation,
   width:w,height:family==='StationTower'?148:family==='Qfront'?76:family==='Magnet'?64:family==='Landmark109'?70:29+(i*17+section*11)%43,depth,family,
   kind:family==='Glass'?'glass':family==='Terrace'?'terrace':family==='Rounded'||family==='Landmark109'?'commercial':'shop',label:i===2&&hero?({Qfront:'QFRONT',Magnet:'MAGNET',StationTower:'SHIBUYA STATION',Landmark109:'109'} as Record<string,string>)[hero]:labels[(i+section)%labels.length],district:f.district};
 });
});
export interface RoadMarking {readonly x:number;readonly z:number;readonly width:number;readonly length:number;readonly angle:number;readonly kind:'crossing'|'lane'|'stop'|'hatch'}
function mouthCrossing(name:string,distance:number){
 const street=CITY_STREETS.find(street=>street.name===name)!,a=street.points[0],c=street.points[1],length=Math.hypot(c[0]-a[0],c[1]-a[1]);
 const dx=(c[0]-a[0])/length,dz=(c[1]-a[1])/length,x=a[0]+dx*distance,z=a[1]+dz*distance,span=street.width/2+3;
 return {name:name+'-crossing',from:[x-dz*span,z+dx*span] as CityPoint,to:[x+dz*span,z-dx*span] as CityPoint,width:8};
}
export const CROSSINGS:readonly {name:string;from:CityPoint;to:CityPoint;width:number}[]=[
 {name:'center-gai-diagonal',from:[-60,-76],to:[53,74],width:9},
 mouthCrossing('koen-approach',20),
 mouthCrossing('miyamasuzaka',23),
 mouthCrossing('station-approach',23),
 // One shared crossing spans the two western approaches before their divergence.
 {name:'west-crossing',from:[-86,-35],to:[-86,15],width:8},
];
export const ROAD_MARKINGS:readonly RoadMarking[]=[
 ...CROSSINGS.flatMap(({from,to,width})=>{const dx=to[0]-from[0],dz=to[1]-from[1],len=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),count=Math.floor(len/4);
  return Array.from({length:count},(_,i)=>{const t=(i+.5)/count;return {x:from[0]+dx*t,z:from[1]+dz*t,width,length:1.9,angle,kind:'crossing' as const};});}),
 ...CITY_STREETS.filter(s=>s.width>15).flatMap(street=>{const marks:RoadMarking[]=[];for(let segment=1;segment<street.points.length;segment++){
  const a=street.points[segment-1],c=street.points[segment],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
  const start=segment===1?45:9;
  for(let d=start;d<length-4;d+=13)marks.push({x:a[0]+dx*d/length,z:a[1]+dz*d/length,width:.35,length:5,angle,kind:'lane'});
  if(segment===1)marks.push({x:a[0]+dx*36/length,z:a[1]+dz*36/length,width:street.width-3,length:.65,angle,kind:'stop'});
 }return marks;}),
];
export function routePose(points:readonly CityPoint[],distance:number,out:{x:number;z:number;angle:number}){
 let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
 let remaining=((distance%total)+total)%total;for(let i=1;i<points.length;i++){const a=points[i-1],c=points[i],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);
  if(remaining<=length){const t=remaining/length;out.x=a[0]+dx*t;out.z=a[1]+dz*t;out.angle=Math.atan2(dx,dz);return out;}remaining-=length;
 }out.x=points[0][0];out.z=points[0][1];out.angle=0;return out;
}
