/** Public derivation and Russian government, exercised without network access. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';
import { naturalizeRussian } from '../../formal-ai/src/russian/naturalize.mjs';
import {
  learnActionNouns,
  actionNounOf,
} from '../../formal-ai/src/sources/action-nouns.mjs';
import { verbGovernment } from '../../formal-ai/src/sources/government.mjs';
import { compactWikitext } from '../../formal-ai/src/sources/compact.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const pages = {
  track:
    '==English==\n===Verb===\n# To monitor progress.\n{{trans-top|monitor progress}}\n* Russian: {{t|ru|отслеживать|impf}}\n{{trans-bottom}}',
  отслеживать: '==Russian==\n===Verb===\n{{ru-verb|отслеживать|impf}}',
  отслеживание:
    '= {{-ru-}} =\n==== Значение ====\n# {{действие|отслеживать}} {{пример|}}',

  enjoy:
    '==English==\n===Verb===\n# To take pleasure in.\n{{trans-top|take pleasure in}}\n* Russian: {{t|ru|наслаждаться|impf}}\n{{trans-bottom}}',
  template:
    '==English==\n===Noun===\n# A pattern.\n{{trans-top|pattern}}\n* Russian: {{t|ru|шаблон|m}}\n{{trans-bottom}}',
  шаблон: '==Russian==\n===Noun===\n{{ru-noun|шаблон|m}}',
  reading:
    '==English==\n===Noun===\n# The action of reading.\n{{trans-top|action of reading}}\n* Russian: {{t|ru|чтение|n}}\n{{trans-bottom}}',
  наслаждаться:
    '==Russian==\n===Verb===\n{{ru-verb|наслаждаться|impf}}\n# to [[enjoy]]',
  читать:
    '==Russian==\n===Verb===\n{{ru-verb|читать|impf}}\n====Derived terms====\n{{der3|ru|чте́ние|читатель}}',
  чтение:
    '==Russian==\n===Noun===\n{{ru-noun|чтение|n}}\n# {{verbal noun of|ru|читать}}',
  читатель: '==Russian==\n===Noun===\n# A reader of books.',
  продавать: '==Russian==\n===Verb===\n====Derived terms====\n* [[продажа]]',
  продажа:
    '= {{-ru-}} =\n=== Значение ===\n# действие по значению глагола [[продавать]]',
};
const enjoyment =
  '= {{-ru-}} =\n==== Значение ====\n# испытывать сильнейшее [[удовольствие]] {{пример|Девушка продолжила {{выдел|наслаждаться}} своей любимой музыкой.|и=GB}}';
function api(url, options) {
  assert.equal(options.headers['user-agent'], USER_AGENT);
  const p =
    options.method === 'POST'
      ? new URLSearchParams(options.body)
      : new URL(url).searchParams;
  const source =
    new URL(url).host === 'ru.wiktionary.org'
      ? { ...pages, наслаждаться: enjoyment }
      : pages;
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        query: {
          pages: (p.get('titles') || '').split('|').map((title) => ({
            title,
            ...(source[title]
              ? {
                  revisions: [{ slots: { main: { content: source[title] } } }],
                }
              : { missing: true }),
          })),
        },
      }),
  });
}
const render = (text, lexicon) => {
  const f = formalize(text, lexicon);
  assert.deepEqual(f.unknown, []);
  assert.deepEqual(f.leftover, []);
  return naturalizeRussian(f, lexicon).text;
};

test('derivations require a noun definition linking the exact source verb', () => {
  assert.ok(actionNounOf(pages['чтение'], 'читать'));
  assert.ok(actionNounOf(pages['продажа'], 'продавать'));
  assert.equal(actionNounOf(pages['читатель'], 'читать'), false);
  assert.equal(actionNounOf(pages['чтение'], 'продавать'), false);
});

test('public action nouns decline and put transitive objects in the genitive', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    words: ['enjoy', 'reading', 'template', 'track'],
    lexicon,
    cache: false,
    fetchImpl: api,
  });
  await learnActionNouns(
    'I enjoy reading books. Selling books takes time. I work without tracking.',
    lexicon,
    { cache: false, fetchImpl: api }
  );
  assert.equal(lexicon.get('read').ru.actionNoun.lemma, 'чтение');
  assert.equal(lexicon.get('sell').ru.actionNoun.lemma, 'продажа');
  assert.equal(
    render('I work without tracking.', lexicon),
    'Я работаю без отслеживания.'
  );
  assert.match(
    render('Selling templates takes time.', lexicon),
    /^Продажа шаблонов /
  );
  assert.equal(
    render('I enjoy reading books.', lexicon),
    'Я наслаждаюсь чтением книг.'
  );
  assert.equal(
    render('I think about reading books.', lexicon),
    'Я думаю о чтении книг.'
  );
  assert.equal(
    render('Reading books is easy.', lexicon),
    'Чтение книг лёгкое.'
  );
  assert.equal(
    render('I like reading books.', lexicon),
    'Мне нравится читать книги.'
  );
  assert.equal(
    render('I work without reading books.', lexicon),
    'Я работаю без чтения книг.'
  );
  assert.equal(
    render('I liked selling books.', lexicon),
    'Мне нравилось продавать книги.'
  );
  lexicon.get('read').ru.converb = 'читая';
  assert.equal(
    render('I work while reading books.', lexicon),
    'Я работаю, читая книги.'
  );
  lexicon.get('sell').ru.converb = 'продавая';
  assert.equal(
    render('I work by selling books.', lexicon),
    'Я работаю, продавая книги.'
  );
});

test('Russian infinitive government outranks the available action noun', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await learnActionNouns('reading books', lexicon, {
    cache: false,
    fetchImpl: api,
  });
  const ru = lexicon.get('love').ru;
  Object.assign(
    ru,
    verbGovernment(
      '==Russian==\n===Verb===\n# {{+obj|ru|acc|or|inf}} to [[love]]',
      '',
      { lemma: 'love' }
    )
  );
  assert.equal(ru.infinitiveComplement, true);
  assert.equal(
    render('I love reading books.', lexicon),
    'Я люблю читать книги.'
  );
});

test('dictionary government examples survive response compaction', () => {
  const compacted = compactWikitext(enjoyment);
  assert.equal(
    verbGovernment('', enjoyment, { lemma: 'enjoy' }).government.case,
    'ins'
  );
  assert.equal(
    verbGovernment('', compacted, { lemma: 'enjoy' }).government.case,
    'ins'
  );
  assert.equal(
    verbGovernment(
      '',
      '= {{-ru-}} =\n# {{пример|{{выдел|читать}} своей любимой сестре книгу.}}',
      { lemma: 'read' }
    ).government,
    undefined
  );
});

test('productive candidates need public derivation evidence; explicit vn needs no guess', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const publicPages = {
    читать: '==Russian==\n===Verb===\n{{ru-verb|чита́ть|impf|vn=чте́ние}}',
  };
  await learnActionNouns('reading books', lexicon, {
    cache: false,
    fetchImpl: (url, options) => {
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : new URL(url).searchParams;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: (p.get('titles') || '').split('|').map((title) => ({
                title,
                revisions: [
                  { slots: { main: { content: publicPages[title] || '' } } },
                ],
              })),
            },
          }),
      });
    },
  });
  assert.equal(lexicon.get('read').ru.actionNoun.lemma, 'чтение');
  assert.ok(!lexicon.get('read').ru.actionNoun.lemma.includes('́'));
});
