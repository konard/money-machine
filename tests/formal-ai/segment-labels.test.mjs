/** ISO dates, letter labels and "Label: value" fragments: pure grammar steps. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../formal-ai/src/english/analyze.mjs';
import {
  letterLabel,
  mergeLabelValues,
} from '../../formal-ai/src/english/label-value.mjs';

const texts = (s) => tokenize(s).map((t) => t.text);

test('an ISO date is read as day, month and year, its marks kept apart', () => {
  assert.deepEqual(texts('checked 2026-11-03._'), [
    'checked',
    '3',
    'November',
    '2026',
    '.',
    '_',
  ]);
  assert.deepEqual(texts('(2026-02-28)'), ['(', '28', 'February', '2026', ')']);
});

test('an impossible date stays as written', () => {
  assert.ok(!texts('(2026-02-30)').includes('February'));
});

test('a single capital letter is a label, a word is not', () => {
  assert.ok(letterLabel({ kind: 'word', text: 'C' }));
  assert.ok(!letterLabel({ kind: 'word', text: 'Cat' }));
  assert.ok(!letterLabel({ kind: 'number', text: '5' }));
  const pronoun = { kind: 'word', text: 'I', readings: [{ pos: 'pron' }] };
  assert.ok(!letterLabel(pronoun));
});

test('"Label: value" joins a lone property to the label before it', () => {
  const label = { type: 'fragment', np: { head: { lemma: 'confidence' } } };
  const value = {
    type: 'fragment',
    link: { separator: ':' },
    property: { lemma: 'estimate', participle: 'passive' },
  };
  const list = [label, value];
  mergeLabelValues(list);
  const [merged, ...rest] = list;
  assert.equal(rest.length, 0);
  assert.equal(merged.factProperty.lemma, 'estimate');
  assert.equal(merged.valueSeparator, ':');
});

test('a value after a comma or with its own noun is not merged', () => {
  const label = { type: 'fragment', np: { head: { lemma: 'confidence' } } };
  const comma = {
    type: 'fragment',
    link: { separator: ',' },
    property: { lemma: 'high' },
  };
  const list = [label, comma];
  mergeLabelValues(list);
  assert.equal(list.length, 2);
});

test('a spaced ampersand is a word that joins peers', () => {
  const [, amp] = tokenize('Content & media');
  assert.equal(amp.kind, 'word');
  assert.equal(amp.text, '&');
});
