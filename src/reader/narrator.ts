// The narrator: turns sentences into audio a few minutes ahead of where you
// are listening, plays them at your speed, and pauses to catch up when the
// computer falls behind.
//
//   idle ──Prepare──▶ preparing ──Play──▶ playing ──(next clip missing)──▶ catching-up
//     ▲                                     │  ▲                               │
//     └──────────────Pause──────────────────┘  └──── buffer ≥ catch-up goal ───┘
//
// Generation runs only while preparing, playing or catching up, and only up
// to the look-ahead window, so stopping early wastes no work.

import { getClip, hashKey, putClip, toWav, trimSilence } from './audio-store.ts';

export interface VoiceBackend {
  init(onProgress: (loaded: number, total: number, file: string) => void, onNote: (t: string) => void): Promise<{ device: string }>;
  generate(text: string, voice: string): Promise<{ pcm: Float32Array; sr: number; ms: number }>;
}

export interface Line {
  id: number;
  spoken: string;
}

export type Mode = 'idle' | 'loading' | 'preparing' | 'starting' | 'playing' | 'catching-up' | 'paused';

interface Ready {
  url: string;
  dur: number;
}

export interface NarratorEvents {
  onMode(mode: Mode): void;
  onSentence(index: number): void;
  onBuffer(info: { aheadSec: number; goalSec: number; rtf: number | null; generating: boolean }): void;
  onLoadProgress(text: string): void;
  onError(text: string): void;
}

export class Narrator {
  lines: Line[] = [];
  index = 0;
  speed = 2;
  voice = 'af_heart';
  lookAheadMin = 5;
  catchUpMin = 3;
  mode: Mode = 'idle';

  private ready = new Map<number, Ready>();
  private pending = new Set<number>();
  private generating = false;
  private backendReady: Promise<void> | null = null;
  private audio = new Audio();
  private rtfSamples: number[] = [];
  private epoch = 0; // bumps when lines/voice change so stale results are dropped

  private backend: VoiceBackend;
  private ev: NarratorEvents;

  constructor(backend: VoiceBackend, ev: NarratorEvents) {
    this.backend = backend;
    this.ev = ev;
    this.audio.preservesPitch = true;
    this.audio.addEventListener('ended', () => this.advance());
    this.audio.addEventListener('error', () => this.advance());
  }

  // ----- public controls -----

  setLines(lines: Line[], startAt = 0) {
    this.stopAudio();
    this.epoch++;
    this.dropAll();
    this.lines = lines;
    this.index = Math.max(0, Math.min(startAt, lines.length - 1));
    this.setMode('idle');
    this.emitBuffer();
  }

  setVoice(v: string) {
    if (v === this.voice) return;
    this.voice = v;
    this.epoch++;
    this.dropAll();
    const wasPlaying = this.mode === 'playing' || this.mode === 'catching-up';
    this.stopAudio();
    if (wasPlaying) void this.play();
    else if (this.mode === 'preparing') this.pump();
    this.emitBuffer();
  }

  setSpeed(s: number) {
    this.speed = s;
    this.audio.playbackRate = s;
    this.emitBuffer();
    this.pump();
  }

  setLookAhead(min: number) {
    this.lookAheadMin = min;
    this.emitBuffer();
    this.pump();
  }

  async prepare() {
    if (!this.lines.length) return;
    await this.ensureBackend();
    if (this.mode === 'idle' || this.mode === 'paused') this.setMode('preparing');
    this.pump();
  }

  async play() {
    if (!this.lines.length) return;
    await this.ensureBackend();
    if (this.ready.has(this.index)) {
      this.setMode('playing');
      this.startClip();
    } else {
      this.setMode('starting');
    }
    this.pump();
  }

  pause() {
    this.audio.pause();
    this.setMode('paused');
  }

  toggle() {
    if (this.mode === 'playing' || this.mode === 'catching-up' || this.mode === 'starting') this.pause();
    else void this.play();
  }

  seek(index: number, autoplay = this.mode === 'playing' || this.mode === 'catching-up' || this.mode === 'starting') {
    if (index < 0 || index >= this.lines.length) return;
    this.stopAudio();
    this.index = index;
    this.pruneOutsideWindow();
    this.ev.onSentence(index);
    if (autoplay) void this.play();
    else this.emitBuffer();
    this.pump();
  }

  /** Say one bit of text right away (Pronunciation lab). Pauses reading first. */
  private sampleAudio = new Audio();
  async sample(text: string): Promise<void> {
    if (this.mode === 'playing' || this.mode === 'catching-up' || this.mode === 'starting') this.pause();
    await this.ensureBackend();
    const key = `${this.voice}|${hashKey(text)}`;
    const cached = await getClip(key);
    let wav: Blob;
    if (cached) wav = cached.wav;
    else {
      const { pcm, sr } = await this.backend.generate(text, this.voice);
      const trimmed = trimSilence(pcm, sr);
      wav = toWav(trimmed, sr);
      void putClip({ key, wav, dur: trimmed.length / sr, at: Date.now() });
    }
    const url = URL.createObjectURL(wav);
    this.sampleAudio.pause();
    this.sampleAudio.src = url;
    this.sampleAudio.preservesPitch = true;
    this.sampleAudio.playbackRate = this.speed;
    this.sampleAudio.onended = () => URL.revokeObjectURL(url);
    await this.sampleAudio.play();
  }

  /** Listening seconds of audio ready, contiguous from the current sentence. */
  aheadSec(): number {
    let s = 0;
    for (let i = this.index; i < this.lines.length; i++) {
      const r = this.ready.get(i);
      if (!r) break;
      s += r.dur;
    }
    // the current clip is partly played already
    if (this.mode === 'playing' && this.ready.has(this.index) && isFinite(this.audio.currentTime)) s -= this.audio.currentTime;
    return Math.max(0, s / this.speed);
  }

  rtf(): number | null {
    if (this.rtfSamples.length < 2) return null;
    const xs = this.rtfSamples.slice(-12);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  // ----- internals -----

  private setMode(m: Mode) {
    this.mode = m;
    this.ev.onMode(m);
    this.emitBuffer();
  }

  private ensureBackend(): Promise<void> {
    if (!this.backendReady) {
      const prev = this.mode;
      this.setMode('loading');
      this.backendReady = this.backend
        .init(
          (loaded, total, file) => this.ev.onLoadProgress(`Downloading voice (${file}): ${Math.round(loaded / 1e6)} of ${Math.round(total / 1e6)} MB`),
          (t) => this.ev.onLoadProgress(t),
        )
        .then(({ device }) => {
          this.ev.onLoadProgress(`Voice ready on ${device === 'webgpu' ? 'the graphics chip' : 'the processor'}.`);
          this.setMode(prev === 'loading' ? 'idle' : prev);
        })
        .catch((err) => {
          this.backendReady = null;
          this.setMode('idle');
          this.ev.onError(`Couldn't load the voice: ${err?.message ?? err}. If you're on UTMB Wi-Fi, the first download needs another network (Guest Wi-Fi or a hotspot).`);
          throw err;
        });
    }
    return this.backendReady;
  }

  private goalSec(): number {
    return this.lookAheadMin * 60;
  }

  private active(): boolean {
    return this.mode === 'preparing' || this.mode === 'playing' || this.mode === 'catching-up' || this.mode === 'starting';
  }

  /** Generate the next missing sentence if we're under the look-ahead goal. Runs one job at a time. */
  private pump() {
    if (this.generating || !this.active() || !this.backendReady) return;
    if (this.aheadSec() >= this.goalSec()) {
      this.emitBuffer();
      return;
    }
    let next = this.index;
    while (next < this.lines.length && (this.ready.has(next) || this.pending.has(next))) next++;
    if (next >= this.lines.length) {
      this.emitBuffer();
      return;
    }
    void this.produce(next);
  }

  private async produce(i: number) {
    const line = this.lines[i];
    const epoch = this.epoch;
    this.generating = true;
    this.pending.add(i);
    this.emitBuffer();
    try {
      const key = `${this.voice}|${hashKey(line.spoken)}`;
      const cached = await getClip(key);
      let wav: Blob;
      let dur: number;
      if (cached) {
        ({ wav, dur } = cached);
      } else {
        await this.backendReady;
        const { pcm, sr, ms } = await this.backend.generate(line.spoken, this.voice);
        const trimmed = trimSilence(pcm, sr);
        dur = trimmed.length / sr;
        if (ms > 0 && dur > 0) this.rtfSamples.push(dur / (ms / 1000));
        wav = toWav(trimmed, sr);
        void putClip({ key, wav, dur, at: Date.now() });
      }
      if (epoch !== this.epoch) return;
      this.ready.set(i, { url: URL.createObjectURL(wav), dur });
    } catch (err) {
      if (epoch === this.epoch) {
        // skip an unspeakable sentence rather than stalling forever
        this.ready.set(i, { url: '', dur: 0 });
        console.warn('generation failed for sentence', i, err);
      }
    } finally {
      this.pending.delete(i);
      this.generating = false;
    }
    if (epoch !== this.epoch) return this.pump();
    if (this.mode === 'catching-up' || this.mode === 'starting') {
      // starting from scratch: go once ~20 s is ready; mid-read catch-up: refill a few minutes first
      const want = this.mode === 'starting' ? 20 : Math.min(this.catchUpMin * 60, this.goalSec());
      const enough = this.aheadSec() >= want || this.allReadyToEnd();
      if (enough) {
        this.setMode('playing');
        this.startClip();
      }
    }
    this.emitBuffer();
    this.pump();
  }

  private allReadyToEnd(): boolean {
    for (let i = this.index; i < this.lines.length; i++) if (!this.ready.has(i)) return false;
    return true;
  }

  private startClip() {
    const r = this.ready.get(this.index);
    if (!r) {
      this.setMode('catching-up');
      this.pump();
      return;
    }
    this.ev.onSentence(this.index);
    if (!r.url || r.dur === 0) return this.advance();
    this.audio.src = r.url;
    this.audio.playbackRate = this.speed;
    this.audio.preservesPitch = true;
    void this.audio.play().catch(() => {
      /* autoplay blocked: wait for the next click */
      this.setMode('paused');
    });
  }

  private advance() {
    if (this.mode !== 'playing') return;
    const done = this.ready.get(this.index);
    if (done?.url) URL.revokeObjectURL(done.url);
    this.ready.delete(this.index);
    this.index++;
    if (this.index >= this.lines.length) {
      this.index = this.lines.length - 1;
      this.setMode('idle');
      this.ev.onSentence(-1);
      return;
    }
    if (this.ready.has(this.index)) this.startClip();
    else {
      this.ev.onSentence(this.index);
      this.setMode('catching-up');
    }
    this.pump();
  }

  private stopAudio() {
    this.audio.pause();
    this.audio.removeAttribute('src');
  }

  private dropAll() {
    for (const r of this.ready.values()) if (r.url) URL.revokeObjectURL(r.url);
    this.ready.clear();
    this.pending.clear();
  }

  private pruneOutsideWindow() {
    for (const [i, r] of this.ready) {
      if (i < this.index || i > this.index + 400) {
        if (r.url) URL.revokeObjectURL(r.url);
        this.ready.delete(i);
      }
    }
  }

  private emitBuffer() {
    this.ev.onBuffer({ aheadSec: this.aheadSec(), goalSec: this.goalSec(), rtf: this.rtf(), generating: this.generating });
  }
}

/** Kokoro running in a Web Worker. */
export class KokoroBackend implements VoiceBackend {
  private worker: Worker | null = null;
  private jobs = new Map<number, { resolve: (v: { pcm: Float32Array; sr: number; ms: number }) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private workerUrl: string;
  private dtype: string;
  private device: string;
  constructor(workerUrl: string, dtype: string, device: string) {
    this.workerUrl = workerUrl;
    this.dtype = dtype;
    this.device = device;
  }

  init(onProgress: (l: number, t: number, f: string) => void, onNote: (t: string) => void): Promise<{ device: string }> {
    return new Promise((resolve, reject) => {
      const w = new Worker(this.workerUrl, { type: 'module' });
      this.worker = w;
      w.onerror = (e) => reject(new Error(e.message || 'the voice worker failed to start'));
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress') onProgress(m.loaded, m.total, String(m.file).split('/').pop() ?? '');
        else if (m.type === 'note') onNote(m.text);
        else if (m.type === 'ready') resolve({ device: m.device });
        else if (m.type === 'error') reject(new Error(m.message));
        else if (m.type === 'audio') {
          this.jobs.get(m.id)?.resolve({ pcm: m.pcm, sr: m.sr, ms: m.ms });
          this.jobs.delete(m.id);
        } else if (m.type === 'gen-error') {
          this.jobs.get(m.id)?.reject(new Error(m.message));
          this.jobs.delete(m.id);
        }
      };
      w.postMessage({ type: 'init', dtype: this.dtype, device: this.device });
    });
  }

  generate(text: string, voice: string) {
    return new Promise<{ pcm: Float32Array; sr: number; ms: number }>((resolve, reject) => {
      const id = this.nextId++;
      this.jobs.set(id, { resolve, reject });
      this.worker!.postMessage({ type: 'gen', id, text, voice });
    });
  }
}

/** Test stand-in: a soft tone whose length follows the text, generated at a set speed. */
export class MockBackend implements VoiceBackend {
  private rtf: number;
  constructor(rtf = 3) {
    this.rtf = rtf;
  }
  async init(onProgress: (l: number, t: number, f: string) => void) {
    onProgress(50e6, 100e6, 'mock.onnx');
    await new Promise((r) => setTimeout(r, 200));
    return { device: 'mock' };
  }
  async generate(text: string) {
    const sr = 24000;
    const dur = Math.max(0.6, text.length / 15); // ~15 chars per second at 1x
    const pcm = new Float32Array(Math.floor(dur * sr));
    for (let i = 0; i < pcm.length; i++) pcm[i] = 0.05 * Math.sin((2 * Math.PI * 220 * i) / sr);
    const ms = (dur / this.rtf) * 1000;
    await new Promise((r) => setTimeout(r, ms));
    return { pcm, sr, ms };
  }
}
