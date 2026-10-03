import * as THREE from 'three';
import type {DetailProfile} from './worlds/types';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const palette = { gold: '#ffc13f', light: '#ffdf75', orange: '#ee7620', ink: '#38222a', ivory: '#fff2b2', eye: '#fff69a' };
type Shade = keyof typeof palette;
type XYZ = readonly [number, number, number];

/** Closed swept volumes, authored once; no runtime tube or curve construction. */
function volume(points: readonly XYZ[], radii: readonly number[], width = 1, depth = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const rows = 20, sides = 12, frames = curve.computeFrenetFrames(rows, false);
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, f = t * (radii.length - 1), index = Math.min(radii.length - 2, Math.floor(f));
    const radius = THREE.MathUtils.lerp(radii[index], radii[index + 1], f - index), center = curve.getPointAt(t);
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2, a = Math.cos(angle) * radius * width, b = Math.sin(angle) * radius * depth;
      positions.push(center.x + frames.normals[row].x * a + frames.binormals[row].x * b,
        center.y + frames.normals[row].y * a + frames.binormals[row].y * b,
        center.z + frames.normals[row].z * a + frames.binormals[row].z * b);
      uv.push(side / sides, t);
      if (row < rows && side < sides) {
        const n = row * (sides + 1) + side;
        indices.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
      }
    }
  }
  for (const end of [0, rows]) {
    const center = curve.getPointAt(end / rows), n = positions.length / 3;
    positions.push(center.x, center.y, center.z); uv.push(.5, end / rows);
    for (let side = 0; side < sides; side++) {
      const a = end * (sides + 1) + side;
      indices.push(n, end === 0 ? a + 1 : a, end === 0 ? a : a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function headVolume(sections: readonly { z: number; y: number; width: number; height: number }[]) {
  const points: number[] = [], uv: number[] = [], indices: number[] = [], sides = 12;
  for (let row = 0; row < sections.length; row++) {
    const s = sections[row];
    for (let side = 0; side <= sides; side++) {
      const a = side / sides * Math.PI * 2;
      points.push(Math.cos(a) * s.width, s.y + Math.sin(a) * s.height, s.z);
      uv.push(side / sides, row / (sections.length - 1));
      if (row < sections.length - 1 && side < sides) {
        const n = row * (sides + 1) + side;
        indices.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
      }
    }
  }
  for (const row of [0, sections.length - 1]) {
    const s = sections[row], n = points.length / 3; points.push(0, s.y, s.z); uv.push(.5, .5);
    for (let side = 0; side < sides; side++) {
      const a = row * (sides + 1) + side; indices.push(n, row === 0 ? a + 1 : a, row === 0 ? a : a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export interface FoxSummonModel {
  readonly beast: THREE.Group;
  readonly head: THREE.Group;
  readonly leftPaw: THREE.Group;
  readonly rightPaw: THREE.Group;
  readonly muzzle: THREE.Object3D;
  readonly meshes: readonly THREE.Mesh[];
}

/** Four vertex-colour draws: torso/legs, head/jaws, and two articulated forearms. */
let cachedFactory: ((profile:DetailProfile)=>FoxSummonModel|undefined)|undefined;
export function registerFoxSummonAssetFactory(factory:typeof cachedFactory){cachedFactory=factory;}
/** Synchronous cache lookup, with the original procedural fallback. */
export function createFoxSummon(profile?:DetailProfile):FoxSummonModel {
  return (profile ? cachedFactory?.(profile) : undefined) ?? createProceduralFoxSummon();
}
export function createProceduralFoxSummon(): FoxSummonModel {
  const beast = new THREE.Group(), head = new THREE.Group(), leftPaw = new THREE.Group(), rightPaw = new THREE.Group();
  head.name = 'fox-head'; head.position.set(0, 16.4, 1.3);
  leftPaw.name = 'fox-left-paw'; rightPaw.name = 'fox-right-paw';
  leftPaw.position.set(-3.7, 14.1, .1); rightPaw.position.set(3.7, 14.1, .1);
  beast.add(head, leftPaw, rightPaw);
  const meshes: THREE.Mesh[] = [];
  const sculpt = (parent: THREE.Group, name: string, build: (add: (g: THREE.BufferGeometry, shade: Shade) => void) => void) => {
    const pieces: THREE.BufferGeometry[] = [];
    const add = (source: THREE.BufferGeometry, shade: Shade) => {
      const g = source.index ? source.toNonIndexed() : source; if (g !== source) source.dispose();
      const rgb = new THREE.Color(palette[shade]), values = new Float32Array(g.attributes.position.count * 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        // Mild sculptural value variation, with markings retaining a solid dark value.
        const light = shade === 'ink' ? 1 : .94 + .06 * Math.max(0, Math.min(1, (p.getY(i) + 3) / 20));
        values[i * 3] = rgb.r * light; values[i * 3 + 1] = rgb.g * light; values[i * 3 + 2] = rgb.b * light;
      }
      g.setAttribute('color', new THREE.BufferAttribute(values, 3)); pieces.push(g);
    };
    build(add); const geometry = mergeGeometries(pieces, false)!; pieces.forEach(g => g.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material = new THREE.MeshToonMaterial({ vertexColors: true, emissive: '#925019', emissiveIntensity: .14, transparent: true });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.frustumCulled = true; parent.add(mesh); meshes.push(mesh);
  };
  const round = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rz = 0) => {
    const g = new THREE.SphereGeometry(1, 16, 12); g.scale(sx, sy, sz); g.rotateZ(rz); g.translate(x, y, z); return g;
  };
  const claw = (x: number, y: number, z: number, size: number, rx: number, rz = 0) => {
    const g = new THREE.ConeGeometry(.22 * size, 1.1 * size, 8); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g;
  };
  const ring = (x: number, y: number, z: number, radius: number, thickness: number, ry = 0) => {
    const g = new THREE.TorusGeometry(radius, thickness, 6, 32); g.rotateY(ry); g.translate(x, y, z); return g;
  };
  sculpt(beast, 'fox-torso', add => {
    add(volume([[0, 7.1, -.6], [0, 10.2, -.8], [0, 13.7, -.4], [0, 15.4, .3]], [2.3, 2.45, 3.55, 2.5], 1, .73), 'gold');
    add(round(0, 13, 1.55, 2.9, 2.45, .9), 'light');
    add(round(0, 8.4, .7, 2.8, 1.8, 1.5), 'gold');
    add(volume([[-3.6, 14, 1.8], [-2.7, 11.5, 2.02], [0, 10.7, 2.13], [2.7, 11.5, 2.02], [3.6, 14, 1.8]], [.14, .17, .17, .17, .14]), 'ink');
    add(round(0, 8.5, 2.32, 1.02, .9, .12), 'ink'); add(ring(0, 8.5, 2.46, 1.16, .12), 'light');
    for (const s of [-1, 1]) {
      add(round(s * 3.5, 14.2, .1, 1.9, 1.9, 1.95), 'gold');
      add(round(s * 3.6, 14.2, 1.97, .89, .93, .13), 'ink'); add(ring(s * 3.6, 14.2, 2.1, 1.07, .14), 'orange');
      add(volume([[s * 1.8, 8.5, -.6], [s * 4.9, 6.9, 1.4], [s * 6.2, 5.9, 2.2]], [1.6, 2, 1.15], 1, .87), 'gold');
      add(volume([[s * 6.2, 6, 2.2], [s * 5.5, 3.4, 1.6], [s * 6.1, .9, 3.1]], [1.1, .74, .73], 1, .85), 'gold');
      add(volume([[s * 1.5, 8.8, 1.3], [s * 3.9, 7.4, 2.95], [s * 5.65, 6.2, 3.22]], [.16, .17, .13]), 'ink');
      add(round(s * 6.1, .72, 3.45, 1.22, .65, 1.6), 'gold');
      for (let i = 0; i < 4; i++) {
        const x = s * 6.1 + (i - 1.5) * .59;
        add(volume([[x, .8, 3.8], [x + s * .12, .55, 4.7], [x + s * .18, .48, 5.15]], [.4, .32, .19]), 'light');
        add(claw(x + s * .18, .48, 5.6, .85, Math.PI / 2), 'orange');
      }
    }
  });
  sculpt(head, 'fox-face', add => {
    add(headVolume([{ z: -2, y: .2, width: 1.9, height: 1.8 }, { z: -.6, y: .3, width: 3, height: 2.05 },
      { z: 1.3, y: .12, width: 2.55, height: 1.5 }, { z: 3, y: -.24, width: 1.5, height: .66 },
      { z: 5.2, y: -.48, width: .93, height: .44 }]), 'gold');
    // Dark cavity and separate sloping lower jaw give the roar an intentional silhouette.
    add(headVolume([{ z: 1.35, y: -1.18, width: 1.25, height: .46 }, { z: 3.7, y: -1.45, width: 1.18, height: .84 }, { z: 4.85, y: -1.38, width: .9, height: .58 }]), 'ink');
    add(headVolume([{ z: .9, y: -1.6, width: 1.4, height: .42 }, { z: 2.8, y: -2.5, width: 1.14, height: .43 }, { z: 4.65, y: -2.11, width: .91, height: .28 }]), 'light');
    add(round(0, -.38, 5.3, .55, .3, .33), 'ink');
    for (const s of [-1, 1]) {
      add(volume([[s * 2.05, 1.2, -.8], [s * 3.85, 2.7, -.9], [s * 5.05, 4.65, -1.55]], [1.12, .93, .012], .8, .63), 'gold');
      add(volume([[s * 2.8, 2.03, -.05], [s * 3.9, 3.25, -.3], [s * 4.65, 4.25, -1.1]], [.44, .36, .009], .7, .28), 'orange');
      for (let i = 0; i < 3; i++)
        add(volume([[s * 2.3, -.4 - i * .42, .5], [s * (3.35 + i * .13), -.3 - i * .48, -.2], [s * (4.2 - i * .2), -.2 - i * .63, -1.8]], [.8 - i * .13, .64 - i * .12, .012], .78, .6), 'orange');
      add(round(s * 1.9, .83, 1.93, 1.04, .34, .23, s * .29), 'ink');
      add(round(s * 1.82, .78, 2.13, .71, .15, .1, s * .29), 'eye');
      add(round(s * 1.6, .72, 2.25, .09, .18, .05), 'ink');
      add(volume([[s * .7, 1.12, 2.2], [s * 1.8, 1.48, 1.91], [s * 2.85, 1.67, 1.25]], [.17, .32, .16]), 'gold');
      for (let i = 0; i < 3; i++)
        add(volume([[s * 2.23, -.05 - i * .43, 1.83], [s * 2.8, -.29 - i * .43, 1.27], [s * 3.18, -.5 - i * .43, .7]], [.11, .17, .08]), 'ink');
      add(claw(s * 1.03, -1.24, 3.08, 1.4, Math.PI), 'ivory');
      for (let i = 0; i < 5; i++) {
        const z = 2.5 + i * .43, x = s * (1.05 - i * .035);
        add(claw(x, -.97, z, .55, Math.PI), 'ivory'); add(claw(x * .88, -1.97, z, .49, 0), 'ivory');
      }
    }
    for (let i = 0; i < 4; i++) add(claw((i - 1.5) * .39, -.96, 4.9, .5, Math.PI), 'ivory');
  });
  for (const [parent, s] of [[leftPaw, -1], [rightPaw, 1]] as const) sculpt(parent, `${parent.name}-sculpt`, add => {
    add(volume([[0, 0, 0], [s * 2.6, -2.15, .5], [s * 4.6, -4.7, 2.4]], [1.32, 1.05, .7], 1, .9), 'gold');
    add(round(s * 4.9, -4.95, 2.92, 1.18, .67, 1.18), 'gold');
    add(volume([[s * .8, -.4, 1.1], [s * 2.5, -2.1, 1.52], [s * 3.85, -3.95, 2.54]], [.13, .13, .1]), 'ink');
    const wrist = new THREE.TorusGeometry(.72, .16, 6, 32); wrist.rotateX(.27); wrist.translate(s * 4.4, -4.42, 2.35); add(wrist, 'ink');
    for (let i = 0; i < 4; i++) {
      const x = s * 4.9 + (i - 1.5) * .55;
      add(volume([[x, -4.87, 3.2], [x + s * .15, -5.23, 4.02], [x + s * .27, -5.17, 4.65]], [.34, .29, .16]), 'light');
      add(claw(x + s * .27, -5.1, 5, .8, Math.PI / 2), 'orange');
    }
    add(volume([[s * 3.98, -4.78, 2.94], [s * 3.65, -5.18, 3.5], [s * 3.72, -5.13, 4]], [.4, .32, .12]), 'gold');
  });
  const muzzle = new THREE.Object3D(); muzzle.name = 'fox-muzzle-anchor'; muzzle.position.set(0, -1.16, 5.75); head.add(muzzle);
  beast.name = 'fox-summon'; beast.userData.silhouette = ['crouched-hind-legs', 'clawed-feet', 'spread-forearms', 'open-jaw', 'swept-ears', 'chakra-markings'];
  return { beast, head, leftPaw, rightPaw, muzzle, meshes };
}

/** One closed flame volume with a dark inner stripe; nine transforms build the fan. */
export function foxTailGeometry(): THREE.BufferGeometry {
  const rows = 28, sides = 16, positions: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
  const gold = new THREE.Color('#ffcc42'), orange = new THREE.Color('#ed721e'), ink = new THREE.Color('#42242a'), mix = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, radius = (.13 + .31 * Math.sin(Math.PI * Math.pow(t, .7))) * Math.pow(1 - t, .38) + .002;
    const x = .24 * Math.sin(t * Math.PI * 1.65), y = .22 * Math.sin(t * Math.PI) + .38 * t * t;
    for (let side = 0; side <= sides; side++) {
      const a = side / sides * Math.PI * 2;
      positions.push(x + Math.cos(a) * radius, y + Math.sin(a) * radius * .75, t * 2.5); uv.push(side / sides, t);
      const stripe = side >= 11 && side <= 13 && t > .08 && t < .91;
      mix.copy(gold).lerp(orange, .2 + .6 * Math.pow(t, 2) + .13 * Math.cos(a)); if (stripe) mix.copy(ink);
      colors.push(mix.r, mix.g, mix.b);
      if (row < rows && side < sides) {
        const n = row * (sides + 1) + side; indices.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
      }
    }
  }
  for (const row of [0, rows]) {
    const t = row / rows, n = positions.length / 3;
    positions.push(.24 * Math.sin(t * Math.PI * 1.65), .22 * Math.sin(t * Math.PI) + .38 * t * t, t * 2.5); uv.push(.5, t); colors.push(gold.r, gold.g, gold.b);
    for (let side = 0; side < sides; side++) { const a = row * (sides + 1) + side; indices.push(n, row === 0 ? a + 1 : a, row === 0 ? a : a + 1); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}
