import { NUKE_BLAST, NUKE_DURATION, type Arena } from './simulation';
import type { SpiritImpactFrame, UltimateKind } from './ultimate-presentation';

export const AFTERMATH = { fox: 1.5, spirit: 1.4, purple: 1.5, skybreaker: 1.2 } as const;
type MutableImpact = { -readonly [K in keyof SpiritImpactFrame]: SpiritImpactFrame[K] };
export interface UltimateVisualFrame extends MutableImpact {
  active: boolean;
  kind: UltimateKind;
  time: number;
  age: number;
  detonated: boolean;
  keyframe: boolean;
  reducedMotion: boolean;
  reducedFlashes: boolean;
  cameraEnabled: boolean;
  managed: boolean;
}
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Reused presentation state. It never writes to a shot or consumes arena randomness. */
export class UltimateVisualClock {
  readonly frame: UltimateVisualFrame = { active: false, kind: 'fox', time: 0, age: -NUKE_BLAST,
    detonated: false, keyframe: false, reducedMotion: false, reducedFlashes: false,
    cameraEnabled: true, managed: true, phase: 'none', grayscale: 0, contrast: 1, brightness: 1, ink: 0 };
  private shot: Arena['cinematic'];
  private previous = -1;
  private presented = false;
  reset() { this.shot = undefined; this.previous = -1; this.presented = false; this.frame.active = false; }
  update(shot: Arena['cinematic'], reducedMotion: boolean, reducedFlashes: boolean, cameraEnabled: boolean, advancing: boolean) {
    const f = this.frame;
    f.active = !!shot && shot.time < NUKE_DURATION;
    f.reducedMotion = reducedMotion; f.reducedFlashes = reducedFlashes; f.cameraEnabled = cameraEnabled && !reducedMotion;
    f.keyframe = false; f.phase = 'none'; f.grayscale = 0; f.contrast = 1; f.brightness = 1; f.ink = 0;
    if (!f.active || !shot) { this.reset(); f.detonated = false; f.time = 0; f.age = -NUKE_BLAST; return f; }
    if (this.shot !== shot || shot.time < this.previous) { this.shot = shot; this.previous = -1; this.presented = false; }
    f.kind = shot.kind; f.time = shot.time; f.age = shot.time - NUKE_BLAST;
    f.detonated = shot.detonated && f.age >= 0;
    this.previous = shot.time;
    if (!f.detonated) return f;
    const soft = reducedMotion || reducedFlashes;
    f.keyframe = !soft && !this.presented;
    if (f.keyframe) {
      f.phase = 'keyframe'; f.grayscale = 1; f.contrast = 2.2; f.brightness = 1.12; f.ink = 1;
      if (advancing) this.presented = true;
    } else if (f.age < .12 && !soft) {
      f.phase = 'monochrome'; f.grayscale = .78 * (1 - smooth(.035, .12, f.age));
      f.contrast = 1 + .42 * (1 - smooth(.035, .15, f.age)); f.ink = .36 * (1 - smooth(.035, .15, f.age));
    } else {
      f.phase = 'residual';
      if (soft) { f.contrast = 1 + .1 * (1 - smooth(0, .3, f.age)); }
    }
    return f;
  }
}
