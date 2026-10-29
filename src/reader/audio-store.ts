// Saved audio, so reopening a PDF or skipping back never regenerates.
// Stored as 16-bit WAV blobs in IndexedDB, keyed by (voice, spoken text).
// Oldest entries are evicted past a size budget.

const DB = 'readtome-audio';
const STORE = 'clips';
const BUDGET_BYTES = 600 * 1024 * 1024;

export interface Clip {
  key: string;
  wav: Blob;
  dur: number; // seconds at 1x
  at: number; // last used (ms)
}

let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' }).createIndex('at', 'at');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

export async function getClip(key: string): Promise<Clip | null> {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const c = req.result as Clip | undefined;
        if (c) tx.objectStore(STORE).put({ ...c, at: Date.now() });
        resolve(c ?? null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let writes = 0;
export async function putClip(c: Clip): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    d.transaction(STORE, 'readwrite').objectStore(STORE).put(c);
  } catch {
    return;
  }
  if (++writes % 50 === 0) void evict();
}

async function evict(): Promise<void> {
  const d = await db();
  if (!d) return;
  const all: { key: string; at: number; size: number }[] = await new Promise((resolve) => {
    const out: { key: string; at: number; size: number }[] = [];
    const req = d.transaction(STORE).objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(out);
      const v = cur.value as Clip;
      out.push({ key: v.key, at: v.at, size: v.wav.size });
      cur.continue();
    };
    req.onerror = () => resolve(out);
  });
  let total = all.reduce((n, c) => n + c.size, 0);
  if (total <= BUDGET_BYTES) return;
  all.sort((a, b) => a.at - b.at);
  const tx = d.transaction(STORE, 'readwrite');
  for (const c of all) {
    if (total <= BUDGET_BYTES * 0.8) break;
    tx.objectStore(STORE).delete(c.key);
    total -= c.size;
  }
}

/** Float PCM -> 16-bit mono WAV. */
export function toWav(pcm: Float32Array, sr: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Trim leading/trailing near-silence so sentences flow at high speed. */
export function trimSilence(pcm: Float32Array, sr: number): Float32Array {
  const thr = 0.008;
  let a = 0;
  let b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < thr) a++;
  while (b > a && Math.abs(pcm[b]) < thr) b--;
  const pad = Math.floor(sr * 0.06);
  return pcm.slice(Math.max(0, a - pad), Math.min(pcm.length, b + pad * 2));
}

export function hashKey(s: string): string {
  // FNV-1a 64-bit-ish (two 32-bit lanes); enough to key cached clips
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
