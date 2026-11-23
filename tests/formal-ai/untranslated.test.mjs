/** Offline public-data fallbacks for entries with empty translation tables. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  completeRussianMeanings,
  russianMeanings,
} from '../../formal-ai/src/sources/russian-meanings.mjs';
import {
  completeVerbDefinitions,
  definitionFrame,
  translatedPredicate,
  conjugatePredicate,
} from '../../formal-ai/src/sources/definition-verbs.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const ru =
  '= {{-en-}} =\n{{гл en reg}}\n==== Значение ====\n# [[регистрировать]] (как) [[товарный знак]] {{пример|not a meaning|перевод=не перевод}}\n= {{-fr-}} =\n{{гл en reg}}\n==== Значение ====\n# обманывать';
function api(pages, forms = {}) {
  return {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : new URL(url).searchParams;
      const body =
        p.get('action') === 'parse'
          ? { parse: { text: forms[p.get('title')] || '' } }
          : {
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
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}
const entry = (pos, word, definition, extra = '') =>
  `==English==\n===${pos}===\n# ${definition}\n{{trans-top|${definition}}}\n* Russian: {{t|ru|${word}}}\n${extra}\n{{trans-bottom}}`;
const russian = (pos, template, word) =>
  `==Russian==\n===${pos}===\n{{ru-${template}|${word}}}`;
const form = (tag, word) =>
  `<span class="Cyrl form-of lang-ru ${tag}-form-of">${word}</span>`;

test('Russian meanings preserve POS and exclude examples and other languages', () => {
  assert.deepEqual(russianMeanings(ru), [
    { pos: 'verb', word: 'регистрировать как товарный знак' },
  ]);
});

test('entries without tables use public Russian definitions but inflected homonyms do not create singular readings', async () => {
  const plans = [];
  const entries = new Map([
    [
      'fixture',
      [
        {
          pos: 'verb',
          formOf: [],
          senses: [],
          definitions: ['To register something.'],
        },
      ],
    ],
    [
      'fixtures',
      [
        {
          pos: 'noun',
          formOf: [{ lemma: 'fixture', kind: 'plural' }],
          senses: [],
          definitions: [],
        },
        {
          pos: 'noun',
          formOf: [],
          senses: [],
          definitions: ['A rare homonym.'],
        },
      ],
    ],
  ]);
  await completeRussianMeanings(plans, entries, api({ fixture: ru }));
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].senses[0].russian, [
    { word: 'регистрировать как товарный знак' },
  ]);
});

test('definition frames retain internal objects and recipient arguments', () => {
  assert.deepEqual(
    definitionFrame(
      { definition: 'To register something as a trademark.' },
      'verb'
    ),
    { verb: 'register', noun: 'trademark', relation: 'as', recipient: false }
  );
  assert.deepEqual(
    definitionFrame({ definition: 'To charge; to send a bill to.' }, 'verb'),
    { verb: 'send', noun: 'bill', relation: 'object', recipient: true }
  );
  assert.equal(
    definitionFrame(
      { definition: 'To perform an arbitrary complex operation.' },
      'verb'
    ),
    null
  );
});

test('definition objects use the matching sense and rendered Russian case', async () => {
  const plans = [
    {
      pos: 'verb',
      senses: [
        {
          gloss: 'to charge or enter in a bill',
          definition: 'To charge; to send a bill to.',
          russian: [],
        },
      ],
    },
  ];
  const pages = {
    send: entry('Verb', 'посылать', 'To make something go somewhere.'),
    bill: `${entry(
      'Noun',
      'клюв',
      'The beak of a bird.',
      '* French:'
    )}\n${entry('Noun', 'счёт', 'A charge for services.').replace(
      '==English==\n',
      ''
    )}`,
    посылать: russian('Verb', 'verb', 'посылать'),
    счёт: russian('Noun', 'noun', 'счёт'),
  };
  await completeVerbDefinitions(
    plans,
    api(pages, { счёт: form('acc|s', 'счёт') })
  );
  assert.deepEqual(plans[0].senses[0].russian, [
    { word: 'посылать счёт', recipient: true },
  ]);
});

test('a composed verb inflects its head before attaching the fixed complement', () => {
  const head = {
    pos: 'verb',
    lemma: 'регистрировать',
    past: ['регистрировал', 'регистрировала'],
    present: [
      'регистрирую',
      'регистрируешь',
      'регистрирует',
      'регистрируем',
      'регистрируете',
      'регистрируют',
    ],
  };
  const entry = translatedPredicate(
    'регистрировать как товарный знак',
    'verb',
    () => head
  );
  assert.equal(
    conjugatePredicate(entry, { tense: 'past', number: 'pl' }),
    'регистрировали как товарный знак'
  );
  assert.equal(
    conjugatePredicate(entry, { tense: 'present', person: 3, number: 'pl' }),
    'регистрируют как товарный знак'
  );
});

test('compound labels normalize an attested plural head before lexicalization', async () => {
  const { compoundLemma } =
    await import('../../formal-ai/src/sources/terms.mjs');
  const forms = [
    { form: 'businesses', lemma: 'business', pos: 'noun', kind: 'plural' },
  ];
  assert.equal(compoundLemma('small businesses', forms), 'small business');
  assert.equal(compoundLemma('businesses', forms), 'businesses');
  assert.equal(compoundLemma('small businesses', []), 'small businesses');
});

test('an explicitly intransitive sense keeps its own Russian verb', async () => {
  const { linkReflexiveSenses } =
    await import('../../formal-ai/src/sources/sense-data.mjs');
  const { Lexicon } = await import('../../formal-ai/src/lexicon.mjs');
  const lexicon = new Lexicon();
  for (const [id, lemma] of [
    ['plain', 'играть'],
    ['reflexive', 'играться'],
  ]) {
    lexicon.add({
      id,
      en: [{ pos: 'verb', lemma: 'play', words: ['play'] }],
      frames: ['intransitive'],
      ru: { pos: 'verb', lemma },
    });
  }
  linkReflexiveSenses([{ lemma: 'play', pos: 'verb' }], lexicon);
  assert.equal(lexicon.get('plain').ru.intransitive, undefined);
});

test('a comparison does not transfer a main-clause person cue to an animal', async () => {
  const { Lexicon } = await import('../../formal-ai/src/lexicon.mjs');
  const { resolveSenses } = await import('../../formal-ai/src/senses.mjs');
  const lexicon = new Lexicon();
  for (const [id, cues, prior] of [
    ['animal', [], 0.3],
    ['metaphor', ['person'], 0.12],
  ]) {
    lexicon.add({
      id,
      cues,
      prior,
      en: [{ pos: 'noun', lemma: 'lion', words: ['lion'] }],
      ru: { pos: 'noun', lemma: id },
    });
  }
  const head = { token: 5, pos: 'noun', candidates: ['animal', 'metaphor'] };
  const parsed = {
    tokens: [
      { index: 0, lower: 'people', readings: [{ lemma: 'person' }] },
      { index: 4, lower: 'than' },
      { index: 5, lower: 'lions' },
    ],
    clauses: [{ subject: { head } }],
  };
  resolveSenses(parsed, lexicon);
  assert.equal(head.concept, 'animal');
});

test('a known Russian paradigm is reused without copying its argument roles', async () => {
  const { reuseMorphology } =
    await import('../../formal-ai/src/sources/translation-morphology.mjs');
  const entry = { pos: 'verb', lemma: 'нести', regular: true };
  const lexicon = {
    concepts: new Map([
      [
        'other',
        {
          ru: {
            pos: 'verb',
            lemma: 'нести',
            past: ['нёс', 'несла'],
            subjectConcept: 'weather',
          },
        },
      ],
    ]),
  };
  const actual = reuseMorphology(entry, lexicon);
  assert.deepEqual(actual.past, ['нёс', 'несла']);
  assert.equal(actual.subjectConcept, undefined);
});

test('agent nouns cue the corresponding activity in a reverse definition', async () => {
  const { Lexicon } = await import('../../formal-ai/src/lexicon.mjs');
  const { resolveSenses } = await import('../../formal-ai/src/senses.mjs');
  const lexicon = new Lexicon();
  for (const [id, cues, prior, synonymAlternative] of [
    ['ordinary', [], 0.3, false],
    ['research', ['research'], 0.26, true],
  ]) {
    lexicon.add({
      id,
      cues,
      prior,
      synonymAlternative,
      gloss: 'effort',
      en: [{ pos: 'noun', lemma: 'study', words: ['study'] }],
      ru: { pos: 'noun', lemma: id },
    });
  }
  const head = { token: 2, pos: 'noun', candidates: ['ordinary', 'research'] };
  resolveSenses(
    {
      tokens: [
        { index: 0, lower: 'researchers', readings: [{ lemma: 'researcher' }] },
        { index: 1, lower: 'post' },
        { index: 2, lower: 'studies' },
      ],
      clauses: [{ subject: { head } }],
    },
    lexicon
  );
  assert.equal(head.concept, 'research');
});

test('descriptive relative clauses are not mistaken for lexical translations', () => {
  const page =
    '= {{-en-}} =\n{{прил en}}\n==== Значение ====\n# такой, на который распространяется право';
  assert.deepEqual(russianMeanings(page), []);
});

test('an adjective genus uses an attested adjective when its verb has no participle table', async () => {
  const sense = {
    gloss: 'covered by a mist',
    definition: 'Covered by a mist.',
    russian: [],
  };
  const pages = {
    covered: entry('Adjective', 'покрытый', 'Overlaid.'),
    mist: entry('Noun', 'туман', 'A mist.'),
    туман: russian('Noun', 'noun', 'туман'),
  };
  await completeVerbDefinitions(
    [{ pos: 'adj', senses: [sense] }],
    api(pages, { туман: form('ins|s', 'туманом') })
  );
  assert.equal(sense.russian[0].word, 'покрытый туманом');
  assert.equal(sense.russian[0].attested, true);
});
