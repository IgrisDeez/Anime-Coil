import * as THREE from 'three';
import { WorldBuilder } from './builder';
import { CITY_BLOCKS, CITY_NEON, CITY_ROAD, CITY_WALK, CITY_STREETS, CITY_FRONTAGES, CITY_JUNCTION, ROAD_MARKINGS, type CityBlock } from './shibuya-layout';
import { shibuyaLife } from './shibuya-life';
import { CityBillboards, type BillboardArt } from './shibuya-art';
import { shibuyaSky } from './shibuya-sky';
import {cityKitAssets,type CityFamily} from '../living-assets';
import {shibuyaSteam} from './shibuya-steam';
import {RADIUS} from '../simulation';

function building(b:WorldBuilder,block:CityBlock,index:number,posters:CityBillboards,district:THREE.Group) {
  const {width:w,height:h,depth:d,kind}=block,g=b.landmark(`city-front-${index}`,block.x,block.z,block.rotation);
  g.userData.family=kind;g.userData.district=block.district;
  district.add(g);
  const front=d/2,ink='#182236',trim='#46546a',accent=CITY_NEON[index%3],mobile=b.profile==='mobile';
  const family:CityFamily=block.family;
  const prototype=cityKitAssets.family(b.profile,family);
  if(prototype){
    g.userData.family=family;const imported=b.imported(prototype,g);imported.scale.set(w/18,h/(prototype.userData.baseSize as number[])[1],d/14);
    b.box(g,'#344051',0,-.14,0,w+1,.7,d+1,'stone');
    const landmark=['Qfront','Magnet','Landmark109','StationTower'].includes(family);
    const signHeight=family==='Landmark109'?5:3.2,signY=family==='Landmark109'?h*.94:family==='Magnet'?h*.84:8.0;
    b.sign(g,block.label,landmark?accent:'#cfb99a',0,signY,front+1.6,w*.85,signHeight,landmark?'neon':'shop',true);
    // Large advertising belongs to a few designated facades, leaving the window detail readable.
    if(family==='Rounded'||family==='Arcade'){
      const panelWidth=w*.68;
      posters.panel(g,family==='Arcade'?'arcade':'coil',0,h*.64,front+1.4,panelWidth,panelWidth*.5);
    }
    if(family==='Qfront')posters.panel(g,'wave',0,h*.58,front+1.4,w*.82,h*.30);
    if(family==='Shop'&&index%2===0)b.sign(g,['らーめん','居酒屋','喫茶店'][Math.floor(index/2)%3],accent,-w*.39,h*.56,front+1.65,2.6,10.4,'column',true);
    b.shadow(g,0,0,w*.65,d*.6);return;
  }
  b.box(g,['#34415b','#454057','#2e4356','#41455c'][index%4],0,h/2,0,w,h,d,'facade');
  b.box(g,'#344051',0,-.14,0,w+1,.7,d+1,'stone');
  b.box(g,ink,0,h/2,front+.06,w-1,h-1,.13);
  const cols=kind==='glass'?5:4,step=mobile?9:6,rows=Math.floor((h-11)/step);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=(col-(cols-1)/2)*(w-3)/cols,y=12+row*step,lit=(row*7+col*3+index)%7<3;
    if(!mobile)b.box(g,'#435269',x,y,front+.18,(w-3)/cols-.7,step*.75,.28,'stone');
    b.box(g,lit?['#bca27e','#89a8b5','#ad91ae'][(row+index)%3]:'#26394e',x,y,front+.35,(w-3)/cols-1.2,step*.61,.1,'glow');
    if(kind==='glass'&&!mobile)b.box(g,'#21374a',x,y-.3,front+.44,(w-3)/cols-1.2,.18,.12);
  }
  for(const side of [-1,1]){
    for(let row=0;row<rows;row++)for(let col=0;col<(mobile?1:2);col++)b.box(g,(row+col+index)%4?'#3b5267':'#a99488',side*(w/2+.08),12+row*step,-d*.15+col*d*.32,.13,step*.61,3,'glow');
    b.box(g,trim,side*(w/2-.4),h/2,front+.45,.65,h,.7,'stone');
  }
  for(let level=9;level<h;level+=kind==='terrace'?12:18)b.box(g,trim,0,level,front+.5,w+.7,.45,1,'stone');
  const shopFront=front+(kind==='commercial'?4:0);
  for(let i=0;i<3;i++){
    const x=(i-1)*w/3;
    b.box(g,'#101b2d',x,3.1,shopFront+.65,w/3-.7,5.8,1.2);
    b.box(g,'#d7ac79',x,3.3,shopFront+1.3,w/3-1.6,4.8,.1,'glow');
    b.box(g,trim,x,3,shopFront+1.45,.22,5.8,.2);
    b.box(g,accent,x,6.4,shopFront+1.8,w/3-.5,.4,2.5);
  }
  b.sign(g,block.label,accent,0,8,shopFront+1.8,w*.9,3.2,kind==='shop'?'shop':'neon',true);
  if(kind==='glass'){
    for(let i=0;i<4;i++)b.box(g,'#607387',-w*.36+i*w*.24,h*.53,front+.55,.25,h*.76,.4,'stone');
    b.box(g,'#34455b',w*.22,h+4,-2,w*.56,8,d*.8,'facade');
    b.box(g,accent,0,h+1,front+.5,w*.88,.2,.35,'glow');
    b.box(g,ink,-w*.29,h*.62,front+.9,10,19,.5);
    posters.panel(g,'fashion',-w*.29,h*.62,front+1.2,9.5,18);
  }
  if(kind==='shop'){
    b.box(g,'#243148',0,h+1,0,w,2,d,'facade');
    b.box(g,'#22324a',-w*.38,h*.64,front+.7,6,h*.5,.6);
    b.sign(g,'居酒屋',accent,-w*.38,h*.52,front+1.1,2.8,11.2,'column',true);
    for(const side of [-1,1])b.part(g,'cylinder','#e9b57d',side*w*.35,5.2,front+3,.5,1.4,.5,'glow');
    posters.panel(g,'ramen',w*.1,h*.55,front+.8,w*.61,w*.305);
  }
  if(kind==='commercial'){
    // Curved corner bay and stacked screens replace the repeated plain window-grid silhouette.
    b.part(g,'cylinder','#344358',0,h*.45,front-4,w*.48,h*.9,8,'facade');
    for(let level=16;level<h-10;level+=18){
      b.box(g,'#27334b',0,level,front+4,w*.94,7,1.3);
      posters.panel(g,(['coil','arcade','moon'] as BillboardArt[])[Math.floor(level/12)%3],0,level,front+4.7,w*.9,w*.45);
    }
    b.box(g,'#222e45',0,h+5,0,w*.9,10,d*.8);
    posters.panel(g,'coil',0,h+5,d*.41,w*.83,w*.415);
    b.box(g,accent,0,9,front+5,w,.25,.4,'glow');
  }
  if(kind==='terrace'){
    b.box(g,trim,w*.2,h+5,-2,w*.5,10,d*.7,'facade');
    for(let y=18;y<h-6;y+=12){b.box(g,'#43546b',w*.2,y,front+1,w*.5,.4,2);b.box(g,'#607183',w*.2,y+1.2,front+2,w*.5,.2,.2);}
    posters.panel(g,'night',-w*.22,h*.56,front+.8,w*.43,w*.43);
  }
  b.box(g,'#526177',0,h+.3,0,w+.6,.6,d+.6,'stone');
  for(const side of [-1,1]){b.box(g,trim,side*w/2,h+1,0,.4,1.4,d);b.box(g,trim,0,h+1,side*d/2,w,1.4,.4);}
  b.box(g,'#2c3b51',-w*.2,h+2.1,-d*.15,5,3,5);
  if(!mobile){for(let k=0;k<2;k++)b.box(g,'#5d6c7b',w*.12+k*3,h+1.3,-d*.25,2.1,1.4,3);b.part(g,'cylinder','#607185',-w*.3,h+5,-d*.3,.08,7,.08);}
  b.shadow(g,0,2,w*.66,d*.65);
}
function streets(b:WorldBuilder){
  b.ground('#243145','#283548','wetAsphalt');
  // Leave an actual hole over the junction: the opaque asphalt is submitted once.
  const pavement=Array.from({length:32},(_,i)=>[Math.cos(i/32*Math.PI*2)*(RADIUS+.08),Math.sin(i/32*Math.PI*2)*(RADIUS+.08)] as const);
  b.polygon('#344255',pavement,-.445,'stone',[CITY_JUNCTION],b.profile==='mobile'?3:4).name='shibuya-corner-pavement';
  for(const street of CITY_STREETS){
    b.path('#243145',street.points,street.width,-.435,'wetAsphalt').name=street.name+'-road';
  }
  b.path('#273144',CITY_ROAD,16,-.425,'wetAsphalt').name='shibuya-background-service-road';
  // Pavement follows real building fronts, never diagonal chords through the junction.
  for(const f of CITY_FRONTAGES){
    const x=f.x+Math.sin(f.rotation)*6,z=f.z+Math.cos(f.rotation)*6;
    b.flat('#3f4d60',x,z,101,9,f.rotation,'stone').position.y=-.405;
    b.flat('#677282',x+Math.sin(f.rotation)*4.4,z+Math.cos(f.rotation)*4.4,101,.28,f.rotation).position.y=-.395;
  }
  for(const mark of ROAD_MARKINGS)b.flat(mark.kind==='crossing'?'#8799ae':'#687c91',mark.x,mark.z,mark.width,mark.length,mark.angle).position.y=-.365;
  for(let i=0;i<CITY_WALK.length-1;i++){
    const [x,z]=CITY_WALK[i],a=Math.atan2(-x,-z),g=b.landmark('street-light-'+i,x,z,a);
    const sculpt=cityKitAssets.prop(b.profile,'Furniture');
    if(sculpt)b.imported(sculpt,g);else {b.box(g,'#34465a',0,1,0,4,2,2);b.box(g,'#b9a383',-4,1.3,0,5,.3,2);}
    // The poles remain on the sidewalk, behind the playable clearance boundary.
    b.part(g,'cylinder','#58697d',0,5,-2,.13,10,.13);b.box(g,'#d9bd92',0,9.8,-2,2,.24,.6,'glow');
  }
  for(let i=0;i<4;i++){
    const f=CITY_FRONTAGES[i*2],g=b.landmark('street-light-'+(i+8),f.x+Math.sin(f.rotation)*5,f.z+Math.cos(f.rotation)*5,f.rotation);
    b.part(g,'cylinder','#58697d',0,5,0,.13,10,.13);b.box(g,'#d9bd92',0,9.8,0,2,.24,.6,'glow');
  }
  for(let i=0;i<14;i++){
    const a=i*2.399,r=25+i*17%120,x=Math.cos(a)*r,z=Math.sin(a)*r;
    b.flat(['#243a4d','#39304a','#263950'][i%3],x,z,2+i%3,5+i%4,i*.5,'wetAsphalt').position.y=-.38;
    b.disk('#465267',x+5,z-3,1.1,-.35);b.disk('#273447',x+5,z-3,.9,-.345);
  }
}
export function shibuya(b:WorldBuilder){
  streets(b);const posters=new CityBillboards(b);
  const clusters=Array.from({length:4},(_,i)=>{const g=new THREE.Group();g.name=`shibuya-district-${i}`;return b.cluster(g);});
  const districts=Array.from({length:4},(_,i)=>clusters[i%clusters.length]);
  CITY_BLOCKS.forEach((block,i)=>building(b,block,i,posters,districts[block.district]));
  // Two populated city layers share silhouettes and small instanced window strips.
  for(let layer=0;layer<2;layer++)for(let section=0;section<8;section++){
    const f=CITY_FRONTAGES[section],count=layer?(b.detail.secondary?8:6):(b.detail.secondary?6:4);
    for(let i=0;i<count;i++){
      const along=(i-(count-1)/2)*(layer?29:25),a=f.rotation,offset=layer?152:84,h=layer?62+(i*17+section*23)%112:44+(i*23+section*19)%68;
      const x=f.x+along*Math.cos(a)-Math.sin(a)*offset,z=f.z-along*Math.sin(a)-Math.cos(a)*offset;
      const g=b.landmark('city-'+(layer?'skyline':'middle')+'-'+section+'-'+i,x,z,a);districts[f.district].add(g);
      const w=layer?27:22,d=layer?32:26;
      const family:CityFamily=(['Hotel','SlantTower','Glass','RoofGarden','Civic'] as const)[(i+section*2+layer)%5];
      const imported=(layer?i%4===2:i%2===1)?cityKitAssets.family(b.profile,family):undefined;
      if(imported){
        g.userData.family=family;const model=b.imported(imported,g);model.scale.set(w/18,h/(imported.userData.baseSize as number[])[1],d/14);
      }else{
        // Low-cost masses retain different crowns and setbacks in the distance.
        const variant=(i+section+layer)%3,color=['#25334c','#33465c','#464754','#3c5056'][(i+section)%4];
        if(variant===0){b.box(g,color,0,h*.35,0,w,h*.70,d,'facade');b.box(g,color,-w*.08,h*.85,-d*.05,w*.72,h*.30,d*.75,'facade');}
        else if(variant===1){b.box(g,color,0,h/2,0,w*.82,h,d,'facade');b.box(g,'#536171',0,h+1,0,w*.84,2,d*.96);}
        else{b.box(g,color,0,h*.39,0,w,h*.78,d,'facade');b.box(g,color,w*.17,h*.89,-d*.12,w*.65,h*.22,d*.72,'facade');b.box(g,'#526954',-w*.32,h*.79,0,w*.18,2,d*.82);}
        b.box(g,'#48566b',w*.12,h+1.4,0,w*.44,2.8,d*.5);
        for(let col=0;col<(layer?2:3);col++)for(let row=0;row<(layer?3:4);row++)b.box(g,(row+col+i)%4?'#526880':'#b6a691',-w*.28+col*w*.28,12+row*(h*.72-16)/(layer?3:4),d/2+.1,2.1,layer?4:5,.1,'glow');
      }
    }
  }
  const meeting=b.landmark('hachiko-meeting-square',94,125,Math.PI);
  const guardian=cityKitAssets.prop(b.profile,'Meeting');
  if(guardian)b.imported(guardian,meeting);
  else{
  b.box(meeting,'#43536a',0,.25,0,23,.5,17,'stone');
  b.box(meeting,'#5b686f',0,1.1,0,4,1.7,3,'stone');
  // A small seated meeting-place guardian; no collision geometry enters the arena.
  b.part(meeting,'ball','#6d8b83',0,3.5,0,1.2,1.8,1);
  b.part(meeting,'ball','#7b9a8a',0,5.2,.15,1,1,.9);
  for(const side of [-1,1]){b.part(meeting,'cone','#78928b',side*.62,6,.15,.35,.8,.35);b.part(meeting,'cylinder','#6d8b83',side*.7,2.9,.8,.24,2.4,.24);b.box(meeting,'#6d8b83',side*.7,1.8,1.1,.55,.35,.85);b.box(meeting,'#a18169',side*7,1.2,0,5,.25,2);b.box(meeting,'#26374b',side*7,.6,0,4,.9,1.5);}
  }
  b.sign(meeting,'HACHIKO','#7bd7cb',0,1.3,1.65,3.5,1.1,'metro',true);
  shibuyaLife(b);shibuyaSteam(b);shibuyaSky(b);
}
