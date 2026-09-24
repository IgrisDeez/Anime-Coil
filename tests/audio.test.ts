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
