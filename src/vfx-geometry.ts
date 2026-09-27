import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** One tapered, curved spirit-tail silhouette, pointing down local +Z. */
export function spiritTailGeometry(segments = 12, sides = 7): THREE.BufferGeometry {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let row = 0; row <= segments; row++) {
    const t = row / segments;
    const radius = .25 * Math.pow(1 - t, .7) + .006;
    const bend = .4 * Math.sin(t * Math.PI * .9);
    for (let side = 0; side <= sides; side++) {
      const a = side / sides * Math.PI * 2;
      positions.push(bend + Math.cos(a) * radius, Math.sin(a) * radius, t * 2.25);
      normals.push(Math.cos(a), Math.sin(a), 0);
      if (row < segments && side < sides) {
        const n = row * (sides + 1) + side;
        indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Palm, cuff, four knuckles and an offset thumb merge into one instanced fist draw. */
export function spectralFistGeometry(detail: 'desktop' | 'mobile'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const part = new THREE.BoxGeometry(sx, sy, sz);
    part.translate(x, y, z); parts.push(part);
  };
  box(0, 0, 0, .92, .68, 1.08);
  box(0, -.04, -.61, .72, .57, .26);
  for (let i = 0; i < 4; i++) box((i - 1.5) * .23, .1, .62, .21, .49, .31);
  box(.55, -.1, .17, .3, .42, .43);
  const merged = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!merged) throw new Error('Could not build spectral fist');
  merged.computeVertexNormals();
  if (detail === 'desktop') merged.computeBoundingSphere();
  return merged;
}

/** Flat tapered manga slash, facing upward along the world ground plane. */
export function taperedSlashGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.58,0,-.07,  -.58,0,.07,  .62,0,0,
  ], 3));
  geometry.setIndex([0,1,2]);
  geometry.computeVertexNormals();
  return geometry;
}

/** Compact eight-point impact accent, drawn as a single instanced mesh. */
export function impactStarGeometry(): THREE.BufferGeometry {
  const positions: number[] = [0,0,0];
  const indices: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, r = i % 2 ? .32 : 1;
    positions.push(Math.cos(a)*r, 0, Math.sin(a)*r);
  }
  for (let i = 0; i < 16; i++) indices.push(0, i+1, (i+1)%16+1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Jagged triangular rupture sheet, thin at its tip rather than a square card. */
export function ruptureSheetGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.5,0,0, -.26,.58,0, .08,.2,0,
    -.26,.58,0, .18,1.18,0, .08,.2,0,
    .08,.2,0, .18,1.18,0, .53,.34,0,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}
