/** Name ranking and declension use public entity evidence, offline. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveNames } from '../../formal-ai/src/name-resolution.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { declineNoun } from '../../formal-ai/src/russian/morphology.mjs';
import { analyze } from '../../formal-ai/src/english/analyze.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const claim = (id) => ({ mainsnak: { datavalue: { value: { id } } } });
const entity = (name, ru, description, popularity, type) => ({
  labels: { en: { value: name }, ru: { value: ru } },
  descriptions: { en: { value: description } },
  claims: { P31: type ? [claim(type)] : [] },
  sitelinks: Object.fromEntries(
    Array.from({ length: popularity }, (_, i) => [i, {}])
  ),
});
function api(entities) {
  return {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const p = new URL(url).searchParams;
      let body = {};
      if (p.get('action') === 'wbsearchentities') {
        body = {
          search: Object.entries(entities)
            .filter(([, e]) => e.labels.en.value === p.get('search'))
            .map(([id, e]) => ({ id, label: e.labels.en.value })),
        };
      } else if (p.get('action') === 'wbgetentities') {
        body = {
          entities: Object.fromEntries(
            p
              .get('ids')
              .split('|')
              .map((id) => [id, entities[id]])
          ),
        };
      } else if (p.get('titles')) {
        body = {
          query: {
            pages: p
              .get('titles')
              .split('|')
              .map((title) => ({ title, missing: true })),
          },
        };
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}

test('weak mixed-document overlap cannot outweigh a much more popular exact alias', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const hits = await resolveNames(['UK'], {
    lexicon,
    topic:
      'In the UK banks offer bonuses. Elsewhere university research and education grow.',
    ...api({
      Qcountry: {
        ...entity('UK', 'Великобритания', 'country in Europe', 300),
        claims: { P297: [claim('GB')] },
      },
      Qschool: entity(
        'UK',
        'Кентуккийский университет',
        'research university education',
        10
      ),
    }),
  });
  assert.equal(hits.get('UK'), 'Qcountry');
  assert.equal(declineNoun(lexicon.nameEntry('UK'), 'prep'), 'Великобритании');
});

test('acronym expansion needs nearby description/type evidence, not a distant topic or alias', async () => {
  for (const [topic, expected] of [
    [
      `CASS switch bonuses. ${'Bank payments. '.repeat(40)}Chinese academy research.`,
      'CASS',
    ],
    ['CASS academy research.', 'Академия наук'],
    ['CASS switch bonuses.', 'CASS'],
  ]) {
    const lexicon = loadLexicon({ fresh: true });
    await resolveNames(['CASS'], {
      lexicon,
      topic,
      ...api({
        Qa: entity('CASS', 'Академия наук', 'Chinese research academy', 100),
      }),
    });
    assert.equal(lexicon.nameLabel('CASS'), expected);
  }
});

test('commercial entity evidence beats surname/given name and dictionary transliteration at sentence start', async () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.setNameLabel('Wise', 'Уайз');
  lexicon.setNameEntry('Wise', {
    pos: 'noun',
    lemma: 'Уайз',
    gender: 'm',
    regular: true,
  });
  lexicon.givenNames = new Set(['Wise']);
  await resolveNames(['Wise'], {
    lexicon,
    topic: 'Wise payments and bank accounts.',
    givenOnly: new Set(['Wise']),
    ...api({
      Qsurname: entity('Wise', 'Уайз', 'family name', 50, 'Q101352'),
      Qcompany: entity(
        'Wise',
        'Wise',
        'bank payments company',
        10,
        'QcompanyType'
      ),
    }),
  });
  assert.equal(lexicon.nameLabel('Wise'), 'Wise');
  assert.equal(lexicon.givenNames.has('Wise'), false);
  assert.equal(lexicon.nameEntry('Wise'), undefined);
  assert.equal(
    analyze('Wise pays developers.', lexicon)[0].readings[0].pos,
    'propn'
  );
});

test('Cyrillic multiword labels decline their adjective and head, preserving a genitive tail', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveNames(['Example'], {
    lexicon,
    topic: 'Example university.',
    ...api({
      Qe: entity('Example', 'Кентуккийский университет', 'university', 10),
    }),
  });
  assert.equal(
    declineNoun(lexicon.nameEntry('Example'), 'prep'),
    'Кентуккийском университете'
  );
});

test('a popular company alias outranks an exact album title in commercial text', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const company = entity('Apple Inc.', 'Apple', 'technology company', 300);
  company.aliases = { en: [{ value: 'Apple' }] };
  const data = {
    Qalbum: entity('Apple', 'Эпл', 'studio album', 12),
    Qcompany: company,
  };
  const options = api(data);
  const fetchImpl = options.fetchImpl;
  options.fetchImpl = (url, init) =>
    new URL(url).searchParams.get('action') === 'wbsearchentities'
      ? Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              search: [
                { id: 'Qalbum', label: 'Apple' },
                {
                  id: 'Qcompany',
                  label: 'Apple Inc.',
                  match: { text: 'Apple' },
                },
              ],
            }),
        })
      : fetchImpl(url, init);
  // A dictionary's company sense must not transliterate the brand.
  lexicon.add({
    id: 'fixture:apple',
    en: [{ pos: 'noun', words: ['apple'] }],
    ru: { pos: 'noun', lemma: 'Эпл', gender: 'm', regular: true },
  });
  await resolveText('Apple pays developers.', {
    lexicon,
    words: [],
    ...options,
  });
  assert.equal(lexicon.nameLabel('Apple'), 'Apple');
  assert.equal(
    analyze('Apple pays developers.', lexicon)[0].readings[0].pos,
    'propn'
  );
});

test('an unpopular Cyrillic acronym still requires topic evidence', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveNames(['XYZ'], {
    lexicon,
    topic: 'XYZ payment bonuses.',
    ...api({ Qparty: entity('XYZ', 'АБВ', 'political party', 20) }),
  });
  assert.equal(lexicon.nameLabel('XYZ'), 'XYZ');
});

test('a descriptive Russian label containing the unchanged Latin brand keeps the brand alone', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveNames(['Example'], {
    lexicon,
    topic: 'Example software payments.',
    ...api({
      Qe: entity('Example', 'программа Example', 'software product', 100),
    }),
  });
  assert.equal(lexicon.nameLabel('Example'), 'Example');
});
