import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chrf,
  sample,
  eligibleSentences,
  fetchPool,
  evaluate,
  failureClasses,
} from '../../formal-ai/scripts/generalization.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

test('chrF2 counts clipped repeated ngrams, Unicode, whitespace and effective orders', () => {
  assert.equal(chrf('Привет, мир!', 'Привет, мир!'), 100);
  assert.equal(chrf('а б\nв', 'абв'), 100);
  assert.equal(chrf('ab', 'ac'), 25);
  assert.equal(chrf('aaa', 'aa'), 87.5);
  assert.equal(chrf('x', 'y'), 0);
  assert.equal(chrf('', 'x'), 0);
  assert.equal(chrf('', ''), 100);
  assert.equal(chrf('е\u0308', 'ё'), 100);
  assert.equal(chrf('😀', '😀'), 100);
  assert.ok(chrf('А', 'а') < 100);
});

const sentence = (id, text = 'This is a sentence.') => ({
  id,
  text,
  lang: 'eng',
  license: 'CC BY 2.0 FR',
  user: { username: 'contributor' },
  translations: [[{ id: id + 100, lang: 'rus', text: 'Это предложение.' }], []],
});

test('pool validates length, language and direct links; seeded shuffle is stable', () => {
  const indirect = sentence(3);
  indirect.translations.reverse();
  const body = {
    results: [
      sentence(1),
      sentence(2, 'Too short.'),
      indirect,
      { ...sentence(4), lang: 'deu' },
      sentence(5, Array(21).fill('word').join(' ')),
      sentence(6, "I don't know this."),
    ],
  };
  const eligible = eligibleSentences(body);
  assert.deepEqual(
    eligible.map((s) => s.id),
    [1, 6]
  );
  assert.deepEqual(eligible[0].references, [
    { id: 101, text: 'Это предложение.' },
  ]);
  assert.deepEqual(sample([1, 2, 3, 4, 5], 3, 42), [1, 5, 3]);
  assert.equal(new Set(sample([1, 2, 3, 4, 5], 5, 42)).size, 5);
  assert.deepEqual(body.results[0].text, 'This is a sentence.');
});

test('offline API fixture checks pagination, deduplication, spacing and generic User-Agent', async () => {
  const calls = [];
  const waits = [];
  const pool = await fetchPool({
    pages: 3,
    cache: false,
    pause: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const params = new URL(url).searchParams;
      assert.equal(params.get('from'), 'eng');
      assert.equal(params.get('to'), 'rus');
      calls.push(params.get('page'));
      const body = {
        results: [sentence(1), sentence(Number(params.get('page')) + 1)],
        paging: { Sentences: { nextPage: calls.length < 2 } },
      };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  });
  assert.deepEqual(calls, ['1', '2']);
  assert.deepEqual(waits, [1000]);
  assert.equal(pool.sentences.length, 3);
});

test('evaluation resolves English only before translating and takes the best reference', async () => {
  let resolved = false;
  const input = [
    {
      ...eligibleSentences({ results: [sentence(1)] })[0],
      references: [{ text: 'Неверно.' }, { text: 'Это предложение.' }],
    },
  ];
  const report = await evaluate(input, {
    resolve: (text) => {
      assert.equal(text, 'This is a sentence.');
      resolved = true;
      return Promise.resolve();
    },
    translate: () => {
      assert.ok(resolved);
      return { text: 'Это предложение.', sentences: [] };
    },
  });
  assert.equal(report.meanChrf, 100);
  assert.equal(report.completePercent, 100);
  assert.deepEqual(failureClasses({ text: 'Я [do this].', sentences: [] }), [
    'parse failure',
  ]);
  assert.deepEqual(failureClasses({ text: 'Я do this.', sentences: [] }), [
    'lexical gap candidate',
  ]);
});
