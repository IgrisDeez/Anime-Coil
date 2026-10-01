export type MapId = "shibuya";
export interface MapDefinition {
  id: MapId;
  name: string;
  shortName: string;
  inspiration: string;
  description: string;
  sky: string;
  ground: string;
  accent: string;
  ambient: string;
  sun: string;
  intensity: number;
  sunIntensity: number;
  rimIntensity: number;
  groundLight: string;
  sunDirection: readonly [number, number, number];
  fog: number;
  atmosphere: "rain";
  preview: { camera: readonly [number,number,number]; focus: readonly [number,number,number] };
}
export const MAPS: MapDefinition[] = [
  {
    id: "shibuya",
    name: "Shibuya After Dark",
    shortName: "Shibuya",
    inspiration: "JUJUTSU KAISEN",
    description: "A nighttime arena set inside Shibuya's central crossing.",
    sky: "#18243a",
    ground: "#303b4b",
    accent: "#867099",
    ambient: "#acb9ef",
    sun: "#d6c6f0",
    intensity: 1.35,
    sunIntensity: .95, rimIntensity: .65, groundLight: "#445671", sunDirection: [-35,60,25], fog: .0014, atmosphere: "rain", preview: {camera:[205,175,315],focus:[0,21,-50]},
  },

];
export const getMap = (id: MapId) => MAPS.find((m) => m.id === id) ?? MAPS[0];
export interface MapStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadMap(storage?: MapStorage): MapId {
  try {
    const id = storage?.getItem("anime-coil-map");
    if (id && id !== "shibuya") saveMap("shibuya", storage);
    return "shibuya";
  } catch {
    return "shibuya";
  }
}
export function saveMap(id: MapId, storage?: MapStorage) {
  try {
    storage?.setItem("anime-coil-map", id);
  } catch {
    /* Selection still works without storage. */
  }
}
