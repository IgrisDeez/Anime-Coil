import { NUKE_BLAST, NUKE_DURATION } from './simulation';

export type UltimateKind = import('./ultimates').CinematicKind;
export type UltimateStage = 'summon' | 'launch' | 'charge' | 'merge' | 'compression' | 'throw' | 'impact' | 'recovery';
export type UltimateCue = 'converge' | 'compress' | 'throw' | 'impact' | 'gather' | 'launch' | 'release' | 'windup';
export interface UltimateFrame {
  readonly kind: UltimateKind;
  readonly time: number;
  readonly stage: UltimateStage;
  readonly progress: number;
  readonly cameraWeight: number;
  readonly titleOpacity: number;
  readonly bars: number;
  readonly flash: number;
  readonly darken: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
export function ultimateFrame(kind: UltimateKind, time: number, reduced = false): UltimateFrame {
  const t = Math.max(0, Math.min(NUKE_DURATION, time));
  const boundaries = kind === 'fox' || kind === 'skybreaker' ? [0, .9, 2.5, NUKE_BLAST, 4.3, NUKE_DURATION] : kind === 'purple' ? [0, 1.2, 2.5, NUKE_BLAST, 4.15, NUKE_DURATION] : [0, 2.4, NUKE_BLAST, 4.2, NUKE_DURATION];
  const names: UltimateStage[] = kind === 'fox' || kind === 'skybreaker' ? ['summon', 'charge', 'launch', 'impact', 'recovery'] : kind === 'purple'
    ? ['charge', 'merge', 'compression', 'impact', 'recovery']
    : ['charge', 'throw', 'impact', 'recovery'];
  let index = names.length - 1;
  for (let i = 0; i < names.length; i++) if (t < boundaries[i + 1]) { index = i; break; }
  const progress = clamp((t - boundaries[index]) / (boundaries[index + 1] - boundaries[index]));
  const cameraWeight = reduced ? 0 : smooth(t / .55) * (1 - smooth((t - 4.35) / (NUKE_DURATION - 4.35)));
  const titleOpacity = smooth(t / .2) * (1 - smooth((t - 1.45) / .45));
  const flash = reduced ? 0 : t < NUKE_BLAST ? 0 : Math.max(0, 1 - (t - NUKE_BLAST) / .22) * (kind === 'purple' ? .6 : kind === 'skybreaker' ? .25 : .36);
  const darken = reduced ? 0 : t < NUKE_BLAST
    ? smooth((t - (kind === 'purple' ? 2.55 : 1.8)) / (kind === 'purple' ? .65 : 1.2)) * (kind === 'purple' ? .3 : .13)
    : Math.max(0, 1 - (t - NUKE_BLAST) / .55) * .08;
  return { kind, time: t, stage: names[index], progress, cameraWeight,
    titleOpacity, bars: reduced ? 0 : smooth(t / .35) * (1 - smooth((t - 4.5) / 1.1)), flash, darken };
}

const cueThresholds: Record<UltimateKind, readonly [number, UltimateCue][]> = {
  fox: [[.9, 'gather'], [2.5, 'launch'], [4.3, 'release']],
  skybreaker: [[.9, 'windup'], [2.5, 'throw'], [4.3, 'release']],
  purple: [[1.2, 'converge'], [2.5, 'compress']],
  spirit: [[2.4, 'throw']],
};
export class UltimateCueTracker {
  private kind?: UltimateKind;
  private time = -1;
  reset() { this.kind = undefined; this.time = -1; }
  consume(kind: UltimateKind | undefined, time = 0): UltimateCue[] {
    if (!kind) { this.reset(); return []; }
    if (kind !== this.kind || time < this.time) { this.kind = kind; this.time = -1; }
    const events: UltimateCue[] = [];
    for (const [threshold, cue] of cueThresholds[kind]) if (this.time < threshold && time >= threshold) events.push(cue);
    this.time = time;
    return events;
  }
}

export type SpiritImpactPhase = 'none' | 'keyframe' | 'monochrome' | 'restore' | 'residual';
export interface SpiritImpactFrame {
  readonly phase: SpiritImpactPhase;
  readonly grayscale: number;
  readonly contrast: number;
  readonly brightness: number;
  readonly ink: number;
}
/** World anchor for the graphic impact art, which may differ from damage coverage. */
export function cinematicImpactAnchor(
  kind: UltimateKind,
  impact: Readonly<{ x: number; z: number }>,
  player: Readonly<{ x: number; z: number }>,
  out: { x: number; y: number; z: number },
) {
  out.x = kind === 'purple' ? player.x : impact.x;
  out.z = kind === 'purple' ? player.z : impact.z;
  out.y = kind === 'purple' ? 5 : kind === 'skybreaker' ? 0 : 1.5;
}
const quietImpact: SpiritImpactFrame = { phase: 'none', grayscale: 0, contrast: 1, brightness: 1, ink: 0 };

/** One reusable clock-driven latch per cinematic; low FPS cannot skip the graphic keyframe. */
export class AnimeImpactPresentation {
  private previous = -1;
  private shown = 0;
  constructor(private readonly targetKind: UltimateKind, private readonly monoEnd: number) {}
  reset() { this.previous = -1; this.shown = 0; }
  update(kind: UltimateKind | undefined, time: number, reduced: boolean, advancing: boolean): SpiritImpactFrame {
    if (kind !== this.targetKind) { this.reset(); return quietImpact; }
    const t = Math.max(0, time);
    if (t < this.previous) this.reset();
    const crossed = this.previous < NUKE_BLAST && t >= NUKE_BLAST;
    if (crossed) this.shown = 0;
    this.previous = t;
    if (t < NUKE_BLAST) return quietImpact;
    const age = t - NUKE_BLAST;
    if (reduced) {
      const emphasis = Math.max(0, 1 - age / this.monoEnd);
      return { phase: age < this.monoEnd ? 'monochrome' : 'residual', grayscale: emphasis * .65,
        contrast: 1 + emphasis * .28, brightness: 1 + emphasis * .08, ink: emphasis * .18 };
    }
    if (this.shown === 0 || (this.shown === 1 && age < .05)) {
      if (advancing) this.shown++;
      return { phase: 'keyframe', grayscale: 1, contrast: 2.2, brightness: 1.12, ink: 1 };
    }
    if (age < this.monoEnd) return { phase: 'monochrome', grayscale: .96, contrast: 1.48, brightness: 1.08,
      ink: .53 * (1 - age / this.monoEnd) };
    if (age < this.monoEnd + .35) {
      const remaining = 1 - smooth((age - this.monoEnd) / .35);
      return { phase: 'restore', grayscale: .96 * remaining, contrast: 1 + .48 * remaining,
        brightness: 1 + .08 * remaining, ink: .2 * remaining };
    }
    return { ...quietImpact, phase: 'residual' };
  }
}
export class SpiritImpactPresentation extends AnimeImpactPresentation {
  constructor() { super('spirit', .3); }
}
export class FoxImpactPresentation extends AnimeImpactPresentation {
  constructor() { super('fox', .25); }
}
export class PurpleImpactPresentation extends AnimeImpactPresentation {
  constructor() { super('purple', .24); }
}
export class SkybreakerImpactPresentation extends AnimeImpactPresentation {
  constructor() { super('skybreaker', .22); }
}
