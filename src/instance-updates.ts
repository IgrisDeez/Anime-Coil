import * as THREE from 'three';
import type { FrameProfiler } from './frame-profiler';
import type { Food } from './simulation';
import { bodyRadiusAt, serpentScale, type Serpent } from './simulation';
import { breathing } from './presentation';
import { isPlayerMarkSegment } from './coil-skins';

/** Upload only the changed active components; update ranges are consumed by Three.js. */
export function dirtyRange(attribute:THREE.BufferAttribute,start:number,count:number,profiler?:FrameProfiler){
  if(count<=0)return;
  // An off-screen mesh may keep pending ranges for many frames. Merge rather
  // than growing that list or discarding edits that have not reached the GPU.
  let end=start+count;
  for(const range of attribute.updateRanges){start=Math.min(start,range.start);end=Math.max(end,range.start+range.count);}
  attribute.clearUpdateRanges();attribute.addUpdateRange(start,end-start);attribute.needsUpdate=true;
  if(profiler?.enabled){profiler.counts.dirtyRanges++;profiler.counts.uploadBytes+=count*attribute.array.BYTES_PER_ELEMENT;}
}
export class FoodColors {
  private colors=new Int16Array(1700).fill(-1);
  update(mesh:THREE.InstancedMesh,food:readonly Food[],palette:readonly THREE.Color[],profiler?:FrameProfiler){
    let first=food.length,last=-1;
    for(let i=0;i<food.length;i++){if(this.colors[i]===food[i].color)continue;this.colors[i]=food[i].color;mesh.setColorAt(i,palette[food[i].color]);first=Math.min(first,i);last=i;}
    // Three.js creates instanceColor lazily; every newly visible slot is initialized above.
    if(mesh.instanceColor&&last>=first)dirtyRange(mesh.instanceColor,first*3,(last-first+1)*3,profiler);
  }
  clear(){this.colors.fill(-1);}
}

type SnakeBuffers = {body:THREE.InstancedMesh;outline:THREE.InstancedMesh;shadow:THREE.InstancedMesh;marks?:THREE.InstancedMesh};
/** Axis-aligned body transforms and flat shadow transforms; no Object3D composition. */
export function writeInstance(attribute:THREE.BufferAttribute,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,flat=false){
  const a=attribute.array as Float32Array,o=index*16;
  x=Math.fround(x);y=Math.fround(y);z=Math.fround(z);sx=Math.fround(sx);sy=Math.fround(sy);sz=Math.fround(sz);
  if(a[o]===sx&&a[o+5]===(flat?0:sy)&&a[o+6]===(flat?-sy:0)&&a[o+9]===(flat?sz:0)&&a[o+10]===(flat?0:sz)&&a[o+12]===x&&a[o+13]===y&&a[o+14]===z&&a[o+15]===1)return false;
  a[o]=sx;a[o+1]=a[o+2]=a[o+3]=a[o+4]=a[o+7]=a[o+8]=a[o+11]=0;
  a[o+5]=flat?0:sy;a[o+6]=flat?-sy:0;a[o+9]=flat?sz:0;a[o+10]=flat?0:sz;
  a[o+12]=x;a[o+13]=y;a[o+14]=z;a[o+15]=1;return true;
}
export class SnakeInstances {
  private x=new Float64Array(360).fill(NaN);
  private z=new Float64Array(360).fill(NaN);
  private radius=new Float64Array(360);
  private bounds=new THREE.Sphere();
  private length=-1;private mass=NaN;private step:number|undefined;
  private time=NaN;private compression=NaN;private frozen=false;private elastic=false;
  private still:boolean|undefined;private boosting:boolean|undefined;
  private ranges=new Int32Array(8);
  private attributes:(THREE.BufferAttribute|undefined)[]|undefined;
  private meshes:(THREE.InstancedMesh|undefined)[]|undefined;
  private profiler:FrameProfiler|undefined;
  private write(slot:number,attribute:THREE.BufferAttribute,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,flat=false){
    if(this.profiler?.enabled)this.profiler.counts.matrices++;
    if(writeInstance(attribute,index,x,y,z,sx,sy,sz,flat)){
      if(this.ranges[slot*2]<0)this.ranges[slot*2]=index;this.ranges[slot*2+1]=index;
      if(this.profiler?.enabled)this.profiler.counts.updatedInstances++;
    }
  }
  update(v:SnakeBuffers,s:Serpent,time:number,still:boolean,elastic:boolean,compression:number,profiler?:FrameProfiler,step?:number){
    const animationTime=still&&!elastic?0:time;
    const shapeChanged=this.length!==s.body.length||this.mass!==s.mass;
    const poseChanged=this.time!==animationTime||this.compression!==compression||this.frozen!==s.frozen||this.elastic!==elastic||this.still!==still||this.boosting!==s.boosting;
    const positionsMayChange=step===undefined||step!==this.step||shapeChanged;
    if(!positionsMayChange&&!poseChanged&&!shapeChanged)return;
    const n=s.body.length,size=serpentScale(s.mass);this.ranges.fill(-1);this.profiler=profiler;
    if(shapeChanged)for(let i=1;i<n;i++)this.radius[i]=bodyRadiusAt(i,n,s.mass);
    this.meshes??=[v.body,v.outline,v.shadow,v.marks];
    this.attributes??=[v.body.instanceMatrix,v.outline.instanceMatrix,v.shadow.instanceMatrix,v.marks?.instanceMatrix];
    if(shapeChanged||positionsMayChange)this.write(2,v.shadow.instanceMatrix,0,s.x,-.37,s.z,size*1.25,size*1.05,1,true);
    let markCount=0;
    for(let i=1;i<n;i++){
      const b=s.body[i],positionChanged=positionsMayChange&&(this.x[i]!==b.x||this.z[i]!==b.z);
      const hasMark=!!v.marks&&isPlayerMarkSegment(i);
      if(shapeChanged||positionChanged||poseChanged){
        const radius=this.radius[i],y=(.5+breathing(time-i*.15,s.id,s.boosting,still))*size;
        const height=radius*.85*compression*(elastic?1+Math.sin(time*11-i*.4)*.2:1),rim=s.frozen?1.08:1.06;
        this.write(0,v.body.instanceMatrix,i-1,b.x,y,b.z,radius,height,radius);
        this.write(1,v.outline.instanceMatrix,i-1,b.x,y,b.z,radius*rim,height*rim,radius*rim);
        if(hasMark)this.write(3,v.marks!.instanceMatrix,markCount,b.x,y+height*.97,b.z,radius,radius,radius);
      }
      if(shapeChanged||positionChanged){const radius=this.radius[i];this.write(2,v.shadow.instanceMatrix,i,b.x,-.37,b.z,radius*1.25,radius*1.25,1,true);}
      if(hasMark)markCount++;
      if(positionsMayChange){this.x[i]=b.x;this.z[i]=b.z;}
    }
    if(v.marks)v.marks.count=markCount;
    if(positionsMayChange){
      let minX=s.x,maxX=s.x,minZ=s.z,maxZ=s.z;
      for(let i=1;i<n;i++){minX=Math.min(minX,this.x[i]);maxX=Math.max(maxX,this.x[i]);minZ=Math.min(minZ,this.z[i]);maxZ=Math.max(maxZ,this.z[i]);}
      // Includes all breathing, elastic recoil, outlines, marks and flat shadows.
      this.bounds.center.set((minX+maxX)/2,0,(minZ+maxZ)/2);
      this.bounds.radius=Math.hypot((maxX-minX)/2,(maxZ-minZ)/2)+size*3;
      for(const mesh of this.meshes)if(mesh){mesh.boundingSphere??=new THREE.Sphere();mesh.boundingSphere.copy(this.bounds);mesh.frustumCulled=true;}
    }
    for(let slot=0;slot<4;slot++){const first=this.ranges[slot*2],last=this.ranges[slot*2+1];if(first>=0&&this.attributes[slot])dirtyRange(this.attributes[slot]!,first*16,(last-first+1)*16,profiler);}
    this.length=n;this.mass=s.mass;this.step=step;this.time=animationTime;this.compression=compression;this.frozen=s.frozen;this.elastic=elastic;this.still=still;this.boosting=s.boosting;
  }
}
