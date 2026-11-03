/** Offline evidence for domain senses, translation pointers and argument fit. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lexicon } from '../../formal-ai/src/lexicon.mjs';
import { DocumentMemory, resolveSenses } from '../../formal-ai/src/senses.mjs';
import {
  englishEntries,
  matchingDefinition,
  plain,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import {
  borrowGenus,
  glossWords,
  publicSenses,
  senseDomain,
} from '../../formal-ai/src/sources/sense-data.mjs';
import { completeDefinitions } from '../../formal-ai/src/sources/definition-translations.mjs';
import {
  translatedCompound,
  translationHead,
} from '../../formal-ai/src/sources/translation-morphology.mjs';
import { translationSenses } from '../../formal-ai/src/sources/translation-senses.mjs';
import {
  governmentResolver,
  verbGovernment,
} from '../../formal-ai/src/sources/government.mjs';
import { compactResponse } from '../../formal-ai/src/sources/compact.mjs';
import { contextFrequencies } from '../../formal-ai/src/sources/context-frequency.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const table = (gloss, ru) =>
  `{{trans-top|${gloss}}}\n* Russian: {{t|ru|${ru}|m}}\n{{trans-bottom}}`;
const entry = (pos, definition, gloss, ru) =>
  `==English==\n===${pos}===\n# ${definition}\n${table(gloss, ru)}`;

test('short domain labels and grammatical labels survive definition matching without turning usage notes into fields', () => {
  const sense = matchingDefinition('potential customer', [
    '{{lb|en|marketing|countable}} A potential customer.',
  ]);
  assert.equal(senseDomain(sense), 'marketing');
  assert.deepEqual(sense.labels, ['marketing', 'countable']);
  assert.equal(senseDomain({ gloss: 'intransitive: to guide' }), null);
  assert.ok(!glossWords('inform about something').includes('about'));
  assert.equal(
    senseDomain({ labels: ['of the members of a group', 'intransitive'] }),
    null
  );
  assert.equal(
    plain('[[transaction#Noun]] and [[cost#Noun|expenses]]'),
    'transaction and expenses'
  );
  assert.ok(
    matchingDefinition('chemical element', [
      '{{lb|en|uncountable}} A heavy metal element.',
    ]).labels.includes('uncountable')
  );
  assert.deepEqual(
    matchingDefinition('animal', [
      '{{lb|en|uncountable|rare}} The meat of this animal, eaten as food.',
    ]).labels,
    []
  );
});

test('a translation pointer retains the untranslated domain meaning and does not relabel unrelated target senses', () => {
  const entries = new Map([
    [
      'source',
      [
        {
          pos: 'noun',
          senses: [],
          rawDefinitions: ['{{lb|en|marketing}} A potential customer.'],
          see: [{ gloss: 'potential customer', page: 'target' }],
        },
      ],
    ],
    [
      'target',
      [
        {
          pos: 'noun',
          rawDefinitions: [],
          see: [],
          senses: [
            { gloss: 'panoramic view', russian: [{ word: 'вид' }] },
            { gloss: 'hope', russian: [{ word: 'надежда' }] },
          ],
        },
      ],
    ],
  ]);
  const senses = publicSenses(entries, 'source', 'noun');
  const customer = senses.find((s) => s.gloss === 'potential customer');
  assert.equal(senseDomain(customer), 'marketing');
  assert.deepEqual(customer.russian, []);
  assert.ok(
    senses
      .filter((s) => s.russian.length)
      .every((s) => !s.referenceMatch && !s.labels?.includes('marketing'))
  );
});

test('a shared adjective is not a shared definition head', () => {
  const senses = borrowGenus([
    {
      definition: 'Potential things that may happen.',
      russian: [{ word: 'перспектива' }],
    },
    {
      definition: 'Potential opportunity for a sale, a potential customer.',
      russian: [],
    },
  ]);
  assert.deepEqual(senses[1].russian, []);
});

test('form-of targets discard dictionary section fragments', () => {
  const [entry] = englishEntries(
    '==English==\n===Noun===\n# {{plural of|en|study#Noun}}'
  );
  assert.equal(entry.formOf[0].lemma, 'study');
});

test('empty domain tables can compose a nominal definition using public adjective and noun entries', async () => {
  const pages = {
    thermal: entry(
      'Adjective',
      'Relating to heat.',
      'relating to heat',
      'тепловой'
    ),
    sensor: entry('Noun', 'A device detecting changes.', 'device', 'датчик'),
  };
  const plans = [
    {
      pos: 'noun',
      senses: [
        { gloss: 'thermal sensor', labels: ['physics'], russian: [] },
        { gloss: 'unknown device', russian: [] },
      ],
    },
  ];
  await completeDefinitions(plans, {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const titles = new URL(url).searchParams.get('titles').split('|');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: titles.map((title) => ({
                title,
                revisions: [{ slots: { main: { content: pages[title] } } }],
              })),
            },
          }),
      });
    },
  });
  assert.equal(plans[0].senses[0].russian[0].word, 'тепловой датчик');
  assert.deepEqual(plans[0].senses[1].russian, []);
});

test('compound heads use their attested lemma and retain a plural translation', () => {
  const noun = {
    pos: 'noun',
    lemma: 'затрата',
    gender: 'f',
    forms: { 'pl.nom': 'затраты', 'pl.dat': 'затратам' },
  };
  const ru = translatedCompound(
    'постоянные затраты',
    () => noun,
    new Map([['noun:затраты', 'затрата']])
  );
  assert.equal(ru.compound.head, 'затрата');
  assert.equal(ru.pluraliaTantum, true);
  assert.equal(ru.compound.adjectives[0], 'постоянный');
  assert.equal(translationHead(ru), 'затраты');
});

test('sense-qualified synonyms recover empty tables, including a thesaurus headword', () => {
  const [verb] = englishEntries(
    `==English==\n===Verb===\n# {{lb|en|of the members of a group|intransitive}} To display differences.\n====Synonyms====\n* {{sense|display differences}} See also [[Thesaurus:differ]]\n====Translations====\n{{trans-top|to display difference}}\n* French: varier\n{{trans-bottom}}`
  );
  assert.deepEqual(verb.see, [
    {
      gloss: 'to display difference',
      page: 'differ',
      thesaurus: true,
      synonym: true,
    },
  ]);
  const entries = new Map([
    ['vary', [verb]],
    [
      'differ',
      [
        {
          pos: 'verb',
          senses: [
            {
              gloss: 'not have the same characteristics',
              languages: 30,
              russian: [{ word: 'различаться' }],
            },
            { gloss: 'disagree', languages: 5, russian: [{ word: 'спорить' }] },
          ],
        },
      ],
    ],
  ]);
  const sense = publicSenses(entries, 'vary', 'verb').find(
    (s) => s.russian.length
  );
  assert.equal(sense.russian[0].word, 'различаться');
  assert.equal(
    sense.languages,
    1,
    'the source table supplies popularity, not its synonym'
  );
  assert.ok(sense.labels.includes('of the members of a group'));
  const { finish } = governmentResolver({
    russian: () => null,
    ruPages: new Map(),
    government: new Map(),
    lexicon: new Lexicon(),
  });
  const ru = finish(
    { lemma: 'различаться', pos: 'verb' },
    { ...sense, lemma: 'vary' }
  );
  assert.deepEqual(ru.markerGovernment.by, { preposition: 'по', case: 'dat' });
});

test('reverse definitions retain a contextual noun synonym without making it the default', () => {
  const original = {
    gloss: 'mental effort',
    russian: [{ word: 'учение' }, { word: 'исследование' }],
  };
  const senses = translationSenses(
    { lemma: 'study', pos: 'noun', senses: [original] },
    new Map([
      ['исследование', '==Russian==\n===Noun===\n# [[research]], [[study]]'],
    ])
  );
  assert.equal(senses[0], original);
  assert.equal(senses[1].synonymAlternative, true);
  assert.match(senses[1].context, /research/);
});

function concept(lexicon, id, extra = {}) {
  lexicon.add({
    id,
    en: [{ pos: 'verb', lemma: 'predicate', words: ['predicate'] }],
    ru: { pos: 'verb', lemma: id },
    classes: [],
    cues: [],
    ...extra,
  });
}

test('an intransitive dictionary frame outranks a guessed object inside a prepositional phrase', () => {
  const lexicon = new Lexicon();
  concept(lexicon, 'harmony', {
    prior: 0.3,
    frames: ['intransitive'],
    gloss: 'to be in harmony about an opinion',
  });
  concept(lexicon, 'correspond', {
    prior: 0.15,
    frames: ['intransitive'],
    gloss: 'to correspond',
  });
  const verb = {
    token: 0,
    text: 'predicate',
    pos: 'verb',
    candidates: ['harmony', 'correspond'],
  };
  const parsed = {
    tokens: [{ index: 0, text: 'predicate', lower: 'predicate', readings: [] }],
    clauses: [{ verb, objects: [{ marker: 'with', name: 'Someone' }] }],
  };
  resolveSenses(parsed, lexicon);
  assert.equal(verb.concept, 'harmony');
});

test('counted phrases penalize an explicitly uncountable sense', () => {
  const lexicon = new Lexicon();
  concept(lexicon, 'mass', { prior: 0.3, labels: ['uncountable'] });
  concept(lexicon, 'individual', { prior: 0.15, labels: ['countable'] });
  const head = {
    token: 0,
    text: 'noun',
    pos: 'noun',
    candidates: ['mass', 'individual'],
  };
  resolveSenses(
    {
      tokens: [{ index: 0, lower: 'noun', text: 'noun', readings: [] }],
      clauses: [{ subject: { head, quantity: 1 } }],
    },
    lexicon
  );
  assert.equal(head.concept, 'individual');
});

test('a Russian synonym retains the usage of its exact reverse meaning', () => {
  const senses = translationSenses(
    {
      lemma: 'know',
      pos: 'verb',
      senses: [
        { gloss: 'be aware', russian: [{ word: 'знать' }, { word: 'ведать' }] },
      ],
    },
    new Map([
      [
        'ведать',
        '==Russian==\n===Verb===\n# {{lb|ru|archaic|or|poetic}} to [[know]]',
      ],
    ])
  );
  assert.equal(senses[1].rare, true);
  assert.ok(senses[1].labels.includes('archaic'));
});

test('a field label is not counted twice when it already supplied a topic cue', () => {
  const lexicon = new Lexicon();
  concept(lexicon, 'learning', { prior: 0.3, cues: ['learning'] });
  concept(lexicon, 'research', {
    prior: 0.26,
    cues: ['research'],
    genus: 'research',
    synonymAlternative: true,
  });
  concept(lexicon, 'publication', {
    prior: 0.12,
    cues: ['academic'],
    domain: 'academic',
  });
  const head = {
    token: 0,
    text: 'studies',
    pos: 'noun',
    candidates: ['learning', 'research', 'publication'],
  };
  const memory = new DocumentMemory();
  memory.setTopic(
    'Academic studies. Research studies pay participants. Research studies recruit people. Research studies are scheduled.'
  );
  resolveSenses(
    {
      tokens: [{ index: 0, lower: 'studies', text: 'studies', readings: [] }],
      clauses: [{ subject: { head } }],
    },
    lexicon,
    memory
  );
  assert.equal(head.concept, 'research');
});

test('object association distinguishes attested synonyms without rewarding isolated corpus hits', () => {
  const lexicon = new Lexicon();
  concept(lexicon, 'general', {
    prior: 0.3,
    gloss: 'cover',
    frames: ['transitive'],
    core: true,
    ruFrequency: 1300,
    objectFrequency: { затраты: 33 },
  });
  concept(lexicon, 'fitting', {
    prior: 0.26,
    gloss: 'cover',
    frames: ['transitive'],
    core: true,
    ruFrequency: 732,
    objectFrequency: { затраты: 39 },
    synonymAlternative: true,
  });
  concept(lexicon, 'object', {
    en: [{ pos: 'noun', lemma: 'cost', words: ['cost'] }],
    ru: {
      pos: 'noun',
      lemma: 'постоянные затраты',
      pluraliaTantum: true,
      forms: { 'pl.nom': 'затраты' },
      compound: { head: 'затрата' },
    },
  });
  const verb = {
    token: 0,
    text: 'cover',
    pos: 'verb',
    candidates: ['general', 'fitting'],
  };
  const head = { token: 1, text: 'cost', pos: 'noun', candidates: ['object'] };
  const parsed = {
    tokens: [
      { index: 0, text: 'cover', lower: 'cover', readings: [] },
      { index: 1, text: 'cost', lower: 'cost', readings: [] },
    ],
    clauses: [{ verb, objects: [{ head }] }],
    unknown: [],
    leftover: [],
  };
  resolveSenses(parsed, lexicon);
  assert.equal(verb.concept, 'fitting');
  lexicon.get('fitting').objectFrequency['затраты'] = 1;
  resolveSenses(parsed, lexicon);
  assert.equal(verb.concept, 'general');
  lexicon.get('fitting').objectFrequency['затраты'] = 39;
  delete lexicon.get('general').ruFrequency;
  resolveSenses(parsed, lexicon);
  assert.equal(
    verb.concept,
    'general',
    'missing unigram evidence must not favor only one synonym'
  );
});

test('recorded Russian definitions retain prepositional argument evidence', () => {
  const text =
    '= {{-ru-}} =\n== {{з|I}} ==\n# направляться на кого-либо; сталкиваться с кем-либо.\n';
  const response = {
    query: {
      pages: [
        {
          title: 'встречать',
          revisions: [{ slots: { main: { content: text } } }],
        },
      ],
    },
  };
  const recorded = compactResponse('wiktionary-ru', response).query.pages[0]
    .revisions[0].slots.main.content;
  const full = verbGovernment('', text, { lemma: 'meet' });
  assert.deepEqual(verbGovernment('', recorded, { lemma: 'meet' }), full);
  assert.deepEqual(full.markerGovernment.with, {
    preposition: 'с',
    case: 'ins',
  });
});

test('a cue in a coordinated clause is not a local modifier-sense cue', () => {
  const lexicon = new Lexicon();
  concept(lexicon, 'duration', { prior: 0.3 });
  concept(lexicon, 'boredom', { prior: 0.1, cues: ['cause'] });
  concept(lexicon, 'cause');
  const adjective = {
    token: 0,
    text: 'slow',
    pos: 'adj',
    candidates: ['duration', 'boredom'],
  };
  const verb = { token: 2, text: 'cause', pos: 'verb', candidates: ['cause'] };
  resolveSenses(
    {
      tokens: [
        { index: 0, text: 'slow', lower: 'slow' },
        { index: 1, text: 'and', lower: 'and' },
        { index: 2, text: 'cause', lower: 'cause' },
      ],
      clauses: [{ property: adjective }, { verb }],
    },
    lexicon
  );
  assert.equal(adjective.concept, 'duration');
});

test('Russian government alone does not turn a free adjunct into English valency evidence', () => {
  const lexicon = new Lexicon();
  concept(lexicon, 'general', { prior: 0.3, frames: ['intransitive'] });
  concept(lexicon, 'special', {
    prior: 0.1,
    frames: ['intransitive'],
    ru: {
      pos: 'verb',
      lemma: 'приближаться',
      markerGovernment: { to: { preposition: 'к', case: 'dat' } },
    },
  });
  const verb = {
    token: 0,
    text: 'move',
    pos: 'verb',
    candidates: ['general', 'special'],
  };
  const parsed = {
    tokens: [{ index: 0, text: 'move', lower: 'move' }],
    clauses: [{ verb, mods: [{ prep: 'to' }] }],
  };
  resolveSenses(parsed, lexicon);
  assert.equal(verb.concept, 'general');
  lexicon.get('special').frames.push('prep:to');
  resolveSenses(parsed, lexicon);
  assert.equal(verb.concept, 'special');
});

test('an exactly reverse-attested noun preserves its ordinary translation', () => {
  const sense = {
    gloss: 'a fee',
    russian: [{ word: 'плата' }, { word: 'заряд' }],
  };
  const pages = new Map([
    ['плата', '==Russian==\n===Noun===\n# [[charge]], [[fee]]'],
    ['заряд', '==Russian==\n===Noun===\n# [[charge]]\n# [[explosive]]'],
  ]);
  assert.deepEqual(
    translationSenses({ lemma: 'charge', pos: 'noun', senses: [sense] }, pages),
    [sense]
  );
});

test('reverse cues exclude the other meanings of the Russian synonym', () => {
  const sense = {
    gloss: 'mental effort',
    russian: [{ word: 'учение' }, { word: 'исследование' }],
  };
  const pages = new Map([
    [
      'исследование',
      '==Russian==\n===Noun===\n# [[research]], [[study]]\n# [[arrival]]',
    ],
  ]);
  const [, alternative] = translationSenses(
    { lemma: 'study', pos: 'noun', senses: [sense] },
    pages
  );
  assert.match(alternative.context, /research/);
  assert.doesNotMatch(alternative.context, /arrival/);
});

test('a complete clause can supply a corpus pair before an unknown semicolon clause', async () => {
  const lexicon = new Lexicon();
  for (const [id, ru] of [
    ['cover-a', 'закрывать'],
    ['cover-b', 'покрывать'],
  ]) {
    concept(lexicon, id, {
      en: [{ pos: 'verb', lemma: 'cover', words: ['cover'] }],
      ru: { pos: 'verb', lemma: ru },
    });
  }
  concept(lexicon, 'cost', {
    en: [{ pos: 'noun', lemma: 'cost', words: ['cost'] }],
    ru: {
      pos: 'noun',
      lemma: 'постоянные затраты',
      pluraliaTantum: true,
      forms: { 'pl.nom': 'затраты' },
      compound: { head: 'затрата' },
    },
  });
  const requests = [];
  const options = {
    cache: false,
    fetchImpl: (url, settings) => {
      assert.equal(settings.headers['user-agent'], USER_AGENT);
      requests.push(new URL(url).searchParams.get('srsearch'));
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ query: { searchinfo: { totalhits: 50 } } }),
      });
    },
  };
  await contextFrequencies('Cover costs; qxzzyy.', lexicon, options);
  assert.ok(requests.includes('"покрывать" "затраты"'));
  requests.length = 0;
  await contextFrequencies('Cover qxzzyy.', lexicon, options);
  assert.deepEqual(requests, []);
});

test('domain stems do not collapse a field to a short unrelated prefix', () => {
  const memory = new DocumentMemory();
  memory.setTopic('Networks require minimum volume.');
  assert.equal(memory.mentions('mining'), false);
  memory.setTopic('Mining companies extract minerals.');
  assert.equal(memory.mentions('mining'), true);
});

test('counted nouns prefer an exactly reverse-attested reading over an unsupported process synonym', () => {
  const lexicon = new Lexicon();
  concept(lexicon, 'process', { prior: 0.3 });
  concept(lexicon, 'attested', { prior: 0.26, synonymAlternative: true });
  const head = {
    token: 0,
    text: 'items',
    pos: 'noun',
    candidates: ['process', 'attested'],
  };
  const subject = { head, number: 'pl' };
  const parsed = {
    tokens: [{ index: 0, lower: 'items', text: 'items' }],
    clauses: [{ subject }],
  };
  resolveSenses(parsed, lexicon);
  assert.equal(head.concept, 'attested');
  subject.number = 'sg';
  resolveSenses(parsed, lexicon);
  assert.equal(head.concept, 'process');
});
