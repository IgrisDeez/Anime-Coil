import { NUKE_BLAST, NUKE_DURATION } from './simulation';

export type UltimateKind = 'purple' | 'spirit';
export type UltimateStage = 'charge' | 'merge' | 'compression' | 'throw' | 'impact' | 'recovery';
export type UltimateCue = 'converge' | 'compress' | 'throw' | 'impact';
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
  const boundaries = kind === 'purple' ? [0, 1.2, 2.5, NUKE_BLAST, 4.15, NUKE_DURATION] : [0, 2.4, NUKE_BLAST, 4.2, NUKE_DURATION];
  const names: UltimateStage[] = kind === 'purple'
    ? ['charge', 'merge', 'compression', 'impact', 'recovery']
    : ['charge', 'throw', 'impact', 'recovery'];
  let index = names.length - 1;
  for (let i = 0; i < names.length; i++) if (t < boundaries[i + 1]) { index = i; break; }
  const progress = clamp((t - boundaries[index]) / (boundaries[index + 1] - boundaries[index]));
  const cameraWeight = reduced ? 0 : smooth(t / .55) * (1 - smooth((t - 4.35) / (NUKE_DURATION - 4.35)));
  const titleOpacity = smooth(t / .2) * (1 - smooth((t - 1.45) / .45));
  const flash = reduced ? 0 : t < NUKE_BLAST ? 0 : Math.max(0, 1 - (t - NUKE_BLAST) / .22) * (kind === 'purple' ? .48 : .36);
  const darken = reduced ? 0 : t < NUKE_BLAST
    ? smooth((t - (kind === 'purple' ? 2.55 : 1.8)) / (kind === 'purple' ? .65 : 1.2)) * (kind === 'purple' ? .22 : .13)
    : Math.max(0, 1 - (t - NUKE_BLAST) / .55) * .08;
  return { kind, time: t, stage: names[index], progress, cameraWeight,
    titleOpacity, bars: reduced ? 0 : smooth(t / .35) * (1 - smooth((t - 4.5) / 1.1)), flash, darken };
}

const cueThresholds: Record<UltimateKind, readonly [number, UltimateCue][]> = {
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
