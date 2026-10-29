// ReadToMe reader: open a PDF or paste text, press Prepare, then Play.
// The current sentence is highlighted on the real page and kept in view.

import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import wordsTxt from '../core/data/words.txt';
import { setWordList } from '../core/words.ts';
import { pdfBlocks, toReading } from '../core/pipeline.ts';
import { pasteToBlocks } from '../core/paste.ts';
import { pdfToPages } from '../core/pdf/pdfjs.ts';
import type { Block, PageInput, Reading, Sentence, SkipSettings } from '../core/types.ts';
import { DEFAULT_SKIPS } from '../core/types.ts';
import { LETTERS, WORD } from '../core/pronounce/lexicon.ts';
import { DRUGS, renderRespelling } from '../core/pronounce/drugs.ts';
import { speak, type LettersStyle, type RespellStyle } from '../core/pronounce/speak.ts';
import { hashKey } from './audio-store.ts';
import { KokoroBackend, MockBackend, Narrator, type Mode } from './narrator.ts';

setWordList(wordsTxt);
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;

// ---------- types for the bits of pdf.js we use ----------
interface Viewport { width: number; height: number; scale: number; transform: number[] }
interface PdfPageProxy { getViewport(o: { scale: number }): Viewport; render(o: unknown): { promise: Promise<void> } }
interface PdfDocProxy { numPages: number; getPage(n: number): Promise<PdfPageProxy> }

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// ---------- settings ----------
interface Settings {
  voice: string;
  speed: number;
  lookAheadMin: number;
  catchUpMin: number;
  quality: 'full' | 'small';
  lettersStyle: LettersStyle;
  respellStyle: RespellStyle;
  skips: SkipSettings;
  lexicon: Record<string, string>;
}
const DEFAULTS: Settings = { voice: 'af_heart', speed: 2, lookAheadMin: 5, catchUpMin: 3, quality: 'full', lettersStyle: 'words', respellStyle: 'hyphen', skips: DEFAULT_SKIPS, lexicon: {} };
function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('rtm.settings') ?? '{}');
    return { ...DEFAULTS, ...s, skips: { ...DEFAULTS.skips, ...(s.skips ?? {}) } };
  } catch {
    return { ...DEFAULTS };
  }
}
const settings = loadSettings();
function saveSettings() {
  try {
    localStorage.setItem('rtm.settings', JSON.stringify(settings));
  } catch { /* private window: settings last this visit */ }
}
function savePosition() {
  if (!doc) return;
  try {
    localStorage.setItem(`rtm.pos.${doc.id}`, String(narrator.index));
  } catch { /* ignore */ }
}
function loadPosition(id: string): number {
  try {
    return Number(localStorage.getItem(`rtm.pos.${id}`) ?? 0) || 0;
  } catch {
    return 0;
  }
}

// ---------- narrator ----------
const params = new URLSearchParams(location.search);
const backend = params.has('mock')
  ? new MockBackend(Number(params.get('mock')) || 3)
  : new KokoroBackend(new URL('./tts-worker.js', import.meta.url).href, settings.quality === 'full' ? 'fp32' : 'q8', settings.quality === 'full' ? 'webgpu' : 'wasm');

const narrator = new Narrator(backend, {
  onMode: renderMode,
  onSentence: (i) => {
    showSentence(i);
    savePosition();
  },
  onBuffer: renderBuffer,
  onLoadProgress: (t) => setStatus(t),
  onError: (t) => setStatus(t, true),
});
narrator.speed = settings.speed;
narrator.voice = settings.voice;
narrator.lookAheadMin = settings.lookAheadMin;
narrator.catchUpMin = settings.catchUpMin;

// ---------- document ----------
type Doc =
  | { kind: 'pdf'; id: string; name: string; pages: PageInput[]; pdf: PdfDocProxy; blocks: Block[] }
  | { kind: 'paste'; id: string; name: string; blocks: Block[] };
let doc: Doc | null = null;
let reading: Reading | null = null;
let order: Sentence[] = []; // sentences in reading order (narrator index = position here)

async function openPdf(file: File) {
  setStatus(`Opening ${file.name}…`);
  const data = new Uint8Array(await file.arrayBuffer());
  const id = 'pdf-' + hashKey(file.name + file.size + Array.from(data.subarray(0, 4096)).join(','));
  const pdf: PdfDocProxy = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages = await pdfToPages(pdf as never, (d, t) => setStatus(`Reading page ${d} of ${t}…`));
  doc = { kind: 'pdf', id, name: file.name, pages, pdf, blocks: pdfBlocks(pages) };
  await rebuild(true);
  setStatus('');
}

async function openText(text: string, name: string) {
  doc = { kind: 'paste', id: 'txt-' + hashKey(text), name, blocks: pasteToBlocks(text) };
  await rebuild(true);
  setStatus('');
}

/** Recompute what's read (after open, skip toggles, or pronunciation edits). */
async function rebuild(fresh: boolean) {
  if (!doc) return;
  const keepSid = !fresh && order[narrator.index] ? order[narrator.index] : null;
  reading = toReading(doc.blocks, doc.kind === 'pdf' ? doc.pages.length : 0, settings.skips, settings.lexicon, voiceOpts());
  order = reading.sentences;
  let start = fresh ? loadPosition(doc.id) : 0;
  if (keepSid) {
    const same = order.findIndex((s) => s.blockId === keepSid.blockId && s.start >= keepSid.start);
    start = same >= 0 ? same : 0;
  }
  if (start >= order.length) start = 0;
  $('#doc-name').textContent = doc.name;
  document.body.dataset.mode = doc.kind;
  document.body.classList.add('has-doc');
  narrator.setLines(order.map((s, i) => ({ id: i, spoken: s.spoken })), start);
  if (doc.kind === 'pdf') await renderPages();
  else renderText();
  showSentence(start, false);
  renderStats();
}

// ---------- pdf pages ----------
interface PageView { index: number; wrap: HTMLElement; overlay: HTMLElement; viewport: Viewport; rendered: boolean }
let pageViews: PageView[] = [];
let pageObserver: IntersectionObserver | null = null;

function toViewport(v: Viewport, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = v.transform;
  return [a * x + c * y + e, b * x + d * y + f];
}
function pct(v: Viewport, x: number, y: number, w: number, h: number) {
  return { left: `${(100 * x) / v.width}%`, top: `${(100 * y) / v.height}%`, width: `${(100 * w) / v.width}%`, height: `${(100 * h) / v.height}%` };
}
const itemIndex = new Map<string, PageInput['items'][number]>();
function itemRect(v: PageView, page: number, idx: number, from = 0, to?: number) {
  const it = itemIndex.get(`${page}:${idx}`);
  if (!it) return null;
  const len = it.str.length || 1;
  const x0 = it.x + (it.w * Math.max(0, from)) / len;
  const x1 = it.x + (it.w * Math.min(len, to ?? len)) / len;
  const [l, t] = toViewport(v.viewport, x0, it.y - it.h * 0.22);
  const [r, b] = toViewport(v.viewport, x1, it.y + it.h * 0.92);
  return { left: Math.min(l, r), top: Math.min(t, b), width: Math.abs(r - l), height: Math.abs(b - t) };
}

async function renderPages() {
  if (doc?.kind !== 'pdf') return;
  itemIndex.clear();
  for (const p of doc.pages) for (const it of p.items) itemIndex.set(`${p.index}:${it.idx}`, it);
  const host = $('#pages');
  host.replaceChildren();
  pageObserver?.disconnect();
  pageViews = [];
  for (const p of doc.pages) {
    const page = await doc.pdf.getPage(p.index + 1);
    const viewport = page.getViewport({ scale: 1 });
    const wrap = document.createElement('div');
    wrap.className = 'page';
    wrap.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    wrap.dataset.page = String(p.index);
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    wrap.append(overlay);
    host.append(wrap);
    pageViews.push({ index: p.index, wrap, overlay, viewport, rendered: false });
  }
  pageObserver = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && void drawPage(Number((e.target as HTMLElement).dataset.page))),
    { root: host, rootMargin: '800px 0px' },
  );
  pageViews.forEach((v) => pageObserver!.observe(v.wrap));
  paintSkips();
}

async function drawPage(i: number) {
  const v = pageViews[i];
  if (!v || v.rendered || doc?.kind !== 'pdf') return;
  v.rendered = true;
  const page = await doc.pdf.getPage(i + 1);
  const scale = (v.wrap.clientWidth / v.viewport.width) * Math.min(2, devicePixelRatio || 1);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  v.wrap.prepend(canvas);
  await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp } as never).promise;
}

function paintSkips() {
  if (doc?.kind !== 'pdf' || !reading) return;
  pageViews.forEach((v) => v.overlay.querySelectorAll('.skip').forEach((e) => e.remove()));
  for (const b of reading.blocks) {
    if (reading.readKinds.has(b.kind)) continue;
    const byPage = new Map<number, { left: number; top: number; width: number; height: number }[]>();
    for (const p of b.pieces) {
      if (p.item < 0 || !pageViews[p.page]) continue;
      const r = itemRect(pageViews[p.page], p.page, p.item);
      if (r) byPage.set(p.page, [...(byPage.get(p.page) ?? []), r]);
    }
    for (const [pg, rs] of byPage) {
      const x = Math.min(...rs.map((r) => r.left)) - 2;
      const y = Math.min(...rs.map((r) => r.top)) - 2;
      const w = Math.max(...rs.map((r) => r.left + r.width)) - x + 2;
      const h = Math.max(...rs.map((r) => r.top + r.height)) - y + 2;
      const el = document.createElement('div');
      el.className = 'skip';
      el.title = `Skipped: ${b.reason ?? b.kind}`;
      Object.assign(el.style, pct(pageViews[pg].viewport, x, y, w, h));
      pageViews[pg].overlay.append(el);
    }
  }
}

/** Rects of a sentence on the page, by page. */
function sentenceRects(s: Sentence) {
  const out: { page: number; r: { left: number; top: number; width: number; height: number } }[] = [];
  if (doc?.kind !== 'pdf' || !reading) return out;
  const b = reading.blocks.find((x) => x.id === s.blockId);
  if (!b) return out;
  let off = 0;
  for (const p of b.pieces) {
    const ps = off;
    const pe = off + p.text.length;
    off = pe;
    if (p.item < 0 || pe <= s.start || ps >= s.end || !pageViews[p.page]) continue;
    const r = itemRect(pageViews[p.page], p.page, p.item, p.start + Math.max(0, s.start - ps), p.start + Math.min(p.text.length, s.end - ps));
    if (r) out.push({ page: p.page, r });
  }
  return out;
}

// ---------- pasted text ----------
function renderText() {
  if (!reading) return;
  const byBlock = new Map<number, number[]>();
  order.forEach((s, i) => byBlock.set(s.blockId, [...(byBlock.get(s.blockId) ?? []), i]));
  const html = reading.blocks
    .map((b) => {
      const idxs = byBlock.get(b.id);
      if (!idxs) return `<p class="skipped" title="Skipped: ${esc(b.reason ?? b.kind)}">${esc(b.text.slice(0, 400))}${b.text.length > 400 ? '…' : ''}</p>`;
      const tag = b.kind === 'heading' ? 'h3' : b.kind === 'list' ? 'li' : 'p';
      return `<${tag}>${idxs.map((i) => `<span class="s" data-i="${i}">${esc(order[i].display)}</span>`).join(' ')}</${tag}>`;
    })
    .join('');
  $('#text').innerHTML = html;
}

// ---------- current sentence ----------
let followReading = true;
let programmaticScroll = 0;

function showSentence(i: number, scroll = true) {
  document.querySelectorAll('.hl').forEach((e) => e.remove());
  document.querySelectorAll('#text .s.now').forEach((e) => e.classList.remove('now'));
  if (i < 0 || !order[i]) return;
  const s = order[i];
  $('#progress-label').textContent = `${i + 1} / ${order.length}`;
  ($('#scrub') as HTMLInputElement).max = String(Math.max(0, order.length - 1));
  ($('#scrub') as HTMLInputElement).value = String(i);
  if (doc?.kind === 'pdf') {
    const rects = sentenceRects(s);
    for (const { page, r } of rects) {
      const el = document.createElement('div');
      el.className = 'hl';
      Object.assign(el.style, pct(pageViews[page].viewport, r.left - 1, r.top, r.width + 2, r.height));
      pageViews[page].overlay.append(el);
    }
    if (scroll && followReading && rects[0]) {
      const v = pageViews[rects[0].page];
      const host = $('#pages');
      const y = v.wrap.offsetTop + (rects[0].r.top / v.viewport.height) * v.wrap.clientHeight - host.clientHeight * 0.3;
      programmaticScroll = Date.now();
      host.scrollTo({ top: y, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  } else {
    const el = document.querySelector(`#text .s[data-i="${i}"]`);
    el?.classList.add('now');
    if (scroll && followReading && el) {
      programmaticScroll = Date.now();
      el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  }
  $('#follow').hidden = followReading;
}
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function onUserScroll() {
  if (Date.now() - programmaticScroll < 900) return;
  if (narrator.mode === 'playing' || narrator.mode === 'catching-up' || narrator.mode === 'starting') {
    followReading = false;
    $('#follow').hidden = false;
  }
}

/** Click on the page or text: start reading from that sentence. */
function sentenceAtPoint(e: MouseEvent): number | null {
  if (doc?.kind === 'paste') {
    const el = (e.target as HTMLElement).closest('.s') as HTMLElement | null;
    return el ? Number(el.dataset.i) : null;
  }
  const wrap = (e.target as HTMLElement).closest('.page') as HTMLElement | null;
  if (!wrap || !reading) return null;
  const pg = Number(wrap.dataset.page);
  const v = pageViews[pg];
  const box = wrap.getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * v.viewport.width;
  const y = ((e.clientY - box.top) / box.height) * v.viewport.height;
  let best: { i: number; d: number } | null = null;
  order.forEach((s, i) => {
    const b = reading!.blocks.find((bb) => bb.id === s.blockId);
    if (!b || !b.pieces.some((p) => p.page === pg)) return;
    for (const { page, r } of sentenceRects(s)) {
      if (page !== pg) continue;
      const dx = x < r.left ? r.left - x : x > r.left + r.width ? x - r.left - r.width : 0;
      const dy = y < r.top ? r.top - y : y > r.top + r.height ? y - r.top - r.height : 0;
      const d = dx + dy * 2;
      if (!best || d < best.d) best = { i, d };
    }
  });
  return best && (best as { d: number }).d < 30 ? (best as { i: number }).i : null;
}

// ---------- player UI ----------
const MODE_TEXT: Record<Mode, string> = {
  idle: 'Ready when you are',
  loading: 'Loading the voice…',
  preparing: 'Preparing audio ahead…',
  starting: 'Getting the first sentences ready…',
  playing: 'Reading',
  'catching-up': 'Hey, let us catch up real quick. Take a break.',
  paused: 'Paused',
};

function renderMode(m: Mode) {
  document.body.dataset.player = m;
  const going = m === 'playing' || m === 'catching-up' || m === 'starting';
  $('#play').textContent = going ? 'Pause' : 'Play';
  $('#play').setAttribute('aria-label', going ? 'Pause' : 'Play');
  $('#mode').textContent = MODE_TEXT[m];
  $('#catchup').hidden = m !== 'catching-up';
  ($('#prepare') as HTMLButtonElement).disabled = !doc || going || m === 'preparing' || m === 'loading';
}

function fmtMin(sec: number) {
  if (sec < 60) return `${Math.round(sec)} s`;
  return `${(sec / 60).toFixed(sec < 600 ? 1 : 0)} min`;
}

function renderBuffer(b: { aheadSec: number; goalSec: number; rtf: number | null; generating: boolean }) {
  const pctFull = Math.min(100, (100 * b.aheadSec) / Math.max(1, b.goalSec));
  ($('#buffer-fill') as HTMLElement).style.width = `${pctFull}%`;
  $('#buffer-label').textContent = `${fmtMin(b.aheadSec)} ready${b.generating ? ' · making more' : ''}`;
  if (narrator.mode === 'catching-up') {
    const goal = Math.min(settings.catchUpMin * 60, b.goalSec);
    $('#catchup-detail').textContent = `Resuming at ${fmtMin(goal)} ready (${fmtMin(b.aheadSec)} so far).`;
  }
  const hint = $('#hint');
  if (b.rtf == null) {
    hint.textContent = '';
    return;
  }
  const s = settings.speed;
  if (b.rtf >= s * 0.97) {
    hint.textContent = `This computer makes audio at ${b.rtf.toFixed(1)}× and you're listening at ${s}×: no pauses.`;
  } else {
    const drain = 1 - b.rtf / s; // buffer lost per minute of listening
    const every = settings.lookAheadMin / drain;
    const for30 = Math.max(settings.lookAheadMin + 1, Math.ceil(30 * drain));
    hint.textContent = `This computer makes audio at ${b.rtf.toFixed(1)}×. At ${s}× expect a catch-up about every ${Math.round(every)} min of listening. For 30 min without a break, set look-ahead to ${for30} min.`;
  }
}

function renderStats() {
  if (!reading) return;
  const words = reading.stats.words;
  $('#stats').textContent = `${order.length} sentences · ${words.toLocaleString()} words · about ${Math.max(1, Math.round(words / (165 * settings.speed)))} min at ${settings.speed}×`;
}

let statusT = 0;
function setStatus(t: string, isError = false) {
  const el = $('#status');
  el.textContent = t;
  el.hidden = !t;
  el.classList.toggle('error', isError);
  clearTimeout(statusT);
  if (t && !isError && /ready/i.test(t)) statusT = window.setTimeout(() => (el.hidden = true), 4000);
}

function setSpeed(s: number) {
  s = Math.round(Math.max(1, Math.min(5, s)) * 4) / 4;
  settings.speed = s;
  saveSettings();
  narrator.setSpeed(s);
  ($('#speed') as HTMLInputElement).value = String(s);
  $('#speed-val').textContent = `${s}×`;
  renderStats();
}

// ---------- settings panel ----------
const SKIP_LABELS: [keyof SkipSettings, string][] = [
  ['headers', 'Headers & page numbers'], ['citations', 'Citations [12], (Fig. 2)'], ['captions', 'Figure captions'],
  ['figures', 'Figure text & footnotes'], ['tables', 'Tables'], ['references', 'References'],
  ['frontmatter', 'Authors & journal info'], ['lists', 'Bullet lists'], ['headings', 'Headings'],
];

function renderSettings() {
  ($('#voice') as HTMLSelectElement).value = settings.voice;
  ($('#lookahead') as HTMLInputElement).value = String(settings.lookAheadMin);
  $('#lookahead-val').textContent = `${settings.lookAheadMin} min`;
  ($('#catchup-min') as HTMLInputElement).value = String(settings.catchUpMin);
  $('#catchup-val').textContent = `${settings.catchUpMin} min`;
  ($('#quality') as HTMLSelectElement).value = settings.quality;
  $('#skips').innerHTML = SKIP_LABELS.map(([k, l]) => `<label class="tog"><input type="checkbox" id="skip-${k}" ${settings.skips[k] ? 'checked' : ''}><span>${l}</span></label>`).join('');
  const rows = Object.entries(settings.lexicon);
  $('#lex-list').innerHTML = rows.length
    ? rows.map(([k, v]) => `<li><code>${esc(k)}</code> → <span>${esc(v === LETTERS ? 'spell letters' : v === WORD ? 'say as a word' : v)}</span><button type="button" class="x" data-k="${esc(k)}" aria-label="Remove ${esc(k)}">×</button></li>`).join('')
    : '<li class="muted">No custom words yet.</li>';
}

// ---------- wiring ----------
function wire() {
  const file = $('#file') as HTMLInputElement;
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (f) void openPdf(f).catch((e) => setStatus(`Couldn't open that PDF: ${e?.message ?? e}`, true));
    file.value = '';
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    if (f.name.toLowerCase().endsWith('.pdf')) void openPdf(f);
    else void f.text().then((t) => openText(t, f.name));
  });
  const dlg = $('#paste-dlg') as HTMLDialogElement;
  $('#paste-open').addEventListener('click', () => dlg.showModal());
  $('#paste-cancel').addEventListener('click', () => dlg.close());
  $('#paste-go').addEventListener('click', () => {
    const t = ($('#paste') as HTMLTextAreaElement).value.trim();
    dlg.close();
    if (t) void openText(t, 'Pasted text');
  });

  $('#play').addEventListener('click', () => {
    followReading = true;
    narrator.toggle();
  });
  $('#prepare').addEventListener('click', () => void narrator.prepare());
  $('#back').addEventListener('click', () => narrator.seek(narrator.index - 1));
  $('#fwd').addEventListener('click', () => narrator.seek(narrator.index + 1));
  $('#speed').addEventListener('input', (e) => setSpeed(Number((e.target as HTMLInputElement).value)));
  $('#scrub').addEventListener('change', (e) => {
    followReading = true;
    narrator.seek(Number((e.target as HTMLInputElement).value));
  });
  $('#follow').addEventListener('click', () => {
    followReading = true;
    showSentence(narrator.index);
  });
  for (const id of ['#pages', '#text']) {
    $(id).addEventListener('scroll', onUserScroll, { passive: true });
    $(id).addEventListener('click', (e) => {
      if (window.getSelection()?.toString()) return;
      const i = sentenceAtPoint(e);
      if (i == null) return;
      followReading = true;
      narrator.seek(i, true);
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea, select, dialog')) return;
    if (e.key === ' ') {
      e.preventDefault();
      followReading = true;
      narrator.toggle();
    } else if (e.key === 'ArrowLeft') narrator.seek(narrator.index - 1);
    else if (e.key === 'ArrowRight') narrator.seek(narrator.index + 1);
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSpeed(settings.speed + 0.25);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSpeed(settings.speed - 0.25);
    } else if (e.key.toLowerCase() === 'p') void narrator.prepare();
  });

  // settings
  const panel = $('#settings') as HTMLDialogElement;
  $('#settings-open').addEventListener('click', () => {
    renderSettings();
    panel.showModal();
  });
  $('#settings-close').addEventListener('click', () => panel.close());
  $('#voice').addEventListener('change', (e) => {
    settings.voice = (e.target as HTMLSelectElement).value;
    saveSettings();
    narrator.setVoice(settings.voice);
  });
  $('#lookahead').addEventListener('input', (e) => {
    settings.lookAheadMin = Number((e.target as HTMLInputElement).value);
    $('#lookahead-val').textContent = `${settings.lookAheadMin} min`;
    saveSettings();
    narrator.setLookAhead(settings.lookAheadMin);
  });
  $('#catchup-min').addEventListener('input', (e) => {
    settings.catchUpMin = Number((e.target as HTMLInputElement).value);
    $('#catchup-val').textContent = `${settings.catchUpMin} min`;
    narrator.catchUpMin = settings.catchUpMin;
    saveSettings();
  });
  $('#quality').addEventListener('change', (e) => {
    settings.quality = (e.target as HTMLSelectElement).value as Settings['quality'];
    saveSettings();
    $('#quality-note').hidden = false;
  });
  $('#skips').addEventListener('change', (e) => {
    const k = (e.target as HTMLInputElement).id.replace('skip-', '') as keyof SkipSettings;
    settings.skips = { ...settings.skips, [k]: (e.target as HTMLInputElement).checked };
    saveSettings();
    void rebuild(false);
  });
  $('#lex-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const from = ($('#lex-from') as HTMLInputElement).value.trim();
    const mode = ($('#lex-mode') as HTMLSelectElement).value;
    const to = ($('#lex-to') as HTMLInputElement).value.trim();
    if (!from) return;
    settings.lexicon = { ...settings.lexicon, [from]: mode === 'letters' ? LETTERS : mode === 'word' ? WORD : to || from };
    saveSettings();
    ($('#lex-from') as HTMLInputElement).value = '';
    ($('#lex-to') as HTMLInputElement).value = '';
    renderSettings();
    void rebuild(false);
  });
  $('#lex-mode').addEventListener('change', (e) => (($('#lex-to') as HTMLInputElement).disabled = (e.target as HTMLSelectElement).value !== 'say'));
  $('#lex-list').addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('.x')?.dataset.k;
    if (!k) return;
    const { [k]: _gone, ...rest } = settings.lexicon;
    settings.lexicon = rest;
    saveSettings();
    renderSettings();
    void rebuild(false);
  });
  // selecting a word on a pasted-text view pre-fills the pronunciation form
  document.addEventListener('mouseup', () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length < 40 && !/\s{2,}/.test(sel)) ($('#lex-from') as HTMLInputElement).value = sel;
  });
  window.addEventListener('beforeunload', savePosition);
  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(() => {
      if (doc?.kind !== 'pdf') return;
      pageViews.forEach((v) => {
        v.wrap.querySelector('canvas')?.remove();
        v.rendered = false;
      });
      pageObserver?.disconnect();
      pageViews.forEach((v) => pageObserver!.observe(v.wrap));
    }, 300);
  });
}


// ---------- pronunciation lab ----------
const voiceOpts = () => ({ lettersStyle: settings.lettersStyle, respellStyle: settings.respellStyle });
const LETTER_SAMPLE = 'SSRIs, ECT and rTMS are options in TRD.';
const LETTER_STYLES: [LettersStyle, string][] = [
  ['words', 'Letter names (default)'],
  ['words-hyphen', 'Letter names, joined'],
  ['spaced', 'Spaced capitals'],
  ['dotted', 'Dotted capitals'],
];
const RESPELL_SAMPLE = 'Switch from quetiapine to aripiprazole, then add lamotrigine.';
const RESPELL_STYLES: [RespellStyle, string][] = [
  ['hyphen', 'Joined syllables (default)'],
  ['spaced', 'Separate syllables'],
];

function sayWith(text: string, extra: Partial<Parameters<typeof speak>[1]> = {}) {
  return speak(text, { stripCitations: true, userLexicon: settings.lexicon, ...voiceOpts(), ...extra });
}

async function playText(btn: HTMLElement, text: string) {
  btn.classList.add('busy');
  try {
    await narrator.sample(text);
  } catch (e) {
    setStatus(`Couldn't play that: ${(e as Error)?.message ?? e}`, true);
  } finally {
    btn.classList.remove('busy');
  }
}

function renderLab() {
  $('#lab-letters').innerHTML = LETTER_STYLES.map(([k, label]) => {
    const text = sayWith(LETTER_SAMPLE, { lettersStyle: k });
    return `<label class="choice ${settings.lettersStyle === k ? 'on' : ''}"><input type="radio" name="letters" value="${k}" ${settings.lettersStyle === k ? 'checked' : ''}><button type="button" class="play" data-say="${esc(text)}" aria-label="Play ${esc(label)}">▶</button><span><b>${esc(label)}</b><br><code>${esc(text)}</code></span></label>`;
  }).join('');
  $('#lab-respell').innerHTML = RESPELL_STYLES.map(([k, label]) => {
    const text = sayWith(RESPELL_SAMPLE, { respellStyle: k });
    return `<label class="choice ${settings.respellStyle === k ? 'on' : ''}"><input type="radio" name="respell" value="${k}" ${settings.respellStyle === k ? 'checked' : ''}><button type="button" class="play" data-say="${esc(text)}" aria-label="Play ${esc(label)}">▶</button><span><b>${esc(label)}</b><br><code>${esc(text)}</code></span></label>`;
  }).join('');
  renderDrugList();
  renderTry();
  renderFixes();
}

function renderDrugList() {
  const q = ($('#drug-search') as HTMLInputElement).value.trim().toLowerCase();
  const names = Object.keys(DRUGS).filter((n) => !q || n.includes(q)).sort().slice(0, 60);
  $('#drug-list').innerHTML = names.length
    ? names
        .map((n) => {
          const mine = settings.lexicon[n];
          const said = mine ?? renderRespelling(DRUGS[n], settings.respellStyle);
          return `<li><button type="button" class="play" data-say="${esc(said)}" aria-label="Play ${esc(n)}">▶</button><span>${esc(n)}</span><code>${esc(mine ? `${mine} (your fix)` : DRUGS[n])}</code><button type="button" class="linkish" data-fix="${esc(n)}">Fix</button></li>`;
        })
        .join('')
    : '<li class="muted">Not in the list yet. Type it under “Try any word” to add your own.</li>';
}

function renderTry() {
  const w = ($('#try-word') as HTMLInputElement).value.trim();
  if (!w) {
    $('#try-rows').innerHTML = '<p class="muted small">Type a word above to compare how it sounds.</p>';
    return;
  }
  const guess = speak(w, { stripCitations: true, useDrugList: false, ...voiceOpts() });
  const current = sayWith(w);
  const key = w.toLowerCase();
  const mine = settings.lexicon[w] ?? settings.lexicon[key];
  $('#try-rows').innerHTML = `
    <div class="tryrow"><button type="button" class="play" data-say="${esc(guess)}" aria-label="Play the voice's own guess">▶</button><b>Voice’s own guess</b><code>${esc(guess)}</code><span></span></div>
    <div class="tryrow"><button type="button" class="play" data-say="${esc(current)}" aria-label="Play what it says now">▶</button><b>What it says now</b><code>${esc(current)}${mine ? ' (your fix)' : DRUGS[key] ? ' (drug list)' : ''}</code><span></span></div>
    <div class="tryrow"><button type="button" class="play" id="try-custom-play" aria-label="Play your version">▶</button><b>Your version</b><input id="try-custom" value="${esc(mine ?? current)}" aria-label="How it should sound"><button type="button" class="btn" id="try-save">Save</button></div>
    <p class="muted small">Sound it out with hyphens, like “loo-RAS-ih-dohn” (capitals are fine, they're just for you). Spaces work too.</p>`;
}

function renderFixes() {
  const rows = Object.entries(settings.lexicon);
  $('#fix-list').innerHTML = rows.length
    ? rows
        .map(([k, v]) => {
          const said = v === LETTERS ? 'spell letters' : v === WORD ? 'say as a word' : v;
          return `<li><button type="button" class="play" data-say="${esc(sayWith(k))}" aria-label="Play ${esc(k)}">▶</button><span>${esc(k)}</span><code>${esc(said)}</code><button type="button" class="linkish" data-remove="${esc(k)}">Remove</button></li>`;
        })
        .join('')
    : '<li class="muted">None yet.</li>';
}

function wireLab() {
  const dlg = $('#lab') as HTMLDialogElement;
  $('#lab-open').addEventListener('click', () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length < 40) ($('#try-word') as HTMLInputElement).value = sel;
    renderLab();
    dlg.showModal();
  });
  $('#lab-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const play = t.closest<HTMLElement>('.play');
    if (play?.dataset.say) {
      e.preventDefault();
      void playText(play, play.dataset.say);
      return;
    }
    if (play?.id === 'try-custom-play') {
      e.preventDefault();
      const raw = ($('#try-custom') as HTMLInputElement).value.trim();
      if (raw) void playText(play, raw.toLowerCase());
      return;
    }
    const fix = t.closest<HTMLElement>('[data-fix]')?.dataset.fix;
    if (fix) {
      ($('#try-word') as HTMLInputElement).value = fix;
      renderTry();
      $('#try-word').scrollIntoView({ block: 'center' });
      return;
    }
    const rm = t.closest<HTMLElement>('[data-remove]')?.dataset.remove;
    if (rm) {
      const { [rm]: _gone, ...rest } = settings.lexicon;
      settings.lexicon = rest;
      saveSettings();
      renderLab();
      void rebuild(false);
      return;
    }
    if (t.id === 'try-save') {
      const w = ($('#try-word') as HTMLInputElement).value.trim();
      const v = ($('#try-custom') as HTMLInputElement).value.trim().toLowerCase();
      if (!w || !v) return;
      const key = /^[A-Z0-9]+s?$/.test(w) ? w : w.toLowerCase(); // keep case for abbreviations
      settings.lexicon = { ...settings.lexicon, [key]: v };
      saveSettings();
      renderLab();
      void rebuild(false);
      setStatus(`Saved: ${w} → ${v}. Ready.`);
    }
  });
  dlg.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'letters') settings.lettersStyle = t.value as LettersStyle;
    else if (t.name === 'respell') settings.respellStyle = t.value as RespellStyle;
    else return;
    saveSettings();
    renderLab();
    void rebuild(false);
  });
  $('#drug-search').addEventListener('input', renderDrugList);
  $('#try-word').addEventListener('input', renderTry);
  $('#fix-copy').addEventListener('click', async () => {
    const text = Object.entries(settings.lexicon).map(([k, v]) => `${k} = ${v}`).join('\n') || '(no fixes yet)';
    try {
      await navigator.clipboard.writeText(text);
      $('#fix-copy').textContent = 'Copied';
    } catch {
      $('#fix-copy').textContent = 'Copy failed';
    }
    setTimeout(() => ($('#fix-copy').textContent = 'Copy my fixes'), 1600);
  });
}

wire();
wireLab();
setSpeed(settings.speed);
renderMode('idle');
renderSettings();
