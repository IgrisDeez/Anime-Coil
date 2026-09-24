export type AudioChannel = "effects" | "voices";
export interface AudioPreferences {
  enabled: boolean;
  effects: number;
  voices: number;
}
export const DEFAULT_AUDIO: AudioPreferences = {
  enabled: true,
  effects: 0.65,
  voices: 0.8,
};
export interface AudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const volume = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
export function loadAudio(storage?: AudioStorage): AudioPreferences {
  const prefs = { ...DEFAULT_AUDIO };
  try {
    prefs.enabled = storage?.getItem("anime-coil-sound") !== "off";
    const saved = JSON.parse(storage?.getItem("anime-coil-audio-v1") ?? "{}");
    for (const channel of ["effects", "voices"] as const)
      prefs[channel] = volume(saved?.[channel], prefs[channel]);
  } catch {
    /* Storage is optional. */
  }
  return prefs;
}
export function saveAudio(prefs: AudioPreferences, storage?: AudioStorage) {
  try {
    storage?.setItem("anime-coil-sound", prefs.enabled ? "on" : "off");
    storage?.setItem("anime-coil-audio-v1", JSON.stringify(prefs));
  } catch {}
}
