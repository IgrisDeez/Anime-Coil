import * as THREE from "three";
import type { WorldBuilder } from "./builder";
import type { EnvironmentFrame } from "./types";
import type { MapId } from "../maps";

const walkerPalettes: Record<MapId, readonly string[]> = {
  shibuya: ["#d8a57c", "#869ab6", "#c88194", "#e0c18a"],
  leaf: ["#b87f60", "#7c9b78", "#d7b487", "#9b788b"],
  tournament: ["#d27f68", "#6c9b8e", "#c4a468", "#8781a0"],
  harbor: ["#ba845d", "#7b9f9a", "#d3b06d", "#a67e9a"],
};

/** Small deterministic background inhabitants. Their paths never approach the arena. */
export function addWorldLife(builder: WorldBuilder, map: MapId) {
  const mobile = builder.profile === "mobile";
  const count = map === "harbor" ? (mobile ? 6 : 12) : (mobile ? 4 : 8);
  builder.backgroundActors += count;
  const group = new THREE.Group();
  group.name = `${map}-background-actors`;
  const bodyGeometry = builder.geo(new THREE.CapsuleGeometry(.34, .63, 3, mobile ? 4 : 6));
  const headGeometry = builder.geo(new THREE.SphereGeometry(.34, mobile ? 6 : 8, 6));
  const bodyMaterial = builder.material(new THREE.MeshToonMaterial({ color: "white" }));
  const headMaterial = builder.material(new THREE.MeshToonMaterial({ color: "#ffe0bd" }));
  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, count);
  const heads = new THREE.InstancedMesh(headGeometry, headMaterial, count);
  bodies.name = `${map}-walking-silhouettes`;
  heads.name = `${map}-walking-heads`;
  bodies.frustumCulled = heads.frustumCulled = true;
  // Entire deterministic walking route plus head height and bob displacement.
  const routeRadius=map==='harbor'?215:map==='tournament'?262:map==='leaf'?172:136;
  bodies.boundingSphere=new THREE.Sphere(new THREE.Vector3(),routeRadius);heads.boundingSphere=bodies.boundingSphere.clone();
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const palettes = walkerPalettes[map];
  for (let i = 0; i < count; i++) {
    bodies.setColorAt(i, new THREE.Color(palettes[i % palettes.length]));
    dummy.position.set(0, .05, 0); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 1.03; dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
  }
  bodies.instanceColor!.needsUpdate = true;
  group.add(bodies, heads);
  builder.group.add(group);

  const draw = (time: number, reduced: boolean) => {
    const t = reduced ? 0 : time;
    for (let i = 0; i < count; i++) {
      let x: number, z: number, facing = 0;
      if (map === "harbor") {
        const side = i % 2 ? 1 : -1;
        const phase = ((i * 17 + t * 1.25) % 142 + 142) % 142;
        x = side * 151;
        z = 2 + phase;
        facing = side * Math.PI / 2;
      } else {
        const radius = map === "shibuya" ? 132 : map === "leaf" ? 168 : 258;
        const angle = i / count * Math.PI * 2 + (i % 2 ? 1 : -1) * t * .055;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        facing = angle + (i % 2 ? Math.PI / 2 : -Math.PI / 2);
      }
      const bob = reduced ? 0 : Math.sin(t * 2.1 + i * 1.7) * .045;
      dummy.position.set(x, .05 + bob, z);
      dummy.rotation.set(0, facing, 0);
      dummy.scale.set(1, 1, 1); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 1.03 + bob, z);
      dummy.rotation.set(0, facing, 0); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  };
  draw(0, true);
  builder.moving(group, (frame: EnvironmentFrame) => draw(frame.time, frame.reducedMotion));
}
