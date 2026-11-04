/** Offline regression fixtures for public lexical gaps and agreement. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import {
  completeCrossPOS,
  completeReverseNouns,
} from '../../formal-ai/src/sources/lexical-gaps.mjs';
import {
  translationSenses,
  translationSyntax,
} from '../../formal-ai/src/sources/translation-senses.mjs';
import { nounObjectContext } from '../../formal-ai/src/sense-context.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

function fixture(pages, search = []) {
  return {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : new URL(url).searchParams;
      const body =
        p.get('list') === 'search'
          ? {
              query: {
                search: search.map((title) => ({ title })),
                searchinfo: { totalhits: 0 },
              },
            }
          : p.get('action') === 'parse'
            ? { parse: { text: '' } }
            : p.get('titles')
              ? {
                  query: {
                    pages: p
                      .get('titles')
                      .split('|')
                      .map((title) =>
                        pages[title]
                          ? {
                              title,
                              revisions: [
                                { slots: { main: { content: pages[title] } } },
                              ],
                            }
                          : { title, missing: true }
                      ),
                  },
                }
              : { search: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}
const en = (pos, word, gloss = 'fixture', marks = '') =>
  `==English==\n===${pos}===\n# ${gloss}\n{{trans-top|${gloss}}}\n* Russian: {{t|ru|${word}|${marks}}}\n{{trans-bottom}}`;
const ru = (pos, template, definition) =>
  `==Russian==\n===${pos}===\n{{ru-${template}}}\n# ${definition}`;

test('missing adverb tables borrow only reverse-attested Russian adverbs from sibling POS', async () => {
  const page = `${en('Adjective', 'онлайн')}\n===Adverb===\n# While online.\n{{trans-top|while online}}\n{{trans-bottom}}`;
  const plans = [
    {
      lemma: 'online',
      pos: 'adv',
      senses: [{ gloss: 'while online', russian: [] }],
    },
  ];
  const entries = new Map([['online', englishEntries(page)]]);
  await completeCrossPOS(
    plans,
    entries,
    fixture({ онлайн: ru('Adverb', 'adv|онлайн', '[[online]]') })
  );
  assert.equal(plans[0].senses[0].russian[0].word, 'онлайн');
  plans[0].senses[0].russian = [];
  await completeCrossPOS(
    plans,
    entries,
    fixture({ онлайн: ru('Noun', 'noun|онлайн|m', '[[online]]') })
  );
  assert.deepEqual(plans[0].senses[0].russian, []);
});

test('reverse plural noun links fill only aligned meanings, excluding quotations and other languages', async () => {
  const senses = [
    {
      gloss: 'elementary building block',
      definition: 'A fundamental piece of knowledge.',
      labels: ['in the plural'],
      russian: [],
    },
    { gloss: 'necessary commodity', russian: [] },
  ];
  const plans = [{ lemma: 'basic', pos: 'noun', senses }];
  const context = {
    words: ['basics'],
    forms: [{ form: 'basics', lemma: 'basic', kind: 'plural', pos: 'noun' }],
  };
  const pages = {
    основа: ru(
      'Noun',
      'noun|основа|f',
      '{{lb|ru|in the plural}} [[fundamental]]s, essential principles, [[basics]]'
    ),
    грамота: ru(
      'Noun',
      'noun|грамота|f',
      'A document.\n#* A quotation mentions [[basics]] and fundamental knowledge.'
    ),
    азбука: '==Belarusian==\n===Noun===\n# [[basics]], fundamental knowledge',
  };
  await completeReverseNouns(
    plans,
    context,
    fixture(pages, Object.keys(pages))
  );
  assert.deepEqual(senses[0].russian, [{ word: 'основа' }]);
  assert.deepEqual(senses[1].russian, []);
});

test('adverb synonyms preserve reverse evidence and parenthetical punctuation', () => {
  const pages = new Map([
    [
      'во-первых',
      ru(
        'Adverb',
        'adv|во-первых',
        "[[first]], [[firstly]]\n#* An introduction: '''во-первых''', an example"
      ),
    ],
    ['сперва', ru('Adverb', 'adv|сперва', '[[first]], [[firstly]]')],
  ]);
  const plan = {
    lemma: 'first',
    pos: 'adv',
    senses: [
      {
        gloss: 'before anything else',
        russian: [{ word: 'во-первых' }, { word: 'сперва' }],
      },
    ],
  };
  const senses = translationSenses(plan, pages);
  assert.equal(senses.length, 2);
  assert.equal(
    translationSyntax(plan, senses[0], { lemma: 'во-первых' }, pages),
    'parenthetical'
  );
  assert.equal(
    translationSyntax(plan, senses[1], { lemma: 'сперва' }, pages),
    null
  );
});

test('whole phrase plural marks survive composition; plural determiners govern mass/plural nouns', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const pages = {
    'social media': en(
      'Noun',
      'социальные медиа',
      'applications or websites',
      'f-p'
    ),
    медиа: ru('Noun', 'noun|медиа|f-in-p|-', '[[media]]'),
    data: `${en('Noun', 'данные', 'information', 'p').replace('# information', '# {{lb|en|uncountable}} information')}\n===Noun===\n# {{plural of|en|datum}}`,
    данные: ru('Noun', 'noun|данные|n-p|-', '[[data]]'),
    show: en('Verb', 'показывать', 'To display something.'),
    показывать: ru('Verb', 'verb|показывать|impf', 'to [[show]]'),
    growth: en('Noun', 'рост', 'growth', 'm'),
    рост: ru('Noun', 'noun|рост|m', '[[growth]]'),
  };
  await resolveText('I use social media. These data show growth.', {
    lexicon,
    ...fixture(pages),
  });
  const phrase = lexicon.get(lexicon.lookup('noun', 'social media')[0]).ru;
  assert.equal(phrase.pluraliaTantum, true);
  assert.equal(
    translateDocument('I use social media.', { lexicon }).text,
    'Я использую социальные медиа.'
  );
  assert.equal(
    translateDocument('These data show growth.', { lexicon }).text,
    'Эти данные показывают рост.'
  );
});

test('noun association uses reliable counts normalized by noun frequency and the actual object role', () => {
  const node = { pos: 'noun' };
  const verb = { pos: 'verb', candidates: ['keep'] };
  const lexicon = {
    get: () => ({
      core: true,
      objectFrequency: { получение: 323, квитанция: 5 },
    }),
  };
  const heads = [{ node: verb, parent: { objects: [{ head: node }] } }];
  const association = (lemma, ruFrequency) =>
    nounObjectContext(node, { ru: { lemma }, ruFrequency }, heads, lexicon);
  assert.ok(association('квитанция', 143) > association('получение', 24281));
  assert.equal(
    nounObjectContext(
      node,
      { ru: { lemma: 'квитанция' }, ruFrequency: 143 },
      [{ node: verb, parent: { subject: { head: node } } }],
      lexicon
    ),
    0
  );
});

test('direct noun objects favor a nonreflexive reading while explicit frames and infinitive complements retain their defaults', async () => {
  const { resolveSenses } = await import('../../formal-ai/src/senses.mjs');
  const lexicon = loadLexicon({ fresh: true });
  const add = (id, lemma, prior, extra = {}) =>
    lexicon.add({
      id,
      gloss: 'acquire knowledge',
      prior,
      ru: {
        pos: 'verb',
        lemma,
        government: { case: lemma.endsWith('ся') ? 'dat' : 'acc' },
      },
      en: [],
      ...extra,
    });
  add('gap.reflexive', 'учиться', 0.3, { infinitiveComplement: true });
  add('gap.secondary', 'учиться', 0.16, {
    infinitiveComplement: true,
    gloss: 'attend educational activity',
  });
  add('gap.transitive', 'изучать', 0.15);
  lexicon.add({
    id: 'gap.object',
    gloss: 'knowledge',
    en: [],
    ru: { pos: 'noun', lemma: 'основа' },
  });
  const parsed = (extra = {}) => ({
    tokens: [
      { index: 0, lower: 'learn', readings: [] },
      { index: 1, lower: 'basics', readings: [] },
    ],
    clauses: [
      {
        type: 'clause',
        verb: {
          pos: 'verb',
          token: 0,
          candidates: ['gap.reflexive', 'gap.secondary', 'gap.transitive'],
        },
        objects: [
          { head: { pos: 'noun', token: 1, candidates: ['gap.object'] } },
        ],
        ...extra,
      },
    ],
  });
  const direct = parsed();
  resolveSenses(direct, lexicon);
  assert.equal(direct.clauses[0].verb.concept, 'gap.transitive');
  const infinitive = parsed({ xcomp: { type: 'clause' } });
  resolveSenses(infinitive, lexicon);
  assert.equal(infinitive.clauses[0].verb.concept, 'gap.reflexive');
  lexicon.get('gap.reflexive').frames = ['transitive'];
  const explicit = parsed();
  resolveSenses(explicit, lexicon);
  assert.equal(explicit.clauses[0].verb.concept, 'gap.reflexive');
});

test('parenthetical adverbs require source punctuation, including punctuation tokens without readings', async () => {
  const { resolveSenses } = await import('../../formal-ai/src/senses.mjs');
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'gap.discourse',
    gloss: 'before anything else',
    syntax: 'parenthetical',
    prior: 0.3,
    en: [],
    ru: { pos: 'adv', lemma: 'во-первых' },
  });
  lexicon.add({
    id: 'gap.temporal',
    gloss: 'before anything else',
    prior: 0.15,
    en: [],
    ru: { pos: 'adv', lemma: 'сперва' },
  });
  for (const [punct, expected] of [
    ['.', 'gap.temporal'],
    [',', 'gap.discourse'],
  ]) {
    const node = {
      pos: 'adv',
      token: 0,
      candidates: ['gap.discourse', 'gap.temporal'],
    };
    const parsed = {
      tokens: [
        { index: 0, lower: 'first', readings: [] },
        { index: 1, lower: punct, text: punct },
      ],
      clauses: [{ type: 'clause', mods: [node] }],
    };
    resolveSenses(parsed, lexicon);
    assert.equal(node.concept, expected);
  }
});
