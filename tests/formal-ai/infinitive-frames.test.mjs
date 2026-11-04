/** Public frame evidence is replayed offline, including ambiguous prepositional to. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { usagePenalty } from '../../formal-ai/src/sources/sense-data.mjs';
import { senseFrames } from '../../formal-ai/src/sources/verb-frames.mjs';
import { infinitiveOf } from '../../formal-ai/src/english/infinitive.mjs';
import {
  CATENATIVES,
  catenativeInventory,
} from '../../formal-ai/src/sources/infinitive-frames.mjs';
import { compactResponse } from '../../formal-ai/src/sources/compact.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const appendix = `== Followed by a ''to''-infinitive ==
[[strive]]
[[be able to|be able]]
== In the passive voice followed by a ''to''-infinitive ==
[[compel]]
== Followed by a gerund ==
[[enjoy]]
== Followed by a ''to''-infinitive or a gerund/present participle ==
===No difference in meaning===
[[continue]]
===Difference in meaning===
[[propose]]
* I propose to open a shop. (Intention)
* I propose going. (Suggestion)
[[go]]
* They have gone to see a movie. (An infinitive of purpose.)*
== Followed by a bare infinitive ==
[[let]]`;

test('public inventory separates active, passive, gerund, and purpose constructions', () => {
  assert.deepEqual(
    [...catenativeInventory(appendix)],
    ['strive', 'be able to', 'continue', 'propose']
  );
  assert.deepEqual([...catenativeInventory('')], []);
  assert.equal(usagePenalty({ gloss: 'rare: to habitually do' }), 1);
  assert.equal(usagePenalty({ gloss: 'to employ' }), 0);
  const compact = compactResponse('wiktionary', {
    query: {
      pages: [
        {
          title: CATENATIVES,
          revisions: [{ slots: { main: { content: appendix } } }],
        },
      ],
    },
  });
  assert.equal(
    compact.query.pages[0].revisions[0].slots.main.content,
    appendix
  );
  assert.ok(
    senseFrames('{{q|with to-infinitive}} To attempt.').includes(
      'to-infinitive'
    )
  );
  assert.ok(
    !senseFrames('{{q|with to-infinitive}} To attempt.').includes('prep:to')
  );
  assert.ok(
    senseFrames('To attempt. Followed by infinitive.').includes('to-infinitive')
  );
  assert.ok(
    senseFrames('To be required (to do something).').includes('to-infinitive')
  );
  for (const raw of [
    '{{lb|en|catenative}} To enjoy.',
    "To listen.\n#: {{ux|en|I '''listen''' to music.}}",
    "To pay.\n#: {{ux|en|It will '''pay''' to wait.}}",
  ]) {
    assert.ok(!senseFrames(raw).includes('to-infinitive'), raw);
  }
  const frames = senseFrames(
    "To require.\n#: {{ux|en|I '''need ''' to go; I '''need''' water.}}"
  );
  assert.ok(frames.includes('to-example:go'));
  assert.ok(
    senseFrames(
      "To be prepared.\n|passage=She is '''ready''' to proceed."
    ).includes('to-example:proceed')
  );
});

const entry = (pos, definition, example, russian) =>
  `==English==\n===${pos}===\n# ${definition}\n#: ${example}\n{{trans-top|${definition}}}\n* Russian: {{t|ru|${russian}}}\n{{trans-bottom}}`;

test('resolver stores public frames; parser handles complements, purposes, and copular adjectives', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const pages = {
    [CATENATIVES]: appendix,
    go: entry(
      'Verb',
      'To move.',
      "{{ux|en|We '''go''' to the station.}}",
      'идти'
    ),
    strive: entry(
      'Verb',
      'To attempt.',
      "{{ux|en|We '''strive''' to help.}}",
      'пытаться'
    ),
    stroll: entry(
      'Verb',
      '{{lb|en|intransitive}} To walk.',
      "{{ux|en|We '''stroll''' to the park.}}",
      'гулять'
    ),
    pay: `${entry('Verb', 'To give money.', '{{ux|en|We pay.}}', 'платить')}\n===Adjective===\n# Requiring payment.\n{{trans-top|requiring payment}}\n* Russian: {{t|ru|платный}}\n{{trans-bottom}}`,
    платный: '==Russian==\n===Adjective===\n{{ru-adj|платный}}',
    eager: entry(
      'Adjective',
      'Willing.',
      "{{ux|en|I am '''eager''' to rollerblade.}}",
      'готовый'
    ),
    rollerblade: '==English==\n===Verb===\n# To move on inline skates.',
    similar: entry(
      'Adjective',
      'Resembling.',
      "{{ux|en|It is '''similar''' to music.}}\n#: {{ux|en|It is '''similar''' to applying.}}",
      'похожий'
    ),
    applying: '==English==\n===Verb===\n# {{present participle of|en|apply}}',
    пытаться: '==Russian==\n===Verb===\n{{ru-verb|пытаться|impf}}',
    гулять: '==Russian==\n===Verb===\n{{ru-verb|гулять|impf}}',
    готовый: '==Russian==\n===Adjective===\n{{ru-adj|готовый}}',
    похожий: '==Russian==\n===Adjective===\n{{ru-adj|похожий}}',
  };
  const requests = [];
  const fetchImpl = (url, options) => {
    assert.equal(options.headers['user-agent'], USER_AGENT);
    const p = options.body
      ? new URLSearchParams(options.body)
      : new URL(url).searchParams;
    requests.push(p.get('titles'));
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
      : p.get('action') === 'parse'
        ? { parse: { text: '', wikitext: { '*': '' } } }
        : { query: { searchinfo: { totalhits: 0 } } };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
  await resolveText(
    'I strive to help. I stroll to help. I am eager to help. It is similar to music. Pay to read. I go to work.',
    {
      lexicon,
      fetchImpl,
      cache: false,
    }
  );
  assert.ok(requests.includes(CATENATIVES));
  const signal = infinitiveOf(lexicon);
  assert.equal(signal({ concepts: lexicon.lookup('verb', 'strive') }), true);
  assert.equal(signal({ concepts: lexicon.lookup('verb', 'stroll') }), false);
  assert.equal(signal({ concepts: lexicon.lookup('adj', 'eager') }), true);
  assert.equal(signal({ concepts: lexicon.lookup('adj', 'similar') }), false);
  assert.equal(signal({ concepts: [] }), undefined);
  const clause = (text) => parseSentence(text, lexicon).clauses[0];
  assert.ok(clause('I strive to help.').xcomp);
  assert.ok(!clause('I strive to help.').xcomp.purpose);
  assert.equal(clause('I stroll to read.').xcomp.purpose, true);
  assert.equal(clause('I am eager to help.').complement.type, 'adj');
  assert.ok(clause('I am eager to help.').xcomp);
  for (let i = 0; i < 20; i += 1) {
    lexicon.add({
      id: `fixture.work.${i}`,
      en: [{ pos: 'verb', lemma: 'work', words: ['work'] }],
      ru: { pos: 'verb', lemma: 'работать' },
      classes: [],
    });
  }
  assert.ok(!clause('I stroll to work.').xcomp);
  assert.equal(clause('Pay to read.').mood, 'imperative');
  assert.equal(clause('Pay to read.').xcomp.purpose, true);
  assert.ok(!clause('I go to work.').xcomp);
  assert.ok(!clause('They listen to music.').xcomp);
});
