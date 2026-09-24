export type MapId = "shibuya" | "leaf" | "tournament" | "harbor";
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
}
export const MAPS: MapDefinition[] = [
  {
    id: "shibuya",
    name: "Shibuya After Dark",
    shortName: "Shibuya",
    inspiration: "JUJUTSU KAISEN",
    description: "Neon nights. One legendary crossing.",
    sky: "#c6bbd3",
    ground: "#a89aaa",
    accent: "#867099",
    ambient: "#fff0df",
    sun: "#ffe2c1",
    intensity: 1.45,
  },
  {
    id: "leaf",
    name: "Hidden Leaf Village",
    shortName: "Hidden Leaf",
    inspiration: "NARUTO",
    description: "Warm lanterns beneath the guardian mountain.",
    sky: "#d2e3ce",
    ground: "#b8ceab",
    accent: "#a98461",
    ambient: "#fff4dd",
    sun: "#ffe3bc",
    intensity: 1.5,
  },
  {
    id: "tournament",
    name: "World Tournament",
    shortName: "Tournament",
    inspiration: "DRAGON BALL",
    description: "The world is watching. Claim the arena.",
    sky: "#c6e2e5",
    ground: "#e4dbc2",
    accent: "#c1836c",
    ambient: "#fff5df",
    sun: "#ffeccc",
    intensity: 1.55,
  },
  {
    id: "harbor",
    name: "Grand Line Harbor",
    shortName: "Grand Line",
    inspiration: "ONE PIECE",
    description: "Salt in the air. Adventure on the horizon.",
    sky: "#c3e3dd",
    ground: "#e4d2ad",
    accent: "#699e91",
    ambient: "#fff4df",
    sun: "#ffe9c7",
    intensity: 1.5,
  },
];
export const getMap = (id: MapId) => MAPS.find((m) => m.id === id)!;
export interface MapStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadMap(storage?: MapStorage): MapId {
  try {
    const id = storage?.getItem("anime-coil-map");
    return MAPS.find((m) => m.id === id)?.id ?? "shibuya";
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
