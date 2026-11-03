/* eslint-disable require-await -- Offline fetch fixtures implement the async Fetch interface. */
/** Nonfinite grammar is tested with bundled words and offline Wiktionary replies. */
import { rncFixture } from './rnc-fixture.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';
import { naturalizeRussian } from '../../formal-ai/src/russian/naturalize.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { completeForms } from '../../formal-ai/src/forms.mjs';

const vocabulary = {
  win: ['Verb', 'выигрывать'],
  reading: ['Noun', 'чтение', 'n'],
  require: ['Verb', 'требовать'],
  luck: ['Noun', 'удача', 'f'],
  recruit: ['Verb', 'набирать'],
  streamer: ['Noun', 'стример', 'm-an'],
  print: ['Noun', 'принт', 'm'],
  link: ['Verb', 'связывать'],
  support: ['Verb', 'поддерживать'],
  enter: ['Verb', 'вводить'],
  payout: ['Noun', 'выплата', 'f'],
  withdrawal: ['Noun', 'вывод', 'm'],
};

/** Only these English pages exist; Russian entries fall back to regular forms. */
async function dictionaryFetch(url) {
  const params = new URL(url).searchParams;
  const corpus = rncFixture(params);
  if (corpus) {
    return corpus;
  }
  assert.equal(params.get('action'), 'query');
  if (params.get('list') === 'search') {
    assert.equal(new URL(url).host, 'ru.wikipedia.org');
    return {
      ok: true,
      json: async () => ({ query: { searchinfo: { totalhits: 0 } } }),
    };
  }
  const pages = params
    .get('titles')
    .split('|')
    .map((title) => {
      const entry = vocabulary[title];
      if (!entry) {
        return { title, missing: true };
      }
      const [pos, ru, gender = ''] = entry;
      const content = `==English==\n===${pos}===\n# A test sense.\n====Translations====\n{{trans-top|test sense}}\n* Russian: {{t|ru|${ru}|${gender}}}\n{{trans-bottom}}`;
      return { title, revisions: [{ slots: { main: { content } } }] };
    });
  return { ok: true, json: async () => ({ query: { pages } }) };
}

let learnedLexicon;
async function fixture() {
  if (learnedLexicon) {
    return learnedLexicon;
  }
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    lexicon,
    words: Object.keys(vocabulary),
    fetchImpl: dictionaryFetch,
    cache: false,
  });
  // These are Russian morphology fixtures, never fetched from the network.
  lexicon.get('send').ru.perfective.pastPassive = 'отправленный';
  lexicon.get('open').ru.perfective.pastPassive = 'открытый';
  for (const [lemma, form] of [
    ['link', 'связанный'],
    ['support', 'поддержанный'],
    ['enter', 'введённый'],
  ]) {
    lexicon.get(lexicon.lookup('verb', lemma)[0]).ru.pastPassive = form;
  }
  learnedLexicon = lexicon;
  return lexicon;
}

function translation(text, lexicon) {
  const formal = formalize(text, lexicon);
  assert.deepEqual(formal.unknown, [], text);
  assert.deepEqual(formal.leftover, [], text);
  const russian = naturalizeRussian(formal, lexicon).text;
  assert.ok(!russian.includes('['), russian);
  return { formal, russian };
}

test('gerund subjects contain an action with its objects, not a finite verb', async () => {
  const lexicon = await fixture();
  for (const [text, lemma] of [
    ['Winning requires luck.', 'win'],
    ['Recruiting streamers takes time.', 'recruit'],
    ['Selling prints is easy.', 'sell'],
  ]) {
    const { formal, russian } = translation(text, lexicon);
    const subject = formal.statements[0].subject;
    assert.equal(subject.number, 'singular');
    assert.equal(subject.action.predicate, lexicon.lookup('verb', lemma)[0]);
    if (lemma !== 'win') {
      assert.equal(subject.action.objects.length, 1);
    }
    if (lemma === 'sell') {
      assert.equal(russian, 'Продавать принты легко.');
    }
  }
});

test('gerunds work as direct objects and prepositional objects', async () => {
  const lexicon = await fixture();
  assert.equal(
    translation('I like reading books.', lexicon).russian,
    'Мне нравится читать книги.'
  );
  assert.equal(
    translation('I like selling prints.', lexicon).russian,
    'Мне нравится продавать принты.'
  );
  const { formal, russian } = translation(
    'I think about reading books.',
    lexicon
  );
  assert.equal(russian, 'Я думаю о том, чтобы читать книги.');
  assert.ok(formal.statements[0].objects[0].action);
});

test('a lexical noun for a bare gerund remains available to Russian', async () => {
  const lexicon = await fixture();
  const { formal, russian } = translation('Reading is easy.', lexicon);
  assert.ok(formal.statements[0].subject.action);
  assert.equal(
    formal.statements[0].subject.nominalization.concept,
    lexicon.lookup('noun', 'reading')[0]
  );
  assert.equal(russian, 'Чтение лёгкое.');
});

test('get plus a participle has the same passive features as be', async () => {
  const lexicon = await fixture();
  for (const [get, be] of [
    ['You get paid via Stripe.', 'You are paid via Stripe.'],
    ['You got paid.', 'You were paid.'],
    ['You will get paid.', 'You will be paid.'],
    ['You do not get paid.', 'You are not paid.'],
    ['Do you get paid?', 'Are you paid?'],
    ['You are getting paid.', 'You are being paid.'],
    ['You have got paid.', 'You have been paid.'],
  ]) {
    const actual = translation(get, lexicon);
    const expected = translation(be, lexicon);
    assert.equal(actual.formal.statements[0].voice, 'passive', get);
    assert.equal(actual.russian, expected.russian, get);
  }
  assert.equal(
    translation('You get paid via Stripe.', lexicon).russian,
    'Вам платят через Stripe.'
  );
  assert.equal(
    translation('You get money.', lexicon).formal.statements[0].voice,
    undefined
  );
});

test('prenoun participles agree with gender, number and governed case', async () => {
  const lexicon = await fixture();
  assert.equal(
    translation('a linked PayPal account', lexicon).russian,
    'Связанный счёт PayPal'
  );
  assert.equal(
    translation('supported payout countries', lexicon).russian,
    'Поддержанные страны выплаты'
  );
  assert.equal(
    translation('I have an opened book.', lexicon).russian,
    'У меня есть открытая книга.'
  );
  assert.equal(
    translation('I think about sent letters.', lexicon).russian,
    'Я думаю об отправленных письмах.'
  );
});

test('postnoun participles retain their dependents and leave the matrix verb finite', async () => {
  const lexicon = await fixture();
  const { formal, russian } = translation(
    'a bank account entered at withdrawal time',
    lexicon
  );
  assert.equal(formal.statements[0].entity.participles[0].voice, 'passive');
  assert.equal(formal.statements[0].entity.participles[0].modifiers.length, 1);
  assert.ok(russian.includes('введённый'), russian);
  assert.equal(
    translation('A book sent by John is good.', lexicon).russian,
    'Книга, отправленная Джоном, хорошая.'
  );
  assert.equal(
    translation('I have a book sent by John.', lexicon).russian,
    'У меня есть книга, отправленная Джоном.'
  );
  assert.equal(
    translation('The book opened the door.', lexicon).formal.statements[0]
      .predicate,
    'open'
  );
  assert.equal(
    translation('I am reading books.', lexicon).formal.statements[0].aspect,
    'progressive'
  );
});

test('completeForms also completes an imperfective without an aspect partner', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const verb = lexicon.get('send').ru;
  delete verb.perfective;
  let calls = 0;
  await completeForms('sent', {
    lexicon,
    cache: false,
    fetchImpl: async (url, options) => {
      calls += 1;
      const params =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : new URL(url).searchParams;
      if (params.get('action') === 'parse') {
        return {
          ok: true,
          json: async () => ({
            parse: {
              text: '<span class="Cyrl form-of lang-ru past|pass|part-form-of">посы́ланный</span>',
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          query: {
            pages: [
              {
                title: verb.lemma,
                revisions: [
                  {
                    slots: {
                      main: {
                        content:
                          '==Russian==\n===Verb===\n{{ru-verb|посыла́ть|impf}}\n====Conjugation====\n{{ru-conj|impf|1a|посыла́ть}}',
                      },
                    },
                  },
                ],
              },
            ],
          },
        }),
      };
    },
  });
  assert.equal(calls, 2);
  assert.equal(verb.pastPassive, 'посыланный');
});
