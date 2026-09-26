import { compareSprintResults, SPRINT_DURATION, type SprintResult } from './simulation';

export const SPRINT_BEST_KEY = 'anime-coil-sprint-best-v1';
export interface RecordStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadSprintBest(storage?: RecordStorage): SprintResult | undefined {
  try {
    const value = JSON.parse(storage?.getItem(SPRINT_BEST_KEY) ?? 'null');
    if (!value || !Number.isSafeInteger(value.score) || value.score < 0 ||
      !Number.isSafeInteger(value.kills) || value.kills < 0 ||
      typeof value.survival !== 'number' || !Number.isFinite(value.survival) ||
      value.survival < 0 || value.survival > SPRINT_DURATION) return undefined;
    return { score: value.score, kills: value.kills, survival: value.survival };
  } catch { return undefined; }
}

export function recordSprint(candidate: SprintResult, previous?: SprintResult, storage?: RecordStorage) {
  if (previous && compareSprintResults(candidate, previous) <= 0)
    return { best: previous, newRecord: false } as const;
  try { storage?.setItem(SPRINT_BEST_KEY, JSON.stringify(candidate)); } catch { /* Play continues without storage. */ }
  return { best: candidate, newRecord: true } as const;
}
