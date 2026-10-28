// PDF layout analysis: positioned text items -> lines -> segments -> reading
// order (handles two-column pages) -> paragraph blocks.
//
// Everything here works on plain numbers so it can be unit-tested in node
// without pdf.js. See ./pdfjs.ts for the adapter.

import type { Block, PageInput, Piece, RawItem } from '../types.ts';
import { collectWords, decideHyphen, normalizeChars } from '../repair.ts';

interface LItem extends RawItem {
  sup?: boolean;
  sub?: boolean;
  /** pdf.js emitted a whitespace item right before this one */
  spaceBefore?: boolean;
}

interface Cluster {
  y: number;
  h: number;
  items: LItem[];
}

export interface Seg {
  page: number;
  pieces: Piece[];
  text: string;
  x0: number;
  x1: number;
  y: number;
  h: number;
  font: string;
  tabular: boolean;
  /** line ended with a standalone "-" item (typesetter's discretionary hyphen) */
  softHyphenEnd: boolean;
  /** x where the text starts after a bullet or list number */
  textX0: number;
  /** reading region (leaf of the XY-cut) */
  col: string;
  colRight: number;
  colLeft: number;
}

const BULLET_RE = /^[\u0080-\u009F\uF000-\uF0FF•▪●◦■□‣⁃∙➢–—*]\s*$/;
const CITE_SUP_RE = /^[\s\d,–—\-−‒*†‡§]+$/;

/** Group items into baseline clusters, then attach super/subscripts to their base line. */
function buildClusters(items: LItem[]): Cluster[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const clusters: Cluster[] = [];
  for (const it of sorted) {
    const c = clusters.at(-1);
    if (c && Math.abs(c.y - it.y) <= 0.3 * Math.max(c.h, it.h)) {
      c.items.push(it);
      c.h = Math.max(c.h, it.h);
    } else {
      clusters.push({ y: it.y, h: it.h, items: [it] });
    }
  }
  // superscripts / subscripts: small clusters sitting just above/below a bigger line
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    if (!c.items.length) continue;
    for (let j = Math.max(0, i - 3); j < Math.min(clusters.length, i + 4); j++) {
      if (j === i) continue;
      const b = clusters[j];
      if (!b.items.length || b.h < c.h * 1.15) continue;
      const dy = c.y - b.y;
      const isSup = dy > 0.1 && dy <= 0.75 * b.h;
      const isSub = dy < -0.05 && dy >= -0.45 * b.h;
      if (!isSup && !isSub) continue;
      const keep: LItem[] = [];
      for (const it of c.items) {
        const touches = b.items.some(
          (o) => Math.abs(o.x + o.w - it.x) < 2.5 || Math.abs(it.x + it.w - o.x) < 2.5,
        );
        if (touches) {
          b.items.push(isSup ? { ...it, sup: true } : { ...it, sub: true });
        } else keep.push(it);
      }
      c.items = keep;
      if (!keep.length) break;
    }
  }
  return clusters.filter((c) => c.items.length);
}

function dominantFont(items: LItem[]): string {
  const count = new Map<string, number>();
  for (const it of items) if (!it.sup && !it.sub) count.set(it.font, (count.get(it.font) ?? 0) + it.str.length);
  let best = items[0]?.font ?? '';
  let n = -1;
  for (const [f, c] of count) if (c > n) [best, n] = [f, c];
  return best;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Split a line cluster into segments at large horizontal gaps, building pieces. */
function clusterToSegs(c: Cluster, page: number): Seg[] {
  const items = [...c.items].sort((a, b) => a.x - b.x);
  const groups: LItem[][] = [];
  let cur: LItem[] = [];
  let lastX1 = -Infinity;
  let lastH = 0;
  for (const it of items) {
    const gap = it.x - lastX1;
    const localH = it.sup || it.sub ? lastH : lastH ? Math.min(it.h, lastH) : it.h;
    if (cur.length && gap > Math.max(1.1 * localH, 5)) {
      groups.push(cur);
      cur = [];
    }
    cur.push(it);
    lastX1 = Math.max(lastX1, it.x + it.w);
    if (!it.sup && !it.sub) lastH = it.h;
  }
  if (cur.length) groups.push(cur);

  return groups.map((g) => {
    const baseH = median(g.filter((i) => !i.sup && !i.sub).map((i) => i.h)) || c.h;
    const pieces: Piece[] = [];
    let droppedCite = false;
    let text = '';
    let prevEnd = -Infinity;
    let softHyphenEnd = false;
    g.forEach((it, k) => {
      let str = normalizeChars(it.str);
      if (it.sup) {
        const prevChar = text.trimEnd().slice(-1);
        if (CITE_SUP_RE.test(str) && /[\d*†‡§]/.test(str) && /[A-Za-z)\].,;:%”"]/.test(prevChar)) {
          droppedCite = true;
          prevEnd = it.x + it.w;
          return; // citation superscript: drop
        }
      }
      // standalone trailing hyphen item = discretionary break
      if (k === g.length - 1 && /^[-‐­]$/.test(str.trim()) && /[A-Za-z]$/.test(text)) {
        softHyphenEnd = true;
        return;
      }
      const gap = it.x - prevEnd;
      const afterCite = droppedCite && /^[A-Za-z0-9(“"]/.test(str);
      droppedCite = false;
      const needSpace =
        text.length > 0 &&
        !/\s$/.test(text) &&
        !/^\s/.test(str) &&
        !it.sub &&
        !(it.sup && /^(st|nd|rd|th|\+|-|−)/.test(str)) &&
        (gap > 0.12 * baseH || it.spaceBefore === true || afterCite);
      if (needSpace) {
        pieces.push({ text: ' ', page, item: -1, start: 0, end: 1 });
        text += ' ';
      }
      // trim leading space if text already ends with space (or is empty)
      let start = 0;
      let end = it.str.length;
      if ((text === '' || /\s$/.test(text)) && /^\s+/.test(str)) {
        const lead = str.length - str.trimStart().length;
        start += lead;
        str = str.slice(lead);
      }
      if (str === '') return;
      pieces.push({ text: str, page, item: it.idx, start, end, sup: it.sup, sub: it.sub });
      text += str;
      prevEnd = it.x + it.w;
    });
    // trim trailing whitespace pieces
    while (pieces.length && pieces.at(-1)!.text.trim() === '') {
      text = text.slice(0, -pieces.at(-1)!.text.length);
      pieces.pop();
    }
    if (pieces.length && /\s$/.test(pieces.at(-1)!.text)) {
      const p = pieces.at(-1)!;
      const t = p.text.trimEnd();
      text = text.slice(0, text.length - (p.text.length - t.length));
      p.end -= p.text.length - t.length;
      p.text = t;
    }
    const x0 = Math.min(...g.map((i) => i.x));
    const x1 = Math.max(...g.map((i) => i.x + i.w));
    const lead = g[0].str.trim();
    const textX0 = g.length > 1 && (BULLET_RE.test(lead) || /^\(?\d{1,2}[.)]$/.test(lead) || /^\(?[a-z][.)]$/.test(lead)) ? g[1].x : x0;
    return {
      page,
      pieces,
      text,
      x0,
      x1,
      y: c.y,
      h: baseH,
      font: dominantFont(g),
      tabular: false,
      softHyphenEnd,
      textX0,
      col: '',
      colRight: 0,
      colLeft: 0,
    };
  }).filter((s) => s.text.trim() !== '');
}

/**
 * Reading order by recursive XY-cut: split the region at the widest empty
 * vertical band (a column gutter) or horizontal band (space between a header,
 * a figure and the text), recursing until neither exists. Leaves are read top
 * to bottom. This handles two-column papers, sidebars, and full-width figures
 * without knowing the layout in advance.
 */
function xyCut(segs: Seg[], path: string, out: Seg[][]): void {
  if (segs.length <= 1) {
    if (segs.length) out.push(segs);
    return;
  }
  const medH = median(segs.map((s) => s.h)) || 8;
  const top = (s: Seg) => s.y + s.h * 0.85;
  const bot = (s: Seg) => s.y - s.h * 0.25;

  // widest horizontal gap
  const byTop = [...segs].sort((a, b) => top(b) - top(a));
  let hGap = 0, hAt = -1;
  let lowest = bot(byTop[0]);
  for (let i = 1; i < byTop.length; i++) {
    const g = lowest - top(byTop[i]);
    if (g > hGap) [hGap, hAt] = [g, i];
    lowest = Math.min(lowest, bot(byTop[i]));
  }
  // widest vertical gap whose sides both carry real text
  const byX = [...segs].sort((a, b) => a.x0 - b.x0);
  const total = segs.reduce((n, s) => n + s.text.length, 0);
  let vGap = 0, vAt = -1;
  let maxX1 = byX[0].x1;
  let leftChars = byX[0].text.length;
  const medHx = median(segs.map((s) => s.h)) || 8;
  for (let i = 1; i < byX.length; i++) {
    const g = byX[i].x0 - maxX1;
    const minSide = Math.min(leftChars, total - leftChars);
    const minSegs = Math.min(i, byX.length - i);
    const sidesOk = (minSide > total * 0.08 && minSegs >= 2) || (g > 2.5 * medHx && minSide > total * 0.03 && minSegs >= 3);
    if (g > vGap && sidesOk) [vGap, vAt] = [g, i];
    maxX1 = Math.max(maxX1, byX[i].x1);
    leftChars += byX[i].text.length;
  }

  const vOK = vGap > 0.95 * medH;
  const hOK = hGap > 0.7 * medH;
  if (vOK && (!hOK || vGap >= hGap)) {
    xyCut(byX.slice(0, vAt), path + 'L', out);
    xyCut(byX.slice(vAt), path + 'R', out);
  } else if (hOK) {
    xyCut(byTop.slice(0, hAt), path + 'T', out);
    xyCut(byTop.slice(hAt), path + 'B', out);
  } else {
    out.push(segs.sort((a, b) => b.y - a.y || a.x0 - b.x0));
  }
}

/** Segments for one page, in reading order. */
export function pageSegments(page: PageInput): { segs: Seg[]; rotated: RawItem[] } {
  // whitespace items carry real word breaks (pdf.js often emits "word", " ", "word")
  const marked: LItem[] = page.items.map((i) => ({ ...i }));
  for (let k = 1; k < marked.length; k++) {
    if (marked[k - 1].str.trim() === '' && marked[k - 1].str.length > 0 && Math.abs(marked[k - 1].y - marked[k].y) < 2) marked[k].spaceBefore = true;
  }
  const usable = marked.filter((i) => i.str.trim() !== '' && i.h > 0 && !i.rotated);
  const rotated = page.items.filter((i) => i.rotated && i.str.trim() !== '');
  const clusters = buildClusters(usable);
  const segs = clusters.flatMap((c) => clusterToSegs(c, page.index));

  // tabular lines: 3+ segments on one baseline, or 2 short ones
  const byLine = new Map<number, Seg[]>();
  for (const s of segs) {
    const key = Math.round(s.y * 2) / 2;
    const arr = byLine.get(key) ?? [];
    arr.push(s);
    byLine.set(key, arr);
  }

  const leaves: Seg[][] = [];
  xyCut(segs, 'p', leaves);
  leaves.forEach((leaf, i) => {
    const wide = leaf.filter((s) => s.text.length >= 25);
    const right = wide.length ? median(wide.map((s) => s.x1).sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(wide.length * 0.3)))) : Math.max(...leaf.map((s) => s.x1));
    const left = Math.min(...leaf.map((s) => s.x0));
    for (const s of leaf) [s.col, s.colRight, s.colLeft] = [String(i), right, left];
  });
  for (const arr of byLine.values()) {
    const groups = new Map<string, Seg[]>();
    for (const s of arr) groups.set(s.col, [...(groups.get(s.col) ?? []), s]);
    for (const g of groups.values()) {
      const width = Math.max(10, g[0].colRight - g[0].colLeft);
      if (g.length >= 3 || (g.length === 2 && g.every((s) => s.x1 - s.x0 < width * 0.45))) for (const s of g) s.tabular = true;
    }
  }
  return { segs: leaves.flat(), rotated };
}

const PARA_END_RE = /[.:?!]["”’)\]]*$/;

/** Paragraph blocks from all pages' ordered segments. */
export function buildBlocks(pages: PageInput[]): Block[] {
  const all: { segs: Seg[]; rotated: RawItem[]; page: PageInput }[] = pages.map((p) => ({ ...pageSegments(p), page: p }));
  const docWords = collectWords(all.flatMap((p) => p.segs.map((s) => s.text)));
  const blocks: Block[] = [];
  let id = 0;

  type Building = { block: Block; last: Seg; textX: number };
  let cur: Building | null = null;

  const finish = () => {
    if (cur) blocks.push(cur.block);
    cur = null;
  };
  const start = (s: Seg) => {
    finish();
    const bullet = s.pieces.length > 1 && BULLET_RE.test(s.pieces[0].text);
    cur = {
      block: {
        id: id++,
        kind: s.tabular ? 'table' : 'body',
        text: s.text,
        pieces: s.pieces.map((p) => ({ ...p })),
        page: s.page,
        size: s.h,
        font: s.font,
        bbox: [s.x0, s.y, s.x1, s.y + s.h],
        lines: 1,
      },
      last: s,
      textX: bullet ? s.textX0 : s.textX0,
    };
    if (s.softHyphenEnd) (cur.block as Block & { _soft?: boolean })._soft = true;
  };

  for (const { segs } of all) {
    for (const s of segs) {
      if (!cur) {
        start(s);
        continue;
      }
      const c = cur as Building;
      const P = c.last;
      const h = Math.max(P.h, s.h);
      const gap = P.y - s.y;
      const colWidth = Math.max(10, P.colRight - P.colLeft);
      const startsBullet = s.pieces.length > 1 && BULLET_RE.test(s.pieces[0].text);
      const newBlock =
        s.page !== P.page ||
        s.col !== P.col ||
        s.tabular !== P.tabular ||
        Math.abs(s.h - c.block.size) > 0.75 ||
        gap < 0 ||
        gap > 1.75 * h ||
        startsBullet ||
        (s.x0 > P.x0 + 0.8 * h && Math.abs(s.x0 - c.textX) > 2 && !P.tabular) ||
        (P.x1 < P.colRight - 2.5 * h && PARA_END_RE.test(P.text)) ||
        (s.font !== P.font && P.x1 - P.x0 < 0.75 * colWidth && c.block.lines <= 2);
      if (newBlock) {
        start(s);
        continue;
      }
      // join line s onto the block
      const b = c.block;
      const leftFrag = /([A-Za-z]+)-?$/.exec(b.text)?.[1] ?? '';
      const rightFrag = /^([A-Za-z]+)/.exec(s.text)?.[1] ?? '';
      const soft = (b as Block & { _soft?: boolean })._soft === true;
      if (soft) {
        if (decideHyphen(leftFrag, rightFrag, true, docWords) === 'keep') {
          b.pieces.push({ text: '-', page: s.page, item: -1, start: 0, end: 1 });
          b.text += '-';
        }
      } else if (/[A-Za-z]-$/.test(b.text) && rightFrag) {
        if (decideHyphen(leftFrag, rightFrag, false, docWords) === 'join') {
          const lp = b.pieces.at(-1)!;
          lp.text = lp.text.slice(0, -1);
          lp.end -= 1;
          b.text = b.text.slice(0, -1);
        }
      } else if (/[-–—/]$/.test(b.text)) {
        // "5–" / "and/" at line end: no space
      } else {
        b.pieces.push({ text: ' ', page: s.page, item: -1, start: 0, end: 1 });
        b.text += ' ';
      }
      b.pieces.push(...s.pieces.map((p) => ({ ...p })));
      b.text += s.text;
      (b as Block & { _soft?: boolean })._soft = s.softHyphenEnd;
      b.lines++;
      b.bbox = [Math.min(b.bbox![0], s.x0), Math.min(b.bbox![1], s.y), Math.max(b.bbox![2], s.x1), Math.max(b.bbox![3], s.y + s.h)];
      c.last = s;
      if (s.x0 < c.textX - 2 && !startsBullet) c.textX = Math.min(c.textX, s.x0);
    }
    // rotated text on this page -> one figure block
  }
  finish();

  for (const { rotated, page } of all) {
    if (!rotated.length) continue;
    const text = rotated.map((r) => normalizeChars(r.str)).join(' ');
    blocks.push({
      id: id++,
      kind: 'figure',
      reason: 'rotated text (figure label)',
      text,
      pieces: rotated.flatMap((r, i) => [
        ...(i ? [{ text: ' ', page: page.index, item: -1, start: 0, end: 1 }] : []),
        { text: normalizeChars(r.str), page: page.index, item: r.idx, start: 0, end: r.str.length },
      ]),
      page: page.index,
      size: median(rotated.map((r) => r.h)),
      font: rotated[0].font,
      lines: rotated.length,
    });
  }
  for (const b of blocks) {
    const bb = b as Block & { _soft?: boolean };
    if (bb._soft) b.softEnd = true;
    delete bb._soft;
  }
  return blocks;
}
