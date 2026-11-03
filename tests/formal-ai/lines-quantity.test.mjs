/** Offline dictionary forms exercise fragments and degree through the pipeline. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { analyze } from '../../formal-ai/src/english/analyze.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';

const vocabulary = {
  earn: ['Verb', 'зарабатывать'],
  list: ['Verb', 'размещать'],
  item: ['Noun', 'товар', 'm'],
  buyer: ['Noun', 'покупатель', 'm-an'],
  payout: ['Noun', 'выплата', 'f'],
  minimum: ['Adjective', 'минимальный'],
  weekly: ['Adjective', 'еженедельный'],
  competition: ['Noun', 'конкуренция', 'f'],
  barrier: ['Noun', 'барьер', 'm'],
  high: ['Adjective', 'высокий'],
  low: ['Adjective', 'низкий'],
  applicable: ['Adjective', 'применимый'],
  expensive: ['Adjective', 'дорогой'],
  quickly: ['Adverb', 'быстро'],
};
const pages = Object.fromEntries(
  Object.entries(vocabulary).map(([word, [pos, ru, gender = '']]) => [
    word,
    `==English==\n===${pos}===\n# Fixture.\n{{trans-top|fixture}}\n* Russian: {{t|ru|${ru}|${gender}}}\n{{trans-bottom}}`,
  ])
);
pages.дорогой = '==Russian==\n===Adjective===\n{{ru-adj|дорогой}}';
pages.быстро = '==Russian==\n===Adverb===\n{{ru-adv|быстро}}';
pages.размещать = '==Russian==\n===Verb===\n{{ru-verb|размеща́ть|impf}}';
pages.low +=
  '\n===Verb===\n# To moo.\n{{trans-top|moo}}\n* Russian: {{t|ru|мычать}}\n{{trans-bottom}}';
pages.rate =
  '==English==\n===Noun===\n{{trans-top|amount value}}{{multitrans|data=\n* Russian: {{t|ru|пропорция|f}}\n{{trans-bottom}}\n}}\n{{trans-top|fee}}\n* Russian: {{t|ru|ставка|f}}\n{{trans-bottom}}';
pages.fee =
  '==English==\n===Noun===\n{{trans-top|fee}}\n* Russian: {{t|ru|гонорар|m}}\n{{trans-bottom}}';
pages.list = pages.list.replace(
  '}}\n* Russian:',
  '}}{{multitrans|data=\n* Russian:'
);
const fetchImpl = (url, options) => {
  assert.equal(options.headers['user-agent'], USER_AGENT);
  const p = options.body
    ? new URLSearchParams(options.body)
    : new URL(url).searchParams;
  let body = {};
  if (p.has('titles')) {
    body = {
      query: {
        pages: p
          .get('titles')
          .split('|')
          .map((title) =>
            pages[title]
              ? {
                  title,
                  revisions: [{ slots: { main: { content: pages[title] } } }],
                }
              : { title, missing: true }
          ),
      },
    };
  } else if (p.get('action') === 'parse') {
    const form = p.get('title') === 'дорогой' ? 'дороже' : 'быстрее';
    body = {
      parse: {
        text:
          p.get('title') === 'размещать'
            ? '<span class="Cyrl form-of lang-ru pres|adv|part-form-of">размещая</span>'
            : `<span class="Cyrl form-of lang-ru comd-form-of">${form}</span>`,
      },
    };
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};

test('noun fragments, labels and quantity degrees retain their grammar', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('The book is more expensive. You work more quickly.', {
    words: Object.keys(vocabulary),
    lexicon,
    cache: false,
    fetchImpl,
  });
  await resolveText('The book is more expensive. You work more quickly.', {
    lexicon,
    cache: false,
    fetchImpl,
  });
  lexicon.get('open').ru.perfective.pastPassive = 'открытый';
  for (const [en, expected] of [
    [
      'Earn more by listing more items.',
      'Зарабатывайте больше, размещая больше товаров.',
    ],
    ['Book: $1', 'Книга: $1'],
    ['Weekly payouts via PayPal', 'Еженедельные выплаты через PayPal'],
    ['High competition, low barrier', 'Высокая конкуренция, низкий барьер'],
    ['High competition, low barrier.', 'Высокая конкуренция, низкий барьер.'],
    ['Minimum payout: $1', 'Минимальная выплата: $1'],
    ['Not applicable;', 'Не применимо;'],
    ['Not opened: books, houses.', 'Не открыты: книги, дома.'],
    [
      'Not opened: books, houses and others.',
      'Не открыты: книги, дома и другие.',
    ],
    ['Not opened: the book.', 'Не открыта: книга.'],
    ['Earn more.', 'Зарабатывайте больше.'],
    ['Earn less.', 'Зарабатывайте меньше.'],
    ['You earn more than I.', 'Вы зарабатываете больше, чем я.'],
    [
      'Weekly payouts\nMinimum payout: $1',
      'Еженедельные выплаты\nМинимальная выплата: $1',
    ],
    ['More buyers', 'Больше покупателей'],
    ['Fewer buyers', 'Меньше покупателей'],
    ['More than $10', 'Более $10'],
    ['Less than $10', 'Менее $10'],
    ['More than ₹1,00,000', 'Более ₹100 000'],
    ['₹10 weekly payouts', '₹10 еженедельных выплат'],
    ['Most buyers', 'Большинство покупателей'],
    ['More expensive books', 'Более дорогие книги'],
    ['The most expensive books', 'Самые дорогие книги'],
    ['The least expensive books', 'Наименее дорогие книги'],
    ['The book is more expensive.', 'Книга дороже.'],
    ['The book is less expensive.', 'Книга менее дорогая.'],
    ['You work more quickly.', 'Вы работаете быстрее.'],
    ['You work less quickly.', 'Вы работаете менее быстро.'],
  ]) {
    const result = translateDocument(en, { lexicon });
    assert.equal(result.text, expected, en);
    assert.equal(result.stats.incomplete, 0, en);
  }
  assert.equal(
    lexicon.get(lexicon.lookup('adj', 'expensive')[0]).ru.comparative,
    'дороже'
  );
});

test('capitalised grammar and guessed document names retain lexical readings', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    lexicon,
    words: Object.keys(vocabulary),
    cache: false,
    fetchImpl,
  });
  lexicon.setDocumentNames(new Set(['Minimum', 'High', 'Not']));
  assert.ok(
    analyze('Minimum payout', lexicon)[0].readings.some((r) => r.pos === 'adj')
  );
  assert.deepEqual(
    analyze('Not covered', lexicon)[0].readings.map((r) => r.pos),
    ['neg']
  );
});

test('wrapped translation tables retain translations and cross references', () => {
  const [entry] = englishEntries(
    '==English==\n===Verb===\n# To enumerate.\n{{trans-top-see|enumerate|enumerate}}{{multitrans|data=\n* Russian: {{t|ru|перечислять}}\n{{trans-bottom}}\n}}'
  );
  assert.equal(entry.senses[0].russian[0].word, 'перечислять');
  const [reference] = englishEntries(
    '==English==\n===Verb===\n# To enumerate.\n{{trans-top-see|enumerate|enumerate}}{{multitrans|data=\n* French: x\n{{trans-bottom}}\n}}'
  );
  assert.equal(reference.see[0].page, 'enumerate');
});

test('queried but unresolved capitals still reach Wikidata', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const searches = [];
  await resolveText('Armenia', {
    lexicon,
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const p = new URL(url).searchParams;
      if (p.get('action') === 'wbsearchentities') {
        searches.push(p.get('search'));
      }
      return fetchImpl(url, options);
    },
  });
  assert.ok(searches.includes('Armenia'));
});

test('numeric tokens do not swamp an explicit lexical cue with invented amount/value matches', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    lexicon,
    words: ['rate', 'fee'],
    cache: false,
    fetchImpl,
  });
  assert.match(
    translateDocument('Rates: $10; fee: $1', { lexicon }).text,
    /^Ставки:/
  );
});
