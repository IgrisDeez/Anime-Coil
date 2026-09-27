import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AudioEngine } from "../src/audio.ts";
import {
  DEFAULT_AUDIO,
  loadAudio,
  saveAudio,
} from "../src/audio-settings.ts";
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
class Param {
  value = 1;
  setTargetAtTime(v: number) {
    this.value = v;
  }
  setValueAtTime(v: number) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
  }
}
class Node {
  gain = new Param();
  frequency = new Param();
  started = false;
  stopped = false;
  disconnected = false;
  loop = false;
  onended: (() => void) | null = null;
  buffer: unknown;
  type = "sine";
  connect(_?: unknown) {}
  disconnect() {
    this.disconnected = true;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
    this.onended?.();
  }
}
class Context {
  currentTime = 1;
  sampleRate = 44100;
  destination = {};
  state = "suspended";
  sources: Node[] = [];
  gains: Node[] = [];
  oscillators: Node[] = [];
  createGain() {
    const n = new Node();
    this.gains.push(n);
    return n;
  }
  createBufferSource() {
    const n = new Node();
    this.sources.push(n);
    return n;
  }
  createOscillator() {
    const n = new Node();
    this.oscillators.push(n);
    return n;
  }
  createBiquadFilter() { return new Node(); }
  createBuffer(_channels: number, length: number) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  async decodeAudioData(_b: ArrayBuffer) {
    return { duration: 1 };
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
}
function engine(
  fetcher: typeof fetch = (async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch,
) {
  const ctx = new Context();
  return {
    ctx,
    a: new AudioEngine(() => ctx as unknown as AudioContext, fetcher),
  };
}
test("audio settings preserve legacy mute, clamp values and tolerate disabled storage", () => {
  const values = new Map([
    ["anime-coil-sound", "off"],
    ["anime-coil-audio-v1", '{"music":3,"effects":-2,"voices":"oops"}'],
  ]);
  const store = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  assert.deepEqual(loadAudio(store), {
    enabled: false,
    effects: 0,
    voices: 0.8,
  });
  saveAudio(DEFAULT_AUDIO, store);
  assert.deepEqual(loadAudio(store), DEFAULT_AUDIO);
  const blocked = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  };
  assert.deepEqual(loadAudio(blocked), DEFAULT_AUDIO);
  assert.doesNotThrow(() => saveAudio(DEFAULT_AUDIO, blocked));
});
test("audio unlock creates no background playback", async () => {
  const { a, ctx } = engine();
  a.unlock();
  a.unlock();
  await flush();
  assert.equal(ctx.sources.length, 0);
  assert.equal(a.missingClips.size, 0);
});
test('death and recovery cues use Effects volume and respect mute', () => {
  const { a, ctx } = engine();
  a.unlock();
  a.play('death');
  a.play('respawn');
  assert.equal(ctx.oscillators.length, 3);
  a.setVolume('effects', 0);
  a.play('death');
  a.play('respawn');
  assert.equal(ctx.oscillators.length, 3);
  a.setVolume('effects', .5);
  a.enabled = false;
  a.play('respawn');
  assert.equal(ctx.oscillators.length, 3);
  a.enabled = true;
  a.play('respawn');
  assert.equal(ctx.oscillators.length, 5);
});
test("new form cues synthesize through Effects, coalesce impacts, and add no voice clips", () => {
  const { a, ctx } = engine();
  a.unlock();
  a.transformation("nine-tail", "start");
  assert.equal(ctx.oscillators.length, 2);
  a.transformation("skybreaker", "launch");
  assert.equal(ctx.oscillators.length, 3);
  a.transformation("skybreaker", "impact");
  const impactCount = ctx.oscillators.length;
  a.transformation("skybreaker", "impact");
  assert.equal(ctx.oscillators.length, impactCount, "simultaneous impact duplicates are coalesced");
  a.setVolume("effects", 0);
  a.transformation("nine-tail", "end");
  assert.equal(ctx.oscillators.length, impactCount);
  assert.equal(ctx.sources.length, 0, "forms do not load or play voice clips");
});
test("skill voices replace one another without overlapping", async () => {
  const { a, ctx } = engine();
  a.unlock();
  await flush();
  a.skill("ember");
  await flush();
  const first = ctx.sources.at(-1)!;
  assert.ok(first.started);
  a.skill("nova");
  await flush();
  assert.equal(first.stopped, true);
  assert.equal(first.disconnected, true);
  const current = ctx.sources.at(-1)!;
  assert.notEqual(first, current);
  current.onended!();
});
test("late voice loads cannot play after quit, mute, or hiding the tab", async () => {
  for (const reason of ["reset", "mute", "hidden"]) {
    let finish!: () => void;
    const gate = new Promise<void>((r) => (finish = r));
    const { a, ctx } = engine((async () => {
      await gate;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    }) as unknown as typeof fetch);
    a.unlock();
    a.skill("eclipse", "purple");
    if (reason === "reset") a.resetTransient();
    if (reason === "mute") a.enabled = false;
    if (reason === "hidden") a.setHidden(true);
    finish();
    await flush();
    assert.equal(ctx.sources.filter((s) => !s.loop).length, 0);
    if (reason === "hidden") {
      assert.equal(ctx.state, "suspended");
      a.setHidden(false);
      assert.equal(ctx.state, "running");
    }
  }
});
test("zero voice volume cancels active speech; missing files keep effects and game usable", async () => {
  const { a, ctx } = engine();
  a.unlock();
  await flush();
  a.skill("cloud");
  await flush();
  const voice = ctx.sources.at(-1)!;
  a.setVolume("voices", 0);
  assert.equal(voice.stopped, true);
  const count = ctx.sources.length;
  a.skill("ember");
  await flush();
  assert.equal(ctx.sources.length, count);
  const broken = engine((async () => ({
    ok: false,
  })) as unknown as typeof fetch);
  broken.a.unlock();
  await flush();
  broken.a.skill("cloud");
  await flush();
  assert.ok(broken.a.missingClips.has("cloud"));
  assert.ok(broken.ctx.oscillators.length > 0);
  const unsupported = new AudioEngine(() => {
    throw Error("unavailable");
  });
  assert.doesNotThrow(() => unsupported.unlock());
  assert.equal(unsupported.unavailable, true);
});
test("all six Japanese callouts bundle cleanly", () => {
  for (const clip of ["ember", "nova", "cloud", "eclipse", "purple", "spirit"]) {
    const wav = readFileSync(
      new URL(`../public/audio/${clip}.wav`, import.meta.url),
    );
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    const rate = wav.readUInt32LE(24),
      bytesPerSecond = wav.readUInt32LE(28);
    let offset = 12,
      data: Buffer | undefined;
    while (offset + 8 <= wav.length) {
      const size = wav.readUInt32LE(offset + 4);
      if (wav.toString("ascii", offset, offset + 4) === "data") {
        data = wav.subarray(offset + 8, offset + 8 + size);
        break;
      }
      offset += 8 + size + (size % 2);
    }
    assert.ok(data);
    assert.ok(rate >= 22050);
    let peak = 0;
    for (let i = 0; i < data.length; i += 2)
      peak = Math.max(peak, Math.abs(data.readInt16LE(i)));
    assert.ok(peak > 500 && peak < 32767, `${clip}: audible without clipping`);
    assert.ok(data.length / bytesPerSecond > 0.4);
  }
});
test('boost wind starts once, reuses its loop on quick restart, and stops after release', async () => {
  const { a, ctx } = engine(); a.unlock(); await flush();
  a.setBoost(true, false, .4);
  const first = ctx.sources.find(s => s.loop)!;
  assert.ok(first.started);
  a.setBoost(true, false, 1);
  assert.equal(ctx.sources.filter(s => s.loop).length, 1);
  a.setBoost(false, false, 0);
  ctx.currentTime += .1;
  a.setBoost(true, true, 1);
  assert.equal(ctx.sources.filter(s => s.loop).length, 1);
  a.setBoost(false, false, 0);
  ctx.currentTime += .31;
  a.setBoost(false, false, 0);
  assert.equal(first.stopped, true);
  assert.equal(first.disconnected, true);
  a.setBoost(true, true, 1);
  assert.equal(ctx.sources.filter(s => s.loop).length, 2);
  a.resetTransient();
  assert.ok(ctx.sources.filter(s => s.loop).every(s => s.stopped));
});
test('boost audio obeys mute, effects volume, and hidden-tab lifecycle', async () => {
  const { a, ctx } = engine(); a.unlock(); await flush();
  a.setBoost(true, false, 1);
  a.enabled = false;
  assert.ok(ctx.sources.find(s => s.loop)!.stopped);
  a.enabled = true;
  a.setBoost(true, true, 1);
  a.setVolume('effects', 0);
  assert.ok(ctx.sources.filter(s => s.loop).every(s => s.stopped));
  a.setVolume('effects', .65);
  a.setBoost(true, false, 1);
  a.setHidden(true);
  assert.ok(ctx.sources.filter(s => s.loop).every(s => s.stopped));
  assert.equal(ctx.state, 'suspended');
  a.setHidden(false);
  assert.equal(ctx.state, 'running');
});
test('elimination impact coalesces multi-kills and respects effects controls', async () => {
  const { a, ctx } = engine(); a.unlock(); await flush();
  a.elimination(20);
  assert.equal(ctx.oscillators.length, 3);
  a.elimination(1);
  assert.equal(ctx.oscillators.length, 3);
  ctx.currentTime += .1;
  a.elimination(1);
  assert.equal(ctx.oscillators.length, 6);
  a.setVolume('effects', 0);
  ctx.currentTime += .1;
  a.elimination(1);
  assert.equal(ctx.oscillators.length, 6);
  a.setVolume('effects', .65);
  a.enabled = false;
  a.elimination(1);
  assert.equal(ctx.oscillators.length, 6);
  a.enabled = true;
  a.setHidden(true);
  a.elimination(1);
  assert.equal(ctx.oscillators.length, 6);
  a.setHidden(false);
  a.elimination(0);
  assert.equal(ctx.oscillators.length, 6);
});
test('ultimate transition cues use Effects and stop cleanly with pause or mute', async () => {
  const { a, ctx } = engine(); a.unlock(); await flush();
  a.ultimateCue('purple', 'converge');
  a.ultimateCue('purple', 'compress');
  a.ultimateCue('spirit', 'throw');
  assert.equal(ctx.oscillators.length, 6);
  a.resetTransient();
  assert.ok(ctx.oscillators.every(oscillator => oscillator.stopped));
  a.setVolume('effects', 0);
  a.ultimateCue('spirit', 'throw');
  assert.equal(ctx.oscillators.length, 6);
  a.setVolume('effects', .65);
  a.setHidden(true);
  a.ultimateCue('purple', 'converge');
  assert.equal(ctx.oscillators.length, 6);
});
