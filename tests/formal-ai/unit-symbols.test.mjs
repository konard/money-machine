/** Unit symbols after numbers are learned from Wiktionary and Wikidata. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abbreviatedUnits,
  learnUnitSymbols,
  unitSymbolCandidates,
} from '../../formal-ai/src/sources/unit-symbols.mjs';

const pages = {
  h: '==Translingual==\n===Symbol===\n# {{senseid|mul|Q1}} hecto\n# {{senseid|mul|Q2}} hour\n',
  kg: '==Translingual==\n===Symbol===\n# {{SI-unit-abb|kilo|gram|[[mass]]}}\n',
  kilogram:
    '==English==\n===Noun===\n# {{senseid|en|Q3}} The base unit of mass.\n',
};
const symbol = (text) => ({
  P5061: [{ mainsnak: { datavalue: { value: { language: 'ru', text } } } }],
});
const entities = {
  Q1: { labels: { en: { value: 'hecto' } }, claims: {} },
  Q2: { labels: { en: { value: 'hour' } }, claims: symbol('ч') },
  Q3: { labels: { en: { value: 'kilogram' } }, claims: symbol('кг') },
};
const fetchImpl = (url) => {
  const p = new URL(url).searchParams;
  let body;
  if (p.get('action') === 'wbgetentities') {
    const ids = p.get('ids').split('|');
    body = {
      entities: Object.fromEntries(ids.map((id) => [id, entities[id]])),
    };
  } else {
    body = {
      query: {
        pages: p
          .get('titles')
          .split('|')
          .map((title) => ({
            title,
            ...(pages[title]
              ? { revisions: [{ slots: { main: { content: pages[title] } } }] }
              : { missing: true }),
          })),
      },
    };
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};

test('symbols after numbers name their units through public data', async () => {
  const added = [];
  const lexicon = { lookup: () => [], add: (c) => added.push(c) };
  const text = 'It takes 3 h and weighs 5 kg.';
  assert.deepEqual(unitSymbolCandidates(text, lexicon), ['h', 'kg']);
  assert.deepEqual(abbreviatedUnits(pages.kg), ['kilogram']);
  const learned = await learnUnitSymbols(text, lexicon, {
    fetchImpl,
    cache: false,
  });
  assert.deepEqual(learned, ['h', 'kg']);
  // the hecto prefix has no Russian unit symbol, so "h" is the hour
  assert.deepEqual(
    added.map((c) => [c.id, c.ru.lemma]),
    [
      ['unit:Q2', 'ч'],
      ['unit:Q3', 'кг'],
    ]
  );
});
