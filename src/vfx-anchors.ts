import type { CharacterId } from './simulation';

/** A readonly view of the head as actually drawn in this presentation frame. */
export interface RenderAnchor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angle: number;
  readonly scale: number;
  readonly clearance: number;
}

// Authored once for the four chibi silhouettes; decorative roots stay outside hair/hats.
const CLEARANCE: Record<CharacterId, number> = {
  ember: 1.24, nova: 1.27, cloud: 1.36, eclipse: 1.3,
};
export function headClearance(character: CharacterId, scale: number): number {
  return Math.min(2.25, CLEARANCE[character] * scale);
}

export function renderAnchor(character: CharacterId, x: number, y: number, z: number, angle: number, scale: number): RenderAnchor {
  return {x,y,z,angle,scale,clearance:headClearance(character, scale)};
}
/** Renderer-owned mutable cache; consumers still receive the readonly view. */
export function updateRenderAnchor(anchor: RenderAnchor, character: CharacterId, x:number,y:number,z:number,angle:number,scale:number): RenderAnchor {
  const target=anchor as { -readonly [K in keyof RenderAnchor]: RenderAnchor[K] };
  target.x=x;target.y=y;target.z=z;target.angle=angle;target.scale=scale;target.clearance=headClearance(character,scale);
  return anchor;
}
