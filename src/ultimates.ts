import type { CharacterId } from './simulation';

export type CinematicKind = 'purple' | 'spirit' | 'fox' | 'skybreaker';
export type UltimateId = CinematicKind;

interface UltimateBase {
  readonly character: CharacterId;
  readonly name: string;
  readonly glyph: string;
  readonly duration: number;
  readonly cooldown: number;
}
export type UltimateDefinition = UltimateBase & { readonly id: CinematicKind; readonly mode: 'cinematic' };

export const ULTIMATE_COOLDOWN = 30;

export const ULTIMATES: Readonly<Record<CharacterId, UltimateDefinition>> = {
  eclipse: { character: 'eclipse', id: 'purple', mode: 'cinematic', name: 'Hollow Purple', glyph: '炸裂！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
  nova: { character: 'nova', id: 'spirit', mode: 'cinematic', name: 'Spirit Bomb', glyph: '衝撃！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
  ember: { character: 'ember', id: 'fox', mode: 'cinematic', name: 'Fox Spirit Bomb', glyph: '尾獣玉！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
  cloud: { character: 'cloud', id: 'skybreaker', mode: 'cinematic', name: 'Skybreaker Slam', glyph: 'ドン！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
};

export const ultimateFor = (character: CharacterId): UltimateDefinition => ULTIMATES[character];
