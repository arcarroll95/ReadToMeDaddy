// Pasted text (Google Docs, Claude, ChatGPT, OpenEvidence) -> blocks.
// Understands the Markdown-ish shapes these produce: headings, bullet lists,
// pipe tables, "Figure N" captions, and a trailing References section.

import type { Block, BlockKind, Piece } from './types.ts';
import { normalizeChars } from './repair.ts';

const BULLET_RE = /^\s*(?:[-*+•▪●◦]|\d{1,2}[.)])\s+/;
const HEADING_MD_RE = /^\s*#{1,6}\s+/;
const BOLD_LINE_RE = /^\s*\*\*([^*]+)\*\*\s*:?\s*$/;
const TABLE_LINE_RE = /^\s*\|.*\|\s*$/;
const CAPTION_LINE_RE = /^\s*(?:Figure|Fig\.?|Table|Box)\s*\d+[A-Za-z]?\s*[:.]?\s*$/i;
const REFS_RE = /^\s*(?:#{1,6}\s*)?(?:\*\*)?(References|Sources|Citations|Bibliography|Works Cited)(?:\*\*)?\s*:?\s*$/i;

/** Strip inline markdown, keeping a map from output chars back to source offsets. */
function stripInline(src: string, base: number): { text: string; pieces: Piece[] } {
  const pieces: Piece[] = [];
  let text = '';
  const push = (t: string, start: number) => {
    if (!t) return;
    const nt = normalizeChars(t);
    pieces.push({ text: nt, page: -1, item: -1, start, end: start + t.length });
    text += nt;
  };
  // tokens to drop: **, __, `, and markdown links [text](url) -> text
  const re = /\[([^\]]+)\]\((?:[^)]+)\)|\*\*|__|`|(?<![\w*])\*(?=\S)|(?<=\S)\*(?![\w*])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    push(src.slice(last, m.index), base + last);
    if (m[1]) push(m[1], base + m.index + 1);
    last = m.index + m[0].length;
  }
  push(src.slice(last), base + last);
  return { text, pieces };
}

export function pasteToBlocks(input: string): Block[] {
  const src = input.replace(/\r\n?/g, '\n');
  const lines: { text: string; start: number }[] = [];
  let pos = 0;
  for (const l of src.split('\n')) {
    lines.push({ text: l, start: pos });
    pos += l.length + 1;
  }

  const blocks: Block[] = [];
  let id = 0;
  let backMatter = false;
  let captionNext = false;
  let para: { text: string; start: number }[] = [];

  const emit = (kind: BlockKind, group: { text: string; start: number }[], reason?: string) => {
    if (!group.length) return;
    const pieces: Piece[] = [];
    let text = '';
    group.forEach((g, i) => {
      let lineText = g.text;
      let off = g.start;
      const lead = /^\s*(?:#{1,6}\s+|>\s*)?/.exec(lineText)![0].length;
      lineText = lineText.slice(lead);
      off += lead;
      if (kind === 'list' && i === 0) {
        const b = BULLET_RE.exec(lineText);
        if (b && !/^\s*\d/.test(b[0])) {
          lineText = lineText.slice(b[0].length);
          off += b[0].length;
        }
      }
      const r = stripInline(lineText.trimEnd(), off);
      if (i > 0 && text && r.text) {
        pieces.push({ text: ' ', page: -1, item: -1, start: g.start, end: g.start });
        text += ' ';
      }
      pieces.push(...r.pieces);
      text += r.text;
    });
    if (!text.trim()) return;
    if (backMatter) [kind, reason] = ['references', 'references'];
    blocks.push({ id: id++, kind, text, pieces, page: -1, size: 0, font: '', lines: group.length, reason });
  };
  const flushPara = () => {
    if (!para.length) return;
    if (captionNext) emit('caption', para, 'figure caption');
    else emit('body', para);
    captionNext = false;
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.text;
    if (!t.trim()) {
      flushPara();
      continue;
    }
    if (REFS_RE.test(t)) {
      flushPara();
      backMatter = true;
      emit('references', [line], 'references');
      continue;
    }
    if (TABLE_LINE_RE.test(t)) {
      flushPara();
      const group = [line];
      while (i + 1 < lines.length && TABLE_LINE_RE.test(lines[i + 1].text)) group.push(lines[++i]);
      emit('table', group, 'table');
      continue;
    }
    if (CAPTION_LINE_RE.test(t)) {
      flushPara();
      emit('caption', [line], 'figure caption');
      captionNext = true;
      continue;
    }
    if (HEADING_MD_RE.test(t) || BOLD_LINE_RE.test(t)) {
      flushPara();
      emit('heading', [line]);
      continue;
    }
    if (BULLET_RE.test(t)) {
      flushPara();
      // a list item plus any indented continuation lines
      const group = [line];
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1].text) && !BULLET_RE.test(lines[i + 1].text)) group.push(lines[++i]);
      emit('list', group);
      continue;
    }
    para.push(line);
  }
  flushPara();
  return blocks;
}
