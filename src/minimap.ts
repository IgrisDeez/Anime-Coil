import { RADIUS, HEAD_RADIUS, serpentScale, angleDelta } from './simulation';
import type { MapId } from './maps';
import type { PresentationFrame } from './presentation';

export interface CompassTheme { readonly inner: string; readonly outer: string; readonly ring: string; readonly rival: string }
export const COMPASS_THEMES: Readonly<Record<MapId, CompassTheme>> = {
  shibuya: { inner: '#dedbe6', outer: '#bbb9ce', ring: '#827990', rival: '#6b637d' },
  leaf: { inner: '#e2ecd8', outer: '#bdcfb0', ring: '#819773', rival: '#586f52' },
  tournament: { inner: '#f5ecd9', outer: '#ded1b3', ring: '#a89773', rival: '#81735d' },
  harbor: { inner: '#d9ebe2', outer: '#acd0c7', ring: '#729c92', rival: '#486f70' },
};
interface CompassSnake {
  readonly id: number; readonly x: number; readonly z: number; readonly angle: number;
  readonly previous: Readonly<{ x: number; z: number }>; readonly previousAngle: number;
  readonly mass: number; readonly alive: boolean;
}
interface CompassInput { readonly snakes: readonly CompassSnake[]; readonly cinematic?: unknown }
export interface CompassMarker { id: number; x: number; z: number; fromX: number; fromZ: number; angle: number; fromAngle: number; mass: number }
export function edgeWarning(x: number, z: number, mass: number) {
  const safe = RADIUS - HEAD_RADIUS * serpentScale(mass);
  return Math.max(0, Math.min(1, (Math.hypot(x, z) / safe - .88) / .12));
}
export function projectMarker(marker: CompassMarker, alpha: number, out: { x: number; y: number; angle: number }) {
  const t = Math.max(0, Math.min(1, alpha));
  out.x = 120 + (marker.fromX + (marker.x - marker.fromX) * t) / RADIUS * 103;
  out.y = 120 + (marker.fromZ + (marker.z - marker.fromZ) * t) / RADIUS * 103;
  out.angle = marker.fromAngle + angleDelta(marker.fromAngle, marker.angle) * t;
  return out;
}
export class CompassState {
  readonly markers = new Map<number, CompassMarker>();
  revision = 0;
  private cinematic = false;
  private living = new Set<number>();
  reset() { this.markers.clear(); this.living.clear(); this.cinematic = false; this.revision++; }
  sync(input: CompassInput, snap = false) {
    this.revision++;
    const cinematic = !!input.cinematic;
    snap ||= cinematic !== this.cinematic;
    this.cinematic = cinematic;
    this.living.clear();
    for (const s of input.snakes) {
      if (!s.alive) continue;
      this.living.add(s.id);
      let marker = this.markers.get(s.id);
      const fresh = !marker;
      if (!marker) { marker = { id: s.id, x: 0, z: 0, fromX: 0, fromZ: 0, angle: 0, fromAngle: 0, mass: s.mass }; this.markers.set(s.id, marker); }
      marker.x = s.x; marker.z = s.z; marker.angle = s.angle; marker.mass = s.mass;
      marker.fromX = snap || fresh ? s.x : s.previous.x;
      marker.fromZ = snap || fresh ? s.z : s.previous.z;
      marker.fromAngle = snap || fresh ? s.angle : s.previousAngle;
    }
    for (const id of this.markers.keys()) if (!this.living.has(id)) this.markers.delete(id);
  }
}

export class SpiritCompass {
  readonly state = new CompassState();
  private context: CanvasRenderingContext2D | null;
  private background: HTMLCanvasElement;
  private map: MapId = 'shibuya';
  private lastDraw = -Infinity;
  private reduced = false;
  private lastRevision = -1;
  private lastAlpha = 1;
  private point = { x: 0, y: 0, angle: 0 };
  targetId: number | undefined;
  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d');
    this.background = canvas.ownerDocument.createElement('canvas');
    this.background.width = this.background.height = 240;
    this.setMap(this.map);
  }
  reset() { this.state.reset(); this.targetId = undefined; this.lastDraw = -Infinity; this.context?.clearRect(0, 0, 240, 240); }
  setMap(id: MapId) {
    this.map = id; this.lastDraw = -Infinity;
    const c = this.background.getContext('2d'); if (!c) return;
    const theme = COMPASS_THEMES[id];
    c.clearRect(0, 0, 240, 240);
    const wash = c.createRadialGradient(104, 88, 6, 120, 120, 120);
    wash.addColorStop(0, theme.inner); wash.addColorStop(1, theme.outer);
    c.fillStyle = wash; c.beginPath(); c.arc(120, 120, 118, 0, Math.PI * 2); c.fill();
    c.strokeStyle = theme.ring; c.lineWidth = 1.6; c.globalAlpha = .65;
    c.beginPath(); c.arc(120, 120, 103, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = .2; c.beginPath(); c.arc(120, 120, 108, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = .8; c.lineWidth = 2.5; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      c.beginPath(); c.moveTo(120 + Math.cos(a) * 111, 120 + Math.sin(a) * 111);
      c.lineTo(120 + Math.cos(a) * 115, 120 + Math.sin(a) * 115); c.stroke();
    }
    c.globalAlpha = 1;
    this.canvas.parentElement?.style.setProperty('--compass-accent', theme.ring);
  }
  draw(frame: PresentationFrame, alpha: number) {
    const preferenceChanged = this.reduced !== frame.reducedMotion;
    this.reduced = frame.reducedMotion;
    const finalSnapshot = frame.paused && this.lastRevision !== this.state.revision;
    if (!preferenceChanged && !finalSnapshot && frame.time - this.lastDraw < 1 / 30 - 1e-6) return;
    alpha = finalSnapshot ? 1 : frame.paused ? this.lastAlpha : alpha;
    this.lastAlpha = alpha; this.lastRevision = this.state.revision;
    this.lastDraw = frame.time;
    const c = this.context; if (!c) return;
    c.clearRect(0, 0, 240, 240); c.drawImage(this.background, 0, 0);
    c.save(); c.beginPath(); c.arc(120, 120, 110, 0, Math.PI * 2); c.clip();
    const theme = COMPASS_THEMES[this.map];
    for (const marker of this.state.markers.values()) {
      if (marker.id === 0) continue;
      const p = projectMarker(marker, alpha, this.point);
      c.fillStyle = theme.rival; c.beginPath(); c.arc(p.x, p.y, 3, 0, Math.PI * 2); c.fill();
      if (marker.id === this.targetId) {
        c.save(); c.translate(p.x, p.y); c.rotate(Math.PI / 4);
        c.fillStyle = '#fff7df'; c.strokeStyle = '#a36341'; c.lineWidth = 1.5;
        c.beginPath(); c.rect(-5, -5, 10, 10); c.fill(); c.stroke(); c.restore();
      }
    }
    const player = this.state.markers.get(0);
    if (player) {
      const p = projectMarker(player, alpha, this.point);
      const danger = edgeWarning(player.x, player.z, player.mass);
      if (danger > 0) {
        const a = Math.atan2(player.z, player.x);
        c.strokeStyle = '#c97955'; c.lineWidth = 4;
        c.globalAlpha = danger * (this.reduced ? .9 : .78 + Math.sin(frame.time * 3) * .12);
        c.beginPath(); c.arc(120, 120, 103, a - .4, a + .4); c.stroke(); c.globalAlpha = 1;
      }
      c.fillStyle = '#fff9e9'; c.beginPath();
      c.arc(p.x, p.y, 9.5 + (this.reduced ? 0 : Math.sin(frame.time * 2.2) * .55), 0, Math.PI * 2); c.fill();
      c.save(); c.translate(p.x, p.y); c.rotate(p.angle);
      c.fillStyle = '#463a30'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-5.5, -5.2); c.quadraticCurveTo(-2, 0, -5.5, 5.2); c.closePath(); c.fill(); c.restore();
    }
    c.restore();
  }
  dispose() { this.reset(); this.background.width = this.background.height = 0; this.context = null; }
}
