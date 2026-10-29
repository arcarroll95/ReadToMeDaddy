// Turn display text into what the voice should say.
// Order matters: citations out, then numbers/units/symbols, then
// abbreviations, then tidy-up.

import { buildLexicon, LETTERS, SLASH_EXPANSIONS, WORD } from './lexicon.ts';
import { isWord, hasWordList } from '../words.ts';
import { lookupDrug, renderRespelling } from './drugs.ts';

export type LettersStyle = 'spaced' | 'dotted' | 'words' | 'words-hyphen';
export type RespellStyle = 'hyphen' | 'spaced';

export interface SpeakOptions {
  stripCitations: boolean;
  /** how spelled-out abbreviations are written for the voice: "E C T", "E.C.T.", "ee see tee", "ee-see-tee" */
  lettersStyle?: LettersStyle;
  /** how built-in drug respellings are written for the voice */
  respellStyle?: RespellStyle;
  /** use the built-in drug pronunciation list (default true) */
  useDrugList?: boolean;
  /** user's own entries: written form -> spoken form ('@letters' / '@word' allowed) */
  userLexicon?: Record<string, string>;
}

const N = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+`;
const DASH = String.raw`\s?[–—‒\-]\s?`;

const UNITS: Record<string, [string, string]> = {
  mg: ['milligram', 'milligrams'], mcg: ['microgram', 'micrograms'], 'µg': ['microgram', 'micrograms'],
  'μg': ['microgram', 'micrograms'], g: ['gram', 'grams'], kg: ['kilogram', 'kilograms'], ng: ['nanogram', 'nanograms'],
  pg: ['picogram', 'picograms'], mL: ['milliliter', 'milliliters'], ml: ['milliliter', 'milliliters'], L: ['liter', 'liters'],
  dL: ['deciliter', 'deciliters'], 'µL': ['microliter', 'microliters'], 'μL': ['microliter', 'microliters'],
  mmol: ['millimole', 'millimoles'], 'µmol': ['micromole', 'micromoles'], 'μmol': ['micromole', 'micromoles'],
  nmol: ['nanomole', 'nanomoles'], mEq: ['milliequivalent', 'milliequivalents'], mOsm: ['milliosmole', 'milliosmoles'],
  IU: ['international unit', 'international units'], units: ['unit', 'units'], mmHg: ['millimeter of mercury', 'millimeters of mercury'],
  cm: ['centimeter', 'centimeters'], mm: ['millimeter', 'millimeters'], km: ['kilometer', 'kilometers'],
  Hz: ['hertz', 'hertz'], kHz: ['kilohertz', 'kilohertz'], ms: ['millisecond', 'milliseconds'], msec: ['millisecond', 'milliseconds'],
  sec: ['second', 'seconds'], min: ['minute', 'minutes'], h: ['hour', 'hours'], hr: ['hour', 'hours'], hrs: ['hour', 'hours'],
  wk: ['week', 'weeks'], wks: ['week', 'weeks'], mo: ['month', 'months'], yr: ['year', 'years'], yrs: ['year', 'years'],
  kcal: ['kilocalorie', 'kilocalories'], mA: ['milliamp', 'milliamps'], '°C': ['degree Celsius', 'degrees Celsius'],
  '°F': ['degree Fahrenheit', 'degrees Fahrenheit'], 'mg/dL': ['', ''],
};
const DENOMS: Record<string, string> = {
  kg: 'kilogram', g: 'gram', mL: 'milliliter', ml: 'milliliter', L: 'liter', dL: 'deciliter', day: 'day', d: 'day', h: 'hour',
  hr: 'hour', min: 'minute', wk: 'week', week: 'week', m2: 'square meter', 'm²': 'square meter', '24 h': '24 hours',
  '24h': '24 hours', s: 'second', sec: 'second', mmol: 'millimole', mol: 'mole', dose: 'dose', month: 'month', year: 'year',
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UNIT_ALT = Object.keys(UNITS).filter((u) => u !== 'mg/dL').sort((a, b) => b.length - a.length).map(esc).join('|');
const DENOM_ALT = Object.keys(DENOMS).sort((a, b) => b.length - a.length).map(esc).join('|');

const GREEK: Record<string, string> = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'Δ': 'delta', 'ε': 'epsilon',
  'κ': 'kappa', 'λ': 'lambda', 'μ': 'mu', 'µ': 'mu', 'σ': 'sigma', 'τ': 'tau', 'ω': 'omega',
  'θ': 'theta', 'π': 'pi', 'ρ': 'rho', 'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'η': 'eta', 'ζ': 'zeta',
};
const ROMAN: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10' };

function plural(n: string): boolean {
  return !/^1(\.0+)?$/.test(n.replace(/,/g, ''));
}

const LETTER_WORDS: Record<string, string> = {
  A: 'ay', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'eff', G: 'gee', H: 'aitch', I: 'eye', J: 'jay', K: 'kay', L: 'el', M: 'em',
  N: 'en', O: 'oh', P: 'pee', Q: 'cue', R: 'ar', S: 'ess', T: 'tee', U: 'you', V: 'vee', W: 'double you', X: 'ex', Y: 'why', Z: 'zee',
};
let lettersStyle: LettersStyle = 'words';

function spellLetters(s: string, plural = false): string {
  const letters = s.toUpperCase().replace(/[^A-Z]/g, '').split('');
  if (!letters.length) return s;
  switch (lettersStyle) {
    case 'spaced':
      return letters.join(' ') + (plural ? "'s" : '');
    case 'dotted':
      return letters.join('.') + '.' + (plural ? "'s" : '');
    case 'words':
    case 'words-hyphen': {
      const ws = letters.map((l) => LETTER_WORDS[l]);
      if (plural) ws[ws.length - 1] += 's';
      return ws.join(lettersStyle === 'words' ? ' ' : '-');
    }
  }
}

/** Say an alphanumeric code like CYP2D6, 5-HT2A, PHQ-9, HbA1c. */
function sayCode(tok: string, lex: Record<string, string>): string {
  if (tok in lex) return resolve(tok, lex[tok]);
  const parts = tok.split('-').map((part) => {
    if (part in lex) return resolve(part, lex[part]);
    const runs = part.match(/[A-Za-z]+|\d+/g) ?? [];
    return runs
      .map((r) => {
        if (/^\d+$/.test(r)) return r;
        if (r in lex) return resolve(r, lex[r]);
        if (r.toUpperCase() in lex) return resolve(r.toUpperCase(), lex[r.toUpperCase()]);
        if (r.length >= 4 && /^[a-z]+$/.test(r)) return r; // a real word glued to a number
        return spellLetters(r);
      })
      .join(' ');
  });
  return parts.join(' ');
}

function resolve(tok: string, v: string): string {
  if (v === LETTERS) return spellLetters(tok.replace(/[^A-Za-z]/g, ''));
  if (v === WORD) return tok;
  return v;
}

function sayAcronym(tok: string, lex: Record<string, string>): string {
  if (tok in lex) return resolve(tok, lex[tok]);
  const m = /^([A-Z]{2,})s$/.exec(tok);
  if (m) {
    const base = m[1];
    if (base in lex) {
      const v = lex[base];
      if (v === LETTERS) return spellLetters(base, true);
      return resolve(base, v) + 's';
    }
    if (base.length <= 4 || !/[AEIOUY]/.test(base)) return spellLetters(base, true);
    return tok;
  }
  if (tok.length <= 4 || !/[AEIOUY]/.test(tok)) return spellLetters(tok);
  return tok;
}

const OPS: Record<string, string> = {
  '<': 'less than', '>': 'greater than', '≤': 'at most', '≥': 'at least', '=': 'equals', '≈': 'approximately',
  '<=': 'at most', '>=': 'at least',
};

export function speak(display: string, opts: SpeakOptions): string {
  const lex = buildLexicon(opts.userLexicon);
  lettersStyle = opts.lettersStyle ?? 'words';
  const useDrugs = opts.useDrugList !== false;
  const respell = opts.respellStyle ?? 'hyphen';
  let s = ' ' + display + ' ';

  // user entries for multi-word or symbol phrases first (exact text)
  for (const [k, v] of Object.entries(opts.userLexicon ?? {})) {
    if (/^[A-Za-z0-9]+$/.test(k)) continue; // single tokens handled with the lexicon
    s = s.split(k).join(' ' + resolve(k, v) + ' ');
  }

  if (opts.stripCitations) {
    s = s.replace(/\s?(?:\[\s*\d+(?:\s*[,–—\-]\s*\d+)*\s*\])+/g, ''); // [1][2–4]
    s = s.replace(
      /\s?\((?:see\s+)?(?:(?:Extended Data |Supplementary )?(?:Figs?\.?|Figures?|Tables?|Boxes|Box|refs?\.?|Supplementary \w+)\s*[\dA-Za-z,\-–\s.]*;?\s*)+\)/g,
      '',
    );
    // pasted superscript citations glued to words: "MDD7,8", "controls60,61"
    s = s.replace(/(?<=[a-z]{3}|[A-Z]{2})(\d{1,3}(?:[,–\-]\d{1,3})+)(?=[\s.,;:)]|$)/g, '');
  }
  s = s.replace(/\s?\b(?:https?:\/\/|www\.)\S+/g, ' ').replace(/\bdoi:\s?\S+/gi, ' ');
  s = s.replace(/[\u2020\u2021\u00A7\u2022\u25AA\u25CF\u0080-\u009F\uF000-\uF0FF]/g, ' ');

  // slash abbreviations from the approved list (N/V, s/p, w/o ...)
  for (const [k, v] of Object.entries(SLASH_EXPANSIONS)) {
    s = s.replace(new RegExp(`(?<![A-Za-z/])${esc(k)}(?![A-Za-z/])`, 'g'), ` ${v} `);
  }

  // Roman numerals after type/phase/schedule/etc.
  s = s.replace(/\b(type|class|grade|stage|phase|schedule|axis|cluster|level|part|chapter|bipolar|tier)\s+(VIII|VII|VI|IV|IX|V|X|III|II|I)\b/gi, (_m, w, r) => `${w} ${ROMAN[r.toUpperCase()]}`);

  // "Table 21–1", "Figure 3-2": numbering, not a range
  s = s.replace(/\b(Table|Figure|Fig\.|Chapter|Box|Section)\s+(\d+)[\u2013\-.](\d+)/g, '$1 $2 $3');
  // "400-mg dose" -> "400 mg dose"
  s = s.replace(new RegExp(`(?<=\\d)-(${UNIT_ALT})(?![A-Za-z])`, 'g'), (_m, u: string) => ` ${UNITS[u][0]}`);

  s = s.replace(new RegExp(`\\bq\\.?\\s?(${N})(?:${DASH}(${N}))?\\s?(?:h|hr|hrs|hours?)\\b`, 'g'), (_m, a, b) => `every ${a}${b ? ' to ' + b : ''} hours`);
  // percent ranges and number ranges
  s = s.replace(new RegExp(`(${N})%${DASH}(${N})%`, 'g'), '$1 to $2 percent');
  s = s.replace(new RegExp(`(?<![\\w.])(${N})${DASH}(${N})(?![\\w.]*-)`, 'g'), (m, a, b) => (/\d-\d/.test(m) && a.length === 4 && b.length <= 2 ? m : `${a} to ${b}`));
  s = s.replace(new RegExp(`(?<=\\d)\\s?%`, 'g'), ' percent');

  // dosing frequency
  const FREQ: Record<string, string> = {
    qd: 'daily', 'q.d.': 'daily', bid: 'twice daily', BID: 'twice daily', 'b.i.d.': 'twice daily', tid: 'three times daily',
    TID: 'three times daily', 't.i.d.': 'three times daily', qid: 'four times daily', QID: 'four times daily',
    qhs: 'at bedtime', QHS: 'at bedtime', 'q.h.s.': 'at bedtime', prn: 'as needed', PRN: 'as needed', 'p.r.n.': 'as needed',
    PO: 'by mouth', 'p.o.': 'by mouth', qAM: 'every morning', qam: 'every morning', qPM: 'every evening', qpm: 'every evening',
    qod: 'every other day', QOD: 'every other day', qwk: 'weekly', SL: 'sublingual', hs: 'at bedtime',
  };
  for (const [k, v] of Object.entries(FREQ)) s = s.replace(new RegExp(`(?<![\\w.])${esc(k)}(?![\\w])`, 'g'), v);
  s = s.replace(/(?<=\d)\s?[x×]\s?\/\s?(day|week|wk|month|d)\b/g, (_m, d) => ` times per ${DENOMS[d] ?? d}`);
  s = s.replace(/[×]\s?(?=\d)/g, ' times ').replace(/(?<=\d)\s?[×]/g, ' times');
  s = s.replace(/(?<=\s)x\s?(?=\d+\s?(?:days?|weeks?|wk|months?|d)\b)/g, 'for ');

  // number + unit (+ /denominator)
  s = s.replace(
    new RegExp(`(?<![\\w.])(${N})\\s?(${UNIT_ALT})(?:\\/(${DENOM_ALT}))?(?![A-Za-z\\u00B5\\u03BC])`, 'g'),
    (_m, n: string, u: string, d?: string) => {
      const [one, many] = UNITS[u];
      return `${n} ${plural(n) ? many : one}${d ? ' per ' + DENOMS[d] : ''}`;
    },
  );
  s = s.replace(/(?<=\d)\s?mg\/dL\b/g, ' milligrams per deciliter');
  // bare unit ratios: "dose in mg/kg"
  s = s.replace(new RegExp(`(?<![\\w])(${UNIT_ALT})\\/(${DENOM_ALT})(?![\\w])`, 'g'), (_m, u, d) => `${UNITS[u][1]} per ${DENOMS[d]}`);
  s = s.replace(/\/(day|d|week|wk|month|year)\b/g, (_m, d) => ` per ${DENOMS[d] ?? d}`);

  // statistics
  s = s.replace(/\b(\d+)\s?percent\s+CI\b/g, '$1 percent confidence interval').replace(/\bCIs?\b/g, (m) => (m === 'CIs' ? 'confidence intervals' : 'confidence interval'));
  s = s.replace(/\bHR\s?(?:[=:]\s?)?(?=[\d.]*\.\d)/g, 'hazard ratio ');
  s = s.replace(/\bOR\s?(?:[=:]\s?)?(?=[\d.<>]*\d)/g, 'odds ratio ');
  s = s.replace(/\bRR\s?(?:[=:]\s?)?(?=[\d.]*\.\d)/g, 'relative risk ');
  s = s.replace(/\bRD\s?(?:[=:]\s?)?(?=[−\-]?[\d.]*\.\d)/g, 'risk difference ');
  s = s.replace(/\bSMD\b/g, 'standardized mean difference');
  s = s.replace(/(?<![\w])([pPnNdr])\s?(<=|>=|[<>=≤≥])\s?(?=[\d.])/g, (_m, v, op) => `${v.toLowerCase()} ${OPS[op]} `);
  s = s.replace(/(?<![\w])\.(\d)/g, '0.$1');
  s = s.replace(/(?<=\d):(?=\d)(?!\d\d\b)/g, ' to '); // 1:1 ratios (not 9:44 times)

  // symbols
  const SYM: [RegExp, string][] = [
    [/\s?(?:→|->|⇒|⟶)\s?/g, ' leads to '], [/\s?←\s?/g, ' from '], [/\s?↔\s?/g, ' and '],
    [/↑\s?/g, ' increased '], [/↓\s?/g, ' decreased '], [/\s?≥\s?/g, ' at least '], [/\s?≤\s?/g, ' at most '],
    [/\s?±\s?/g, ' plus or minus '], [/\s?≈\s?/g, ' approximately '], [/~\s?(?=\d)/g, ' about '],
    [/\s?(?<!\w)<\s?(?=\d)/g, ' less than '], [/\s?(?<!\w)>\s?(?=\d)/g, ' more than '], [/\s&\s/g, ' and '],
    [/(?<=\d)\+(?=\s|$)/g, ' plus'], [/\s\+\s/g, ' plus '], [/\s?\|\s?/g, ', '], [/−(?=\d)/g, 'minus '],
    [/\s=\s/g, ' equals '], [/²/g, ' squared'], [/³/g, ' cubed'], [/°/g, ' degrees'],
  ];
  for (const [re, v] of SYM) s = s.replace(re, v);
  s = s.replace(/[α-ωΔµ]/g, (c) => ` ${GREEK[c] ?? c} `);

  s = s.replace(/(?<=[A-Za-z])[\u2013\u2014](?=[A-Za-z])/g, ' ').replace(/(?<=[A-Za-z])\/(?=[A-Za-z])/g, ' ');
  s = s.replace(/ -(?=[A-Za-z])/g, ' ');

  // latin and academic abbreviations
  const LATIN: [RegExp, string][] = [
    [/\be\.\s?g\.,?/gi, 'for example,'], [/\bi\.\s?e\.,?/gi, 'that is,'], [/\bet al\.?/g, 'and colleagues'],
    [/\betc\./g, 'etcetera.'], [/\bcf\./g, 'compare'], [/\bapprox\./gi, 'approximately'], [/\bvs\.?(?=\s)/g, 'versus'],
    [/\bv\.(?=\s)/g, 'versus'], [/\bFigs\.\s?/g, 'figures '], [/\bFig\.\s?/g, 'figure '], [/\bNo\.\s?(?=\d)/g, 'number '],
    [/\bca\.\s?(?=\d)/g, 'about '], [/\bviz\./g, 'namely'], [/\bresp\./g, 'respectively'],
  ];
  for (const [re, v] of LATIN) s = s.replace(re, v);

  // words: user single-token entries, codes with digits, acronyms, mixed-case acronyms
  s = s.replace(/(?<![\w'])(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)(?![\w'])/g, (tok) => {
    if (opts.userLexicon && tok in opts.userLexicon) return resolve(tok, opts.userLexicon[tok]);
    const lowerKey = tok.toLowerCase();
    if (opts.userLexicon && lowerKey in opts.userLexicon) return resolve(tok, opts.userLexicon[lowerKey]);
    if (useDrugs && /^[A-Za-z]+(?:'s)?$/.test(tok)) {
      const d = lookupDrug(tok);
      if (d) return renderRespelling(d, respell);
    }
    if (/^\d+(st|nd|rd|th|s)$/.test(tok) || /^\d+$/.test(tok)) return tok;
    if (/\d/.test(tok) && /[A-Za-z]/.test(tok)) return sayCode(tok, lex);
    if (tok.includes('-') && hasWordList() && /^[a-z]+-[a-z]+$/.test(tok)) {
      // stray mid-word hyphen from typesetting ("move-ments") vs real compound ("well-being")
      const [a, b] = tok.split('-');
      if (isWord(a + b) && !(isWord(a) && isWord(b))) return a + b;
    }
    if (tok.includes('-')) {
      return tok.split('-').map((p) => (/^[A-Z]{2,}s?$/.test(p) ? sayAcronym(p, lex) : p in lex ? resolve(p, lex[p]) : p)).join(' ');
    }
    if (tok in lex) return resolve(tok, lex[tok]);
    if (/^[A-Z]{2,8}s?$/.test(tok)) return sayAcronym(tok, lex);
    if (/^[a-z]{1,3}[A-Z]{2,}[a-z]?s?$/.test(tok)) return spellLetters(tok.replace(/s$/, ''), tok.endsWith('s'));
    return tok;
  });

  // tidy
  s = s
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/([,;:])(?=[^\s\d"\u201D\u2019')\]])/g, '$1 ')
    .replace(/(?<!\.)\.\.(?!\.)/g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s;
}

/** True if a sentence is mostly capitals (a heading in caps): skip acronym spelling on those. */
export function isShouting(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, '');
  return letters.length > 8 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.8;
}
