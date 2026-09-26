import { MIN_MASS, type CharacterId, type MatchMode } from './simulation';

export const HUD_MODE_LABELS: Readonly<Record<MatchMode,string>> = {
  endless: 'ENDLESS', sprint: '3-MINUTE SPRINT', practice: 'GUIDED PRACTICE',
};
export const MATCH_HINT_DURATION = 4;

export const UI_ACCENTS: Readonly<Record<CharacterId, { ink: string; fill: string; wash: string }>> = {
  ember: { ink: '#94603b', fill: '#dc9c69', wash: '#fcf0dd' },
  nova: { ink: '#3b738b', fill: '#7db8d0', wash: '#eaf4f5' },
  cloud: { ink: '#995f58', fill: '#d99282', wash: '#fcebe0' },
  eclipse: { ink: '#75618d', fill: '#ad96c9', wash: '#f1ebf6' },
};

/** Lifetimes use presentation delta, including pauses and hidden tabs. */
export class HudLifetime {
  hintRemaining = 0;
  start() { this.hintRemaining = MATCH_HINT_DURATION; }
  dismissHint() { this.hintRemaining = 0; }
  clear() { this.hintRemaining = 0; }
  update(frame: PresentationFrame) {
    if (frame.paused) return;
    this.hintRemaining = Math.max(0, this.hintRemaining - frame.dt);
  }
  get hintOpacity() {
    const fade = Math.min(1, this.hintRemaining / .7);
    return fade * fade * (3 - 2 * fade);
  }
}

export class PreviewMotion {
  private age = 1;
  select() { this.age = 0; }
  reset() { this.age = 1; }
  update(dt: number, reduced: boolean) { this.age = reduced ? 1 : Math.min(1, this.age + Math.max(0, dt)); }
  get reaction() { return this.age >= .42 ? 0 : Math.sin(Math.PI * this.age / .42) * (1 - this.age / .42); }
}

export function previewBlink(time: number, id: CharacterId, reduced: boolean) {
  if (reduced || id === 'eclipse') return 1;
  const period = id === 'cloud' ? 4.1 : id === 'ember' ? 3.7 : 4.7;
  const phase = time % period;
  return phase < .16 ? Math.max(.08, Math.abs(phase - .08) / .08) : 1;
}

export interface PresentationFrame {
  readonly time: number;
  readonly dt: number;
  readonly paused: boolean;
  readonly reducedMotion: boolean;
}

export type BoostKind = 'none' | 'normal' | 'fox';
export function boostStatus(player: Readonly<{ boosting: boolean; mass: number; character: string; active: number }>): 'boosting' | 'unavailable' | 'ready' {
  if (player.boosting) return 'boosting';
  return player.mass <= MIN_MASS + .05 && !(player.character === 'ember' && player.active > 0) ? 'unavailable' : 'ready';
}
export function boostKind(player: Readonly<{ alive: boolean; boosting: boolean; character: string; active: number }>, playing: boolean, cinematic: boolean): BoostKind {
  if (!playing || cinematic || !player.alive || !player.boosting) return 'none';
  return player.character === 'ember' && player.active > 0 ? 'fox' : 'normal';
}

/** Visual strength follows the shared pause-aware clock; no gameplay state is changed. */
export class BoostMotion {
  intensity = 0;
  kind: BoostKind = 'none';
  update(target: BoostKind, dt: number) {
    if (target !== 'none') this.kind = target;
    const goal = target === 'none' ? 0 : 1;
    const tau = goal ? .12 : .24;
    this.intensity += (goal - this.intensity) * (1 - Math.exp(-Math.max(0, dt) / tau));
    if (target === 'none' && this.intensity < .001) this.reset();
  }
  reset() { this.intensity = 0; this.kind = 'none'; }
  get enhanced() { return this.kind === 'fox'; }
  fov(reduced: boolean) { return 43 + this.intensity * (reduced ? (this.enhanced ? 3 : 2) : (this.enhanced ? 7 : 5)); }
  cameraOffset(reduced: boolean) { return this.intensity * (reduced ? (this.enhanced ? .5 : .35) : (this.enhanced ? 1.5 : 1.1)); }
  lean(reduced: boolean) { return reduced ? 0 : this.intensity * (this.enhanced ? .16 : .08); }
  compression(reduced: boolean) { return reduced ? 1 : 1 - this.intensity * (this.enhanced ? .045 : .025); }
}

/** One preference observer for rendering and DOM feedback, including live OS changes. */
export class MotionPreference {
  private query: MediaQueryList | undefined;
  private systemReduced = false;
  previewReduced = false;
  get reduced() { return this.systemReduced || this.previewReduced; }
  private change = () => { this.systemReduced = this.query?.matches ?? false; };
  constructor() {
    if (typeof matchMedia === 'function') {
      this.query = matchMedia('(prefers-reduced-motion: reduce)');
      this.change();
      this.query.addEventListener('change', this.change);
    }
  }
  dispose() { this.query?.removeEventListener('change', this.change); }
}

/** Decorative movement is vertical only; gameplay coordinates and widths stay exact. */
export function breathing(time: number, id: number, boosting: boolean, still: boolean) {
  return still ? 0 : Math.sin(time * (boosting ? 5 : 2.2) + id * 1.7) * (boosting ? .028 : .018);
}

/** Web animations are manually sampled from the game clock, never their own wall clock. */
export class HudMotion {
  private active = new Map<HTMLElement, { animation: Animation; start: number; duration: number }>();
  time = 0;
  reduced = false;
  selection(node: HTMLElement, check?: HTMLElement | null) {
    this.animate(node, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: .4 }, { transform: 'scale(1)' }], 240);
    if (check) this.animate(check, [{ opacity: .35, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1)' }], 200);
  }
  pulse(node: HTMLElement, kind: 'pop' | 'settle' | 'rank' = 'pop') {
    if (this.reduced || this.active.has(node) || !node.animate) return;
    const duration = kind === 'settle' ? 450 : 280;
    const keys = kind === 'settle'
      ? [{ opacity: .45, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }]
      : [{ transform: 'scale(1)' }, { transform: `scale(${kind === 'rank' ? 1.04 : 1.055})`, offset: .35 }, { transform: 'scale(1)' }];
    this.animate(node, keys, duration);
  }
  animate(node: HTMLElement, keys: Keyframe[], duration: number) {
    if (this.reduced || !node.animate) return;
    this.active.get(node)?.animation.cancel();
    const animation = node.animate(keys, { duration, easing: 'ease-out' });
    animation.pause(); animation.currentTime = 0;
    this.active.set(node, { animation, start: this.time, duration });
  }
  update(frame: PresentationFrame) {
    this.time = frame.time; this.reduced = frame.reducedMotion;
    if (this.reduced) { this.clear(); return; }
    for (const [node, item] of this.active) {
      const age = Math.max(0, (frame.time - item.start) * 1000);
      if (age >= item.duration) { item.animation.cancel(); this.active.delete(node); }
      else item.animation.currentTime = age;
    }
  }
  clear() { for (const { animation } of this.active.values()) animation.cancel(); this.active.clear(); }
  forget(node: HTMLElement) { this.active.get(node)?.animation.cancel(); this.active.delete(node); }
  get count() { return this.active.size; }
}
