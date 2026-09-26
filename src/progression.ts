import { MAPS, type MapId } from './maps';
import type { GameEvent } from './simulation';

export type ProgressMode = 'endless' | 'sprint' | 'practice';
export type PaletteId = 'original' | 'sunset' | 'moonlit';
export type TrailId = 'original' | 'petals' | 'starlight';
export type ChallengeId = 'orbs' | 'survival' | 'eliminations' | 'sprint-maps';

export interface CosmeticSelection {
  palette: PaletteId;
  trail: TrailId;
}
export interface ChallengeProgress {
  collectedOrbs: number;
  survivedSeconds: number;
  creditedEliminations: number;
  completedSprintMaps: MapId[];
}
export interface ProgressionState {
  progress: ChallengeProgress;
  cosmetics: CosmeticSelection;
  unlocked: { palettes: PaletteId[]; trails: TrailId[] };
}
export interface ProgressionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROGRESSION_KEY = 'anime-coil-progression-v1';
export const PALETTES = [
  { id: 'original', name: 'Original', primary: null, secondary: null, challenge: null },
  { id: 'sunset', name: 'Sunset', primary: '#ed8d79', secondary: '#ffcb91', challenge: 'orbs' },
  { id: 'moonlit', name: 'Moonlit', primary: '#7e98d7', secondary: '#b8dce8', challenge: 'survival' },
] as const;
export const TRAILS = [
  { id: 'original', name: 'Original', color: null, secondary: null, challenge: null },
  { id: 'petals', name: 'Petal Drift', color: '#ee9ca9', secondary: '#f9d7b5', challenge: 'eliminations' },
  { id: 'starlight', name: 'Starlight', color: '#9bd8ef', secondary: '#e6f9ff', challenge: 'sprint-maps' },
] as const;
export const CHALLENGES = [
  { id: 'orbs', name: 'Spirit Gatherer', description: 'Collect 100 energy orbs', target: 100, reward: 'Sunset coil palette' },
  { id: 'survival', name: 'Steady Spirit', description: 'Survive 10 total minutes', target: 600, reward: 'Moonlit coil palette' },
  { id: 'eliminations', name: 'Coil Champion', description: 'Earn 10 credited eliminations', target: 10, reward: 'Petal Drift boost trail' },
  { id: 'sprint-maps', name: 'World Sprinter', description: 'Finish a sprint on each map', target: 4, reward: 'Starlight boost trail' },
] as const;

const mapIds = new Set<string>(MAPS.map((map) => map.id));
const cleanNumber = (value: unknown, cap: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(cap, value)
    : 0;
const cleanCount = (value: unknown, cap: number) => Math.floor(cleanNumber(value, cap));
const emptyProgress = (): ChallengeProgress => ({
  collectedOrbs: 0,
  survivedSeconds: 0,
  creditedEliminations: 0,
  completedSprintMaps: [],
});

/** Offline lifetime challenges. Gameplay events are accepted only in an active eligible match. */
export class Progression {
  private progress = emptyProgress();
  private cosmetics: CosmeticSelection = { palette: 'original', trail: 'original' };
  private activeMode: ProgressMode | undefined;
  private seenEliminations = new Set<number>();

  constructor(private storage?: ProgressionStorage) {
    try {
      const saved = JSON.parse(storage?.getItem(PROGRESSION_KEY) ?? 'null');
      if (!saved || saved.version !== 1 || typeof saved !== 'object') return;
      const incoming = saved.progress;
      if (incoming && typeof incoming === 'object') {
        this.progress.collectedOrbs = cleanCount(incoming.collectedOrbs, 100);
        this.progress.survivedSeconds = cleanNumber(incoming.survivedSeconds, 600);
        this.progress.creditedEliminations = cleanCount(incoming.creditedEliminations, 10);
        if (Array.isArray(incoming.completedSprintMaps))
          this.progress.completedSprintMaps = MAPS.map((map) => map.id).filter((id) => incoming.completedSprintMaps.includes(id));
      }
      const choice = saved.cosmetics;
      if (choice && typeof choice === 'object') {
        if (PALETTES.some((palette) => palette.id === choice.palette) && this.isUnlocked('palette', choice.palette))
          this.cosmetics.palette = choice.palette;
        if (TRAILS.some((trail) => trail.id === choice.trail) && this.isUnlocked('trail', choice.trail))
          this.cosmetics.trail = choice.trail;
      }
    } catch {
      // Private browsing, invalid JSON, and disabled storage must not block play.
    }
  }

  get state(): ProgressionState {
    return {
      progress: { ...this.progress, completedSprintMaps: [...this.progress.completedSprintMaps] },
      cosmetics: { ...this.cosmetics },
      unlocked: {
        palettes: PALETTES.filter((palette) => this.isUnlocked('palette', palette.id)).map((palette) => palette.id),
        trails: TRAILS.filter((trail) => this.isUnlocked('trail', trail.id)).map((trail) => trail.id),
      },
    };
  }

  isUnlocked(kind: 'palette', id: PaletteId): boolean;
  isUnlocked(kind: 'trail', id: TrailId): boolean;
  isUnlocked(kind: 'palette' | 'trail', id: PaletteId | TrailId): boolean {
    if (kind === 'palette') {
      if (id === 'original') return true;
      if (id === 'sunset') return this.progress.collectedOrbs >= 100;
      return id === 'moonlit' && this.progress.survivedSeconds >= 600;
    }
    if (id === 'original') return true;
    if (id === 'petals') return this.progress.creditedEliminations >= 10;
    return id === 'starlight' && this.progress.completedSprintMaps.length === MAPS.length;
  }

  equipPalette(id: PaletteId): boolean {
    if (!PALETTES.some((palette) => palette.id === id) || !this.isUnlocked('palette', id)) return false;
    this.cosmetics.palette = id;
    this.save();
    return true;
  }
  equipTrail(id: TrailId): boolean {
    if (!TRAILS.some((trail) => trail.id === id) || !this.isUnlocked('trail', id)) return false;
    this.cosmetics.trail = id;
    this.save();
    return true;
  }

  beginMatch(mode: ProgressMode): void {
    this.activeMode = mode;
    this.seenEliminations.clear();
  }

  /** Call once per fixed simulation step, before its event array can be replaced. */
  recordStep(events: readonly GameEvent[], deltaSeconds: number, playerAlive: boolean): void {
    if (!this.activeMode || this.activeMode === 'practice') return;
    let changed = false;
    if (playerAlive && Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
      const previous = this.progress.survivedSeconds;
      this.progress.survivedSeconds = Math.min(600, previous + deltaSeconds);
      changed = Math.floor(previous) !== Math.floor(this.progress.survivedSeconds);
    }
    for (const event of events) {
      if (event.type === 'collect' && event.id === 0 && this.progress.collectedOrbs < 100) {
        this.progress.collectedOrbs++;
        changed = true;
      } else if (event.type === 'player-elimination' && this.progress.creditedEliminations < 10) {
        if (event.sequence !== undefined) {
          if (this.seenEliminations.has(event.sequence)) continue;
          this.seenEliminations.add(event.sequence);
        }
        this.progress.creditedEliminations++;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  /** completedSprint is true only for a timer-finished Sprint, never an early death. */
  finishMatch(mapId: MapId, completedSprint: boolean): void {
    if (this.activeMode === 'sprint' && completedSprint && mapIds.has(mapId) && !this.progress.completedSprintMaps.includes(mapId)) {
      this.progress.completedSprintMaps.push(mapId);
      this.progress.completedSprintMaps.sort((a, b) => MAPS.findIndex((map) => map.id === a) - MAPS.findIndex((map) => map.id === b));
    }
    if (this.activeMode && this.activeMode !== 'practice') this.save();
    this.activeMode = undefined;
    this.seenEliminations.clear();
  }

  private save(): void {
    try {
      this.storage?.setItem(PROGRESSION_KEY, JSON.stringify({ version: 1, progress: this.progress, cosmetics: this.cosmetics }));
    } catch {
      // Keep unlocked rewards usable for the current session when storage is unavailable.
    }
  }
}
