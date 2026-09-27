import type { CharacterId } from './simulation';

export type UltimateId = 'purple' | 'spirit' | 'nine-tail' | 'skybreaker';
export type UltimateMode = 'cinematic' | 'transformation';

export interface UltimateDefinition {
  readonly character: CharacterId;
  readonly id: UltimateId;
  readonly mode: UltimateMode;
  readonly name: string;
  readonly glyph: string;
  readonly duration: number;
  readonly cooldown: number;
}

export const ULTIMATE_COOLDOWN = 30;
export const TRANSFORMATION_DURATION = 8;
export const SKY_PUNCH_FIRST = 0.35;
export const SKY_PUNCH_INTERVAL = 0.65;
export const SKY_PUNCH_RANGE = 18;
export const SKY_PUNCH_SPEED = 46;
export const SKY_PUNCH_RADIUS = 1.1;

export const ULTIMATES: Readonly<Record<CharacterId, UltimateDefinition>> = {
  eclipse: { character: 'eclipse', id: 'purple', mode: 'cinematic', name: 'Hollow Purple', glyph: '炸裂！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
  nova: { character: 'nova', id: 'spirit', mode: 'cinematic', name: 'Spirit Bomb', glyph: '衝撃！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
  ember: { character: 'ember', id: 'nine-tail', mode: 'transformation', name: 'Nine-Tail Cloak', glyph: '九尾！', duration: TRANSFORMATION_DURATION, cooldown: ULTIMATE_COOLDOWN },
  cloud: { character: 'cloud', id: 'skybreaker', mode: 'transformation', name: 'Skybreaker Barrage', glyph: '連打！', duration: TRANSFORMATION_DURATION, cooldown: ULTIMATE_COOLDOWN },
};

export const ultimateFor = (character: CharacterId): UltimateDefinition => ULTIMATES[character];
