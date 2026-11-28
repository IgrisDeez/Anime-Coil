import { LifeReactions } from './life-reactions';
import { dirtyRange } from './instance-updates';
import * as THREE from 'three';
import { CHARACTERS, HEAD_HIT_RADIUS, KI_CHARGE, KI_RADIUS, KI_RANGE, VEIL_RADIUS, angleDelta, bodyRadiusAt, serpentScale, type Arena, type GameEvent, type CharacterId } from './simulation';
import { BoostMotion } from './presentation';
import type { MapId } from './maps';
import type { TrailId } from './progression';
import type { RenderAnchor } from './vfx-anchors';
import type { DetailProfile } from './worlds/types';
import { impactStarGeometry, taperedSlashGeometry } from './vfx-geometry';

const BOOST_MAP_COLOR: Record<MapId,string> = { shibuya:'#e1b5fb' };
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
  private ribbons = this.pool(new THREE.RingGeometry(.943, 1, 48).rotateX(Math.PI), 160, .76);
  private aims = this.pool(new THREE.BoxGeometry(1,1,1), 96, .56);
  private slashes = this.pool(taperedSlashGeometry(), 192, .78);
  private stars = this.pool(impactStarGeometry(), 48, .72);
  private meshes: THREE.InstancedMesh[] = [this.cores,this.sparks,this.ribbons,this.aims,this.slashes,this.stars];
  private colorRanges=new Int32Array(12).fill(-1);

  private pool(geometry: THREE.BufferGeometry, count: number, opacity: number) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({color:'white',transparent:opacity<1,opacity,depthWrite:opacity===1}), count);
    mesh.count=0; mesh.visible=false; mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(mesh);
    return mesh;
  }
  clear() { this.life.reset(); this.bursts=[]; this.trails=[]; this.trailClock=0; this.boostMarks.length=0; this.boostMarkClock=0; for(const m of this.meshes) {m.count=0;m.visible=false;} }
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
    this.dummy.position.set(x,y,z); this.dummy.scale.set(sx,sy,sz); this.dummy.rotation.set(rx,ry,0,'YXZ'); this.dummy.updateMatrix();
    mesh.setMatrixAt(mesh.count,this.dummy.matrix);
    if(!this.colors.has(color)) this.colors.set(color,new THREE.Color(color));
    const tint=this.colors.get(color)!,array=mesh.instanceColor?.array,o=mesh.count*3;
    if(!array||array[o]!==Math.fround(tint.r)||array[o+1]!==Math.fround(tint.g)||array[o+2]!==Math.fround(tint.b)){
      mesh.setColorAt(mesh.count,tint);const slot=this.meshes.indexOf(mesh)*2;
      if(this.colorRanges[slot]<0)this.colorRanges[slot]=mesh.count;this.colorRanges[slot+1]=mesh.count;
    }mesh.count++;
  }
  update(arena: Arena|undefined, time:number, dt:number, reduced:boolean, boost: BoostMotion = this.idleBoost, mapId: MapId = 'shibuya', anchors?: ReadonlyMap<number, RenderAnchor>) {
    this.group.visible=!!arena && !arena.cinematic;
    if(!arena || arena.cinematic) { this.clear(); if(arena) this.seed(arena); return; }
    this.life.update(arena.snakes, dt, reduced);
    this.colorRanges.fill(-1);
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
        const progress = THREE.MathUtils.clamp(1 - s.charge.remaining / KI_CHARGE, 0, 1);
        const scale = .29 + progress * .56;
        this.put(this.cores, x, hy, z, scale, scale, scale, '#88dfed');
        this.put(this.cores, x, hy + scale*.60, z, scale*.47, scale*.47, scale*.47, '#edfeff');
        // The aim stays on the committed line and ends at the actual range.
        this.put(this.aims, x+Math.cos(d)*KI_RANGE/2, -.25, z+Math.sin(d)*KI_RANGE/2,
          KI_RANGE, .025, .13, '#70c8fc', -d);
        if (!reduced) {
          const orbit = 2.1 - progress*1.28;
          this.put(this.ribbons, x, hy, z, orbit, orbit*.67, 1, '#50bafb', -d, 1.07);
          const strokes = this.profile === 'mobile' ? 3 : 5;
          for (let i = 0; i < strokes; i++) {
            const angle = i*Math.PI*2/strokes + time*5.3 + d;
            this.put(this.slashes, x+Math.cos(angle)*orbit, hy+.12, z+Math.sin(angle)*orbit,
              1.15 + progress*.48, 1, 1.45, i % 2 ? '#54bbff' : '#dcfaff', -angle - 1.52);
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
          const clearance = (anchor?.clearance ?? size*1.3) + size*.27;
          const closing = Math.min(1, s.active/.25);
          for (const side of [-1, 1]) {
            const angle = s.angle + side*1.77;
            const flameLength = size*closing*(side < 0 ? 3.05 : 2.6);
            this.put(this.slashes, hx+Math.cos(angle)*clearance, hy+.03, hz+Math.sin(angle)*clearance,
              flameLength, 1, 2.6*size*closing, side < 0 ? '#ffe7a5' : '#ff8b35', -s.angle+side*.33);
          }
        }
        if(s.character==='eclipse') {
          // The complete ring is the authoritative 12-unit field; all other layers stay inside it.
          this.put(this.ribbons, hx, -.17, hz, VEIL_RADIUS, VEIL_RADIUS, 1, '#ad8cff', 0, Math.PI/2);
          if (!reduced) {
            const waves = this.profile === 'mobile' ? 1 : 2;
            for (let wave = 0; wave < waves; wave++) {
              const phase = (time*.46 + wave*.48) % 1;
              const radius = VEIL_RADIUS*(.18 + .69*(1-phase));
              this.put(this.ribbons, hx, -.23, hz, radius, radius, 1,
                wave ? '#7456bf' : '#a683ed', 0, Math.PI/2);
            }
            const accents = this.profile === 'mobile' ? 4 : 8;
            for (let tick = 0; tick < accents; tick++) {
              const angle = tick*Math.PI*2/accents + time*.23;
              const radius = VEIL_RADIUS - .85;
              this.put(this.slashes, hx+Math.cos(angle)*radius, -.11, hz+Math.sin(angle)*radius,
                2.15, 1, 2.3, tick % 2 ? '#956df1' : '#f6dcff', -angle+Math.PI+.27);
            }
          }
        }
        if(s.character==='cloud') {
          const turn = THREE.MathUtils.clamp(angleDelta(s.previousAngle, s.angle)*6, -.55, .55);
          const closing = .64 + .36*Math.min(1, s.active/.25);
          const clearance = (anchor?.clearance ?? 1.4*size) + size*.86;
          const spring = Math.min(2.04, (1.16+Math.abs(turn)*.40)*size)*closing;
          for (const side of [-1, 1]) {
            const angle = s.angle + side*(1.65+turn*.48);
            const squash = 1-side*turn*.45;
            const loopX = hx + Math.cos(angle)*clearance;
            const loopZ = hz + Math.sin(angle)*clearance;
            this.put(this.ribbons, loopX, hy+.37, loopZ, spring*1.24*squash, spring*.91, 1,
              side < 0 ? '#fff8e8' : '#ffa0ba', -s.angle + side*.40, reduced ? Math.PI/2 : 1.34+side*.16);
            if (!reduced) {
              const tangent = s.angle + side*(.56 + turn*.73);
              this.put(this.slashes, loopX + Math.cos(tangent)*spring*.27, hy+.53,
                loopZ + Math.sin(tangent)*spring*.27, spring*1.46, 1, spring*1.91,
                side < 0 ? '#ffc9aa' : '#fff1d6', -tangent);
            }
          }
          if (!reduced && this.profile === 'desktop') {
            this.put(this.ribbons, hx-Math.cos(s.angle)*clearance, hy-.22, hz-Math.sin(s.angle)*clearance,
              spring*.72, spring*.55, 1, '#ffa9b2', -s.angle+.52, 1.20);
          }
        }
      }
      if(s.slowed) this.put(this.ribbons,s.x,.15,s.z,1.3*size,1.3*size,1.3*size,'#ad8bcf',reduced?0:time*.3,Math.PI/2);
    }
    const player = arena.player;
    if(player.alive && boost.intensity>.01 && !arena.cinematic) {
      const direction = player.angle;
      const forwardX = Math.cos(direction), forwardZ = Math.sin(direction);
      const maxMotes = this.profile === 'mobile' ? (boost.enhanced ? 5 : 3) : (boost.enhanced ? 8 : 4);
      const motes = reduced ? 1 : Math.round(maxMotes * boost.intensity);
      for(let i=0;i<motes;i++) {
        const phase = reduced ? .32 : (time * 1.3 + i / motes) % 1;
        const spread=(i%2?1:-1)*(.35+(i%3)*.34);
        const x=player.x-forwardX*(1+phase*5)-Math.sin(direction)*spread;
        const z=player.z-forwardZ*(1+phase*5)+Math.cos(direction)*spread;
        const size=.1*boost.intensity*(1-phase*.65);
        this.put(this.sparks,x,.25+phase*.25,z,size,size,size,BOOST_MAP_COLOR[mapId]);
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
    } else if (reduced || !player.alive || !player.boosting) this.boostMarkClock = 0;
    if(this.trails.length>SKILL_TRAIL_LIMIT) this.trails.splice(0,this.trails.length-SKILL_TRAIL_LIMIT);
    for(const t of this.trails) {
      const life=1-t.age/.45;
      if(t.elastic) {
        const puff = t.scale*(1.04+t.age*.9)*life;
        this.put(this.ribbons, t.x, .28+t.age, t.z, puff*1.37, puff*.69, 1,
          '#ffc6ba', -t.angle+t.age*1.9, 1.30);
      } else {
        const nx=-Math.sin(t.angle),nz=Math.cos(t.angle);
        const spread = t.scale*(.79+t.age*.65);
        for (const side of [-1,1]) this.put(this.slashes, t.x+nx*side*spread, .42+t.age*.17, t.z+nz*side*spread,
          (side < 0 ? 3.05 : 3.8)*t.scale*life, 1, 2.03*t.scale*life,
          side < 0 ? '#ffdd91' : '#ed663c', -t.angle+side*.24);
        if(this.profile==='desktop') this.put(this.sparks,t.x,.5+t.age,t.z,.18*t.scale*life,.25*t.scale*life,.18*t.scale*life,'#ffd883');
      }
    }
    for(const b of this.bursts) {
      const life=1-b.age/.45, anchor=anchors?.get(b.id);
      const bx=b.character==='eclipse'&&anchor?.x!==undefined?anchor.x:b.x;
      const bz=b.character==='eclipse'&&anchor?.z!==undefined?anchor.z:b.z;
      if (b.kind === 'impact') {
        const hit = 1-THREE.MathUtils.smoothstep(b.age, .055, .24);
        if (hit > 0) this.put(this.stars, bx, .82, bz, 3.1*hit, 1, 1.8*hit, '#edfeff', -b.direction);
        if (!reduced) {
          const radius = 1.0+b.age*6;
          this.put(this.ribbons, bx, .32, bz, radius*.67, radius, 1, '#5abffa', -b.direction, Math.PI/2);
          const count = this.profile === 'mobile' ? 4 : 6;
          for (let i = 0; i < count; i++) {
            const angle = b.direction+(i/(count-1)-.5)*Math.PI*1.18;
            const distance = .62+b.age*(6+i%2*4);
            this.put(this.slashes, bx+Math.cos(angle)*distance, .63+b.age, bz+Math.sin(angle)*distance,
              (2.05+i%2)*life, 1, 1.65*life, i%2 ? '#49afff' : '#d7fbff', -angle);
          }
        }
      } else if (b.kind === 'launch') {
        this.put(this.stars, bx, .80, bz, 2.1*life, 1, .68*life, '#f4ffff', -b.direction);
        if (!reduced) for (const side of [-1, 1]) {
          const angle = b.direction+side*.52;
          const distance = .65+b.age*3.7;
          this.put(this.slashes, bx+Math.cos(angle)*distance, .72, bz+Math.sin(angle)*distance,
            2.1*life, 1, 1.35*life, '#77d4fa', -angle);
        }
      } else if (b.character === 'ember') {
        const surge = 1-Math.pow(1-Math.min(1,b.age/.19), 2);
        this.put(this.stars, bx, .57, bz, 1.4*life, 1, .95*life, '#ffcf75', -b.direction);
        for (const side of [-1, 1]) {
          const edge = b.direction + side*1.72;
          const offset = .88+surge*.50;
          this.put(this.slashes, bx+Math.cos(edge)*offset, .86, bz+Math.sin(edge)*offset,
            2.55*life, 1, 2.5*life, side < 0 ? '#ffd78c' : '#ff7d40', -b.direction+side*.40);
        }
        this.put(this.slashes, bx+Math.cos(b.direction)*1.15, .79, bz+Math.sin(b.direction)*1.15,
          2.75*life, 1, 1.72*life, '#fff1b7', -b.direction);
        if (!reduced) {
          const count = this.profile === 'mobile' ? 3 : 6;
          for (let i = 0; i < count; i++) {
            const angle = b.direction+(i/(count-1)-.5)*1.9;
            const distance = .9+surge*(1.1+i%2*.75);
            this.put(this.slashes, bx+Math.cos(angle)*distance, .45+b.age*.63, bz+Math.sin(angle)*distance,
              (1.7+i%2*.50)*life, 1, 2.0*life, i%2 ? '#ea573c' : '#ffb95f', -angle+.18);
          }
        }
      } else if (b.character === 'cloud') {
        this.put(this.stars, bx, .52, bz, 1.2*life, 1, .88*life, '#fff2d9', -b.direction);
        if (!reduced) {
          const count = this.profile === 'mobile' ? 2 : 4;
          for (let i = 0; i < count; i++) {
            const angle = b.direction + (i%2 ? -1 : 1)*(1.13+i*.19);
            const distance = .7+b.age*4.8+i*.21;
            const loop = (.78+i*.13)*life;
            this.put(this.ribbons, bx+Math.cos(angle)*distance, .66+i*.09, bz+Math.sin(angle)*distance,
              loop*1.32, loop*.78, 1, i%2 ? '#ff9aac' : '#fff1d6', -angle+.36, 1.2+i*.11);
          }
        }
      } else if (b.character === 'eclipse') {
        const radius = Math.min(VEIL_RADIUS, 2.6+b.age*29);
        this.put(this.ribbons, bx, -.13, bz, radius, radius, 1, '#e4c8ff', 0, Math.PI/2);
      } else {
        this.put(this.stars, bx, .70, bz, 1.25*life, 1, .72*life, '#d8f8ff', -b.direction);
      }
      if(!reduced) for(let i=0;i<(this.profile==='mobile'?4:8);i++) {
        const a=b.direction+i*Math.PI*2/(this.profile==='mobile'?4:8);
        const distance=b.age*(b.kind==='impact'?7:4);
        const size=(b.kind==='impact'?.2:.13)*life;
        this.put(this.sparks,bx+Math.cos(a)*distance,.55+b.age,bz+Math.sin(a)*distance,size,size,size,b.color);
      }
    }
    for(const p of arena.projectiles) {
      // The sphere is the hit radius. All extended artwork streams behind it.
      const dx = Math.cos(p.direction), dz = Math.sin(p.direction);
      this.put(this.cores, p.x, .75, p.z, p.radius, p.radius, p.radius, '#b8f4ff');
      this.put(this.sparks, p.x, .75+p.radius*.71, p.z,
        p.radius*.46, p.radius*.45, p.radius*.46, '#eafcff');
      this.put(this.slashes, p.x-dx*1.73, .76, p.z-dz*1.73, 3.15, 1, 3.45, '#46b5fc', -p.direction);
      if (!reduced) {
        const strands = this.profile === 'mobile' ? 2 : 4;
        for (let i = 0; i < strands; i++) {
          const side = i%2 ? 1 : -1;
          const distance = 1.2+i*.59;
          const offset = side*(.25+i*.10);
          this.put(this.slashes, p.x-dx*distance-dz*offset, .83, p.z-dz*distance+dx*offset,
            2.65-i*.21, 1, 1.55-i*.17, i < 2 ? '#e6fcff' : '#51c9f4', -p.direction+side*.18);
        }
      }
    }
    for (const reaction of this.life.slots) {
      if (!reaction.active) continue;
      const { kind, x, z, age, boosted, direction } = reaction;
      const progress = age / .45;
      const life = 1 - progress;
      if (kind === 'spawn') {
        const radius = reduced ? 1.35 : 1 + age * 5;
        this.put(this.ribbons, x, -.26, z, radius, radius, radius, '#a7cbb3', 0, Math.PI / 2);
      } else if (kind === 'death') {
        const radius = reduced ? 1.05 : .75 + 2.05 * (1 - life ** 3);
        this.put(this.ribbons, x, -.26, z, radius, radius, radius, '#e7a17c', 0, Math.PI / 2);
        if (reduced) continue;

        const flash = Math.max(0, 1 - age / .18);
        if (flash > 0) {
          this.put(this.stars, x, .62, z, 1.9 * flash, 1, 1.4 * flash, '#ffe2bb', .36);
        }
        const count = this.profile === 'mobile' ? 4 : 6;
        for (let i = 0; i < count; i++) {
          const angle = i * Math.PI * 2 / count + .36;
          const distance = .55 + (1 - life ** 2) * (i % 2 ? 3.4 : 2.65);
          const length = (i % 2 ? .9 : 1.15) * life;
          this.put(this.sparks, x + Math.cos(angle) * distance, .43 + 1.1 * progress * life,
            z + Math.sin(angle) * distance, length, .17 * life, .15 * life,
            i % 2 ? '#e87551' : '#ffe6c3', -angle);
        }
      } else if (!reduced) {
        const glint = Math.max(0, 1 - age / .16);
        if (glint > 0) {
          this.put(this.stars, x, .63, z, (boosted ? .95 : .67) * glint, 1, .54 * glint,
            '#fff1b5', -direction);
        }
        const count = boosted && this.profile === 'desktop' ? 4 : 3;
        for (let i = 0; i < count; i++) {
          const angle = direction + i * Math.PI * 2 / count;
          const distance = .18 + age * 1.9;
          const size = (boosted ? .23 : .16) * life;
          const streak = boosted ? age * 2.5 : 0;
          this.put(this.sparks, x + Math.cos(angle) * distance - Math.cos(direction) * streak,
            .43 + age * (1.5 + i * .35), z + Math.sin(angle) * distance - Math.sin(direction) * streak,
            size * (boosted ? 2 : 1), size, size, i % 2 ? '#f6bd6c' : '#fff3c4', -direction);
        }
      }
    }
    for(const mark of this.boostMarks) {
      const life=1-mark.age/BOOST_MARK_LIFETIME;
      const sideX=-Math.sin(mark.angle),sideZ=Math.cos(mark.angle);
      const colors=mark.style==='original' ? [mark.color,'#fff0c9'] as const : TRAIL_COLORS[mark.style];
      for(const side of [-1,1]) {
        const drift=mark.style==='petals' ? mark.age*2.1 : 0;
        const x=mark.x+sideX*side*(mark.radius+drift),z=mark.z+sideZ*side*(mark.radius+drift);
        if (mark.style === 'original') {
          const width = mark.scale * life * 1.7;
          const length = mark.scale * life * (side === 1 ? 2.9 : 2.1);
          this.put(this.slashes, x, .23, z, length, 1, width, side === 1 ? colors[0] : colors[1],
            -mark.angle + side * .16);
        } else if(mark.style==='petals')
          this.put(this.sparks,x,.4+mark.age,z,.42*mark.scale*life,.08*life,.62*mark.scale*life,side===1?colors[0]:colors[1],-mark.angle+mark.age*3);
        else {
          this.put(this.sparks,x,.4+mark.age*.35,z,.42*mark.scale*life,.42*mark.scale*life,.42*mark.scale*life,side===1?colors[0]:colors[1]);
          if(side===1) this.put(this.ribbons,x,.16,z,.6*mark.scale*life,.6*mark.scale*life,.6*mark.scale*life,colors[0],0,Math.PI/2);
        }
      }
    }
    for(let i=0;i<this.meshes.length;i++){
      const mesh=this.meshes[i];mesh.visible=mesh.count>0;if(!mesh.visible)continue;
      dirtyRange(mesh.instanceMatrix,0,mesh.count*16);
      const first=this.colorRanges[i*2],last=this.colorRanges[i*2+1];
      if(mesh.instanceColor&&first>=0)dirtyRange(mesh.instanceColor,first*3,(last-first+1)*3);
    }
  }
  dispose() { if(this.disposed) return; this.disposed=true; for(const mesh of this.meshes) { mesh.dispose(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } this.group.removeFromParent(); }
}
