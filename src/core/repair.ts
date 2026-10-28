// Text repairs that don't depend on layout.
import { isWord, hasWordList } from './words.ts';

/**
 * A word was broken across lines with a hyphen. Decide whether the hyphen is
 * a typesetting break ("depres-|sive" -> "depressive") or a real compound
 * ("half-|life" -> "half-life").
 *
 * @param left  letters before the hyphen (last word fragment of the line)
 * @param right letters after the line break (first word fragment of next line)
 * @param softSignal true when the PDF stored the hyphen as its own item, which
 *        typesetters do for discretionary breaks
 * @param docWords lowercase words seen elsewhere in the document
 * @returns 'join' (drop hyphen) or 'keep' (keep hyphen, no space)
 */
export function decideHyphen(
  left: string,
  right: string,
  softSignal: boolean,
  docWords: Set<string>,
): 'join' | 'keep' {
  if (!/^[a-z]/.test(right)) return 'keep'; // "DSM-|5", "anti-|NMDA"
  if (!/[A-Za-z]$/.test(left)) return 'keep'; // "5-|HT", "2-|week"
  const joined = (left + right).toLowerCase();
  const hyph = (left + '-' + right).toLowerCase();
  if (docWords.has(hyph) && !docWords.has(joined)) return 'keep';
  if (docWords.has(joined)) return 'join';
  if (softSignal) return 'join';
  if (hasWordList()) {
    if (isWord(joined)) return 'join';
    if (isWord(left) && isWord(right) && left.length > 2) return 'keep';
  }
  return 'join'; // most line-end hyphens in prose are breaks
}

const LIGATURES: Record<string, string> = {
  'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st',
};

/** Same-length-safe cleanup: ligatures expand, so callers must not rely on offsets after this. */
export function normalizeChars(s: string): string {
  return s
    .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
    .replace(/­/g, '') // soft hyphen
    .replace(/[  -  ]/g, ' ')
    .replace(/[​-‍﻿]/g, '');
}

/** Words used in a document, for hyphenation decisions. */
export function collectWords(texts: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const t of texts) {
    for (const m of t.toLowerCase().matchAll(/[a-z]+(?:-[a-z]+)*/g)) {
      set.add(m[0]);
      if (m[0].includes('-')) for (const p of m[0].split('-')) set.add(p);
    }
  }
  return set;
}
