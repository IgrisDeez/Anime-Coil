import { LifeReactions } from './life-reactions';
import * as THREE from 'three';
import { CHARACTERS, HEAD_HIT_RADIUS, KI_CHARGE, KI_RADIUS, KI_RANGE, VEIL_RADIUS, serpentScale, type Arena, type GameEvent } from './simulation';

interface Burst { x: number; z: number; direction: number; color: string; age: number; impact: boolean }
interface Trail { x: number; z: number; color: string; age: number; elastic: boolean; scale: number }

/** Presentation-only pools. Map switching never owns or disposes these resources. */
export class SkillEffects {
  readonly life = new LifeReactions();
  seed(arena: Arena) { this.life.update(arena.snakes, 0, true); }
  readonly group = new THREE.Group();
  private bursts: Burst[] = [];
  private trails: Trail[] = [];
  private trailClock = 0;
  private disposed = false;
  private dummy = new THREE.Object3D();
  private colors = new Map<string, THREE.Color>();
  private cores = this.pool(new THREE.SphereGeometry(1,12,8), 96, 1);
  private sparks = this.pool(new THREE.OctahedronGeometry(1), 768, .75);
  private ribbons = this.pool(new THREE.TorusGeometry(1,.035,5,28,Math.PI*1.65), 160, .5);
  private aims = this.pool(new THREE.BoxGeometry(1,1,1), 32, .16);

  private pool(geometry: THREE.BufferGeometry, count: number, opacity: number) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({color:'white',transparent:opacity<1,opacity,depthWrite:opacity===1}), count);
    mesh.count=0; mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(mesh);
    return mesh;
  }
  clear() { this.life.reset(); this.bursts=[]; this.trails=[]; this.trailClock=0; for(const m of [this.cores,this.sparks,this.ribbons,this.aims]) m.count=0; }
  ingest(events: readonly GameEvent[]) {
    this.life.ingest(events);
    for(const e of events) {
      if(e.type==='nuke') { this.clear(); continue; }
      if(e.type!=='ability' && e.type!=='ki-impact' && e.type!=='ki-launch') continue;
      const color=CHARACTERS.find(c=>c.id===e.character)?.color ?? '#58caff';
      this.bursts.push({x:e.x,z:e.z,direction:e.direction??0,color,age:0,impact:e.type==='ki-impact'});
    }
    if(this.bursts.length>64) this.bursts.splice(0,this.bursts.length-64);
  }
  private put(mesh: THREE.InstancedMesh, x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string, ry=0, rx=0) {
    if(mesh.count>=mesh.instanceMatrix.count) return;
    this.dummy.position.set(x,y,z); this.dummy.scale.set(sx,sy,sz); this.dummy.rotation.set(rx,ry,0); this.dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count,this.dummy.matrix);
    if(!this.colors.has(color)) this.colors.set(color,new THREE.Color(color));
    mesh.setColorAt(mesh.count,this.colors.get(color)!); mesh.count++;
  }
  update(arena: Arena|undefined, time:number, dt:number, reduced:boolean) {
    this.group.visible=!!arena && !arena.cinematic;
    if(!arena || arena.cinematic) { this.clear(); if(arena) this.seed(arena); return; }
    this.life.update(arena.snakes, dt, reduced);
    for(const mesh of [this.cores,this.sparks,this.ribbons,this.aims]) mesh.count=0;
    for(const b of this.bursts) b.age+=dt;
    for(const t of this.trails) t.age+=dt;
    this.bursts=this.bursts.filter(b=>b.age<.45);
    this.trails=this.trails.filter(t=>t.age<.45);
    if(reduced) this.trails=[];
    this.trailClock+=dt;
    const emit=this.trailClock>=.065 && !reduced;
    if(emit) this.trailClock%=.065;
    for(const s of arena.snakes) {
      if(!s.alive) continue;
      const size=serpentScale(s.mass), c=CHARACTERS.find(c=>c.id===s.character)!;
      if(s.charge) {
        const d=s.charge.direction, r=HEAD_HIT_RADIUS*size+KI_RADIUS+.1;
        const x=s.x+Math.cos(d)*r,z=s.z+Math.sin(d)*r;
        const progress=1-s.charge.remaining/KI_CHARGE, scale=.18+progress*.42;
        this.put(this.cores,x,1,z,scale,scale,scale,'#bcefff');
        this.put(this.aims,x+Math.cos(d)*KI_RANGE/2,-.29,z+Math.sin(d)*KI_RANGE/2,KI_RANGE,.035,.16,'#58caff',-d);
        if(!reduced) for(let i=0;i<6;i++) {
          const a=time*8+i*Math.PI/3, orbit=(1-progress)*1.5+.3;
          this.put(this.sparks,x+Math.cos(a)*orbit,1+Math.sin(a*2)*.3,z+Math.sin(a)*orbit,.09,.09,.09,c.color);
        }
      }
      if(s.active>0 && !s.frozen) {
        if(emit && (s.character==='ember'||s.character==='cloud')) {
          this.trails.push({x:s.x,z:s.z,color:c.color,age:0,elastic:s.character==='cloud',scale:size});
        }
        if(s.character==='eclipse' && !reduced) {
          const radius=2+(time*.35%1)*(VEIL_RADIUS-2);
          this.put(this.ribbons,s.x,-.27,s.z,radius,radius,radius,c.color,time*.1,Math.PI/2);
        }
      }
      if(s.slowed) this.put(this.ribbons,s.x,.15,s.z,1.3*size,1.3*size,1.3*size,'#ad8bcf',reduced?0:time*.3,Math.PI/2);
    }
    if(this.trails.length>160) this.trails.splice(0,this.trails.length-160);
    for(const t of this.trails) {
      const life=1-t.age/.45;
      if(t.elastic) this.put(this.ribbons,t.x,.15,t.z,t.scale*(1+t.age),t.scale*(1+t.age),t.scale*.6,t.color,time,Math.PI/2);
      else this.put(this.sparks,t.x,.45+ t.age*.5,t.z,.45*t.scale*life,.65*t.scale*life,.45*t.scale*life,t.color);
    }
    for(const b of this.bursts) {
      const life=1-b.age/.45, count=reduced?3:10;
      for(let i=0;i<count;i++) {
        const a=b.direction+(i/count)*Math.PI*2;
        const distance=(reduced?.35:b.age*(b.impact?9:5));
        const size=(b.impact?.2:.12)*life;
        this.put(this.sparks,b.x+Math.cos(a)*distance+(b.impact?Math.cos(b.direction)*b.age*4:0),.6+(reduced?0:b.age*1.5),b.z+Math.sin(a)*distance+(b.impact?Math.sin(b.direction)*b.age*4:0),size,size,size,b.color);
      }
    }
    for (const r of this.life.slots) {
      if (!r.active) continue;
      const life = 1 - r.age / .45;
      if (r.kind === 'spawn') {
        const radius = 1 + r.age * 5;
        this.put(this.ribbons, r.x, -.26, r.z, radius, radius, radius, '#a7cbb3', 0, Math.PI / 2);
      } else {
        const count = r.kind === 'pickup' ? 3 : 6;
        for (let i = 0; i < count; i++) {
          const a = i * Math.PI * 2 / count, distance = .2 + r.age * (r.kind === 'pickup' ? 1.2 : 3);
          const size = (r.kind === 'pickup' ? .18 : .32) * life;
          this.put(this.sparks, r.x + Math.cos(a) * distance, .4 + r.age * 1.5, r.z + Math.sin(a) * distance, size, size, size, r.kind === 'pickup' ? '#f4dca3' : '#ddd3c2');
        }
      }
    }
    for(const p of arena.projectiles) {
      // The solid core is exactly the simulation hit radius; glow never claims a larger hitbox.
      this.put(this.cores,p.x,.75,p.z,p.radius,p.radius,p.radius,'#79d7ff');
      this.put(this.sparks,p.x,.8,p.z,p.radius*.65,p.radius*.65,p.radius*.65,'#f0ffff');
      if(!reduced) for(let i=1;i<=4;i++) {
        const fade=1-i/5;
        this.put(this.sparks,p.x-Math.cos(p.direction)*i*.42,.75,p.z-Math.sin(p.direction)*i*.42,.35*fade,.35*fade,.35*fade,'#58caff');
      }
    }
    for(const mesh of [this.cores,this.sparks,this.ribbons,this.aims]) { mesh.instanceMatrix.needsUpdate=true; if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true; }
  }
  dispose() { if(this.disposed) return; this.disposed=true; for(const mesh of [this.cores,this.sparks,this.ribbons,this.aims]) { mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } this.group.removeFromParent(); }
}
