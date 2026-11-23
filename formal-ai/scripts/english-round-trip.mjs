#!/usr/bin/env node
/** Reproducible offline evaluation on the complete production fixture corpus. */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionEnv, sentenceSet } from './record-fixtures.mjs';

const cache = mkdtempSync(join(tmpdir(), 'formal-ai-english-'));
Object.assign(
  process.env,
  productionEnv({ FORMAL_AI_OFFLINE: '1', FORMAL_AI_CACHE: cache })
);
try {
  const { resolveText } = await import('../src/resolve.mjs');
  const { loadLexicon } = await import('../src/lexicon.mjs');
  const { englishRoundTrip } = await import('../src/english/round-trip.mjs');
  const sentences = sentenceSet();
  await resolveText(sentences.join('\n\n'), { log: () => {} });
  const lexicon = loadLexicon();
  const results = sentences.map((sentence) => {
    const result = englishRoundTrip(sentence, lexicon);
    return { sentence, ...result };
  });
  const counts = new Map();
  for (const r of results) {
    for (const d of r.differences) {
      const key = `${d.change} ${d.kind}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const summary = {
    sentences: results.length,
    exact: results.filter((r) => r.exact).length,
    complete: results.filter((r) => r.complete).length,
    exactAndComplete: results.filter((r) => r.exact && r.complete).length,
    differences: Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (process.argv[2]) {
    writeFileSync(
      process.argv[2],
      `${JSON.stringify({ summary, results }, null, 2)}\n`
    );
  }
} finally {
  rmSync(cache, { recursive: true, force: true });
}
