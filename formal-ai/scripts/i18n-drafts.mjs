#!/usr/bin/env node
/**
 * Russian drafts in lino-i18n's catalogue format, written only from what the
 * general translator produced for random site sentences.
 *
 *   node formal-ai/scripts/i18n-drafts.mjs [count] [seed]
 *
 * Nothing here is typed by hand, and a sentence enters a catalogue only if
 * it passes both automatic gates: translated completely (no English left
 * over) and read back without lost, changed or added information. These
 * gates do not prove a sense is right, so the catalogue stays a draft until
 * reviewed: a key listed in rejected.lino (read and found wrong) stays out
 * until its Russian changes. Existing keys are kept; a key is the hash of
 * the English source and the Russian.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateDocument } from '../src/document.mjs';
import { englishRoundTrip } from '../src/english/round-trip.mjs';
import { loadLexicon } from '../src/lexicon.mjs';
import { resolveText } from '../src/resolve.mjs';
import { readBack, russianFormIndex } from '../src/russian/read-back.mjs';
import { pages, paragraphs, sample, sentences } from './sample.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const OUT = join(ROOT, 'locales', 'drafts', 'ru.lino');
const REJECTED = join(dirname(OUT), 'rejected.lino');
const quote = (text) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Both gates, sentence by sentence. */
function passes(translated, lexicon, index) {
  return (
    translated.stats.complete === translated.stats.sentences &&
    translated.sentences.every((s) => {
      if (!s.formal) {
        return false;
      }
      const r = readBack(s.text, s.formal, lexicon, index);
      return (
        !r.added.length &&
        r.links.every((l) =>
          ['kept', 'widened', 'optional'].includes(l.status)
        ) &&
        englishRoundTrip(s.source, lexicon).exact
      );
    })
  );
}

const [count = '20', seed = String(Date.now() % 100000)] =
  process.argv.slice(2);
const all = pages();
const field = all.map((p) => p.text).join('\n\n');
const picked = sample(
  all.flatMap(paragraphs).flatMap(sentences),
  Number(count),
  Number(seed)
);
await resolveText(picked.map((u) => u.text).join('\n\n'), {
  log: (message) => console.error(message),
});
const lexicon = loadLexicon();
const index = russianFormIndex(lexicon);
const rejected = new Set(
  existsSync(REJECTED) ? readFileSync(REJECTED, 'utf8').split('\n') : []
);
const known = existsSync(OUT)
  ? readFileSync(OUT, 'utf8').split('\n').slice(1).filter(Boolean)
  : [];
const lines = new Map(known.map((l) => [l.trim().split(' ')[0], l]));
let added = 0;
for (const u of picked) {
  const r = translateDocument(u.text, { topic: u.page, field });
  if (passes(r, lexicon, index)) {
    const key = `s${createHash('sha1').update(`${u.text}\n${r.text}`).digest('hex').slice(0, 12)}`;
    if (rejected.has(key)) {
      continue;
    }
    added += lines.has(key) ? 0 : 1;
    lines.set(key, `  ${key} ${quote(r.text)}`);
  }
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `ru\n${[...lines.values()].sort().join('\n')}\n`);
console.log(`${added} new drafts of ${picked.length}; ${lines.size} in ${OUT}`);
