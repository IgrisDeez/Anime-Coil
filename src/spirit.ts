import * as THREE from "three";
import { Arena, NUKE_BLAST, NUKE_DURATION, serpentScale } from "./simulation";

// Spirit Bomb owns an independent, pooled effect. No Gojo meshes or animation paths.
export class SpiritCinematic {
  private root = new THREE.Group();
  private orb = new THREE.Group();
  private arms = new THREE.Group();
  private shoulders: THREE.Group[] = [];
  private shell: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private cloud: THREE.InstancedMesh;
  private petals: THREE.InstancedMesh;
  private motes: THREE.InstancedMesh;
  private ribbons: THREE.Line[] = [];
  private rays: THREE.LineSegments;
  private shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private marker: THREE.Mesh;
  private wave: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private dummy = new THREE.Object3D();
  private reduced = matchMedia("(prefers-reduced-motion: reduce)");
  constructor(scene: THREE.Scene) {
    const sphere = new THREE.SphereGeometry(1, 24, 16);
    const basic = (color: string, opacity = 1) => new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false});
    this.shell = new THREE.Mesh(sphere, basic("#e4fcff", .94));
    this.shell.material.opacity = 1; this.shell.material.transparent = false; this.shell.material.depthWrite = true;
    this.orb.add(this.shell);
    // Organic patches on the sphere give it a flowing, cloud-like surface.
    for (let i = 0; i < 24; i++) {
      const a = i * 2.39996, y = 1 - 2 * (i + .5) / 24, r = Math.sqrt(1 - y*y);
      const patch = new THREE.Mesh(sphere, basic(i % 2 ? "#83d6f4" : "#b5edff", .6));
      patch.position.set(Math.cos(a)*r*1.008,y*1.008,Math.sin(a)*r*1.008);
      patch.scale.set(.25+(i%3)*.08,.14,.035);
      patch.lookAt(patch.position.clone().multiplyScalar(2));
      this.orb.add(patch);
    }
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(0, .5, side * .8);
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.3,.65,4,8), new THREE.MeshToonMaterial({color:"#f7a248"}));
      sleeve.position.y = .5;
      const hand = new THREE.Mesh(sphere, new THREE.MeshToonMaterial({color:"#ffdfbb"}));
      hand.position.y = 1.18; hand.scale.setScalar(.34);
      pivot.add(sleeve,hand); this.arms.add(pivot); this.shoulders.push(pivot);
    }
    this.cloud = new THREE.InstancedMesh(sphere,basic("#e7f8f6",.82),36);
    this.petals = new THREE.InstancedMesh(sphere,basic("#e7cfa4",.75),48);
    this.motes = new THREE.InstancedMesh(sphere,basic("#89def7"),100);
    for(const mesh of [this.cloud,this.petals,this.motes]) { mesh.frustumCulled=false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    for(let i=0;i<10;i++) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(32*3),3));
      const line = new THREE.Line(geo,new THREE.LineBasicMaterial({color:i%2?"#c6f6ff":"#69cbed",transparent:true,opacity:.8}));
      line.frustumCulled=false; this.ribbons.push(line); this.root.add(line);
    }
    const rayGeo = new THREE.BufferGeometry(); rayGeo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(32*6),3));
    this.rays = new THREE.LineSegments(rayGeo,new THREE.LineBasicMaterial({color:"#fff0b4",transparent:true,opacity:.9})); this.rays.frustumCulled=false;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1,48),basic("#586478",.17));
    this.shadow.rotation.x=-Math.PI/2;
    this.marker = new THREE.Mesh(new THREE.RingGeometry(2.8,3.1,48),basic("#69a9bd",.65)); this.marker.rotation.x=-Math.PI/2;
    this.wave = new THREE.Mesh(new THREE.RingGeometry(.91,1,96),basic("#ffe3a4",.75)); this.wave.rotation.x=-Math.PI/2;
    this.root.add(this.orb,this.arms,this.cloud,this.petals,this.motes,this.shadow,this.marker,this.wave,this.rays);
    this.root.visible=false; scene.add(this.root);
  }
  update(arena: Arena | undefined, camera: THREE.PerspectiveCamera, menu: boolean) {
    const shot = arena?.cinematic;
    this.root.visible = !menu && shot?.kind === "spirit";
    if (!this.root.visible || !shot || !arena) return;
    const p=arena.player, t=shot.time, impact=shot.impact;
    const charge=Math.min(1,t/2.4), flight=Math.max(0,Math.min(1,(t-2.4)/(NUKE_BLAST-2.4)));
    const blast=Math.max(0,t-NUKE_BLAST), detonated=shot.detonated;
    const fade=Math.max(0,1-blast/(NUKE_DURATION-NUKE_BLAST));
    const x=THREE.MathUtils.lerp(p.x,impact.x,flight*flight), z=THREE.MathUtils.lerp(p.z,impact.z,flight*flight);
    const y=26*(1-flight*flight)+2;
    this.orb.visible=!detonated; this.orb.position.set(x,y,z); this.orb.scale.setScalar(1+charge*11);
    this.orb.rotation.y=this.reduced.matches?0:t*.35;
    this.arms.visible=!detonated; this.arms.position.set(p.x,.65*serpentScale(p.mass),p.z);
    this.arms.scale.setScalar(serpentScale(p.mass)); this.arms.rotation.y=-p.angle;
    this.shoulders.forEach((arm,i)=>{arm.rotation.z= flight*-1.9; arm.rotation.x=(i?1:-1)*(.35-charge*.25);});
    this.shadow.visible=!detonated; this.shadow.position.set(x,-.36,z); this.shadow.scale.setScalar(3+charge*9+flight*5); this.shadow.material.opacity=.1+flight*.2;
    this.marker.visible=!detonated; this.marker.position.set(impact.x,-.34,impact.z);
    this.wave.visible=detonated; this.wave.position.set(impact.x,-.32,impact.z); this.wave.scale.setScalar(1+blast*150); this.wave.material.opacity=fade*.6;
    this.cloud.visible=this.petals.visible=this.rays.visible=detonated;
    for(let i=0;i<36;i++) {
      const a=i*2.39996, elevation=(i%6)/6*Math.PI/2, r=5+blast*24;
      this.dummy.position.set(impact.x+Math.cos(a)*r*Math.cos(elevation),Math.sin(elevation)*r*.65+2,impact.z+Math.sin(a)*r*Math.cos(elevation));
      this.dummy.scale.setScalar((3+(i%4))*Math.max(.05,fade)); this.dummy.updateMatrix(); this.cloud.setMatrixAt(i,this.dummy.matrix);
    }
    (this.cloud.material as THREE.MeshBasicMaterial).opacity=fade*.8;
    for(let i=0;i<48;i++) {
      const a=i*Math.PI*2/48, r=5+blast*(20+i%5*4);
      this.dummy.position.set(impact.x+Math.cos(a)*r,1+Math.sin(Math.min(1,blast/2)*Math.PI)*(2+i%5),impact.z+Math.sin(a)*r);
      this.dummy.scale.set(1.8*fade,.4*fade,3*fade);this.dummy.rotation.set(0,-a,blast);this.dummy.updateMatrix();this.petals.setMatrixAt(i,this.dummy.matrix);
    }
    for(let i=0;i<100;i++) {
      const a=i*2.39996, phase=(t*.65+i/100)%1, r=detonated?10+blast*18:(1-phase)*60;
      this.dummy.position.set((detonated?impact.x:x)+Math.cos(a)*r,detonated?2+blast*(8+i%6):y*phase,(detonated?impact.z:z)+Math.sin(a)*r);
      this.dummy.scale.setScalar((.15+(i%3)*.1)*(detonated?fade:1));this.dummy.rotation.set(0,0,0);this.dummy.updateMatrix();this.motes.setMatrixAt(i,this.dummy.matrix);
    }
    for(const mesh of [this.cloud,this.petals,this.motes]) mesh.instanceMatrix.needsUpdate=true;
    this.ribbons.forEach((line,i)=>{
      line.visible=t<2.4;
      const positions=line.geometry.attributes.position as THREE.BufferAttribute;
      for(let j=0;j<32;j++) {const q=j/31, a=i*Math.PI/5+q*.8+(this.reduced.matches?0:t*.25), r=(1-q)*65;positions.setXYZ(j,p.x+Math.cos(a)*r,1+q*27,p.z+Math.sin(a)*r);}
      positions.needsUpdate=true;
    });
    const rays=this.rays.geometry.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<32;i++){const a=i*Math.PI/16,r=12+blast*45;rays.setXYZ(i*2,impact.x,2,impact.z);rays.setXYZ(i*2+1,impact.x+Math.cos(a)*r,4+(i%4)*4,impact.z+Math.sin(a)*r);}rays.needsUpdate=true;
    (this.rays.material as THREE.LineBasicMaterial).opacity=fade*.7;
    if(!this.reduced.matches){
      const blend=Math.max(0,Math.min(1,t*3,(NUKE_DURATION-t)*2));
      const width=Math.max(1,.85/camera.aspect), distance=detonated?100+blast*12:66+charge*20;
      const target=new THREE.Vector3(x+Math.sin(p.angle+.7)*distance*.35,distance*width,z+Math.cos(p.angle+.7)*distance*.65);
      if(blast>0&&blast<.3)target.x+=Math.sin(blast*70)*(1-blast/.3);
      const baseRotation=camera.quaternion.clone();
      camera.position.lerp(target,blend);camera.lookAt(x,detonated?0:y*.5,z);
      camera.quaternion.copy(baseRotation.slerp(camera.quaternion.clone(),blend));
    }
  }
}
