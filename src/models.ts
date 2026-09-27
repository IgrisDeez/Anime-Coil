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
  const eyes = new THREE.Group();
  eyes.position.y = 1.3;
  eyes.userData.previewEye = true;
  g.add(eyes);
  for (const x of [-1, 1]) {
    part(g, sphere, "#eeb08b", [x * 0.93, 1.13, 0], [0.19, 0.3, 0.21]);
    part(eyes, sphere, "#ffffff", [x * .36, 0, 0.73], [0.255, 0.3, 0.13]);
    part(
      eyes,
      sphere,
      id === "nova" ? "#1786ab" : "#27273a",
      [x * .36, -.02, 0.845],
      [0.13, 0.2, 0.045],
    );
    part(eyes, sphere, "#ffffff", [x * .32, .06, 0.882], [0.042, 0.06, 0.025]);
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
const rawHeads = new Map<CharacterId, THREE.Group>();
const templates = new Map<CharacterId, THREE.Group>();
const silhouettes = new Map<CharacterId, THREE.BufferGeometry>();
export type FormCharacter = 'ember' | 'cloud';
const formSources = new Map<FormCharacter, THREE.Group>();
const formTemplates = new Map<FormCharacter, THREE.Group>();
const formSilhouettes = new Map<FormCharacter, THREE.BufferGeometry>();

/** Separate, code-sculpted form heads. Normal cached heads and materials are never edited. */
function buildFormHead(id: FormCharacter) {
  const g = new THREE.Group();
  const fox = id === 'ember';
  const skin = '#ffd5b4';
  part(g, sphere, fox ? '#f8c85d' : '#f7f3ec', [0,.25,-.18], [.94,.58,.84]);
  part(g, sphere, skin, [0,1.15,0], [.98,.99,.82]);
  const eyes = new THREE.Group(); eyes.position.y=1.3; eyes.userData.previewEye=true; g.add(eyes);
  for (const side of [-1,1]) {
    part(g,sphere,'#eeb08b',[side*.93,1.13,0],[.19,.3,.21]);
    part(eyes,sphere,'#fffdf4',[side*.36,0,.73],[.255,.3,.13]);
    part(eyes,sphere,fox?'#d27f2e':'#d26778',[side*.36,-.02,.845],[.13,.2,.045]);
    part(eyes,sphere,'#ffffff',[side*.32,.06,.882],[.043,.06,.025]);
    part(g,sphere,'#ef998a',[side*.66,.92,.68],[.18,.07,.04]);
  }
  part(g,sphere,'#edb08e',[0,1,.83],[.12,.1,.12]);
  if (fox) {
    // A high flame crown and short luminous hair leave the face unobstructed.
    part(g,sphere,'#ffe384',[0,1.9,-.16],[1.04,.48,.85],undefined,true);
    for(let i=0;i<11;i++) {
      const a=i/11*Math.PI*2;
      part(g,cone,i%3?'#ffcc5e':'#fff0af',[Math.sin(a)*.72,2.12+Math.cos(a)*.08,Math.cos(a)*.5],[.36,.92+(i%3)*.11,.36],[Math.cos(a)*.4,0,-Math.sin(a)*.55],true);
    }
    part(g,sphere,'#ffe6a1',[0,.39,.17],[1.04,.35,.75],undefined,true);
    part(g,box,'#33313d',[0,.39,.91],[.19,.43,.065]);
    for(const side of [-1,1]) {
      part(g,box,'#423437',[side*.63,1.03,.72],[.22,.035,.045],[0,0,side*.15]);
      part(g,sphere,'#454047',[side*.55,.36,.78],[.1,.14,.045]);
      part(g,cone,'#fff0af',[side*.82,2.29,-.18],[.32,.88,.32],[0,0,-side*.26],true);
    }
    part(g,sphere,'#85533d',[0,.74,.75],[.17,.04,.045]);
  } else {
    // Curled white crown, spiral brows, and a broad chibi grin.
    part(g,sphere,'#f8f8ef',[0,1.94,-.19],[1.06,.48,.86],undefined,true);
    for(let i=0;i<13;i++) {
      const a=i/13*Math.PI*2;
      part(g,sphere,i%3?'#fffef4':'#dedbe8',[Math.sin(a)*.79,2.04+Math.cos(a)*.16,Math.cos(a)*.58],[.33,.37,.33],undefined,true);
    }
    for(let i=0;i<5;i++) part(g,sphere,'#fffef4',[(i-2)*.36,2.36+Math.sin(i*1.7)*.08,.4],[.28,.34,.3],undefined,true);
    for(const side of [-1,1]) {
      part(g,sphere,'#d9d0e7',[side*.35,1.66,.77],[.22,.055,.05],[0,0,side*.24]);
      part(g,sphere,'#765c78',[side*.53,.7,.64],[.045,.06,.04]);
      const points:THREE.Vector3[]=[];
      for(let j=0;j<=18;j++) {const t=j/18,a=t*Math.PI*3.2,r=.12*(1-t);points.push(new THREE.Vector3(side*.35+Math.cos(a)*r,1.65+Math.sin(a)*r,.86));}
      part(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.019,4,false),'#79627e',[0,0,0],[1,1,1]);
    }
    part(g,sphere,'#4a3342',[0,.75,.735],[.49,.19,.07]);
    part(g,box,'#fff9e9',[0,.8,.802],[.62,.075,.022]);
    for(let i=-2;i<=2;i++) part(g,box,'#b99193',[i*.11,.8,.817],[.014,.07,.012]);
    part(g,sphere,'#f7f3ec',[0,.34,.15],[.93,.34,.8],undefined,true);
    part(g,box,'#9776c2',[0,.39,.84],[1.25,.2,.14],[0,0,-.08]);
    part(g,sphere,'#ad90d4',[.72,.2,.2],[.32,.11,.2],[0,0,-.25]);
    // Hat is carried behind the transformed head, not on top of its new hair.
    const brim=part(g,new THREE.CylinderGeometry(1.2,1.2,.1,24),'#e7bf78',[0,1.36,-.91],[.72,.72,.72],[.46,0,0],true);
    brim.userData.silhouette=true;
    part(g,new THREE.CylinderGeometry(.73,.85,.42,20),'#f3d18f',[0,1.51,-1.04],[.72,.72,.72],[.46,0,0],true);
  }
  return g;
}

function formSource(id: FormCharacter) {
  if(!formSources.has(id)) formSources.set(id,buildFormHead(id));
  return formSources.get(id)!;
}
export function createTransformedHead(id: FormCharacter) {
  if(!formTemplates.has(id)) formTemplates.set(id,compactHead(formSource(id)));
  return formTemplates.get(id)!.clone(true);
}
const silhouetteMaterial = new THREE.MeshBasicMaterial({
  color: "#25232c",
  side: THREE.BackSide,
});
export function createHead(id: CharacterId) {
  if (!templates.has(id)) templates.set(id, compactHead(sourceHead(id)));
  return templates.get(id)!.clone(true);
}

function sourceHead(id: CharacterId) {
  if (!rawHeads.has(id)) rawHeads.set(id, buildHead(id));
  return rawHeads.get(id)!;
}

/** Bake fixed head parts into one mesh per material. The eye groups and the
 * shaped blindfold stay independent for preview blinking and their own detail. */
function compactHead(source: THREE.Group) {
  const head = source.clone(false);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  source.updateMatrix();
  for (const child of source.children) {
    if (child instanceof THREE.Group) {
      head.add(compactHead(child));
      continue;
    }
    if (!(child instanceof THREE.Mesh) || child.userData.blindfold) {
      head.add(child.clone(true));
      continue;
    }
    child.updateMatrix();
    const material = child.material as THREE.Material;
    const pieces = batches.get(material) ?? [];
    pieces.push(child.geometry.clone().applyMatrix4(child.matrix));
    batches.set(material, pieces);
  }
  for (const [material, pieces] of batches) {
    const geometry = mergeGeometries(pieces, false);
    for (const piece of pieces) piece.dispose();
    if (!geometry) throw new Error("Could not merge character head geometry");
    geometry.computeBoundingSphere();
    head.add(new THREE.Mesh(geometry, material));
  }
  return head;
}

function silhouetteGeometry(id: CharacterId, transformed = false) {
  const cache = transformed ? formSilhouettes : silhouettes;
  let geometry = cache.get(id as FormCharacter);
  if (geometry) return geometry;

  const template = transformed ? formSource(id as FormCharacter) : sourceHead(id);
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
  cache.set(id as FormCharacter, geometry);
  return geometry;
}

// Instances share cached silhouette geometry/material, so callers only detach them.
export function createHeadOutline(id: CharacterId) {
  const outline = new THREE.Mesh(silhouetteGeometry(id), silhouetteMaterial);
  outline.userData.sharedSilhouette = true;
  return outline;
}
export function createTransformedHeadOutline(id: FormCharacter) {
  const outline = new THREE.Mesh(silhouetteGeometry(id, true), silhouetteMaterial);
  outline.userData.sharedSilhouette = true;
  return outline;
}
