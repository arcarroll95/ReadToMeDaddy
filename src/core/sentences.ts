// Sentence splitting that knows medical/academic abbreviations, so the
// highlight doesn't break after "e.g." or "Fig." or in "0.5 mg".

const NO_SPLIT_BEFORE = new Set(
  [
    'e.g', 'i.e', 'eg', 'ie', 'vs', 'v', 'cf', 'ca', 'approx', 'etc', 'al', 'fig', 'figs', 'tab', 'no', 'nos', 'vol', 'vols',
    'pp', 'p', 'ed', 'eds', 'dr', 'drs', 'mr', 'mrs', 'ms', 'prof', 'st', 'jr', 'sr', 'inc', 'ltd', 'co', 'corp', 'dept',
    'univ', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'mt', 'ref', 'refs',
    'resp', 'max', 'min', 'est', 'incl', 'nat', 'med', 'sci', 'ch', 'sec', 'eq', 'eqs', 'suppl',
  ],
);

export interface SentenceSpan {
  start: number;
  end: number;
}

/** Split text into sentence spans [start, end) — trimmed, never empty. */
export function splitSentences(text: string, maxLen = 320): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let segStart = 0;
  const re = /([.?!]+)((?:["\u201D\u2019)\]]|\[\d[\d,\s\u2013-]*\])*)(\s+)(?=["\u201C\u2018(\[]?[A-Z0-9\u0391-\u03A9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const punctEnd = m.index + m[1].length + m[2].length;
    const before = text.slice(segStart, m.index);
    const lastTok = /([A-Za-z.]+)$/.exec(before)?.[1] ?? '';
    const tokLower = lastTok.toLowerCase().replace(/\.$/, '');
    if (m[1] === '.') {
      if (NO_SPLIT_BEFORE.has(tokLower)) continue;
      if (/^[A-Z]$/.test(lastTok)) continue; // initials: "A. Smith"
      if (/(^|\.)[a-z]\.[a-z]$/i.test(lastTok)) continue; // "e.g" "i.e" "U.S"
      if (/\bet\s+al$/i.test(before)) {
        // "et al. 2019" don't split; "et al. The" ambiguous -> split only if next word is common sentence starter
        const next = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
        if (!/^(The|This|These|In|However|We|It|A|An|Our|Their|Such)\b/.test(next)) continue;
      }
    }
    pushSpan(spans, text, segStart, punctEnd, maxLen);
    segStart = m.index + m[0].length;
  }
  pushSpan(spans, text, segStart, text.length, maxLen);
  return spans;
}

function pushSpan(spans: SentenceSpan[], text: string, start: number, end: number, maxLen: number): void {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (end <= start) return;
  if (end - start <= maxLen) {
    spans.push({ start, end });
    return;
  }
  // long run-on: split at "; " nearest the middle, else at ", " nearest the middle
  const mid = start + (end - start) / 2;
  for (const sep of ['; ', ': ', ', ']) {
    let best = -1;
    for (let i = text.indexOf(sep, start + 40); i >= 0 && i < end - 40; i = text.indexOf(sep, i + 1)) {
      if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
    }
    if (best > 0) {
      pushSpan(spans, text, start, best + 1, maxLen);
      pushSpan(spans, text, best + 1, end, maxLen);
      return;
    }
  }
  spans.push({ start, end });
}
