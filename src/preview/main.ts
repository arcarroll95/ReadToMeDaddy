// Preview page: drop a PDF or paste text, see exactly what the reader would
// read, what it skips (and why), and how each sentence will be pronounced.
// No audio here on purpose: this is the silent check of the text pipeline.

import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import * as pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs';
import wordsTxt from '../core/data/words.txt';
import { setWordList } from '../core/words.ts';
import { pdfBlocks, toReading } from '../core/pipeline.ts';
import { pasteToBlocks } from '../core/paste.ts';
import { pdfToPages } from '../core/pdf/pdfjs.ts';
import type { Block, BlockKind, PageInput, Reading, Sentence, SkipSettings } from '../core/types.ts';
import { DEFAULT_SKIPS } from '../core/types.ts';
import { LETTERS, WORD } from '../core/pronounce/lexicon.ts';

// run pdf.js's worker code on the main thread (no separate worker file to host)
(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfWorker;
setWordList(wordsTxt);

interface Viewport {
  width: number;
  height: number;
  scale: number;
  transform: number[];
}

/** PDF user space -> viewport pixels, via the viewport's affine transform. */
function toViewport(v: Viewport, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = v.transform;
  return [a * x + c * y + e, b * x + d * y + f];
}
interface PdfPageProxy {
  getViewport(o: { scale: number }): Viewport;
  render(o: unknown): { promise: Promise<void> };
}
interface PdfDocProxy {
  numPages: number;
  getPage(n: number): Promise<PdfPageProxy>;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

type Source =
  | { kind: 'pdf'; name: string; pages: PageInput[]; doc: PdfDocProxy; blocks: Block[] }
  | { kind: 'paste'; name: string; text: string; blocks: Block[] };

let source: Source | null = null;
let reading: Reading | null = null;
let skips: SkipSettings = loadJSON('rtm.skips', DEFAULT_SKIPS);
let userLex: Record<string, string> = loadJSON('rtm.lexicon', {});
let onlyChanged = false;
let activeSentence: number | null = null;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: settings last for this visit only */
  }
}

const KIND_LABEL: Record<BlockKind, string> = {
  body: 'Text', heading: 'Heading', list: 'List', caption: 'Caption', figure: 'Figure text', table: 'Table',
  header: 'Running header', pagenum: 'Page number', junk: 'Printer marks', frontmatter: 'Front matter', references: 'References',
};
const KIND_GROUP: Record<BlockKind, 'read' | 'margin' | 'figure' | 'matter'> = {
  body: 'read', heading: 'read', list: 'read', caption: 'figure', figure: 'figure', table: 'figure',
  header: 'margin', pagenum: 'margin', junk: 'margin', frontmatter: 'matter', references: 'matter',
};

const SKIP_TOGGLES: { key: keyof SkipSettings; label: string }[] = [
  { key: 'headers', label: 'Headers & page numbers' },
  { key: 'citations', label: 'Citations [12], (Fig. 2)' },
  { key: 'captions', label: 'Figure captions' },
  { key: 'figures', label: 'Figure text & footnotes' },
  { key: 'tables', label: 'Tables' },
  { key: 'references', label: 'References' },
  { key: 'frontmatter', label: 'Authors & journal info' },
  { key: 'lists', label: 'Bullet lists' },
  { key: 'headings', label: 'Headings' },
];

// ---------- loading ----------

async function openPdf(file: File) {
  setStatus(`Reading ${file.name}…`);
  const data = new Uint8Array(await file.arrayBuffer());
  const doc: PdfDocProxy = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const pages = await pdfToPages(doc as never, (d, t) => setStatus(`Reading page ${d} of ${t}…`));
  const blocks = pdfBlocks(pages);
  source = { kind: 'pdf', name: file.name, pages, doc, blocks };
  activeSentence = null;
  recompute();
  await renderPages();
  setStatus('');
}

function openText(text: string, name = 'Pasted text') {
  source = { kind: 'paste', name, text, blocks: pasteToBlocks(text) };
  activeSentence = null;
  recompute();
  $('#pages').replaceChildren();
  setStatus('');
}

function recompute() {
  if (!source) return;
  const pageCount = source.kind === 'pdf' ? source.pages.length : 0;
  reading = toReading(source.blocks, pageCount, skips, userLex);
  renderSummary();
  renderScript();
  paintOverlays();
  document.body.dataset.mode = source.kind;
}

function setStatus(s: string) {
  $('#status').textContent = s;
  $('#status').hidden = !s;
}

// ---------- summary ----------

function minutes(words: number, rate: number) {
  const m = words / (165 * rate);
  return m < 1 ? '<1 min' : `${Math.round(m)} min`;
}

function renderSummary() {
  if (!reading || !source) return;
  const { stats } = reading;
  $('#doc-name').textContent = source.name;
  const skippedChars = reading.blocks.filter((b) => !reading!.readKinds.has(b.kind)).reduce((n, b) => n + b.text.length, 0);
  const totalChars = reading.blocks.reduce((n, b) => n + b.text.length, 0) || 1;
  $('#stats').innerHTML = `
    <div><dt>Sentences</dt><dd>${stats.sentences.toLocaleString()}</dd></div>
    <div><dt>Words read</dt><dd>${stats.words.toLocaleString()}</dd></div>
    <div><dt>Skipped</dt><dd>${Math.round((100 * skippedChars) / totalChars)}%</dd></div>
    <div><dt>At 2×</dt><dd>${minutes(stats.words, 2)}</dd></div>
    <div><dt>At 3×</dt><dd>${minutes(stats.words, 3)}</dd></div>`;
  const counts = new Map<BlockKind, number>();
  for (const b of reading.blocks) if (!reading.readKinds.has(b.kind)) counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
  $('#skipped').innerHTML = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `<li><span class="sw sw-${KIND_GROUP[k]}"></span>${KIND_LABEL[k]}<span class="n">${n}</span></li>`)
    .join('');
}

// ---------- script ----------

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Highlight words in `spoken` that differ from `display` (cheap token diff). */
function diffSpoken(display: string, spoken: string): string {
  const seen = new Set(display.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean));
  return spoken
    .split(/(\s+)/)
    .map((tok) => {
      const bare = tok.toLowerCase().replace(/[^a-z0-9']/gi, '');
      return bare && !seen.has(bare) ? `<mark>${esc(tok)}</mark>` : esc(tok);
    })
    .join('');
}

/** Ignore rewrites that don't change what you hear: spelled acronyms (E C T), hyphens, punctuation, case. */
function meaningfulChange(display: string, spoken: string): boolean {
  const norm = (t: string) =>
    t
      .replace(/\b(?:[A-Z] ){1,}[A-Z]\b('s)?/g, (m) => m.replace(/ /g, ''))
      .replace(/\[[\d,\s\u2013-]+\]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return norm(display) !== norm(spoken);
}

function renderScript() {
  if (!reading) return;
  const list = $('#script');
  const bySid = new Map<number, Sentence[]>();
  for (const s of reading.sentences) bySid.set(s.blockId, [...(bySid.get(s.blockId) ?? []), s]);
  const frag = document.createDocumentFragment();
  let lastPage = -2;
  let skipRun: Block[] = [];
  const flushSkips = () => {
    if (!skipRun.length || onlyChanged) {
      skipRun = [];
      return;
    }
    const d = document.createElement('details');
    d.className = 'skiprun';
    const kinds = [...new Set(skipRun.map((b) => KIND_LABEL[b.kind]))];
    d.innerHTML = `<summary><span class="sw sw-${KIND_GROUP[skipRun[0].kind]}"></span>Skipped: ${esc(kinds.join(', '))} <span class="n">${skipRun.length}</span></summary>${skipRun
      .map((b) => `<p><span class="why">${esc(b.reason ?? KIND_LABEL[b.kind])}</span>${esc(b.text.slice(0, 280))}${b.text.length > 280 ? '…' : ''}</p>`)
      .join('')}`;
    frag.append(d);
    skipRun = [];
  };
  for (const b of reading.blocks) {
    if (source?.kind === 'pdf' && b.page !== lastPage && !onlyChanged) {
      flushSkips();
      const h = document.createElement('div');
      h.className = 'pagemark';
      h.textContent = `Page ${b.page + 1}`;
      frag.append(h);
      lastPage = b.page;
    }
    const sents = bySid.get(b.id);
    if (!sents) {
      skipRun.push(b);
      continue;
    }
    flushSkips();
    for (const s of sents) {
      const changed = meaningfulChange(s.display, s.spoken);
      if (onlyChanged && !changed) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `sent${s.isHeading ? ' head' : ''}${changed ? ' changed' : ''}`;
      el.dataset.sid = String(s.id);
      el.innerHTML = `<span class="disp">${esc(s.display)}</span>${changed ? `<span class="says"><span class="lbl">Says</span>${diffSpoken(s.display, s.spoken)}</span>` : ''}`;
      frag.append(el);
    }
  }
  flushSkips();
  list.replaceChildren(frag);
  if (!list.children.length) list.innerHTML = '<p class="empty">Nothing to show with these settings.</p>';
  if (activeSentence != null) markActive(activeSentence, false);
}

// ---------- pages ----------

interface PageView {
  index: number;
  wrap: HTMLElement;
  overlay: HTMLElement;
  viewport: Viewport;
  rendered: boolean;
}
let pageViews: PageView[] = [];
let pageObserver: IntersectionObserver | null = null;

async function renderPages() {
  if (source?.kind !== 'pdf') return;
  const host = $('#pages');
  host.replaceChildren();
  pageObserver?.disconnect();
  pageViews = [];
  const width = Math.min(host.clientWidth - 2, 760);
  for (const p of source.pages) {
    const page = await source.doc.getPage(p.index + 1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });
    const wrap = document.createElement('div');
    wrap.className = 'page';
    wrap.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
    wrap.dataset.page = String(p.index);
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const num = document.createElement('span');
    num.className = 'pnum';
    num.textContent = String(p.index + 1);
    wrap.append(overlay, num);
    host.append(wrap);
    pageViews.push({ index: p.index, wrap, overlay, viewport, rendered: false });
  }
  pageObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) void drawPage(Number((e.target as HTMLElement).dataset.page));
    },
    { root: host, rootMargin: '600px 0px' },
  );
  for (const v of pageViews) pageObserver.observe(v.wrap);
  paintOverlays();
}

async function drawPage(index: number) {
  const v = pageViews[index];
  if (!v || v.rendered || source?.kind !== 'pdf') return;
  v.rendered = true;
  const page = await source.doc.getPage(index + 1);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const vp = page.getViewport({ scale: v.viewport.scale * dpr });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  v.wrap.prepend(canvas);
  await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp } as never).promise;
}

function itemRect(v: PageView, page: PageInput, idx: number, from = 0, to?: number): DOMRect | null {
  const it = page.items.find((i) => i.idx === idx);
  if (!it) return null;
  const len = it.str.length || 1;
  const a = Math.max(0, from) / len;
  const b = Math.min(len, to ?? len) / len;
  const x0 = it.x + it.w * a;
  const x1 = it.x + it.w * b;
  const [l, t] = toViewport(v.viewport, x0, it.y - it.h * 0.22);
  const [r, bt] = toViewport(v.viewport, x1, it.y + it.h * 0.92);
  return new DOMRect(Math.min(l, r), Math.min(t, bt), Math.abs(r - l), Math.abs(bt - t));
}

function pct(v: Viewport, x: number, y: number, w: number, h: number) {
  const W = v.width;
  const H = v.height;
  return { left: `${(100 * x) / W}%`, top: `${(100 * y) / H}%`, width: `${(100 * w) / W}%`, height: `${(100 * h) / H}%` };
}

function paintOverlays() {
  if (source?.kind !== 'pdf' || !reading || !pageViews.length) return;
  for (const v of pageViews) v.overlay.replaceChildren();
  const pages = source.pages;
  for (const b of reading.blocks) {
    if (reading.readKinds.has(b.kind)) continue;
    // one box per item line, grouped by page
    const byPage = new Map<number, DOMRect[]>();
    for (const p of b.pieces) {
      if (p.item < 0) continue;
      const v = pageViews[p.page];
      const r = v && itemRect(v, pages[p.page], p.item);
      if (r) byPage.set(p.page, [...(byPage.get(p.page) ?? []), r]);
    }
    for (const [pg, rects] of byPage) {
      const x = Math.min(...rects.map((r) => r.left)) - 2;
      const y = Math.min(...rects.map((r) => r.top)) - 2;
      const w = Math.max(...rects.map((r) => r.right)) - x + 2;
      const h = Math.max(...rects.map((r) => r.bottom)) - y + 2;
      const box = document.createElement('div');
      box.className = `skipbox sw-${KIND_GROUP[b.kind]}`;
      Object.assign(box.style, pct(pageViews[pg].viewport, x, y, w, h));
      box.title = `Skipped: ${b.reason ?? KIND_LABEL[b.kind]}`;
      pageViews[pg].overlay.append(box);
    }
  }
}

function highlightSentence(s: Sentence) {
  if (source?.kind !== 'pdf' || !reading) return;
  for (const el of document.querySelectorAll('.hl')) el.remove();
  const block = reading.blocks.find((b) => b.id === s.blockId);
  if (!block) return;
  let off = 0;
  let first: { page: number; top: number } | null = null;
  for (const p of block.pieces) {
    const pStart = off;
    const pEnd = off + p.text.length;
    off = pEnd;
    if (p.item < 0 || pEnd <= s.start || pStart >= s.end) continue;
    const v = pageViews[p.page];
    if (!v) continue;
    const from = p.start + Math.max(0, s.start - pStart);
    const to = p.start + Math.min(p.text.length, s.end - pStart);
    const r = itemRect(v, source.pages[p.page], p.item, from, to);
    if (!r) continue;
    const hl = document.createElement('div');
    hl.className = 'hl';
    Object.assign(hl.style, pct(v.viewport, r.left - 1, r.top, r.width + 2, r.height));
    v.overlay.append(hl);
    if (!first) first = { page: p.page, top: r.top };
  }
  if (first) {
    const v = pageViews[first.page];
    const host = $('#pages');
    host.scrollTo({ top: v.wrap.offsetTop + (first.top / v.viewport.height) * v.wrap.clientHeight - host.clientHeight * 0.3, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

function markActive(sid: number, scroll = true) {
  activeSentence = sid;
  for (const el of document.querySelectorAll('.sent.active')) el.classList.remove('active');
  const el = document.querySelector(`.sent[data-sid="${sid}"]`);
  el?.classList.add('active');
  if (scroll) el?.scrollIntoView({ block: 'nearest' });
  const s = reading?.sentences[sid];
  if (s) highlightSentence(s);
}

// ---------- dictionary ----------

function renderLexicon() {
  const rows = Object.entries(userLex);
  $('#lex-list').innerHTML = rows.length
    ? rows
        .map(([k, v]) => `<li><code>${esc(k)}</code><span>→</span><span class="say">${esc(v === LETTERS ? 'spell letters' : v === WORD ? 'say as word' : v)}</span><button type="button" class="x" data-k="${esc(k)}" aria-label="Remove ${esc(k)}">×</button></li>`)
        .join('')
    : '<li class="empty">No custom words yet.</li>';
}

// ---------- wiring ----------

function buildToggles() {
  const host = $('#toggles');
  host.innerHTML = SKIP_TOGGLES.map(
    (t) => `<label class="tog"><input type="checkbox" id="skip-${t.key}" ${skips[t.key] ? 'checked' : ''}><span>${t.label}</span></label>`,
  ).join('');
  host.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const key = input.id.replace('skip-', '') as keyof SkipSettings;
    skips = { ...skips, [key]: input.checked };
    saveJSON('rtm.skips', skips);
    recompute();
  });
}

function wire() {
  buildToggles();
  renderLexicon();
  const fileInput = $('#file') as HTMLInputElement;
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) void openPdf(f).catch(showError);
    fileInput.value = '';
  });
  const drop = document.body;
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging');
  });
  drop.addEventListener('dragleave', (e) => {
    if (e.target === document.body || !(e.relatedTarget as Node | null)) document.body.classList.remove('dragging');
  });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    const f = e.dataTransfer?.files?.[0];
    if (f && (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) void openPdf(f).catch(showError);
    else if (f) void f.text().then((t) => openText(t, f.name));
  });
  $('#paste-go').addEventListener('click', () => {
    const t = ($('#paste') as HTMLTextAreaElement).value.trim();
    if (t) openText(t);
    ($('#paste-dlg') as HTMLDialogElement).close();
  });
  $('#paste-open').addEventListener('click', () => ($('#paste-dlg') as HTMLDialogElement).showModal());
  $('#paste-cancel').addEventListener('click', () => ($('#paste-dlg') as HTMLDialogElement).close());
  $('#only-changed').addEventListener('change', (e) => {
    onlyChanged = (e.target as HTMLInputElement).checked;
    renderScript();
  });
  $('#script').addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('.sent') as HTMLElement | null;
    if (el) markActive(Number(el.dataset.sid), false);
  });
  $('#script').addEventListener('mouseup', () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length < 40 && !/\s{2,}/.test(sel)) ($('#lex-from') as HTMLInputElement).value = sel;
  });
  document.addEventListener('keydown', (e) => {
    if (!reading || (e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'j' || e.key === 'k') {
      const ids = [...document.querySelectorAll<HTMLElement>('.sent')].map((el) => Number(el.dataset.sid));
      if (!ids.length) return;
      e.preventDefault();
      const i = activeSentence == null ? -1 : ids.indexOf(activeSentence);
      const next = e.key === 'ArrowDown' || e.key === 'j' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1);
      markActive(ids[next]);
    }
  });
  $('#lex-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const from = ($('#lex-from') as HTMLInputElement).value.trim();
    const mode = ($('#lex-mode') as HTMLSelectElement).value;
    const to = ($('#lex-to') as HTMLInputElement).value.trim();
    if (!from) return;
    userLex = { ...userLex, [from]: mode === 'letters' ? LETTERS : mode === 'word' ? WORD : to || from };
    saveJSON('rtm.lexicon', userLex);
    ($('#lex-from') as HTMLInputElement).value = '';
    ($('#lex-to') as HTMLInputElement).value = '';
    renderLexicon();
    recompute();
  });
  $('#lex-mode').addEventListener('change', (e) => {
    ($('#lex-to') as HTMLInputElement).disabled = (e.target as HTMLSelectElement).value !== 'say';
  });
  $('#lex-list').addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('.x')?.dataset.k;
    if (!k) return;
    const { [k]: _, ...rest } = userLex;
    userLex = rest;
    saveJSON('rtm.lexicon', userLex);
    renderLexicon();
    recompute();
  });
  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(() => void renderPages().then(() => activeSentence != null && markActive(activeSentence, false)), 250);
  });
}

function showError(err: unknown) {
  setStatus(`Couldn't open that file: ${(err as Error)?.message ?? err}. If it's a scanned PDF (pictures of pages), it has no text to read yet — scanned support comes in v2.`);
}

wire();
const sample = ($('#sample') as HTMLTemplateElement).content.textContent?.trim();
if (sample) openText(sample, 'Sample: a pasted OpenEvidence answer. Open a PDF or paste your own text.');
