import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SURFACES, createSurfaceTexture, surfacePixels } from '../src/worlds/surfaces.ts';
import { buildEnvironment } from '../src/environments.ts';
import { WorldBuilder } from '../src/worlds/builder.ts';
import { MAPS } from '../src/maps.ts';

test('all surface textures are deterministic, opaque and restrained in contrast', () => {
  for(const kind of SURFACES) {
    const a=surfacePixels(kind,128),b=surfacePixels(kind,128);
    assert.deepEqual(a,b);
    let min=255,max=0;
    for(let i=0;i<a.length;i+=4){min=Math.min(min,a[i]);max=Math.max(max,a[i]);assert.equal(a[i+3],255);}
    assert.ok(min>=190 && max<=255 && max>min,kind);
  }
});
test('texture profiles repeat with mipmaps and gracefully tolerate generation failure', () => {
  for(const profile of ['desktop','mobile'] as const) {
    const tex=createSurfaceTexture('wood',profile)!;
    assert.equal(tex.image.width,profile==='desktop'?256:128);
    assert.equal(tex.wrapS,THREE.RepeatWrapping);assert.equal(tex.wrapT,THREE.RepeatWrapping);
    assert.equal(tex.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(tex.generateMipmaps,true);tex.dispose();
  }
  assert.equal(createSurfaceTexture('wood','desktop',()=>{throw new Error('unavailable');}),undefined);
});
test('sign atlas uses inset finite UVs and no cross-cell mipmaps',()=>{
  const b=new WorldBuilder('mobile'),g=new THREE.Group();
  const sign=b.sign(g,'COIL','#ffffff',0,0,0,10,3);
  const uv=sign.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++){assert.ok(uv.getX(i)>0&&uv.getX(i)<.25);assert.ok(uv.getY(i)>.9375&&uv.getY(i)<1);}
  const map=(sign.material as THREE.MeshBasicMaterial).map!;
  assert.equal(map.generateMipmaps,false);assert.equal(map.minFilter,THREE.LinearFilter);
  // Headless fallback remains opaque rather than an invisible canvas.
  assert.equal((map as THREE.DataTexture).image.data[3],255);b.dispose();
});
test('every map has finite surface UVs, shared textured batches, and stable repeated construction',()=>{
  for(const map of MAPS) for(const profile of ['desktop','mobile'] as const) {
    let expected: string|undefined;
    for(let cycle=0;cycle<3;cycle++) {
      const env=buildEnvironment(map.id,profile),textures=new Set<THREE.Texture>();
      env.group.traverse(o=>{if(o instanceof THREE.Mesh){
        const uv=o.geometry.attributes.uv;
        if(uv)for(let i=0;i<uv.count;i++)assert.ok(Number.isFinite(uv.getX(i)+uv.getY(i)));
        for(const m of Array.isArray(o.material)?o.material:[o.material]) {
          const tex=(m as THREE.MeshBasicMaterial).map;if(tex)textures.add(tex);
        }
      }});
      assert.ok(textures.size>=3);
      const stats=JSON.stringify(env.stats);if(expected)assert.equal(stats,expected);expected=stats;
      const disposed=new Map<THREE.Texture,number>();textures.forEach(t=>t.addEventListener('dispose',()=>disposed.set(t,(disposed.get(t)??0)+1)));
      env.dispose();env.dispose();textures.forEach(t=>assert.equal(disposed.get(t),1));
    }
  }
});

test('continuous paths face upward and share section edges without overlapping strips',()=>{
  const b=new WorldBuilder('desktop');
  const path=b.path('#aaa',[[0,0],[10,2],[20,0]],4,-.475,'sand');
  const normal=path.geometry.attributes.normal,pos=path.geometry.attributes.position;
  assert.equal(pos.count,12);
  for(let i=0;i<normal.count;i++)assert.ok(normal.getY(i)>.99);
  assert.deepEqual([pos.getX(1),pos.getZ(1)],[pos.getX(6),pos.getZ(6)]);
  assert.deepEqual([pos.getX(2),pos.getZ(2)],[pos.getX(11),pos.getZ(11)]);
  assert.equal(b.surfaceMaterial('sand'),path.material);
  assert.equal(b.textures.size,2);b.dispose();
});
