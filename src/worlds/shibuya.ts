import * as THREE from 'three';
import { WorldBuilder } from './builder';
import { CITY_BLOCKS, CITY_NEON, CITY_ROAD, CITY_WALK, ROAD_MARKINGS, cityLoop, type CityBlock } from './shibuya-layout';
import { shibuyaLife } from './shibuya-life';
import { CityBillboards, type BillboardArt } from './shibuya-art';
import { shibuyaSky } from './shibuya-sky';
import {cityKitAssets,type CityFamily} from '../living-assets';
import {RADIUS} from '../simulation';
import {shibuyaSteam} from './shibuya-steam';

function building(b:WorldBuilder,block:CityBlock,index:number,posters:CityBillboards,district:THREE.Group) {
  const {width:w,height:h,depth:d,kind}=block,g=b.landmark(`city-front-${index}`,block.x,block.z,block.rotation);
  g.userData.family=kind;g.userData.district=block.district;
  district.add(g);
  const front=d/2,ink='#182236',trim='#46546a',accent=CITY_NEON[index%3],mobile=b.profile==='mobile';
  const family:CityFamily=kind==='commercial'?'Rounded':kind==='glass'?'Glass':kind==='terrace'?'Terrace':index%8===5?'Arcade':'Shop';
  const prototype=cityKitAssets.family(b.profile,family);
  if(prototype){
    g.userData.family=family;const imported=b.imported(prototype,g);imported.scale.set(w/18,h/(prototype.userData.baseSize as number[])[1],d/14);
    b.box(g,'#344051',0,-.14,0,w+1,.7,d+1,'stone');
    b.sign(g,block.label,accent,0,7.8*h/48,front+1.6,w*.9,3.2,family==='Shop'?'shop':'neon',true);
    const art:BillboardArt=family==='Rounded'?'coil':family==='Glass'?'fashion':family==='Shop'?'ramen':family==='Arcade'?'arcade':'garden';
    const panelWidth=family==='Glass'?w*.27:w*.68,panelHeight=family==='Glass'?h*.25:panelWidth*.5;
    posters.panel(g,art,family==='Glass'?-w*.25:0,h*.65,front+.6,panelWidth,panelHeight);
    if(family==='Shop')for(let k=0;k<3;k++)b.sign(g,['夜 / 麺','24H','遊 / 茶'][k],accent,-w*.39,h*(.35+k*.13),front+d*.12,3.8,3.1,'shop',true);
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
    for(let k=0;k<3;k++)b.sign(g,['麺 / 夜','24H','遊 / 茶'][k],accent,-w*.38,h*.43+k*5,front+1.1,5.5,3.8,'shop',true);
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
  b.ground('#263246','#162137','wetAsphalt');
  // A single continuous asphalt apron joins the flat intersection to its perimeter roads.
  const apron=b.part(b.group,'disk','#273347',0,-.485,0,1,1,1,'wetAsphalt');apron.geometry=b.geo(new THREE.RingGeometry(RADIUS+.08,566,96));apron.rotation.x=-Math.PI/2;
  b.path('#41495b',cityLoop(190),24,-.45,'stone').name='shibuya-outer-walk';
  b.path('#263246',CITY_ROAD,22,-.425,'wetAsphalt').name='shibuya-connected-road';
  b.path('#3b4556',CITY_WALK,9,-.40,'stone').name='shibuya-connected-walk';
  for(const mark of ROAD_MARKINGS)b.flat(mark.kind==='crossing'?'#8499ae':'#71839a',mark.x,mark.z,mark.width,mark.length,mark.angle).position.y=-.365;
  // Long diagonal pedestrian stripes connect the four crossing mouths across the centre.
  for(const direction of [-1,1])for(let i=-20;i<=20;i++){if(Math.abs(i)<4)continue;b.flat('#7489a1',i*2.4,direction*i*2.4,1.7,6,direction*-Math.PI/4).position.y=-.36;}
  for(let side=0;side<4;side++){
    const a=side*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
    for(const lane of [-12,12])for(const r of [92,132]){
      const x=lane*c+r*s,z=-lane*s+r*c;
      b.flat('#647184',x,z,.8,7,a).position.y=-.355;
      for(const wing of [-1,1])b.flat('#647184',x+wing*1.5*c+2*s,z-wing*1.5*s+2*c,.7,4,a+wing*.55).position.y=-.35;
    }
    // Sidewalk seams, drains and tactile edging remain entirely flat.
    for(let r=-172;r<=172;r+=12){
      b.flat('#313c50',r*c+188*s,-r*s+188*c,.18,20,a).position.y=-.36;
      for(const edge of [179,201])b.flat('#65697a',r*c+edge*s,-r*s+edge*c,7,.35,a).position.y=-.35;
    }
    for(const along of [-63,63]){
      const g=b.landmark(`street-furniture-${side}-${along}`,along*c+195*s,-along*s+195*c,a+Math.PI);
      const sculpt=cityKitAssets.prop(b.profile,'Furniture');
      if(sculpt){b.imported(sculpt,g);b.tree(g,-10,0,.7);continue;}
      b.box(g,'#25364a',0,1.1,0,4,2.6,2);b.box(g,'#8bc2c3',0,1.5,1.05,3.2,1.6,.1,'glow');
      b.box(g,'#455267',6,1.5,0,.5,3,.5);b.sign(g,'BUS / 渋谷','#adcac4',6,3.8,0,6,2.5,'metro',true);
      b.tree(g,-8,0,.7);b.box(g,'#36465a',-8,0,0,7,.8,7,'stone');
      for(let k=0;k<4;k++)b.box(g,'#677385',-3+k*2,1.2,3,.16,2.4,.16);
      b.box(g,'#677385',0,2.4,3,7,.15,.15);
    }
  }
  for(let i=0;i<12;i++){
    const a=(i+.4)*Math.PI/6,g=b.landmark(`street-light-${i}`,Math.cos(a)*155,Math.sin(a)*155,a);
    b.part(g,'cylinder','#58697d',0,5,0,.16,10,.16);b.box(g,'#58697d',0,10,0,2.7,.25,.5);b.box(g,'#d9bd92',0,9.8,0,2.2,.25,.65,'glow');
  }
  for(let i=0;i<12;i++){
    const a=i*2.399,r=36+i*19%102,x=Math.cos(a)*r,z=Math.sin(a)*r;
    b.flat('#202d41',x,z,3+i%3,5+i%4,i*.5,'wetAsphalt').position.y=-.38;
    b.disk('#465267',x+5,z-3,1.3,-.35);b.disk('#273447',x+5,z-3,1,-.345);
  }
}
export function shibuya(b:WorldBuilder){
  streets(b);const posters=new CityBillboards(b);
  const clusters=Array.from({length:4},(_,i)=>{const g=new THREE.Group();g.name=`shibuya-district-${i}`;return b.cluster(g);});
  const districts=Array.from({length:4},(_,i)=>clusters[i%clusters.length]);
  CITY_BLOCKS.forEach((block,i)=>building(b,block,i,posters,districts[block.district]));
  for(let layer=0;layer<2;layer++)for(let side=0;side<4;side++)for(let i=0;i<(b.detail.secondary?6:4);i++){
    const count=b.detail.secondary?6:4,along=-150+i*300/(count-1),radius=layer?344:274,a=-side*Math.PI/2,h=layer?80+(i*17+side*23)%80:85+(i*23+side*19)%54;
    const g=b.landmark(`city-${layer?'skyline':'middle'}-${side}-${i}`,along*Math.cos(a)-radius*Math.sin(a),-along*Math.sin(a)-radius*Math.cos(a),a);
    districts[side].add(g);
    const w=layer?52:46,d=layer?44:42;
    b.box(g,layer?'#1e2b43':'#293b52',0,h/2,0,w,h,d,'facade');b.box(g,'#35465d',w*.1,h+3,0,w*.7,6,d*.7);
    for(let col=0;col<(b.detail.secondary?5:3);col++)for(let row=0;row<(layer?3:6);row++)b.box(g,(row+col+i)%4?'#3e5670':'#8f919a',-w*.37+col*w*.18,12+row*(h-16)/(layer?3:6),d/2+.1,2.2,layer?4:6,.15,'glow');
    if(!layer&&i%2===0)posters.panel(g,'moon',0,h*.7,d/2+.2,w*.8,w*.4);
  }
  for(const x of [-26,26]){
    const g=b.landmark(`station-${x}`,x,225,Math.PI);
    const prototype=cityKitAssets.family(b.profile,'Station');
    if(prototype){const model=b.imported(prototype,g);model.scale.set(2.1,1,2.1);b.sign(g,'SHIBUYA / STATION','#59cfdf',0,8.5,15.1,30,2.5,'metro',true);b.path('#3c485a',[[x,206],[x,190],[x,178]],9,-.395,'stone');continue;}
    b.box(g,'#34475c',0,5,0,38,11,30,'facade');b.box(g,'#101f35',0,3.5,15.2,27,7,.35);
    for(const side of [-1,1]){b.box(g,'#667c89',side*16,5,15,2,10,2,'stone');b.box(g,'#c4a77e',side*10,4,15.5,3,5,.15,'glow');}
    b.box(g,'#526c7d',0,11.2,6,41,1.4,21,'stone');b.sign(g,'SHIBUYA / STATION','#94dcd0',0,10,16.2,31,3,'metro',true);
    for(let k=0;k<4;k++)b.box(g,'#61717f',0,.1+k*.18,18-k*.8,27,.18,.9,'stone');
    b.path('#3c485a',[[x,206],[x,190],[x,178]],9,-.395,'stone');b.shadow(g,0,2,25,18);
  }
  const meeting=b.landmark('hachiko-meeting-square',69,207,Math.PI);
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
  b.sign(meeting,'MEET / 渋谷','#7bd7cb',0,1.3,1.65,3.5,1.1,'metro',true);
  shibuyaLife(b);shibuyaSteam(b);shibuyaSky(b);
}
