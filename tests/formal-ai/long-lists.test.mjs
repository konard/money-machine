import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';

test('a long comma list parses in linear, not exponential, time', () => {
  const lexicon = loadLexicon();
  const names = Array.from(
    { length: 40 },
    (_, i) => `Xa${'bcdefghij'[i % 9]}${i}`
  );
  const started = performance.now();
  parseSentence(`NOT supported: ${names.join(', ')}.`, lexicon);
  assert.ok(performance.now() - started < 5000);
});
