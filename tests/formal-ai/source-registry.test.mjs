import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketEnabled,
  configureSources,
  parseSources,
  sourceOf,
  SOURCES,
} from '../../formal-ai/src/sources/registry.mjs';
import { getJson } from '../../formal-ai/src/sources/fetch.mjs';

test('every cache bucket belongs to exactly one source', () => {
  const buckets = Object.values(SOURCES).flatMap((s) => s.buckets);
  assert.equal(new Set(buckets).size, buckets.length);
  assert.equal(sourceOf('wiktionary-ru'), 'ru.wiktionary');
  assert.equal(sourceOf('unknown'), null);
});

test('sources switch per call, then per process', () => {
  assert.deepEqual(parseSources('tatoeba=off, kaikki'), {
    tatoeba: false,
    kaikki: true,
  });
  assert.equal(bucketEnabled('tatoeba', { tatoeba: false }), false);
  configureSources({ 'ru.wikipedia': false });
  try {
    assert.equal(bucketEnabled('ruwiki-context'), false);
    assert.equal(
      bucketEnabled('ruwiki-context', { 'ru.wikipedia': true }),
      true
    );
  } finally {
    configureSources({});
  }
});

test('a disabled source answers with no data and makes no request', async () => {
  let called = false;
  const value = await getJson('https://api.tatoeba.org/unstable/sentences', {
    bucket: 'tatoeba',
    cache: false,
    sources: { tatoeba: false },
    fetchImpl: () => {
      called = true;
      throw new Error('no network expected');
    },
  });
  assert.deepEqual(value, {});
  assert.equal(called, false);
});
