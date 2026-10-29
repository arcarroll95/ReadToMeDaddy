# ReadToMe

A read-along for medical PDFs and pasted text. It shows the real page, highlights each sentence as it's read, goes up to 4x, and reads only the main text: it skips headers, citations, figures, tables and references, and it says medical terms correctly.

## Status
- [x] Text pipeline: PDF layout (two-column papers, sidebars), cleanup, sentence splitting, medical pronunciation
- [x] Preview page (`dist/preview.html`): see what will be read, what's skipped and why, and how each sentence is pronounced
- [x] Voice bake-off page (`bakeoff/ReadToMe-bakeoff.html`): times Kokoro on your machine and collects ratings
- [x] Listening bake-off (Surface): Kokoro Heart default, Bella / George alternates; ~2.6x real time on WebGPU
- [x] Reader v1 (`reader/`, live at https://arcarroll95.github.io/ReadToMeDaddy/): PDF + paste, Prepare, rolling look-ahead, catch-up pause, speed hint, saved audio, sentence highlighting
- [x] Pronunciation: ~350-drug respelling list (`src/core/pronounce/drugs.ts`), abbreviation styles, Pronunciation lab in the reader
- [ ] Alienware bake-off
- [ ] Speed-ups (fp16 model), web pages in place (extension), scanned PDFs

## Layout
- `src/core/` — source-agnostic pipeline (`pipeline.ts` is the entry point)
  - `pdf/layout.ts` lines → segments → XY-cut reading order → paragraph blocks
  - `classify.ts` body / heading / caption / table / running header / references …
  - `paste.ts` pasted Markdown-ish text → blocks
  - `sentences.ts` abbreviation-aware sentence splitter
  - `pronounce/` lexicon + rules (units, doses, stats, symbols, acronyms, CYP → "see why pee")
- `src/preview/` the preview page
- `tests/` `npm test` (node --test). Fixture tests use PDFs in `fixtures/private/` (git-ignored, copyrighted) and skip without them.

## Commands
    npm test
    npm run typecheck
    npm run build:preview      # -> dist/preview.html
    node scripts/build-reader.mjs   # -> reader/ (commit it; GitHub Pages serves it)
    # test the reader without a voice download: reader/?mock=2  (fake voice at 2x real time)
    node scripts/dump.ts file.pdf --blocks --spoken
