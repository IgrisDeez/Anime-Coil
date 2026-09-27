import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodySkinAppearance, createSpiritweavePixels, isPlayerMarkSegment, PLAYER_MARK_INTERVAL, SkinPreviewSelection, SPIRITWEAVE_SIZE } from '../src/coil-skins.ts';
import { CHARACTERS } from '../src/simulation.ts';
import { Progression } from '../src/progression.ts';

test('Spiritweave is deterministic, grayscale, opaque, and seamless at tile edges', () => {
  const pixels = createSpiritweavePixels();
  assert.deepEqual(pixels, createSpiritweavePixels());
  assert.equal(pixels.length, SPIRITWEAVE_SIZE * SPIRITWEAVE_SIZE * 4);
  const tones = new Set<number>();
  for (let y = 0; y < SPIRITWEAVE_SIZE; y++) {
    for (let x = 0; x < SPIRITWEAVE_SIZE; x++) {
      const offset = (y * SPIRITWEAVE_SIZE + x) * 4;
      assert.equal(pixels[offset], pixels[offset + 1]);
      assert.equal(pixels[offset], pixels[offset + 2]);
      assert.equal(pixels[offset + 3], 255);
      tones.add(pixels[offset]);
    }
    assert.equal(pixels[(y * SPIRITWEAVE_SIZE) * 4], pixels[(y * SPIRITWEAVE_SIZE + SPIRITWEAVE_SIZE - 1) * 4]);
  }
  assert.equal(tones.size, 3);
  for (let x = 0; x < SPIRITWEAVE_SIZE; x++) {
    assert.equal(pixels[x * 4], pixels[((SPIRITWEAVE_SIZE - 1) * SPIRITWEAVE_SIZE + x) * 4]);
  }
});

test('body finishes overlay without replacing any character core hue', () => {
  for (const character of CHARACTERS) {
    const neon = bodySkinAppearance('neon', character.color);
    assert.equal(neon.emissiveColor, character.color);
    assert.ok(neon.emissiveIntensity > 0 && neon.emissiveIntensity < 1);
    assert.equal(neon.texture, 'none');
    const weave = bodySkinAppearance('spiritweave', character.color);
    assert.equal(weave.texture, 'spiritweave');
    assert.equal(weave.emissiveIntensity, 0);
    assert.equal(bodySkinAppearance('original', character.color).emissiveIntensity, 0);
  }
});

test('Spiritweave texture dimensions reject invalid profile sizes', () => {
  assert.throws(() => createSpiritweavePixels(7), RangeError);
  assert.throws(() => createSpiritweavePixels(31), RangeError);
  assert.equal(createSpiritweavePixels(16).length, 16 * 16 * 4);
});

test('player ownership marks repeat every sixth body segment across growth and respawn', () => {
  assert.equal(PLAYER_MARK_INTERVAL, 6);
  assert.deepEqual(Array.from({ length: 30 }, (_, i) => i).filter(isPlayerMarkSegment), [6, 12, 18, 24]);
  assert.equal(Array.from({ length: 360 }, (_, i) => i).filter(isPlayerMarkSegment).length, 59);
  assert.equal(isPlayerMarkSegment(6.5), false);
  for (const character of CHARACTERS) assert.ok(character.id);
});

test('locked skin try-on stays separate from saved equipment and clears on leaving menu', () => {
  const progression = new Progression();
  const preview = new SkinPreviewSelection();
  preview.select('neon');
  assert.equal(preview.displayed(progression.state.cosmetics.skin), 'neon');
  assert.equal(progression.state.cosmetics.skin, 'original');
  assert.equal(progression.equipSkin('neon'), false);
  preview.select('spiritweave');
  assert.equal(preview.displayed(progression.state.cosmetics.skin), 'spiritweave');
  preview.clear();
  assert.equal(preview.displayed(progression.state.cosmetics.skin), 'original');
});
