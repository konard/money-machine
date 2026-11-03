/** Public dictionary evidence for argument structure, without network access. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import {
  collocationSenses,
  linkReflexiveSenses,
} from '../../formal-ai/src/sources/sense-data.mjs';
import { verbGovernment } from '../../formal-ai/src/sources/government.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { resolveSenses } from '../../formal-ai/src/senses.mjs';

test('reflexive alternatives require an attested translation of the same English verb', () => {
  const entries = new Map([
    ['transitive', { ru: { lemma: 'встречать' } }],
    [
      'reciprocal',
      { ru: { lemma: 'встречаться', perfective: { lemma: 'встретиться' } } },
    ],
    ['unpaired', { ru: { lemma: 'писать' } }],
  ]);
  const lexicon = {
    lookup: () => [...entries.keys()],
    get: (id) => entries.get(id),
  };
  linkReflexiveSenses([{ pos: 'verb', lemma: 'meet' }], lexicon);
  assert.equal(
    entries.get('transitive').ru.intransitive,
    entries.get('reciprocal').ru
  );
  assert.equal(entries.get('unpaired').ru.intransitive, undefined);
});

test('a participial definition cues its producing verb without a word-specific mapping', () => {
  const entries = new Map([
    ['symbol', { id: 'symbol', cues: ['alphabet'], prior: 0.3 }],
    ['message', { id: 'message', cues: ['written', 'message'], prior: 0.2 }],
  ]);
  const noun = {
    token: 1,
    text: 'letter',
    pos: 'noun',
    candidates: [...entries.keys()],
  };
  const parsed = {
    tokens: [
      {
        index: 0,
        lower: 'write',
        kind: 'word',
        readings: [{ lemma: 'write' }],
      },
      {
        index: 1,
        lower: 'letter',
        kind: 'word',
        readings: [{ lemma: 'letter' }],
      },
    ],
    clauses: [{ objects: [{ head: noun }] }],
  };
  resolveSenses(parsed, { get: (id) => entries.get(id) });
  assert.equal(noun.concept, 'message');
});

test('prepositional predicates carry Russian government to their English marker', () => {
  const text =
    '==Russian==\n===Verb===\n# to [[linger for]] {{+obj|ru|gen|acc}}';
  const result = verbGovernment(text, '', { lemma: 'linger', gloss: 'wait' });
  assert.deepEqual(result.markerGovernment.for, {
    preposition: null,
    case: 'gen',
  });
  assert.equal(
    verbGovernment(text, '', { lemma: 'differ' }).markerGovernment,
    undefined
  );
});

test('translation qualifiers restrict an aspect pair, not the preceding synonyms', () => {
  const page = `==English==\n===Verb===\n# To request an answer.\n{{trans-top|request an answer}}\n* Russian: {{t|ru|спрашивать|impf}}, {{t|ru|спросить|pf}}, {{t|ru|задавать|impf}}, {{t|ru|задать|pf}} {{qualifier|+ {{l|ru|вопро́с}}}}\n{{trans-bottom}}`;
  const senses = collocationSenses(englishEntries(page)[0].senses);
  assert.equal(senses.length, 2);
  assert.deepEqual(
    senses[0].russian.map((c) => c.word),
    ['спрашивать', 'спросить']
  );
  assert.equal(senses[1].objectLemma, 'вопрос');
  assert.deepEqual(
    senses[1].russian.map((c) => c.word),
    ['задавать', 'задать']
  );
});

test('resolved public prepositional predicates render their argument instead of a free preposition', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const pages = {
    linger:
      '==English==\n===Verb===\n# To wait.\n{{trans-top|wait}}\n* Russian: {{t|ru|ждать|impf}}\n{{trans-bottom}}',
    ждать:
      '==Russian==\n===Verb===\n{{ru-verb|ждать|impf}}\n# to [[linger for]] {{+obj|ru|gen|acc}}',
  };
  const fetchImpl = (url, options) => {
    assert.equal(options.headers['user-agent'], USER_AGENT);
    const p =
      options.method === 'POST'
        ? new URLSearchParams(options.body)
        : new URL(url).searchParams;
    const body = p.has('titles')
      ? {
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
        }
      : {};
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
  await resolveText('', {
    words: ['linger'],
    lexicon,
    cache: false,
    fetchImpl,
  });
  const output = translateDocument('I linger for Mary.', { lexicon }).text;
  assert.match(output, /Мэри/);
  assert.doesNotMatch(output, /для/);
});
