// Shared types for the text pipeline.
// The pipeline is source-agnostic: PDFs and pasted text both become Blocks,
// Blocks become Sentences, and each Sentence carries its spoken form plus a
// pointer back to where it came from (for highlighting).

/** One positioned run of text from a PDF page (pdf.js text item, normalized). */
export interface RawItem {
  /** index of the item in pdf.js getTextContent().items for this page */
  idx: number;
  str: string;
  /** left x and baseline y, PDF user space (origin bottom-left) */
  x: number;
  y: number;
  w: number;
  /** font size (pdf.js item.height) */
  h: number;
  font: string;
  /** true if the text is rotated (vertical labels in figures) */
  rotated: boolean;
}

export interface PageInput {
  index: number;
  width: number;
  height: number;
  items: RawItem[];
}

/**
 * A slice of source text. For PDFs it points into a pdf.js item
 * (page, item, [start, end) chars). For pasted text, page = -1 and
 * start/end are offsets into the original pasted string.
 * item = -1 marks synthetic text (a joining space).
 */
export interface Piece {
  text: string;
  page: number;
  item: number;
  start: number;
  end: number;
  /** superscript/subscript run */
  sup?: boolean;
  sub?: boolean;
}

export type BlockKind =
  | 'body'
  | 'heading'
  | 'list'
  | 'caption'
  | 'figure' // small text: figure labels, footnotes, chart axes
  | 'table'
  | 'header' // running header/footer repeated across pages
  | 'pagenum'
  | 'junk' // printer's marks, "0123456789();:"
  | 'frontmatter' // affiliations, received/accepted dates, copyright
  | 'references'; // reference list and other back matter

export interface Block {
  id: number;
  kind: BlockKind;
  /** display text: what's on the page, after dropping citation superscripts and joining hyphenated line breaks */
  text: string;
  /** pieces whose text concatenates to `text` */
  pieces: Piece[];
  page: number;
  /** dominant font size */
  size: number;
  font: string;
  /** bounding box in PDF coords [x0, y0, x1, y1] (y0 bottom) — absent for pasted text */
  bbox?: [number, number, number, number];
  /** human-readable reason when the block is skipped */
  reason?: string;
  lines: number;
  /** block's last line ended in a discretionary hyphen that was dropped */
  softEnd?: boolean;
}

export interface SkipSettings {
  headers: boolean; // running headers, footers, page numbers, junk
  citations: boolean; // [12], superscript refs, (Fig. 2) pointers
  captions: boolean;
  figures: boolean; // small text inside figures, footnotes
  tables: boolean;
  references: boolean; // references + back matter
  frontmatter: boolean;
  lists: boolean;
  headings: boolean;
}

export const DEFAULT_SKIPS: SkipSettings = {
  headers: true,
  citations: true,
  captions: true,
  figures: true,
  tables: true,
  references: true,
  frontmatter: true,
  lists: false, // read lists by default: in pasted AI answers they ARE the content
  headings: false,
};

export interface Sentence {
  id: number;
  blockId: number;
  /** [start, end) in block.text */
  start: number;
  end: number;
  display: string;
  spoken: string;
  isHeading: boolean;
}

export interface Reading {
  blocks: Block[];
  sentences: Sentence[];
  /** which kinds are read under the settings used */
  readKinds: Set<BlockKind>;
  stats: { pages: number; words: number; sentences: number; skippedBlocks: number };
}
