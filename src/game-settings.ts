export type Action = 'boost' | 'ability' | 'ultimate';
export type GraphicsChoice = 'auto' | 'low' | 'high';
export type MotionChoice = 'system' | 'reduced';
export type TouchHand = 'left' | 'right';
export type TouchSize = 'standard' | 'large';
export interface GameSettings {
  keys: Record<Action, string>;
  graphics: GraphicsChoice;
  motion: MotionChoice;
  touchHand: TouchHand;
  touchSize: TouchSize;
  reducedFlashes: boolean;
  cinematicCamera: boolean;
}
export interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const SETTINGS_KEY = 'anime-coil-game-settings-v1';
export const defaultSettings = (): GameSettings => ({
  keys: { boost: 'Space', ability: 'KeyE', ultimate: 'KeyV' }, graphics: 'auto', motion: 'system',
  touchHand: 'left', touchSize: 'standard', reducedFlashes: false, cinematicCamera: true,
});
export function visualComfort(settings: Readonly<GameSettings>, reducedMotion: boolean) {
  return { softenImpact: reducedMotion || settings.reducedFlashes, cameraEnabled: !reducedMotion && settings.cinematicCamera };
}
export const keyLabel = (code: string) => code === 'Space' ? 'Space' :
  code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code;
export const validKey = (code: string) => code === 'Space' || /^Key[A-Z]$/.test(code) || /^Digit[0-9]$/.test(code);
export function updateBinding(settings: GameSettings, action: Action, code: string): boolean {
  if (!validKey(code) || Object.entries(settings.keys).some(([name, key]) => name !== action && key === code)) return false;
  settings.keys[action] = code;
  return true;
}
export function loadGameSettings(storage?: SettingsStorage): GameSettings {
  const settings = defaultSettings();
  try {
    const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
    if (!saved || saved.version !== 1) return settings;
    const keys = { ...settings.keys };
    for (const action of ['boost', 'ability', 'ultimate'] as const) {
      const code = saved.keys?.[action];
      if (typeof code === 'string') keys[action] = code;
    }
    if (Object.values(keys).every(validKey) && new Set(Object.values(keys)).size === 3) settings.keys = keys;
    if (['auto', 'low', 'high'].includes(saved.graphics)) settings.graphics = saved.graphics;
    if (['system', 'reduced'].includes(saved.motion)) settings.motion = saved.motion;
    if (saved.touchHand === 'left' || saved.touchHand === 'right') settings.touchHand = saved.touchHand;
    if (saved.touchSize === 'standard' || saved.touchSize === 'large') settings.touchSize = saved.touchSize;
    if (typeof saved.reducedFlashes === 'boolean') settings.reducedFlashes = saved.reducedFlashes;
    if (typeof saved.cinematicCamera === 'boolean') settings.cinematicCamera = saved.cinematicCamera;
  } catch {}
  return settings;
}
export function saveGameSettings(settings: GameSettings, storage?: SettingsStorage) {
  try { storage?.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, ...settings })); } catch {}
}
