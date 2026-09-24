import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RADIUS } from "./simulation";
import { getMap, type MapId } from "./maps";
export interface Environment { group: THREE.Group; landmarks: THREE.Group[]; dispose(): void; }
export function buildEnvironment(id: MapId): Environment {
  const def=getMap(id),group=new THREE.Group(),landmarks:THREE.Group[]=[];
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  const own=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
  const box=own(new RoundedBoxGeometry(1,1,1,2,.12)),ball=own(new THREE.SphereGeometry(1,12,8)),disk=own(new THREE.CircleGeometry(1,48));
  const cache=new Map<string,THREE.Material>();
  function mat(color:string,flat=false){const key=color+flat;if(!cache.has(key)){const m=flat?new THREE.MeshBasicMaterial({color}):new THREE.MeshToonMaterial({color});cache.set(key,m);materials.add(m);}return cache.get(key)!;}
  function shape(p:THREE.Group,g:THREE.BufferGeometry,c:string,x:number,y:number,z:number,w:number,h:number,d:number,flat=false){const m=new THREE.Mesh(g,mat(c,flat));m.position.set(x,y,z);m.scale.set(w,h,d);p.add(m);return m;}
  const block=(p:THREE.Group,c:string,x:number,y:number,z:number,w:number,h:number,d:number)=>shape(p,box,c,x,y,z,w,h,d);
  function floor(c:string,x:number,z:number,w:number,d:number,a=0){const m=shape(group,box,c,x,-.44,z,w,.025,d,true);m.rotation.y=a;return m;}
  function circle(p:THREE.Group,c:string,x:number,y:number,z:number,r:number){const m=shape(p,disk,c,x,y,z,r,r,1,true);m.rotation.x=-Math.PI/2;return m;}
  function landmark(a:number,w:number,h:number,d:number){const g=new THREE.Group(),r=RADIUS+Math.hypot(w,d)/2+h*.85+14;g.position.set(Math.sin(a)*r,0,Math.cos(a)*r);g.rotation.y=a+Math.PI;g.userData.decorative=true;landmarks.push(g);group.add(g);return g;}
  // Layered translucent disks are soft contact shadows without shadow-map cost.
  function shadow(p:THREE.Group,x:number,z:number,w:number,d:number){for(let i=0;i<3;i++){const material=new THREE.MeshBasicMaterial({color:"#665d65",transparent:true,opacity:.025+i*.012,depthWrite:false});materials.add(material);const m=new THREE.Mesh(disk,material);m.rotation.x=-Math.PI/2;m.position.set(x,-.4+i*.008,z);m.scale.set(w*(1-i*.14),d*(1-i*.14),1);p.add(m);}}
  function sign(p:THREE.Group,text:string,x:number,y:number,z:number,w:number){block(p,"#f8edd6",x,y,z,w,3,.6);if(typeof document==="undefined")return;const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f8edd6';ctx.fillRect(0,0,512,128);ctx.fillStyle='#746454';ctx.font='bold 54px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66,470);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);const material=new THREE.MeshBasicMaterial({map:texture});materials.add(material);const mesh=new THREE.Mesh(own(new THREE.PlaneGeometry(w*.92,2.5)),material);mesh.position.set(x,y,z+.32);p.add(mesh);}
  function tree(p:THREE.Group,x:number,z:number,palm=false){block(p,"#ae886b",x,4,z,1.2,8,1.2);if(palm){for(let i=0;i<6;i++){const a=i*Math.PI/3;const leaf=shape(p,ball,"#92bea1",x+Math.sin(a)*2,8.8,z+Math.cos(a)*2,1.4,.65,4);leaf.rotation.y=a;}}else{for(let i=0;i<3;i++)shape(p,ball,["#9dc4a0","#b2cfaa","#92b59b"][i],x+(i-1)*2,7.5+(i%2)*2,z,3.6,3.6,3.4);}shadow(p,x,z,5,4);}
  function cottage(p:THREE.Group,c:string,roof:string,name:string){shadow(p,0,0,14,11);block(p,c,0,5,0,19,10,14);block(p,"#bd987a",0,.5,0,21,1.2,16);block(p,roof,0,11,0,22,3.5,17);block(p,roof,0,13,0,17,2,13);for(const x of [-6,6]){block(p,"#fff1ce",x,5,7.15,3.6,4,.4);block(p,"#b39784",x,5,7.4,.25,4,.15);}block(p,"#ad9587",0,3,7.2,3,6,.5);sign(p,name,0,9,8,13);}
  const outside=id==='harbor'?'#9dccc5':id==='shibuya'?'#bcb3c8':'#b9cfaf';
  shape(group,own(new THREE.PlaneGeometry(1100,1100)),outside,0,-.65,0,1,1,1,true).rotation.x=-Math.PI/2;
  circle(group,id==='harbor'?'#f1e7c9':'#d9d7be',0,-.53,0,RADIUS+6);
  circle(group,def.ground,0,-.5,0,RADIUS+.1);
  if(id==='shibuya'){
    floor('#a699a8',0,0,32,224);floor('#a699a8',0,0,224,32);
    // Sparse, low-contrast crossings keep the playing surface calm.
    for(const side of [-1,1])for(let i=-4;i<=4;i++){floor('#cfc4c7',i*3.6,side*25,2.1,9);floor('#cfc4c7',side*25,i*3.6,9,2.1);}
    for(let i=-4;i<=4;i++)floor('#c6bdc5',i*3.4,i*3.4,2,9,-Math.PI/4);
    for(let i=0;i<14;i++){
      const h=13+(i%3)*5,g=landmark(i*Math.PI/7,24,h+4,20);shadow(g,0,0,15,12);
      block(g,['#c6b1bf','#b7c6ca','#d9bca9','#b7b1cd'][i%4],0,h/2,0,21,h,17);block(g,'#ece0d5',0,h+1,0,23,2,19);
      const windows=new THREE.InstancedMesh(box,mat('#f5e1b0'),12),o=new THREE.Object3D();
      for(let j=0;j<12;j++){o.position.set(-6+(j%4)*4,5+Math.floor(j/4)*4,8.6);o.scale.set(2,2.3,.3);o.updateMatrix();windows.setMatrixAt(j,o.matrix);}g.add(windows);
      block(g,['#98b9ac','#dcaeac','#c6b8d6'][i%3],0,3.7,10,22,1.5,5);sign(g,['SHIBUYA','MOCHI','SPIRIT CAFE','STATION'][i%4],0,h-2,9,17);
      if(i%2===0)tree(g,16,0);
    }
    for(const a of [0,Math.PI]){const g=landmark(a,26,8,18);block(g,'#b5c5b8',0,3,0,25,6,15);block(g,'#7d818b',0,2,7.6,13,4,.2);sign(g,'STATION',0,6,8,20);}
  }else if(id==='leaf'){
    floor('#d9c39a',0,0,18,228);floor('#d9c39a',0,0,228,18);
    for(let d=-100;d<=100;d+=14){floor('#cdbc97',d,0,.12,17);floor('#cdbc97',0,d,17,.12);}
    for(let i=0;i<12;i++){const g=landmark(i*Math.PI/6,30,19,22);cottage(g,i%2?'#e5bf9f':'#e5cbb0',i%2?'#9eb6a0':'#c79d86',i%3?'LEAF VILLAGE':'RAMEN');tree(g,17,-2);for(const x of [-10,10]){block(g,'#b29278',x,4,10,.45,8,.45);shape(g,ball,'#f5d49c',x,7,10,1.2,1.6,1.2);}}
    const mountain=landmark(Math.PI,92,40,36);shape(mountain,ball,'#c8b49b',0,13,0,44,25,20);for(let i=0;i<4;i++){const x=-27+i*18;shape(mountain,ball,'#dfc9ac',x,21,15,7,9,4);for(const side of [-1,1])block(mountain,'#aa937b',x+side*2.5,22,18.5,2.3,.6,.5);shape(mountain,ball,'#cbb293',x,19,19,1.3,2.4,1);}
  }else if(id==='tournament'){
    const points:number[]=[];for(let n=-108;n<=108;n+=18){const d=Math.sqrt(RADIUS*RADIUS-n*n);points.push(n,-.445,-d,n,-.445,d,-d,-.445,n,d,-.445,n);}const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const m=new THREE.LineBasicMaterial({color:'#d2c9b3'});materials.add(m);group.add(new THREE.LineSegments(geo,m));
    for(let i=0;i<8;i++){const g=landmark(i*Math.PI/4,55,15,28);shadow(g,0,0,27,16);for(let row=0;row<3;row++)block(g,row%2?'#b1c9c0':'#e3c3ad',0,2+row*2,-row*4,42,3,6);
      const crowd=new THREE.InstancedMesh(ball,mat('#ffffff'),30),o=new THREE.Object3D();for(let j=0;j<30;j++){o.position.set(-17+(j%10)*3.8,4+Math.floor(j/10)*2,-Math.floor(j/10)*4);o.scale.set(.8,1,.8);o.updateMatrix();crowd.setMatrixAt(j,o.matrix);crowd.setColorAt(j,new THREE.Color(['#dba99b','#a5bbc8','#e4cd98'][j%3]));}g.add(crowd);tree(g,-26,0,true);tree(g,26,0,true);}
    for(const a of [0,Math.PI]){const g=landmark(a,45,24,18);for(const x of [-16,16])block(g,'#dba294',x,9,0,5,18,6);block(g,'#ecd5aa',0,18,0,39,5,8);block(g,'#8fb5ad',0,22,0,44,4,13);sign(g,'WORLD TOURNAMENT',0,18,4.6,30);}
  }else{
    // Shore scallops and water ripples remain below the play surface.
    for(let i=0;i<64;i++){const a=i*Math.PI/32;circle(group,'#efe4c6',Math.cos(a)*(RADIUS+4),-.55,Math.sin(a)*(RADIUS+4),5);}
    for(const x of [-25,25]){floor('#d8c19a',x,0,14,174);for(let z=-82;z<=82;z+=10)floor('#cdb790',x,z,13,.12);}
    for(let i=0;i<10;i++){const g=landmark(Math.PI*.5+i*Math.PI/10,38,18,26);block(g,'#c9b08c',0,-.12,0,30,.45,23);cottage(g,['#e3b5a4','#b3cbb6','#e4d3ad'][i%3],'#cda590',i%2?'TRADING POST':'GRAND LINE');tree(g,17,1,true);}
    for(const a of [Math.PI-.8,Math.PI,Math.PI+.8]){const g=landmark(a,34,37,52);shape(g,ball,'#b9977a',0,2,0,12,5,23);block(g,'#e3c59d',0,5,0,18,1,36);block(g,'#af9278',0,20,0,1.2,31,1.2);shape(g,ball,'#fff0d2',0,23,0,10,11,1.6);block(g,'#b9a6c6',4,35,0,8,4,.4);sign(g,'SAIL FREE',0,23,1.8,13);}
    for(let i=0;i<36;i++){const a=i*Math.PI/18,r=RADIUS+20+(i%3)*9;const wave=floor('#bbdcd1',Math.sin(a)*r,Math.cos(a)*r,9,.35,-a);wave.position.y=-.6;}
  }
  let disposed=false;return{group,landmarks,dispose(){if(disposed)return;disposed=true;group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}};
}
