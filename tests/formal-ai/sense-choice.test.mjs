/** Public evidence selects senses without content-word translation rules. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { DocumentMemory, resolveSenses } from '../../formal-ai/src/senses.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import { termSenses } from '../../formal-ai/src/sources/terms.mjs';
import { governmentResolver } from '../../formal-ai/src/sources/government.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

function api(pages = {}, entities = {}, search = []) {
  return {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const p = options.body
        ? new URLSearchParams(options.body)
        : new URL(url).searchParams;
      let body = {};
      if (p.has('titles')) {
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
        body = { search };
      } else if (p.get('action') === 'wbgetentities') {
        body = { entities };
      } else if (p.get('action') === 'parse') {
        body = { parse: { text: '' } };
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}

test('translation targets outrank display text; missing Russian pages cannot invent words', async () => {
  const lexicon = new Lexicon();
  const candidates =
    '{{t|ru|абракадабро}}, {{t|ru|pretend}}, {{t|ru|выдумка}}, {{t|ru|книга|f|alt=kniga}}';
  const page = `==English==\n===Noun===\n# A volume.\n{{trans-top|volume}}\n* Russian: ${candidates}\n{{trans-bottom}}`;
  assert.deepEqual(
    englishEntries(page)[0].senses[0].russian.map((c) => c.word),
    ['абракадабро', 'выдумка', 'книга']
  );
  await resolveText('', {
    words: ['volume'],
    lexicon,
    ...api({
      volume: page,
      книга: '==Russian==\n===Noun===\n{{ru-noun|книга|f}}',
    }),
  });
  assert.equal(
    lexicon.get(lexicon.lookup('noun', 'volume')[0]).ru.lemma,
    'книга'
  );
});

test('linked modifiers in definitions are not synonyms of the entry', () => {
  const [entry] = englishEntries(
    '==English==\n===Noun===\n# The [[manual]] [[updating]] of information.\n# The [[selective]] [[assembly]] of information.'
  );
  assert.deepEqual(entry.formOf, []);
  assert.equal(
    englishEntries(
      '==English==\n===Noun===\n# A [[document]], especially a short one.'
    )[0].formOf[0].lemma,
    'document'
  );
});

test('exact conceptual Wikidata aliases supply whole terms; fuzzy hits and named works do not', async () => {
  const entities = {
    Qconcept: {
      labels: {
        en: { value: 'information repository' },
        ru: { value: 'архив данных' },
      },
      aliases: { en: [{ value: 'data archive' }] },
      claims: { P279: [{}] },
    },
    Qwork: {
      labels: { en: { value: 'data archive' }, ru: { value: 'Книга' } },
      claims: { P31: [{}] },
    },
    Qfuzzy: {
      labels: { en: { value: 'data archives' }, ru: { value: 'архив' } },
      claims: { P279: [{}] },
    },
  };
  const fixture = api({}, entities, [
    {
      id: 'Qconcept',
      label: 'information repository',
      match: { text: 'data archive' },
    },
    { id: 'Qwork', label: 'data archive' },
    { id: 'Qfuzzy', label: 'data archives' },
  ]);
  const plans = await termSenses(['data archive'], fixture);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].senses.length, 1);
  assert.equal(plans[0].senses[0].russian[0].word, 'архив данных');
});

test('document definitions and field labels can override a generic first sense', () => {
  const lexicon = new Lexicon();
  lexicon.add({ en: [], id: 'physical', cues: ['ground'], prior: 0.3 });
  lexicon.add({
    en: [],
    id: 'digital',
    cues: ['network', 'computing'],
    domain: 'computing',
    prior: 0.1,
  });
  const memory = new DocumentMemory();
  memory.setTopic('Computing uses a network. This network serves customers.');
  const head = { candidates: ['physical', 'digital'], token: 0, pos: 'noun' };
  const [decision] = resolveSenses(
    {
      tokens: [{ index: 0, lower: 'node', text: 'node' }],
      clauses: [{ head }],
    },
    lexicon,
    memory
  );
  assert.equal(head.concept, 'digital');
  assert.ok(
    decision.evidence.some((e) => e.includes('dictionary field computing'))
  );
});

test('an explicit imperfective translation belongs to the selected sense ahead of a generic aspect partner', () => {
  const entries = new Map([
    ['ставить', { pos: 'verb', lemma: 'ставить', aspect: 'impf' }],
    [
      'поставить',
      {
        pos: 'verb',
        lemma: 'поставить',
        aspect: 'perf',
        partner: 'поставлять',
      },
    ],
    ['поставлять', { pos: 'verb', lemma: 'поставлять', aspect: 'impf' }],
  ]);
  const { finish } = governmentResolver({
    russian: (word) => entries.get(word),
    ruPages: new Map(),
    government: new Map(),
    lexicon: new Lexicon(),
  });
  const result = finish(
    { ...entries.get('поставить') },
    {
      lemma: 'position',
      russian: [
        { word: 'ставить', aspect: 'impf' },
        { word: 'поставить', aspect: 'perf' },
      ],
    }
  );
  assert.equal(result.lemma, 'ставить');
  assert.equal(result.perfective.lemma, 'поставить');
});

test('definition matching distinguishes a head from an incidental mention and retains parent context', async () => {
  const { matchingDefinition } =
    await import('../../formal-ai/src/sources/wiktionary.mjs');
  const child =
    'The name of a writing such as a book, identifying its subject.';
  const result = matchingDefinition('name of a book', [
    `The name of a film, musical piece, or other work of art.\n## ${child}`,
    child,
    'The panel for the name, on the back of a book.',
  ]);
  assert.equal(result.definition, child);
  assert.match(result.context, /musical piece/);
});

test('compound aliases need evidence in their own sentence, rather than an unrelated sentence', async () => {
  const { compoundFits } =
    await import('../../formal-ai/src/sources/sense-data.mjs');
  assert.equal(
    compoundFits(
      {
        lemma: 'tall man',
        senses: [{ gloss: 'third finger of a human hand' }],
      },
      'I like tall men. His hand hurts.'
    ),
    false
  );
  assert.equal(
    compoundFits(
      { lemma: 'data archive', senses: [{ gloss: 'information repository' }] },
      'The data archive is a repository.'
    ),
    true
  );
});
