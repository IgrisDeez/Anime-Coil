import { HudMotion } from './presentation';

export class HudChanges {
  private score?: number;
  private rank?: number;
  private skillCooling = false;
  private ultimateCooling = false;
  reset() { this.score = this.rank = undefined; this.skillCooling = this.ultimateCooling = false; }
  update(score: number, rank: number, skillCooldown: number, ultimateCooldown: number, playing: boolean) {
    const result = {
      score: this.score !== undefined && score > this.score,
      rank: this.rank !== undefined && rank !== this.rank,
      skillReady: playing && this.skillCooling && skillCooldown <= 0,
      ultimateReady: playing && this.ultimateCooling && ultimateCooldown <= 0,
    };
    this.score = score; this.rank = rank;
    // Pausing must not consume a pending readiness transition.
    if (playing) { this.skillCooling = skillCooldown > 0; this.ultimateCooling = ultimateCooldown > 0; }
    return result;
  }
}

export interface Leader { readonly id: number; readonly name: string; readonly mass: number }
interface Row { node: HTMLElement; rank: HTMLElement; name: HTMLElement; score: HTMLElement; index: number }
export const setText = (node: HTMLElement, text: string) => { if (node.textContent !== text) node.textContent = text; };

/** Only changed text/order is touched; surviving IDs retain their DOM nodes. */
export class Leaderboard {
  private rows = new Map<number, Row>();
  constructor(private root: HTMLElement, private motion: HudMotion) { }
  update(leaders: readonly Leader[]) {
    const top = leaders.slice(0, 5);
    for (const [id, row] of this.rows) if (!top.some(s => s.id === id)) {
      this.motion.forget(row.node); row.node.remove(); this.rows.delete(id);
    }
    for (let i = 0; i < top.length; i++) {
      const s = top[i]; let row = this.rows.get(s.id);
      if (!row) {
        const doc = this.root.ownerDocument;
        const node = doc.createElement('div'), rank = doc.createElement('span'), name = doc.createElement('b'), score = doc.createElement('span');
        node.className = `leader-row${s.id === 0 ? ' you' : ''}`;
        node.append(rank, name, score);
        row = { node, rank, name, score, index: i }; this.rows.set(s.id, row);
      }
      setText(row.rank, String(i + 1)); setText(row.name, s.name); setText(row.score, String(Math.floor(s.mass * 10)));
      if (this.root.children[i] !== row.node) this.root.insertBefore(row.node, this.root.children[i] ?? null);
      if (row.index !== i) this.motion.animate(row.node, [{ opacity: .65 }, { opacity: 1 }], 200);
      row.index = i;
    }
  }
  clear() { for (const row of this.rows.values()) { this.motion.forget(row.node); row.node.remove(); } this.rows.clear(); }
}
