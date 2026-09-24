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
  sunIntensity: number;
  rimIntensity: number;
  groundLight: string;
  sunDirection: readonly [number, number, number];
  fog: number;
  atmosphere: "rain" | "leaves" | "dust" | "coastal";
  preview: { camera: readonly [number,number,number]; focus: readonly [number,number,number] };
}
export const MAPS: MapDefinition[] = [
  {
    id: "shibuya",
    name: "Shibuya After Dark",
    shortName: "Shibuya",
    inspiration: "JUJUTSU KAISEN",
    description: "Neon nights. One legendary crossing.",
    sky: "#252d48",
    ground: "#303544",
    accent: "#867099",
    ambient: "#acb9ef",
    sun: "#d6c6f0",
    intensity: 1.65,
    sunIntensity: 1.2, rimIntensity: .55, groundLight: "#555779", sunDirection: [-35,60,25], fog: .0019, atmosphere: "rain", preview: {camera:[235,265,340],focus:[0,8,-35]},
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
    intensity: 1.65,
    sunIntensity: 2.1, rimIntensity: .3, groundLight: "#8f8764", sunDirection: [-70,90,35], fog: .0015, atmosphere: "leaves", preview: {camera:[220,245,340],focus:[0,12,-55]},
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
    intensity: 1.8,
    sunIntensity: 2.4, rimIntensity: .25, groundLight: "#9b9877", sunDirection: [-55,110,45], fog: .0012, atmosphere: "dust", preview: {camera:[240,300,350],focus:[0,2,-15]},
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
    intensity: 1.7,
    sunIntensity: 2, rimIntensity: .35, groundLight: "#8b977b", sunDirection: [-75,85,55], fog: .0014, atmosphere: "coastal", preview: {camera:[280,280,390],focus:[0,0,35]},
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
