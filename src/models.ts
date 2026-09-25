import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CHARACTERS, type CharacterId } from "./simulation";
const sphere = new THREE.SphereGeometry(1, 16, 12),
  box = new THREE.BoxGeometry(1, 1, 1),
  cone = new THREE.ConeGeometry(1, 1, 5);
const materials = new Map<string, THREE.MeshToonMaterial>();
function mat(color: string) {
  if (!materials.has(color))
    materials.set(color, new THREE.MeshToonMaterial({ color }));
  return materials.get(color)!;
}
function part(
  g: THREE.Group,
  geo: THREE.BufferGeometry,
  color: string,
  p: number[],
  s: number[],
  r?: number[],
  silhouette = false,
) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(p[0], p[1], p[2]);
  m.scale.set(s[0], s[1], s[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  m.userData.silhouette = silhouette;
  g.add(m);
  return m;
}
function blindfoldGeometry() {
  const columns = 48, rows = 6, positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const base = new THREE.Color("#25242f"), fold = new THREE.Color("#3b3a48");
  for (let column = 0; column <= columns; column++) {
    const theta = -1.42 + (column / columns) * 2.84;
    const side = Math.abs(theta) / 1.42;
    const centerY = 1.39 + 0.025 * side;
    const halfHeight = 0.22 * (1 - 0.12 * side);
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      const y = centerY + (v * 2 - 1) * halfHeight;
      const faceDepth = Math.sqrt(Math.max(0.08, 1 - ((y - 1.15) / 0.99) ** 2));
      const wrinkle = 0.006 * Math.sin(theta * 11 + v * 2.5) * Math.sin(Math.PI * v);
      positions.push(0.98 * Math.sin(theta), y, (0.82 * faceDepth + 0.18) * Math.cos(theta) + wrinkle);
      const foldAmount = 0.08 + 0.09 * Math.exp(-Math.pow((v - 0.78) / 0.18, 2)) + 0.025 * Math.cos(theta * 8);
      const color = base.clone().lerp(fold, THREE.MathUtils.clamp(foldAmount, 0, 0.2));
      colors.push(color.r, color.g, color.b);
    }
  }
  const stride = rows + 1;
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const a = column * stride + row, b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
const gojoBlindfoldGeometry = blindfoldGeometry();
const gojoBlindfoldMaterial = new THREE.MeshToonMaterial({
  color: "#ffffff",
  vertexColors: true,
  side: THREE.DoubleSide,
});
// Original, entirely code-authored chibi sculptures. +Z is the face direction.
function buildHead(id: CharacterId) {
  const g = new THREE.Group(),
    c = CHARACTERS.find((c) => c.id === id)!;
  part(g, sphere, c.color, [0, 0.25, -0.18], [0.91, 0.55, 0.84]);
  part(g, sphere, "#ffd3ae", [0, 1.15, 0], [0.98, 0.99, 0.82]);
  for (const x of [-1, 1]) {
    part(g, sphere, "#eeb08b", [x * 0.93, 1.13, 0], [0.19, 0.3, 0.21]);
    part(g, sphere, "#ffffff", [x * 0.36, 1.3, 0.73], [0.255, 0.3, 0.13]);
    part(
      g,
      sphere,
      id === "nova" ? "#1786ab" : "#27273a",
      [x * 0.36, 1.28, 0.845],
      [0.13, 0.2, 0.045],
    );
    part(g, sphere, "#ffffff", [x * 0.32, 1.36, 0.882], [0.042, 0.06, 0.025]);
    part(
      g,
      box,
      "#392837",
      [x * 0.35, 1.66, 0.75],
      [0.49, 0.075, 0.09],
      [0, 0, x * 0.14],
    );
    part(g, sphere, "#ef998a", [x * 0.66, 0.92, 0.68], [0.18, 0.07, 0.04]);
  }
  part(g, sphere, "#edb08e", [0, 1.0, 0.83], [0.12, 0.1, 0.12]);
  part(g, box, "#9d5b50", [0, 0.73, 0.74], [0.26, 0.035, 0.05]);
  const hair =
    id === "ember" ? "#ffcb59" : id === "eclipse" ? "#e3eafc" : "#222435";
  part(g, sphere, hair, [0, 1.89, -0.15], [1.02, 0.47, 0.83], undefined, true);
  if (id === "cloud") {
    for (let i = 0; i < 7; i++)
      part(
        g,
        cone,
        hair,
        [(i - 3) * 0.26, 1.79, 0.64],
        [0.25, 0.64, 0.28],
        [0, 0, Math.PI + (i - 3) * 0.12],
        true,
      );
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(1.46, 1.46, 0.13, 32),
      mat("#e8bd70"),
    );
    brim.position.set(0, 2.11, 0);
    brim.userData.silhouette = true;
    g.add(brim);
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1, 0.63, 24),
      mat("#f8d38a"),
    );
    hat.position.set(0, 2.43, 0);
    hat.userData.silhouette = true;
    g.add(hat);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.97, 1.01, 0.17, 24),
      mat("#e65468"),
    );
    band.position.set(0, 2.2, 0);
    g.add(band);
    part(g, box, "#f9df9d", [0, 0.35, 0.68], [0.18, 0.43, 0.12]);
    part(
      g,
      box,
      "#af5256",
      [0.49, 1.0, 0.81],
      [0.19, 0.025, 0.035],
      [0, 0, -0.2],
    );
  } else {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      part(
        g,
        cone,
        hair,
        [Math.sin(a) * 0.69, 2.02 + Math.cos(a) * 0.11, Math.cos(a) * 0.52],
        [0.46, id === "nova" ? 1.35 : 0.83, 0.42],
        [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.62],
        true,
      );
    }
    for (let i = 0; i < 4; i++)
      part(
        g,
        cone,
        hair,
        [(i - 1.5) * 0.39, 1.9, 0.64],
        [0.32, 0.65, 0.24],
        [0, 0, Math.PI + (i - 1.5) * 0.2],
        true,
      );
  }
  if (id === "ember") {
    part(g, box, "#384560", [0, 1.72, 0.82], [1.64, 0.24, 0.1]);
    part(g, box, "#c6d6df", [0, 1.73, 0.9], [0.63, 0.2, 0.05]);
    part(g, box, "#75879b", [0, 1.74, 0.932], [0.21, 0.08, 0.02], [0, 0, 0.6]);
    for (const x of [-1, 1])
      for (let i = 0; i < 2; i++)
        part(
          g,
          box,
          "#a26053",
          [x * 0.67, 1.05 - i * 0.13, 0.73],
          [0.22, 0.025, 0.045],
          [0, 0, x * 0.13],
        );
    for (const x of [-1, 1])
      part(
        g,
        cone,
        "#ffb946",
        [x * 0.73, 2.3, -0.05],
        [0.42, 0.8, 0.36],
        [0, 0, -x * 0.28],
      );
    part(g, box, "#273348", [0, 0.32, 0.72], [0.18, 0.56, 0.1]);
  }
  if (id === "nova") {
    for (const x of [-1, 1])
      part(
        g,
        box,
        "#ffc263",
        [x * 0.31, 0.36, 0.64],
        [0.28, 0.65, 0.18],
        [0, 0, x * 0.45],
      );
    part(g, sphere, "#58caff", [0, 0.39, 0.83], [0.17, 0.17, 0.08]);
  }
  if (id === "eclipse") {
    const blindfold = new THREE.Mesh(gojoBlindfoldGeometry, gojoBlindfoldMaterial);
    blindfold.userData.blindfold = true;
    g.add(blindfold);
    part(g, sphere, "#36304f", [0, 0.45, 0.23], [1.01, 0.43, 0.78]);
    part(g, box, "#a89bc9", [0, 0.35, 0.98], [0.035, 0.4, 0.025]);
  }
  return g;
}
const templates = new Map<CharacterId, THREE.Group>();
const silhouettes = new Map<CharacterId, THREE.BufferGeometry>();
const silhouetteMaterial = new THREE.MeshBasicMaterial({
  color: "#17151d",
  side: THREE.BackSide,
});
export function createHead(id: CharacterId) {
  if (!templates.has(id)) templates.set(id, buildHead(id));
  return templates.get(id)!.clone(true);
}

function silhouetteGeometry(id: CharacterId) {
  let geometry = silhouettes.get(id);
  if (geometry) return geometry;

  if (!templates.has(id)) templates.set(id, buildHead(id));
  const template = templates.get(id)!;
  template.updateMatrixWorld(true);
  const shells: THREE.BufferGeometry[] = [];
  template.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.userData.silhouette) return;
    const shell = object.geometry.clone();
    shell.applyMatrix4(object.matrixWorld);
    shell.computeBoundingSphere();
    const center = shell.boundingSphere!.center;
    const positions = shell.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(
        i,
        center.x + (positions.getX(i) - center.x) * 1.035,
        center.y + (positions.getY(i) - center.y) * 1.035,
        center.z + (positions.getZ(i) - center.z) * 1.035,
      );
    }
    positions.needsUpdate = true;
    shell.computeVertexNormals();
    shells.push(shell);
  });

  // Keep each hair spike and cap separate in silhouette, so gaps between them
  // remain open instead of being filled by a single convex hull.
  geometry = mergeGeometries(shells, false)!;
  for (const shell of shells) shell.dispose();
  geometry.computeBoundingSphere();
  silhouettes.set(id, geometry);
  return geometry;
}

// Instances share cached silhouette geometry/material, so callers only detach them.
export function createHeadOutline(id: CharacterId) {
  const outline = new THREE.Mesh(silhouetteGeometry(id), silhouetteMaterial);
  outline.userData.sharedSilhouette = true;
  return outline;
}
