import type { GameEvent } from './simulation';
type Kind = 'pickup' | 'spawn' | 'death';
interface Reaction { kind: Kind; x: number; z: number; age: number; active: boolean; boosted: boolean; direction: number }
interface Living { readonly id: number; readonly x: number; readonly z: number; readonly alive: boolean }

/** Fixed slots share the skill renderer's existing instance buffers. */
export class LifeReactions {
  readonly slots: Reaction[] = Array.from({ length: 24 }, () => ({ kind: 'pickup', x: 0, z: 0, age: 0, active: false, boosted: false, direction: 0 }));
  private known = new Set<number>();
  private seeded = false;
  reset() { this.clear(); this.known.clear(); this.seeded = false; }
  clear() { for (const s of this.slots) s.active = false; }
  private emit(kind: Kind, x: number, z: number, boosted = false, direction = 0) {
    if (kind === 'pickup' && this.slots.some(s => s.active && s.kind === kind && s.age < .12)) return;
    if (kind !== 'pickup' && this.slots.filter(s => s.active && s.kind === kind).length >= 8) return;
    const slot = this.slots.find(s => !s.active); if (!slot) return;
    slot.kind = kind; slot.x = x; slot.z = z; slot.age = 0; slot.active = true; slot.boosted = boosted; slot.direction = direction;
  }
  ingest(events: readonly GameEvent[], boosted = false, direction = 0) {
    if (events.some(e => e.type === 'nuke' || e.type === 'blast')) { this.clear(); return; }
    for (const e of events) {
      if (e.type === 'collect') this.emit('pickup', e.x, e.z, boosted, direction);
      if (e.type === 'death') this.emit('death', e.x, e.z);
    }
  }
  update(snakes: readonly Living[], dt: number, quiet: boolean) {
    if (quiet) this.clear();
    for (const slot of this.slots) if (slot.active) { slot.age += dt; if (slot.age >= .45) slot.active = false; }
    for (const s of snakes) if (s.alive && !this.known.has(s.id)) {
      if (this.seeded && !quiet && s.id !== 0) this.emit('spawn', s.x, s.z);
      this.known.add(s.id);
    }
    for (const id of this.known) if (!snakes.some(s => s.id === id && s.alive)) this.known.delete(id);
    this.seeded = true;
  }
}
