import type { CharacterId } from './simulation';

export type CinematicKind = 'purple' | 'spirit' | 'fox' | 'skybreaker';
export type UltimateId = CinematicKind;

interface UltimateBase {
  readonly character: CharacterId;
  readonly name: string;
  readonly glyph: string;
  readonly description: string;
  readonly duration: number;
  readonly cooldown: number;
}
export type UltimateDefinition = UltimateBase & { readonly id: CinematicKind; readonly mode: 'cinematic' };

export const ULTIMATE_COOLDOWN = 30;

export const ULTIMATES: Readonly<Record<CharacterId, UltimateDefinition>> = {
  eclipse: { character: 'eclipse', description: 'Pull in all opponents, then eliminate them with Hollow Purple. You are protected during the attack; bots respawn afterward.', id: 'purple', mode: 'cinematic', name: 'Hollow Purple', glyph: '炸裂！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
  nova: { character: 'nova', description: 'Freeze all opponents and fire a Spirit Bomb that eliminates them. You are protected during the attack; bots respawn afterward.', id: 'spirit', mode: 'cinematic', name: 'Spirit Bomb', glyph: '衝撃！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
  ember: { character: 'ember', description: 'Summon a fox to fire a bomb that eliminates all opponents. Opponents freeze during the attack. You are protected; bots respawn afterward.', id: 'fox', mode: 'cinematic', name: 'Fox Spirit Bomb', glyph: '尾獣玉！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
  cloud: { character: 'cloud', description: 'Transform and strike the arena with a giant fist, eliminating all opponents. Opponents freeze during the attack. You are protected; bots respawn afterward.', id: 'skybreaker', mode: 'cinematic', name: 'Skybreaker Slam', glyph: 'ドン！', duration: 5.6, cooldown: ULTIMATE_COOLDOWN },
};

export const ultimateFor = (character: CharacterId): UltimateDefinition => ULTIMATES[character];
