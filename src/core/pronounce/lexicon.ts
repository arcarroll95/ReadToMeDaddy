// How to say abbreviations and terms.
//
// Value forms:
//   '@letters'  spell it out: "ECT" -> "E C T"
//   '@word'     leave it for the voice to say as a word: "NICE"
//   anything else: say exactly this text
//
// Unknown ALL-CAPS tokens fall back to: <= 4 letters or no vowels -> letters,
// otherwise left as a word. Add an entry here (or in the user's own list) to
// change that.

import nccep from '../data/nccep.json' with { type: 'json' };

export const LETTERS = '@letters';
export const WORD = '@word';

export const CORE_LEXICON: Record<string, string> = {
  // --- said as words / custom ---
  AIDS: WORD, NICE: WORD, REMS: 'rems', CANMAT: 'can mat', MADRS: 'mad ers', HAMD: 'ham D', HDRS: 'H D R S',
  GWAS: 'gee wass', SAINT: WORD, COVID: 'covid', PET: WORD, SPECT: 'spect', CAGE: WORD, AUDIT: WORD,
  CIWA: 'see wah', COWS: WORD, AMPA: 'am pa', GABA: 'gabba', GABAergic: 'gabba ergic', mTOR: 'em tor', JAMA: 'jamma',
  PrEP: 'prep', REM: 'rem', NREM: 'non rem', NSAID: 'en said', NSAIDs: 'en saids', STEMI: 'stemmy', NSTEMI: 'en stemmy',
  CABG: 'cabbage', APGAR: 'app gar', PEEP: WORD, CPAP: 'see pap', BiPAP: 'bye pap', ROSC: 'rosk', LVAD: 'L vad',
  RVAD: 'R vad', VAD: 'vad', SAMHSA: 'sam sah', NIDA: 'nee da', LAMA: 'lah ma', LABA: 'lah ba', SOAP: WORD,
  SIG: 'sig', SNOMED: 'snow med', HIPAA: 'hippa', PICO: 'pee ko', UpToDate: 'up to date', DSM: LETTERS,
  CYP: 'see why pee', CYPs: 'see why pees', Hb: 'H B', HbA: 'H B A', SpO: 'S P O', FiO: 'F I O',
  BiPAPs: 'bye paps', ASAM: 'ay sam', NALT: LETTERS, LSMD: LETTERS, ESCAPE: WORD, ELEKT: 'elect', KetECT: 'ket E C T',
  SUSTAIN: WORD, TRANSFORM: WORD, EPISODE: WORD, BROADEN: WORD, RECLAIM: WORD, REBUS: WORD, QIDS: 'quids',
  // --- spelled ---
  ECT: LETTERS, TMS: LETTERS, rTMS: 'R T M S', iTBS: 'I T B S', cTBS: 'C T B S', dTMS: 'D T M S', tDCS: 'T D C S',
  fcMRI: 'F C M R I', sgACC: 'S G A C C', DLPFC: LETTERS, VNS: LETTERS, DBS: LETTERS, MST: LETTERS, SNT: LETTERS,
  MDMA: LETTERS, NMDA: LETTERS, BDNF: LETTERS, TRD: LETTERS, MDD: LETTERS, SSRI: LETTERS, SNRI: LETTERS, MAOI: LETTERS,
  TCA: LETTERS, FGA: LETTERS, SGA: LETTERS, EPS: LETTERS, NMS: LETTERS, QTc: 'Q T C', OCD: LETTERS, PTSD: LETTERS,
  ADHD: LETTERS, PMDD: LETTERS, OUD: LETTERS, AUD: LETTERS, SUD: LETTERS, MOUD: 'mood', FDA: LETTERS, DEA: LETTERS,
  APA: LETTERS, WHO: LETTERS, HPA: LETTERS, LSD: LETTERS, PCP: LETTERS, THC: LETTERS, CBD: LETTERS, MRI: LETTERS,
  EEG: LETTERS, ECG: LETTERS, EKG: LETTERS, CBT: LETTERS, DBT: LETTERS, IPT: LETTERS, EMDR: LETTERS, HIV: LETTERS,
  HCV: LETTERS, IND: LETTERS, HDE: LETTERS, LAI: LETTERS, SSRIs: "S S R I's", SNRIs: "S N R I's", MAOIs: "M A O I's",
  TCAs: "T C A's", FGAs: "F G A's", SGAs: "S G A's", HbA1c: 'H B A 1 C', mRNA: 'M R N A', eGFR: 'E G F R', hCG: 'H C G',
  NNT: 'number needed to treat', NNH: 'number needed to harm',
};

// Slash abbreviations from the approved list: unpronounceable as written, so expand them.
const SLASH_EXPANSIONS: Record<string, string> = {};
// All-caps entries from the approved list: spelled as letters unless already in the core lexicon.
const LIST_ACRONYMS: Record<string, string> = {};
// Collide with English words when a heading is in capitals, or are units handled elsewhere.
const LIST_EXCLUDE = new Set(['NO', 'IN', 'US', 'ME', 'PT', 'MS', 'TOO', 'SA', 'OD', 'PM', 'AM', 'MED', 'NEG', 'POS', 'FLEX', 'COMM', 'HOSP', 'QUES', 'PALP', 'CATH', 'ASSOC', 'MOST', 'FAST', 'SWAT', 'PEARL', 'ZED', 'TOD', 'TOO', 'TOR', 'AMT', 'EXT', 'LAT', 'OZ', 'WT', 'TV', 'ST', 'SI', 'CA', 'CO', 'ED', 'DT', 'HA', 'HD', 'HI', 'PE', 'PA', 'RT', 'TS', 'TK', 'IN', 'US', 'NC']);
for (const [k, v] of Object.entries(nccep as Record<string, string>)) {
  if (k.includes('/') && !/x\s*\d/.test(k)) SLASH_EXPANSIONS[k] = v.replace(/\(s\)/g, 's').toLowerCase();
  else if (/^[A-Z][A-Z0-9]{1,7}$/.test(k) && !LIST_EXCLUDE.has(k) && !(k in CORE_LEXICON)) LIST_ACRONYMS[k] = LETTERS;
}
SLASH_EXPANSIONS['A/O x 3'] = 'alert and oriented times three';
SLASH_EXPANSIONS['A/O x 4'] = 'alert and oriented times four';
Object.assign(SLASH_EXPANSIONS, {
  'w/': 'with', 'w/o': 'without', 's/p': 'status post', 'c/o': 'complains of', 'h/o': 'history of', 'y/o': 'year old',
  'and/or': 'and or', 'b/l': 'bilateral', 'N/V': 'nausea and vomiting', 'N/V/D': 'nausea, vomiting and diarrhea',
});

export const LIST_EXPANSIONS: Record<string, string> = Object.fromEntries(
  Object.entries(nccep as Record<string, string>).map(([k, v]) => [k, v]),
);

export function buildLexicon(user: Record<string, string> = {}): Record<string, string> {
  return { ...LIST_ACRONYMS, ...CORE_LEXICON, ...user };
}

export { SLASH_EXPANSIONS };
