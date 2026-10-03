import { BoostMotion, boostKind, breathing, PreviewMotion, previewBlink, type PresentationFrame } from './presentation';
import { FoodInstances } from './food-instances';
import { LobbyLighting } from './lobby-staging';
import { frameLobby, lobbyFitPoints, stageLobbyEnvironment, type LobbyFrame } from './lobby-framing';
import { FrameProfiler, GpuTimer } from './frame-profiler';
import { dirtyRange, FoodColors, SnakeInstances } from './instance-updates';
import type { BodySkinId, TrailId } from './progression';
import * as THREE from "three";
import {
  Arena,
  CHARACTERS,
  RADIUS,
  VEIL_RADIUS,
  angleDelta,
  type GameEvent,
  bodyRadiusAt,
  serpentScale,
  type CharacterId,
} from "./simulation";
import { SkillEffects } from "./skill-effects";
import { createHead, createHeadOutline, createTransformedHead, createTransformedHeadOutline } from "./models";
import { selectKitsuProfile } from './kitsu-head';
import {preloadNormalHeads} from './normal-head-assets';
import {kuramaAssets} from './kurama-assets';
import {preloadLivingAssets} from './living-assets';
import {gear5Expression} from './skybreaker';
import { UltimateVisualClock } from './ultimate-visual';
import { UltimateBlast, UltimateCameraPunch } from './ultimate-blast';
import { cinematicImpactAnchor } from './ultimate-presentation';
import { SpiritCinematic } from "./spirit";
import { FoxCinematic } from "./fox";
import { SkybreakerCinematic } from "./skybreaker";
import { PurpleCinematic } from "./purple";
import { renderAnchor, updateRenderAnchor, type RenderAnchor } from './vfx-anchors';
import { MAPS, getMap, type MapId } from "./maps";
import { buildEnvironment, type Environment } from "./environments";
import { profileFor, VisualClock, reaction, type EnvironmentFrame } from "./worlds/types";
import type { GraphicsChoice } from './game-settings';
import { bodySkinAppearance, BOT_OUTLINE_COLOR, createSpiritweavePixels, isPlayerMarkSegment, PLAYER_MARK_INTERVAL, PLAYER_OUTLINE_COLOR, SPIRITWEAVE_SIZE, transformationCoilFinish } from "./coil-skins";
const bodyGeo = new THREE.SphereGeometry(1, 11, 7),
  dummy = new THREE.Object3D();
const playerMarkGeo = new THREE.BufferGeometry();
const markPoints = [[0, .25], [-.055, .065], [-.18, 0], [-.055, -.065],
  [0, -.25], [.055, -.065], [.18, 0], [.055, .065]];
const markVertices: number[] = [];
for (let i = 0; i < markPoints.length; i++) {
  const point = markPoints[i], next = markPoints[(i + 1) % markPoints.length];
  markVertices.push(0, 0, 0, point[0], 0, point[1], next[0], 0, next[1]);
}
playerMarkGeo.setAttribute('position', new THREE.Float32BufferAttribute(markVertices, 3));
function createPlayerMarks(capacity: number) {
  const mesh = new THREE.InstancedMesh(playerMarkGeo, new THREE.MeshBasicMaterial({
    color: '#fff1d9', side: THREE.DoubleSide, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  }), capacity);
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
interface SnakeVisual {
  instances: SnakeInstances;
  character: CharacterId;
  head: THREE.Group;
  headOutline: THREE.Mesh;
  eyes: THREE.Object3D[];
  formHead?: THREE.Group;
  formOutline?: THREE.Mesh;
  body: THREE.InstancedMesh;
  aura: THREE.Mesh;
  outline: THREE.InstancedMesh;
  shadow: THREE.InstancedMesh;
  marks?: THREE.InstancedMesh;
  colorKey: string;
  coloredCount: number;
  formKind?: 'nine-tail' | 'skybreaker';
}
type FrameSample = { ms: number; calls: number; triangles: number; snakes: number };
type SamplePhase = "normal" | "hollow-purple" | "spirit-bomb" | "nine-tail" | "skybreaker";
function summarizeSamples(samples: readonly FrameSample[]) {
  const times = samples.map(sample => sample.ms).sort((a, b) => a - b);
  const median = (values: number[]) => values[Math.floor(values.length * .5)] ?? 0;
  const calls = samples.map(sample => sample.calls).sort((a, b) => a - b);
  const triangles = samples.map(sample => sample.triangles).sort((a, b) => a - b);
  return {
    frameMsMedian: median(times), frameMsP95: times[Math.floor(times.length * .95)] ?? 0,
    callsMedian: median(calls), trianglesMedian: median(triangles),
    snakeCountMin: samples.length ? Math.min(...samples.map(sample => sample.snakes)) : 0,
    samples: samples.length,
  };
}
export class GameRenderer {
  private submissionBreakdown:Record<string,number>|undefined;
  /** One separate diagnostic draw: its hook overhead is excluded from benchmarks. */
  measureDrawCalls(){
    const labels=new Map<THREE.Object3D,string>(),hooks=new Map<THREE.Object3D,THREE.Object3D['onBeforeRender']>(),calls:Record<string,number>={};
    const label=(root:THREE.Object3D|undefined,name:string)=>root?.traverse(o=>labels.set(o,name));
    label(this.environment?.group,'environment');label(this.skillEffects.group,'skills');
    label(this.fox.group,'fox');label(this.purple.group,'purple');label(this.skybreaker.group,'skybreaker');label(this.spirit.presentationGroup,'spirit');label(this.food,'food');label(this.ultimateBlast.group,'ultimate-blast');
    for(const v of this.visuals.values()){
      label(v.head,'heads');label(v.headOutline,'heads');label(v.formHead,'heads');label(v.formOutline,'heads');
      label(v.body,'body');label(v.outline,'outline');label(v.shadow,'shadow');label(v.marks,'ownership');label(v.aura,'aura');
    }
    this.scene.traverse(o=>{if(!('material' in o))return;const original=o.onBeforeRender;hooks.set(o,original);
      o.onBeforeRender=function(...args){const name=labels.get(o)??'ordinary-scene';calls[name]=(calls[name]??0)+1;original.apply(this,args);};});
    try{this.renderer.render(this.scene,this.camera);this.submissionBreakdown=calls;return calls;}
    finally{for(const [o,hook] of hooks)o.onBeforeRender=hook;}
  }
  readonly profiler = new FrameProfiler();
  private gpuTimer: GpuTimer;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 600);
  cinematicCameraEnabled = true;
  reducedFlashes = false;
  ultimateBlastEnabled = true;
  private ultimateClock = new UltimateVisualClock();
  private ultimateBlast = new UltimateBlast(this.scene);
  private ultimatePunch = new UltimateCameraPunch();
  private preparedUltimate = false;
  private ultimateAnchor = new THREE.Vector3();
  private ultimateGather = new THREE.Vector3();
  get ultimateVisual(): Readonly<import("./ultimate-visual").UltimateVisualFrame> { return this.ultimateClock.frame; }
  get ultimateDiagnostics() { return this.ultimateBlast.diagnostics(); }
  prepareUltimateFrame(arena: Arena|undefined, reducedMotion: boolean, reducedFlashes: boolean, cameraEnabled: boolean, advancing: boolean) {
    this.reducedFlashes=reducedFlashes;this.preparedUltimate=true;
    return this.ultimateClock.update(arena?.player.alive&&arena.state!=='over'?arena.cinematic:undefined,reducedMotion,reducedFlashes,cameraEnabled,advancing);
  }
  private readonly gameplayCameraPosition = new THREE.Vector3();
  private readonly gameplayCameraRotation = new THREE.Quaternion();
  visuals = new Map<number, SnakeVisual>();
  private effectAnchors = new Map<number, RenderAnchor>();
  food: THREE.InstancedMesh;
  hero = new THREE.Group();
  heroHead: THREE.Group | null = null;
  private previewEyes: THREE.Object3D[] = [];
  private previewMotion = new PreviewMotion();
  reactToSelection() { this.previewMotion.select(); }
  heroId: CharacterId = "ember";
  mode: "menu" | "game" = "menu";
  private skillEffects = new SkillEffects();
  handleEvents(events: readonly GameEvent[], arena: Arena) { this.skillEffects.ingest(events, arena.player.boosting, arena.player.angle); }
  clearEffects() { this.lastEnvironmentFrame=undefined; this.ultimateClock.reset(); this.ultimateBlast.clear(); this.preparedUltimate=false; this.environment?.clearPresentation(); this.fox?.clear(); this.skybreaker?.clear(); this.spirit?.clear();this.purple?.clear(); this.skillEffects.clear(); this.effectAnchors.clear(); this.boostMotion.reset(); this.previewMotion.reset(); this.boostCamera = 0; this.camera.fov = 43; this.camera.updateProjectionMatrix(); }
  readonly boostMotion = new BoostMotion();
  private focus = new THREE.Vector3();
  private focusTarget = new THREE.Vector3();
  private skyViewDirection = new THREE.Vector3();
  private diagnosticFrustum = new THREE.Frustum();
  private diagnosticProjection = new THREE.Matrix4();
  private diagnosticSphere = new THREE.Sphere();
  private boostCamera = 0;
  private graphicsChoice: GraphicsChoice = 'auto';
  onHeadProfileLoad: (loading:boolean,ready:boolean)=>void = ()=>{};
  setGraphicsChoice(choice: GraphicsChoice) { this.graphicsChoice = choice; this.resize(); }
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private target = new THREE.Vector3();
  private stampTarget = new THREE.Vector3();
  projectPoint(x: number, z: number, out: { x: number; y: number }, height = 1.5, allowOffscreen = false) {
    this.stampTarget.set(x, height, z).project(this.camera);
    if (!Number.isFinite(this.stampTarget.x) || !Number.isFinite(this.stampTarget.y) ||
      this.stampTarget.z < -1 || this.stampTarget.z > 1 ||
      (!allowOffscreen && (Math.abs(this.stampTarget.x) > 1 || Math.abs(this.stampTarget.y) > 1))) return false;
    out.x = (this.stampTarget.x + 1) * innerWidth * .5;
    out.y = (1 - this.stampTarget.y) * innerHeight * .5;
    return true;
  }
  private foodColors = CHARACTERS.map((c) => new THREE.Color(c.color));
  private foodInstances!: FoodInstances;
  private foodColorCache = new FoodColors();
  private ring: THREE.Mesh;
  private visualClock = new VisualClock();
  private visualFrame = { time: 0, dt: 0, paused: false, reducedMotion: false };
  get presentation(): PresentationFrame { return this.visualFrame; }
  private coilColors = new Map<CharacterId, readonly [THREE.Color, THREE.Color]>(
    CHARACTERS.map(c => [c.id, [new THREE.Color(c.color), new THREE.Color(c.secondary)]]),
  );
  private frozenColor = new THREE.Color('#bdeeff');
  private foxFormColors: readonly [THREE.Color, THREE.Color] = [new THREE.Color(transformationCoilFinish('nine-tail').base),new THREE.Color(transformationCoilFinish('nine-tail').accent)];
  private cloudFormColors: readonly [THREE.Color, THREE.Color] = [new THREE.Color(transformationCoilFinish('skybreaker').base),new THREE.Color(transformationCoilFinish('skybreaker').accent)];
  private bodySkin: BodySkinId = 'original';
  private menuSkinPreview: BodySkinId | null = null;
  private spiritweaveTexture = (() => {
    const texture = new THREE.DataTexture(
      createSpiritweavePixels(),
      SPIRITWEAVE_SIZE,
      SPIRITWEAVE_SIZE,
      THREE.RGBAFormat,
    );
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  })();
  private profile = profileFor(innerWidth, matchMedia("(pointer:coarse)").matches);
  private samples: Record<SamplePhase, FrameSample[]> = { normal: [], "hollow-purple": [], "spirit-bomb": [], "nine-tail": [], skybreaker: [] };
  private frameStamp = 0;
  private environment?: Environment;
  private hemisphere = new THREE.HemisphereLight("#dde7ff", "#394354", 2.5);
  private sunlight = new THREE.DirectionalLight("#fff1d9", 3);
  private rimLight = new THREE.DirectionalLight("#9773ff", 1.8);
  private lobbyLighting = new LobbyLighting(this.hemisphere, this.sunlight, this.rimLight);
  private lobbyViewport = { x: 0, y: 0, width: 1, height: 1 };
  private lobbyBounds = new THREE.Box3();
  private lobbyPoints: THREE.Vector3[] = [];
  private lobbyFrame?: LobbyFrame;
  mapId: MapId = "shibuya";
  private fox: FoxCinematic;
  private skybreaker: SkybreakerCinematic;
  private foxTint = new THREE.Color("#ffa343");
  private purpleTint = new THREE.Color("#aa65ff");
  private spiritTint=new THREE.Color("#81d9ff");
  private skybreakerTint=new THREE.Color("#fff0c3");
  private lastEnvironmentFrame?:EnvironmentFrame;
  disposeCinematics() { this.ultimateBlast.dispose(); this.gpuTimer.dispose(); this.fox.dispose(); this.skybreaker.dispose(); this.spirit.dispose();this.purple.dispose(); }
  private purple: PurpleCinematic;
  private spirit: SpiritCinematic;
  setCosmetics(skin: BodySkinId = 'original', trail: TrailId = 'original') {
    this.bodySkin = skin;
    this.skillEffects.setBoostTrail(trail);
    const previewCoil = this.hero.children.find(child => child instanceof THREE.InstancedMesh && child.userData.previewCoil);
    if (previewCoil instanceof THREE.InstancedMesh) {
      this.applySkin(previewCoil, previewCoil.userData.previewOutline as THREE.InstancedMesh, this.heroId, this.menuSkinPreview ?? skin);
    }
    const playerVisual = this.visuals.get(0);
    if (playerVisual) {
      this.applySkin(playerVisual.body, playerVisual.outline, playerVisual.character);
      if (playerVisual.formKind) this.applyFormFinish(playerVisual,playerVisual.formKind);
      playerVisual.colorKey = '';
    }
  }
  setMenuSkinPreview(skin: BodySkinId | null) {
    this.menuSkinPreview = skin;
    const coil = this.hero.children.find(child => child instanceof THREE.InstancedMesh && child.userData.previewCoil);
    if (coil instanceof THREE.InstancedMesh)
      this.applySkin(coil, coil.userData.previewOutline as THREE.InstancedMesh, this.heroId, skin ?? this.bodySkin);
  }
  private applySkin(body: THREE.InstancedMesh, outline: THREE.InstancedMesh, character: CharacterId, skin = this.bodySkin) {
    const characterColor = CHARACTERS.find(item => item.id === character)!.color;
    const appearance = bodySkinAppearance(skin, characterColor);
    const material = body.material as THREE.MeshToonMaterial;
    material.map = appearance.texture === 'spiritweave' ? this.spiritweaveTexture : null;
    material.emissive.set(appearance.emissiveColor);
    material.emissiveIntensity = appearance.emissiveIntensity;
    material.needsUpdate = true;
    (outline.material as THREE.MeshBasicMaterial).color.set(appearance.outlineColor);
  }
  private applyFormFinish(v: SnakeVisual, kind: 'nine-tail' | 'skybreaker') {
    const finish=transformationCoilFinish(kind);
    const material = v.body.material as THREE.MeshToonMaterial;
    material.map = null;
    material.emissive.set(finish.emissive);
    material.emissiveIntensity = finish.emissiveIntensity;
    material.needsUpdate = true;
    (v.outline.material as THREE.MeshBasicMaterial).color.set(finish.outline);
  }
  constructor(public canvas: HTMLCanvasElement, graphicsChoice: GraphicsChoice = 'auto') {
    this.graphicsChoice=graphicsChoice;
    this.profile=graphicsChoice==='low'?'mobile':graphicsChoice==='high'?'desktop':profileFor(innerWidth,matchMedia('(pointer:coarse)').matches);
    selectKitsuProfile(this.profile);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.gpuTimer = new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext);
    this.profiler.enabled = new URLSearchParams(location.search).has('worldDebug') || new URLSearchParams(location.search).has('perfDebug');
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, innerWidth < 700 ? 1.35 : 1.5),
    );
    this.renderer.setClearColor("#10121d");
    this.scene.fog = new THREE.FogExp2("#10121d", 0.004);
    this.sunlight.position.set(-12, 30, 20);
    this.rimLight.position.set(10, 10, -15);
    this.scene.add(this.hemisphere, this.sunlight, this.rimLight, this.skillEffects.group);
    this.skillEffects.setProfile(this.profile);
    const ringGeo = new THREE.RingGeometry(RADIUS - 0.3, RADIUS + 0.3, 180);
    this.ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: "#ff765d",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = -0.4;
    this.scene.add(this.ring);
    const fence = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS, RADIUS, 3, 128, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#ff765d",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
      }),
    );
    fence.position.y = 1;
    this.scene.add(fence);
    this.food = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.29),
      new THREE.MeshBasicMaterial({ color: "white" }),
      1700,
    );
    this.food.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.food.frustumCulled = true;
    this.foodInstances = new FoodInstances(this.food);
    this.scene.add(this.food);
    this.scene.add(this.hero);
    this.fox = new FoxCinematic(this.scene, this.profile);
    const gl=this.renderer.getContext();this.fox.setMultisampleFade(gl.getParameter(gl.SAMPLES));
    this.skybreaker = new SkybreakerCinematic(this.scene, this.profile);
    this.purple = new PurpleCinematic(this.scene, this.profile);
    this.spirit = new SpiritCinematic(this.scene, this.profile);
    void this.renderer.compileAsync(this.ultimateBlast.group,this.camera,this.scene).catch(()=>{});
    this.setHero("ember");
    this.setMap("shibuya");
    this.resize();
  }
  setMap(id: MapId, preserveCinematics = false) {
    if(!preserveCinematics){this.ultimateClock.reset();this.ultimateBlast.clear();this.fox?.clear(); this.spirit?.clear(); this.skybreaker?.clear();this.purple?.clear();}
    if (this.environment) {
      this.scene.remove(this.environment.group);
      this.environment.dispose();
    }
    this.mapId = id;
    const def = getMap(id);
    this.environment = buildEnvironment(id, this.profile);
    if(preserveCinematics&&this.lastEnvironmentFrame)this.environment.update({...this.lastEnvironmentFrame,paused:false,dt:0});
    this.scene.add(this.environment.group);
    this.renderer.setClearColor(def.sky);
    this.scene.fog = new THREE.FogExp2(def.sky, def.fog);
    this.hemisphere.color.set(def.ambient);
    this.hemisphere.intensity = def.intensity;
    this.hemisphere.groundColor.set(def.groundLight);
    this.sunlight.color.set(def.sun);
    this.sunlight.intensity = def.sunIntensity;
    this.sunlight.position.set(...def.sunDirection);
    this.rimLight.color.set(def.accent);
    this.rimLight.intensity = def.rimIntensity;
    this.lobbyLighting.invalidate();
    (this.ring.material as THREE.MeshBasicMaterial).color.set(def.accent);
    this.updateLobbyViewport();
  }
  mapThumbnails() {
    const images: string[] = [];
    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 1, 1200);
    camera.position.set(230, 300, 330);
    camera.lookAt(0, 0, 0);
    this.renderer.setSize(320, 180, false);
    for (const def of MAPS) {
      const env = buildEnvironment(def.id, this.profile),
        scene = new THREE.Scene();
      camera.position.set(...def.preview.camera);
      camera.lookAt(...def.preview.focus);
      scene.fog = new THREE.FogExp2(def.sky, def.fog);
      scene.add(env.group);
      scene.add(
        new THREE.HemisphereLight(def.ambient, def.groundLight, def.intensity),
      );
      const sun = new THREE.DirectionalLight(def.sun, def.sunIntensity);
      sun.position.set(...def.sunDirection);
      const rim = new THREE.DirectionalLight(def.accent, def.rimIntensity);
      rim.position.copy(this.rimLight.position); scene.add(rim);
      scene.add(sun);
      this.renderer.setClearColor(def.sky);
      this.renderer.render(scene, camera);
      images.push(this.canvas.toDataURL());
      env.dispose();
    }
    this.renderer.setClearColor(getMap(this.mapId).sky);
    this.resize();
    return images;
  }
  portraits() {
    const result: string[] = [];
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#fff4e6", "#555d90", 3));
    const light = new THREE.DirectionalLight("#ffffff", 3);
    light.position.set(-4, 8, 7);
    scene.add(light);
    const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    cam.position.set(0, 2.8, 7.5);
    cam.lookAt(0, 1.3, 0);
    this.renderer.setSize(256, 256, false);
    this.renderer.setClearColor("#e5e9cf", 1);
    for (const c of CHARACTERS) {
      const h = createHead(c.id);
      h.rotation.y = -0.2;
      scene.add(h);
      this.renderer.render(scene, cam);
      result.push(this.canvas.toDataURL());
      scene.remove(h);
    }
    this.renderer.setClearColor(getMap(this.mapId).sky);
    this.resize();
    return result;
  }
  diagnostics() {
    this.camera.updateMatrixWorld();
    this.diagnosticFrustum.setFromProjectionMatrix(this.diagnosticProjection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse));
    let visibleSegments=0;
    for(const visual of this.visuals.values()) {if(!visual.body.visible)continue;const a=visual.body.instanceMatrix.array;
      for(let i=0;i<visual.body.count;i++){const o=i*16;this.diagnosticSphere.center.set(a[o+12],a[o+13],a[o+14]);this.diagnosticSphere.radius=Math.max(Math.abs(a[o]),Math.abs(a[o+5]),Math.abs(a[o+10]));
        if(this.diagnosticFrustum.intersectsSphere(this.diagnosticSphere))visibleSegments++;}}
    this.profiler.counts.visibleSegments=visibleSegments;
    const info = this.renderer.info;
    const normal = summarizeSamples(this.samples.normal);
    return {
      drawCallsBySubsystem:this.submissionBreakdown??null,
      map: this.mapId, profile: this.profile, environment: this.environment?.stats,
      game: { calls: info.render.calls, triangles: info.render.triangles, ...normal },
      phases: {
        normal,
        hollowPurple: summarizeSamples(this.samples["hollow-purple"]),
        spiritBomb: summarizeSamples(this.samples["spirit-bomb"]),
        foxSpiritBomb: summarizeSamples(this.samples["nine-tail"]),
        skybreaker: summarizeSamples(this.samples.skybreaker),
      },
      memory: { ...info.memory, programs: info.programs?.length ?? 0 }, snakes: this.visuals.size,
      performance: this.profiler.snapshot(), gpu: this.gpuTimer.snapshot(),
    };
  }
  resetMeasurements(){this.samples = { normal: [], "hollow-purple": [], "spirit-bomb": [], "nine-tail": [], skybreaker: [] }; this.frameStamp = 0;this.profiler.reset();this.gpuTimer.reset();}
  setHero(id: CharacterId) {
    this.previewMotion.reset();
    this.previewEyes.length = 0;
    this.heroId = id;
    this.hero.position.set(0, 0, 0);
    this.hero.rotation.set(0, 0, 0);
    this.hero.scale.setScalar(1);
    while (this.hero.children.length) {
      const o = this.hero.children[0];
      this.hero.remove(o);
      if (o instanceof THREE.InstancedMesh) {
        o.dispose();
        (o.material as THREE.Material).dispose();
      } else if (o instanceof THREE.Mesh && !o.userData.sharedSilhouette) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    }
    const c = CHARACTERS.find((c) => c.id === id)!;
    const body = new THREE.InstancedMesh(
      bodyGeo,
      new THREE.MeshToonMaterial({ color: "white" }),
      70,
    );
    body.userData.previewCoil = true;
    const bodyOutline = new THREE.InstancedMesh(
      bodyGeo,
      new THREE.MeshBasicMaterial({ color: PLAYER_OUTLINE_COLOR, side: THREE.BackSide }),
      70,
    );
    const marks = createPlayerMarks(Math.ceil(70 / PLAYER_MARK_INTERVAL));
    body.userData.previewOutline = bodyOutline;
    this.applySkin(body, bodyOutline, id, this.menuSkinPreview ?? this.bodySkin);
    let markCount = 0;
    for (let i = 0; i < 70; i++) {
      const t = i / 69;
      const a = t * Math.PI * 2.05;
      dummy.position.set(
        3 + Math.sin(a) * 5.7,
        0.7 + Math.sin(t * 9) * 0.13,
        4 - t * 8 + Math.cos(a) * 2.4,
      );
      const s = (1 - t * 0.6) * 1.08;
      dummy.scale.set(s, s * 0.8, s);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      dummy.scale.multiplyScalar(1.06);
      dummy.updateMatrix();
      bodyOutline.setMatrixAt(i, dummy.matrix);
      if (isPlayerMarkSegment(i + 1)) {
        dummy.position.y += s * .8 * .97;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        marks.setMatrixAt(markCount++, dummy.matrix);
      }
      const colors = this.coilColors.get(id)!;
      body.setColorAt(i, colors[i % 5 === 0 ? 1 : 0]);
    }
    marks.count = markCount;
    marks.computeBoundingSphere();
    this.hero.add(bodyOutline, body, marks);
    this.heroHead = createHead(id);
    this.heroHead.traverse(node => { if (node.userData.previewEye) this.previewEyes.push(node); });
    this.heroHead.position.set(3, 1.0, 6.6);
    this.heroHead.scale.setScalar(1.5);
    this.heroHead.rotation.y = 0.35;
    const headOutline = createHeadOutline(id);
    headOutline.position.copy(this.heroHead.position);
    headOutline.rotation.copy(this.heroHead.rotation);
    headOutline.scale.setScalar(1.5 * 1.006);
    this.hero.add(headOutline, this.heroHead);
    this.hero.updateMatrixWorld(true);
    this.lobbyBounds.setFromObject(this.hero);
    this.lobbyPoints = lobbyFitPoints(this.hero);
    this.updateLobbyViewport();
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    const profile = this.graphicsChoice === 'auto' ? profileFor(w, matchMedia("(pointer:coarse)").matches) : this.graphicsChoice === 'low' ? 'mobile' : 'desktop';
    selectKitsuProfile(profile);
    if (this.profile !== profile) { this.profile = profile; this.skillEffects.setProfile(profile); this.fox.setProfile(profile); this.skybreaker.setProfile(profile); this.spirit.setProfile(profile); this.purple.setProfile(profile); this.setMap(this.mapId,true);
      this.onHeadProfileLoad(true,false);
      void Promise.all([preloadNormalHeads(profile),kuramaAssets.preload(profile),preloadLivingAssets(profile).then(r=>r.every(Boolean))]).then(ready=>{if(this.profile===profile){this.refreshNormalHeads();this.skybreaker.setProfile(profile);this.setMap(this.mapId,true);this.onHeadProfileLoad(false,ready.every(Boolean));}});
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, w < 700 ? 1.35 : 1.5));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.updateLobbyViewport();
  }
  updateLobbyViewport() {
    const rect = document.getElementById('lobby-showcase')?.getBoundingClientRect();
    const preview = document.getElementById('skin-preview-controls')?.getBoundingClientRect().height ?? 0;
    const availableHeight = Math.max(1, (rect?.height || innerHeight * .6) - preview - 24);
    this.lobbyViewport.x = rect ? rect.left + rect.width / 2 : innerWidth / 2;
    this.lobbyViewport.y = rect ? rect.top + 12 + availableHeight / 2 : innerHeight / 2;
    this.lobbyViewport.width = Math.max(1, rect?.width || innerWidth * .5);
    this.lobbyViewport.height = availableHeight;
    if (!this.lobbyBounds.isEmpty()) this.lobbyFrame = frameLobby(this.lobbyBounds, getMap(this.mapId),
      this.lobbyViewport.width, availableHeight, innerHeight, 55, this.lobbyPoints);
    if (this.mode === 'menu') this.applyLobbyProjection();
  }
  private applyLobbyProjection() {
    this.camera.setViewOffset(innerWidth, innerHeight, innerWidth / 2 - this.lobbyViewport.x,
      innerHeight / 2 - this.lobbyViewport.y, innerWidth, innerHeight);
  }
  private refreshNormalHeads() {
    const replace=(old:THREE.Object3D,next:THREE.Object3D)=>{next.position.copy(old.position);next.quaternion.copy(old.quaternion);next.scale.copy(old.scale);next.visible=old.visible;old.parent?.add(next);old.removeFromParent();};
    for(const visual of this.visuals.values()){
      const head=createHead(visual.character),outline=createHeadOutline(visual.character);replace(visual.head,head);replace(visual.headOutline,outline);visual.head=head;visual.headOutline=outline;visual.eyes=[];head.traverse(o=>{if(o.userData.previewEye)visual.eyes.push(o);});
      if(visual.character==='cloud'&&visual.formHead&&visual.formOutline){const form=createTransformedHead('cloud'),formOutline=createTransformedHeadOutline('cloud');replace(visual.formHead,form);replace(visual.formOutline,formOutline);visual.formHead=form;visual.formOutline=formOutline;}
    }
    this.setHero(this.heroId);
  }
  steering(x: number, y: number, arena: Arena) {
    this.ray.setFromCamera(
      new THREE.Vector2((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2),
      this.camera,
    );
    if (this.ray.ray.intersectPlane(this.plane, this.target))
      return Math.atan2(
        this.target.z - arena.player.z,
        this.target.x - arena.player.x,
      );
    return arena.player.angle;
  }
  start(arena: Arena) {
    this.clearEffects();
    this.skillEffects.seed(arena);
    for (const v of this.visuals.values()) {
      this.scene.remove(v.head, v.headOutline, v.body, v.aura, v.outline, v.shadow);
      if(v.formHead)this.scene.remove(v.formHead);
      if(v.formOutline)this.scene.remove(v.formOutline);
      if (v.marks) { this.scene.remove(v.marks); v.marks.dispose(); (v.marks.material as THREE.Material).dispose(); }
      v.outline.dispose(); (v.outline.material as THREE.Material).dispose();
      v.shadow.dispose(); v.shadow.geometry.dispose(); (v.shadow.material as THREE.Material).dispose();
      v.body.dispose();
      (v.body.material as THREE.Material).dispose();
      v.aura.geometry.dispose();
      (v.aura.material as THREE.Material).dispose();
    }
    this.visuals.clear();
    this.mode = "game";
    this.focus.set(arena.player.x, 0, arena.player.z);
  }
  render(arena: Arena | undefined, time: number, alpha: number, dt: number, reducedMotion = false, simulationStep?: number) {
    const ownsFrame = !this.profiler.inFrame;
    if(ownsFrame)this.profiler.beginFrame();
    const snakeStamp = this.profiler.stamp();
    const menu = this.mode === "menu";
    if (this.lobbyLighting.apply(getMap(this.mapId), menu)) {
      if (menu) this.updateLobbyViewport();
      else this.camera.clearViewOffset();
    }
    const paused = document.hidden || (!!arena && arena.state !== "playing" && !menu);
    time = this.visualClock.advance(dt, paused, document.hidden);
    this.visualFrame.time = time; this.visualFrame.dt = paused ? 0 : Math.min(dt, .1);
    this.visualFrame.paused = paused; this.visualFrame.reducedMotion = reducedMotion;
    this.boostMotion.update(!menu && arena ? boostKind(arena.player, arena.state === 'playing', !!arena.cinematic, false) : 'none', this.visualFrame.dt);
    const stamp = performance.now();
    const frameInterval = this.frameStamp ? stamp - this.frameStamp : 0;
    this.frameStamp=stamp;
    this.profiler.rafMs=frameInterval;
    if (this.environment) stageLobbyEnvironment(this.environment.group, menu, this.lobbyFrame?.environmentScale ?? .32);
    this.hero.visible = menu;
    this.food.visible = !menu;
    this.ring.visible = !menu;
    const nextFov = menu ? 55 : this.boostMotion.fov(reducedMotion);
    if(Math.abs(nextFov-this.camera.fov)>.005) { this.camera.fov=nextFov; this.camera.updateProjectionMatrix(); }

    if (menu) {
      for (const v of this.visuals.values()) {
        v.head.visible = false;
        if(v.formHead)v.formHead.visible=false;
        if(v.formOutline)v.formOutline.visible=false;
        v.body.visible = false;
        v.aura.visible = false;
        v.outline.visible = v.headOutline.visible = v.shadow.visible = false;
        if (v.marks) v.marks.visible = false;
      }
      this.hero.scale.setScalar(1);
      if (this.lobbyFrame) {
        this.hero.position.copy(this.lobbyFrame.heroPosition);
        this.camera.position.copy(this.lobbyFrame.position);
        this.camera.lookAt(this.lobbyFrame.target);
      }
      if (this.heroHead) {
        this.previewMotion.update(this.visualFrame.dt, reducedMotion);
        const reaction = this.previewMotion.reaction;
        for (const eye of this.previewEyes) eye.scale.y = previewBlink(time + 1.2, this.heroId, reducedMotion);
        const idle = this.heroId === "ember" ? 2.4 : this.heroId === "cloud" ? 2 : this.heroId === "nova" ? 1.4 : .9;
        this.heroHead.position.y = 1 + (reducedMotion ? 0 : Math.sin(time * idle) * .07 + reaction * .12);
        this.heroHead.rotation.x = reducedMotion ? 0 : reaction * (this.heroId === 'eclipse' ? .055 : this.heroId === 'nova' ? .09 : .035);
        this.heroHead.rotation.z = reducedMotion ? 0 : Math.sin(time * idle * .5) * .025 + reaction * (this.heroId === 'cloud' ? .1 : this.heroId === 'ember' ? -.065 : 0);
        this.heroHead.rotation.y = .35 + (reducedMotion ? 0 : Math.sin(time * idle * .4) * .05);
      }
      const previewOutline = this.hero.children.find(
        (child) => child instanceof THREE.Mesh && child.userData.sharedSilhouette,
      );
      if (previewOutline && this.heroHead) {
        previewOutline.position.copy(this.heroHead.position);
        previewOutline.rotation.copy(this.heroHead.rotation);
      }
      this.hero.rotation.y = reducedMotion ? 0 : Math.sin(time * 0.18) * 0.1;
    } else if (arena) {
      const p = arena.player;
      const zoom =
        (42 + Math.min(17, p.mass * 0.055)) *
        Math.max(1, 0.85 / this.camera.aspect);
      this.focusTarget.set(p.previous.x + (p.x - p.previous.x) * alpha, 0, p.previous.z + (p.z - p.previous.z) * alpha);
      this.focus.lerp(this.focusTarget, 1 - Math.exp(-this.visualFrame.dt * 8));
      this.boostCamera = this.boostMotion.cameraOffset(reducedMotion);
      this.camera.position.set(
        this.focus.x - Math.cos(p.angle)*this.boostCamera,
        this.focus.y + zoom,
        this.focus.z - Math.sin(p.angle)*this.boostCamera + zoom * 0.57,
      );
      this.camera.lookAt(this.focus.x + Math.cos(p.angle)*this.boostCamera*.55, 0, this.focus.z + Math.sin(p.angle)*this.boostCamera*.55);
      const ids = new Set(arena.snakes.filter((s) => s.alive).map((s) => s.id));
      for (const [id, v] of this.visuals)
        if (!ids.has(id)) {
          this.scene.remove(v.head, v.headOutline, v.body, v.aura, v.outline, v.shadow);
          if (v.formHead) this.scene.remove(v.formHead);
          if (v.formOutline) this.scene.remove(v.formOutline);
          if (v.marks) { this.scene.remove(v.marks); v.marks.dispose(); (v.marks.material as THREE.Material).dispose(); }
      v.outline.dispose(); (v.outline.material as THREE.Material).dispose();
      v.shadow.dispose(); v.shadow.geometry.dispose(); (v.shadow.material as THREE.Material).dispose();
          v.body.dispose();
          (v.body.material as THREE.Material).dispose();
          v.aura.geometry.dispose();
          (v.aura.material as THREE.Material).dispose();
          this.visuals.delete(id);
          this.effectAnchors.delete(id);
        }
      for (const s of arena.snakes) {
        if (!s.alive) continue;
        const c = CHARACTERS.find((c) => c.id === s.character)!;
        let v = this.visuals.get(s.id);
        if (!v) {
          const head = createHead(s.character),
            headOutline = createHeadOutline(s.character),
            body = new THREE.InstancedMesh(
              bodyGeo,
              new THREE.MeshToonMaterial({ color: "white" }),
              360,
            );
          body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          const aura = new THREE.Mesh(
            new THREE.RingGeometry(1.6, 1.68, 48),
            new THREE.MeshBasicMaterial({
              color: c.color,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.65,
              depthWrite: false,
            }),
          );
          aura.rotation.x = -Math.PI / 2;
          const outline = new THREE.InstancedMesh(
            bodyGeo,
            new THREE.MeshBasicMaterial({
              color: s.id === 0 ? PLAYER_OUTLINE_COLOR : BOT_OUTLINE_COLOR,
              side: THREE.BackSide,
            }),
            360,
          );
          const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(1,16),new THREE.MeshBasicMaterial({color:"#635c67",transparent:true,opacity:.14,depthWrite:false}),360);
          const marks = s.id === 0 ? createPlayerMarks(Math.ceil(360 / PLAYER_MARK_INTERVAL)) : undefined;
          const eyes:THREE.Object3D[]=[];head.traverse(o=>{if(o.userData.previewEye)eyes.push(o);});
          v = { instances:new SnakeInstances(), character: s.character, head, headOutline, eyes, body, aura, outline, shadow, marks, colorKey: "", coloredCount: 0 };
          if (s.id === 0 && (s.character === 'ember' || s.character === 'cloud')) {
            v.formHead = createTransformedHead(s.character);
            v.formOutline = createTransformedHeadOutline(s.character);
            v.formHead.visible = v.formOutline.visible = false;
            this.scene.add(v.formOutline, v.formHead);
          }
          if (s.id === 0) this.applySkin(body, outline, s.character);
          this.visuals.set(s.id, v);
          this.scene.add(outline, headOutline, head, body, aura, shadow);
          if (marks) this.scene.add(marks);
        }
        const formKind = s.id === 0 && arena.cinematic?.kind === 'fox' ? 'nine-tail' : s.id === 0 && arena.cinematic?.kind === 'skybreaker' && s.character === 'cloud' ? 'skybreaker' : undefined;
        if (v.formKind !== formKind) {
          if (formKind) this.applyFormFinish(v, formKind);
          else if (s.id === 0) this.applySkin(v.body,v.outline,s.character);
          v.formKind = formKind;
          v.colorKey = '';
        }
        v.head.visible = !formKind;
        if(s.character==='ember')for(const eye of v.eyes)eye.scale.y=previewBlink(time+s.id*.37,s.character,reducedMotion||!!formKind);
        if (v.formHead) v.formHead.visible = !!formKind;
        v.body.visible = true;
        v.outline.visible = true;
        v.headOutline.visible = !formKind;
        if (v.formOutline) v.formOutline.visible = !!formKind;
        v.shadow.visible = true;
        if (v.marks) v.marks.visible = true;
        v.aura.visible = s.id === 0 || s.active > 0 || s.frozen || s.slowed;
        (v.aura.material as THREE.MeshBasicMaterial).color.set(
          s.frozen ? "#547a8e" : s.slowed ? "#ad8bcf" : c.color,
        );
        (v.aura.material as THREE.MeshBasicMaterial).opacity = s.character === 'eclipse' && s.active > 0 ? .82 : .65;
        // Bodies and collisions use the current fixed-step state. Rendering
        // an older interpolated head makes a hit register ahead of its face.
        const hx = s.x,
          hz = s.z;
        const size = serpentScale(s.mass);
        v.head.scale.setScalar(size);
        const still = reducedMotion || s.frozen || !!arena.cinematic || s.active > 0 || !!s.charge;
        v.head.position.set(hx, (.55 + breathing(time, s.id, s.boosting, still)) * size, hz);
        const elastic = !reducedMotion && !s.frozen && s.character === "cloud" && s.active > 0;
        const squash = elastic ? 1 + Math.sin(time * 11) * .12 : 1;
        const boostPose = s.id === 0 ? this.boostMotion.intensity : s.boosting ? 1 : 0;
        const foxPose = s.character === 'ember' && s.active > 0;
        const compression = reducedMotion ? 1 : 1 - boostPose * (foxPose ? .045 : .025);
        v.head.scale.y = size * squash * compression;
        v.head.rotation.set(reducedMotion ? 0 : boostPose * (foxPose ? .16 : .08), Math.PI / 2 - s.angle, elastic ? THREE.MathUtils.clamp(angleDelta(s.previousAngle,s.angle) * 2,-.16,.16) : 0);
        v.headOutline.scale.copy(v.head.scale).multiplyScalar(1.006);
        v.headOutline.position.copy(v.head.position);
        v.headOutline.rotation.copy(v.head.rotation);
        if (v.formHead && v.formOutline) {
          v.formHead.position.copy(v.head.position); v.formHead.rotation.copy(v.head.rotation); v.formHead.scale.copy(v.head.scale);
          v.formOutline.position.copy(v.headOutline.position); v.formOutline.rotation.copy(v.headOutline.rotation); v.formOutline.scale.copy(v.headOutline.scale);
          if(formKind==='skybreaker'&&arena.cinematic){
            const expression=gear5Expression(arena.cinematic.time,reducedMotion),eyes=v.formHead.userData.expressionPivot as THREE.Object3D|undefined;
            for(const object of [v.formHead,v.formOutline]){object.scale.x*=expression.x;object.scale.y*=expression.y;object.position.y+=expression.bounce*size;}
            if(eyes){eyes.position.z=expression.eyePop*.14;eyes.scale.set(1+expression.eyePop*.12,1+expression.eyePop*.3,1);}
          }
        }
        const cachedAnchor=this.effectAnchors.get(s.id);
        this.effectAnchors.set(s.id,cachedAnchor?updateRenderAnchor(cachedAnchor,s.character,v.head.position.x,v.head.position.y,v.head.position.z,s.angle,size):renderAnchor(s.character,v.head.position.x,v.head.position.y,v.head.position.z,s.angle,size));
        v.aura.position.set(hx, -0.35, hz);
        v.aura.rotation.z = s.frozen || reducedMotion ? 0 : time * 0.8;
        const a =
          s.active > 0
            ? s.character === "eclipse"
              ? VEIL_RADIUS / 1.68
              : s.character === "nova"
                ? size
                : 1.4 * size
            : size;
        v.aura.scale.setScalar(a);
        v.body.count = s.body.length - 1;
        v.outline.count = v.body.count;
        v.shadow.count = s.body.length;
        const colorKey = s.frozen ? "frozen" : s.id === 0 ? `${s.character}:${formKind ?? this.bodySkin}` : s.character;
        const repaint = v.colorKey !== colorKey;
        const firstUncolored = repaint ? 0 : v.coloredCount;
        const colors = formKind === 'nine-tail' ? this.foxFormColors : formKind === 'skybreaker' ? this.cloudFormColors : this.coilColors.get(s.character)!;
        v.instances.update(v,s,time,still,elastic,compression,this.profiler,simulationStep);
        for(let i=firstUncolored;i<v.body.count;i++)v.body.setColorAt(i,s.frozen?this.frozenColor:colors[(i+1)%5===0?1:0]);
        v.colorKey = colorKey;
        v.coloredCount = repaint ? v.body.count : Math.max(v.coloredCount, v.body.count);
        if (v.body.instanceColor && firstUncolored < v.body.count) dirtyRange(v.body.instanceColor,firstUncolored*3,(v.body.count-firstUncolored)*3,this.profiler);
      }
      this.food.count = arena.food.length;
      this.profiler.finish('snakes',snakeStamp);
      const foodStamp = this.profiler.stamp();
      this.foodInstances.update(this.food,arena.food,time,reducedMotion,this.profiler);
      this.foodColorCache.update(this.food,arena.food,this.foodColors,this.profiler);
      this.profiler.finish('food',foodStamp);
      if(this.profiler.enabled){let segments=0;for(const s of arena.snakes)if(s.alive)segments+=s.body.length-1;
        Object.assign(this.profiler.counts,{segments,snakes:this.visuals.size,food:arena.food.length,dpr:this.renderer.getPixelRatio()});}
    }
    const effectsStamp=this.profiler.stamp();
    this.skillEffects.update(menu ? undefined : arena, time, this.visualFrame.dt, reducedMotion, this.boostMotion, this.mapId, this.effectAnchors);
    this.gameplayCameraPosition.copy(this.camera.position);
    this.gameplayCameraRotation.copy(this.camera.quaternion);
    if(!this.preparedUltimate)this.prepareUltimateFrame(menu?undefined:arena,reducedMotion,this.reducedFlashes,this.cinematicCameraEnabled,!paused);
    this.preparedUltimate=false;
    const ultimateVisual=this.ultimateBlastEnabled?this.ultimateClock.frame:undefined;
    this.purple.update(arena, this.camera, menu, reducedMotion,this.cinematicCameraEnabled,ultimateVisual);
    this.spirit.update(arena, this.camera, menu, reducedMotion, this.cinematicCameraEnabled, this.effectAnchors.get(0),ultimateVisual);
    this.fox.update(arena, this.camera, menu, reducedMotion, this.cinematicCameraEnabled,ultimateVisual);
    this.skybreaker.update(arena, this.camera, menu, reducedMotion, this.cinematicCameraEnabled, this.effectAnchors.get(0),ultimateVisual);
    if(ultimateVisual&&ultimateVisual.active&&arena?.cinematic&&!menu){
      const shot=arena.cinematic;
      cinematicImpactAnchor(shot.kind,shot.impact,arena.player,this.ultimateAnchor);
      if(shot.kind==='fox')this.ultimateGather.copy(this.fox.staging.bombCenter);
      else if(shot.kind==='spirit')this.ultimateGather.copy(this.spirit.staging.orbCenter);
      else if(shot.kind==='skybreaker')this.ultimateGather.copy(this.skybreaker.staging.fistCenter);
      else this.ultimateGather.set(arena.player.x,5,arena.player.z);
      this.ultimateBlast.update(ultimateVisual,this.ultimateAnchor.x,this.ultimateAnchor.z,this.ultimateGather,this.profile);
      this.ultimatePunch.apply(this.camera,ultimateVisual,this.ultimateAnchor,shot.kind==='fox'?this.fox.staging.cameraFocus:undefined);
    }else this.ultimateBlast.clear();
    if (!this.cinematicCameraEnabled && arena?.cinematic) {
      this.camera.position.copy(this.gameplayCameraPosition);
      this.camera.quaternion.copy(this.gameplayCameraRotation);
      this.camera.updateMatrixWorld();
    }
    this.profiler.finish('effects',effectsStamp);
    const environmentStamp=this.profiler.stamp();
    const shot = menu ? undefined : arena?.cinematic;
    // Skip the procedural backdrop when the entire view points down at opaque ground.
    const skyVisible=this.camera.getWorldDirection(this.skyViewDirection).y>-Math.sin(THREE.MathUtils.degToRad(this.camera.fov*.5))-.025;
    const frame: EnvironmentFrame = {time:menu?time*.45:time,dt,paused,reducedMotion,mode:menu?"menu":"game",camera:this.camera.position,focus:this.focus,skyVisible,
      summonClearance:this.fox.staging.active?this.fox.staging.summonBounds:undefined,
      ultimate:shot&&arena?{kind:shot.kind,time:shot.time,origin:{x:arena.player.x,z:arena.player.z},impact:shot.impact}:undefined};
    this.environment?.update(frame);
    if(!paused)this.lastEnvironmentFrame=frame;
    this.environment?.cull(this.camera);
    const base=getMap(this.mapId),response=reaction(frame.ultimate,reducedMotion);
    const visual=this.ultimateClock.frame;
    if(this.ultimateBlastEnabled&&visual.active&&!reducedMotion){
      const pulse=visual.detonated?(visual.keyframe?1:Math.max(0,1-visual.age/.3)):0;
      response.light=visual.reducedFlashes?1:response.light+pulse*.3;
      response.tint=Math.max(response.tint,visual.detonated?Math.max(0,1-visual.age/1.4)*.25:0);
    }
    this.hemisphere.intensity=base.intensity*response.light;
    this.sunlight.intensity=base.sunIntensity*response.light;
    this.sunlight.color.set(base.sun).lerp(shot?.kind === "fox" ? this.foxTint : shot?.kind === "spirit" ? this.spiritTint : shot?.kind === "skybreaker" ? this.skybreakerTint : this.purpleTint,response.tint);
    this.rimLight.intensity=base.rimIntensity+response.tint;
    this.profiler.finish('environment',environmentStamp);
    const submitStamp=this.profiler.stamp();
    this.gpuTimer.begin(this.profiler.enabled);
    this.renderer.render(this.scene, this.camera);
    this.gpuTimer.end();this.profiler.finish('submit',submitStamp);
    this.profiler.phase=shot?(shot.time<3.4?'cinematic-charge':'post-wipe-recovery'):'normal';
    this.profiler.counts.calls=this.renderer.info.render.calls;this.profiler.counts.triangles=this.renderer.info.render.triangles;
    if (!paused && !menu && arena && frameInterval > 0) {
      const phase: SamplePhase = arena.cinematic?.kind === "fox" ? "nine-tail" : arena.cinematic?.kind === "skybreaker" ? "skybreaker" : arena.cinematic?.kind === "purple" ? "hollow-purple" : arena.cinematic?.kind === "spirit" ? "spirit-bomb" : "normal";
      const samples = this.samples[phase];
      samples.push({ ms: frameInterval, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
        snakes: arena.snakes.filter(s => s.alive).length });
      if (samples.length > 300) samples.shift();
    }
    if(ownsFrame)this.profiler.endFrame();
  }
}
