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
  type BountyResult,
} from "./simulation";
import { GameRenderer } from "./renderer";
import { AudioEngine } from "./audio";
import { DEFAULT_AUDIO, loadAudio, saveAudio, type AudioChannel } from "./audio-settings";
import {
  MAPS,
  getMap,
  loadMap,
  saveMap,
  type MapId,
  type MapStorage,
} from "./maps";
import { ui } from "./ui";
import { installSettingsTabs, restoreDialogFocus, selectSettingsTab } from './settings-tabs';
import { installWorldDiagnostics } from "./worlds/diagnostics";
import { Progression, CHALLENGES, BODY_SKINS, TRAILS, type BodySkinId, type TrailId } from './progression';
import { PracticeGuide } from './practice';
import { loadSprintBest, recordSprint } from './sprint-record';
import { loadBountyBest, recordBounty } from './bounty-record';
import { defaultSettings, loadGameSettings, saveGameSettings, updateBinding, visualComfort, keyLabel, type Action } from './game-settings';
import { DeathPresentation } from './death-presentation';
import { SkinPreviewSelection } from './coil-skins';
import { progressSnapshot, sessionSummary, UnlockNotices, type SessionProgress, type SessionSummary } from './session-summary';
import { cinematicImpactAnchor, FoxImpactPresentation, PurpleImpactPresentation, SkybreakerImpactPresentation, SpiritImpactPresentation, UltimateCueTracker, ultimateFrame } from './ultimate-presentation';
import { ultimateFor } from './ultimates';
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
const deathPresentation = new DeathPresentation();
const ultimateCues = new UltimateCueTracker();
const spiritImpact = new SpiritImpactPresentation();
const foxImpact = new FoxImpactPresentation();
const purpleImpact = new PurpleImpactPresentation();
const skybreakerImpact = new SkybreakerImpactPresentation();
const impactWorld = {x:0,y:0,z:0};
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
const skinPreview = new SkinPreviewSelection();
let sprintBest: SprintResult | undefined = loadSprintBest(mapStorage);
let bountyBest: BountyResult | undefined = loadBountyBest(mapStorage);
let selectedMode: 'endless' | 'sprint' | 'bounty' = 'endless';
const settings = loadGameSettings(mapStorage);
function applyTouchSettings() {
  document.documentElement.dataset.touchHand = settings.touchHand;
  document.documentElement.dataset.touchSize = settings.touchSize;
  el('touch-preview').dataset.touchHand = settings.touchHand;
  el('touch-preview').dataset.touchSize = settings.touchSize;
}
applyTouchSettings();
const unlockNotices = new UnlockNotices();
let sessionStart: SessionProgress = progressSnapshot(progression.state);
let finalSummary: SessionSummary | undefined;
let manualRecap = false;
let unlockNoticeRemaining = 0;
motionPreference.userReduced = settings.motion === 'reduced';
let rebinding: Action | undefined;
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
  if (changed) spiritImpact.reset();
  if (changed) foxImpact.reset();
  if (changed) purpleImpact.reset();
  if (changed) skybreakerImpact.reset();
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
  el('best-label').textContent = selectedMode === 'sprint' ? 'Sprint record' : selectedMode === 'bounty' ? 'Bounty record' : 'Personal best';
  el('best-score').textContent = String(selectedMode === 'sprint' ? sprintBest?.score ?? 0 : selectedMode === 'bounty' ? bountyBest?.points ?? 0 : best);
}
function chooseMode(mode: 'endless' | 'sprint' | 'bounty') {
  selectedMode = mode;
  document.querySelectorAll<HTMLButtonElement>('.mode-choice').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  showBest();
  el('mode-description').textContent = mode === 'endless'
    ? 'Grow and survive for as long as you like. Respawn in 3 seconds; V is ready after its cooldown.'
    : mode === 'sprint'
      ? 'Set your best peak energy in 3 minutes. Respawn in 3 seconds; V is ready after its cooldown.'
      : 'Earn points from natural orbs and direct KOs in 3 minutes. Respawn in 3 seconds; charge V to 100.';
  audio.unlock(); audio.play('select');
}
document.querySelectorAll<HTMLButtonElement>('.mode-choice').forEach(button =>
  button.addEventListener('click', () => chooseMode(button.dataset.mode as 'endless' | 'sprint' | 'bounty')));
function applyCosmetics() {
  const { cosmetics } = progression.state;
  view?.setCosmetics(cosmetics.skin, cosmetics.trail);
  speedWind.setTrail(cosmetics.trail);
}
function clearSkinPreview() {
  skinPreview.clear();
  view?.setMenuSkinPreview(null);
  el('skin-preview-controls').hidden = true;
  el('menu').classList.remove('previewing-skin');
}
function showSkinPreview(id: BodySkinId) {
  const skin = BODY_SKINS.find(item => item.id === id);
  if (!skin || screen !== 'menu') return;
  skinPreview.select(id);
  view.setMenuSkinPreview(id);
  const unlocked = progression.isUnlocked('skin', id);
  const challenge = CHALLENGES.find(item => item.id === skin.challenge);
  const progress = progression.state.progress;
  const current = skin.challenge === 'orbs' ? progress.collectedOrbs : progress.survivedSeconds;
  el('skin-preview-name').textContent = skin.name;
  el('skin-preview-detail').textContent = unlocked ? skin.description :
    `${skin.description}. Unlock: ${challenge?.description ?? 'Play to unlock'} (${skin.challenge === 'survival' ? `${timeLabel(current)} / 10:00` : `${current} / ${challenge?.target ?? 0}`}).`;
  el('skin-preview-equip').hidden = !unlocked;
  el('skin-preview-controls').hidden = false;
  el('menu').classList.add('previewing-skin');
  el<HTMLDialogElement>('challenges-dialog').close();
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
  el('skin-choices').innerHTML = BODY_SKINS.map(skin => {
    const unlocked = progression.isUnlocked('skin', skin.id);
    const previewable = screen === 'menu';
    return `<button class="cosmetic-choice skin-choice" data-skin="${skin.id}" aria-label="${previewable ? 'Preview' : 'Equip'} ${skin.name} body skin${unlocked ? '' : ' (locked)'}" title="${skin.description}" aria-pressed="${state.cosmetics.skin === skin.id}" ${unlocked || previewable ? '' : 'disabled'}><span class="cosmetic-swatch body-skin-swatch" data-skin-preview="${skin.id}" aria-hidden="true"></span><strong>${skin.name}</strong><small>${unlocked ? skin.description : 'Locked · preview'}</small></button>`;
  }).join('');
  el('trail-choices').innerHTML = TRAILS.map(trail => {
    const unlocked = progression.isUnlocked('trail', trail.id);
    return `<button class="cosmetic-choice" data-trail="${trail.id}" aria-pressed="${state.cosmetics.trail === trail.id}" ${unlocked ? '' : 'disabled'}><span class="cosmetic-swatch trail-swatch" style="--swatch:${trail.color ?? '#ffb75b'};--swatch-second:${trail.secondary ?? '#fff2d0'}"></span>${trail.name}${unlocked ? '' : ' · Locked'}</button>`;
  }).join('');
}
el('skin-choices').addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-skin]');
  if (!button) return;
  const id = button.dataset.skin as BodySkinId;
  if (screen === 'menu') showSkinPreview(id);
  else if (progression.equipSkin(id)) { applyCosmetics(); renderChallenges(); audio.play('select'); }
});
el('skin-preview-back').addEventListener('click', () => {
  const previous = skinPreview.skin;
  clearSkinPreview();
  const dialog = el<HTMLDialogElement>('challenges-dialog');
  dialog.showModal();
  renderChallenges();
  const choice = dialog.querySelector<HTMLButtonElement>(`[data-skin="${previous}"]`);
  choice?.focus();
  choice?.scrollIntoView({ block: 'center' });
});
el('skin-preview-equip').addEventListener('click', () => {
  const id = skinPreview.skin;
  if (!id || !progression.equipSkin(id)) return;
  clearSkinPreview();
  applyCosmetics();
  audio.play('select');
  el('play').focus();
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
let deathContactRemaining = 0;
const deathContactPoint = { x: 0, z: 0 };
const projectedCue = { x: 0, y: 0 };
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
  fox: ["尾獣玉！", "狐の魂", "#ffb34f"],
  nineTail: ["九尾！", "九尾の衣", "#ef9651"],
  skybreaker: ["ドン！", "スカイブレイカー", "#e98280"],
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
function refreshSettings() {
  document.querySelectorAll<HTMLButtonElement>('.key-binding').forEach(button => {
    const action = button.dataset.action as Action;
    button.querySelector('kbd')!.textContent = rebinding === action ? 'Press key…' : keyLabel(settings.keys[action]);
    button.setAttribute('aria-pressed', String(rebinding === action));
  });
  document.querySelectorAll<HTMLButtonElement>('.quality-choice').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.quality === settings.graphics)));
  document.querySelectorAll<HTMLButtonElement>('.motion-choice').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.motion === settings.motion)));
  document.querySelectorAll<HTMLButtonElement>('.touch-hand-choice').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.hand === settings.touchHand)));
  document.querySelectorAll<HTMLButtonElement>('.touch-size-choice').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.size === settings.touchSize)));
  const flash = el('flash-toggle');
  flash.textContent = `Reduced flashes: ${settings.reducedFlashes ? 'On' : 'Off'}`;
  flash.setAttribute('aria-pressed', String(settings.reducedFlashes));
  const camera = el('camera-toggle');
  camera.textContent = `Cinematic camera: ${settings.cinematicCamera ? 'On' : 'Off'}`;
  camera.setAttribute('aria-pressed', String(settings.cinematicCamera));
  el('boost').querySelector('kbd')!.textContent = keyLabel(settings.keys.boost);
  el('ability').querySelector('kbd')!.textContent = keyLabel(settings.keys.ability);
  el('nuke').querySelector('kbd')!.textContent = keyLabel(settings.keys.ultimate);
  el('help-boost-key').textContent = keyLabel(settings.keys.boost);
  el('help-ability-key').textContent = keyLabel(settings.keys.ability);
  el('help-ultimate-key').textContent = keyLabel(settings.keys.ultimate);
  el('menu-ability-key').textContent = keyLabel(settings.keys.ability);
  el('menu-ultimate-key').textContent = keyLabel(settings.keys.ultimate);
  updatePracticeGuide();
}
refreshSettings();
document.querySelectorAll<HTMLButtonElement>('.key-binding').forEach(button => button.addEventListener('click', () => {
  clearInput(); rebinding = button.dataset.action as Action;
  el('binding-note').textContent = `Press a letter, number, or Space for ${rebinding}. Escape cancels.`;
  refreshSettings();
}));
document.querySelectorAll<HTMLButtonElement>('.quality-choice').forEach(button => button.addEventListener('click', () => {
  settings.graphics = button.dataset.quality as typeof settings.graphics;
  view?.setGraphicsChoice(settings.graphics);
  if (view && screen === 'menu') {
    const postcards = view.mapThumbnails();
    MAPS.forEach((map, index) => (el<HTMLImageElement>(`map-${map.id}`).src = postcards[index]));
  }
  saveGameSettings(settings, mapStorage); refreshSettings();
}));
document.querySelectorAll<HTMLButtonElement>('.motion-choice').forEach(button => button.addEventListener('click', () => {
  settings.motion = button.dataset.motion as typeof settings.motion;
  motionPreference.userReduced = settings.motion === 'reduced';
  saveGameSettings(settings, mapStorage); refreshSettings();
}));
for (const selector of ['.touch-hand-choice', '.touch-size-choice'])
  document.querySelectorAll<HTMLButtonElement>(selector).forEach(button => button.addEventListener('click', () => {
    clearInput();
    if (button.dataset.hand) settings.touchHand = button.dataset.hand as typeof settings.touchHand;
    if (button.dataset.size) settings.touchSize = button.dataset.size as typeof settings.touchSize;
    applyTouchSettings(); saveGameSettings(settings, mapStorage); refreshSettings();
  }));
el('flash-toggle').addEventListener('click', () => {
  settings.reducedFlashes = !settings.reducedFlashes;
  saveGameSettings(settings, mapStorage); refreshSettings();
});
el('camera-toggle').addEventListener('click', () => {
  settings.cinematicCamera = !settings.cinematicCamera;
  view.cinematicCameraEnabled = settings.cinematicCamera;
  saveGameSettings(settings, mapStorage); refreshSettings();
});
document.querySelectorAll<HTMLButtonElement>('.settings-reset').forEach(button => button.addEventListener('click', () => {
  const defaults = defaultSettings();
  clearInput();
  if (button.dataset.section === 'controls') { settings.keys = defaults.keys; settings.touchHand = defaults.touchHand; settings.touchSize = defaults.touchSize; applyTouchSettings(); }
  if (button.dataset.section === 'appearance') { darkTheme = false; applyTheme(); try { mapStorage?.setItem('anime-coil-theme-v1', 'light'); } catch {} settings.graphics = defaults.graphics; view.setGraphicsChoice(settings.graphics); }
  if (button.dataset.section === 'accessibility') { settings.motion = defaults.motion; settings.reducedFlashes = defaults.reducedFlashes; settings.cinematicCamera = defaults.cinematicCamera; motionPreference.userReduced = false; view.cinematicCameraEnabled = true; }
  if (button.dataset.section === 'audio') { audio.enabled = DEFAULT_AUDIO.enabled; for (const channel of ['effects', 'voices'] as const) { audio.setVolume(channel, DEFAULT_AUDIO[channel]); el<HTMLInputElement>(`volume-${channel}`).value = String(Math.round(DEFAULT_AUDIO[channel] * 100)); el(`value-${channel}`).textContent = `${Math.round(DEFAULT_AUDIO[channel] * 100)}%`; } saveAudio(audio.prefs, mapStorage); updateSound(); }
  saveGameSettings(settings, mapStorage); refreshSettings();
}));
installSettingsTabs(el<HTMLDialogElement>('settings-dialog'), () => {
  if (!rebinding) return;
  rebinding = undefined;
  el('binding-note').textContent = 'Key change cancelled.';
  refreshSettings();
});
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
        if (name === 'settings') selectSettingsTab(dialog, 'controls', true);
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
    if (name === 'settings') { rebinding = undefined; clearInput(); refreshSettings(); }
    if (name === 'challenges' && skinPreview.skin) el('skin-preview-back').focus();
    else restoreDialogFocus(opener);

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
  el("purple-badge").hidden = false;
  el("ultimate-badge-name").textContent = ultimateFor(id).name;
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
  setText(el('practice-detail'), practiceGuide.detailForKey(keyLabel(settings.keys.ability), matchMedia('(pointer: coarse)').matches));
  el('practice-skip').hidden = practiceGuide.complete;
}
function start(mode: MatchMode = selectedMode) {
  ultimateCues.reset();
  spiritImpact.reset();
  foxImpact.reset();
  purpleImpact.reset();
  skybreakerImpact.reset();
  clearSkinPreview();
  if (arena) finalizeMatch();
  arena = new Arena(selected, Math.random, 20, 850, mode);
  matchFinalized = false;
  sessionStart = progressSnapshot(progression.state);
  finalSummary = undefined;
  manualRecap = false;
  unlockNoticeRemaining = 0;
  el('unlock-notice').hidden = true;
  unlockNotices.reset();
  progression.beginMatch(mode);
  practiceGuide = mode === 'practice' ? new PracticeGuide(selected) : undefined;
  deathPresentation.reset();
  document.body.classList.remove('player-dead');
  el('death-wash').style.setProperty('--death-flash', '0');
  el('respawn-notice').hidden = true;
  el('respawn-notice').classList.remove('visible', 'leaving');
  el('death-contact').hidden = true;
  screen = "game";
  accumulator = 0;
  last = performance.now();
  clearInput();
  deathContactRemaining = 0;
  mouse = { x: innerWidth * 0.75, y: innerHeight * 0.5 };
  view.start(arena);
  applyCosmetics();
  eliminationStamps.clear();
  eliminationStamps.setAccent(UI_ACCENTS[selected].fill);
  speedWind.clear();
  compass.reset(); compass.state.sync(arena, true);
  compass.targetId = arena.bountyTargetId;
  hudChanges.reset(); hudMotion.clear(); leaderboard.clear();
  hudLifetime.start();
  hudMotion.reduced = motionPreference.reduced;
  hudMotion.pulse(el('minimap').parentElement!, 'settle');
  el("menu").hidden = true;
  el("nuke").hidden = mode === 'practice';
  el("ultimate-name").textContent = ultimateFor(selected).name;
  el('hud-mode').textContent = HUD_MODE_LABELS[mode];
  el('hud-mode').setAttribute('aria-label', `${mode === 'practice' ? 'Guided practice' : mode === 'sprint' ? '3-minute sprint' : mode === 'bounty' ? 'Bounty Hunt' : 'Endless'} mode`);
  el('score-label').textContent = mode === 'bounty' ? 'Bounty points' : 'Energy';
  el('bounty-target').hidden = mode !== 'bounty';
  el('bounty-world-marker').hidden = true;
  el('practice-guide').hidden = mode !== 'practice';
  el('end-recap').hidden = mode !== 'endless';
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
  if (arena.mode === 'bounty') {
    if (arena.state !== 'over') return false;
    const recorded = recordBounty(arena.bountyResult, bountyBest, mapStorage);
    bountyBest = recorded.best;
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
  finalSummary = sessionSummary(arena.mode, sessionStart, progressSnapshot(progression.state));
  unlockNotices.add(finalSummary.unlocks);
  matchFinalized = true;
  return record;
}
function menu() {
  ultimateCues.reset();
  spiritImpact.reset();
  foxImpact.reset();
  purpleImpact.reset();
  skybreakerImpact.reset();
  clearSkinPreview();
  finalizeMatch();
  audio.resetTransient();
  screen = "menu";
  arena = undefined;
  deathPresentation.reset();
  document.body.classList.remove('player-dead');
  el('death-wash').style.setProperty('--death-flash', '0');
  el('respawn-notice').hidden = true;
  el('respawn-notice').classList.remove('visible', 'leaving');
  el('death-contact').hidden = true;
  el('bounty-world-marker').hidden = true;
  practiceGuide = undefined;
  view.mode = "menu";
  view.clearEffects();
  eliminationStamps.clear();
  speedWind.clear();
  unlockNotices.reset(); unlockNoticeRemaining = 0; el('unlock-notice').hidden = true;
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
  el('end-recap').hidden = arena.mode !== 'endless';
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
el('end-recap').onclick = () => {
  if (!arena || arena.mode !== 'endless' || arena.state !== 'paused') return;
  manualRecap = true;
  arena.state = 'over';
  el('pause-modal').hidden = true;
  gameOver();
};
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
  if (rebinding && document.querySelector('#settings-dialog[open]')) {
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape') { rebinding = undefined; el('binding-note').textContent = 'Key change cancelled.'; }
    else if (updateBinding(settings, rebinding, e.code)) {
      saveGameSettings(settings, mapStorage);
      el('binding-note').textContent = `${rebinding} set to ${keyLabel(e.code)}.`;
      rebinding = undefined;
    } else el('binding-note').textContent = 'That key is unavailable or already assigned.';
    refreshSettings(); return;
  }
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
    if (screen === "menu" && skinPreview.skin) {
      clearSkinPreview();
      document.querySelector<HTMLButtonElement>('#menu .challenges-open')?.focus();
      return;
    }
    if (arena?.state === "paused") resume();
    else pause();
    return;
  }
  if (screen !== "game" || arena?.state !== "playing") return;
  if (e.code === settings.keys.boost) {
    e.preventDefault();
    if (arena.player.alive) boostKey = true;
  }
  if (e.code === settings.keys.ability && !e.repeat) { e.preventDefault(); abilityQueued = true; }
  if (e.code === settings.keys.ultimate && !e.repeat) {
    e.preventDefault();
    nukeQueued = true;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === settings.keys.boost) boostKey = false;
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") mouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerdown", (e) => {
  if (screen !== "game") return;
  audio.unlock();
  if (e.button === 2 && arena?.player.alive) abilityQueued = true;
  else if (e.pointerType === "mouse") {
    if (arena?.player.alive) boostPointer = true;
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
  if (arena?.player.alive) boostPointer = true;
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
  setText(el("score"), (arena.mode === 'bounty' ? arena.bountyPoints : Math.floor(p.mass * 10)).toLocaleString());
  if (!p.alive) setText(el('respawn-reason'), arena.deathReason);
  el("time").textContent = arena.remaining !== undefined ? timeLabel(Math.ceil(arena.remaining)) : timeLabel(arena.elapsed);
  if (arena.mode === 'bounty') setText(el('bounty-target'), `✦ ${arena.bountyTarget?.name ?? 'New rival arriving…'}`);
  const ranking = [...arena.snakes]
    .filter((s) => s.alive)
    .sort((a, b) => b.mass - a.mass);
  el("rank").textContent = p.alive ? `#${ranking.indexOf(p) + 1}` : "—";
  el("population").textContent = String(ranking.length);
  leaderboard.update(ranking);
  const changed = hudChanges.update(arena.mode === 'bounty' ? arena.bountyPoints : Math.floor(p.mass * 10), p.alive ? ranking.indexOf(p) + 1 : -1, p.cooldown, arena.nukeCooldown, arena.state === 'playing' && !arena.cinematic);
  if (changed.score) hudMotion.pulse(el('score'));
  if (changed.rank) hudMotion.pulse(el('rank'), 'rank');
  if (changed.skillReady) hudMotion.pulse(el('ability'));
  if (changed.ultimateReady) hudMotion.pulse(el('nuke'));
  const feedback = abilityFeedback(p, !!arena.cinematic, arena.state === "playing");
  const actionLabel = p.alive ? feedback.label : 'Respawning…';
  el("ability-status").textContent = actionLabel;

  const button = el<HTMLButtonElement>("ability");
  button.disabled = feedback.disabled;
  button.dataset.state = p.alive ? feedback.state : 'respawning';
  button.setAttribute("aria-label", `${c.power}: ${actionLabel}`);
  const ultimate = ultimateFor(p.character);
  el<HTMLButtonElement>("nuke").disabled =
    arena.state !== 'playing' || !p.alive || arena.nukeCooldown > 0 || !!arena.cinematic ||
    (arena.mode === 'bounty' && arena.bountyCharge < 100);
  el('nuke').dataset.state = !p.alive ? 'respawning' : arena.state !== 'playing' ? 'disabled' : arena.cinematic ? 'active' : arena.nukeCooldown > 0 ? 'cooldown' : arena.mode === 'bounty' && arena.bountyCharge < 100 ? 'charging' : 'ready';
  el("nuke-status").textContent = !p.alive ? 'Respawning…' : arena.cinematic ? "Unleashing…"
      : arena.nukeCooldown > 0 ? `${arena.nukeCooldown.toFixed(1)}s` : arena.mode === 'bounty' && arena.bountyCharge < 100 ? `Charge ${arena.bountyCharge}/100` : "Ready";
  el('nuke').setAttribute('aria-label', `${ultimate.name}: ${el('nuke-status').textContent}`);

  const status = p.alive ? boostStatus(p, false) : 'respawning';
  const unavailable = status === 'unavailable';
  const boostButton = el<HTMLButtonElement>('boost');
  boostButton.dataset.state = status;
  boostButton.setAttribute('aria-disabled', String(unavailable || !p.alive));
  boostButton.setAttribute('aria-label', status === 'respawning' ? 'Boost: respawning' : p.boosting ? 'Boosting' : unavailable ? 'Boost unavailable: need energy' : `Boost: hold ${keyLabel(settings.keys.boost)}`);
  setText(el('boost-status'), !p.alive ? 'Respawning…' : p.boosting ? 'Rushing' : unavailable ? 'Need energy' : 'Hold');
}
function updatePresentation() {
  const frame = view.presentation;
  hudMotion.update(frame);
  document.body.classList.toggle('presentation-paused', frame.paused);
  document.body.classList.toggle('reduced-motion', frame.reducedMotion);
  if (!arena || screen !== 'game') { speedWind.clear(); return; }
  if (arena.cinematic || !arena.player.alive) el('unlock-notice').hidden = true;
  if (!frame.paused && !arena.cinematic && arena.player.alive) {
    unlockNoticeRemaining = Math.max(0, unlockNoticeRemaining - frame.dt);
    if (unlockNoticeRemaining === 0) {
      const next = unlockNotices.take(true);
      if (next) { el('unlock-notice').textContent = `Unlocked: ${next}`; unlockNoticeRemaining = 2.8; }
    }
    el('unlock-notice').hidden = unlockNoticeRemaining === 0;
  }
  if (arena.state === 'over') {
    document.body.classList.remove('player-dead');
    el('respawn-notice').hidden = true;
    el('death-contact').hidden = true;
    el('bounty-world-marker').hidden = true;
    speedWind.clear();
    return;
  }
  const deathFrame = deathPresentation.update(arena.player.alive, arena.playerRespawnRemaining, frame.dt, frame.paused, frame.reducedMotion);
  document.body.classList.toggle('player-dead', deathFrame.dead);
  el('death-wash').style.setProperty('--death-flash', deathFrame.flash.toFixed(3));
  const deathCard = el('respawn-notice');
  deathCard.hidden = !deathFrame.visible;
  deathCard.classList.toggle('visible', deathFrame.dead);
  deathCard.classList.toggle('leaving', deathFrame.fading);
  deathCard.style.opacity = String(deathFrame.opacity);
  deathCard.style.transform = `translate(-50%, -50%) translateY(${deathFrame.offsetY}px)`;
  if (deathFrame.secondChanged) {
    setText(el('respawn-count'), String(deathFrame.seconds));
    setText(el('respawn-units'), deathFrame.seconds === 1 ? 'second' : 'seconds');
    const count = el('respawn-count');
    count.classList.remove('tick');
    if (!frame.reducedMotion) { void count.offsetWidth; count.classList.add('tick'); }
  }
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
  const ultimate = ultimateFor(p.character);
  const lag = STEP * (1 - accumulator / STEP);
  const progress = arena.cinematic ? 0 : p.charge ? 1 - Math.min(KI_CHARGE, p.charge.remaining + lag) / KI_CHARGE
    : p.active > 0 && p.character !== 'nova' ? Math.min(c.duration, p.active + lag) / c.duration
    : p.cooldown > 0 ? 1 - Math.min(c.cooldown, p.cooldown + lag) / c.cooldown : 1;
  el('cool-fill').style.transform = `scaleX(${progress})`;
  el('nuke-fill').style.transform = `scaleX(${arena.cinematic ? Math.max(0,1-arena.cinematic.time/ultimate.duration) : arena.nukeCooldown > 0 ? 1 - Math.min(NUKE_COOLDOWN, arena.nukeCooldown + lag) / NUKE_COOLDOWN : 1})`;
  if (arena.mode === 'bounty' && !arena.cinematic && arena.nukeCooldown <= 0)
    el('nuke-fill').style.transform = `scaleX(${arena.bountyCharge / 100})`;
  if (deathContactRemaining > 0 && !frame.paused) deathContactRemaining = Math.max(0, deathContactRemaining - frame.dt);
  el('death-contact').hidden = deathContactRemaining <= 0;
}

function gameOver() {
  ultimateCues.reset();
  spiritImpact.reset();
  foxImpact.reset();
  purpleImpact.reset();
  skybreakerImpact.reset();
  if (!arena) return;
  speedWind.clear();
  const record = finalizeMatch();
  audio.resetTransient();
  deathPresentation.reset();
  document.body.classList.remove('player-dead');
  el('death-wash').style.setProperty('--death-flash', '0');
  el('respawn-notice').hidden = true;
  el('respawn-notice').classList.remove('visible', 'leaving');
  el('death-contact').hidden = true;
  el('bounty-world-marker').hidden = true;
  view.clearEffects();
  eliminationStamps.clear();
  hudLifetime.clear(); hudMotion.clear();
  el('toast').hidden = true;
  clearInput();
  el('results-title').textContent = manualRecap ? 'Run recap' : arena.mode === 'practice' ? 'A little more practice?' : arena.mode === 'bounty' && arena.endReason === 'time' ? 'Bounty complete!' : arena.endReason === 'time' ? 'Sprint complete!' : 'One more adventure?';
  el("death-reason").textContent = manualRecap ? 'Run ended by player.' : arena.deathReason;
  el('result-record').textContent = record ? arena.mode === 'sprint' ? 'New sprint record! ✦' : arena.mode === 'bounty' ? 'New bounty record! ✦' : 'New personal best! ✦' : '';
  el('result-score-label').textContent = arena.mode === 'bounty' ? 'Bounty points' : 'Best energy';
  el("result-score").textContent = String(arena.mode === 'bounty' ? arena.bountyPoints : Math.floor(arena.player.peak * 10));
  el("result-time").textContent = timeLabel(arena.elapsed);
  el("result-kills").textContent = String(arena.player.kills);
  el('bounty-results').hidden = arena.mode !== 'bounty';
  if (arena.mode === 'bounty') el('bounty-results').textContent = `${arena.bountiesClaimed} bounties · ${arena.directEliminations} direct KOs · ${arena.ultimateEliminations} ultimate KOs · ${Math.floor(arena.player.peak * 10)} peak energy`;
  el('session-progress').textContent = finalSummary?.progress.length ? `This run: ${finalSummary.progress.join(' · ')}` : arena.mode === 'practice' ? 'Practice does not change challenge progress.' : 'No challenge progress this run.';
  el('session-unlocks').textContent = finalSummary?.unlocks.length ? `New rewards: ${finalSummary.unlocks.join(', ')}` : '';
  el('result-challenges').hidden = arena.mode === 'practice';
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
      compass.targetId = arena.bountyTargetId;
      progression.recordStep(arena.events, Math.max(0, arena.elapsed - beforeElapsed), arena.player.alive);
      if (arena.mode !== 'practice' && (Math.floor(arena.elapsed) !== Math.floor(beforeElapsed) ||
        arena.events.some(event => event.type === 'collect' || event.type === 'player-elimination')))
        unlockNotices.add(sessionSummary(arena.mode, sessionStart, progressSnapshot(progression.state)).unlocks);
      if (practiceGuide) { practiceGuide.update(STEP, arena.player, arena.events); updatePracticeGuide(); }
      view.handleEvents(arena.events, arena);
      const eliminations = eliminationStamps.ingest(arena.events);
      if (eliminations && !arena.cinematic) audio.elimination(eliminations);
      for (const event of arena.events) {
        if (event.type === 'player-elimination') continue;
        if (event.type === 'player-respawn') { audio.play('respawn'); continue; }
        if (event.type === "ki-launch" || event.type === "ki-impact") {
          if (event.id === 0 || event.targetId === 0) audio.cannon(event.type === "ki-launch" ? "fire" : "impact");
          continue;
        }
        if (event.id === 0) {
          if (event.type === 'death') {
            boostKey = false;
            boostPointer = false;
            audio.stopBoost(true);
            if (event.killerName) arena.deathReason = `${event.reason ?? 'Your spirit fell.'} ${event.killerName} was involved.`;
            deathContactPoint.x = event.x; deathContactPoint.z = event.z;
            deathContactRemaining = .7;
          }
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
  for (const cue of ultimateCues.consume(shot?.kind, shot?.time)) audio.ultimateCue(shot!.kind, cue);
  const advancing = arena?.state === 'playing' && !document.hidden;
  const comfort = visualComfort(settings, motionPreference.reduced);
  const softenImpact = comfort.softenImpact;
  const spiritFrame = spiritImpact.update(shot?.kind, shot?.time ?? 0, softenImpact, advancing);
  const foxFrame = foxImpact.update(shot?.kind, shot?.time ?? 0, softenImpact, advancing);
  const purpleFrame = purpleImpact.update(shot?.kind, shot?.time ?? 0, softenImpact, advancing);
  const skybreakerFrame = skybreakerImpact.update(shot?.kind, shot?.time ?? 0, softenImpact, advancing);
  const impactFrame = shot?.kind === 'fox' ? foxFrame : shot?.kind === 'purple' ? purpleFrame : shot?.kind === 'skybreaker' ? skybreakerFrame : spiritFrame;
  canvas.style.setProperty('--spirit-gray', String(impactFrame.grayscale));
  canvas.style.setProperty('--spirit-contrast', String(impactFrame.contrast));
  canvas.style.setProperty('--spirit-brightness', String(impactFrame.brightness));
  el("cinematic").hidden = !shot;
  document.body.classList.toggle("in-cinematic", !!shot);
  if (shot) {
    const shotFrame = ultimateFrame(shot.kind, shot.time, motionPreference.reduced);
    const blasting = shot.time >= NUKE_BLAST;
    const spirit = shot.kind === "spirit";
    el("cinematic").classList.toggle("spirit", spirit);
    el("cinematic").classList.toggle("fox", shot.kind === "fox");
    el("cinematic").classList.toggle("purple", shot.kind === "purple");
    el("cinematic").classList.toggle("skybreaker", shot.kind === "skybreaker");
    el("cinema-name").textContent = shot.kind === "fox" ? "Fox Spirit Bomb" : shot.kind === "skybreaker" ? "Skybreaker Slam" : spirit ? "Spirit Bomb" : "Hollow Purple";
    el("cinematic").classList.toggle("detonated", blasting);
    el("cinematic").classList.toggle("spirit-impact-keyframe", spirit && impactFrame.phase === 'keyframe');
    el("cinematic").classList.toggle("spirit-impact-monochrome", spirit && impactFrame.phase === 'monochrome');
    el("cinematic").classList.toggle("fox-impact-keyframe", shot.kind === 'fox' && impactFrame.phase === 'keyframe');
    el("cinematic").classList.toggle("fox-impact-monochrome", shot.kind === 'fox' && impactFrame.phase === 'monochrome');
    el("cinematic").classList.toggle("purple-impact-keyframe", shot.kind === 'purple' && impactFrame.phase === 'keyframe');
    el("cinematic").classList.toggle("purple-impact-monochrome", shot.kind === 'purple' && impactFrame.phase === 'monochrome');
    el("cinematic").classList.toggle("skybreaker-impact-keyframe", shot.kind === 'skybreaker' && impactFrame.phase === 'keyframe');
    el("cinematic").classList.toggle("skybreaker-impact-monochrome", shot.kind === 'skybreaker' && impactFrame.phase === 'monochrome');
    el("cinema-stage").textContent = '';
    el("cinema-caption").textContent = shot.kind === 'fox' ? '轟！' : shot.kind === 'skybreaker' ? 'ドン！' : spirit ? '衝撃！' : '炸裂！';
    const overlay=el("cinematic");
    overlay.style.setProperty('--flare', String(softenImpact || impactFrame.phase === 'keyframe' || impactFrame.phase === 'monochrome' || spirit || shot.kind === 'fox' ? 0 : shotFrame.flash));
    overlay.style.setProperty('--spirit-ink', String(spirit ? impactFrame.ink : 0));
    overlay.style.setProperty('--fox-ink', String(shot.kind === 'fox' ? impactFrame.ink : 0));
    overlay.style.setProperty('--impact-art-ink', String(!softenImpact && (shot.kind === 'purple' || shot.kind === 'skybreaker') ? impactFrame.ink : 0));
    overlay.style.setProperty('--cinema-darken', String(shotFrame.darken));
    overlay.style.setProperty('--cinema-bars', String(shotFrame.bars));
    overlay.style.setProperty('--cinema-title', String(shotFrame.titleOpacity));
    overlay.style.setProperty('--cinema-impact', String(blasting ? Math.max(0,1-(shot.time-NUKE_BLAST)/.55) : 0));
  }
  if (!shot) {
    el('cinematic').classList.remove('spirit-impact-keyframe','spirit-impact-monochrome','fox-impact-keyframe','fox-impact-monochrome','purple-impact-keyframe','purple-impact-monochrome','skybreaker-impact-keyframe','skybreaker-impact-monochrome');
    el('cinematic').style.setProperty('--spirit-ink','0');
    el('cinematic').style.setProperty('--fox-ink','0');
    el('cinematic').style.setProperty('--impact-art-ink','0');
  }
  view.cinematicCameraEnabled = comfort.cameraEnabled;
  view.render(arena, now / 1000, accumulator / STEP, dt, motionPreference.reduced);
  if (shot && arena) cinematicImpactAnchor(shot.kind, shot.impact, arena.player, impactWorld);
  const impactAnchorVisible = !!shot && view.projectPoint(impactWorld.x, impactWorld.z, projectedCue, impactWorld.y, true);
  el('cinematic').classList.toggle('impact-anchor-hidden', !!shot && !impactAnchorVisible);
  if (impactAnchorVisible && shot) {
    const prefix = shot.kind === 'fox' ? 'fox-impact' : shot.kind === 'spirit' ? 'spirit-impact' : 'impact-art';
    el('cinematic').style.setProperty(`--${prefix}-x`, `${projectedCue.x}px`);
    el('cinematic').style.setProperty(`--${prefix}-y`, `${projectedCue.y}px`);
  }
  const target = arena?.mode === 'bounty' && arena.state === 'playing' ? arena.bountyTarget : undefined;
  const targetMarker = el('bounty-world-marker');
  const cueCovered = (x: number, y: number) =>
    (x < 185 && y < 190) || (x > innerWidth - 215 && y < 250) || y > innerHeight - 112;
  const targetVisible = !!target && !arena?.cinematic && view.projectPoint(target.x, target.z, projectedCue);
  targetMarker.hidden = !targetVisible || cueCovered(projectedCue.x, projectedCue.y);
  if (!targetMarker.hidden) {
    targetMarker.style.left = `${projectedCue.x}px`;
    targetMarker.style.top = `${projectedCue.y - 28}px`;
  }
  const contact = el('death-contact');
  if (deathContactRemaining > 0 && view.projectPoint(deathContactPoint.x, deathContactPoint.z, projectedCue) && !cueCovered(projectedCue.x, projectedCue.y)) {
    contact.style.left = `${projectedCue.x}px`; contact.style.top = `${projectedCue.y}px`;
  } else contact.hidden = true;
  if (arena && screen === 'game') eliminationStamps.draw(view, view.presentation);
  const currentBoost = arena && screen === 'game' ? boostKind(arena.player, arena.state === 'playing', !!arena.cinematic, false) : 'none';
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
  view.cinematicCameraEnabled = settings.cinematicCamera;
  view.setGraphicsChoice(settings.graphics);
  applyCosmetics();
  choose(selected);
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
  view?.disposeCinematics();
  motionPreference.dispose(); hudMotion.clear(); compass.dispose(); leaderboard.clear(); eliminationStamps.dispose();
});
