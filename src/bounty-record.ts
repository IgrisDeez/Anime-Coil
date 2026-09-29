import { compareBountyResults, type BountyResult } from './simulation';
import type { RecordStorage } from './sprint-record';

export const BOUNTY_BEST_KEY = 'anime-coil-bounty-best-v1';
export function loadBountyBest(storage?: RecordStorage): BountyResult | undefined {
  try {
    const value = JSON.parse(storage?.getItem(BOUNTY_BEST_KEY) ?? 'null');
    if (!value || !['points', 'bounties', 'directEliminations', 'ultimateEliminations', 'peakEnergy']
      .every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) ||
      value.points > 10000000 || value.bounties > 1000 || value.directEliminations > 1000 ||
      value.ultimateEliminations > 1000) return undefined;
    return value as BountyResult;
  } catch { return undefined; }
}
export function recordBounty(candidate: BountyResult, previous?: BountyResult, storage?: RecordStorage) {
  if (previous && compareBountyResults(candidate, previous) <= 0)
    return { best: previous, newRecord: false } as const;
  try { storage?.setItem(BOUNTY_BEST_KEY, JSON.stringify(candidate)); } catch {}
  return { best: candidate, newRecord: true } as const;
}
