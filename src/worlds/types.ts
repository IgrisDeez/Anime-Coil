import type { MapId } from "../maps";
export type DetailProfile = "desktop" | "mobile";
export interface VisualPoint { readonly x: number; readonly y?: number; readonly z: number }
export interface EnvironmentFrame {
  readonly time: number;
  readonly dt: number;
  readonly camera: VisualPoint;
  readonly focus: VisualPoint;
  readonly mode: "menu" | "game";
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  readonly ultimate?: Readonly<{ kind: "purple" | "spirit"; time: number; origin: VisualPoint; impact: VisualPoint }>;
}
export interface WorldStats { drawCalls: number; triangles: number; materials: number; textures: number; particles: number }
export const PROFILES = {
  desktop: { particles: 220, atlas: 1024, secondary: true, crowdStep: 1, maxCalls: 120, maxTriangles: 150000 },
  mobile: { particles: 72, atlas: 512, secondary: false, crowdStep: 2, maxCalls: 80, maxTriangles: 75000 },
} as const;
export const profileFor = (width: number, coarse = false): DetailProfile => width < 760 || coarse ? "mobile" : "desktop";
// Renderer-owned visual time does not consume gameplay randomness or advance while paused.
export class VisualClock {
  time = 0;
  advance(dt: number, paused: boolean, hidden: boolean) {
    if (!paused && !hidden) this.time += Math.max(0, Math.min(dt, .1));
    return this.time;
  }
}
export function reaction(ultimate: EnvironmentFrame["ultimate"], reduced: boolean) {
  if (!ultimate || reduced) return { tint: 0, light: 1, attraction: 0, pulse: 0 };
  const t = ultimate.time, blast = Math.max(0, t - 3.4);
  const pulse = t >= 3.4 ? Math.max(0, 1 - blast / .8) : 0;
  return ultimate.kind === "purple"
    ? { tint: Math.min(.3, t * .09) * Math.max(0, 1 - blast / 2.2), light: 1 + pulse * .2, attraction: 0, pulse }
    : { tint: 0, light: t < 3.4 ? 1 - Math.min(.18, t * .07) : 1 + pulse * .22, attraction: t < 2.4 ? Math.min(1,t / 2.4) : 0, pulse };
}
export const particleColor: Record<MapId, string> = { shibuya: "#9cabd5", leaf: "#cf995e", tournament: "#bcaa83", harbor: "#eef4dc" };
