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
import { createHead, createHeadOutline } from "./models";
import { SpiritCinematic } from "./spirit";
import { PurpleCinematic } from "./purple";
import { MAPS, getMap, type MapId } from "./maps";
import { buildEnvironment, type Environment } from "./environments";
import { profileFor, VisualClock, reaction, type EnvironmentFrame } from "./worlds/types";
const bodyGeo = new THREE.SphereGeometry(1, 12, 8),
  dummy = new THREE.Object3D();
interface SnakeVisual {
  head: THREE.Group;
  headOutline: THREE.Mesh;
  body: THREE.InstancedMesh;
  aura: THREE.Mesh;
  outline: THREE.InstancedMesh;
  shadow: THREE.InstancedMesh;
}
export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 600);
  visuals = new Map<number, SnakeVisual>();
  food: THREE.InstancedMesh;
  hero = new THREE.Group();
  heroHead: THREE.Group | null = null;
  heroId: CharacterId = "ember";
  mode: "menu" | "game" = "menu";
  private skillEffects = new SkillEffects();
  handleEvents(events: readonly GameEvent[]) { this.skillEffects.ingest(events); }
  clearEffects() { this.skillEffects.clear(); }
  private focus = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private target = new THREE.Vector3();
  private foodColors = CHARACTERS.map((c) => new THREE.Color(c.color));
  private ring: THREE.Mesh;
  private visualClock = new VisualClock();
  private profile = profileFor(innerWidth, matchMedia("(pointer:coarse)").matches);
  private samples: number[] = [];
  private frameStamp = 0;
  private environment?: Environment;
  private hemisphere = new THREE.HemisphereLight("#dde7ff", "#394354", 2.5);
  private sunlight = new THREE.DirectionalLight("#fff1d9", 3);
  private rimLight = new THREE.DirectionalLight("#9773ff", 1.8);
  mapId: MapId = "shibuya";
  private purple: PurpleCinematic;
  private spirit: SpiritCinematic;
  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, innerWidth < 700 ? 1.35 : 1.75),
    );
    this.renderer.setClearColor("#10121d");
    this.scene.fog = new THREE.FogExp2("#10121d", 0.004);
    this.sunlight.position.set(-12, 30, 20);
    this.rimLight.position.set(10, 10, -15);
    this.scene.add(this.hemisphere, this.sunlight, this.rimLight, this.skillEffects.group);
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
    this.food.frustumCulled = false;
    this.scene.add(this.food);
    this.scene.add(this.hero);
    this.purple = new PurpleCinematic(this.scene);
    this.spirit = new SpiritCinematic(this.scene);
    this.setHero("ember");
    this.setMap("shibuya");
    this.resize();
  }
  setMap(id: MapId) {
    if (this.environment) {
      this.scene.remove(this.environment.group);
      this.environment.dispose();
    }
    this.mapId = id;
    const def = getMap(id);
    this.environment = buildEnvironment(id, this.profile);
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
    (this.ring.material as THREE.MeshBasicMaterial).color.set(def.accent);
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
    const sorted=[...this.samples].sort((a,b)=>a-b),info=this.renderer.info;
    return {map:this.mapId,profile:this.profile,environment:this.environment?.stats,game:{calls:info.render.calls,triangles:info.render.triangles,frameMsMedian:sorted[Math.floor(sorted.length*.5)]??0,frameMsP95:sorted[Math.floor(sorted.length*.95)]??0,samples:sorted.length},memory:{...info.memory,programs:info.programs?.length??0},snakes:this.visuals.size};
  }
  resetMeasurements(){this.samples=[];this.frameStamp=0;}
  setHero(id: CharacterId) {
    this.heroId = id;
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
    const bodyOutline = new THREE.InstancedMesh(
      bodyGeo,
      new THREE.MeshBasicMaterial({ color: "#17151d", side: THREE.BackSide }),
      70,
    );
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
      dummy.scale.multiplyScalar(1.08);
      dummy.updateMatrix();
      bodyOutline.setMatrixAt(i, dummy.matrix);
      body.setColorAt(i, new THREE.Color(i % 5 === 0 ? c.secondary : c.color));
    }
    this.hero.add(bodyOutline, body);
    this.heroHead = createHead(id);
    this.heroHead.position.set(3, 1.0, 6.6);
    this.heroHead.scale.setScalar(1.5);
    this.heroHead.rotation.y = 0.35;
    const headOutline = createHeadOutline(id);
    headOutline.position.copy(this.heroHead.position);
    headOutline.rotation.copy(this.heroHead.rotation);
    headOutline.scale.setScalar(1.5 * 1.006);
    this.hero.add(headOutline, this.heroHead);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(8.5, 8.55, 90),
      new THREE.MeshBasicMaterial({
        color: c.color,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(3, -0.42, 0);
    this.hero.add(halo);
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    const profile = profileFor(w, matchMedia("(pointer:coarse)").matches);
    if (this.profile !== profile) { this.profile = profile; this.setMap(this.mapId); }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, w < 700 ? 1.35 : 1.75));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
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
    this.skillEffects.clear();
    for (const v of this.visuals.values()) {
      this.scene.remove(v.head, v.headOutline, v.body, v.aura, v.outline, v.shadow);
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
  render(arena: Arena | undefined, time: number, alpha: number, dt: number) {
    const menu = this.mode === "menu";
    const paused = document.hidden || (!!arena && arena.state !== "playing" && !menu);
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    time = this.visualClock.advance(dt, paused, document.hidden);
    this.skillEffects.update(menu ? undefined : arena, time, paused ? 0 : Math.min(dt,.1), reducedMotion);
    const stamp = performance.now();
    if (this.frameStamp && !paused) { const ms = stamp-this.frameStamp; if(ms < 200) {this.samples.push(ms); if(this.samples.length>300)this.samples.shift();} }
    this.frameStamp=stamp;
    // Miniature scenery in the menu; the identical world at full scale in play.
    this.environment?.group.scale.setScalar(menu ? 0.115 : 1);
    if (this.environment) this.environment.group.rotation.y = menu && this.mapId === "harbor" ? Math.PI : 0;
    this.hero.visible = menu;
    this.food.visible = !menu;
    this.ring.visible = !menu;

    if (menu) {
      for (const v of this.visuals.values()) {
        v.head.visible = false;
        v.body.visible = false;
        v.aura.visible = false;
        v.outline.visible = v.headOutline.visible = v.shadow.visible = false;
      }
      const narrow = innerWidth < 760;
      this.hero.scale.setScalar(narrow ? 0.8 : 1.15);
      this.hero.position.set(narrow ? 0 : 1, 0, narrow ? 0 : -4);
      this.camera.position.set(
        narrow ? 10 : 14,
        narrow ? 24 : 22,
        narrow ? 42 : 30,
      );
      this.camera.lookAt(narrow ? 3 : -7, narrow ? -16 : 0, 0);
      if (this.heroHead) {
        const idle = this.heroId === "ember" ? 2.4 : this.heroId === "cloud" ? 2 : this.heroId === "nova" ? 1.4 : .9;
        this.heroHead.position.y = 1 + (reducedMotion ? 0 : Math.sin(time * idle) * (this.heroId === "cloud" ? .2 : .1));
        this.heroHead.rotation.z = reducedMotion ? 0 : Math.sin(time * idle * .5) * (this.heroId === "cloud" ? .08 : .025);
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
      this.focus.lerp(
        new THREE.Vector3(
          p.previous.x + (p.x - p.previous.x) * alpha,
          0,
          p.previous.z + (p.z - p.previous.z) * alpha,
        ),
        1 - Math.exp(-dt * 8),
      );
      this.camera.position.set(
        this.focus.x,
        this.focus.y + zoom,
        this.focus.z + zoom * 0.57,
      );
      this.camera.lookAt(this.focus.x, 0, this.focus.z);
      const ids = new Set(arena.snakes.filter((s) => s.alive).map((s) => s.id));
      for (const [id, v] of this.visuals)
        if (!ids.has(id)) {
          this.scene.remove(v.head, v.headOutline, v.body, v.aura, v.outline, v.shadow);
      v.outline.dispose(); (v.outline.material as THREE.Material).dispose();
      v.shadow.dispose(); v.shadow.geometry.dispose(); (v.shadow.material as THREE.Material).dispose();
          v.body.dispose();
          (v.body.material as THREE.Material).dispose();
          v.aura.geometry.dispose();
          (v.aura.material as THREE.Material).dispose();
          this.visuals.delete(id);
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
          body.frustumCulled = false;
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
          const outline = new THREE.InstancedMesh(bodyGeo, new THREE.MeshBasicMaterial({color:"#17151d", side:THREE.BackSide}), 360);
          const shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(1,16),new THREE.MeshBasicMaterial({color:"#635c67",transparent:true,opacity:.14,depthWrite:false}),360);
          outline.frustumCulled = shadow.frustumCulled = false;
          v = { head, headOutline, body, aura, outline, shadow };
          this.visuals.set(s.id, v);
          this.scene.add(outline, headOutline, head, body, aura, shadow);
        }
        v.head.visible = true;
        v.body.visible = true;
        v.outline.visible = true;
        v.headOutline.visible = true;
        v.shadow.visible = true;
        v.aura.visible = s.id === 0 || s.active > 0 || s.frozen || s.slowed;
        (v.aura.material as THREE.MeshBasicMaterial).color.set(
          s.frozen ? "#547a8e" : s.slowed ? "#ad8bcf" : c.color,
        );
        // Bodies and collisions use the current fixed-step state. Rendering
        // an older interpolated head makes a hit register ahead of its face.
        const hx = s.x,
          hz = s.z;
        const size = serpentScale(s.mass);
        v.head.scale.setScalar(size);
        v.head.position.set(hx, 0.55 * size, hz);
        const elastic = !reducedMotion && !s.frozen && s.character === "cloud" && s.active > 0;
        const squash = elastic ? 1 + Math.sin(time * 11) * .12 : 1;
        v.head.scale.y = size * squash;
        v.head.rotation.set(!reducedMotion && s.character === "ember" && s.active > 0 ? .12 : 0, Math.PI / 2 - s.angle, elastic ? THREE.MathUtils.clamp(angleDelta(s.previousAngle,s.angle) * 2,-.16,.16) : 0);
        v.headOutline.scale.copy(v.head.scale).multiplyScalar(1.006);
        v.headOutline.position.copy(v.head.position);
        v.headOutline.rotation.copy(v.head.rotation);
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
        dummy.position.set(hx, -.37, hz); dummy.rotation.set(-Math.PI/2,0,0); dummy.scale.set(size*1.25,size*1.05,1); dummy.updateMatrix(); v.shadow.setMatrixAt(0,dummy.matrix);
        for (let i = 1; i < s.body.length; i++) {
          const b = s.body[i];
          const scale = bodyRadiusAt(i, s.body.length, s.mass);
          dummy.position.set(
            b.x,
            0.5 * size + (s.frozen || reducedMotion ? 0 : Math.sin(time * 4 - i * 0.5) * 0.04),
            b.z,
          );
          dummy.scale.set(scale, scale * .85 * (elastic ? 1 + Math.sin(time * 11 - i * .4) * .2 : 1), scale);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          v.body.setMatrixAt(i - 1, dummy.matrix);
          dummy.scale.multiplyScalar(1.08); dummy.updateMatrix(); v.outline.setMatrixAt(i - 1,dummy.matrix);
          dummy.position.y = -.37; dummy.rotation.set(-Math.PI/2,0,0); dummy.scale.set(scale*1.25,scale*1.25,1); dummy.updateMatrix(); v.shadow.setMatrixAt(i,dummy.matrix);
          v.body.setColorAt(
            i - 1,
            new THREE.Color(
              s.frozen ? "#bdeeff" : i % 5 === 0 ? c.secondary : c.color,
            ),
          );
        }
        v.body.instanceMatrix.needsUpdate = true;
        v.outline.instanceMatrix.needsUpdate = v.shadow.instanceMatrix.needsUpdate = true;
        if (v.body.instanceColor) v.body.instanceColor.needsUpdate = true;
      }
      this.food.count = arena.food.length;
      for (let i = 0; i < arena.food.length; i++) {
        const f = arena.food[i];
        dummy.position.set(f.x, 0.25 + Math.sin(time * 2 + f.id) * 0.12, f.z);
        dummy.scale.setScalar(f.value > 1 ? 1.45 : 1);
        dummy.rotation.set(0, time * 0.6 + f.id, 0);
        dummy.updateMatrix();
        this.food.setMatrixAt(i, dummy.matrix);
        this.food.setColorAt(i, this.foodColors[f.color]);
      }
      this.food.instanceMatrix.needsUpdate = true;
      if (this.food.instanceColor) this.food.instanceColor.needsUpdate = true;
    }
    this.purple.update(arena, this.camera, menu);
    this.spirit.update(arena, this.camera, menu);
    const shot = menu ? undefined : arena?.cinematic;
    const frame: EnvironmentFrame = {time:menu?time*.45:time,dt,paused,reducedMotion,mode:menu?"menu":"game",camera:this.camera.position,focus:this.focus,
      ultimate:shot&&arena?{kind:shot.kind,time:shot.time,origin:{x:arena.player.x,z:arena.player.z},impact:shot.impact}:undefined};
    this.environment?.update(frame);
    const base=getMap(this.mapId),response=reaction(frame.ultimate,reducedMotion);
    this.hemisphere.intensity=base.intensity*response.light;
    this.sunlight.intensity=base.sunIntensity*response.light;
    this.sunlight.color.set(base.sun).lerp(new THREE.Color("#aa65ff"),response.tint);
    this.rimLight.intensity=base.rimIntensity+response.tint;
    this.renderer.render(this.scene, this.camera);
  }
}
