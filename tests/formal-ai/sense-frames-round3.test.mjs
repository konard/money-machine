/** Offline regressions for lexical defaults and dictionary argument roles. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lexicon } from '../../formal-ai/src/lexicon.mjs';
import { DocumentMemory, resolveSenses } from '../../formal-ai/src/senses.mjs';
import {
  verbGovernment,
  governmentResolver,
} from '../../formal-ai/src/sources/government.mjs';
import { senseFrames } from '../../formal-ai/src/sources/verb-frames.mjs';
import {
  completeSynonymDefinitions,
  definitionSynonyms,
} from '../../formal-ai/src/sources/definition-synonyms.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { translationSenses } from '../../formal-ai/src/sources/translation-senses.mjs';

test('reverse noun synonyms align the gloss head and exclude parenthetical explanations', () => {
  const pages = new Map([
    ['сиденье', '==Russian==\n===Noun===\n# [[seat]]'],
    [
      'место',
      '==Russian==\n===Noun===\n# [[seat]], [[place]], [[room]] {{q|where a visitor can sit}}',
    ],
    ['пользователь', '==Russian==\n===Noun===\n# [[user]]'],
    [
      'юзер',
      '==Russian==\n===Noun===\n# [[user]] (person who uses a computer)',
    ],
  ]);
  const seat = {
    gloss: 'place in which to sit',
    russian: [{ word: 'сиденье' }, { word: 'место' }],
  };
  assert.equal(
    translationSenses({ lemma: 'seat', pos: 'noun', senses: [seat] }, pages)[1]
      .russian[0].word,
    'место'
  );
  const lexicon = new Lexicon();
  const senses = translationSenses(
    { lemma: 'seat', pos: 'noun', senses: [seat] },
    pages
  );
  senses.forEach((sense, i) =>
    lexicon.add({ ...sense, en: [], id: String(i), prior: 0.3 })
  );
  const head = { token: 1, text: 'seat', pos: 'noun', candidates: ['0', '1'] };
  const tokens = [
    { index: 0, lower: 'per', text: 'per' },
    { index: 1, lower: 'seat', text: 'seat' },
  ];
  resolveSenses({ tokens, clauses: [{ head }] }, lexicon);
  assert.equal(head.concept, '1');
  tokens[0].lower = 'the';
  resolveSenses({ tokens, clauses: [{ head }] }, lexicon);
  assert.equal(head.concept, '0');
  const user = {
    gloss: 'person who uses a computer',
    russian: [{ word: 'пользователь' }, { word: 'юзер' }],
  };
  assert.deepEqual(
    translationSenses({ lemma: 'user', pos: 'noun', senses: [user] }, pages),
    [user]
  );
});

test('a headword cannot supply its own specialist domain through a shared prefix', () => {
  const memory = new DocumentMemory();
  memory.setTopic('I use a phone.');
  assert.equal(memory.mentions('phonetics', 'phone'), false);
  memory.setTopic('The phone is described in phonetics.');
  assert.equal(memory.mentions('phonetics', 'phone'), true);
});

test('direct objects reject exclusively intransitive senses and retain explicit object cues', () => {
  const lexicon = new Lexicon();
  for (const entry of [
    { id: 'motion', frames: ['intransitive'], prior: 0.3 },
    {
      id: 'operate',
      frames: ['transitive'],
      cues: ['device'],
      objectClasses: ['instrument'],
    },
    { id: 'device', classes: ['apparatus'] },
  ]) {
    lexicon.add({ en: [], ...entry });
  }
  const verb = { token: 0, pos: 'verb', candidates: ['motion', 'operate'] };
  const head = {
    token: 1,
    pos: 'noun',
    lemma: 'device',
    candidates: ['device'],
  };
  const [decision] = resolveSenses(
    {
      tokens: [
        { index: 0, text: 'Operate', lower: 'operate' },
        { index: 1, text: 'device', lower: 'device' },
      ],
      clauses: [{ verb, objects: [{ head }] }],
    },
    lexicon
  );
  assert.equal(verb.concept, 'operate');
  assert.ok(
    decision.allEvidence.motion.some((why) =>
      why.includes('intransitive sense with direct object')
    )
  );
});

test('ditransitive themes stay accusative and colloquial infinitive frames do not leak', () => {
  assert.ok(
    senseFrames('{{lb|en|ditransitive}} To allocate something.').includes(
      'transitive'
    )
  );
  const english =
    '==Russian==\n===Verb===\n# to [[allocate]] {{+obj|ru|dat + acc}}';
  const frame = verbGovernment(english, '', { lemma: 'allocate' });
  assert.equal(frame.government.case, 'acc');
  assert.equal(frame.recipient, 'dat');
  const russian =
    '= {{-ru-}} =\n# резервировать\n# {{помета|кому, обычно с инф.}} {{прост.|ru}} приказать';
  assert.equal(
    verbGovernment('', russian, { lemma: 'reserve' }).government,
    undefined
  );
  assert.equal(
    verbGovernment(
      '',
      '= {{-ru-}} =\n# иметь определённую цену\n# {{помета|чего}} обладать ценностью',
      { lemma: 'cost' }
    ).government,
    undefined
  );
  assert.equal(
    verbGovernment('', '= {{-ru-}} =\n=== Управление ===\nкем-чем', {})
      .government.case,
    'ins'
  );
});

test('explicit perfective translations outrank an unrelated generic aspect partner', () => {
  const entries = new Map([
    [
      'видеть',
      { pos: 'verb', lemma: 'видеть', aspect: 'impf', partner: 'завидеть' },
    ],
    ['увидеть', { pos: 'verb', lemma: 'увидеть', aspect: 'perf' }],
    ['завидеть', { pos: 'verb', lemma: 'завидеть', aspect: 'perf' }],
  ]);
  const { finish } = governmentResolver({
    russian: (word) => entries.get(word),
    ruPages: new Map(),
    government: new Map(),
    lexicon: new Lexicon(),
  });
  const result = finish(
    { ...entries.get('видеть') },
    {
      lemma: 'perceive',
      russian: [
        { word: 'видеть', aspect: 'impf' },
        { word: 'увидеть', aspect: 'perf' },
      ],
    }
  );
  assert.equal(result.perfective.lemma, 'увидеть');
  const unpaired = finish(
    { ...entries.get('видеть'), partner: undefined },
    {
      lemma: 'perceive',
      russian: [
        { word: 'видеть', aspect: 'impf' },
        { word: 'увидеть', aspect: 'perf' },
      ],
    }
  );
  assert.equal(unpaired.perfective, undefined);
});

test('secondary clippings defer to a core sense in the same field, without penalizing unrelated abbreviations', () => {
  const lexicon = new Lexicon();
  lexicon.add({
    en: [],
    id: 'ordinary',
    core: true,
    domain: 'computing',
    prior: 0.3,
  });
  lexicon.add({
    en: [],
    id: 'clipped',
    variant: true,
    domain: 'computing',
    cues: ['system'],
    prior: 0.03,
  });
  const head = {
    token: 0,
    text: 'user',
    pos: 'noun',
    candidates: ['ordinary', 'clipped'],
  };
  const parsed = {
    tokens: [
      { index: 0, lower: 'user', text: 'user' },
      { index: 3, lower: 'system', text: 'system' },
    ],
    clauses: [{ head }],
  };
  resolveSenses(parsed, lexicon);
  assert.equal(head.concept, 'ordinary');
  lexicon.get('clipped').domain = null;
  resolveSenses(parsed, lexicon);
  assert.equal(head.concept, 'clipped');
});

test('empty coordinated synonym definitions borrow only a matching public verb sense', async () => {
  const sense = {
    definition: 'To manage, control, or direct.',
    russian: [],
    frames: ['transitive'],
  };
  assert.deepEqual(definitionSynonyms(sense), ['manage', 'control', 'direct']);
  assert.deepEqual(
    definitionSynonyms({ definition: 'To manage with the hands.' }),
    []
  );
  await completeSynonymDefinitions([{ pos: 'verb', senses: [sense] }], {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const titles = new URL(url).searchParams.get('titles').split('|');
      return {
        ok: true,
        json: () => ({
          query: {
            pages: titles.map((title) => ({
              title,
              revisions: [
                {
                  slots: {
                    main: {
                      content:
                        title === 'manage'
                          ? '==English==\n===Verb===\n# {{lb|en|transitive}} To control or direct.\n{{trans-top|to control or direct}}\n* Russian: {{t|ru|управлять|impf}}\n{{trans-bottom}}'
                          : '',
                    },
                  },
                },
              ],
            })),
          },
        }),
      };
    },
  });
  assert.equal(sense.russian[0].word, 'управлять');
  await completeSynonymDefinitions(
    [
      {
        pos: 'verb',
        senses: [sense, { definition: 'To control or direct.', russian: [] }],
      },
    ],
    {
      cache: false,
      fetchImpl: () =>
        assert.fail('an ordinary translated sense already exists'),
    }
  );
});
