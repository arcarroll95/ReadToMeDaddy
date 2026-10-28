import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences } from '../src/core/sentences.ts';

const split = (t: string) => splitSentences(t).map((s) => t.slice(s.start, s.end));

test('does not split after abbreviations', () => {
  assert.deepEqual(split('Use an SGA (e.g. Olanzapine) first. Then reassess.'), ['Use an SGA (e.g. Olanzapine) first.', 'Then reassess.']);
  assert.deepEqual(split('As in Fig. 2 above. Next.'), ['As in Fig. 2 above.', 'Next.']);
  assert.deepEqual(split('Marx et al. 2023 found this. Done.'), ['Marx et al. 2023 found this.', 'Done.']);
  assert.deepEqual(split('Dose is 0.5 mg. Next.'), ['Dose is 0.5 mg.', 'Next.']);
  assert.deepEqual(split('Seen by Dr. Smith today. Ok.'), ['Seen by Dr. Smith today.', 'Ok.']);
});
test('splits after bracket citations', () => {
  assert.deepEqual(split('It faded by 7 days.[22] Repeated infusions help.'), ['It faded by 7 days.[22]', 'Repeated infusions help.']);
});
test('long run-ons split at a semicolon', () => {
  const long = 'a'.repeat(200) + '; ' + 'b'.repeat(200) + '.';
  assert.equal(split(long).length, 2);
});
