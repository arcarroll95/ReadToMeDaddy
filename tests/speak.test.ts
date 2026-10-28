import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { speak } from '../src/core/pronounce/speak.ts';
import { setWordList } from '../src/core/words.ts';

setWordList(fs.readFileSync(path.join(import.meta.dirname, '../src/core/data/words.txt'), 'utf8'));
const say = (s: string, user?: Record<string, string>) => speak(s, { stripCitations: true, userLexicon: user });

test('CYP is "see why pee"', () => {
  assert.equal(say('metabolized by CYP2D6.'), 'metabolized by see why pee 2 D 6.');
});
test('doses and units', () => {
  assert.equal(say('0.5 mg/kg IV'), '0.5 milligrams per kilogram I V');
  assert.equal(say('5–15 ng/mL'), '5 to 15 nanograms per milliliter');
  assert.equal(say('1 mg'), '1 milligram');
  assert.equal(say('a 400-mg loading dose'), 'a 400 milligram loading dose');
  assert.equal(say('250 mg/month'), '250 milligrams per month');
  assert.equal(say('0.5–1.2 mEq/L'), '0.5 to 1.2 milliequivalents per liter');
});
test('frequencies', () => {
  assert.equal(say('PO q 4–6 hours'), 'by mouth every 4 to 6 hours');
  assert.equal(say('50 mg qhs'), '50 milligrams at bedtime');
});
test('statistics', () => {
  assert.equal(say('(HR 0.49; NNT 6)'), '(hazard ratio 0.49; number needed to treat 6)');
  assert.equal(say('95% CI 3.06–50.93'), '95 percent confidence interval 3.06 to 50.93');
  assert.equal(say('p=0.015'), 'p equals 0.015');
  assert.equal(say('OR 5.11'), 'odds ratio 5.11');
});
test('symbols and latin', () => {
  assert.equal(say('≥2 failures → TRD'), 'at least 2 failures leads to T R D');
  assert.equal(say('e.g., haloperidol'), 'for example, haloperidol');
  assert.equal(say('Smith et al. showed'), 'Smith and colleagues showed');
  assert.equal(say('β-blocker'), 'beta blocker');
  assert.equal(say('~37%'), 'about 37 percent');
});
test('citations are removed', () => {
  assert.equal(say('works fast.[4][3][5]'), 'works fast.');
  assert.equal(say('as shown (Fig. 2) here'), 'as shown here');
  assert.equal(say('risk of MDD7,8 is high'), 'risk of M D D is high');
});
test('acronyms', () => {
  assert.equal(say('SSRIs and rTMS'), "S S R I's and R T M S");
  assert.equal(say('NICE and REMS'), 'NICE and rems');
  assert.equal(say('Table 21–1'), 'Table 21 1');
  assert.equal(say('Schedule I drug'), 'Schedule 1 drug');
});
test('user dictionary wins', () => {
  assert.equal(say('give esketamine', { esketamine: 'ess ketamine' }), 'give ess ketamine');
  assert.equal(say('the MADRS score', { MADRS: '@letters' }), 'the M A D R S score');
});
test('typesetting hyphen inside a word is repaired, real compounds kept', () => {
  assert.equal(say('involuntary move-ments'), 'involuntary movements');
  assert.equal(say('half-life'), 'half life');
});
