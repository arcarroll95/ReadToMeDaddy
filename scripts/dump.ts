// Usage: node scripts/dump.ts <file.pdf|file.txt> [--blocks] [--spoken]
import fs from 'node:fs';
import path from 'node:path';
import { setWordList } from '../src/core/words.ts';
import { readPdfPages, readPasted } from '../src/core/pipeline.ts';
import { pdfToPages } from '../src/core/pdf/pdfjs.ts';

setWordList(fs.readFileSync(path.join(import.meta.dirname, '../src/core/data/words.txt'), 'utf8'));
const file = process.argv[2];
const showBlocks = process.argv.includes('--blocks');
const showSpoken = process.argv.includes('--spoken');
let reading;
if (file.endsWith('.pdf')) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  reading = readPdfPages(await pdfToPages(doc as never));
} else {
  reading = readPasted(fs.readFileSync(file, 'utf8'));
}
const counts: Record<string, number> = {};
for (const b of reading.blocks) counts[b.kind] = (counts[b.kind] ?? 0) + 1;
console.log(JSON.stringify(reading.stats), JSON.stringify(counts));
if (showBlocks) for (const b of reading.blocks) console.log(`[p${b.page + 1} ${b.kind.padEnd(11)} ${b.size.toFixed(1)} ${b.font}] ${b.text.slice(0, 160).replace(/\n/g, ' ')}`);
if (showSpoken) for (const s of reading.sentences) if (s.spoken !== s.display) console.log(`- ${s.display}\n  > ${s.spoken}`);
