import * as THREE from "three";
import { RADIUS } from "../simulation";
import { reaction, PROFILES, type DetailProfile, type EnvironmentFrame, type WorldStats } from "./types";
export type Shape = "box" | "ball" | "cylinder" | "cone" | "disk" | "pebble";
type Style = "matte" | "glow" | "shadow" | "foliage" | "crowd";
export class WorldBuilder {
  readonly group = new THREE.Group();
  readonly landmarks: THREE.Group[] = [];
  readonly geometries = new Set<THREE.BufferGeometry>();
  readonly materials = new Set<THREE.Material>();
  readonly textures = new Set<THREE.Texture>();
  readonly motions: ((f: EnvironmentFrame) => void)[] = [];
  readonly detail;
  private wind = {value:0};
  private windStrength = {value:1};
  private shapes: Record<Shape, THREE.BufferGeometry>;
  private surface: Record<Style, THREE.Material>;
  private atlas: THREE.Texture;
  private signMaterial: THREE.MeshBasicMaterial;
  private signCount = 0;
  private signs: {text:string;color:string}[] = [];
  private signPhase = -1;
  private signContext?: CanvasRenderingContext2D;
  private dynamic = new Set<THREE.Object3D>();
  constructor(readonly profile: DetailProfile) {
    this.detail = PROFILES[profile];
    this.shapes = {box:this.geo(new THREE.BoxGeometry(1,1,1)),ball:this.geo(new THREE.SphereGeometry(1,8,6)),cylinder:this.geo(new THREE.CylinderGeometry(1,1,1,8)),cone:this.geo(new THREE.ConeGeometry(1,1,4)),disk:this.geo(new THREE.CircleGeometry(1,24)),pebble:this.geo(new THREE.IcosahedronGeometry(1,0))};
    this.surface = {
      foliage: this.swayMaterial("white",false),
      crowd: this.swayMaterial("white",true),
      matte:this.material(new THREE.MeshToonMaterial({color:"white"})),
      glow:this.material(new THREE.MeshBasicMaterial({color:"white"})),
      shadow:this.material(new THREE.MeshBasicMaterial({color:"#363247",transparent:true,opacity:.13,depthWrite:false})),
    };
    if (typeof document !== "undefined") {
      const canvas=document.createElement("canvas");canvas.width=canvas.height=this.detail.atlas;
      this.signContext=canvas.getContext("2d") ?? undefined;
      this.atlas=this.texture(new THREE.CanvasTexture(canvas));
    } else this.atlas=this.texture(new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1));
    this.atlas.colorSpace=THREE.SRGBColorSpace;
    this.signMaterial=this.material(new THREE.MeshBasicMaterial({map:this.atlas,color:"white",side:THREE.DoubleSide}));
  }
  swayMaterial(color:string,crowd=false) {
    const material=this.material(new THREE.MeshToonMaterial({color,side:THREE.DoubleSide}));
    material.onBeforeCompile=shader=>{
      shader.uniforms.worldWind=this.wind;shader.uniforms.windStrength=this.windStrength;
      shader.vertexShader="uniform float worldWind; uniform float windStrength;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
        transformed.${crowd?"y":"x"} += sin(worldWind * ${crowd?"1.4":".7"} + position.y * 1.6 + instanceMatrix[3].x) * windStrength * ${crowd?".09":".035"} * max(0.0,position.y);`);
    };
    material.customProgramCacheKey=()=>crowd?"world-crowd":"world-wind";
    return material;
  }
  update(frame:EnvironmentFrame){
    this.wind.value=frame.time;this.windStrength.value=frame.reducedMotion?0:1;
    const response=reaction(frame.ultimate,frame.reducedMotion);
    (this.surface.glow as THREE.MeshBasicMaterial).color.set("white").lerp(new THREE.Color("#aa65ff"),response.tint).multiplyScalar(response.light);
    this.signMaterial.color.copy((this.surface.glow as THREE.MeshBasicMaterial).color);
  }
  geo<T extends THREE.BufferGeometry>(g:T):T {this.geometries.add(g);return g;}
  material<T extends THREE.Material>(m:T):T {this.materials.add(m);return m;}
  texture<T extends THREE.Texture>(t:T):T {this.textures.add(t);return t;}
  part(parent:THREE.Group,shape:Shape,color:string,x:number,y:number,z:number,w:number,h:number,d:number,style:Style="matte") {
    const mesh=new THREE.Mesh(this.shapes[shape],this.surface[style]);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
    mesh.userData.color=color;mesh.userData.role=y+h/2>0?"scenery":"ground";parent.add(mesh);return mesh;
  }
  box(p:THREE.Group,c:string,x:number,y:number,z:number,w:number,h:number,d:number,style:Style="matte") {return this.part(p,"box",c,x,y,z,w,h,d,style);}
  flat(c:string,x:number,z:number,w:number,d:number,rotation=0) {const m=this.box(this.group,c,x,-.465,z,w,.02,d,"glow");m.rotation.y=rotation;return m;}
  disk(c:string,x:number,z:number,r:number,y=-.48) {const m=this.part(this.group,"disk",c,x,y,z,r,r,1,"glow");m.rotation.x=-Math.PI/2;return m;}
  landmark(name:string,x:number,z:number,rotation=0):THREE.Group {
    const g=new THREE.Group();g.name=name;g.position.set(x,0,z);g.rotation.y=rotation;g.userData.decorative=true;this.group.add(g);this.landmarks.push(g);return g;
  }
  shadow(g:THREE.Group,x:number,z:number,w:number,d:number) {
    const m=this.part(g,"disk","#ffffff",x,-.41,z,w,d,1,"shadow");m.rotation.x=-Math.PI/2;
  }
  sign(g:THREE.Group,text:string,color:string,x:number,y:number,z:number,w:number,h=3) {
    if(this.signCount>=64)throw new Error("Sign atlas is full");
    this.signs.push({text,color});
    const index=this.signCount++,col=index%4,row=Math.floor(index/4),cw=this.detail.atlas/4,ch=this.detail.atlas/16,c=this.signContext;
    if(c){c.fillStyle="#202b3d";c.fillRect(col*cw,row*ch,cw,ch);c.strokeStyle=color;c.lineWidth=2;c.strokeRect(col*cw+2,row*ch+2,cw-4,ch-4);c.fillStyle=color;c.textAlign="center";c.textBaseline="middle";c.font=`bold ${Math.round(ch*.5)}px sans-serif`;c.fillText(text,col*cw+cw/2,row*ch+ch/2,cw-12);}
    const geo=this.geo(new THREE.PlaneGeometry(w,h)),uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(col+uv.getX(i))/4,1-(row+1-uv.getY(i))/16);
    const mesh=new THREE.Mesh(geo,this.signMaterial);mesh.position.set(x,y,z);mesh.userData.color="#ffffff";g.add(mesh);return mesh;
  }
  animateSigns(time:number,reduced:boolean) {
    const phase=reduced?0:Math.floor(time/8)%2;
    if(phase===this.signPhase||!this.signContext)return;
    this.signPhase=phase;
    const c=this.signContext,cw=this.detail.atlas/4,ch=this.detail.atlas/16;
    this.signs.forEach((sign,index)=>{if(index%3)return;const col=index%4,row=Math.floor(index/4);c.fillStyle="#202b3d";c.fillRect(col*cw+4,row*ch+4,cw-8,ch-8);c.fillStyle=sign.color;c.textAlign="center";c.textBaseline="middle";c.font=`bold ${Math.round(ch*.5)}px sans-serif`;c.fillText(phase?"WELCOME / ようこそ":sign.text,col*cw+cw/2,row*ch+ch/2,cw-12);});
    this.atlas.needsUpdate=true;
  }
  // Geometry travels along the line between two points; useful for cables, ropes and rails.
  beam(g:THREE.Group,c:string,a:THREE.Vector3,b:THREE.Vector3,r=.12) {
    const delta=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);
    const m=this.part(g,"cylinder",c,mid.x,mid.y,mid.z,r,delta.length(),r);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
  }
  moving(g:THREE.Group,update:(f:EnvironmentFrame)=>void) {this.dynamic.add(g);this.motions.push(update);}
  tree(g:THREE.Group,x:number,z:number,scale=1,palm=false) {
    this.part(g,"cylinder","#866443",x,4*scale,z,.55*scale,8*scale,.55*scale);
    for(let i=0;i<(palm?5:3);i++){
      const a=i*2.1;const m=this.part(g,"ball",["#6e9665","#8aaa70","#527e5d"][i%3],x+Math.sin(a)*2*scale,(palm?8:7+i*.6)*scale,z+Math.cos(a)*scale,(palm?1:3)*scale,.8*scale+(palm?0:2*scale),(palm?4:3)*scale,"foliage");if(palm)m.rotation.y=a;
    }this.shadow(g,x,z,5*scale,3*scale);
  }
  roof(g:THREE.Group,c:string,w:number,y:number,d:number) {const m=this.part(g,"cone",c,0,y,0,w*.73,6,d*.73);m.rotation.y=Math.PI/4;return m;}
  ground(c:string,outside:string) {this.box(this.group,outside,0,-.7,0,4000,.05,4000,"glow");const floor=this.part(this.group,"disk",c,0,-.5,0,RADIUS+.08,RADIUS+.08,1,"glow");floor.geometry=this.geo(new THREE.CircleGeometry(1,96));floor.rotation.x=-Math.PI/2;}
  finish() {
    this.atlas.needsUpdate=true;
    this.group.updateMatrixWorld(true);
    // Validate actual authored extents before replacing meshes with instance batches.
    for(const g of this.landmarks){
      const bounds=new THREE.Box3().setFromObject(g),nearest=new THREE.Vector3(Math.max(bounds.min.x,Math.min(0,bounds.max.x)),0,Math.max(bounds.min.z,Math.min(0,bounds.max.z)));
      if(nearest.length()<RADIUS+6)throw new Error(`${g.name} intrudes into playable space`);
      g.userData.bounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
    }
    this.batch(this.group,true);
    // Keep truthful world-space proxies for clearance inspection, never rendered.
    for(const g of this.landmarks){const b=g.userData.bounds;const min=new THREE.Vector3().fromArray(b.min),max=new THREE.Vector3().fromArray(b.max);const proxy=new THREE.Mesh(this.shapes.box,this.surface.matte);proxy.visible=false;proxy.position.copy(min).add(max).multiplyScalar(.5);proxy.scale.copy(max).sub(min);g.clear();g.position.set(0,0,0);g.rotation.set(0,0,0);g.add(proxy);this.group.add(g);}
  }
  private batch(root:THREE.Group,global:boolean) {
    root.updateMatrixWorld(true);
    const inverse=root.matrixWorld.clone().invert(),batches=new Map<string,{geo:THREE.BufferGeometry;mat:THREE.Material;items:THREE.Mesh[]}>(),keep:THREE.Group[]=[];
    const visit=(o:THREE.Object3D)=>{if(o!==root&&this.dynamic.has(o)){this.batch(o as THREE.Group,false);keep.push(o as THREE.Group);return;}if(o instanceof THREE.Mesh){const key=o.geometry.uuid+o.material.uuid;let bucket=batches.get(key);if(!bucket){bucket={geo:o.geometry,mat:o.material,items:[]};batches.set(key,bucket);}bucket.items.push(o);}else for(const child of o.children)visit(child);};visit(root);
    const result:THREE.Object3D[]=[];
    // Sign panels use one merged geometry/atlas despite distinct UV rectangles.
    const signVertices:number[]=[],signUV:number[]=[];
    for(const bucket of batches.values()){
      if(bucket.mat===this.signMaterial){for(const mesh of bucket.items){const geo=mesh.geometry.toNonIndexed(),pos=geo.attributes.position,uv=geo.attributes.uv,matrix=inverse.clone().multiply(mesh.matrixWorld);for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix);signVertices.push(v.x,v.y,v.z);signUV.push(uv.getX(i),uv.getY(i));}geo.dispose();}continue;}
      const batch=new THREE.InstancedMesh(bucket.geo,bucket.mat,bucket.items.length);
      bucket.items.forEach((m,i)=>{batch.setMatrixAt(i,inverse.clone().multiply(m.matrixWorld));batch.setColorAt(i,new THREE.Color(m.userData.color??"white"));});batch.computeBoundingSphere();result.push(batch);
    }
    if(signVertices.length){const g=this.geo(new THREE.BufferGeometry());g.setAttribute("position",new THREE.Float32BufferAttribute(signVertices,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(signUV,2));result.push(new THREE.Mesh(g,this.signMaterial));}
    // Animated groups retain their authored transform; their contents are independently batched.
    for(const g of keep){const local=inverse.clone().multiply(g.matrixWorld);local.decompose(g.position,g.quaternion,g.scale);}
    root.clear();root.add(...result,...keep);
  }
  stats(particles=0):WorldStats {
    let drawCalls=0,triangles=0;this.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.visible){drawCalls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o instanceof THREE.InstancedMesh?o.count:1);}else if(o instanceof THREE.Points||o instanceof THREE.LineSegments)drawCalls++;});
    return {drawCalls,triangles:Math.ceil(triangles),materials:this.materials.size,textures:this.textures.size,particles};
  }
  dispose(){this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.textures.forEach(t=>t.dispose());this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.motions.length=0;this.group.clear();}
}
