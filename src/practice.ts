import { angleDelta, type GameEvent } from './simulation';

export const PRACTICE_STEPS = [
  'Turn with your mouse or joystick.',
  'Collect five glowing energy orbs.',
  'Hold Boost for one second.',
  'Use your E skill once.',
  'You’re ready for the arena!',
] as const;

/** A presentation-only guide. The Arena remains responsible for movement and pickups. */
export class PracticeGuide {
  step = 0;
  pickups = 0;
  boostTime = 0;
  turn = 0;
  private previousAngle: number | undefined;
  private usedAbility = false;

  update(dt: number, player: Readonly<{ angle: number; boosting: boolean; alive: boolean }>, events: readonly GameEvent[]) {
    if (!player.alive || this.step === 4 || dt <= 0) return;
    if (this.previousAngle !== undefined && this.step === 0)
      this.turn += Math.abs(angleDelta(this.previousAngle, player.angle));
    this.previousAngle = player.angle;
    this.pickups += events.filter(e => e.type === 'collect' && e.id === 0).length;
    if (events.some(e => e.type === 'ability' && e.id === 0)) this.usedAbility = true;
    if (this.step === 2 && player.boosting) this.boostTime += dt;
    if (this.step === 0 && this.turn >= .75) this.step++;
    else if (this.step === 1 && this.pickups >= 5) this.step++;
    else if (this.step === 2 && this.boostTime >= 1) this.step++;
    else if (this.step === 3 && this.usedAbility) this.step++;
  }

  skip() { this.step = Math.min(4, this.step + 1); }
  get complete() { return this.step === 4; }
  get label() { return PRACTICE_STEPS[this.step]; }
  get detail() {
    return this.step === 0 ? 'Turn about halfway around.'
      : this.step === 1 ? `${Math.min(5, this.pickups)} / 5 orbs`
      : this.step === 2 ? `${Math.min(1, this.boostTime).toFixed(1)} / 1.0 sec`
      : this.step === 3 ? 'Press E or tap your skill.' : 'Choose a spirit whenever you like.';
  }
}
