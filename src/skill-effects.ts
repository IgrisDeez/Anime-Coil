import { LifeReactions } from './life-reactions';
import * as THREE from 'three';
import { CHARACTERS, HEAD_HIT_RADIUS, KI_CHARGE, KI_RADIUS, KI_RANGE, VEIL_RADIUS, angleDelta, bodyRadiusAt, serpentScale, type Arena, type GameEvent, type CharacterId } from './simulation';
import { BoostMotion } from './presentation';
import type { MapId } from './maps';
import type { TrailId } from './progression';
import type { RenderAnchor } from './vfx-anchors';
import type { DetailProfile } from './worlds/types';
import { impactStarGeometry, taperedSlashGeometry } from './vfx-geometry';

const BOOST_MAP_COLOR: Record<MapId,string> = { shibuya:'#e1b5fb', leaf:'#d6aa6c', tournament:'#dcc9a4', harbor:'#b9edf2' };
type BurstKind = 'activation' | 'launch' | 'impact';
interface Burst { id: number; x: number; z: number; direction: number; color: string; age: number; kind: BurstKind; character: CharacterId }
interface Trail { id: number; x: number; z: number; angle: number; color: string; age: number; elastic: boolean; scale: number }
interface BoostMark { x: number; z: number; angle: number; radius: number; scale: number; age: number; style: TrailId; color: string }
export const BOOST_MARK_LIFETIME = .65;
export const BOOST_MARK_LIMIT = 22;
export const SKILL_BURST_LIMIT = 32;
export const SKILL_TRAIL_LIMIT = 72;
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
  private profile: DetailProfile = 'desktop';
  setProfile(profile: DetailProfile) { this.profile = profile; }
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
  private ribbons = this.pool(new THREE.TorusGeometry(1,.03,5,40), 160, .62);
  private aims = this.pool(new THREE.BoxGeometry(1,1,1), 96, .56);
  private slashes = this.pool(taperedSlashGeometry(), 192, .78);
  private stars = this.pool(impactStarGeometry(), 48, .72);
  private meshes = [this.cores,this.sparks,this.ribbons,this.aims,this.slashes,this.stars];

  private pool(geometry: THREE.BufferGeometry, count: number, opacity: number) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({color:'white',transparent:opacity<1,opacity,depthWrite:opacity===1}), count);
    mesh.count=0; mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(mesh);
    return mesh;
  }
  clear() { this.life.reset(); this.bursts=[]; this.trails=[]; this.trailClock=0; this.boostMarks.length=0; this.boostMarkClock=0; for(const m of this.meshes) m.count=0; }
  ingest(events: readonly GameEvent[], boosted = false, direction = 0) {
    this.life.ingest(events, boosted, direction);
    for(const e of events) {
      if(e.type==='nuke') { this.clear(); continue; }
      if(e.type!=='ability' && e.type!=='ki-impact' && e.type!=='ki-launch') continue;
      const color=CHARACTERS.find(c=>c.id===e.character)?.color ?? '#58caff';
      this.bursts.push({id:e.id,x:e.x,z:e.z,direction:e.direction??0,color,age:0,
        kind:e.type==='ability'?'activation':e.type==='ki-launch'?'launch':'impact',character:e.character??'nova'});
    }
    if(this.bursts.length>SKILL_BURST_LIMIT) this.bursts.splice(0,this.bursts.length-SKILL_BURST_LIMIT);
  }
  private put(mesh: THREE.InstancedMesh, x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string, ry=0, rx=0) {
    if(mesh.count>=mesh.instanceMatrix.count) return;
    this.dummy.position.set(x,y,z); this.dummy.scale.set(sx,sy,sz); this.dummy.rotation.set(rx,ry,0); this.dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count,this.dummy.matrix);
    if(!this.colors.has(color)) this.colors.set(color,new THREE.Color(color));
    mesh.setColorAt(mesh.count,this.colors.get(color)!); mesh.count++;
  }
  update(arena: Arena|undefined, time:number, dt:number, reduced:boolean, boost: BoostMotion = this.idleBoost, mapId: MapId = 'shibuya', anchors?: ReadonlyMap<number, RenderAnchor>) {
    this.group.visible=!!arena && !arena.cinematic;
    if(!arena || arena.cinematic) { this.clear(); if(arena) this.seed(arena); return; }
    this.life.update(arena.snakes, dt, reduced);
    for(const mesh of this.meshes) mesh.count=0;
    for(const b of this.bursts) b.age+=dt;
    for(const t of this.trails) t.age+=dt;
    for(const mark of this.boostMarks) mark.age+=dt;
    for(let i=this.bursts.length-1;i>=0;i--) if(this.bursts[i].age>=.45 ||
      (this.bursts[i].kind!=='impact' && !arena.snakes.some(s=>s.id===this.bursts[i].id&&s.alive))) this.bursts.splice(i,1);
    for(let i=this.trails.length-1;i>=0;i--) if(this.trails[i].age>=.45 ||
      !arena.snakes.some(s=>s.id===this.trails[i].id&&s.alive)) this.trails.splice(i,1);
    for(let i=this.boostMarks.length-1;i>=0;i--) if(this.boostMarks[i].age>=BOOST_MARK_LIFETIME) this.boostMarks.splice(i,1);
    if(reduced) this.trails.length=0;
    if(reduced) this.boostMarks.length=0;
    this.trailClock+=dt;
    const trailInterval=this.profile==='mobile'?.11:.07;
    const emit=this.trailClock>=trailInterval && !reduced;
    if(emit) this.trailClock%=trailInterval;
    for(const s of arena.snakes) {
      if(!s.alive) continue;
      const size=serpentScale(s.mass), c=CHARACTERS.find(c=>c.id===s.character)!;
      const anchor=anchors?.get(s.id), hx=anchor?.x??s.x, hz=anchor?.z??s.z, hy=anchor?.y??1;
      if(s.charge) {
        const d=s.charge.direction, r=HEAD_HIT_RADIUS*size+KI_RADIUS+.1;
        const x=hx+Math.cos(d)*r,z=hz+Math.sin(d)*r;
        const progress=1-s.charge.remaining/KI_CHARGE, scale=.26+progress*.55;
        this.put(this.cores,x,hy,z,scale,scale,scale,'#71d8ff');
        this.put(this.cores,x,hy+.015,z,scale*.48,scale*.48,scale*.48,'#f2ffff');
        // A narrow locked line shows direction, not a wider damage corridor.
        this.put(this.aims,x+Math.cos(d)*KI_RANGE/2,-.29,z+Math.sin(d)*KI_RANGE/2,KI_RANGE,.025,.045,'#67c9f4',-d);
        if(!reduced) {
          this.put(this.ribbons,x,hy,z,1.35-progress*.65,1.35-progress*.65,1.35-progress*.65,'#a4edff',0,Math.PI/2);
          const strokes=this.profile==='mobile'?3:6;
          for(let i=0;i<strokes;i++) {
            const a=i*Math.PI*2/strokes+time*2, orbit=(1-progress)*1.75+.4;
            this.put(this.slashes,x+Math.cos(a)*orbit,hy+Math.sin(a*2)*.18,z+Math.sin(a)*orbit,.9*(1-progress*.4),1,.28,'#b8f5ff',-a);
          }
        }
      }
      if(s.active>0 && !s.frozen) {
        if(emit && (s.character==='ember'||s.character==='cloud') &&
          (s.character==='ember'||Math.abs(angleDelta(s.previousAngle,s.angle))>.008)) {
          const body=s.body, point=body[Math.min(2,body.length-1)]??s;
          const ahead=body[1]??s, behind=body[3]??point;
          const angle=Math.atan2(ahead.z-behind.z,ahead.x-behind.x);
          this.trails.push({id:s.id,x:point.x,z:point.z,angle,color:c.color,age:0,elastic:s.character==='cloud',scale:size});
        }
        if(s.character==='ember') {
          const clearance=(anchor?.clearance??size*1.3)+size*.22;
          const closing=Math.min(1,s.active/.25);
          for(const side of [-1,1]) {
            const a=s.angle+side*1.62;
            this.put(this.slashes,hx+Math.cos(a)*clearance,hy-.12,hz+Math.sin(a)*clearance,
              1.5*size*closing,1,.65*size*closing,side<0?'#fff0c5':'#ffa352',-s.angle+side*.24);
          }
        }
        if(s.character==='eclipse') {
          // The complete ring is the authoritative 12-unit field; all other layers stay inside it.
          this.put(this.ribbons,hx,-.17,hz,VEIL_RADIUS,VEIL_RADIUS,VEIL_RADIUS,'#e4c8ff',0,Math.PI/2);
          if(!reduced) {
            const waves=this.profile==='mobile'?1:2;
            for(let wave=0;wave<waves;wave++) {
              const radius=2+((time*.35+wave*.5)%1)*(VEIL_RADIUS-2.5);
              this.put(this.ribbons,hx,-.23,hz,radius,radius,radius,wave?'#d4bcff':'#b18de9',0,Math.PI/2);
            }
            const accents=this.profile==='mobile'?4:8;
            for(let arc=0;arc<accents;arc++) {
              const a=arc*Math.PI*2/accents+time*.16;
              this.put(this.slashes,hx+Math.cos(a)*VEIL_RADIUS,-.15,hz+Math.sin(a)*VEIL_RADIUS,.85,1,.34,'#f4dcff',-a-Math.PI/2);
            }
          }
        }
        if(s.character==='cloud') {
          const turn=Math.max(-.45,Math.min(.45,angleDelta(s.previousAngle,s.angle)*5));
          const closing=.7+.3*Math.min(1,s.active/.25);
          const clearance=(anchor?.clearance??1.4*size)+size*.6;
          const springSize=Math.min(1.4,(.6+Math.abs(turn)*.25)*size)*closing;
          for(let side of [-1,1]) {
            const a=s.angle+side*(1.2+turn*.3);
            this.put(this.ribbons,hx+Math.cos(a)*clearance,hy-.1,
              hz+Math.sin(a)*clearance,springSize,
              springSize,springSize,side<0?'#fff0d5':'#ffab9e',-a,Math.PI/2);
          }
          if(!reduced && this.profile==='desktop') this.put(this.ribbons,
            hx-Math.cos(s.angle)*clearance,hy-.2,
            hz-Math.sin(s.angle)*clearance,springSize*.7,springSize*.7,springSize*.7,'#ffc5ae',0,Math.PI/2);
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
    if(this.trails.length>SKILL_TRAIL_LIMIT) this.trails.splice(0,this.trails.length-SKILL_TRAIL_LIMIT);
    for(const t of this.trails) {
      const life=1-t.age/.45;
      if(t.elastic) {
        this.put(this.ribbons,t.x,.18,t.z,t.scale*(.8+t.age)*life,t.scale*(.8+t.age)*life,t.scale*(.8+t.age)*life,
          '#ffc2a8',0,Math.PI/2);
      } else {
        const nx=-Math.sin(t.angle),nz=Math.cos(t.angle);
        for(const side of [-1,1]) this.put(this.slashes,t.x+nx*side*.68*t.scale,.38,t.z+nz*side*.68*t.scale,
          2.15*t.scale*life,1,.75*t.scale*life,side<0?'#fff0c5':'#ff9b4f',-t.angle+side*.12);
        if(this.profile==='desktop') this.put(this.sparks,t.x,.5+t.age,t.z,.18*t.scale*life,.25*t.scale*life,.18*t.scale*life,'#ffd883');
      }
    }
    for(const b of this.bursts) {
      const life=1-b.age/.45, anchor=anchors?.get(b.id);
      const bx=b.character==='eclipse'&&anchor?.x!==undefined?anchor.x:b.x;
      const bz=b.character==='eclipse'&&anchor?.z!==undefined?anchor.z:b.z;
      if(b.kind==='impact') {
        this.put(this.stars,bx,.68,bz,2.2*life,.14,2.2*life,'#f2ffff',-b.direction);
        if(!reduced) for(let i=0;i<(this.profile==='mobile'?5:8);i++) {
          const a=b.direction+(i/(this.profile==='mobile'?5:8)-.5)*Math.PI*1.3;
          this.put(this.slashes,bx+Math.cos(a)*b.age*5,.69,bz+Math.sin(a)*b.age*5,
            2.1*life,1,.38*life,i%2?'#4bb9f4':'#c5f7ff',-a);
        }
      } else if(b.kind==='launch') {
        this.put(this.stars,bx,.75,bz,1.25*life,.12,1.25*life,'#dffbff',-b.direction);
        if(!reduced) for(const side of [-1,1]) {
          const a=b.direction+side*.4;
          this.put(this.slashes,bx+Math.cos(a)*b.age*2,.72,bz+Math.sin(a)*b.age*2,1.45*life,1,.34*life,'#85dcff',-a);
        }
      } else if(b.character==='ember') {
        // A pointed fox silhouette at the confirmed activation, then a short flame fan.
        this.put(this.stars,bx,.52,bz,1.05*life,.12,1.05*life,'#ffb85f',-b.direction);
        for(const side of [-1,1]) this.put(this.slashes,bx-Math.sin(b.direction)*side*.78,.85,
          bz+Math.cos(b.direction)*side*.78,1.4*life,1,.48*life,'#ffe4a2',-b.direction+side*.55);
        this.put(this.slashes,bx+Math.cos(b.direction)*1.1,.78,bz+Math.sin(b.direction)*1.1,
          2.1*life,1,.46*life,'#fff3c5',-b.direction);
        if(!reduced) for(let i=0;i<(this.profile==='mobile'?4:7);i++) {
          const a=b.direction+(i-3)*.24;
          this.put(this.slashes,bx+Math.cos(a)*(.8+b.age*3),.46,bz+Math.sin(a)*(.8+b.age*3),
            1.7*life,1,.34*life,i%2?'#ff9653':'#ffd279',-a);
        }
      } else if(b.character==='cloud') {
        this.put(this.stars,bx,.5,bz,1.1*life,.12,1.1*life,'#fff0d8',-b.direction);
        if(!reduced) for(let i=0;i<(this.profile==='mobile'?2:4);i++) {
          const a=b.direction+Math.PI*(i%2?-.5:.5);
          this.put(this.ribbons,bx+Math.cos(a)*(1+b.age*3),.65+i*.08,bz+Math.sin(a)*(1+b.age*3),
            (.5+i*.12)*life,(.5+i*.12)*life,(.5+i*.12)*life,i%2?'#ffc0b4':'#fff2d7',0,Math.PI/2);
        }
      } else if(b.character==='eclipse') {
        this.put(this.ribbons,bx,-.19,bz,Math.min(VEIL_RADIUS,2+b.age*28),
          Math.min(VEIL_RADIUS,2+b.age*28),Math.min(VEIL_RADIUS,2+b.age*28),'#f0d7ff',0,Math.PI/2);
      } else {
        this.put(this.stars,bx,.7,bz,.9*life,.12,.9*life,'#d8f8ff',-b.direction);
      }
      if(!reduced) for(let i=0;i<(this.profile==='mobile'?4:8);i++) {
        const a=b.direction+i*Math.PI*2/(this.profile==='mobile'?4:8);
        const distance=b.age*(b.kind==='impact'?7:4);
        const size=(b.kind==='impact'?.2:.13)*life;
        this.put(this.sparks,bx+Math.cos(a)*distance,.55+b.age,bz+Math.sin(a)*distance,size,size,size,b.color);
      }
    }
    for (const r of this.life.slots) {
      if (!r.active) continue;
      const life = 1 - r.age / .45;
      if (r.kind === 'spawn') {
        const radius = reduced ? 1.35 : 1 + r.age * 5;
        this.put(this.ribbons, r.x, -.26, r.z, radius, radius, radius, '#a7cbb3', 0, Math.PI / 2);
      } else if (r.kind === 'death') {
        const radius = reduced ? 1.05 : .6 + r.age * 2.8;
        this.put(this.ribbons, r.x, -.26, r.z, radius, radius, radius, '#e7a17c', 0, Math.PI / 2);
        if (reduced) continue;
        const count = 6;
        for (let i = 0; i < count; i++) {
          const a = i * Math.PI * 2 / count, distance = .2 + r.age * 3;
          const size = .32 * life;
          this.put(this.sparks, r.x + Math.cos(a) * distance, .4 + r.age * 1.5, r.z + Math.sin(a) * distance, size, size, size, '#ddd3c2');
        }
      } else if (!reduced) {
        const count = r.boosted?5:3;
        for (let i = 0; i < count; i++) {
          const a = i * Math.PI * 2 / count, distance = .2 + r.age * 1.2;
          const size = (r.boosted?.24:.18) * life;
          const streak=r.boosted?r.age*3+i*.13:0;
          this.put(this.sparks, r.x + Math.cos(a) * distance-Math.cos(r.direction)*streak, .4 + r.age * 1.5, r.z + Math.sin(a) * distance-Math.sin(r.direction)*streak, size, size, size, '#f4dca3');
        }
        if(r.boosted) this.put(this.cores,r.x,.45,r.z,.28*life,.28*life,.28*life,'#fff7d6');
      }
    }
    for(const p of arena.projectiles) {
      // The solid core is exactly the simulation hit radius; glow never claims a larger hitbox.
      this.put(this.cores,p.x,.75,p.z,p.radius,p.radius,p.radius,'#79d7ff');
      this.put(this.sparks,p.x,.8,p.z,p.radius*.56,p.radius*.56,p.radius*.56,'#f0ffff');
      this.put(this.slashes,p.x+Math.cos(p.direction)*.22,.76,p.z+Math.sin(p.direction)*.22,
        2.3,1,.72,'#c4f4ff',-p.direction);
      if(!reduced) for(let i=1;i<=(this.profile==='mobile'?2:4);i++) {
        const fade=1-i/5;
        this.put(this.slashes,p.x-Math.cos(p.direction)*i*.5,.75,p.z-Math.sin(p.direction)*i*.5,
          1.2*fade,1,.32*fade,i%2?'#5dc7f8':'#e7fcff',-p.direction);
      }
    }
    for(const mesh of this.meshes) { mesh.instanceMatrix.needsUpdate=true; if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true; }
  }
  dispose() { if(this.disposed) return; this.disposed=true; for(const mesh of this.meshes) { mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } this.group.removeFromParent(); }
}
