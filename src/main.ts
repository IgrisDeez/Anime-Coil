import { abilityFeedback } from "./ability-feedback";
import "./style.css";
import {
  Arena,
  CHARACTERS,
  RADIUS,
  STEP,
  NUKE_BLAST,
  NUKE_COOLDOWN,
  type CharacterId,
} from "./simulation";
import { GameRenderer } from "./renderer";
import { AudioEngine } from "./audio";
import { loadAudio, saveAudio, type AudioChannel } from "./audio-settings";
import {
  MAPS,
  getMap,
  loadMap,
  saveMap,
  type MapId,
  type MapStorage,
} from "./maps";
import { ui } from "./ui";
import { installWorldDiagnostics } from "./worlds/diagnostics";
document.querySelector<HTMLDivElement>("#app")!.innerHTML = ui;
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>("world");
let view: GameRenderer;
const audio = new AudioEngine();
let selected: CharacterId = "ember",
  arena: Arena | undefined,
  screen: "menu" | "game" = "menu";
let best = 0;
let mapStorage: MapStorage | undefined;
try {
  mapStorage = localStorage;
} catch {}
audio.prefs = loadAudio(mapStorage);
let selectedMap: MapId = loadMap(mapStorage);
function chooseMap(id: MapId, persist = true) {
  selectedMap = id;
  view.setMap(id);
  const m = getMap(id);
  document
    .querySelectorAll<HTMLButtonElement>(".map-card")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.map === id)),
    );
  el("map-preview-name").textContent = m.name;

  el("hud-map").textContent = m.name;
  if (persist) {
    saveMap(id, mapStorage);
    audio.unlock();
    audio.play("select");
  }
}
document
  .querySelectorAll<HTMLButtonElement>(".map-card")
  .forEach((b) => (b.onclick = () => chooseMap(b.dataset.map as MapId)));
try {
  best = Math.max(0, Number(localStorage.getItem("anime-coil-best")) || 0);
} catch {
  /* Private browsing can disable storage. */
}
el("best-score").textContent = String(best);
let mouse = { x: innerWidth * 0.7, y: innerHeight * 0.5 },
  boostKey = false,
  boostPointer = false,
  abilityQueued = false,
  nukeQueued = false,
  touchAngle: number | undefined,
  joystickPointer: number | undefined;
let accumulator = 0,
  last = performance.now(),
  hudClock = 0,
  toastUntil = 0;
function clearInput() {
  clearSkillVisual();
  boostKey = false;
  boostPointer = false;
  abilityQueued = false;
  nukeQueued = false;
  touchAngle = undefined;
  joystickPointer = undefined;
  el("stick").style.transform = "";
}
let skillVisualRemaining = 0;
const skillVisuals = {
  ember: ["シュンッ", "狐ラッシュ！", "#e98340"],
  nova: ["ドンッ", "気砲！", "#efa83f"],
  cloud: ["ビヨーン", "ゴムツイスト！", "#e26a63"],
  eclipse: ["キィーン", "無限バリア！", "#8595ed"],
  purple: ["ゴゴゴ…", "ホロウ・パープル！", "#ac79ee"],
  spirit: ["ゴゴゴ…", "元気玉！", "#65c6e8"],
  blast: ["ドォォン！", "", "#edbc69"],
} as const;
function clearSkillVisual() {
  skillVisualRemaining = 0;
  el("skill-visual").hidden = true;
}
function showSkillVisual(skill: keyof typeof skillVisuals) {
  el("toast").classList.remove("visible");
  toastUntil = 0;
  const [text, label, color] = skillVisuals[skill];
  const node = el("skill-visual");
  el("skill-japanese").textContent = text;
  el("skill-label").textContent = label;
  node.style.setProperty("--skill-color", color);
  node.hidden = false;
  node.classList.remove("pop");
  void node.offsetWidth;
  node.classList.add("pop");
  skillVisualRemaining = skill === "blast" ? 1.8 : 1.6;
}
function showToast(text: string, duration = 2600) {
  el("toast").textContent = text;
  toastUntil = performance.now() + duration;
  el("toast").classList.add("visible");
}
function updateSound() {
  document.querySelectorAll<HTMLButtonElement>(".sound-toggle").forEach((b) => {
    b.textContent = audio.enabled ? "Sound on  ♫" : "Sound off  ♪";
    b.setAttribute("aria-label", audio.enabled ? "Mute sound" : "Enable sound");
    b.setAttribute("aria-pressed", String(audio.enabled));
    b.style.opacity = audio.enabled ? "1" : ".5";
  });
}
document.querySelectorAll(".sound-toggle").forEach((b) =>
  b.addEventListener("click", () => {
    audio.unlock();
    audio.enabled = !audio.enabled;
    saveAudio(audio.prefs, mapStorage);
    updateSound();
  }),
);
updateSound();
for (const channel of ["effects", "voices"] as AudioChannel[]) {
  const slider = el<HTMLInputElement>(`volume-${channel}`);
  slider.value = String(Math.round(audio.prefs[channel] * 100));
  el(`value-${channel}`).textContent = `${slider.value}%`;
  slider.addEventListener("input", () => {
    audio.unlock();
    audio.setVolume(channel, Number(slider.value) / 100);
    el(`value-${channel}`).textContent = `${slider.value}%`;
    saveAudio(audio.prefs, mapStorage);
  });
}
for (const name of ["help", "settings", "credits"]) {
  const dialog = el<HTMLDialogElement>(`${name}-dialog`);
  let opener: HTMLElement | undefined;
  document.querySelectorAll<HTMLElement>(`.${name}-open`).forEach(
    (button) =>
      (button.onclick = () => {
        opener = button;
        if (arena?.state === "playing") pause();

        audio.unlock();
        dialog.showModal();
        if (name === "settings")
          el("audio-note").textContent = audio.missingClips.size
            ? "Some callouts could not load. The game is still ready to play."
            : "Sound effects and Japanese skill voices. No background music.";
      }),
  );
  dialog.querySelector<HTMLButtonElement>(".close-button")!.onclick = () =>
    dialog.close();
  dialog.addEventListener("close", () => {
    opener?.focus();

  });
}
el("voice-preview").onclick = () => {
  audio.unlock();
  audio.skill(selected);
};
window.addEventListener("pointerdown", () => audio.unlock(), { once: true });
window.addEventListener("keydown", () => audio.unlock(), { once: true });
function choose(id: CharacterId) {
  selected = id;
  const c = CHARACTERS.find((c) => c.id === id)!;
  view.setHero(id);
  document
    .querySelectorAll<HTMLButtonElement>(".character")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.character === id)),
    );
  el("power-name").textContent = c.power;
  el("hero-name").textContent = c.name;
  el("purple-badge").hidden = id !== "eclipse" && id !== "nova";
  el("ultimate-badge-name").textContent = id === "nova" ? "Spirit Bomb" : "Hollow Purple";
  audio.unlock();
  audio.play("select");
}
document
  .querySelectorAll<HTMLButtonElement>(".character")
  .forEach((b) =>
    b.addEventListener("click", () =>
      choose(b.dataset.character as CharacterId),
    ),
  );
function start() {
  arena = new Arena(selected);
  screen = "game";
  accumulator = 0;
  last = performance.now();
  clearInput();
  mouse = { x: innerWidth * 0.75, y: innerHeight * 0.5 };
  view.start(arena);
  el("menu").hidden = true;
  el("nuke").hidden = selected !== "eclipse" && selected !== "nova";
  el("ultimate-name").textContent = selected === "nova" ? "Spirit Bomb" : "Hollow Purple";
  el("hud").hidden = false;
  el("results").hidden = true;
  el("pause-modal").hidden = true;
  el("ability-name").textContent = CHARACTERS.find(
    (c) => c.id === selected,
  )!.power;
  audio.unlock();
  audio.resetTransient();
  audio.play("select");
  showToast("Gather energy. Watch your head!", 2600);
  updateHUD();
  canvas.focus();
}
function saveBest() {
  if (!arena) return;
  best = Math.max(best, Math.floor(arena.player.peak * 10));
  try {
    localStorage.setItem("anime-coil-best", String(best));
  } catch {}
  el("best-score").textContent = String(best);
}
function menu() {
  saveBest();
  audio.resetTransient();
  screen = "menu";
  arena = undefined;
  view.mode = "menu";
  view.clearEffects();
  clearInput();
  el("menu").hidden = false;
  el("hud").hidden = true;
  el("pause-modal").hidden = true;
  el("results").hidden = true;
  el("play").focus();
}
function pause() {
  if (!arena || arena.state !== "playing") return;
  arena.state = "paused";
  audio.resetTransient();
  clearInput();
  el("pause-modal").hidden = false;
  el("resume").focus();
}
function resume() {
  if (!arena || arena.state !== "paused") return;
  arena.state = "playing";
  accumulator = 0;
  last = performance.now();
  el("pause-modal").hidden = true;

  canvas.focus();
}
el("play").onclick = start;
el("restart").onclick = start;
el("change").onclick = menu;
el("quit").onclick = menu;
el("pause").onclick = pause;
el("resume").onclick = resume;
el("reload").onclick = () => location.reload();
canvas.tabIndex = 0;
window.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return;
  if (e.code === "Tab") {
    const modal = document.querySelector<HTMLElement>(".modal:not([hidden])");
    if (modal) {
      const buttons = Array.from(
        modal.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  if (e.code === "Escape") {
    e.preventDefault();
    if (arena?.state === "paused") resume();
    else pause();
    return;
  }
  if (screen !== "game" || arena?.state !== "playing") return;
  if (e.code === "Space") {
    e.preventDefault();
    boostKey = true;
  }
  if (e.code === "KeyE" && !e.repeat) abilityQueued = true;
  if (e.code === "KeyV" && !e.repeat) {
    e.preventDefault();
    nukeQueued = true;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") boostKey = false;
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") mouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerdown", (e) => {
  if (screen !== "game") return;
  audio.unlock();
  if (e.button === 2) abilityQueued = true;
  else if (e.pointerType === "mouse") {
    boostPointer = true;
    canvas.setPointerCapture(e.pointerId);
  }
});
window.addEventListener("pointerup", () => {
  boostPointer = false;
});
window.addEventListener("pointercancel", () => {
  boostPointer = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
el("ability").onclick = () => {
  if (arena?.state === "playing") abilityQueued = true;
};
el("nuke").onclick = () => {
  audio.unlock();
  if (arena?.state === "playing") nukeQueued = true;
};
el("boost").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  boostPointer = true;
  el("boost").setPointerCapture(e.pointerId);
});
const joystick = el("joystick");
function stickMove(e: PointerEvent) {
  if (e.pointerId !== joystickPointer) return;
  const r = joystick.getBoundingClientRect(),
    dx = e.clientX - r.left - r.width / 2,
    dy = e.clientY - r.top - r.height / 2;
  const d = Math.hypot(dx, dy),
    scale = Math.min(30, d) / Math.max(1, d);
  el("stick").style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
  if (d > 7) touchAngle = Math.atan2(dy * 1.18, dx);
}
joystick.addEventListener("pointerdown", (e) => {
  joystickPointer = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  stickMove(e);
});
joystick.addEventListener("pointermove", stickMove);
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  joystick.addEventListener(event, () => {
    joystickPointer = undefined;
    touchAngle = undefined;
    el("stick").style.transform = "";
  });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
  audio.setHidden(document.hidden);
});
window.addEventListener("blur", pause);
window.addEventListener("resize", () => view?.resize());
const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function updateHUD() {
  if (!arena) return;
  const p = arena.player,
    c = CHARACTERS.find((c) => c.id === p.character)!;
  el("score").textContent = Math.floor(p.mass * 10).toLocaleString();
  el("time").textContent = timeLabel(arena.elapsed);
  const ranking = [...arena.snakes]
    .filter((s) => s.alive)
    .sort((a, b) => b.mass - a.mass);
  el("rank").textContent = p.alive ? `#${ranking.indexOf(p) + 1}` : "—";
  el("population").textContent = String(ranking.length);
  el("leaders").innerHTML = ranking
    .slice(0, 5)
    .map(
      (s, i) =>
        `<div class="leader-row ${s.id === 0 ? "you" : ""}"><span>${i + 1}</span><b>${s.name}</b><span>${Math.floor(s.mass * 10)}</span></div>`,
    )
    .join("");
  const feedback = abilityFeedback(p, !!arena.cinematic, arena.state === "playing");
  el("ability-status").textContent = feedback.label;
  el("cool-fill").style.width = `${feedback.progress * 100}%`;
  const button = el<HTMLButtonElement>("ability");
  button.disabled = feedback.disabled;
  button.dataset.state = feedback.state;
  button.setAttribute("aria-label", `${c.power}: ${feedback.label}`);
  el<HTMLButtonElement>("nuke").disabled =
    arena.nukeCooldown > 0 || !!arena.cinematic;
  el("nuke-status").textContent = arena.cinematic
    ? "Unleashing…"
    : arena.nukeCooldown > 0
      ? `${arena.nukeCooldown.toFixed(1)}s`
      : "Ready";
  el("nuke-fill").style.width =
    `${(1 - arena.nukeCooldown / NUKE_COOLDOWN) * 100}%`;
  el("boost").style.borderColor = p.boosting ? "#ff8067" : "#ffffff20";
  const ctx = el<HTMLCanvasElement>("minimap").getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 240, 240);
    ctx.strokeStyle = "#7d8c7855";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(120, 120, 114, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 120);
    ctx.lineTo(234, 120);
    ctx.moveTo(120, 6);
    ctx.lineTo(120, 234);
    ctx.stroke();
    for (const s of arena.snakes) {
      if (!s.alive) continue;
      ctx.fillStyle =
        s.id === 0
          ? "#554936"
          : CHARACTERS.find((c) => c.id === s.character)!.color;
      ctx.beginPath();
      ctx.arc(
        120 + (s.x / RADIUS) * 112,
        120 + (s.z / RADIUS) * 112,
        s.id === 0 ? 5 : 2.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
}
function gameOver() {
  saveBest();
  audio.stopVoices();
  clearInput();
  el("death-reason").textContent = arena!.deathReason;
  el("result-score").textContent = String(Math.floor(arena!.player.peak * 10));
  el("result-time").textContent = timeLabel(arena!.elapsed);
  el("result-kills").textContent = String(arena!.player.kills);
  el("results").hidden = false;
  el("restart").focus();
}
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  accumulator += dt;
  if (arena?.state === "playing") {
    while (accumulator >= STEP) {
      const angle =
        touchAngle ??
        (matchMedia("(pointer:coarse)").matches
          ? arena.player.angle
          : view.steering(mouse.x, mouse.y, arena));
      arena.step(STEP, {
        angle,
        boost: boostKey || boostPointer,
        ability: abilityQueued,
        nuke: nukeQueued,
      });
      abilityQueued = false;
      nukeQueued = false;
      accumulator -= STEP;
      skillVisualRemaining = Math.max(0, skillVisualRemaining - STEP);
      if (!skillVisualRemaining) clearSkillVisual();
      view.handleEvents(arena.events);
      for (const event of arena.events) {
        if (event.type === "ki-launch" || event.type === "ki-impact") {
          if (event.id === 0 || event.targetId === 0) audio.cannon(event.type === "ki-launch" ? "fire" : "impact");
          continue;
        }
        if (event.id === 0) {
          if (event.type === "ability" || event.type === "nuke") {
            const ultimate = event.type === "nuke" ? arena.cinematic?.kind : undefined;
            audio.skill(selected, ultimate);
            if (event.type === "ability" && !matchMedia("(prefers-reduced-motion: reduce)").matches)
              el("ability").animate([{transform:"scale(1)"},{transform:"scale(1.06)"},{transform:"scale(1)"}], {duration:220});
            showSkillVisual(ultimate ?? selected);
          } else {
            audio.play(event.type, arena.cinematic?.kind);
            if (event.type === "blast") showSkillVisual("blast");
          }
        }
      }
      if (!arena.player.alive) {
        gameOver();
        break;
      }
    }
  } else accumulator = 0;
  const shot = arena?.cinematic;
  el("cinematic").hidden = !shot;
  document.body.classList.toggle("in-cinematic", !!shot);
  if (shot) {
    const blasting = shot.time >= NUKE_BLAST;
    const spirit = shot.kind === "spirit";
    el("cinematic").classList.toggle("spirit", spirit);
    el("cinema-name").textContent = spirit ? "Spirit Bomb" : "Hollow Purple";
    el("cinematic").classList.toggle("detonated", blasting);
    el("cinema-stage").textContent = blasting
      ? (spirit ? "Energy of everyone" : "Imaginary technique")
      : shot.time > 1
        ? (spirit ? (shot.time < 2.4 ? "Gathering energy" : "Let it fly") : "Drawn to infinity")
        : (spirit ? "Raise your spirit" : "Limitless");
    el("cinema-caption").textContent = blasting
      ? "Just you, little legend."
      : (spirit ? "Lend me your energy" : "Red + blue");
    el("cinematic").style.setProperty(
      "--flare",
      String(blasting ? Math.max(0, 0.65 - (shot.time - NUKE_BLAST) * 0.6) : 0),
    );
  }
  view.render(arena, now / 1000, accumulator / STEP, dt);
  hudClock += dt;
  if (hudClock > 0.12) {
    updateHUD();
    hudClock = 0;
  }
  if (now > toastUntil) el("toast").classList.remove("visible");
  requestAnimationFrame(frame);
}
try {
  view = new GameRenderer(canvas);
  const maps = view.mapThumbnails();
  MAPS.forEach((m, i) => (el<HTMLImageElement>(`map-${m.id}`).src = maps[i]));
  chooseMap(selectedMap, false);
  const portraits = view.portraits();
  CHARACTERS.forEach(
    (c, i) => (el<HTMLImageElement>(`portrait-${c.id}`).src = portraits[i]),
  );
  installWorldDiagnostics(view,()=>screen, id=>chooseMap(id,false));
  requestAnimationFrame(frame);
} catch (error) {
  console.error("WebGL initialization failed", error);
  el("fatal").hidden = false;
}
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  pause();
  el("fatal").hidden = false;
});
