// Voice worker: runs Kokoro off the main thread so the page stays smooth
// while audio is generated. Messages:
//   in : { type: 'init', dtype, device }          -> 'progress'*, 'ready' | 'error'
//   in : { type: 'gen', id, text, voice }         -> 'audio' | 'gen-error'
// Kokoro + its model come from public CDNs on first use and are then cached
// by the browser, so later sessions work offline (and on networks that block
// the model host).

const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';

type Gen = { audio: Float32Array; sampling_rate: number };
interface TTS {
  generate(text: string, o: { voice: string }): Promise<Gen>;
}
let tts: TTS | null = null;

// Voice style files are fetched outside the model cache; keep our own copy.
const realFetch = self.fetch.bind(self);
self.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!/\/voices\/[\w-]+\.bin/.test(url) || typeof caches === 'undefined') return realFetch(input, init);
  const cache = await caches.open('rtm-voices');
  const hit = await cache.match(url);
  if (hit) return hit;
  const res = await realFetch(input, init);
  if (res.ok) await cache.put(url, res.clone());
  return res;
};

const post = (m: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      const mod = await import(/* @vite-ignore */ KOKORO_URL as string);
      let device = m.device as string;
      if (device === 'webgpu') {
        const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
        const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
        if (!adapter) {
          device = 'wasm';
          post({ type: 'note', text: 'No graphics chip available here; using the processor.' });
        }
      }
      let dtype = device === 'wasm' && m.dtype !== 'q8' ? 'q8' : m.dtype;
      const opts = (dt: string, dev: string) => ({
        dtype: dt,
        device: dev,
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === 'progress' && (p.total ?? 0) > 1e6) post({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total });
        },
      });
      try {
        tts = await mod.KokoroTTS.from_pretrained(MODEL, opts(dtype, device));
      } catch (err) {
        if (device !== 'webgpu') throw err;
        post({ type: 'note', text: `Graphics chip didn't work here (${(err as Error)?.message ?? err}); switching to the processor model.` });
        device = 'wasm';
        dtype = 'q8';
        tts = await mod.KokoroTTS.from_pretrained(MODEL, opts(dtype, device));
      }
      post({ type: 'ready', device, dtype });
    } catch (err) {
      post({ type: 'error', message: String((err as Error)?.message ?? err) });
    }
    return;
  }
  if (m.type === 'gen') {
    if (!tts) return post({ type: 'gen-error', id: m.id, message: 'voice not loaded' });
    try {
      const t0 = performance.now();
      const out = await tts.generate(m.text, { voice: m.voice });
      const ms = performance.now() - t0;
      const pcm = out.audio instanceof Float32Array ? out.audio : new Float32Array(out.audio);
      post({ type: 'audio', id: m.id, pcm, sr: out.sampling_rate, ms }, [pcm.buffer]);
    } catch (err) {
      post({ type: 'gen-error', id: m.id, message: String((err as Error)?.message ?? err) });
    }
  }
};
