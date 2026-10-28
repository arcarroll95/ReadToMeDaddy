// Bundle the preview page into one self-contained HTML file (dist/preview.html).
// Usage: node scripts/build-preview.mjs [sample.txt]
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist/preview.html');
const samplePath = process.argv[2] ?? path.join(root, 'fixtures/sample-paste.txt');

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/preview/main.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  write: false,
  legalComments: 'none',
  loader: { '.txt': 'text' },
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sample = fs.existsSync(samplePath) ? escHtml(fs.readFileSync(samplePath, 'utf8')) : '';
const html = fs
  .readFileSync(path.join(root, 'src/preview/template.html'), 'utf8')
  .replace('%%SAMPLE%%', () => sample)
  .replace('%%SCRIPT%%', () => js);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${(html.length / 1e6).toFixed(2)} MB)`);
