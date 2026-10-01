import { deathDescription, MODE_HINTS } from './game-copy';
import { removeClasses, setStyle, setClass, setAttribute, setHidden, setDisabled } from './dom-presentation';
import { SpiritCompass } from './minimap';
import { MotionPreference, HudMotion, HudLifetime, HUD_MODE_LABELS, UI_ACCENTS, boostKind, boostStatus } from './presentation';
import { HudChanges, Leaderboard, setText } from './hud-feedback';
import { abilityFeedback } from "./ability-feedback";
import { EliminationStampView } from './elimination-stamps';
import { SpeedWindView } from './speed-wind';
import "./style.css";
import "./moonlit.css";
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
import { kitsuHeads, selectKitsuProfile } from './kitsu-head';
import { profileFor } from './worlds/types';
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
let refreshDiagnostics: (now:number)=>void = ()=>{};
let renderSimulationStep=0;
let simulationConstructor= Arena, simulationRandom:()=>number=Math.random;
let simulationBenchmark:ReturnType<typeof import('../tests/simulation-benchmark').installSimulationBenchmark>|undefined;
async function installSimulationReview(){if(import.meta.env.DEV && new URLSearchParams(location.search).has('simBench')) { const {installSimulationBenchmark}=await import('../tests/simulation-benchmark');
 simulationBenchmark=installSimulationBenchmark({start:()=>start(),choose,arena:()=>arena,view,constructor:ctor=>simulationConstructor=ctor,random:rng=>simulationRandom=rng,clock:()=>{last=performance.now();}});
}}
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
  setAttribute(document.documentElement, 'data-touch-hand', settings.touchHand);
  setAttribute(document.documentElement, 'data-touch-size', settings.touchSize);
  setAttribute(el('touch-preview'), 'data-touch-hand', settings.touchHand);
  setAttribute(el('touch-preview'), 'data-touch-size', settings.touchSize);
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
audio.prefs = loadAudio(mapStorage);
let selectedMap: MapId = loadMap(mapStorage);
function chooseMap(id: MapId, persist = true) {
  selectedMap = id;
  view.setMap(id);
  compass.setMap(id);
  if (persist) saveMap(id, mapStorage);
}
try {
  best = Math.max(0, Number(localStorage.getItem("anime-coil-best")) || 0);
} catch {
  /* Private browsing can disable storage. */
}
setText(el("best-score"), String(best));
function showBest() {
  setText(el('best-label'), selectedMode === 'sprint' ? 'Sprint record' : selectedMode === 'bounty' ? 'Bounty record' : 'Personal best');
  setText(el('best-score'), String(selectedMode === 'sprint' ? sprintBest?.score ?? 0 : selectedMode === 'bounty' ? bountyBest?.points ?? 0 : best));
}
function chooseMode(mode: 'endless' | 'sprint' | 'bounty') {
  selectedMode = mode;
  setText(el("mode-description"), MODE_HINTS[mode]);
  document.querySelectorAll<HTMLButtonElement>('.mode-choice').forEach(button =>
    setAttribute(button, 'aria-pressed', String(button.dataset.mode === mode)));
  showBest();
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
  setHidden(el('skin-preview-controls'), true);
  removeClasses(el('menu'), 'previewing-skin');
  view?.updateLobbyViewport();
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
  setText(el('skin-preview-name'), skin.name);
  setText(el('skin-preview-detail'), unlocked ? skin.description :
    `${skin.description}. Unlock: ${challenge?.description ?? 'Play to unlock'} (${skin.challenge === 'survival' ? `${timeLabel(current)} / 10:00` : `${current} / ${challenge?.target ?? 0}`}).`);
  setHidden(el('skin-preview-equip'), !unlocked);
  setHidden(el('skin-preview-controls'), false);
  el('menu').classList.add('previewing-skin');
  view.updateLobbyViewport();
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
  setStyle(el("stick"), 'transform', "");
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
  setHidden(el("skill-visual"), true);
}
function showSkillVisual(skill: keyof typeof skillVisuals) {
  removeClasses(el("toast"), "visible");
  setHidden(el("toast"), true);
  hudLifetime.dismissHint();
  const [text, label, color] = skillVisuals[skill];
  const node = el("skill-visual");
  setText(el("skill-japanese"), text);
  setText(el("skill-label"), label);
  setStyle(node, "--skill-color", color);
  setHidden(node, false);
  removeClasses(node, "pop");
  void node.offsetWidth;
  node.classList.add("pop");
  skillVisualRemaining = skill === "blast" ? 1.8 : 1.6;
}
function showToast(text: string) {
  // Confirmed feedback is a one-shot announcement, including repeated starts.
  el("toast").textContent = text;
  setStyle(el("toast"), 'opacity', '1');
  setHidden(el("toast"), false);
  el("toast").classList.add("visible");
}
function updateSound() {
  document.querySelectorAll<HTMLButtonElement>(".sound-toggle").forEach((b) => {
    setText(b, audio.enabled ? "Sound on  ♫" : "Sound off  ♪");
    setAttribute(b, "aria-label", audio.enabled ? "Mute sound" : "Enable sound");
    setAttribute(b, "aria-pressed", String(audio.enabled));
    setStyle(b, 'opacity', audio.enabled ? "1" : ".5");
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
  setText(el(`value-${channel}`), `${slider.value}%`);
  slider.addEventListener("input", () => {
    audio.unlock();
    audio.setVolume(channel, Number(slider.value) / 100);
    setText(el(`value-${channel}`), `${slider.value}%`);
    saveAudio(audio.prefs, mapStorage);
  });
}
function refreshSettings() {
  document.querySelectorAll<HTMLButtonElement>('.key-binding').forEach(button => {
    const action = button.dataset.action as Action;
    setText(button.querySelector('kbd')!, rebinding === action ? 'Press key…' : keyLabel(settings.keys[action]));
    setAttribute(button, 'aria-pressed', String(rebinding === action));
  });
  document.querySelectorAll<HTMLButtonElement>('.quality-choice').forEach(button =>
    setAttribute(button, 'aria-pressed', String(button.dataset.quality === settings.graphics)));
  document.querySelectorAll<HTMLButtonElement>('.motion-choice').forEach(button =>
    setAttribute(button, 'aria-pressed', String(button.dataset.motion === settings.motion)));
  document.querySelectorAll<HTMLButtonElement>('.touch-hand-choice').forEach(button =>
    setAttribute(button, 'aria-pressed', String(button.dataset.hand === settings.touchHand)));
  document.querySelectorAll<HTMLButtonElement>('.touch-size-choice').forEach(button =>
    setAttribute(button, 'aria-pressed', String(button.dataset.size === settings.touchSize)));
  const flash = el('flash-toggle');
  setText(flash, `Reduced flashes: ${settings.reducedFlashes ? 'On' : 'Off'}`);
  setAttribute(flash, 'aria-pressed', String(settings.reducedFlashes));
  const camera = el('camera-toggle');
  setText(camera, `Cinematic camera: ${settings.cinematicCamera ? 'On' : 'Off'}`);
  setAttribute(camera, 'aria-pressed', String(settings.cinematicCamera));
  setText(el('boost').querySelector('kbd')!, keyLabel(settings.keys.boost));
  setText(el('ability').querySelector('kbd')!, keyLabel(settings.keys.ability));
  setText(el('nuke').querySelector('kbd')!, keyLabel(settings.keys.ultimate));
  setText(el('help-boost-key'), keyLabel(settings.keys.boost));
  setText(el('help-ability-key'), keyLabel(settings.keys.ability));
  setText(el('help-ultimate-key'), keyLabel(settings.keys.ultimate));
  setText(el('menu-ability-key'), keyLabel(settings.keys.ability));
  setText(el('menu-ultimate-key'), keyLabel(settings.keys.ultimate));
  updatePracticeGuide();
}
refreshSettings();
document.querySelectorAll<HTMLButtonElement>('.key-binding').forEach(button => button.addEventListener('click', () => {
  clearInput(); rebinding = button.dataset.action as Action;
  setText(el('binding-note'), `Press a letter, number, or Space for ${rebinding}. Escape cancels.`);
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
  if (button.dataset.section === 'appearance') { settings.graphics = defaults.graphics; view.setGraphicsChoice(settings.graphics); }
  if (button.dataset.section === 'accessibility') { settings.motion = defaults.motion; settings.reducedFlashes = defaults.reducedFlashes; settings.cinematicCamera = defaults.cinematicCamera; motionPreference.userReduced = false; view.cinematicCameraEnabled = true; }
  if (button.dataset.section === 'audio') { audio.enabled = DEFAULT_AUDIO.enabled; for (const channel of ['effects', 'voices'] as const) { audio.setVolume(channel, DEFAULT_AUDIO[channel]); el<HTMLInputElement>(`volume-${channel}`).value = String(Math.round(DEFAULT_AUDIO[channel] * 100)); setText(el(`value-${channel}`), `${Math.round(DEFAULT_AUDIO[channel] * 100)}%`); } saveAudio(audio.prefs, mapStorage); updateSound(); }
  saveGameSettings(settings, mapStorage); refreshSettings();
}));
installSettingsTabs(el<HTMLDialogElement>('settings-dialog'), () => {
  if (!rebinding) return;
  rebinding = undefined;
  setText(el('binding-note'), 'Key change cancelled.');
  refreshSettings();
});
for (const name of ["help", "settings", "credits", "challenges", "character"]) {
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
          setText(el("audio-note"), audio.missingClips.size
            ? "Some callouts could not load. The game is still ready to play."
            : "Sound effects and Japanese skill voices. No background music.");
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
      setAttribute(b, "aria-pressed", String(b.dataset.character === id)),
    );
  setText(el("power-name"), c.power);
  setText(el("hero-name"), c.name);
  setText(el("hero-description"), c.description);
  setText(el("character-title"), `${c.name} abilities`);
  setText(el("ability-cooldown"), `${c.cooldown}s cooldown`);
  const ultimate = ultimateFor(id);
  setText(el("ultimate-timing"), `${ultimate.duration}s attack · ${ultimate.cooldown}s cooldown`);
  setText(el("ultimate-description"), ultimate.description);
  setHidden(el("purple-badge"), false);
  setText(el("ultimate-badge-name"), ultimateFor(id).name);
  view.updateLobbyViewport();
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
  for (const [key, value] of Object.entries(accent)) setStyle(el('app'), `--spirit-${key}`, value);
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
  setHidden(el('practice-skip'), practiceGuide.complete);
}
function start(mode: MatchMode = selectedMode) {
  if(!view)return;
  ultimateCues.reset();
  spiritImpact.reset();
  foxImpact.reset();
  purpleImpact.reset();
  skybreakerImpact.reset();
  clearSkinPreview();
  if (arena) finalizeMatch();
  arena = new simulationConstructor(selected, simulationBenchmark ? simulationRandom : Math.random, 20, 850, mode);
  view.profiler.simulation.enabled=view.profiler.enabled;
  view.profiler.simulation.attach(arena);
  matchFinalized = false;
  sessionStart = progressSnapshot(progression.state);
  finalSummary = undefined;
  manualRecap = false;
  unlockNoticeRemaining = 0;
  setHidden(el('unlock-notice'), true);
  unlockNotices.reset();
  progression.beginMatch(mode);
  practiceGuide = mode === 'practice' ? new PracticeGuide(selected) : undefined;
  deathPresentation.reset();
  removeClasses(document.body, 'player-dead');
  setStyle(el('death-wash'), '--death-flash', '0');
  setHidden(el('respawn-notice'), true);
  removeClasses(el('respawn-notice'), 'visible', 'leaving');
  setHidden(el('death-contact'), true);
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
  setHidden(el("menu"), true);
  setHidden(el("nuke"), mode === 'practice');
  setText(el("ultimate-name"), ultimateFor(selected).name);
  setText(el('hud-mode'), HUD_MODE_LABELS[mode]);
  setAttribute(el('hud-mode'), 'aria-label', `${mode === 'practice' ? 'Guided practice' : mode === 'sprint' ? '3-minute sprint' : mode === 'bounty' ? 'Bounty Hunt' : 'Endless'} mode`);
  setText(el('score-label'), mode === 'bounty' ? 'Bounty points' : 'Energy');
  setHidden(el('bounty-target'), mode !== 'bounty');
  setHidden(el('bounty-world-marker'), true);
  setHidden(el('practice-guide'), mode !== 'practice');
  setHidden(el('end-recap'), mode !== 'endless');
  updatePracticeGuide();
  setHidden(el("hud"), false);
  setAttribute(el('hud'), 'data-mode', mode);
  setHidden(el("results"), true);
  setHidden(el("pause-modal"), true);
  setText(el("ability-name"), CHARACTERS.find(
    (c) => c.id === selected,
  )!.power);
  audio.unlock();
  audio.resetTransient();
  audio.play("select");
  if (mode === 'practice') { hudLifetime.dismissHint(); setText(el('toast'), ''); removeClasses(el('toast'), 'visible'); setHidden(el('toast'), true); }
  else showToast("Collect orbs. Avoid other snakes and the arena boundary.");
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
  view.profiler.simulation.detach();
  arena = undefined;
  deathPresentation.reset();
  removeClasses(document.body, 'player-dead');
  setStyle(el('death-wash'), '--death-flash', '0');
  setHidden(el('respawn-notice'), true);
  removeClasses(el('respawn-notice'), 'visible', 'leaving');
  setHidden(el('death-contact'), true);
  setHidden(el('bounty-world-marker'), true);
  practiceGuide = undefined;
  view.mode = "menu";
  view.clearEffects();
  eliminationStamps.clear();
  speedWind.clear();
  unlockNotices.reset(); unlockNoticeRemaining = 0; setHidden(el('unlock-notice'), true);
  compass.reset(); hudMotion.clear(); hudChanges.reset(); leaderboard.clear();
  hudLifetime.clear();
  removeClasses(el('toast'), 'visible');
  setText(el('toast'), '');
  setHidden(el('toast'), true);
  clearInput();
  setHidden(el("menu"), false);
  setHidden(el("hud"), true);
  setHidden(el("pause-modal"), true);
  setHidden(el("results"), true);
  setHidden(el('practice-guide'), true);
  el("play").focus();
}
function pause() {
  if (!arena || arena.state !== "playing") return;
  arena.state = "paused";
  audio.resetTransient();
  speedWind.clear();
  clearInput();
  setHidden(el("pause-modal"), false);
  setHidden(el('end-recap'), arena.mode !== 'endless');
  el("resume").focus();
}
function resume() {
  if (!arena || arena.state !== "paused") return;
  arena.state = "playing";
  accumulator = 0;
  last = performance.now();
  setHidden(el("pause-modal"), true);

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
  setHidden(el('pause-modal'), true);
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
    if (e.code === 'Escape') { rebinding = undefined; setText(el('binding-note'), 'Key change cancelled.'); }
    else if (updateBinding(settings, rebinding, e.code)) {
      saveGameSettings(settings, mapStorage);
      setText(el('binding-note'), `${rebinding} set to ${keyLabel(e.code)}.`);
      rebinding = undefined;
    } else setText(el('binding-note'), 'That key is unavailable or already assigned.');
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
  setStyle(el("stick"), 'transform', `translate(${dx * scale}px,${dy * scale}px)`);
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
    setStyle(el("stick"), 'transform', "");
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
  if (!p.alive) setText(el('respawn-reason'), deathDescription(arena.deathReason));
  setText(el("time"), arena.remaining !== undefined ? timeLabel(Math.ceil(arena.remaining)) : timeLabel(arena.elapsed));
  if (arena.mode === 'bounty') setText(el('bounty-target'), `Target: ${arena.bountyTarget?.name ?? 'Waiting for an opponent'}`);
  const ranking = [...arena.snakes]
    .filter((s) => s.alive)
    .sort((a, b) => b.mass - a.mass);
  setText(el("rank"), p.alive ? `#${ranking.indexOf(p) + 1}` : "—");
  setText(el("population"), String(ranking.length));
  leaderboard.update(ranking);
  const changed = hudChanges.update(arena.mode === 'bounty' ? arena.bountyPoints : Math.floor(p.mass * 10), p.alive ? ranking.indexOf(p) + 1 : -1, p.cooldown, arena.nukeCooldown, arena.state === 'playing' && !arena.cinematic);
  if (changed.score) hudMotion.pulse(el('score'));
  if (changed.rank) hudMotion.pulse(el('rank'), 'rank');
  if (changed.skillReady) hudMotion.pulse(el('ability'));
  if (changed.ultimateReady) hudMotion.pulse(el('nuke'));
  const feedback = abilityFeedback(p, !!arena.cinematic, arena.state === "playing");
  const actionLabel = p.alive ? feedback.label : 'Respawning…';
  setText(el("ability-status"), actionLabel);

  const button = el<HTMLButtonElement>("ability");
  setDisabled(button, feedback.disabled);
  setAttribute(button, 'data-state', p.alive ? feedback.state : 'respawning');
  setAttribute(button, "aria-label", `${c.power}: ${actionLabel}`);
  const ultimate = ultimateFor(p.character);
  setDisabled(el<HTMLButtonElement>("nuke"), arena.state !== 'playing' || !p.alive || arena.nukeCooldown > 0 || !!arena.cinematic ||
    (arena.mode === 'bounty' && arena.bountyCharge < 100));
  setAttribute(el('nuke'), 'data-state', !p.alive ? 'respawning' : arena.state !== 'playing' ? 'disabled' : arena.cinematic ? 'active' : arena.nukeCooldown > 0 ? 'cooldown' : arena.mode === 'bounty' && arena.bountyCharge < 100 ? 'charging' : 'ready');
  setText(el("nuke-status"), !p.alive ? 'Respawning…' : arena.cinematic ? "Attacking…"
      : arena.nukeCooldown > 0 ? `${arena.nukeCooldown.toFixed(1)}s` : arena.mode === 'bounty' && arena.bountyCharge < 100 ? `Charge ${arena.bountyCharge}/100` : "Ready");
  setAttribute(el('nuke'), 'aria-label', `${ultimate.name}: ${el('nuke-status').textContent}`);

  const status = p.alive ? boostStatus(p, false) : 'respawning';
  const unavailable = status === 'unavailable';
  const boostButton = el<HTMLButtonElement>('boost');
  setAttribute(boostButton, 'data-state', status);
  setAttribute(boostButton, 'aria-disabled', String(unavailable || !p.alive));
  setAttribute(boostButton, 'aria-label', status === 'respawning' ? 'Boost: respawning' : p.boosting ? 'Boosting' : unavailable ? 'Boost unavailable: need energy' : `Boost: hold ${keyLabel(settings.keys.boost)}`);
  setText(el('boost-status'), !p.alive ? 'Respawning…' : p.boosting ? 'Boosting' : unavailable ? 'Need energy' : 'Hold');
}
function updatePresentation() {
  const frame = view.presentation;
  hudMotion.update(frame);
  setClass(document.body, 'presentation-paused', frame.paused);
  setClass(document.body, 'reduced-motion', frame.reducedMotion);
  if (!arena || screen !== 'game') { speedWind.clear(); return; }
  if (arena.cinematic || !arena.player.alive) setHidden(el('unlock-notice'), true);
  if (!frame.paused && !arena.cinematic && arena.player.alive) {
    unlockNoticeRemaining = Math.max(0, unlockNoticeRemaining - frame.dt);
    if (unlockNoticeRemaining === 0) {
      const next = unlockNotices.take(true);
      if (next) { setText(el('unlock-notice'), `Unlocked: ${next}`); unlockNoticeRemaining = 2.8; }
    }
    setHidden(el('unlock-notice'), unlockNoticeRemaining === 0);
  }
  if (arena.state === 'over') {
    removeClasses(document.body, 'player-dead');
    setHidden(el('respawn-notice'), true);
    setHidden(el('death-contact'), true);
    setHidden(el('bounty-world-marker'), true);
    speedWind.clear();
    return;
  }
  const deathFrame = deathPresentation.update(arena.player.alive, arena.playerRespawnRemaining, frame.dt, frame.paused, frame.reducedMotion);
  setClass(document.body, 'player-dead', deathFrame.dead);
  setStyle(el('death-wash'), '--death-flash', deathFrame.flash.toFixed(3));
  const deathCard = el('respawn-notice');
  setHidden(deathCard, !deathFrame.visible);
  setClass(deathCard, 'visible', deathFrame.dead);
  setClass(deathCard, 'leaving', deathFrame.fading);
  setStyle(deathCard, 'opacity', String(deathFrame.opacity));
  setStyle(deathCard, 'transform', `translate(-50%, -50%) translateY(${deathFrame.offsetY}px)`);
  if (deathFrame.secondChanged) {
    const waitingForSpace = deathFrame.dead && deathFrame.seconds === 0;
    setAttribute(deathCard, 'aria-label', waitingForSpace ? 'Waiting for a safe spawn' : `Respawning in ${deathFrame.seconds} ${deathFrame.seconds === 1 ? 'second' : 'seconds'}`);
    setText(el('respawn-count-label'), waitingForSpace ? 'Waiting for a safe spawn' : 'Respawning in');
    setText(el('respawn-count'), waitingForSpace ? '…' : String(deathFrame.seconds));
    setText(el('respawn-units'), waitingForSpace ? '' : deathFrame.seconds === 1 ? 'second' : 'seconds');
    const count = el('respawn-count');
    count.classList.remove('tick');
    if (!frame.reducedMotion) { void count.offsetWidth; count.classList.add('tick'); }
  }
  if (deathFrame.fading) {
    setAttribute(deathCard, 'aria-label', 'Respawned');
    setText(el('respawn-count-label'), 'Respawned');
    setText(el('respawn-count'), '');
    setText(el('respawn-units'), '');
  }
  hudLifetime.update(frame);
  setStyle(el('toast'), 'opacity', String(hudLifetime.hintOpacity));
  setClass(el('toast'), 'visible', hudLifetime.hintRemaining > 0);
  setHidden(el('toast'), hudLifetime.hintRemaining <= 0);
  const boost = view.boostMotion;
  const player=arena.player;
  if(arena.state==='playing'&&!arena.cinematic&&boost.intensity>.01){
    const heading=player.angle;
    const from=view.projectPoint(player.x,player.z,windFrom);
    const to=view.projectPoint(player.x+Math.cos(heading)*5,player.z+Math.sin(heading)*5,windTo);
    speedWind.draw(frame,boost.intensity,boost.enhanced,selectedMap,from&&to?windTo.x-windFrom.x:0,from&&to?windTo.y-windFrom.y:-1);
  } else speedWind.clear();
  setStyle(el('boost'), '--boost-strength', String(boost.intensity));
  compass.draw(frame, accumulator / STEP);
  if (frame.paused) return;
  const p = arena.player, c = CHARACTERS.find(c => c.id === p.character)!;
  const ultimate = ultimateFor(p.character);
  const lag = STEP * (1 - accumulator / STEP);
  const progress = arena.cinematic ? 0 : p.charge ? 1 - Math.min(KI_CHARGE, p.charge.remaining + lag) / KI_CHARGE
    : p.active > 0 && p.character !== 'nova' ? Math.min(c.duration, p.active + lag) / c.duration
    : p.cooldown > 0 ? 1 - Math.min(c.cooldown, p.cooldown + lag) / c.cooldown : 1;
  setStyle(el('cool-fill'), 'transform', `scaleX(${progress})`);
  const nukeProgress=arena.cinematic?Math.max(0,1-arena.cinematic.time/ultimate.duration)
    :arena.nukeCooldown>0?1-Math.min(NUKE_COOLDOWN,arena.nukeCooldown+lag)/NUKE_COOLDOWN
    :arena.mode==='bounty'?arena.bountyCharge/100:1;
  setStyle(el('nuke-fill'), 'transform', `scaleX(${nukeProgress})`);
  if (deathContactRemaining > 0 && !frame.paused) deathContactRemaining = Math.max(0, deathContactRemaining - frame.dt);
  setHidden(el('death-contact'), deathContactRemaining <= 0);
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
  removeClasses(document.body, 'player-dead');
  setStyle(el('death-wash'), '--death-flash', '0');
  setHidden(el('respawn-notice'), true);
  removeClasses(el('respawn-notice'), 'visible', 'leaving');
  setHidden(el('death-contact'), true);
  setHidden(el('bounty-world-marker'), true);
  view.clearEffects();
  eliminationStamps.clear();
  hudLifetime.clear(); hudMotion.clear();
  setHidden(el('toast'), true);
  clearInput();
  setText(el('results-title'), manualRecap ? 'Run recap' : arena.mode === 'practice' ? 'Practice complete' : arena.mode === 'bounty' && arena.endReason === 'time' ? 'Bounty Hunt complete' : arena.endReason === 'time' ? 'Sprint complete' : 'Run complete');
  setText(el("death-reason"), manualRecap ? 'You ended this run.' : deathDescription(arena.deathReason));
  setText(el('result-record'), record ? arena.mode === 'sprint' ? 'New sprint record! ✦' : arena.mode === 'bounty' ? 'New bounty record! ✦' : 'New personal best! ✦' : '');
  setText(el('result-score-label'), arena.mode === 'bounty' ? 'Bounty points' : 'Peak energy');
  setText(el("result-score"), String(arena.mode === 'bounty' ? arena.bountyPoints : Math.floor(arena.player.peak * 10)));
  setText(el("result-time"), timeLabel(arena.elapsed));
  setText(el("result-kills"), String(arena.player.kills));
  setHidden(el('bounty-results'), arena.mode !== 'bounty');
  if (arena.mode === 'bounty') setText(el('bounty-results'), `${arena.bountiesClaimed} bounties · ${arena.directEliminations} direct KOs · ${arena.ultimateEliminations} ultimate KOs · ${Math.floor(arena.player.peak * 10)} peak energy`);
  setText(el('session-progress'), finalSummary?.progress.length ? `This run: ${finalSummary.progress.join(' · ')}` : arena.mode === 'practice' ? 'Practice does not change challenge progress.' : 'No challenge progress this run.');
  setText(el('session-unlocks'), finalSummary?.unlocks.length ? `New rewards: ${finalSummary.unlocks.join(', ')}` : '');
  setHidden(el('result-challenges'), arena.mode === 'practice');
  setText(el('restart'), arena.mode === 'practice' ? 'Practice again ↗' : 'Play again ↗');
  setHidden(el("results"), false);
  el("restart").focus();
}
function frame(now: number) {
  view.profiler.beginFrame();
  const simulationStamp=view.profiler.stamp();
  const dt = simulationBenchmark?.delta(Math.min((now - last) / 1000, 0.1)) ?? Math.min((now - last) / 1000, 0.1);
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
      arena.step(STEP, simulationBenchmark?.running ? simulationBenchmark.input() : {
        angle,
        boost: boostKey || boostPointer,
        ability: abilityQueued,
        nuke: arena.mode !== 'practice' && nukeQueued,
      });
      simulationBenchmark?.afterTick();
      renderSimulationStep++;
      abilityQueued = false;
      nukeQueued = false;
      accumulator -= STEP;
      skillVisualRemaining = Math.max(0, skillVisualRemaining - STEP);
      if (!skillVisualRemaining) clearSkillVisual();
      if(view.profiler.enabled)view.profiler.simulation.enter('events-compass');
      compass.state.sync(arena);
      compass.targetId = arena.bountyTargetId;
      view.profiler.simulation.leave();
      if(view.profiler.enabled)view.profiler.simulation.enter('events-progression');
      progression.recordStep(arena.events, Math.max(0, arena.elapsed - beforeElapsed), arena.player.alive);
      view.profiler.simulation.leave();
      if(view.profiler.enabled)view.profiler.simulation.enter('events-unlocks');
      if (arena.mode !== 'practice' && (Math.floor(arena.elapsed) !== Math.floor(beforeElapsed) ||
        arena.events.some(event => event.type === 'collect' || event.type === 'player-elimination')))
        unlockNotices.add(sessionSummary(arena.mode, sessionStart, progressSnapshot(progression.state)).unlocks);
      view.profiler.simulation.leave();
      if(view.profiler.enabled)view.profiler.simulation.enter('events-practice');
      if (practiceGuide) { practiceGuide.update(STEP, arena.player, arena.events); updatePracticeGuide(); }
      view.profiler.simulation.leave();
      if(view.profiler.enabled)view.profiler.simulation.enter('events-effects');
      view.handleEvents(arena.events, arena);
      view.profiler.simulation.leave();
      if(view.profiler.enabled)view.profiler.simulation.enter('events-stamps');
      const eliminations = eliminationStamps.ingest(arena.events);
      if (eliminations && !arena.cinematic) audio.elimination(eliminations);
      view.profiler.simulation.leave();
      if(view.profiler.enabled)view.profiler.simulation.enter('events-audio');
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
            if (event.killerName) arena.deathReason = `${event.reason ?? 'You crashed.'} Opponent: ${event.killerName}.`;
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
      view.profiler.simulation.leave();
      if(view.profiler.simulation.enabled)view.profiler.simulation.events+=arena.events.length;
      if (arena.endReason) {
        gameOver();
        break;
      }
    }
  } else accumulator = 0;
  if(view.profiler.simulation.enabled)view.profiler.simulation.backlogMs=accumulator*1000;
  const shot = arena?.cinematic;
  view.profiler.finish('simulation',simulationStamp);
  const beforeRenderDomStamp=view.profiler.stamp();
  for (const cue of ultimateCues.consume(shot?.kind, shot?.time)) audio.ultimateCue(shot!.kind, cue);
  const advancing = arena?.state === 'playing' && !document.hidden;
  const comfort = visualComfort(settings, motionPreference.reduced);
  const softenImpact = comfort.softenImpact;
  const spiritFrame = spiritImpact.update(shot?.kind, shot?.time ?? 0, softenImpact, advancing);
  const foxFrame = foxImpact.update(shot?.kind, shot?.time ?? 0, softenImpact, advancing);
  const purpleFrame = purpleImpact.update(shot?.kind, shot?.time ?? 0, softenImpact, advancing);
  const skybreakerFrame = skybreakerImpact.update(shot?.kind, shot?.time ?? 0, softenImpact, advancing);
  const impactFrame = shot?.kind === 'fox' ? foxFrame : shot?.kind === 'purple' ? purpleFrame : shot?.kind === 'skybreaker' ? skybreakerFrame : spiritFrame;
  setStyle(canvas, '--spirit-gray', String(impactFrame.grayscale));
  setStyle(canvas, '--spirit-contrast', String(impactFrame.contrast));
  setStyle(canvas, '--spirit-brightness', String(impactFrame.brightness));
  setHidden(el("cinematic"), !shot);
  setClass(document.body, "in-cinematic", !!shot);
  if (shot) {
    const shotFrame = ultimateFrame(shot.kind, shot.time, motionPreference.reduced);
    const blasting = shot.time >= NUKE_BLAST;
    const spirit = shot.kind === "spirit";
    setClass(el("cinematic"), "spirit", spirit);
    setClass(el("cinematic"), "fox", shot.kind === "fox");
    setClass(el("cinematic"), "purple", shot.kind === "purple");
    setClass(el("cinematic"), "skybreaker", shot.kind === "skybreaker");
    setText(el("cinema-name"), shot.kind === "fox" ? "Fox Spirit Bomb" : shot.kind === "skybreaker" ? "Skybreaker Slam" : spirit ? "Spirit Bomb" : "Hollow Purple");
    setClass(el("cinematic"), "detonated", blasting);
    setClass(el("cinematic"), "spirit-impact-keyframe", spirit && impactFrame.phase === 'keyframe');
    setClass(el("cinematic"), "spirit-impact-monochrome", spirit && impactFrame.phase === 'monochrome');
    setClass(el("cinematic"), "fox-impact-keyframe", shot.kind === 'fox' && impactFrame.phase === 'keyframe');
    setClass(el("cinematic"), "fox-impact-monochrome", shot.kind === 'fox' && impactFrame.phase === 'monochrome');
    setClass(el("cinematic"), "purple-impact-keyframe", shot.kind === 'purple' && impactFrame.phase === 'keyframe');
    setClass(el("cinematic"), "purple-impact-monochrome", shot.kind === 'purple' && impactFrame.phase === 'monochrome');
    setClass(el("cinematic"), "skybreaker-impact-keyframe", shot.kind === 'skybreaker' && impactFrame.phase === 'keyframe');
    setClass(el("cinematic"), "skybreaker-impact-monochrome", shot.kind === 'skybreaker' && impactFrame.phase === 'monochrome');
    setText(el("cinema-stage"), '');
    setText(el("cinema-caption"), shot.kind === 'fox' ? '轟！' : shot.kind === 'skybreaker' ? 'ドン！' : spirit ? '衝撃！' : '炸裂！');
    const overlay=el("cinematic");
    setStyle(overlay, '--flare', String(softenImpact || impactFrame.phase === 'keyframe' || impactFrame.phase === 'monochrome' || spirit || shot.kind === 'fox' ? 0 : shotFrame.flash));
    setStyle(overlay, '--spirit-ink', String(spirit ? impactFrame.ink : 0));
    setStyle(overlay, '--fox-ink', String(shot.kind === 'fox' ? impactFrame.ink : 0));
    setStyle(overlay, '--impact-art-ink', String(!softenImpact && (shot.kind === 'purple' || shot.kind === 'skybreaker') ? impactFrame.ink : 0));
    setStyle(overlay, '--cinema-darken', String(shotFrame.darken));
    setStyle(overlay, '--cinema-bars', String(shotFrame.bars));
    setStyle(overlay, '--cinema-title', String(shotFrame.titleOpacity));
    setStyle(overlay, '--cinema-impact', String(blasting ? Math.max(0,1-(shot.time-NUKE_BLAST)/.55) : 0));
  }
  if (!shot) {
    removeClasses(el('cinematic'), 'spirit-impact-keyframe', 'spirit-impact-monochrome', 'fox-impact-keyframe', 'fox-impact-monochrome', 'purple-impact-keyframe', 'purple-impact-monochrome', 'skybreaker-impact-keyframe', 'skybreaker-impact-monochrome');
    setStyle(el('cinematic'), '--spirit-ink', '0');
    setStyle(el('cinematic'), '--fox-ink', '0');
    setStyle(el('cinematic'), '--impact-art-ink', '0');
  }
  view.cinematicCameraEnabled = comfort.cameraEnabled;
  view.profiler.finish('dom',beforeRenderDomStamp);
  view.render(arena, now / 1000, accumulator / STEP, dt, motionPreference.reduced, renderSimulationStep);
  const afterRenderDomStamp=view.profiler.stamp();
  if (shot && arena) cinematicImpactAnchor(shot.kind, shot.impact, arena.player, impactWorld);
  const impactAnchorVisible = !!shot && view.projectPoint(impactWorld.x, impactWorld.z, projectedCue, impactWorld.y, true);
  setClass(el('cinematic'), 'impact-anchor-hidden', !!shot && !impactAnchorVisible);
  if (impactAnchorVisible && shot) {
    const prefix = shot.kind === 'fox' ? 'fox-impact' : shot.kind === 'spirit' ? 'spirit-impact' : 'impact-art';
    setStyle(el('cinematic'), `--${prefix}-x`, `${projectedCue.x}px`);
    setStyle(el('cinematic'), `--${prefix}-y`, `${projectedCue.y}px`);
  }
  const target = arena?.mode === 'bounty' && arena.state === 'playing' ? arena.bountyTarget : undefined;
  const targetMarker = el('bounty-world-marker');
  const cueCovered = (x: number, y: number) =>
    (x < 185 && y < 190) || (x > innerWidth - 215 && y < 250) || y > innerHeight - 112;
  const targetVisible = !!target && !arena?.cinematic && view.projectPoint(target.x, target.z, projectedCue);
  setHidden(targetMarker, !targetVisible || cueCovered(projectedCue.x, projectedCue.y));
  if (!targetMarker.hidden) {
    setStyle(targetMarker, 'left', `${projectedCue.x}px`);
    setStyle(targetMarker, 'top', `${projectedCue.y - 28}px`);
  }
  const contact = el('death-contact');
  if (deathContactRemaining > 0 && view.projectPoint(deathContactPoint.x, deathContactPoint.z, projectedCue) && !cueCovered(projectedCue.x, projectedCue.y)) {
    setStyle(contact, 'left', `${projectedCue.x}px`); setStyle(contact, 'top', `${projectedCue.y}px`);
  } else setHidden(contact, true);
  if (arena && screen === 'game') eliminationStamps.draw(view, view.presentation);
  const currentBoost = arena && screen === 'game' ? boostKind(arena.player, arena.state === 'playing', !!arena.cinematic, false) : 'none';
  audio.setBoost(currentBoost === 'fox' || (currentBoost === 'normal' && (boostKey || boostPointer)), currentBoost === 'fox', view.boostMotion.intensity);
  updatePresentation();
  hudClock += dt;
  if (hudClock > 0.12) {
    updateHUD();
    hudClock = 0;
  }
  view.profiler.finish('dom',afterRenderDomStamp);
  view.profiler.endFrame();
  simulationBenchmark?.afterFrame();
  refreshDiagnostics(now);
  requestAnimationFrame(frame);
}
async function initializeRenderer() {
 const feedback=document.createElement('div');feedback.id='head-loading';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.textContent='Loading Kitsu’s model…';

 document.body.append(feedback);el('menu').inert=true;
 const profile=settings.graphics==='auto'?profileFor(innerWidth,matchMedia('(pointer:coarse)').matches):settings.graphics==='low'?'mobile':'desktop';
 selectKitsuProfile(profile);
 const ready=await kitsuHeads.preload(profile);
 feedback.textContent=ready?'Kitsu’s model ready.':'Kitsu’s model unavailable. Using the original head.';
 if(ready)feedback.remove();else setTimeout(()=>feedback.remove(),6000);
 el('menu').inert=false;
 try {
  applyAccent();
  view = new GameRenderer(canvas, settings.graphics);
  view.onHeadProfileLoad=(loading,ready)=>{
    feedback.textContent=loading?'Loading Kitsu’s character model…':ready?'Kitsu’s model ready.':'Kitsu’s model unavailable. Using the original head.';
    if(loading||!ready){if(!feedback.isConnected)document.body.append(feedback);}else feedback.remove();
    if(!loading){const images=view.portraits();CHARACTERS.forEach((c,i)=>(el<HTMLImageElement>(`portrait-${c.id}`).src=images[i]));if(!ready)setTimeout(()=>feedback.remove(),6000);}
  };
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
  refreshDiagnostics=installWorldDiagnostics(view,()=>screen, id=>chooseMap(id,false), reduced => { motionPreference.previewReduced = reduced; });
  await installSimulationReview();
  requestAnimationFrame(frame);
} catch (error) {
  console.error("WebGL initialization failed", error);
  setHidden(el("fatal"), false);
}
}
void initializeRenderer();
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  pause();
  setHidden(el("fatal"), false);
});

if (import.meta.hot) import.meta.hot.dispose(() => {
  view?.disposeCinematics();
  motionPreference.dispose(); hudMotion.clear(); compass.dispose(); leaderboard.clear(); eliminationStamps.dispose();
});

// Read lobby geometry only on scrolling and resizing.
const updateLobbyViewport = () => view?.updateLobbyViewport();
void document.fonts.ready.then(updateLobbyViewport);
el("menu").addEventListener("scroll", updateLobbyViewport, { passive: true });
if (import.meta.hot) import.meta.hot.dispose(() => el("menu").removeEventListener("scroll", updateLobbyViewport));
