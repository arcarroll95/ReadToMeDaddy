// Glue: source -> blocks -> sentences with spoken forms.

import type { Block, BlockKind, PageInput, Reading, Sentence, SkipSettings } from './types.ts';
import { DEFAULT_SKIPS } from './types.ts';
import { buildBlocks } from './pdf/layout.ts';
import { classifyBlocks, mergeContinuations } from './classify.ts';
import { pasteToBlocks } from './paste.ts';
import { splitSentences } from './sentences.ts';
import { isShouting, speak, type LettersStyle, type RespellStyle } from './pronounce/speak.ts';
import { buildLexicon } from './pronounce/lexicon.ts';

export function readKindsFor(skips: SkipSettings): Set<BlockKind> {
  const k = new Set<BlockKind>(['body']);
  if (!skips.headings) k.add('heading');
  if (!skips.lists) k.add('list');
  if (!skips.captions) k.add('caption');
  if (!skips.figures) k.add('figure');
  if (!skips.tables) k.add('table');
  if (!skips.references) k.add('references');
  if (!skips.frontmatter) k.add('frontmatter');
  if (!skips.headers) ['header', 'pagenum', 'junk'].forEach((x) => k.add(x as BlockKind));
  return k;
}

export function pdfBlocks(pages: PageInput[]): Block[] {
  const blocks = buildBlocks(pages);
  classifyBlocks(blocks, pages);
  return mergeContinuations(blocks);
}

export function toReading(
  blocks: Block[],
  pageCount: number,
  skips: SkipSettings = DEFAULT_SKIPS,
  userLexicon: Record<string, string> = {},
  voiceOpts: { lettersStyle?: LettersStyle; respellStyle?: RespellStyle; useDrugList?: boolean } = {},
): Reading {
  const readKinds = readKindsFor(skips);
  const sentences: Sentence[] = [];
  let sid = 0;
  let words = 0;
  const lex = buildLexicon(userLexicon);
  for (const b of blocks) {
    if (!readKinds.has(b.kind)) continue;
    const spans = b.kind === 'heading' ? [{ start: 0, end: b.text.length }] : splitSentences(b.text);
    for (const sp of spans) {
      const display = b.text.slice(sp.start, sp.end);
      let input = display;
      if (isShouting(display)) {
        // "GENETICS AND EPIGENETICS": read as words, but keep known abbreviations
        input = display.replace(/[A-Za-z]+/g, (w) => (w in lex ? w : w.toLowerCase()));
      }
      let spoken = speak(input, { stripCitations: skips.citations, userLexicon, ...voiceOpts });
      if (b.kind === 'heading' && spoken && !/[.!?:]$/.test(spoken)) spoken += '.'; // a beat after headings
      if (!spoken.replace(/[^A-Za-z0-9]/g, '')) continue;
      words += spoken.split(/\s+/).length;
      sentences.push({ id: sid++, blockId: b.id, start: sp.start, end: sp.end, display, spoken, isHeading: b.kind === 'heading' });
    }
  }
  return {
    blocks,
    sentences,
    readKinds,
    stats: { pages: pageCount, words, sentences: sentences.length, skippedBlocks: blocks.filter((b) => !readKinds.has(b.kind)).length },
  };
}

export function readPdfPages(pages: PageInput[], skips?: SkipSettings, userLexicon?: Record<string, string>): Reading {
  return toReading(pdfBlocks(pages), pages.length, skips, userLexicon);
}

export function readPasted(text: string, skips?: SkipSettings, userLexicon?: Record<string, string>): Reading {
  return toReading(pasteToBlocks(text), 0, skips, userLexicon);
}
