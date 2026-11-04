/** Offline evidence for productive fallbacks; no production word overrides. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  englishEntries,
  matchingDefinition,
  russianTemplates,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import { publicEntries } from '../../formal-ai/src/public-expressions.mjs';
import { completeDerivations } from '../../formal-ai/src/sources/productive-definitions.mjs';
import { completeReverseVerbs } from '../../formal-ai/src/sources/reverse-verbs.mjs';
import { completeAdjunctDefinitions } from '../../formal-ai/src/sources/definition-adjuncts.mjs';
import { completeActionDefinitions } from '../../formal-ai/src/sources/definition-actions.mjs';
import { learnHyphenated } from '../../formal-ai/src/hyphenated.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const entry = (pos, word, gloss) =>
  `==English==\n===${pos}===\n# ${gloss}\n{{trans-top|${gloss}}}\n* Russian: {{t|ru|${word}}}\n{{trans-bottom}}`;
const form = (tags, word) =>
  `<span class="Cyrl form-of lang-ru ${tags}-form-of">${word}</span>`;
function fixture(pages, forms = {}, search = []) {
  const requests = [];
  return {
    cache: false,
    requests,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : new URL(url).searchParams;
      requests.push(Object.fromEntries(p));
      let body = {};
      if (p.get('list') === 'search') {
        body = { query: { search: search.map((title) => ({ title })) } };
      } else if (p.get('action') === 'parse') {
        body = { parse: { text: forms[p.get('title')] || '' } };
      } else if (p.has('titles')) {
        body = {
          query: {
            pages: p
              .get('titles')
              .split('|')
              .map((title) => ({
                title,
                ...(pages[title]
                  ? {
                      revisions: [
                        { slots: { main: { content: pages[title] } } },
                      ],
                    }
                  : { missing: true }),
              })),
          },
        };
      } else if (p.get('action') === 'wbsearchentities') {
        body = { search: [] };
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}
const sense = (gloss, word) => ({
  gloss,
  definition: gloss,
  russian: word ? [{ word }] : [],
});

test('inline synonym templates belong to their own definition, not a neighboring sense', () => {
  const page =
    '==English==\n===Verb===\n# To give as a foundation.\n#: {{syn|en|ground}}\n# To locate elsewhere.\n#: {{syn|en|station}}\n{{trans-top|give as a foundation}}\n* French:\n{{trans-bottom}}\n{{trans-top|locate elsewhere}}\n* Russian: {{t|ru|размещать}}\n{{trans-bottom}}';
  assert.deepEqual(englishEntries(page)[0].see, []);
  const empty = page.replace('* Russian: {{t|ru|размещать}}', '* French:');
  assert.deepEqual(englishEntries(empty)[0].see, [
    { page: 'ground', gloss: 'give as a foundation', synonym: true },
    { page: 'station', gloss: 'locate elsewhere', synonym: true },
  ]);
});

test('reverse lookup requires an exact English translation in the Russian section', async () => {
  const plans = [
    { lemma: 'license', pos: 'verb', senses: [sense('To authorize.')] },
  ];
  const api = fixture(
    {
      лицензировать:
        '= {{-ru-}} =\n{{гл ru}}\n|en=[[license]], [[issue a license]]',
      отменить: '= {{-ru-}} =\n# mentions license incidentally\n|en=[[revoke]]',
      посторонний: '= {{-en-}} =\n|en=[[license]]',
    },
    {},
    ['лицензировать', 'отменить', 'посторонний']
  );
  await completeReverseVerbs(plans, api, { words: ['license'] });
  assert.deepEqual(
    plans[0].senses.flatMap((s) => s.russian),
    [{ word: 'лицензировать' }]
  );
  assert.match(api.requests[0].srsearch, /Русские глаголы/);
});

test('adverbs derive from attested adjectives and keep direct translations', async () => {
  const entries = new Map(
    ['lawfully', 'happily', 'directly', 'ghostly'].map((w) => [
      w,
      [{ pos: 'adv' }],
    ])
  );
  const plans = [
    {
      lemma: 'directly',
      pos: 'adv',
      senses: [sense('without intermediary', 'напрямую')],
    },
  ];
  await completeDerivations(
    plans,
    entries,
    fixture({
      lawful: entry('Adjective', 'законный', 'Conforming to law.'),
      happy: entry('Adjective', 'радостный', 'Feeling joy.'),
      ghost: entry('Noun', 'призрак', 'An apparition.'),
    }),
    { words: [...entries.keys()] }
  );
  const words = (w) =>
    plans
      .find((p) => p.lemma === w)
      ?.senses.flatMap((s) => s.russian.map((c) => c.word));
  assert.deepEqual(words('lawfully'), ['законно']);
  assert.deepEqual(words('happily'), ['радостно']);
  assert.deepEqual(words('directly'), ['напрямую']);
  assert.equal(words('ghostly'), undefined);
});

test('passive adjectives use an aspect partner and retain short agreement forms', async () => {
  const plans = [
    {
      lemma: 'approve',
      pos: 'verb',
      senses: [sense('To approve.', 'одобрять')],
    },
  ];
  const api = fixture(
    {
      одобрять:
        '==Russian==\n===Verb===\n{{ru-verb|одобрять|impf|pf=одобрить}}',
      одобрить:
        '==Russian==\n===Verb===\n{{ru-verb|одобрить|pf|impf=одобрять}}',
    },
    { одобрить: form('past|pass|part', 'одобренный') }
  );
  await completeDerivations(plans, new Map(), api, {
    words: ['approved'],
    forms: [
      { form: 'approved', lemma: 'approve', pos: 'verb', kind: 'ed-form' },
    ],
  });
  const s = plans.find((p) => p.pos === 'adj').senses[0];
  assert.equal(s.russian[0].word, 'одобренный');
  assert.deepEqual(s.passiveForms, {
    m: 'одобрен',
    f: 'одобрена',
    n: 'одобрено',
    p: 'одобрены',
  });
});

test('empty loan-verb paradigms still support the productive passive class', async () => {
  const plans = [
    {
      lemma: 'license',
      pos: 'verb',
      senses: [sense('To authorize.', 'лицензировать')],
    },
  ];
  await completeDerivations(plans, new Map(), fixture({}), {
    words: ['licensed'],
    forms: [
      { form: 'licensed', lemma: 'license', pos: 'verb', kind: 'ed-form' },
    ],
  });
  assert.equal(plans[1].senses[0].russian[0].word, 'лицензированный');
});

test('action nouns follow phrasal definitions and synonyms, validating the resulting Russian noun', async () => {
  const entries = new Map([
    [
      'sign-up',
      englishEntries(
        '==English==\n===Noun===\n# The act of [[sign up|signing up]], as for a service.'
      ),
    ],
  ]);
  const api = fixture({
    'sign up': entry('Verb', 'записываться', 'To add a name.').replace(
      '# To add a name.',
      '# To add a name.\n#: {{syn|en|register}}'
    ),
    register: entry('Verb', 'регистрироваться', 'To register.'),
    регистрация: '==Russian==\n===Noun===\n{{ru-noun|регистрация|f}}',
  });
  const plans = [];
  await completeActionDefinitions(plans, entries, api);
  assert.equal(plans[0].senses[0].russian[0].word, 'регистрация');
  const absent = [];
  await completeActionDefinitions(
    absent,
    entries,
    fixture({ 'sign up': entry('Verb', 'лицензировать', 'To authorize.') })
  );
  assert.deepEqual(absent, []);
});

test('manner definitions follow plural and spelling links and choose the contextual noun sense', async () => {
  const definition =
    'To publish (a novel) in regular instalments, e.g. for a television series.';
  const entries = new Map([
    ['serialize', [{ pos: 'verb', definitions: [definition] }]],
  ]);
  const plans = [
    {
      lemma: 'serialize',
      pos: 'verb',
      senses: [sense('To publish entertainment.')],
    },
  ];
  const pages = {
    publish: entry('Verb', 'публиковать', 'To publish a novel.'),
    regular: entry('Adjective', 'регулярный', 'Recurring.'),
    instalments: '==English==\n===Noun===\n# {{plural of|en|instalment}}',
    instalment:
      '==English==\n===Noun===\n# {{alternative spelling of|en|installment}}',
    installment: `${entry('Noun', 'взнос', 'A financial payment.')}\n${entry(
      'Noun',
      'выпуск',
      'A part of a television series.'
    ).replace('==English==\n', '')}`,
    выпуск: '==Russian==\n===Noun===\n{{ru-noun|выпуск|m}}',
  };
  await completeAdjunctDefinitions(
    plans,
    entries,
    fixture(pages, { выпуск: form('ins|p', 'выпусками') })
  );
  assert.equal(
    plans[0].senses.at(-1).russian[0].word,
    'публиковать регулярными выпусками'
  );
});

test('numeral-only sections with nominal Russian declension resolve as nouns', async () => {
  const page = entry(
    'Numeral',
    'миллиард',
    'A thousand million (1,000,000,000).'
  );
  const russian =
    '==Russian==\n===Numeral===\n{{head|ru|numeral|g=m}}\n{{ru-noun-table|миллиард}}';
  assert.equal(publicEntries(page)[0].pos, 'noun');
  assert.equal(russianTemplates(russian)[0].pos, 'noun');
  const lexicon = loadLexicon({ fresh: true });
  const result = await resolveText('', {
    words: ['billion'],
    lexicon,
    ...fixture(
      { billion: page, миллиард: russian },
      { миллиард: form('acc|s', 'миллиард') }
    ),
  });
  assert.deepEqual(result.missing, []);
  assert.equal(
    translateDocument('I see a billion.', { lexicon }).text,
    'Я вижу миллиард.'
  );
});

test('numeric magnitude prevents a short-scale table inheriting long-scale labels', () => {
  const d = matchingDefinition(
    'a thousand million (1,000,000,000); a milliard',
    [
      'a thousand million: 10<sup>9</sup>.',
      '{{lb|en|dated}} A million million: 10<sup>12</sup>; a thousand milliard.',
    ]
  );
  assert.equal(d.rare, false);
  assert.equal(d.definition, 'a thousand million: 109.');
});

test('hyphenated appositions preserve plural noun readings and per- takes a nominal head', () => {
  const lexicon = loadLexicon({ fresh: true });
  for (const [word, ru, animate] of [
    ['teacher', 'учитель', true],
    ['author', 'автор', true],
    ['class', 'занятие', false],
  ]) {
    lexicon.add({
      id: `fixture:${word}`,
      en: [{ pos: 'noun', lemma: word, words: [word] }],
      ru: {
        pos: 'noun',
        lemma: ru,
        gender: ru === 'занятие' ? 'n' : 'm',
        animate,
        regular: true,
        ...(word === 'teacher'
          ? { forms: { 'pl.nom': 'учителя', 'pl.acc': 'учителей' } }
          : {}),
      },
      prior: 0.3,
    });
  }
  lexicon.addForm('authors', {
    pos: 'noun',
    lemma: 'author',
    feature: 'plural',
  });
  learnHyphenated(['teacher-authors', 'per-class'], lexicon);
  assert.equal(
    lexicon.get(lexicon.lookup('adj', 'per-class')[0]).ru.lemma,
    'за занятие'
  );
  const noun = lexicon.get(lexicon.lookup('noun', 'teacher-author')[0]).ru;
  assert.equal(noun.forms['pl.nom'], 'учителя-авторы');
  assert.equal(
    translateDocument('I see teacher-authors.', { lexicon }).text,
    'Я вижу учителей-авторов.'
  );
});

test('a derived passive retains the referential it subject and short neuter agreement', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('It is based on a book.', {
    lexicon,
    ...fixture(
      {
        based: '==English==\n===Verb===\n# {{infl of|en|base||ed-form}}',
        base: entry('Verb', 'основывать', 'To use as a foundation.'),
        основывать:
          '==Russian==\n===Verb===\n{{ru-verb|основывать|impf|pf=основать}}',
        основать:
          '==Russian==\n===Verb===\n{{ru-verb|основать|pf|impf=основывать}}',
      },
      { основать: form('past|pass|part', 'основанный') }
    ),
  });
  assert.equal(
    translateDocument('It is based on a book.', { lexicon }).text,
    'Оно основано на книге.'
  );
});

test('a directly translated base keeps its existing participle reading', async () => {
  const translated = entry('Verb', 'заявлять', 'To state.');
  const entries = new Map([['state', englishEntries(translated)]]);
  const plans = [
    { lemma: 'state', pos: 'verb', senses: [sense('To state.', 'заявлять')] },
  ];
  await completeDerivations(plans, entries, fixture({}), {
    words: ['stated'],
    forms: [{ form: 'stated', lemma: 'state', pos: 'verb', kind: 'ed-form' }],
  });
  assert.equal(plans.length, 1);
});

test('learning an adjective homonym as a verb does not replace an earlier agreeing finite verb', async () => {
  const { parseSentence } =
    await import('../../formal-ai/src/english/clause.mjs');
  const lexicon = loadLexicon({ fresh: true });
  for (const [pos, word] of [
    ['noun', 'company'],
    ['noun', 'say'],
    ['verb', 'say'],
    ['adj', 'top'],
    ['noun', 'top'],
    ['verb', 'top'],
    ['noun', 'tutor'],
    ['verb', 'earn'],
  ]) {
    lexicon.add({
      id: `fixture:${pos}:${word}`,
      en: [{ pos, lemma: word, words: [word] }],
      ru: { pos, lemma: word },
      prior: 0.3,
    });
  }
  const parsed = parseSentence('The company says top tutors.', lexicon);
  assert.equal(parsed.tokens[parsed.clauses[0].verb.token].lower, 'says');
});

test('a compound subject still blocks an adjective homonym from becoming an imperative', async () => {
  const { Cursor } = await import('../../formal-ai/src/english/parser.mjs');
  const { isImperativeStart } =
    await import('../../formal-ai/src/english/imperative-start.mjs');
  const r = (pos, form, number) => ({ pos, features: { form, number } });
  const tokens = [
    { lower: 'long', readings: [r('adj'), r('verb', 'base')] },
    { lower: 'development', readings: [r('noun', undefined, 'sg')] },
    { lower: 'times', readings: [r('noun', undefined, 'pl'), r('prep')] },
    { lower: 'mean', readings: [r('adj'), r('verb', 'base')] },
  ];
  assert.equal(isImperativeStart(new Cursor(tokens)), false);
});
