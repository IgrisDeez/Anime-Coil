import { LifeReactions } from './life-reactions';
import * as THREE from 'three';
import { CHARACTERS, HEAD_HIT_RADIUS, KI_CHARGE, KI_RADIUS, KI_RANGE, VEIL_RADIUS, bodyRadiusAt, serpentScale, type Arena, type GameEvent } from './simulation';
import { BoostMotion } from './presentation';
import type { MapId } from './maps';
import type { TrailId } from './progression';

const BOOST_MAP_COLOR: Record<MapId,string> = { shibuya:'#e1b5fb', leaf:'#d6aa6c', tournament:'#dcc9a4', harbor:'#b9edf2' };
interface Burst { x: number; z: number; direction: number; color: string; age: number; impact: boolean; fox: boolean }
interface Trail { x: number; z: number; color: string; age: number; elastic: boolean; scale: number }
interface BoostMark { x: number; z: number; angle: number; radius: number; scale: number; age: number; style: TrailId; color: string }
export const BOOST_MARK_LIFETIME = .65;
export const BOOST_MARK_LIMIT = 22;
const TRAIL_COLORS: Record<Exclude<TrailId,'original'>,readonly [string,string]> = {
  petals: ['#ee9ca9','#f9d7b5'], starlight: ['#9bd8ef','#e6f9ff'],
};

/** Presentation-only pools. Map switching never owns or disposes these resources. */
export class SkillEffects {
  readonly life = new LifeReactions();
  private idleBoost = new BoostMotion();
  seed(arena: Arena) { this.life.update(arena.snakes, 0, true); }
  readonly group = new THREE.Group();
  private bursts: Burst[] = [];
  private trails: Trail[] = [];
  private trailClock = 0;
  private boostMarks: BoostMark[] = [];
  private boostMarkClock = 0;
  private boostTrail: TrailId = 'original';
  setBoostTrail(style: TrailId) {
    if (this.boostTrail === style) return;
    this.boostTrail = style;
    this.boostMarks.length = 0;
    this.boostMarkClock = 0;
  }
  private disposed = false;
  private dummy = new THREE.Object3D();
  private colors = new Map<string, THREE.Color>();
  private cores = this.pool(new THREE.SphereGeometry(1,12,8), 96, 1);
  private sparks = this.pool(new THREE.OctahedronGeometry(1), 768, .75);
  private ribbons = this.pool(new THREE.TorusGeometry(1,.035,5,28,Math.PI*1.65), 160, .5);
  private aims = this.pool(new THREE.BoxGeometry(1,1,1), 96, .56);

  private pool(geometry: THREE.BufferGeometry, count: number, opacity: number) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({color:'white',transparent:opacity<1,opacity,depthWrite:opacity===1}), count);
    mesh.count=0; mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(mesh);
    return mesh;
  }
  clear() { this.life.reset(); this.bursts=[]; this.trails=[]; this.trailClock=0; this.boostMarks.length=0; this.boostMarkClock=0; for(const m of [this.cores,this.sparks,this.ribbons,this.aims]) m.count=0; }
  ingest(events: readonly GameEvent[], boosted = false, direction = 0) {
    this.life.ingest(events, boosted, direction);
    for(const e of events) {
      if(e.type==='nuke') { this.clear(); continue; }
      if(e.type!=='ability' && e.type!=='ki-impact' && e.type!=='ki-launch') continue;
      const color=CHARACTERS.find(c=>c.id===e.character)?.color ?? '#58caff';
      this.bursts.push({x:e.x,z:e.z,direction:e.direction??0,color,age:0,impact:e.type==='ki-impact',fox:e.type==='ability'&&e.character==='ember'});
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
  update(arena: Arena|undefined, time:number, dt:number, reduced:boolean, boost: BoostMotion = this.idleBoost, mapId: MapId = 'shibuya') {
    this.group.visible=!!arena && !arena.cinematic;
    if(!arena || arena.cinematic) { this.clear(); if(arena) this.seed(arena); return; }
    this.life.update(arena.snakes, dt, reduced);
    for(const mesh of [this.cores,this.sparks,this.ribbons,this.aims]) mesh.count=0;
    for(const b of this.bursts) b.age+=dt;
    for(const t of this.trails) t.age+=dt;
    for(const mark of this.boostMarks) mark.age+=dt;
    for(let i=this.bursts.length-1;i>=0;i--) if(this.bursts[i].age>=.45) this.bursts.splice(i,1);
    for(let i=this.trails.length-1;i>=0;i--) if(this.trails[i].age>=.45) this.trails.splice(i,1);
    for(let i=this.boostMarks.length-1;i>=0;i--) if(this.boostMarks[i].age>=BOOST_MARK_LIFETIME) this.boostMarks.splice(i,1);
    if(reduced) this.trails.length=0;
    if(reduced) this.boostMarks.length=0;
    this.trailClock+=dt;
    const trailInterval=boost.enhanced?.045:.065;
    const emit=this.trailClock>=trailInterval && !reduced;
    if(emit) this.trailClock%=trailInterval;
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
          this.trails.push({x:s.x,z:s.z,color:s.id===0 && this.boostTrail!=='original' ? TRAIL_COLORS[this.boostTrail][0] : c.color,age:0,elastic:s.character==='cloud',scale:size});
        }
        if(s.character==='eclipse' && !reduced) {
          const radius=2+(time*.35%1)*(VEIL_RADIUS-2);
          this.put(this.ribbons,s.x,-.27,s.z,radius,radius,radius,c.color,time*.1,Math.PI/2);
        }
      }
      if(s.slowed) this.put(this.ribbons,s.x,.15,s.z,1.3*size,1.3*size,1.3*size,'#ad8bcf',reduced?0:time*.3,Math.PI/2);
    }
    const player = arena.player;
    if(player.alive && boost.intensity>.01 && !arena.cinematic) {
      const direction = player.angle;
      const forwardX = Math.cos(direction), forwardZ = Math.sin(direction);
      const motes=reduced?1:Math.round((boost.enhanced?8:4)*boost.intensity);
      for(let i=0;i<motes;i++) {
        const phase=(time*(mapId==='leaf'?.55:1.3)+i/Math.max(1,motes))%1;
        const spread=(i%2?1:-1)*(.35+(i%3)*.34);
        const x=player.x-forwardX*(1+phase*5)-Math.sin(direction)*spread;
        const z=player.z-forwardZ*(1+phase*5)+Math.cos(direction)*spread;
        const size=(mapId==='leaf'?.15:.1)*boost.intensity*(1-phase*.65);
        this.put(this.sparks,x,.25+phase*(mapId==='harbor'?.55:.25),z,size,size,size,BOOST_MAP_COLOR[mapId]);
      }
    }
    // Capture actual path positions so the effect follows a turn instead of a straight head-relative line.
    if(player.alive && player.boosting && dt>0 && !reduced) {
      this.boostMarkClock += dt;
      const interval=boost.enhanced?.045:.065;
      if(this.boostMarkClock>=interval) {
        this.boostMarkClock%=interval;
        const body=player.body, point=body[Math.min(2,body.length-1)] ?? player;
        const ahead=body[1] ?? player, behind=body[3] ?? point;
        const angle=Math.atan2(ahead.z-behind.z,ahead.x-behind.x);
        this.boostMarks.push({x:point.x,z:point.z,angle,radius:bodyRadiusAt(Math.min(2,body.length-1),body.length,player.mass)+.8,scale:serpentScale(player.mass)*(boost.enhanced?1.2:1),age:0,style:this.boostTrail,color:boost.enhanced?'#ffad64':CHARACTERS.find(c=>c.id===player.character)!.color});
        if(this.boostMarks.length>BOOST_MARK_LIMIT) this.boostMarks.shift();
      }
    } else if(!player.boosting) this.boostMarkClock=0;
    for(const mark of this.boostMarks) {
      const life=1-mark.age/BOOST_MARK_LIFETIME;
      const sideX=-Math.sin(mark.angle),sideZ=Math.cos(mark.angle);
      const colors=mark.style==='original' ? [mark.color,'#fff0c9'] as const : TRAIL_COLORS[mark.style];
      for(const side of [-1,1]) {
        const drift=mark.style==='petals' ? mark.age*2.1 : 0;
        const x=mark.x+sideX*side*(mark.radius+drift),z=mark.z+sideZ*side*(mark.radius+drift);
        if(mark.style==='original')
          this.put(this.aims,x,.18,z,Math.max(.02,1.8*mark.scale*life),.12*life,.23*life,side===1?colors[0]:colors[1],-mark.angle);
        else if(mark.style==='petals')
          this.put(this.sparks,x,.4+mark.age,z,.42*mark.scale*life,.08*life,.62*mark.scale*life,side===1?colors[0]:colors[1],-mark.angle+mark.age*3);
        else {
          this.put(this.sparks,x,.4+mark.age*.35,z,.42*mark.scale*life,.42*mark.scale*life,.42*mark.scale*life,side===1?colors[0]:colors[1]);
          if(side===1) this.put(this.ribbons,x,.16,z,.6*mark.scale*life,.6*mark.scale*life,.6*mark.scale*life,colors[0],0,Math.PI/2);
        }
      }
    }
    if(this.trails.length>160) this.trails.splice(0,this.trails.length-160);
    for(const t of this.trails) {
      const life=1-t.age/.45;
      if(t.elastic) this.put(this.ribbons,t.x,.15,t.z,t.scale*(1+t.age),t.scale*(1+t.age),t.scale*.6,t.color,time,Math.PI/2);
      else this.put(this.sparks,t.x,.45+ t.age*.5,t.z,.45*t.scale*life,.65*t.scale*life,.45*t.scale*life,t.color);
    }
    for(const b of this.bursts) {
      const life=1-b.age/.45, count=reduced?3:b.fox?14:10;
      for(let i=0;i<count;i++) {
        const a=b.direction+(i/count)*Math.PI*2;
        const distance=(reduced?.35:b.age*(b.impact?9:5));
        const size=(b.impact?.2:b.fox?.18:.12)*life;
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
        const count = r.kind === 'pickup' ? (r.boosted?5:3) : 6;
        for (let i = 0; i < count; i++) {
          const a = i * Math.PI * 2 / count, distance = .2 + r.age * (r.kind === 'pickup' ? 1.2 : 3);
          const size = (r.kind === 'pickup' ? (r.boosted?.24:.18) : .32) * life;
          const streak=r.boosted&&r.kind==='pickup'?r.age*3+i*.13:0;
          this.put(this.sparks, r.x + Math.cos(a) * distance-Math.cos(r.direction)*streak, .4 + r.age * 1.5, r.z + Math.sin(a) * distance-Math.sin(r.direction)*streak, size, size, size, r.kind === 'pickup' ? '#f4dca3' : '#ddd3c2');
        }
        if(r.kind==='pickup'&&r.boosted&&!reduced) this.put(this.cores,r.x,.45,r.z,.28*life,.28*life,.28*life,'#fff7d6');
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
