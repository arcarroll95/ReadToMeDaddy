import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPasted } from '../src/core/pipeline.ts';

const text = `## Overview

**ECT** works best for psychotic depression.[3]

- First bullet point.
- Second bullet point.

| Drug | Dose |
| --- | --- |
| Lithium | 300 mg |

Figure 1
A long caption about the figure that should not be read.

### References
1. Someone et al. Some paper. 2023.`;

test('pasted markdown: headings, lists, tables, captions, references', () => {
  const r = readPasted(text);
  const said = r.sentences.map((s) => s.spoken);
  assert.deepEqual(said, ['Overview.', 'E C T works best for psychotic depression.', 'First bullet point.', 'Second bullet point.']);
  assert.ok(r.blocks.some((b) => b.kind === 'table'));
  assert.ok(r.blocks.some((b) => b.kind === 'caption'));
  assert.ok(r.blocks.some((b) => b.kind === 'references'));
});
test('lists can be skipped', () => {
  const r = readPasted(text, { headers: true, citations: true, captions: true, figures: true, tables: true, references: true, frontmatter: true, lists: true, headings: false });
  assert.ok(!r.sentences.some((s) => s.spoken.includes('bullet')));
});
