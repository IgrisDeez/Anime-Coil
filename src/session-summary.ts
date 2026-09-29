import { CHALLENGES, BODY_SKINS, TRAILS, type ProgressionState } from './progression';
import type { MatchMode } from './simulation';

export interface SessionProgress {
  readonly orbs: number;
  readonly survival: number;
  readonly eliminations: number;
  readonly sprintMaps: number;
  readonly skins: readonly string[];
  readonly trails: readonly string[];
}

export function progressSnapshot(state: ProgressionState): SessionProgress {
  return {
    orbs: state.progress.collectedOrbs,
    survival: state.progress.survivedSeconds,
    eliminations: state.progress.creditedEliminations,
    sprintMaps: state.progress.completedSprintMaps.length,
    skins: [...state.unlocked.skins],
    trails: [...state.unlocked.trails],
  };
}

export interface SessionSummary {
  readonly progress: readonly string[];
  readonly unlocks: readonly string[];
}

/** Presentation-only comparison of locally saved progress; no gameplay accounting here. */
export function sessionSummary(mode: MatchMode, before: SessionProgress, after: SessionProgress): SessionSummary {
  if (mode === 'practice') return { progress: [], unlocks: [] };
  const progress = CHALLENGES.flatMap(challenge => {
    const key = challenge.id === 'sprint-maps' ? 'sprintMaps' : challenge.id === 'survival' ? 'survival'
      : challenge.id === 'eliminations' ? 'eliminations' : 'orbs';
    const gained = Math.max(0, Math.floor(after[key] - before[key]));
    return gained ? [`${challenge.name}: +${gained}${key === 'survival' ? ' sec' : ''}`] : [];
  });
  const unlocks = [
    ...BODY_SKINS.filter(item => !before.skins.includes(item.id) && after.skins.includes(item.id)).map(item => item.name),
    ...TRAILS.filter(item => !before.trails.includes(item.id) && after.trails.includes(item.id)).map(item => item.name),
  ];
  return { progress, unlocks };
}

/** One queue item per reward, even when several fixed steps report the same unlock. */
export class UnlockNotices {
  private seen = new Set<string>();
  private pending: string[] = [];
  reset() { this.seen.clear(); this.pending = []; }
  add(names: readonly string[]) {
    for (const name of names) if (!this.seen.has(name)) { this.seen.add(name); this.pending.push(name); }
  }
  take(canShow: boolean): string | undefined { return canShow ? this.pending.shift() : undefined; }
  get count() { return this.pending.length; }
}
