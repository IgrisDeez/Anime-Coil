import type { GameEvent } from './simulation';
import type { GameRenderer } from './renderer';
import type { PresentationFrame } from './presentation';

export const STAMP_DURATION = .8;
export const STAMP_CAPACITY = 24;

export interface EliminationStamp {
  active: boolean;
  id: number;
  x: number;
  z: number;
  age: number;
  compact: boolean;
  angle: number;
}

export function stampPose(stamp: Readonly<EliminationStamp>, reduced: boolean) {
  const progress = Math.min(1, stamp.age / STAMP_DURATION);
  const scale = reduced ? 1 : stamp.age < .12
    ? .65 + .45 * Math.sin(stamp.age / .12 * Math.PI / 2)
    : stamp.age < .25 ? 1.1 - .1 * (stamp.age - .12) / .13 : 1;
  return {
    scale: scale * (stamp.compact ? .68 : 1),
    angle: reduced ? 0 : stamp.angle,
    drift: reduced ? 0 : progress * (stamp.compact ? 8 : 16),
    opacity: stamp.age < .42 ? 1 : Math.max(0, (STAMP_DURATION - stamp.age) / .38),
    ring: reduced ? 1 : .55 + Math.min(1,stamp.age/.34)*1.25,
    ringOpacity: reduced ? .25 : Math.max(0,1-stamp.age/.42)*.75,
    slash: reduced ? 1 : Math.min(1,stamp.age/.13),
    flecks: reduced ? 0 : Math.min(1,stamp.age/.35)*20,
  };
}

/** Keep a confirmed kill close to its location, or hide it when HUD would cover it. */
export function stampVisibleAt(x:number,y:number,width:number,height:number) {
  if(x<56||x>width-56||y<54||y>height-70)return false;
  if(y<Math.min(195,height*.27)&&(x<Math.min(210,width*.24)||x>width-Math.min(235,width*.25)))return false;
  if(y<80&&Math.abs(x-width/2)<90)return false;
  if(y>height-Math.min(155,height*.22)&&(x<Math.min(190,width*.25)||x>width-Math.min(275,width*.32)))return false;
  return true;
}

/** Fixed-size, presentation-only state. Event sequences prevent duplicate ingestion. */
export class EliminationStampState {
  readonly slots: EliminationStamp[] = Array.from({ length: STAMP_CAPACITY }, () => ({
    active: false, id: -1, x: 0, z: 0, age: 0, compact: false, angle: 0,
  }));
  private seen = new Set<number>();
  private seenOrder: number[] = [];

  ingest(events: readonly GameEvent[]) {
    const victims = new Set<number>();
    for(const event of events)if(event.type==='player-elimination'&&event.sequence!==undefined&&!this.seen.has(event.sequence))victims.add(event.id);
    const killCount=victims.size;
    if (!killCount) return 0;
    const compact = killCount > 3;
    let added = 0;
    const batchVictims=new Set<number>();
    for (const event of events) {
      if (event.type !== 'player-elimination' || event.sequence === undefined) continue;
      const sequence = event.sequence!;
      if (this.seen.has(sequence)) continue;
      this.seen.add(sequence);
      this.seenOrder.push(sequence);
      if (this.seenOrder.length > 128) this.seen.delete(this.seenOrder.shift()!);
      if(batchVictims.has(event.id))continue;
      batchVictims.add(event.id);
      const slot = this.slots.find(s => !s.active) ?? this.slots.reduce((a, b) => a.age > b.age ? a : b);
      slot.active = true;
      slot.id = event.id;
      slot.x = event.x;
      slot.z = event.z;
      slot.age = 0;
      slot.compact = compact;
      slot.angle = ((event.id * 37 % 23) - 11) * (compact ? .35 : .8);
      added++;
    }
    return added;
  }

  update(dt: number) {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += Math.max(0, dt);
      if (slot.age >= STAMP_DURATION) slot.active = false;
    }
  }

  clear() {
    for (const slot of this.slots) slot.active = false;
    this.seen.clear();
    this.seenOrder.length = 0;
  }
}

export class EliminationStampView {
  readonly state = new EliminationStampState();
  private nodes: HTMLDivElement[];
  private points = Array.from({ length: STAMP_CAPACITY }, () => ({ x: 0, y: 0 }));

  constructor(private root: HTMLElement) {
    this.nodes = this.state.slots.map(() => {
      const node = document.createElement('div');
      node.className = 'ko-stamp';
      node.innerHTML = '<span class="ko-ring"></span><span class="ko-slash"></span><span class="ko-paper"><strong lang="ja">撃破！</strong><small>KO</small></span><span class="ko-fleck ko-fleck-a"></span><span class="ko-fleck ko-fleck-b"></span><span class="ko-fleck ko-fleck-c"></span>';
      node.hidden = true;
      root.append(node);
      return node;
    });
  }

  ingest(events: readonly GameEvent[]) {
    if (events.some(e => e.type === 'nuke')) this.clear();
    return this.state.ingest(events);
  }

  setAccent(color:string){this.root.style.setProperty('--ko-accent',color);}

  draw(renderer: GameRenderer, frame: Readonly<PresentationFrame>) {
    this.state.update(frame.dt);
    const width = innerWidth, height = innerHeight;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i], stamp = this.state.slots[i], point = this.points[i];
      if (!stamp.active || !renderer.projectPoint(stamp.x, stamp.z, point) || !stampVisibleAt(point.x,point.y,width,height)) { node.hidden = true; continue; }
      node.hidden = false;
      node.classList.toggle('compact', stamp.compact);
      node.classList.toggle('reduced', frame.reducedMotion);
      const pose = stampPose(stamp, frame.reducedMotion);
      node.style.left = `${point.x}px`;
      node.style.top = `${point.y-14}px`;
      node.style.opacity = String(pose.opacity);
      node.style.transform = `translate(-50%, -50%) translateY(${-pose.drift}px) rotate(${pose.angle}deg) scale(${pose.scale})`;
      node.style.setProperty('--ko-ring-scale',String(pose.ring));
      node.style.setProperty('--ko-ring-opacity',String(pose.ringOpacity));
      node.style.setProperty('--ko-slash',String(pose.slash));
      node.style.setProperty('--ko-flecks',`${pose.flecks}px`);
    }
  }

  clear() {
    this.state.clear();
    for (const node of this.nodes) node.hidden = true;
  }

  dispose() { this.clear(); this.root.replaceChildren(); }
}
