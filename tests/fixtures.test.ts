// Regression checks against Aidan's real study PDFs. The PDFs are copyrighted,
// so they live in fixtures/private/ (git-ignored); these tests skip without them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setWordList } from '../src/core/words.ts';
import { readPdfPages, readPasted } from '../src/core/pipeline.ts';
import { pdfToPages } from '../src/core/pdf/pdfjs.ts';

const dir = path.join(import.meta.dirname, '../fixtures/private');
setWordList(fs.readFileSync(path.join(import.meta.dirname, '../src/core/data/words.txt'), 'utf8'));

async function read(name: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(dir, name))), verbosity: 0 }).promise;
  const r = readPdfPages(await pdfToPages(doc as never));
  return { r, said: r.sentences.map((s) => s.display).join('\n') };
}
const has = (name: string) => fs.existsSync(path.join(dir, name));

test('Nature MDD primer (two columns)', { skip: !has('s41572-023-00454-1.pdf') }, async () => {
  const { said } = await read('s41572-023-00454-1.pdf');
  assert.ok(!said.includes('0123456789'), 'printer marks skipped');
  assert.ok(!said.includes('Nature Reviews Disease Primers'), 'running footer skipped');
  assert.ok(!said.includes('Deakin University'), 'affiliations skipped');
  assert.ok(said.includes('The established genome-wide significant findings from GWAS'), 'word spacing and column order');
  assert.ok(said.includes('Individuals with MDD also experience stigma, higher rates'), 'superscript citations removed');
  assert.ok(!/doi\.org\/10\.1038\/s41586/.test(said), 'reference list skipped');
  const intro = said.indexOf('Major depressive disorder (MDD) is a common mental disorder');
  const epi = said.indexOf('The estimated prevalence of MDD varies markedly');
  assert.ok(intro >= 0 && epi > intro, 'left column read before right column');
});

test('Textbook ch 21 (single column, discretionary hyphens)', { skip: !has('ch21_somatic_tx.pdf') }, async () => {
  const { said } = await read('ch21_somatic_tx.pdf');
  assert.ok(said.includes('because most side effects are reversible'), 'hyphen joined inside list item');
  assert.ok(said.includes('noncompliant'), 'hyphen joined across a page break');
  assert.ok(!said.includes('Introductory Textbook of Psychiatry'), 'running header skipped');
  assert.ok(said.includes('When patient compliance needs to be assessed'), 'bullets read');
});

test('Textbook ch 5 keeps DSM criteria boxes', { skip: !has('ch5_schizo.pdf') }, async () => {
  const { said } = await read('ch5_schizo.pdf');
  assert.ok(said.includes('The presence of one (or more) delusions with a duration of 1 month or longer'));
});

test('OUD review reads its abstract', { skip: !has('therapeutic_approach_to_opiod_use_disorder.pdf') }, async () => {
  const { said } = await read('therapeutic_approach_to_opiod_use_disorder.pdf');
  assert.ok(said.includes('Opioid use disorder is a frequent cause of suffering'));
  assert.ok(!said.includes('Dovepress'));
});

test('OpenEvidence answer (pasted)', { skip: !has('openevidence-interventional.txt') }, () => {
  const r = readPasted(fs.readFileSync(path.join(dir, 'openevidence-interventional.txt'), 'utf8'));
  const spoken = r.sentences.map((s) => s.spoken).join('\n');
  assert.ok(!spoken.includes('['), 'no bracket citations spoken');
  assert.ok(!spoken.includes('doi'), 'references skipped');
  assert.ok(!spoken.includes('| Intervention |'), 'table skipped');
});
