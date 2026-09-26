import { SpiritCompass } from './minimap';
import { MotionPreference, HudMotion, HudLifetime, HUD_MODE_LABELS, UI_ACCENTS, boostKind, boostStatus } from './presentation';
import { HudChanges, Leaderboard, setText } from './hud-feedback';
import { abilityFeedback } from "./ability-feedback";
import { EliminationStampView } from './elimination-stamps';
import { SpeedWindView } from './speed-wind';
import "./style.css";
import {
  Arena,
  CHARACTERS,
  KI_CHARGE,
  STEP,
  NUKE_BLAST,
  NUKE_COOLDOWN,
  type CharacterId,
  type MatchMode,
  type SprintResult,
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
import { Progression, CHALLENGES, PALETTES, TRAILS, type PaletteId, type TrailId } from './progression';
import { PracticeGuide } from './practice';
import { loadSprintBest, recordSprint } from './sprint-record';
document.querySelector<HTMLDivElement>("#app")!.innerHTML = ui;
const nodes = new Map<string, HTMLElement>();
const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  if (!nodes.has(id)) nodes.set(id, document.getElementById(id)!);
  return nodes.get(id) as T;
};
const motionPreference = new MotionPreference();
const hudMotion = new HudMotion();
const hudLifetime = new HudLifetime();
const hudChanges = new HudChanges();
const compass = new SpiritCompass(el<HTMLCanvasElement>('minimap'));
const eliminationStamps = new EliminationStampView(el('kill-stamps'));
const speedWind = new SpeedWindView(el<HTMLCanvasElement>('boost-speed-lines'));
const windFrom={x:0,y:0},windTo={x:0,y:0};
const leaderboard = new Leaderboard(el('leaders'), hudMotion);
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
const progression = new Progression(mapStorage);
let sprintBest: SprintResult | undefined = loadSprintBest(mapStorage);
let selectedMode: 'endless' | 'sprint' = 'endless';
let practiceGuide: PracticeGuide | undefined;
let matchFinalized = false;
let darkTheme = false;
try { darkTheme = mapStorage?.getItem("anime-coil-theme-v1") === "dark"; } catch {}
function applyTheme() {
  document.documentElement.dataset.theme = darkTheme ? "dark" : "light";
  const toggle = el<HTMLButtonElement>("theme-toggle");
  toggle.textContent = `Dark mode: ${darkTheme ? "On" : "Off"}`;
  toggle.setAttribute("aria-pressed", String(darkTheme));
}
applyTheme();
audio.prefs = loadAudio(mapStorage);
let selectedMap: MapId = loadMap(mapStorage);
function chooseMap(id: MapId, persist = true) {
  const changed = selectedMap !== id;
  selectedMap = id;
  view.setMap(id);
  compass.setMap(id);
  const m = getMap(id);
  document
    .querySelectorAll<HTMLButtonElement>(".map-card")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.map === id)),
    );
  el("map-preview-name").textContent = m.name;

  if (persist) {
    if (changed) {
      hudMotion.reduced = motionPreference.reduced;
      const image = document.querySelector<HTMLElement>(`.map-card[data-map="${id}"] img`)!;
      hudMotion.selection(image);
    }
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
function showBest() {
  el('best-label').textContent = selectedMode === 'sprint' ? 'Sprint record' : 'Personal best';
  el('best-score').textContent = String(selectedMode === 'sprint' ? sprintBest?.score ?? 0 : best);
}
function chooseMode(mode: 'endless' | 'sprint') {
  selectedMode = mode;
  document.querySelectorAll<HTMLButtonElement>('.mode-choice').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  showBest();
  audio.unlock(); audio.play('select');
}
document.querySelectorAll<HTMLButtonElement>('.mode-choice').forEach(button =>
  button.addEventListener('click', () => chooseMode(button.dataset.mode as 'endless' | 'sprint')));
function applyCosmetics() {
  const { cosmetics } = progression.state;
  const palette = PALETTES.find(item => item.id === cosmetics.palette)!;
  view?.setCosmetics(palette.primary ? { primary: palette.primary, secondary: palette.secondary! } : undefined, cosmetics.trail);
  speedWind.setTrail(cosmetics.trail);
}
function renderChallenges() {
  const state = progression.state;
  const progressById = {
    orbs: state.progress.collectedOrbs,
    survival: Math.floor(state.progress.survivedSeconds),
    eliminations: state.progress.creditedEliminations,
    'sprint-maps': state.progress.completedSprintMaps.length,
  };
  el('challenge-list').innerHTML = CHALLENGES.map(challenge => {
    const count = progressById[challenge.id];
    const unit = challenge.id === 'survival' ? `${timeLabel(count)} / 10:00` : `${count} / ${challenge.target}`;
    const complete = count >= challenge.target;
    return `<article class="challenge-item${complete ? ' complete' : ''}"><div><strong>${challenge.name}</strong><small>${challenge.description}</small></div><span>${complete ? '✓ Unlocked' : unit}</span><progress max="${challenge.target}" value="${count}" aria-label="${challenge.name}: ${unit}"></progress><em>${challenge.reward}</em></article>`;
  }).join('');
  el('palette-choices').innerHTML = PALETTES.map(palette => {
    const unlocked = progression.isUnlocked('palette', palette.id);
    return `<button class="cosmetic-choice" data-palette="${palette.id}" aria-pressed="${state.cosmetics.palette === palette.id}" ${unlocked ? '' : 'disabled'}><span class="cosmetic-swatch" style="--swatch:${palette.primary ?? '#fff4d6'};--swatch-second:${palette.secondary ?? '#d98b66'}"></span>${palette.name}${unlocked ? '' : ' · Locked'}</button>`;
  }).join('');
  el('trail-choices').innerHTML = TRAILS.map(trail => {
    const unlocked = progression.isUnlocked('trail', trail.id);
    return `<button class="cosmetic-choice" data-trail="${trail.id}" aria-pressed="${state.cosmetics.trail === trail.id}" ${unlocked ? '' : 'disabled'}><span class="cosmetic-swatch trail-swatch" style="--swatch:${trail.color ?? '#ffb75b'};--swatch-second:${trail.secondary ?? '#fff2d0'}"></span>${trail.name}${unlocked ? '' : ' · Locked'}</button>`;
  }).join('');
}
el('palette-choices').addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-palette]');
  if (button && progression.equipPalette(button.dataset.palette as PaletteId)) { applyCosmetics(); renderChallenges(); audio.play('select'); }
});
el('trail-choices').addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-trail]');
  if (button && progression.equipTrail(button.dataset.trail as TrailId)) { applyCosmetics(); renderChallenges(); audio.play('select'); }
});
let mouse = { x: innerWidth * 0.7, y: innerHeight * 0.5 },
  boostKey = false,
  boostPointer = false,
  abilityQueued = false,
  nukeQueued = false,
  touchAngle: number | undefined,
  joystickPointer: number | undefined;
let accumulator = 0,
  last = performance.now(),
  hudClock = 0;
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
  el("toast").hidden = true;
  hudLifetime.dismissHint();
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
function showToast(text: string) {
  el("toast").textContent = text;
  el("toast").style.opacity = '1';
  el("toast").hidden = false;
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
el("theme-toggle").addEventListener("click", () => {
  darkTheme = !darkTheme;
  applyTheme();
  try { mapStorage?.setItem("anime-coil-theme-v1", darkTheme ? "dark" : "light"); } catch {}
});
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
for (const name of ["help", "settings", "credits", "challenges"]) {
  const dialog = el<HTMLDialogElement>(`${name}-dialog`);
  let opener: HTMLElement | undefined;
  document.querySelectorAll<HTMLElement>(`.${name}-open`).forEach(
    (button) =>
      (button.onclick = () => {
        opener = button;
        if (arena?.state === "playing") pause();

        audio.unlock();
        dialog.showModal();
        if (name === 'challenges') renderChallenges();
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
  const changed = selected !== id;
  selected = id;
  const c = CHARACTERS.find((c) => c.id === id)!;
  if (changed) { view.setHero(id); view.reactToSelection(); }
  document
    .querySelectorAll<HTMLButtonElement>(".character")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.character === id)),
    );
  el("power-name").textContent = c.power;
  el("hero-name").textContent = c.name;
  el("purple-badge").hidden = id !== "eclipse" && id !== "nova";
  el("ultimate-badge-name").textContent = id === "nova" ? "Spirit Bomb" : "Hollow Purple";
  applyAccent();
  if (changed) {
    hudMotion.reduced = motionPreference.reduced;
    const portrait = document.querySelector<HTMLElement>(`.character[data-character="${id}"]`)!;
    hudMotion.selection(portrait, portrait.querySelector<HTMLElement>('.selected-mark'));
  }
  audio.unlock();
  audio.play("select");
}
function applyAccent() {
  const accent = UI_ACCENTS[selected];
  for (const [key, value] of Object.entries(accent)) el('app').style.setProperty(`--spirit-${key}`, value);
}
document
  .querySelectorAll<HTMLButtonElement>(".character")
  .forEach((b) =>
    b.addEventListener("click", () =>
      choose(b.dataset.character as CharacterId),
    ),
  );
function updatePracticeGuide() {
  if (!practiceGuide) return;
  setText(el('practice-step'), practiceGuide.complete ? 'Practice complete' : `Step ${practiceGuide.step + 1} / 4`);
  setText(el('practice-instruction'), practiceGuide.label);
  setText(el('practice-detail'), practiceGuide.detail);
  el('practice-skip').hidden = practiceGuide.complete;
}
function start(mode: MatchMode = selectedMode) {
  if (arena) finalizeMatch();
  arena = new Arena(selected, Math.random, 20, 850, mode);
  matchFinalized = false;
  progression.beginMatch(mode);
  practiceGuide = mode === 'practice' ? new PracticeGuide() : undefined;
  screen = "game";
  accumulator = 0;
  last = performance.now();
  clearInput();
  mouse = { x: innerWidth * 0.75, y: innerHeight * 0.5 };
  view.start(arena);
  applyCosmetics();
  eliminationStamps.clear();
  eliminationStamps.setAccent(UI_ACCENTS[selected].fill);
  speedWind.clear();
  compass.reset(); compass.state.sync(arena, true);
  hudChanges.reset(); hudMotion.clear(); leaderboard.clear();
  hudLifetime.start();
  hudMotion.reduced = motionPreference.reduced;
  hudMotion.pulse(el('minimap').parentElement!, 'settle');
  el("menu").hidden = true;
  el("nuke").hidden = mode === 'practice' || (selected !== "eclipse" && selected !== "nova");
  el("ultimate-name").textContent = selected === "nova" ? "Spirit Bomb" : "Hollow Purple";
  el('hud-mode').textContent = HUD_MODE_LABELS[mode];
  el('hud-mode').setAttribute('aria-label', `${mode === 'practice' ? 'Guided practice' : mode === 'sprint' ? '3-minute sprint' : 'Endless'} mode`);
  el('practice-guide').hidden = mode !== 'practice';
  updatePracticeGuide();
  el("hud").hidden = false;
  el('hud').dataset.mode = mode;
  el("results").hidden = true;
  el("pause-modal").hidden = true;
  el("ability-name").textContent = CHARACTERS.find(
    (c) => c.id === selected,
  )!.power;
  audio.unlock();
  audio.resetTransient();
  audio.play("select");
  if (mode === 'practice') { hudLifetime.dismissHint(); el('toast').textContent = ''; el('toast').classList.remove('visible'); el('toast').hidden = true; }
  else showToast("Gather energy. Watch your head!");
  updateHUD();
  canvas.focus();
}
function saveBest(): boolean {
  if (!arena || arena.mode === 'practice') return false;
  if (arena.mode === 'sprint') {
    if (arena.state !== 'over') return false;
    const recorded = recordSprint(arena.sprintResult, sprintBest, mapStorage);
    sprintBest = recorded.best;
    showBest();
    return recorded.newRecord;
  }
  const score = Math.floor(arena.player.peak * 10);
  const improved = score > best;
  best = Math.max(best, score);
  try { mapStorage?.setItem("anime-coil-best", String(best)); } catch {}
  showBest();
  return improved;
}
function finalizeMatch(): boolean {
  if (!arena || matchFinalized) return false;
  const record = saveBest();
  progression.finishMatch(selectedMap, arena.mode === 'sprint' && arena.endReason === 'time');
  matchFinalized = true;
  return record;
}
function menu() {
  finalizeMatch();
  audio.resetTransient();
  screen = "menu";
  arena = undefined;
  practiceGuide = undefined;
  view.mode = "menu";
  view.clearEffects();
  eliminationStamps.clear();
  speedWind.clear();
  compass.reset(); hudMotion.clear(); hudChanges.reset(); leaderboard.clear();
  hudLifetime.clear();
  el('toast').classList.remove('visible');
  el('toast').textContent = '';
  el('toast').hidden = true;
  clearInput();
  el("menu").hidden = false;
  el("hud").hidden = true;
  el("pause-modal").hidden = true;
  el("results").hidden = true;
  el('practice-guide').hidden = true;
  el("play").focus();
}
function pause() {
  if (!arena || arena.state !== "playing") return;
  arena.state = "paused";
  audio.resetTransient();
  speedWind.clear();
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
el("play").onclick = () => start();
el("restart").onclick = () => start(arena?.mode ?? selectedMode);
el("change").onclick = menu;
el("quit").onclick = menu;
el("pause").onclick = pause;
el("resume").onclick = resume;
el("reload").onclick = () => location.reload();
el('practice-start').onclick = () => {
  el<HTMLDialogElement>('help-dialog').close();
  if (arena) menu();
  start('practice');
};
el('practice-skip').onclick = () => { practiceGuide?.skip(); updatePracticeGuide(); };
el('practice-exit').onclick = menu;
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
  setText(el("score"), Math.floor(p.mass * 10).toLocaleString());
  el("time").textContent = arena.mode === 'sprint' ? timeLabel(Math.ceil(arena.remaining ?? 0)) : timeLabel(arena.elapsed);
  const ranking = [...arena.snakes]
    .filter((s) => s.alive)
    .sort((a, b) => b.mass - a.mass);
  el("rank").textContent = p.alive ? `#${ranking.indexOf(p) + 1}` : "—";
  el("population").textContent = String(ranking.length);
  leaderboard.update(ranking);
  const changed = hudChanges.update(Math.floor(p.mass * 10), p.alive ? ranking.indexOf(p) + 1 : -1, p.cooldown, arena.nukeCooldown, arena.state === 'playing' && !arena.cinematic);
  if (changed.score) hudMotion.pulse(el('score'));
  if (changed.rank) hudMotion.pulse(el('rank'), 'rank');
  if (changed.skillReady) hudMotion.pulse(el('ability'));
  if (changed.ultimateReady) hudMotion.pulse(el('nuke'));
  const feedback = abilityFeedback(p, !!arena.cinematic, arena.state === "playing");
  el("ability-status").textContent = feedback.label;

  const button = el<HTMLButtonElement>("ability");
  button.disabled = feedback.disabled;
  button.dataset.state = feedback.state;
  button.setAttribute("aria-label", `${c.power}: ${feedback.label}`);
  el<HTMLButtonElement>("nuke").disabled =
    arena.state !== 'playing' || !p.alive || arena.nukeCooldown > 0 || !!arena.cinematic;
  el('nuke').dataset.state = arena.state !== 'playing' || !p.alive ? 'disabled' : arena.cinematic ? 'active' : arena.nukeCooldown > 0 ? 'cooldown' : 'ready';
  el("nuke-status").textContent = arena.cinematic
    ? "Unleashing…"
    : arena.nukeCooldown > 0
      ? `${arena.nukeCooldown.toFixed(1)}s`
      : "Ready";
  el('nuke').setAttribute('aria-label', `${p.character === 'nova' ? 'Spirit Bomb' : 'Hollow Purple'}: ${el('nuke-status').textContent}`);

  const status = boostStatus(p);
  const unavailable = status === 'unavailable';
  const boostButton = el<HTMLButtonElement>('boost');
  boostButton.dataset.state = status;
  boostButton.setAttribute('aria-disabled', String(unavailable));
  boostButton.setAttribute('aria-label', p.boosting ? 'Boosting' : unavailable ? 'Boost unavailable: need energy' : 'Boost: hold Space');
  setText(el('boost-status'), p.boosting ? 'Rushing' : unavailable ? 'Need energy' : 'Hold');
}
function updatePresentation() {
  const frame = view.presentation;
  hudMotion.update(frame);
  document.body.classList.toggle('presentation-paused', frame.paused);
  document.body.classList.toggle('reduced-motion', frame.reducedMotion);
  if (!arena || screen !== 'game') { speedWind.clear(); return; }
  hudLifetime.update(frame);
  el('toast').style.opacity = String(hudLifetime.hintOpacity);
  el('toast').classList.toggle('visible', hudLifetime.hintRemaining > 0);
  el('toast').hidden = hudLifetime.hintRemaining <= 0;
  const boost = view.boostMotion;
  const player=arena.player;
  if(arena.state==='playing'&&!arena.cinematic&&boost.intensity>.01){
    const heading=player.angle;
    const from=view.projectPoint(player.x,player.z,windFrom);
    const to=view.projectPoint(player.x+Math.cos(heading)*5,player.z+Math.sin(heading)*5,windTo);
    speedWind.draw(frame,boost.intensity,boost.enhanced,selectedMap,from&&to?windTo.x-windFrom.x:0,from&&to?windTo.y-windFrom.y:-1);
  } else speedWind.clear();
  el('boost').style.setProperty('--boost-strength', String(boost.intensity));
  compass.draw(frame, accumulator / STEP);
  if (frame.paused) return;
  const p = arena.player, c = CHARACTERS.find(c => c.id === p.character)!;
  const lag = STEP * (1 - accumulator / STEP);
  const progress = arena.cinematic ? 0 : p.charge ? 1 - Math.min(KI_CHARGE, p.charge.remaining + lag) / KI_CHARGE
    : p.active > 0 && p.character !== 'nova' ? Math.min(c.duration, p.active + lag) / c.duration
    : p.cooldown > 0 ? 1 - Math.min(c.cooldown, p.cooldown + lag) / c.cooldown : 1;
  el('cool-fill').style.transform = `scaleX(${progress})`;
  el('nuke-fill').style.transform = `scaleX(${arena.nukeCooldown > 0 ? 1 - Math.min(NUKE_COOLDOWN, arena.nukeCooldown + lag) / NUKE_COOLDOWN : 1})`;
}

function gameOver() {
  if (!arena) return;
  speedWind.clear();
  const record = finalizeMatch();
  audio.resetTransient();
  view.clearEffects();
  eliminationStamps.clear();
  hudLifetime.clear(); hudMotion.clear();
  el('toast').hidden = true;
  clearInput();
  el('results-title').textContent = arena.mode === 'practice' ? 'A little more practice?' : arena.endReason === 'time' ? 'Sprint complete!' : 'One more adventure?';
  el("death-reason").textContent = arena.deathReason;
  el('result-record').textContent = record ? arena.mode === 'sprint' ? 'New sprint record! ✦' : 'New personal best! ✦' : '';
  el("result-score").textContent = String(Math.floor(arena.player.peak * 10));
  el("result-time").textContent = timeLabel(arena.elapsed);
  el("result-kills").textContent = String(arena.player.kills);
  el('restart').textContent = arena.mode === 'practice' ? 'Practice again ↗' : 'Play again ↗';
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
      const beforeElapsed = arena.elapsed;
      arena.step(STEP, {
        angle,
        boost: boostKey || boostPointer,
        ability: abilityQueued,
        nuke: arena.mode !== 'practice' && nukeQueued,
      });
      abilityQueued = false;
      nukeQueued = false;
      accumulator -= STEP;
      skillVisualRemaining = Math.max(0, skillVisualRemaining - STEP);
      if (!skillVisualRemaining) clearSkillVisual();
      compass.state.sync(arena);
      progression.recordStep(arena.events, Math.max(0, arena.elapsed - beforeElapsed), arena.player.alive);
      if (practiceGuide) { practiceGuide.update(STEP, arena.player, arena.events); updatePracticeGuide(); }
      view.handleEvents(arena.events, arena);
      const eliminations = eliminationStamps.ingest(arena.events);
      if (eliminations) audio.elimination(eliminations);
      for (const event of arena.events) {
        if (event.type === 'player-elimination') continue;
        if (event.type === "ki-launch" || event.type === "ki-impact") {
          if (event.id === 0 || event.targetId === 0) audio.cannon(event.type === "ki-launch" ? "fire" : "impact");
          continue;
        }
        if (event.id === 0) {
          if (event.type === "ability" || event.type === "nuke") {
            if (event.type === 'nuke') audio.stopBoost(true);
            const ultimate = event.type === "nuke" ? arena.cinematic?.kind : undefined;
            audio.skill(selected, ultimate);
            if (event.type === "ability") hudMotion.pulse(el("ability"));
            showSkillVisual(ultimate ?? selected);
          } else {
            audio.play(event.type, arena.cinematic?.kind);
            if (event.type === "blast") showSkillVisual("blast");
          }
        }
      }
      if (arena.endReason) {
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
  view.render(arena, now / 1000, accumulator / STEP, dt, motionPreference.reduced);
  if (arena && screen === 'game') eliminationStamps.draw(view, view.presentation);
  const currentBoost = arena && screen === 'game' ? boostKind(arena.player, arena.state === 'playing', !!arena.cinematic) : 'none';
  audio.setBoost(currentBoost === 'fox' || (currentBoost === 'normal' && (boostKey || boostPointer)), currentBoost === 'fox', view.boostMotion.intensity);
  updatePresentation();
  hudClock += dt;
  if (hudClock > 0.12) {
    updateHUD();
    hudClock = 0;
  }
  requestAnimationFrame(frame);
}
try {
  applyAccent();
  view = new GameRenderer(canvas);
  applyCosmetics();
  const maps = view.mapThumbnails();
  MAPS.forEach((m, i) => (el<HTMLImageElement>(`map-${m.id}`).src = maps[i]));
  chooseMap(selectedMap, false);
  const portraits = view.portraits();
  CHARACTERS.forEach(
    (c, i) => (el<HTMLImageElement>(`portrait-${c.id}`).src = portraits[i]),
  );
  installWorldDiagnostics(view,()=>screen, id=>chooseMap(id,false), reduced => { motionPreference.previewReduced = reduced; });
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

if (import.meta.hot) import.meta.hot.dispose(() => {
  motionPreference.dispose(); hudMotion.clear(); compass.dispose(); leaderboard.clear(); eliminationStamps.dispose();
});
