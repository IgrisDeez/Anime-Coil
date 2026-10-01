import { RESPAWN_DELAY, SPRINT_DURATION, type MatchMode } from './simulation';

export const MODE_HINTS = {
  endless: 'No time limit · Respawns',
  sprint: '3 minutes · Highest energy',
  bounty: '3 minutes · Earn bounty points',
} as const;
export const MODE_DESCRIPTIONS: Record<MatchMode, string> = {
  endless: `Play without a time limit. Collect orbs to grow and compete for the highest energy. After a crash, respawn in ${RESPAWN_DELAY} seconds if there is clear space.`,
  sprint: `Play for ${SPRINT_DURATION / 60} minutes. Your record uses your highest energy, then eliminations and time played to break ties. Crashes reset your size; you respawn while time remains.`,
  bounty: `Play for ${SPRINT_DURATION / 60} minutes. Natural orbs earn 1 point and 1 ultimate charge. Direct eliminations earn 100 points and 20 charge; eliminating the marked target adds 200 points and 15 charge. Ultimates require 100 charge and a ready cooldown. Ultimate eliminations earn no points or charge. Crashing halves your charge; you respawn while time remains.`,
  practice: 'Practice steering, collecting orbs, boosting, and using your skill without opponents. Practice does not count toward records or challenges.',
};
export function deathDescription(reason: string): string {
  return reason.replace('You crossed the spirit barrier.', 'You crossed the arena boundary.')
    .replace('Head-on clash. Both spirits fell.', 'You collided head-on with another snake.');
}
