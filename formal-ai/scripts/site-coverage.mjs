#!/usr/bin/env node
/**
 * Whole-site precache and coverage: every page's words are resolved into the
 * on-disk cache one page at a time (an interrupted run resumes from the cache
 * and later samples start fast), then every distinct sentence is translated.
 *
 *   node formal-ai/scripts/site-coverage.mjs [report.json]
 *
 * Complete means no English left over and clean means the read-back and the
 * English round trip also hold; neither proves that a word sense is right.
 */

import { writeFileSync } from 'node:fs';
import { translateDocument } from '../src/document.mjs';
import { englishRoundTrip } from '../src/english/round-trip.mjs';
import { loadLexicon } from '../src/lexicon.mjs';
import { resolveText } from '../src/resolve.mjs';
import { readBack, russianFormIndex } from '../src/russian/read-back.mjs';
import { pages, paragraphs, sentences } from './sample.mjs';

const out = process.argv[2] || 'site-coverage.json';
const started = Date.now();
const progress = (message) =>
  console.error(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${message}`);
const all = pages();
const field = all.map((p) => p.text).join('\n\n');
const lexicon = loadLexicon();
for (const [i, page] of all.entries()) {
  await resolveText(page.text, { lexicon, log: () => {} });
  progress(`resolved page ${i + 1}/${all.length} ${page.source}`);
}
const index = russianFormIndex(lexicon);
const unique = new Map();
for (const unit of all.flatMap(paragraphs).flatMap(sentences)) {
  unique.set(unit.text, unit);
}
const report = { sentences: unique.size, complete: 0, clean: 0, crashed: 0 };
const items = [];
let done = 0;
for (const unit of unique.values()) {
  const item = { en: unit.text, source: unit.source, complete: false };
  try {
    const r = translateDocument(unit.text, {
      lexicon,
      topic: unit.page,
      field,
    });
    item.ru = r.text;
    item.complete = r.stats.complete === r.stats.sentences;
    item.clean =
      item.complete &&
      r.sentences.every((s) => {
        if (!s.formal) {
          return false;
        }
        const back = readBack(s.text, s.formal, lexicon, index);
        return (
          !back.added.length &&
          back.links.every((l) =>
            ['kept', 'widened', 'optional'].includes(l.status)
          ) &&
          englishRoundTrip(s.source, lexicon).exact
        );
      });
  } catch (error) {
    item.error = error.message;
    report.crashed += 1;
  }
  report.complete += item.complete ? 1 : 0;
  report.clean += item.clean ? 1 : 0;
  items.push(item);
  done += 1;
  if (done % 500 === 0) {
    progress(`translated ${done}/${unique.size}: ${JSON.stringify(report)}`);
  }
}
writeFileSync(out, JSON.stringify({ report, items }, null, 1));
console.log(JSON.stringify(report));
