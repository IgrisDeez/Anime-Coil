import * as THREE from "three";
import { Arena, NUKE_BLAST, NUKE_DURATION } from "./simulation";

// Persistent effect geometry: no frame-time mesh creation or map-owned assets.
export class PurpleCinematic {
  group = new THREE.Group();
  private core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private red: THREE.Mesh;
  private blue: THREE.Mesh;
  private rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] =
    [];
  private sparks: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private light = new THREE.PointLight("#a347ff", 0, 200, 1);
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  constructor(scene: THREE.Scene) {
    const sphere = new THREE.SphereGeometry(1, 32, 20);
    const material = (color: string) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    this.core = new THREE.Mesh(sphere, material("#c65cff"));
    this.red = new THREE.Mesh(sphere, material("#ff325d"));
    this.blue = new THREE.Mesh(sphere, material("#258aff"));
    this.group.add(this.core, this.red, this.blue, this.light);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.025, 6, 96),
        material(i % 2 ? "#7750ff" : "#e1afff"),
      );
      this.rings.push(ring);
      this.group.add(ring);
    }
    const positions = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const a = i * 2.39996,
        y = 1 - (2 * (i + 0.5)) / 240,
        r = Math.sqrt(1 - y * y);
      positions.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#d8b6ff",
        size: 0.65,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.group.add(this.sparks);
    this.group.visible = false;
    scene.add(this.group);
  }
  update(
    arena: Arena | undefined,
    camera: THREE.PerspectiveCamera,
    menu: boolean,
  ) {
    const shot = !menu && arena?.cinematic;
    this.group.visible = !!shot && shot.kind === "purple";
    if (!shot || !arena || shot.kind !== "purple") return;
    const t = shot.time,
      p = arena.player,
      blast = Math.max(0, t - NUKE_BLAST);
    const charge = Math.min(1, t / NUKE_BLAST),
      fade = Math.max(0, 1 - blast / (NUKE_DURATION - NUKE_BLAST));
    this.group.position.set(p.x, 5, p.z);
    this.core.material.color.set("#c65cff");
    this.sparks.material.color.set("#d8b6ff");
    this.light.color.set("#a347ff");
    const height = 0;
    this.core.position.y = height;
    this.sparks.position.y = height;
    this.core.scale.setScalar(
      blast > 0 ? 7 + blast * 48 : 0.4 + charge * charge * 6,
    );
    this.core.material.opacity = blast > 0 ? fade * 0.48 : 0.9;
    this.red.visible = this.blue.visible = t < 2.5;
    const orbit = Math.max(0, 8 * (1 - t / 2.5)),
      spin = this.reduced ? 0 : t * 3;
    this.red.position.set(Math.cos(spin) * orbit, 0, Math.sin(spin) * orbit);
    this.blue.position.copy(this.red.position).multiplyScalar(-1);
    this.red.scale.setScalar(1.4);
    this.blue.scale.setScalar(1.4);
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      ring.material.color.set(i % 2 ? "#7750ff" : "#e1afff");
      ring.position.y = blast > 0 ? 0 : height;
      ring.scale.setScalar(
        blast > 0 ? 8 + blast * (45 + i * 16) : 3 + i * 2 + charge * 5,
      );
      ring.rotation.set(
        Math.PI / 2 + (blast > 0 ? i * 0.15 : i * 0.5),
        this.reduced ? 0 : t * 0.4 + i,
        0,
      );
      ring.material.opacity = fade * (blast > 0 ? 0.7 : 0.35);
    }
    this.sparks.scale.setScalar(
      blast > 0 ? 10 + blast * 65 : 45 * (1 - charge) + 8,
    );
    this.sparks.rotation.y = this.reduced ? 0 : t * 0.4;
    this.sparks.material.opacity = fade;
    this.light.intensity = fade * (blast > 0 ? 80 : 20 * charge);
    if (!this.reduced) {
      // Ease from an intimate charge shot to a wide view of the arena blast.
      const zoom = t < 1
          ? 42 - t * 18
          : t < NUKE_BLAST
            ? 24 + (t - 1) * 36
            : 110 + blast * 16;
      const angle = t * 0.17;
      const width = Math.max(1, 0.85 / camera.aspect);
      const cinematicPosition = new THREE.Vector3(
        p.x + Math.sin(angle) * zoom * 0.45,
        zoom * width,
        p.z + Math.cos(angle) * zoom * 0.6,
      );
      const blend = Math.min(1, t * 3, (NUKE_DURATION - t) * 1.8);
      camera.position.lerp(cinematicPosition, Math.max(0, blend));

      camera.lookAt(p.x, 0, p.z);
    }
  }
}
