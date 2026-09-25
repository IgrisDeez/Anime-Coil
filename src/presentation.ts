export interface PresentationFrame {
  readonly time: number;
  readonly dt: number;
  readonly paused: boolean;
  readonly reducedMotion: boolean;
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
