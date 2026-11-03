import { russianFixture } from './russian-fixture.mjs';
/* eslint-disable require-await -- Offline fixtures implement Fetch. */
import './setup.mjs';
import { rncFixture } from './rnc-fixture.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';
import { naturalizeRussian } from '../../formal-ai/src/russian/naturalize.mjs';
import {
  splitSentences,
  translateDocument,
} from '../../formal-ai/src/document.mjs';

const vocabulary = {
  choose: ['Verb', 'выбирать'],
  product: ['Noun', 'продукт', 'm'],
  platform: ['Noun', 'платформа', 'f'],
  way: ['Noun', 'способ', 'm'],
  fee: ['Noun', 'комиссия', 'f'],
  capital: ['Noun', 'капитал', 'm'],
  minimum: ['Adjective', 'минимальный'],
  monthly: ['Adjective', 'ежемесячный'],
  euro: ['Noun', 'евро', 'n'],
  payout: ['Noun', 'выплата', 'f'],
  weekly: ['Adverb', 'еженедельно'],
  refund: ['Noun', 'возврат', 'm'],
  chargeback: ['Noun', 'возвратный платёж', 'm'],
  cover: ['Verb', 'покрывать'],
  require: ['Verb', 'требовать'],
};
let fixture;
async function lexiconFixture() {
  if (!fixture) {
    fixture = loadLexicon({ fresh: true });
    await resolveText('', {
      lexicon: fixture,
      words: Object.keys(vocabulary),
      cache: false,
      fetchImpl: async (url) => {
        const params = new URL(url).searchParams;
        const corpus = rncFixture(params);
        if (corpus) {
          return corpus;
        }
        if (params.get('list') === 'search') {
          return {
            ok: true,
            json: async () => ({ query: { searchinfo: { totalhits: 0 } } }),
          };
        }
        const pages = params
          .get('titles')
          .split('|')
          .map((title) => {
            if (title === 'евро' && new URL(url).host === 'ru.wiktionary.org') {
              return {
                title,
                revisions: [
                  {
                    slots: {
                      main: { content: '= {{-ru-}} =\n{{сущ ru n ina 0}}' },
                    },
                  },
                ],
              };
            }
            if (!vocabulary[title]) {
              const content = russianFixture(vocabulary, title);
              return content
                ? { title, revisions: [{ slots: { main: { content } } }] }
                : { title, missing: true };
            }
            const [pos, ru, gender = ''] = vocabulary[title];
            const content = `==English==\n===${pos}===\n# Fixture.\n====Translations====\n{{trans-top|fixture}}\n* Russian: {{t|ru|${ru}|${gender}}}\n{{trans-bottom}}`;
            return { title, revisions: [{ slots: { main: { content } } }] };
          });
        return { ok: true, json: async () => ({ query: { pages } }) };
      },
    });
  }
  // Stress alternation is lexical morphology, supplied by the offline fixture.
  fixture.get(fixture.lookup('noun', 'chargeback')[0]).ru.forms = {
    'pl.nom': 'платежи',
  };
  fixture.get(fixture.lookup('verb', 'choose')[0]).ru.perfective = {
    lemma: 'выбрать',
    aspect: 'perf',
    past: ['выбрал', 'выбрала'],
  };
  fixture.addForm('chose', { pos: 'verb', lemma: 'choose', feature: 'past' });
  // A result participle is available, but generic present negatives use the process passive.
  const require = fixture.get(fixture.lookup('verb', 'require')[0]).ru;
  require.perfective = {
    lemma: 'потребовать',
    aspect: 'perf',
    pastPassive: 'потребованный',
  };
  return fixture;
}
async function translate(text) {
  const lexicon = await lexiconFixture();
  const formal = formalize(text, lexicon);
  assert.deepEqual(formal.leftover, [], text);
  assert.deepEqual(formal.unknown, [], text);
  const result = naturalizeRussian(formal, lexicon).text;
  assert.ok(!result.includes('['), result);
  return result;
}

test('object relatives preserve their subjects and Russian case government', async () => {
  for (const [en, ru] of [
    ['the platform they chose', 'Платформа, которую они выбрали'],
    ['the products you sell', 'Продукты, которые вы продаёте'],
    ['the books the children read', 'Книги, которые дети читают'],
    ['the book that I read', 'Книга, которую я читаю'],
    ['the book which I read', 'Книга, которую я читаю'],
    ['everything you need', 'Всё, что вам нужно'],
    ['the man you help', 'Мужчина, которому вы помогаете'],
    ['the man you see', 'Мужчина, которого вы видите'],
    ['the book you need', 'Книга, которая вам нужна'],
    ['the book you think about', 'Книга, о которой вы думаете'],
    ['I have a book that you read.', 'У меня есть книга, которую вы читаете.'],
    ['The book you read is good.', 'Книга, которую вы читаете, хорошая.'],
    ['The book that is good is new.', 'Книга, которая хорошая, новая.'],
  ]) {
    assert.equal(await translate(en), ru, en);
  }
});

test('semicolons, colons and label fragments retain their separators', async () => {
  for (const [en, ru] of [
    ['Books are good; houses are big.', 'Книги хорошие; дома большие.'],
    ['Payout: weekly.', 'Выплата: еженедельно.'],
    [
      'Not covered: refunds, chargebacks.',
      'Не покрываются: возвраты, возвратные платежи.',
    ],
    ['Not covered: refunds, books.', 'Не покрываются: возвраты, книги.'],
    [
      'Payout: weekly; books: new books.',
      'Выплата: еженедельно; книги: новые книги.',
    ],
  ]) {
    assert.equal(await translate(en), ru, en);
  }
  assert.deepEqual(
    splitSentences('Books are good; houses are big. Payout: weekly.'),
    ['Books are good; houses are big.', 'Payout: weekly.']
  );
  const lexicon = await lexiconFixture();
  assert.equal(
    translateDocument('Payout: weekly.', { lexicon }).text,
    'Выплата: еженедельно.'
  );
});

test('document labels reach the same parser as ordinary clauses', async () => {
  const lexicon = await lexiconFixture();
  assert.equal(
    translateDocument('Not covered: refunds, books.', { lexicon }).text,
    'Не покрываются: возвраты, книги.'
  );
});

test('negative fragments and finite negative subjects have distinct government', async () => {
  for (const [en, ru] of [
    ['No minimum capital.', 'Без минимального капитала.'],
    ['No monthly fee.', 'Без ежемесячной комиссии.'],
    ['No capital is required.', 'Капитал не требуется.'],
    ['No books are required.', 'Книги не требуются.'],
    ['There is no book.', 'Нет книги.'],
    ['I have no book.', 'У меня нет книги.'],
  ]) {
    assert.equal(await translate(en), ru, en);
  }
});

test('partitives, bounds, ranges and numeral agreement', async () => {
  for (const [en, ru] of [
    ['3 of 5 platforms', '3 из 5 платформ'],
    ['one of the fastest ways', 'Один из самых быстрых способов'],
    ['up to 10%', 'До 10%'],
    ['at least 2 hours', 'Не менее 2 часов'],
    ['between 5 and 10 euros', 'От 5 до 10 евро'],
    ['2 hours', '2 часа'],
    ['5 hours', '5 часов'],
    ['21 platforms', '21 платформа'],
    ['21 new platforms', '21 новая платформа'],
    ['up to 21 platforms', 'До 21 платформы'],
    ['I have at least 2 books.', 'У меня есть не менее 2 книг.'],
  ]) {
    assert.equal(await translate(en), ru, en);
  }
});
