/**
 * Wikidata grounding with a stubbed API: the filters that keep films,
 * local varieties and wrong senses out of `grounded-in`.
 */

import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  groundingCandidates,
  normalizeRu,
} from '../../formal-ai/src/wikidata.mjs';

const lexicon = loadLexicon();

const item = (id, en, ru, description, types = []) => ({
  id,
  labels: { en: { value: en }, ru: { value: ru } },
  descriptions: { en: { value: description } },
  claims: {
    P31: types.map((t) => ({ mainsnak: { datavalue: { value: { id: t } } } })),
  },
});

/** A fetch that answers search and entity requests from fixed items. */
function stub(items) {
  return async (url) => {
    const params = new URL(url).searchParams;
    const body =
      params.get('action') === 'wbsearchentities'
        ? { search: items.map((i) => ({ id: i.id })) }
        : { entities: Object.fromEntries(items.map((i) => [i.id, i])) };
    return { ok: true, json: async () => body };
  };
}

test('Russian labels are compared without stress marks, case or ё', () => {
  assert.equal(normalizeRu('Ёлка́'), normalizeRu('елка'));
});

test('grounding keeps the sense whose description fits the concept', async () => {
  const fetchImpl = stub([
    item(
      'Q1',
      'bank',
      'банк',
      'financial institution that accepts deposits',
      []
    ),
    item('Q2', 'Bank', 'Банк', 'film', ['Q11424']),
    item('Q3', 'bank', 'банк', 'village in the Taiwan', []),
    item('Q4', 'bank', 'берег', 'land alongside a river', []),
  ]);
  const candidates = await groundingCandidates(lexicon.get('bank.finance'), {
    fetchImpl,
    cache: false,
  });
  assert.deepEqual(
    candidates.map((c) => c.id),
    ['Q1']
  );
});

test('taxa only ground organisms', async () => {
  const fetchImpl = stub([
    item('Q5', 'idea', 'идея', 'genus of insects', ['Q16521']),
  ]);
  assert.deepEqual(
    await groundingCandidates(lexicon.get('idea'), { fetchImpl, cache: false }),
    []
  );
});
