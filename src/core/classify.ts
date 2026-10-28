// Decide what each block is (body, heading, caption, running header, ...).
// Works on PDF blocks; pasted text gets its kinds from ./paste.ts.

import type { Block, PageInput } from './types.ts';

const BACK_MATTER_RE =
  /^(references|bibliography|works cited|literature cited|acknowledge?ments?|competing interests|conflicts? of interest|declaration of interests?|author contributions|additional information|peer review information|publisher[’']s note|funding|supplementary information|data availability|ethics declarations|rights and permissions|suggested readings?|recommended readings?|further reading)\s*:?$/i;
const FRONT_MATTER_RE =
  /^(received|accepted|published( online)?|correspondence|e-?mail|©|copyright|doi:|https?:\/\/|check for updates|open access|cite this article|keywords?:)/i;
const CAPTION_RE = /^(fig(ure)?s?\.?|table|chart|exhibit|panel)\s*[\dIVX]+([.\-–:]\d+)?[a-z]?\b/i;
const BULLET_START_RE = /^([\u0080-\u009F\uF000-\uF0FF•▪●◦■□‣⁃∙➢*]|\(?\d{1,2}[.)]\s|\(?[a-z][.)]\s)/;

function charWeightedMode(blocks: Block[], key: (b: Block) => string): string {
  const m = new Map<string, number>();
  for (const b of blocks) m.set(key(b), (m.get(key(b)) ?? 0) + b.text.length);
  let best = '';
  let n = -1;
  for (const [k, v] of m) if (v > n) [best, n] = [k, v];
  return best;
}

export function classifyBlocks(blocks: Block[], pages: PageInput[]): void {
  const pdfBlocks = blocks.filter((b) => b.bbox && b.kind !== 'figure');
  const bodySize = Number(charWeightedMode(pdfBlocks, (b) => (Math.round(b.size * 2) / 2).toString()));
  const bodyFont = charWeightedMode(pdfBlocks.filter((b) => Math.abs(b.size - bodySize) < 0.6), (b) => b.font);
  const pageH = new Map(pages.map((p) => [p.index, p.height]));
  const nPages = pages.length;

  // running headers/footers: same normalized text in the top/bottom margin on many pages
  const marginKey = (b: Block) => b.text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, '');
  const inMargin = (b: Block) => {
    const H = pageH.get(b.page) ?? 800;
    return b.bbox![1] > H * 0.9 || b.bbox![3] < H * 0.08;
  };
  const marginCounts = new Map<string, Set<number>>();
  for (const b of pdfBlocks) {
    if (!inMargin(b) || b.lines > 2) continue;
    const k = marginKey(b);
    const set = marginCounts.get(k) ?? new Set();
    set.add(b.page);
    marginCounts.set(k, set);
  }
  const repeatThreshold = Math.max(2, Math.min(4, Math.ceil(nPages * 0.25)));

  let backMatter = false;
  for (const b of blocks) {
    if (!b.bbox || b.kind === 'figure') continue;
    const t = b.text.trim();
    const words = t.split(/\s+/).length;
    const relSize = b.size / bodySize;

    if (!/[A-Za-z]{2,}/.test(t)) {
      if (inMargin(b) && /^\d{1,4}$/.test(t)) [b.kind, b.reason] = ['pagenum', 'page number'];
      else if (/^[\d\s.,;:()\-–%]+$/.test(t) && t.length >= 4 && inMargin(b)) [b.kind, b.reason] = ['junk', 'printer marks'];
      else if (t.length >= 6 && /^[0-9();:.,\s]+$/.test(t)) [b.kind, b.reason] = ['junk', 'printer marks'];
      else if (relSize < 0.92 || words <= 3) [b.kind, b.reason] = ['figure', 'numbers (chart axis or label)'];
      continue;
    }
    if (inMargin(b) && b.lines <= 2 && (marginCounts.get(marginKey(b))?.size ?? 0) >= repeatThreshold) {
      [b.kind, b.reason] = ['header', 'running header/footer'];
      continue;
    }
    // heading test before back matter so "References" itself is recognized
    const isHeadingLike =
      b.lines <= 3 && t.length <= 160 && !/[.;,]$/.test(t) &&
      (relSize >= 1.1 || (b.font !== bodyFont && relSize >= 0.95) || (t === t.toUpperCase() && t.length > 3 && words <= 10));
    if (isHeadingLike && BACK_MATTER_RE.test(t)) backMatter = true;
    if (backMatter) {
      [b.kind, b.reason] = ['references', 'references / back matter'];
      continue;
    }
    if (b.kind === 'table') {
      b.reason = 'table (columns of cells)';
      continue;
    }
    const authorLine = b.page === 0 && b.lines <= 3 && t.length < 300 && (/,.*,.*,/.test(t) || (/,.*,/.test(t) && /(&| and )/.test(t))) && !/[.;]$/.test(t) && (t.match(/\b[A-Z][a-z]+\b/g)?.length ?? 0) >= 4;
    const affiliations = (t.match(/\b(University|Department|Hospital|Institute|School of|Centre|Center|Faculty|College)\b/g)?.length ?? 0) >= 3 && relSize < 1;
    if (FRONT_MATTER_RE.test(t) || (/@/.test(t) && words < 30) || authorLine || affiliations) {
      [b.kind, b.reason] = ['frontmatter', 'publication details'];
      continue;
    }
    if (CAPTION_RE.test(t) && (relSize < 0.97 || b.font !== bodyFont)) {
      [b.kind, b.reason] = ['caption', 'figure/table caption'];
      continue;
    }
    if (relSize < 0.88) {
      [b.kind, b.reason] = ['figure', 'small print (figure text, footnote, sidebar)'];
      continue;
    }
    if (isHeadingLike || (/^box\s*[\dIVX]+([.\-\u2013]\d+)?\b/i.test(t) && b.lines <= 3)) {
      b.kind = 'heading';
      continue;
    }
    if (BULLET_START_RE.test(t)) {
      b.kind = 'list';
      continue;
    }
    b.kind = 'body';
  }

  // first page: everything above the Abstract/Introduction except the title is masthead/authors
  const firstPage = blocks.filter((b) => b.page === 0 && b.bbox);
  const startIdx = firstPage.findIndex((b) => /^(abstract|summary|introduction|background|overview)\b/i.test(b.text.trim()) && b.text.length < 40);
  if (startIdx > 0) {
    const title = firstPage.slice(0, startIdx).reduce((a, b) => (b.size > a.size ? b : a));
    for (const b of firstPage.slice(0, startIdx)) {
      if (b === title || b.kind === 'header') continue;
      if (/^(abstract|summary|background)\b/i.test(b.text.trim()) && b.text.length > 80) {
        b.kind = 'body'; // "Abstract: ..." run-in paragraph
        continue;
      }
      [b.kind, b.reason] = ['frontmatter', 'masthead / authors'];
    }
  }
  // table of contents boxes ("Sections", "Chapter Outline") and the short entries under them
  for (let i = 0; i < blocks.length; i++) {
    if (!/^(sections|contents|table of contents|in this (article|chapter)|chapter outline|outline)$/i.test(blocks[i].text.trim())) continue;
    [blocks[i].kind, blocks[i].reason] = ['frontmatter', 'table of contents'];
    for (let j = i + 1; j < blocks.length && blocks[j].page === blocks[i].page; j++) {
      const n = blocks[j];
      if (n.kind === 'heading' && n.text.split(/\s+/).length <= 6 && n.size <= blocks[i].size + 0.5) [n.kind, n.reason] = ['frontmatter', 'table of contents'];
    }
  }

  // text immediately under a "Table N" caption, before body text resumes, is the table itself
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind !== 'caption' || !/^table/i.test(b.text)) continue;
    for (let j = i + 1; j < blocks.length; j++) {
      const n = blocks[j];
      if (n.page !== b.page) break;
      if (n.kind === 'header' || n.kind === 'pagenum' || n.kind === 'junk') continue;
      if (n.kind === 'heading' && j === i + 1 && n.font === b.font && Math.abs(n.size - b.size) < 0.3) {
        [n.kind, n.reason] = ['caption', 'figure/table caption']; // caption's second line
        continue;
      }
      if (n.kind === 'heading') break;
      const bodyLike =
        (n.kind === 'body' && n.lines >= 3 && Math.abs(n.size - bodySize) < 0.4 && n.font === bodyFont) ||
        ((n.kind === 'body' || n.kind === 'list') && n.size >= bodySize - 0.3 && n.lines >= 2);
      if (bodyLike) break;
      if (n.kind === 'body' || n.kind === 'list' || n.kind === 'table' || n.kind === 'figure') {
        [n.kind, n.reason] = ['table', 'table (under a table caption)'];
      }
    }
  }
}

const SKIPPABLE_BETWEEN = new Set(['header', 'pagenum', 'junk', 'figure', 'caption', 'table', 'frontmatter']);

/**
 * Re-join body paragraphs split by a column or page break:
 * "...people with" | [footer] [page break] | "OUD commonly..."
 */
export function mergeContinuations(blocks: Block[]): Block[] {
  const out: Block[] = [];
  const merged = new Set<number>();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (merged.has(b.id)) continue;
    out.push(b);
    if (b.kind !== 'body' && b.kind !== 'list') continue;
    let k = i;
    while (true) {
      const tail = out.at(-1)!;
      if (/[.?!:]["”’)\]]*$/.test(tail.text.trim())) break;
      let j = k + 1;
      while (j < blocks.length && SKIPPABLE_BETWEEN.has(blocks[j].kind)) j++;
      const n = blocks[j];
      if (!n || n.kind !== 'body' || Math.abs(n.size - tail.size) > 0.75) break;
      const startsLower = /^[a-z(]/.test(n.text);
      const endsHyphen = /[A-Za-z]-$/.test(tail.text);
      if (!startsLower && !endsHyphen && !tail.softEnd && !/[,;]$/.test(tail.text)) {
        // ends mid-sentence without punctuation (e.g. "...people with") and next starts with a capital: still a continuation
        if (!/[A-Za-z0-9]$/.test(tail.text)) break;
      }
      if (tail.softEnd && /^[a-z]/.test(n.text)) {
        // discretionary hyphen already dropped: glue the word back together
      } else if (endsHyphen && /^[a-z]/.test(n.text)) {
        const lp = tail.pieces.at(-1)!;
        lp.text = lp.text.slice(0, -1);
        lp.end -= 1;
        tail.text = tail.text.slice(0, -1);
      } else {
        tail.pieces.push({ text: ' ', page: n.page, item: -1, start: 0, end: 1 });
        tail.text += ' ';
      }
      tail.pieces.push(...n.pieces);
      tail.text += n.text;
      tail.lines += n.lines;
      tail.softEnd = n.softEnd;
      merged.add(n.id);
      k = j;
    }
  }
  return out;
}
