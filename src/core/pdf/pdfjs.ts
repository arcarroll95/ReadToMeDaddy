// Adapter: pdf.js document -> PageInput[] for the layout engine.
// Kept separate so the core can be tested without pdf.js.

import type { PageInput, RawItem } from '../types.ts';

// Minimal structural types so we don't depend on pdf.js's type package.
interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}
interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: unknown[] }>;
}
export interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

export async function pdfToPages(doc: PdfDoc, onProgress?: (done: number, total: number) => void): Promise<PageInput[]> {
  const pages: PageInput[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items: RawItem[] = [];
    tc.items.forEach((raw, idx) => {
      const it = raw as TextItem;
      if (typeof it.str !== 'string') return; // marked-content markers
      const [a, b, , , e, f] = it.transform;
      items.push({
        idx,
        str: it.str,
        x: e,
        y: f,
        w: it.width,
        h: it.height,
        font: it.fontName,
        rotated: Math.abs(b) > Math.abs(a) * 0.1,
      });
    });
    pages.push({ index: n - 1, width: vp.width, height: vp.height, items });
    onProgress?.(n, doc.numPages);
  }
  return pages;
}
