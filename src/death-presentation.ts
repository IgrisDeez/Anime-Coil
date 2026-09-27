export interface DeathPresentationFrame {
  dead: boolean;
  visible: boolean;
  fading: boolean;
  seconds: number;
  secondChanged: boolean;
  flash: number;
  opacity: number;
  offsetY: number;
}

/** Presentation follows the simulation's respawn timer and shared pause-aware clock. */
export class DeathPresentation {
  private wasAlive = true;
  private lastSecond = 0;
  private fadeRemaining = 0;
  private enterRemaining = 0;
  private flashRemaining = 0;
  private visible = false;

  reset(alive = true) {
    this.wasAlive = alive;
    this.lastSecond = 0;
    this.fadeRemaining = 0;
    this.enterRemaining = 0;
    this.flashRemaining = 0;
    this.visible = false;
  }

  update(alive: boolean, respawnRemaining: number, dt: number, paused: boolean, reduced = false): DeathPresentationFrame {
    let secondChanged = false;
    if (this.wasAlive && !alive) {
      this.visible = true;
      this.fadeRemaining = 0;
      this.enterRemaining = .2;
      this.flashRemaining = .75;
    } else if (!this.wasAlive && alive) {
      this.visible = true;
      this.enterRemaining = 0;
      this.fadeRemaining = .48;
    }
    const seconds = alive ? 0 : Math.max(0, Math.ceil(respawnRemaining));
    if (!alive && seconds !== this.lastSecond) {
      this.lastSecond = seconds;
      secondChanged = true;
    }
    if (!paused && dt > 0) {
      this.flashRemaining = Math.max(0, this.flashRemaining - dt);
      this.enterRemaining = Math.max(0, this.enterRemaining - dt);
      if (alive && this.fadeRemaining > 0) {
        this.fadeRemaining = Math.max(0, this.fadeRemaining - dt);
        if (this.fadeRemaining === 0) this.visible = false;
      }
    }
    this.wasAlive = alive;
    const opacity = !alive ? 1 - this.enterRemaining / .2 : this.fadeRemaining / .48;
    return {
      dead: !alive,
      visible: this.visible,
      fading: alive && this.fadeRemaining > 0,
      seconds,
      secondChanged,
      flash: this.flashRemaining / .75,
      opacity: Math.max(0, Math.min(1, opacity)),
      offsetY: !this.visible || reduced ? 0 : alive ? -5 * (1 - this.fadeRemaining / .48) : 8 * this.enterRemaining / .2,
    };
  }
}
