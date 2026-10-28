// English word lookup, used only to break ties when joining words that were
// hyphenated across a line break ("depres-/sive" vs "half-/life").
// The list (hunspell en_US stems) is injected by the host so the core stays
// free of file-loading code: node tests read it from disk, the browser bundle
// inlines it.

let WORDS: Set<string> = new Set();

export function setWordList(text: string): void {
  WORDS = new Set(text.split(/\r?\n/).filter(Boolean));
}

export function hasWordList(): boolean {
  return WORDS.size > 0;
}

const SUFFIXES = [
  'ically', 'ations', 'ation', 'ness', 'ment', 'ments', 'ingly', 'edly', 'ities', 'ity',
  'ing', 'ers', 'ies', 'ied', 'ion', 'ions', 'ally', 'ly', 'ed', 'es', 'er', 's', 'al', 'ic', 'ics',
];

/** Rough "is this an English word" check using stems plus common suffixes. */
export function isWord(w: string): boolean {
  const s = w.toLowerCase();
  if (s.length < 2) return false;
  if (WORDS.has(s)) return true;
  for (const suf of SUFFIXES) {
    if (s.length > suf.length + 2 && s.endsWith(suf)) {
      const stem = s.slice(0, -suf.length);
      if (WORDS.has(stem) || WORDS.has(stem + 'e') || WORDS.has(stem.replace(/i$/, 'y'))) return true;
      // doubled consonant: "stopped" -> "stop"
      if (/(.)\1$/.test(stem) && WORDS.has(stem.slice(0, -1))) return true;
    }
  }
  return false;
}
