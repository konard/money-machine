/** Production overrides + recorded public data, isolated from setup.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  differences,
  EXPECTED,
  replay,
  sentenceSet,
} from '../../formal-ai/scripts/record-fixtures.mjs';

test(
  'production translations replay offline with an empty cache',
  { timeout: 60000 },
  () => {
    const expected = JSON.parse(readFileSync(EXPECTED, 'utf8'));
    assert.deepEqual(
      expected.map((p) => p.english),
      sentenceSet()
    );
    const diffs = differences(expected, replay());
    assert.equal(
      diffs.length,
      0,
      `All translation differences:\n${JSON.stringify(diffs, null, 2)}`
    );
  }
);
