import type { BodySkinId } from './progression';

export const SPIRITWEAVE_SIZE = 32;
export const PLAYER_MARK_INTERVAL = 6;
export const PLAYER_OUTLINE_COLOR = '#4b4448';
export const BOT_OUTLINE_COLOR = '#25232c';

export function isPlayerMarkSegment(index: number): boolean {
  return Number.isInteger(index) && index > 0 && index % PLAYER_MARK_INTERVAL === 0;
}

/** A menu-only try-on never changes the saved cosmetic selection. */
export class SkinPreviewSelection {
  private current: BodySkinId | null = null;
  get skin(): BodySkinId | null { return this.current; }
  select(skin: BodySkinId) { this.current = skin; }
  clear() { this.current = null; }
  displayed(equipped: BodySkinId): BodySkinId { return this.current ?? equipped; }
}

export interface BodySkinAppearance {
  texture: 'none' | 'spiritweave';
  emissiveColor: string;
  emissiveIntensity: number;
  outlineColor: string;
}
export function transformationCoilFinish(kind:'nine-tail'|'skybreaker') {
  return kind==='nine-tail'
    ? {base:'#ffd772',accent:'#3c3540',emissive:'#b77b28',emissiveIntensity:.2,outline:'#3b3340'}
    : {base:'#f6f3ed',accent:'#d9c9ed',emissive:'#b3a3cb',emissiveIntensity:.075,outline:'#5c5368'};
}

/** Skin overlays never replace the selected character's body palette. */
export function bodySkinAppearance(skin: BodySkinId, characterColor: string): BodySkinAppearance {
  if (skin === 'neon')
    return { texture: 'none', emissiveColor: characterColor, emissiveIntensity: 0.42, outlineColor: characterColor };
  if (skin === 'spiritweave')
    return { texture: 'spiritweave', emissiveColor: '#000000', emissiveIntensity: 0, outlineColor: PLAYER_OUTLINE_COLOR };
  return { texture: 'none', emissiveColor: '#000000', emissiveIntensity: 0, outlineColor: PLAYER_OUTLINE_COLOR };
}

/** Deterministic, tileable grayscale scale-weave texture; instance colors tint it. */
export function createSpiritweavePixels(size = SPIRITWEAVE_SIZE): Uint8Array {
  if (!Number.isInteger(size) || size < 8 || size % 8 !== 0)
    throw new RangeError('Spiritweave texture size must be a positive multiple of 8.');
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cellX = x % 8;
      const cellY = y % 8;
      const edge = cellX === 0 || cellX === 7 || cellY === 0 || cellY === 7;
      const stitch = (cellX === 3 || cellX === 4) && cellY >= 2 && cellY <= 5;
      const shade = edge ? 172 : stitch ? 252 : 218;
      const offset = (y * size + x) * 4;
      pixels[offset] = shade;
      pixels[offset + 1] = shade;
      pixels[offset + 2] = shade;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}
