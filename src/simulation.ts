export type CharacterId = "ember" | "nova" | "cloud" | "eclipse";
export interface Character {
  id: CharacterId;
  name: string;
  title: string;
  color: string;
  secondary: string;
  power: string;
  description: string;
  cooldown: number;
  duration: number;
  symbol: string;
}
export const CHARACTERS: Character[] = [
  {
    id: "ember",
    name: "Ember Fox",
    title: "THE RESTLESS SPIRIT",
    color: "#ff9352",
    secondary: "#ffc75d",
    power: "Fox Step",
    description: "Burn brighter. Boost for 3 seconds without losing energy.",
    cooldown: 12,
    duration: 3,
    symbol: "火",
  },
  {
    id: "nova",
    name: "Nova Monk",
    title: "THE STARFORGED FIGHTER",
    color: "#58caff",
    secondary: "#ffab55",
    power: "Ki Burst",
    description: "Draw in every energy orb within 4 head diameters.",
    cooldown: 14,
    duration: 0.5,
    symbol: "星",
  },
  {
    id: "cloud",
    name: "Cloud Corsair",
    title: "THE FREEWIND DREAMER",
    color: "#ff697f",
    secondary: "#ffe198",
    power: "Elastic Turn",
    description: "Bend the rules. Double your turn speed for 3 seconds.",
    cooldown: 10,
    duration: 3,
    symbol: "風",
  },
  {
    id: "eclipse",
    name: "Eclipse Sage",
    title: "THE INFINITE MYSTIC",
    color: "#b698ff",
    secondary: "#dcf0ff",
    power: "Infinity Veil",
    description:
      "Freeze nearby rivals for 8s. Become invincible and eliminate any snake you touch. Player only.",
    cooldown: 10,
    duration: 8,
    symbol: "空",
  },
];
export const RADIUS = 115,
  HEAD_RADIUS = 1.05,
  BODY_RADIUS = 0.76,
  SPACING = 0.72,
  BASE_SPEED = 7.4,
  MIN_MASS = 18,
  STEP = 1 / 60;
// Hair, hats and aura are decorative. Keep the lethal core inside the face,
// with a small inset on the low-poly body so near misses favor the player.
export const HEAD_HIT_RADIUS = 0.78;
export const FREEZE_RADIUS = 28;
export const NUKE_COOLDOWN = 30,
  NUKE_BLAST = 3.4,
  NUKE_DURATION = 5.6;
export const MAX_SIZE = 2.5;
// Score is mass * 10. Sublinear growth keeps a high-score snake maneuverable.
export const serpentScale = (mass: number) =>
  Math.min(MAX_SIZE, Math.pow(Math.max(MIN_MASS, mass) / MIN_MASS, 0.35));
export const hasInfinity = (s: Serpent) =>
  s.id === 0 && s.alive && s.character === "eclipse" && s.active > 0;
export const bodyRadiusAt = (index: number, length: number, mass = MIN_MASS) =>
  BODY_RADIUS *
  serpentScale(mass) *
  (0.48 + 0.52 * Math.min(1, (length - index) / 7));
export const bodyHitRadiusAt = (
  index: number,
  length: number,
  mass = MIN_MASS,
) => bodyRadiusAt(index, length, mass) * 0.94;
export interface Point {
  x: number;
  z: number;
}
export interface Food extends Point {
  id: number;
  value: number;
  color: number;
}
export interface Serpent extends Point {
  id: number;
  name: string;
  character: CharacterId;
  angle: number;
  target: number;
  mass: number;
  peak: number;
  body: Point[];
  alive: boolean;
  cooldown: number;
  active: number;
  boosting: boolean;
  frozen: boolean;
  dropClock: number;
  botClock: number;
  kills: number;
  previous: Point;
  previousAngle: number;
}
export interface Input {
  nuke?: boolean;
  angle: number;
  boost: boolean;
  ability: boolean;
}
export type MatchState = "playing" | "paused" | "over";
export interface GameEvent {
  type: "collect" | "ability" | "death" | "nuke" | "blast";
  id: number;
  x: number;
  z: number;
}
export const dist2 = (a: Point, b: Point) =>
  (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
export class SpatialGrid<T extends Point> {
  cells = new Map<string, T[]>();
  constructor(public size = 6) {}
  clear() {
    this.cells.clear();
  }
  add(p: T) {
    const key = `${Math.floor(p.x / this.size)},${Math.floor(p.z / this.size)}`;
    const c = this.cells.get(key);
    if (c) c.push(p);
    else this.cells.set(key, [p]);
  }
  query(p: Point, r: number) {
    const out: T[] = [];
    for (
      let x = Math.floor((p.x - r) / this.size);
      x <= Math.floor((p.x + r) / this.size);
      x++
    )
      for (
        let z = Math.floor((p.z - r) / this.size);
        z <= Math.floor((p.z + r) / this.size);
        z++
      ) {
        const c = this.cells.get(`${x},${z}`);
        if (c) out.push(...c);
      }
    return out;
  }
}
interface BodyPoint extends Point {
  owner: number;
  radius: number;
}
const NAMES = [
  "Kitsune",
  "Moonwake",
  "Ronin",
  "Mochi",
  "Akari",
  "Daybreak",
  "Yūrei",
  "Neon Lotus",
  "Kumo",
  "Stardust",
  "Tengu",
  "Sora",
  "Hikari",
  "Red Comet",
  "Koi",
  "Shinobi",
  "Yuzu",
  "Nightfall",
  "Raijin",
  "Zen",
];
export class Arena {
  snakes: Serpent[] = [];
  food: Food[] = [];
  events: GameEvent[] = [];
  state: MatchState = "playing";
  elapsed = 0;
  nukeCooldown = 0;
  cinematic: { kind: "purple" | "spirit"; impact: { x: number; z: number }; time: number; detonated: boolean } | undefined;
  deathReason = "";
  foodGrid = new SpatialGrid<Food>(8);
  bodyGrid = new SpatialGrid<BodyPoint>(5);
  private foodId = 0;
  private nextId = 1;
  constructor(
    public selected: CharacterId = "ember",
    public random: () => number = Math.random,
    public botCount = 20,
    public foodTarget = 850,
  ) {
    this.snakes.push(this.createSnake(0, "You", selected, { x: 0, z: 0 }, 0));
    for (let i = 0; i < botCount; i++) this.spawnBot(i);
    while (this.food.length < foodTarget) this.spawnFood();
    this.reindex();
  }
  get player() {
    return this.snakes[0];
  }
  createSnake(
    id: number,
    name: string,
    character: CharacterId,
    p: Point,
    angle: number,
  ): Serpent {
    const body = Array.from({ length: MIN_MASS }, (_, i) => ({
      x: p.x - Math.cos(angle) * i * SPACING,
      z: p.z - Math.sin(angle) * i * SPACING,
    }));
    return {
      ...p,
      id,
      name,
      character,
      angle,
      target: angle,
      mass: MIN_MASS,
      peak: MIN_MASS,
      body,
      alive: true,
      cooldown: 0,
      active: 0,
      boosting: false,
      frozen: false,
      dropClock: 0,
      botClock: 0,
      kills: 0,
      previous: { ...p },
      previousAngle: angle,
    };
  }
  spawnBot(index: number) {
    index = Math.max(0, index);
    let p: Point = { x: 70, z: 0 },
      angle = 0;
    for (let tries = 0; tries < 80; tries++) {
      const a = this.random() * Math.PI * 2,
        r = 25 + this.random() * 70;
      p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
      angle = a + Math.PI;
      if (
        this.snakes.every(
          (s) => !s.alive || s.body.every((b) => dist2(b, p) > 24 ** 2),
        )
      )
        break;
    }
    const s = this.createSnake(
      this.nextId++,
      NAMES[index % NAMES.length],
      CHARACTERS[index % 4].id,
      p,
      angle,
    );
    const extra = Math.floor(this.random() * 24);
    s.mass += extra;
    s.peak = s.mass;
    for (let i = s.body.length; i < Math.floor(s.mass); i++)
      s.body.push({ ...s.body[s.body.length - 1] });
    this.snakes.push(s);
  }
  spawnFood(p?: Point, value = 1, color?: number) {
    const a = this.random() * Math.PI * 2,
      r = Math.sqrt(this.random()) * (RADIUS - 4);
    this.food.push({
      id: this.foodId++,
      x: p?.x ?? Math.cos(a) * r,
      z: p?.z ?? Math.sin(a) * r,
      value,
      color: color ?? Math.floor(this.random() * 4),
    });
  }
  reindex() {
    this.foodGrid.clear();
    for (const f of this.food) this.foodGrid.add(f);
    this.bodyGrid.clear();
    for (const s of this.snakes)
      if (s.alive)
        // Index zero is the head, not a rendered body segment. Head contacts
        // are handled separately and simultaneously for both participants.
        for (let i = 1; i < s.body.length; i++)
          this.bodyGrid.add({
            ...s.body[i],
            owner: s.id,
            radius: bodyHitRadiusAt(i, s.body.length, s.mass),
          });
  }
  activate(s: Serpent) {
    if (this.cinematic) return false;
    if (!s.alive || s.frozen || s.cooldown > 0) return false;
    if (s.character === "eclipse" && s.id !== 0) return false;
    const c = CHARACTERS.find((c) => c.id === s.character)!;
    s.cooldown = c.cooldown;
    s.active = c.duration;
    this.events.push({ type: "ability", id: s.id, x: s.x, z: s.z });
    return true;
  }
  ai(s: Serpent, dt: number): Input {
    s.botClock -= dt;
    if (s.botClock <= 0) {
      s.botClock = 0.14 + this.random() * 0.13;
      const near = this.foodGrid.query(s, 24);
      let best: Food | undefined,
        score = Infinity;
      for (const f of near) {
        const cost =
          dist2(s, f) *
          (1 + Math.abs(angleDelta(s.angle, Math.atan2(f.z - s.z, f.x - s.x))));
        if (cost < score) {
          score = cost;
          best = f;
        }
      }
      s.target = best
        ? Math.atan2(best.z - s.z, best.x - s.x)
        : s.angle + (this.random() - 0.5) * 0.8;
      // Occasionally aim across a rival's projected path, without sacrificing obstacle avoidance.
      const rival = this.snakes.find(
        (o) =>
          o.id !== s.id &&
          o.alive &&
          dist2(s, o) < 18 ** 2 &&
          dist2(s, o) > 10 ** 2,
      );
      if (rival && s.mass > 30 && this.random() < 0.13)
        s.target = Math.atan2(
          rival.z + Math.sin(rival.angle) * 8 - s.z,
          rival.x + Math.cos(rival.angle) * 8 - s.x,
        );
      let vx = Math.cos(s.target),
        vz = Math.sin(s.target);
      const look = {
        x: s.x + Math.cos(s.angle) * 5,
        z: s.z + Math.sin(s.angle) * 5,
      };
      for (const b of this.bodyGrid.query(look, 7))
        if (b.owner !== s.id) {
          const d = dist2(look, b);
          if (d < 49) {
            const w = ((49 - d) / Math.max(d, 1)) * 0.22;
            vx += (look.x - b.x) * w;
            vz += (look.z - b.z) * w;
          }
        }
      const r = Math.hypot(s.x, s.z);
      if (r > RADIUS - 20) {
        vx -= (s.x / r) * (r - (RADIUS - 20)) * 0.5;
        vz -= (s.z / r) * (r - (RADIUS - 20)) * 0.5;
      }
      s.target = Math.atan2(vz, vx);
    }
    const clear = this.bodyGrid
      .query(s, 9)
      .every((b) => b.owner === s.id || dist2(b, s) > 64);
    return {
      angle: s.target,
      boost:
        s.mass > 30 &&
        clear &&
        Math.abs(angleDelta(s.angle, s.target)) < 0.3 &&
        Math.sin(this.elapsed + s.id) > 0.82,
      ability:
        s.cooldown === 0 &&
        (s.character === "nova"
          ? this.foodGrid.query(s, 8.4).length > 5
          : s.character === "eclipse"
            ? false
            : this.random() < dt * 0.12),
    };
  }
  step(dt: number, input: Input) {
    if (this.state !== "playing") return;
    this.events = [];
    this.elapsed += dt;
    this.nukeCooldown = Math.max(0, this.nukeCooldown - dt);
    if (input.nuke) this.activateNuke(this.player);
    if (this.cinematic) {
      this.stepNuke(dt);
      return;
    }
    this.reindex();
    const living = this.snakes.filter((s) => s.alive);
    const controls = new Map<number, Input>(),
      activated = new Set<number>();
    // Resolve the player's field first so bots cannot act on its activation tick.
    const player = this.player;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.active = Math.max(0, player.active - dt);
    controls.set(0, input);
    if (input.ability && this.activate(player)) activated.add(0);
    for (const s of living) {
      s.frozen =
        s.id !== 0 &&
        player.alive &&
        player.character === "eclipse" &&
        player.active > 0 &&
        s.body.some((p) => dist2(p, player) <= FREEZE_RADIUS ** 2);
      if (s.id === 0 || s.frozen) continue;
      s.cooldown = Math.max(0, s.cooldown - dt);
      s.active = Math.max(0, s.active - dt);
      const c = this.ai(s, dt);
      controls.set(s.id, c);
      if (c.ability && this.activate(s)) activated.add(s.id);
    }
    const consumed = new Set<number>();
    for (const s of living) {
      s.previous = { x: s.x, z: s.z };
      s.previousAngle = s.angle;
      if (s.frozen) {
        s.boosting = false;
        continue;
      }
      const c = controls.get(s.id)!;
      const turn =
        2.65 * (s.character === "cloud" && s.active > 0 ? 2 : 1) * dt;
      s.angle += Math.max(-turn, Math.min(turn, angleDelta(s.angle, c.angle)));
      const free = s.character === "ember" && s.active > 0;
      s.boosting = free || (c.boost && s.mass > MIN_MASS + 0.05);
      const speed = BASE_SPEED * (s.boosting ? 1.7 : 1);
      s.x += Math.cos(s.angle) * speed * dt;
      s.z += Math.sin(s.angle) * speed * dt;
      if (hasInfinity(s)) {
        // Keep the invincible player inside the arena instead of allowing an
        // out-of-bounds position that would kill them when the power expires.
        const limit = RADIUS - HEAD_RADIUS * serpentScale(s.mass) - 0.05;
        const distance = Math.hypot(s.x, s.z);
        if (distance > limit) {
          s.x *= limit / distance;
          s.z *= limit / distance;
        }
      }
      if (s.boosting && !free) {
        const loss = Math.min(s.mass - MIN_MASS, 2.4 * dt);
        s.mass -= loss;
        s.dropClock += loss;
        if (s.dropClock >= 1) {
          s.dropClock -= 1;
          this.spawnFood(
            s.body[s.body.length - 1],
            1,
            CHARACTERS.findIndex((c) => c.id === s.character),
          );
        }
      }
      const pickup =
        (s.character === "nova" && activated.has(s.id)
          ? HEAD_RADIUS * 8
          : 1.55) * serpentScale(s.mass);
      for (const f of this.foodGrid.query(s, pickup))
        if (!consumed.has(f.id) && dist2(s, f) < pickup ** 2) {
          consumed.add(f.id);
          s.mass += f.value * 0.6;
          s.peak = Math.max(s.peak, s.mass);
          if (s.id === 0)
            this.events.push({ type: "collect", id: s.id, x: f.x, z: f.z });
        }
      s.body[0] = { x: s.x, z: s.z };
      const spacing = SPACING * serpentScale(s.mass);
      for (let i = 1; i < s.body.length; i++) {
        const prev = s.body[i - 1],
          p = s.body[i],
          dx = p.x - prev.x,
          dz = p.z - prev.z,
          d = Math.hypot(dx, dz);
        if (d > spacing) {
          p.x = prev.x + (dx / d) * spacing;
          p.z = prev.z + (dz / d) * spacing;
        }
      }
      // A bounded render/simulation length prevents unbounded memory growth in endless play.
      const length = Math.min(360, Math.floor(s.mass));
      while (s.body.length < length)
        s.body.push({ ...s.body[s.body.length - 1] });
      s.body.length = length;
    }
    this.food = this.food.filter((f) => !consumed.has(f.id));
    this.reindex();
    const dead = new Map<number, string>();
    const hitOwners = new Map<number, number>();
    if (hasInfinity(player)) {
      const targets = new SpatialGrid<BodyPoint>(5);
      for (const other of living) {
        if (other.id === 0) continue;
        targets.add({
          x: other.x,
          z: other.z,
          owner: other.id,
          radius: HEAD_HIT_RADIUS * serpentScale(other.mass),
        });
        for (let i = 1; i < other.body.length; i++)
          targets.add({
            ...other.body[i],
            owner: other.id,
            radius: bodyHitRadiusAt(i, other.body.length, other.mass),
          });
      }
      for (let i = 0; i < player.body.length; i++) {
        const point = i === 0 ? player : player.body[i];
        const radius =
          i === 0
            ? HEAD_HIT_RADIUS * serpentScale(player.mass)
            : bodyHitRadiusAt(i, player.body.length, player.mass);
        for (const target of targets.query(
          point,
          radius + HEAD_HIT_RADIUS * MAX_SIZE,
        ))
          if (dist2(point, target) < (radius + target.radius) ** 2) {
            dead.set(target.owner, "Erased by Infinity Veil.");
            hitOwners.set(target.owner, 0);
          }
      }
    }
    for (let i = 0; i < living.length; i++) {
      const s = living[i];
      if (hasInfinity(s)) continue;
      const headRadius = HEAD_HIT_RADIUS * serpentScale(s.mass);
      if (Math.hypot(s.x, s.z) > RADIUS - HEAD_RADIUS * serpentScale(s.mass))
        dead.set(s.id, "You crossed the spirit barrier.");
      for (let j = i + 1; j < living.length; j++) {
        const o = living[j];
        if (
          dist2(s, o) <
          (headRadius + HEAD_HIT_RADIUS * serpentScale(o.mass)) ** 2
        ) {
          dead.set(s.id, "Head-on clash. Both spirits fell.");
          if (!hasInfinity(o))
            dead.set(o.id, "Head-on clash. Both spirits fell.");
        }
      }
      for (const b of this.bodyGrid.query(
        s,
        headRadius + BODY_RADIUS * MAX_SIZE,
      ))
        if (b.owner !== s.id && dist2(s, b) < (headRadius + b.radius) ** 2) {
          if (!dead.has(s.id)) {
            dead.set(s.id, "Your head touched a rival’s coil.");
            hitOwners.set(s.id, b.owner);
          }
          break;
        }
    }
    for (const [id, reason] of dead) {
      const s = living.find((s) => s.id === id)!;
      s.alive = false;
      for (let i = 0; i < s.body.length; i += 2)
        this.spawnFood(
          s.body[i],
          2,
          CHARACTERS.findIndex((c) => c.id === s.character),
        );
      this.events.push({ type: "death", id, x: s.x, z: s.z });
      if (id === 0) {
        this.state = "over";
        this.deathReason = reason;
      } else if (!dead.has(0) && hitOwners.get(id) === 0) this.player.kills++;
    }
    const removed = this.snakes.filter((s) => s.id !== 0 && !s.alive);
    this.snakes = this.snakes.filter((s) => s.id === 0 || s.alive);
    for (const s of removed) this.spawnBot(NAMES.indexOf(s.name));
    while (this.food.length < this.foodTarget) this.spawnFood();
    if (this.food.length > 1600) this.food.splice(0, this.food.length - 1600);
  }
  activateNuke(s: Serpent) {
    if (
      s !== this.player ||
      (s.character !== "eclipse" && s.character !== "nova") ||
      !s.alive ||
      this.state !== "playing" ||
      this.cinematic ||
      this.nukeCooldown > 0
    )
      return false;
    this.nukeCooldown = NUKE_COOLDOWN;
    const impact = { x: s.x + Math.cos(s.angle) * 22, z: s.z + Math.sin(s.angle) * 22 };
    const reach = Math.hypot(impact.x, impact.z);
    if (reach > RADIUS - 18) { impact.x *= (RADIUS - 18) / reach; impact.z *= (RADIUS - 18) / reach; }
    this.cinematic = { impact, kind: s.character === "nova" ? "spirit" : "purple", time: 0, detonated: false };
    this.events.push({ type: "nuke", id: 0, x: s.x, z: s.z });
    return true;
  }
  private stepNuke(dt: number) {
    const shot = this.cinematic!,
      p = this.player;
    shot.time += dt;
    // Cinematic owns movement and collision resolution until recovery ends.
    // This also prevents Infinity Veil from killing the cast before the blast.
    for (const s of this.snakes) {
      s.previous = { x: s.x, z: s.z };
      s.boosting = false;
      s.frozen = s.id !== 0;
      if (s.id === 0 || !s.alive || shot.time < 1 || shot.kind === "spirit") continue;
      const pull = 1 - Math.exp(-dt * (1.1 + shot.time * 0.65));
      const dx = (p.x - s.x) * pull,
        dz = (p.z - s.z) * pull;
      s.x += dx;
      s.z += dz;
      for (const b of s.body) {
        b.x += dx;
        b.z += dz;
      }
    }
    if (!shot.detonated && shot.time >= NUKE_BLAST) {
      shot.detonated = true;
      for (const s of this.snakes) {
        if (s.id === 0 || !s.alive) continue;
        s.alive = false;
        p.kills++;
        for (let i = 0; i < s.body.length; i += 2)
          this.spawnFood(
            s.body[i],
            2,
            CHARACTERS.findIndex((c) => c.id === s.character),
          );
        this.events.push({ type: "death", id: s.id, x: s.x, z: s.z });
      }
      this.events.push({ type: "blast", id: 0, x: p.x, z: p.z });
      if (this.food.length > 1600) this.food.splice(0, this.food.length - 1600);
    }
    if (shot.time >= NUKE_DURATION) {
      this.snakes = this.snakes.filter((s) => s.alive);
      for (let i = this.snakes.length - 1; i < this.botCount; i++)
        this.spawnBot(i);
      this.cinematic = undefined;
      while (this.food.length < this.foodTarget) this.spawnFood();
      this.reindex();
    }
  }
}
