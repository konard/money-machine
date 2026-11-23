#!/usr/bin/env node
/** Compare overlap weights on identical public data and the seeded 30 site sentences. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionEnv, sentenceSet, BASIC } from './record-fixtures.mjs';
import { fixtureFetch } from './evaluate.mjs';

const cache = mkdtempSync(join(tmpdir(), 'formal-ai-ranges-'));
Object.assign(
  process.env,
  productionEnv({ FORMAL_AI_OFFLINE: '1', FORMAL_AI_CACHE: cache })
);
try {
  const { loadLexicon } = await import('../src/lexicon.mjs');
  const { resolveText } = await import('../src/resolve.mjs');
  const { translateDocument } = await import('../src/document.mjs');
  const { pages } = await import('./sample.mjs');
  const sources = JSON.parse(
    readFileSync(new URL('./fixture-sentences.json', import.meta.url), 'utf8')
  );
  const topics = new Map(pages().map((p) => [p.source, p.text]));
  const sentences = sentenceSet();
  let lexicon = loadLexicon({ fresh: true });
  try {
    await resolveText(sentences.join('\n\n'), { lexicon });
  } catch (error) {
    if (!error.offline) {
      throw error;
    }
    lexicon = loadLexicon({ fresh: true });
    await resolveText(sentences.join('\n\n'), {
      lexicon,
      fetchImpl: fixtureFetch(),
    });
  }
  const weights = [0, 0.1, 0.25, 0.5, 1, 2];
  const rows = weights.map((weight) => ({
    weight,
    outputs: sentences.map((english, i) => {
      const result = translateDocument(english, {
        lexicon,
        methods: { rangeOverlap: weight },
        topic: topics.get(sources[i - BASIC.length]?.source),
      });
      return {
        english,
        russian: result.text,
        complete: result.stats.incomplete === 0,
      };
    }),
  }));
  console.log(JSON.stringify(rows, null, 2));
} finally {
  rmSync(cache, { recursive: true, force: true });
}
