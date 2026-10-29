// Build the reader web app into ./reader (served by GitHub Pages).
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'reader');
fs.mkdirSync(out, { recursive: true });

const common = { bundle: true, format: 'esm', target: 'es2022', minify: true, legalComments: 'none', logLevel: 'warning', loader: { '.txt': 'text' } };
await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/reader/main.ts')], outfile: path.join(out, 'app.js') });
await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/reader/tts-worker.ts')], outfile: path.join(out, 'tts-worker.js') });

const pdfWorker = path.join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
fs.copyFileSync(pdfWorker, path.join(out, 'pdf.worker.min.mjs'));
fs.copyFileSync(path.join(root, 'src/reader/template.html'), path.join(out, 'index.html'));
fs.writeFileSync(
  path.join(out, 'manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'ReadToMe',
      short_name: 'ReadToMe',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#e9edec',
      theme_color: '#1d5c78',
      icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(out, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d5c78"/><path d="M14 18h22M14 27h30M14 36h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/><rect x="12" y="41" width="28" height="8" rx="3" fill="#d9ef6a"/><path d="M44 34c4 3 4 11 0 14M49 30c7 5 7 17 0 22" stroke="#d9ef6a" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`,
);
for (const f of fs.readdirSync(out)) console.log(`reader/${f}  ${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)} KB`);
