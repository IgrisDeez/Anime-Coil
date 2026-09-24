import type { CharacterId } from "./simulation";
import {
  DEFAULT_AUDIO,
  volume,
  type AudioChannel,
  type AudioPreferences,
} from "./audio-settings";
type Clip = CharacterId | "purple" | "spirit";
export class AudioEngine {
  prefs: AudioPreferences = { ...DEFAULT_AUDIO };
  unavailable = false;
  missingClips = new Set<string>();
  private ctx?: AudioContext;
  private master?: GainNode;
  private channels?: Record<AudioChannel, GainNode>;
  private buffers = new Map<Clip, Promise<AudioBuffer | undefined>>();
  private voice?: AudioBufferSourceNode;
  private effects = new Set<OscillatorNode>();
  private voiceToken = 0;
  private hidden = false;
  private lastCollect = -1;
  constructor(
    private contextFactory: () => AudioContext = () => new AudioContext(),
    private fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}
  get enabled() {
    return this.prefs.enabled;
  }
  set enabled(on: boolean) {
    this.prefs.enabled = on;
    if (!on) this.stopVoices();
    this.applyVolumes();
  }
  setVolume(channel: AudioChannel, value: number) {
    this.prefs[channel] = volume(value, this.prefs[channel]);
    if (channel === "voices" && value === 0) this.stopVoices();
    this.applyVolumes();
  }
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = this.contextFactory();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.channels = {
          effects: this.ctx.createGain(),
          voices: this.ctx.createGain(),
        };
        Object.values(this.channels).forEach((g) => g.connect(this.master!));
        for (const clip of [
          "ember",
          "nova",
          "cloud",
          "eclipse",
          "purple",
          "spirit",
        ] as const)
          void this.load(clip);
        this.applyVolumes();
      }
      if (!this.hidden) void this.ctx.resume().catch(() => {});
    } catch {
      this.unavailable = true;
    }
  }
  private load(clip: Clip): Promise<AudioBuffer | undefined> {
    if (!this.buffers.has(clip))
      this.buffers.set(
        clip,
        (async () => {
          try {
            const response = await this.fetcher(
              `${import.meta.env?.BASE_URL ?? "/"}audio/${clip}.wav`,
            );
            if (!response.ok) throw new Error("Audio missing");
            return await this.ctx!.decodeAudioData(
              await response.arrayBuffer(),
            );
          } catch (error) {
            console.warn(`Could not load audio: ${clip}`, error);
            this.missingClips.add(clip);
            return undefined;
          }
        })(),
      );
    return this.buffers.get(clip)!;
  }
  private applyVolumes() {
    if (!this.ctx || !this.master || !this.channels) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.enabled ? 1 : 0, t, 0.03);
    this.channels.effects.gain.setTargetAtTime(this.prefs.effects, t, 0.03);
    this.channels.voices.gain.setTargetAtTime(this.prefs.voices, t, 0.03);
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) {
      this.resetTransient();
      void this.ctx?.suspend().catch(() => {});
    } else void this.ctx?.resume().catch(() => {});
  }
  stopVoices() {
    this.voiceToken++;
    const old = this.voice;
    this.voice = undefined;
    if (old) {
      old.onended = null;
      try {
        old.stop();
      } catch {}
      old.disconnect();
    }
    this.applyVolumes();
  }
  resetTransient() {
    this.stopVoices();
    for (const o of this.effects) {
      try {
        o.stop();
      } catch {}
    }
    this.effects.clear();
  }
  private async speak(clip: Clip) {
    this.stopVoices();
    const token = this.voiceToken;
    if (!this.ctx || !this.enabled || this.hidden || this.prefs.voices === 0)
      return;
    const buffer = await this.load(clip);
    if (
      !buffer ||
      token !== this.voiceToken ||
      !this.enabled ||
      this.hidden ||
      !this.ctx ||
      !this.channels
    )
      return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.channels.voices);
    this.voice = source;
    source.onended = () => {
      source.disconnect();
      if (this.voice === source) {
        this.voice = undefined;
        this.applyVolumes();
      }
    };
    this.applyVolumes();
    source.start();
  }
  skill(character: CharacterId, ultimate?: "purple" | "spirit") {
    if (!this.ctx || !this.enabled || this.hidden) return;
    void this.speak(ultimate ?? character);
    if (ultimate === "spirit") {
      [196, 294, 392, 587].forEach((f, i) =>
        this.tone(f, f * 2, 2.8 - i * 0.2, 0.045, "sine", i * 0.2));
    } else if (ultimate === "purple") {
      this.tone(95, 360, 1.7, 0.1, "sine");
      this.tone(180, 520, 1.7, 0.065, "sine", 0.1);
    } else if (character === "ember") {
      for (let i = 0; i < 4; i++)
        this.tone(
          720 + i * 120,
          1000 + i * 110,
          0.16,
          0.05,
          "triangle",
          i * 0.06,
        );
    } else if (character === "nova") {
      [392, 523, 784, 1046].forEach((f, i) =>
        this.tone(f, f * 1.15, 0.35, 0.07, "sine", i * 0.09),
      );
    } else if (character === "cloud") {
      this.tone(160, 720, 0.2, 0.09, "triangle");
      this.tone(720, 240, 0.3, 0.065, "sine", 0.15);
    } else {
      [660, 880, 1320].forEach((f, i) =>
        this.tone(f, f, 0.8, 0.04, "sine", i * 0.08),
      );
    }
  }
  play(type: "collect" | "death" | "select" | "blast", ultimate?: "purple" | "spirit") {
    if (!this.ctx || !this.enabled || this.hidden) return;
    const t = this.ctx.currentTime;
    if (type === "collect") {
      if (t - this.lastCollect < 0.075) return;
      this.lastCollect = t;
      this.tone(780, 1170, 0.09, 0.065);
    }
    if (type === "select") this.tone(520, 680, 0.08, 0.06);
    if (type === "death") this.tone(220, 90, 0.5, 0.08, "triangle");
    if (type === "blast" && ultimate === "spirit") {
      this.tone(180, 34, 1.5, .2, "triangle");
      this.tone(440, 110, .7, .09, "sine");
      [523, 659, 784].forEach((f, i) => this.tone(f, f * .75, 1.4, .04, "sine", .25 + i * .12));
    } else if (type === "blast") {
      this.tone(120, 24, 1.8, 0.18, "triangle");
      this.tone(62, 28, 1.7, 0.17);
    }
  }
  private tone(
    from: number,
    to: number,
    duration: number,
    level: number,
    type: OscillatorType = "sine",
    delay = 0,
  ) {
    if (!this.ctx || !this.channels || this.prefs.effects === 0) return;
    const t = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.channels.effects);
    this.effects.add(o);
    o.onended = () => {
      this.effects.delete(o);
      o.disconnect();
      g.disconnect();
    };
    o.start(t);
    o.stop(t + duration + 0.02);
  }
}
