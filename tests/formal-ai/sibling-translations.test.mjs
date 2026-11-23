/** A sense borrows a sibling's translation that names the lemma and its gloss. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translationSenses } from '../../formal-ai/src/sources/translation-senses.mjs';

const russian = (definitions) =>
  `==Russian==\n===Verb===\n${definitions.map((d) => `# ${d}`).join('\n')}\n`;
const pages = new Map([
  ['надеяться', russian(['to [[hope]]', 'to [[rely]]'])],
  ['ожидать', russian(['to [[expect]], to [[anticipate]]'])],
  ['требовать', russian(['to [[demand]], to [[require]]'])],
]);
const plan = {
  pos: 'verb',
  lemma: 'expect',
  senses: [
    {
      gloss: 'to look for, look forward to, anticipate',
      russian: [{ word: 'надеяться' }],
    },
    { gloss: 'to consider obligatory', russian: [{ word: 'ожидать' }] },
  ],
};

test('a sense without an attested translation borrows a sibling one', () => {
  const senses = translationSenses(plan, pages);
  assert.deepEqual(
    senses[0].russian.map((c) => c.word),
    ['ожидать', 'надеяться']
  );
  assert.deepEqual(
    senses[1].russian.map((c) => c.word),
    ['ожидать']
  );
});

test('a sibling translation must share a word with the gloss', () => {
  const other = {
    ...plan,
    senses: [
      { gloss: 'to wish for something', russian: [{ word: 'надеяться' }] },
      plan.senses[1],
    ],
  };
  assert.deepEqual(
    translationSenses(other, pages)[0].russian.map((c) => c.word),
    ['надеяться']
  );
});
