/** Pure steps behind measures, compounds and Russian phrase adjectives. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../formal-ai/src/english/analyze.mjs';
import { hyphenatedTitles } from '../../formal-ai/src/hyphenated.mjs';
import { regularEntry } from '../../formal-ai/src/russian-entry.mjs';
import {
  declineAdjective,
  shortAdjective,
} from '../../formal-ai/src/russian/morphology.mjs';
import { russianMeanings } from '../../formal-ai/src/sources/russian-meanings.mjs';

test('"30-day" is a count and a unit, its count marked as a measure', () => {
  const tokens = tokenize('a 30-day trial');
  assert.deepEqual(
    tokens.map((t) => t.text),
    ['a', '30', 'day', 'trial']
  );
  assert.ok(tokens[1].measure);
});

test('hyphenated words are looked up whole, by shorter runs and by parts', () => {
  assert.deepEqual(hyphenatedTitles(['gift-card-only']), [
    'gift card only',
    'gift card',
    'card only',
    'gift',
    'card',
    'only',
  ]);
});

test('an adjective with a fixed complement agrees by its first word', () => {
  const entry = regularEntry('adj', { word: 'облагаемый налогом' });
  assert.equal(entry?.lemma, 'облагаемый налогом');
  assert.equal(
    declineAdjective(entry.lemma, { gender: 'm', case: 'acc' }),
    'облагаемый налогом'
  );
  assert.equal(
    shortAdjective(entry.lemma, { number: 'pl' }),
    'облагаемы налогом'
  );
  assert.equal(shortAdjective('законный', { gender: 'n' }), 'законно');
  assert.equal(regularEntry('adj', { word: 'не очень хороший' }), null);
});

test('a Russian definition of an English headword gives its translation', () => {
  const page = [
    '= {{-en-}} =',
    '{{прил en |слоги=taxable}}',
    '==== Значение ====',
    '# [[облагаемый налогом]]; [[подлежащий налогообложению]]',
    '# ',
  ].join('\n');
  assert.deepEqual(russianMeanings(page), [
    { pos: 'adj', word: 'облагаемый налогом' },
  ]);
});
