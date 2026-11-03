/** Offline dictionary and corpus fixtures for business senses and polar clauses. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { DocumentMemory } from '../../formal-ai/src/senses.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { contextFrequencies } from '../../formal-ai/src/sources/context-frequency.mjs';
import { borrowGenus } from '../../formal-ai/src/sources/sense-data.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

function add(lexicon, id, word, pos, ru, extra = {}) {
  lexicon.add({
    id,
    en: [{ pos, lemma: word, words: [word], ...extra.en }],
    ru: { pos, lemma: ru, ...extra.ru },
    classes: [],
    cues: [],
    ...Object.fromEntries(
      Object.entries(extra).filter(([key]) => !['en', 'ru'].includes(key))
    ),
  });
}

test('topic stems align royalties/royalty and sales/sale without treating a word as its own evidence', () => {
  const memory = new DocumentMemory();
  memory.setTopic(
    'Authors earn royalties from sales. A royalty is a payment for a sale.'
  );
  assert.ok(memory.topicWeight('sale', 'royalties') > 0);
  assert.equal(memory.topicWeight('sale', 'sales'), 0);
  assert.equal(memory.topicWeight('tracks', 'track'), 0);
  memory.setField('royalties payment. royalty payment. royalties payment.');
  assert.equal(
    memory.fieldWeight('payment', 'royalty'),
    memory.fieldWeight('payment', 'royalties')
  );
});

test('a missing translation inherits a sibling payment sense, retaining its definition', () => {
  const senses = borrowGenus([
    {
      definition: 'The payment for mineral rights.',
      russian: [{ word: 'роялти' }],
    },
    {
      definition: 'A payment to an author for intellectual property.',
      russian: [],
    },
    { definition: 'The rank of a monarch.', russian: [] },
  ]);
  assert.equal(senses[1].russian[0].word, 'роялти');
  assert.equal(senses[1].borrowed, true);
  assert.match(senses[1].definition, /author/);
  assert.deepEqual(senses[2].russian, []);
});

test('a parent sense does not inherit the complement frames of every nested sense', () => {
  const [entry] = englishEntries(
    `==English==\n===Verb===\n# To request or petition.\n## To request an answer to a question.\n##: {{ux|en|They '''ask''' whether it works.}}\n{{trans-top|make a request}}\n* Russian: {{t|ru|просить}}\n{{trans-bottom}}`
  );
  assert.ok(!entry.senses[0].frames?.includes('question'));
});

test('stubbed corpus pairs disambiguate passive subjects and infinitive objects', async () => {
  const lexicon = loadLexicon({ fresh: true });
  add(lexicon, 'fixture.set.put', 'set', 'verb', 'класть', {
    en: { past: 'set', participle: 'set' },
    frames: ['transitive'],
  });
  add(lexicon, 'fixture.set.establish', 'set', 'verb', 'устанавливать', {
    en: { past: 'set', participle: 'set' },
    frames: ['transitive'],
  });
  add(lexicon, 'fixture.track.hunt', 'track', 'verb', 'выслеживать');
  add(lexicon, 'fixture.track.observe', 'track', 'verb', 'отслеживать');
  add(lexicon, 'fixture.app', 'app', 'noun', 'приложение', {
    ru: { gender: 'n' },
  });
  add(lexicon, 'fixture.sale', 'sale', 'noun', 'продажа', {
    ru: { gender: 'f' },
    en: { plural: 'sales' },
  });
  add(lexicon, 'fixture.weekly', 'weekly', 'adv', 'еженедельно');
  const requests = [];
  await contextFrequencies(
    'Prices are set weekly. Use the app to track sales.',
    lexicon,
    {
      cache: false,
      fetchImpl: (url, options) => {
        assert.equal(options.headers['user-agent'], USER_AGENT);
        const query = new URL(url).searchParams.get('srsearch');
        requests.push(query);
        const count = /устанавливать|отслеживать/.test(query) ? 100 : 1;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ query: { searchinfo: { totalhits: count } } }),
        });
      },
    }
  );
  assert.ok(requests.includes('"устанавливать" "цена"'));
  assert.ok(requests.includes('"отслеживать" "продажа"'));
  let uncertainRequests = 0;
  await contextFrequencies('Use the qxzzyy to track sales.', lexicon, {
    cache: false,
    fetchImpl: () => {
      uncertainRequests += 1;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    },
  });
  assert.equal(
    uncertainRequests,
    0,
    'Unknown input must not trigger corpus requests'
  );
  assert.equal(
    translateDocument('Prices are set weekly.', { lexicon }).text,
    'Цены устанавливаются еженедельно.'
  );
  assert.match(
    translateDocument('Use the app to track sales.', { lexicon }).text,
    /отслеживать продажи/
  );
});

test('whether and interrogative if produce verb-first ли; conditional if remains conditional', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.get('ask').frames = ['question'];
  add(lexicon, 'fixture.seller', 'seller', 'noun', 'продавец', {
    ru: { gender: 'm', animate: true, stem: 'продавц' },
  });
  add(lexicon, 'fixture.abroad', 'abroad', 'adv', 'за границей', {
    ru: { direction: 'за границу' },
  });
  add(lexicon, 'fixture.item', 'item', 'noun', 'товар', {
    ru: { gender: 'm' },
  });
  add(lexicon, 'fixture.ship', 'ship', 'verb', 'отправляться', {
    ru: { motion: true },
  });
  add(lexicon, 'fixture.ship.noun', 'ship', 'noun', 'корабль');
  for (const link of ['whether', 'if']) {
    assert.equal(
      translateDocument(`Ask the seller ${link} the item ships abroad.`, {
        lexicon,
      }).text,
      'Спросите продавца, отправляется ли товар за границу.'
    );
  }
  assert.match(
    translateDocument('If you work, you earn money.', { lexicon }).text,
    /^Если /
  );
  assert.match(
    translateDocument('Ask whether they will work.', { lexicon }).text,
    /будут ли работать они/
  );
  assert.match(
    translateDocument('Ask whether prices are high.', { lexicon }).text,
    /ли цены/
  );
});
