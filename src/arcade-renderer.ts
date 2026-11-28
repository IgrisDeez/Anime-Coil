import { Arena, bodyRadiusAt, CHARACTERS, hasVeil, HEAD_RADIUS, NUKE_BLAST, RADIUS, serpentScale, VEIL_RADIUS, type CharacterId, type Serpent } from './simulation';
import { BoostMotion, boostKind } from './presentation';
import { FrameProfiler } from './frame-profiler';
import { UltimateVisualClock } from './ultimate-visual';
import type { BodySkinId, TrailId } from './progression';
import type { GraphicsChoice } from './game-settings';

const colors = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
const foodColors = ['#ffa762', '#70d9f3', '#ff8491', '#c7acff'];

export class ArcadeRenderer {
  readonly profiler = new FrameProfiler();
  readonly boostMotion = new BoostMotion();
  readonly presentation = { time: 0, dt: 0, paused: false, reducedMotion: false };
  cinematicCameraEnabled = false;
  mode: 'game' | 'menu' = 'menu';
  private clock = new UltimateVisualClock();
  private x = 0;
  private z = 0;
  private zoom = 12;
  private pixelRatio = 1;
  private skin: BodySkinId = 'original';
  private trail: TrailId = 'original';
  private preview: BodySkinId | null = null;
  private hero: CharacterId = 'ember';
  private ctx: CanvasRenderingContext2D;
  private floor = new Image();
  private faces = new Map<CharacterId, HTMLImageElement>();

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas graphics unavailable');
    this.ctx = ctx;
    this.floor.src = '/art/crossing.webp';
    for (const fighter of CHARACTERS) {
      const face = new Image();
      face.src = `/art/${fighter.id}-face.webp`;
      this.faces.set(fighter.id, face);
    }
  }
  setGraphicsChoice(choice: GraphicsChoice) { this.pixelRatio = choice === 'low' ? 1 : Math.min(devicePixelRatio, 2); }
  setCosmetics(skin: BodySkinId, trail: TrailId) { this.skin = skin; this.trail = trail; }
  setMenuSkinPreview(skin: BodySkinId | null) { this.preview = skin; }
  setHero(id: CharacterId) { this.hero = id; }
  start(arena: Arena) { this.clearEffects(); this.mode = 'game'; this.x = arena.player.x; this.z = arena.player.z; }
  clearEffects() { this.clock.reset(); this.boostMotion.reset(); }
  prepareUltimateFrame(arena: Arena | undefined, reduced: boolean, flashes: boolean, _camera: boolean, advancing: boolean) {
    return this.clock.update(arena?.player.alive ? arena.cinematic : undefined, reduced, flashes, false, advancing);
  }
  steering(x: number, y: number, arena: Arena) {
    const dx = (x - innerWidth / 2) / this.zoom + this.x - arena.player.x;
    const dz = (y - innerHeight / 2) / this.zoom + this.z - arena.player.z;
    return Math.abs(dx) + Math.abs(dz) < .01 ? arena.player.angle : Math.atan2(dz, dx);
  }
  projectPoint(x: number, z: number, out: {x: number; y: number}, _height = 0, allowOffscreen = false) {
    out.x = innerWidth / 2 + (x - this.x) * this.zoom;
    out.y = innerHeight / 2 + (z - this.z) * this.zoom;
    return allowOffscreen || (out.x >= 0 && out.x <= innerWidth && out.y >= 0 && out.y <= innerHeight);
  }
  private disk(x: number, y: number, radius: number, fill: string) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  }
  private coil(s: Serpent, skin: BodySkinId) {
    const ctx = this.ctx, fighter = colors[s.character];
    for (let i = s.body.length - 1; i >= 0; i--) {
      const p = s.body[i], r = bodyRadiusAt(i, s.body.length, s.mass);
      if (Math.abs(p.x - this.x) * this.zoom > innerWidth / 2 + 40 || Math.abs(p.z - this.z) * this.zoom > innerHeight / 2 + 40) continue;
      this.disk(p.x, p.z, r * 1.1, skin === 'neon' ? '#fff5c7' : '#181926');
      this.disk(p.x, p.z, r * .91, i % 5 === 0 ? fighter.secondary : fighter.color);
      if (skin === 'spiritweave' && i % 2 === 0) this.disk(p.x, p.z, r * .38, '#f5e7cb');
    }
    const r = HEAD_RADIUS * serpentScale(s.mass);
    ctx.save(); ctx.translate(s.x,s.z); ctx.rotate(s.angle);
    this.disk(0, 0, r * 1.1, s.id === 0 ? '#fff6cb' : '#0c101b');
    this.disk(0, 0, r * .91, fighter.color);
    for (const side of [-1,1]) {
      this.disk(r * .46, side * r * .46, r * .28, '#fff8de');
      this.disk(r * .57, side * r * .45, r * .15, '#171921');
    }
    const face = this.faces.get(s.character);
    if (face?.naturalWidth) {
      ctx.rotate(-s.angle);
      ctx.save();
      ctx.beginPath(); ctx.arc(0,0,r*.95,0,Math.PI*2); ctx.clip();
      ctx.drawImage(face,-r,-r,2*r,2*r);
      ctx.restore();
      ctx.rotate(s.angle);
      ctx.beginPath(); ctx.moveTo(r*1.54,0); ctx.lineTo(r*1.1,-r*.28); ctx.lineTo(r*1.1,r*.28);
      ctx.closePath();ctx.fillStyle = s.id === 0 ? '#fff8df' : fighter.color;ctx.fill();
    }
    ctx.restore();
  }
  render(arena: Arena | undefined, _now: number, _alpha: number, dt: number, reduced: boolean, _simulationStep?: number) {
    const paused = document.hidden || (!!arena && arena.state !== 'playing');
    this.presentation.dt = paused ? 0 : dt;
    this.presentation.time += this.presentation.dt;
    this.presentation.paused = paused;
    this.presentation.reducedMotion = reduced;
    this.boostMotion.update(arena ? boostKind(arena.player, !paused, !!arena.cinematic, false) : 'none', this.presentation.dt);
    if (!arena && !this.preview) return;
    const ctx = this.ctx, w = innerWidth, h = innerHeight, ratio = this.pixelRatio;
    if (this.canvas.width !== Math.round(w * ratio) || this.canvas.height !== Math.round(h * ratio)) {
      this.canvas.width = Math.round(w * ratio); this.canvas.height = Math.round(h * ratio);
    }
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.fillStyle = '#111520'; ctx.fillRect(0,0,w,h);
    if (!arena) {
      const box = document.getElementById('lobby-showcase')!.getBoundingClientRect();
      const size = Math.min(box.width / 20, box.height / 10, 34);
      for (let i = 28; i >= 0; i--) {
        const x = box.left + box.width * .5 + (i-14) * size * .48;
        const y = box.top + box.height * .45 + Math.sin(i/6) * size * 1.3;
        this.disk(x,y,size * (i === 0 ? 1.05 : .77), this.preview === 'neon' ? '#fef3be' : '#222631');
        this.disk(x,y,size * (i === 0 ? .94 : .66), colors[this.hero].color);
        if (this.preview === 'spiritweave' || i === 0) this.disk(x-size*.18,y-size*.18,size*.20,'#fff5dc');
      }
      return;
    }
    const p = arena.player;
    this.x = p.x; this.z = p.z;
    this.zoom = Math.max(7, Math.min(w,h) / (54 + serpentScale(p.mass) * 5));
    ctx.translate(w/2,h/2); ctx.scale(this.zoom,this.zoom); ctx.translate(-this.x,-this.z);
    ctx.fillStyle = '#1c2331'; ctx.beginPath(); ctx.arc(0,0,RADIUS,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.clip();
    if (this.floor.naturalWidth) {
      ctx.drawImage(this.floor,-RADIUS,-RADIUS,RADIUS*2,RADIUS*2);
    } else {
      ctx.save(); ctx.rotate(-.48); ctx.fillStyle='#343c47';
      for(let i=-4;i<=4;i++) ctx.fillRect(i*2.7,-8,1.15,16);
      ctx.restore();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0,0,RADIUS,0,Math.PI*2); ctx.strokeStyle='#fd816a'; ctx.lineWidth=.4; ctx.stroke();
    for(const orb of arena.food) {
      if(Math.abs(orb.x-this.x)>w/2/this.zoom+1 || Math.abs(orb.z-this.z)>h/2/this.zoom+1) continue;
      const r=orb.source === 'drop' ? .46 : .32;
      this.disk(orb.x,orb.z,r*1.9,foodColors[orb.color%4]+'25');
      this.disk(orb.x,orb.z,r,foodColors[orb.color%4]);
    }
    if (hasVeil(p)) this.disk(p.x,p.z,VEIL_RADIUS,'#bf9bff28');
    for (const s of arena.snakes) if (s.alive && s.id !== 0) this.coil(s,'original');
    if (p.alive && p.boosting && p.body.length) {
      const tint = this.trail === 'petals' ? '#ffb2cb' : this.trail === 'starlight' ? '#ffda86' : colors[p.character].secondary;
      for (let i = 0; i < p.body.length; i += 3) {
        const b = p.body[i];
        this.disk(b.x, b.z, bodyRadiusAt(i,p.body.length,p.mass) * 1.6, tint + '65');
      }
    }
    if (p.alive) this.coil(p,this.skin);
    for(const shot of arena.projectiles) this.disk(shot.x,shot.z,shot.radius,'#baf5ff');
    if (arena.cinematic) {
      const time = arena.cinematic.time, impact = arena.cinematic.impact;
      const radius = time < NUKE_BLAST ? .9 + time * .95 : 4.2 + (time-NUKE_BLAST) * 30;
      ctx.beginPath(); ctx.arc(impact.x,impact.z,radius,0,Math.PI*2);
      ctx.lineWidth=.3; ctx.strokeStyle=colors[p.character].color; ctx.stroke();
    }
  }
}
