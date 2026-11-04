import { attestRussian } from './russian-fixture.mjs';
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { russianEntry } from '../../formal-ai/src/russian-entry.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { rncFixture } from './rnc-fixture.mjs';

const table = (cells) => ({ forms: new Map(Object.entries(cells)) });

test('a declension table without a gender tag shows the gender by its forms', () => {
  const feminine = russianEntry(
    'noun',
    'Великобритания',
    table({ 'nom|s': 'Великобритания', 'ins|s': 'Великобританией' })
  );
  assert.equal(feminine.gender, 'f');
  const soft = russianEntry(
    'noun',
    'тетрадь',
    table({ 'nom|s': 'тетрадь', 'ins|s': 'тетрадью' })
  );
  assert.equal(soft.gender, 'f');
  const masculine = russianEntry(
    'noun',
    'словарь',
    table({ 'nom|s': 'словарь', 'ins|s': 'словарём' })
  );
  assert.equal(masculine.gender, 'm');
  const neuter = russianEntry(
    'noun',
    'окно',
    table({ 'nom|s': 'окно', 'ins|s': 'окном' })
  );
  assert.equal(neuter.gender, 'n');
});

// "china" (lowercase) is porcelain and slang for a mate; "China" names
// the country on its own capitalized page.
const section = (pos, gloss, ru) =>
  `===${pos}===\n# ${gloss}\n{{trans-top|${gloss}}}\n* Russian: {{t|ru|${ru}}}\n{{trans-bottom}}`;
const wiki = attestRussian({
  china: `==English==\n${section('Noun', 'mate', 'пара')}\n${section('Noun', 'porcelain', 'фарфор')}`,
  China: `==English==\n${section('Proper noun', 'country in East Asia', 'Китай')}`,
  large: `==English==\n${section('Adjective', 'big', 'большой')}`,
  // a proper noun of its own, as Russian Wiktionary heads it
  Китай: '==Russian==\n===Proper noun===\n# Fixture lexical entry.',
});

test('a capitalized word prefers the senses of its capitalized page', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('China is large. We sell china.', {
    lexicon,
    cache: false,
    fetchImpl: (url) => {
      const params = new URL(url).searchParams;
      const corpus = rncFixture(params);
      if (corpus) {
        return Promise.resolve(corpus);
      }
      const pages = (params.get('titles') || '').split('|').map((title) =>
        wiki[title]
          ? {
              title,
              revisions: [{ slots: { main: { content: wiki[title] } } }],
            }
          : { title, missing: true }
      );
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ query: { pages }, search: [], entities: {} }),
      });
    },
  });
  const capital = translateDocument('China is large.', { lexicon }).text;
  assert.match(capital, /^Китай /);
  const lower = translateDocument('We sell china.', { lexicon }).text;
  assert.doesNotMatch(lower, /Китай/);
});
