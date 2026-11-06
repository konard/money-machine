import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lexicalRoundTrip,
  russianTranslations,
  roundTripEvidence,
} from '../../formal-ai/src/round-trip.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveSenses, DocumentMemory } from '../../formal-ai/src/senses.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { contentConcepts, report } from '../../formal-ai/scripts/evaluate.mjs';
import { compactResponse } from '../../formal-ai/src/sources/compact.mjs';

const sense = (gloss, word) => ({ gloss, russian: [{ word }] });
const concept = (lemma, gloss, ru, extras = {}) => ({
  en: [{ lemma, pos: 'noun', words: [lemma] }],
  gloss,
  ru: { pos: 'noun', lemma: ru },
  ...extras,
});

test('English same-sense tables distinguish homonyms and absence of evidence', () => {
  const senses = [
    sense('without payment', 'бесплатный'),
    sense('at liberty', 'свободный'),
  ];
  assert.equal(
    lexicalRoundTrip(concept('free', 'without payment', 'бесплатный'), {
      senses,
    }).status,
    'survives'
  );
  assert.equal(
    lexicalRoundTrip(concept('free', 'without payment', 'свободный'), {
      senses,
    }).status,
    'anotherMeaning'
  );
  assert.equal(
    lexicalRoundTrip(concept('free', 'without payment', 'даровой'), { senses })
      .status,
    'unknown'
  );
});

test('Russian translation blocks preserve nested links, synonyms, and stress', () => {
  const russianPage =
    '= {{-ru-}} =\n=== Перевод ===\n{{перев-блок|тест\n|en={{t|en|gratis}}, [[free]], complimentary\n|de=[[frei]]\n}}';
  assert.deepEqual(russianTranslations(russianPage)[0].terms, [
    'free',
    'gratis',
    'complimentary',
  ]);
  assert.equal(
    lexicalRoundTrip(concept('complimentary', '', 'дарово́й'), { russianPage })
      .score,
    1
  );
  assert.equal(
    lexicalRoundTrip(concept('gift', '', 'даровой', { synonyms: ['gratis'] }), {
      russianPage,
    }).score,
    1
  );
  assert.equal(
    lexicalRoundTrip(concept('gift', '', 'даровой'), { russianPage }).score,
    0
  );
  const body = {
    query: {
      pages: [
        {
          title: 'даровой',
          revisions: [{ slots: { main: { content: russianPage } } }],
        },
      ],
    },
  };
  assert.ok(
    compactResponse(
      'wiktionary-ru',
      body
    ).query.pages[0].revisions[0].slots.main.content.includes('перев-блок')
  );
});

test('pre-pass uses cached API fetch with fixed user agent and attaches evidence', async () => {
  const requests = [];
  const plan = {
    lemma: 'gift',
    pos: 'noun',
    senses: [
      sense('a present', 'неизвестный'),
      sense('a present', 'неизвестный'),
      sense('unattested', 'иной'),
    ],
  };
  const entries = new Map([
    [
      'gift',
      [
        {
          pos: 'noun',
          senses: [
            sense('a present', 'дар'),
            sense('another sense', 'неизвестный'),
          ],
          see: [],
        },
      ],
    ],
  ]);
  const check = await roundTripEvidence([plan], entries, new Map(), {
    cache: false,
    fetchImpl: (url, options) => {
      requests.push(new URL(url));
      assert.equal(options.headers['user-agent'], USER_AGENT);
      return { ok: true, json: () => ({ query: { pages: [] } }) };
    },
  });
  assert.equal(requests[0].host, 'ru.wiktionary.org');
  assert.equal(check(concept('gift', 'a present', 'дар')).status, 'survives');
  assert.equal(
    check(concept('gift', 'a present', 'неизвестный')).status,
    'anotherMeaning'
  );
});

test('bounded round-trip evidence chooses close senses and switches off', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add(
    concept('fixtureword', 'one', 'дар', {
      id: 'fixture.one',
      prior: 0.01,
      roundTrip: { status: 'unknown', score: 0 },
    })
  );
  lexicon.add(
    concept('fixtureword', 'two', 'подарок', {
      id: 'fixture.two',
      roundTrip: { status: 'survives', score: 1 },
    })
  );
  for (const [weight, expected] of [
    [0, 'fixture.one'],
    [1, 'fixture.two'],
  ]) {
    const memory = new DocumentMemory();
    memory.methods = { roundTrip: weight };
    const parsed = parseSentence('A fixtureword.', lexicon);
    const decisions = resolveSenses(parsed, lexicon, memory);
    assert.equal(decisions[0].chosen, expected);
  }
  lexicon.get('fixture.two').gloss = 'one';
  const sameSenseMemory = new DocumentMemory();
  sameSenseMemory.methods = { roundTrip: 1 };
  assert.equal(
    resolveSenses(
      parseSentence('A fixtureword.', lexicon),
      lexicon,
      sameSenseMemory
    )[0].chosen,
    'fixture.two'
  );
  lexicon.get('fixture.one').prior = 1;
  assert.equal(
    resolveSenses(
      parseSentence('A fixtureword.', lexicon),
      lexicon,
      sameSenseMemory
    )[0].chosen,
    'fixture.one'
  );
  assert.equal(
    contentConcepts(
      [
        { concept: 'fixture.one' },
        { predicate: 'fixture.two' },
        { concept: 'fixture.one' },
      ],
      lexicon
    ).length,
    3
  );
});

test('evaluation reports harmful methods without changing defaults', () => {
  const row = {
    counts: { survives: 1, anotherMeaning: 0, unknown: 1 },
    total: 2,
    rate: 0.5,
    missing: 0,
    outputs: [],
  };
  assert.match(
    report([
      { ...row, name: 'default' },
      { ...row, name: 'documentTopic', rate: 0.75 },
    ]),
    /documentTopic lowers survival/
  );
});

test('same-sense translation references keep their public sense identity', async () => {
  const entries = new Map([
    [
      'phone',
      [
        {
          pos: 'noun',
          senses: [],
          rawDefinitions: [],
          see: [{ page: 'telephone', gloss: 'device' }],
        },
      ],
    ],
    [
      'telephone',
      [
        {
          pos: 'noun',
          senses: [sense('communication device', 'телефон')],
          rawDefinitions: [],
          see: [],
        },
      ],
    ],
  ]);
  const check = await roundTripEvidence([], entries, new Map(), {
    cache: false,
  });
  assert.equal(
    check(concept('phone', 'device: communication device', 'телефон')).status,
    'survives'
  );
});
