/** Offline evidence tests: grammatical attachments, not lexical exceptions. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachments } from '../../formal-ai/src/english/attachments.mjs';
import { attachmentContext } from '../../formal-ai/src/attachment-context.mjs';
import { attachmentFrequencies } from '../../formal-ai/src/sources/attachment-frequency.mjs';
import { matchingDefinition } from '../../formal-ai/src/sources/wiktionary.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const head = (pos, lemma, candidates) => ({ pos, lemma, candidates });
const lexiconOf = (concepts) => new Map(concepts.map((c) => [c.id, c]));

test('sense examples stay attached to their own definition, excluding nested senses', () => {
  const result = matchingDefinition('without payment', [
    'Obtainable without payment.\n#: {{ux|en|A free trial.}}\n## Unrelated meaning.\n##: {{ux|en|A free prisoner.}}',
  ]);
  assert.deepEqual(result.examples, ['A free trial.']);
});

test('attributive, predicate, passive and adverb attachments share one representation', () => {
  const noun = head('noun', 'device', ['n']);
  const adj = head('adj', 'light', ['a']);
  const verb = head('verb', 'move', ['v']);
  const adv = head('adv', 'quickly', ['d']);
  assert.deepEqual(attachments({ head: noun, adjs: [adj] }), [
    { a: adj, b: noun, relation: 'property' },
  ]);
  assert.equal(
    attachments({
      subject: { head: noun },
      complement: { type: 'adj', ...adj },
    })[0].relation,
    'property'
  );
  assert.deepEqual(
    attachments({
      verb,
      subject: { head: noun },
      passive: true,
      mods: [adv],
    }).map((p) => p.relation),
    ['object', 'manner']
  );
});

test('a verb selects a compound noun as a whole, not its head', () => {
  const verb = head('verb', 'share', ['v']);
  const noun = head('noun', 'history', ['h']);
  const modifier = head('noun', 'location', ['l']);
  assert.deepEqual(
    attachments({ verb, objects: [{ head: noun, modifiers: [modifier] }] }),
    []
  );
  assert.equal(
    attachments({ verb, objects: [{ head: noun }] })[0].relation,
    'object'
  );
});

test('dictionary partner evidence is distinctive and cannot leak from an unattached noun', () => {
  const adjective = head('adj', 'light', ['a', 'b']);
  const noun = head('noun', 'device', ['n']);
  const a = { id: 'a', gloss: 'easy to carry', examples: ['A light device.'] };
  const b = { id: 'b', gloss: 'bright', examples: ['A light room.'] };
  const n = { id: 'n', genus: 'instrument' };
  const lexicon = lexiconOf([a, b, n]);
  const tree = { head: noun, adjs: [adjective] };
  assert.equal(attachmentContext(adjective, a, tree, lexicon), 1.2);
  assert.equal(attachmentContext(adjective, b, tree, lexicon), 0);
  assert.equal(
    attachmentContext(adjective, a, { adjective, noun }, lexicon),
    0
  );
  a.examples = [];
  a.definition = 'A portable instrument.';
  assert.equal(attachmentContext(adjective, a, tree, lexicon), 0.6);
  a.definition = 'Ready to do something.';
  n.genus = 'something';
  assert.equal(attachmentContext(adjective, a, tree, lexicon), 0);
});

test('public phrase lookup agrees adjectives, records zero counts, and scores supported alternatives', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const senses = [
    {
      id: 'attachment:1',
      gloss: 'costs nothing',
      ru: { pos: 'adj', lemma: 'бесплатный', regular: true },
    },
    {
      id: 'attachment:2',
      gloss: 'unconstrained',
      ru: { pos: 'adj', lemma: 'свободный', regular: true },
    },
  ];
  for (const c of senses) {
    lexicon.add({
      ...c,
      en: [{ pos: 'adj', lemma: 'complimentary', words: ['complimentary'] }],
    });
  }
  const queries = [];
  await attachmentFrequencies('A complimentary book.', lexicon, {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const query = new URL(url).searchParams.get('srsearch');
      queries.push(query);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              searchinfo: { totalhits: query.includes('бесплатная') ? 100 : 0 },
            },
          }),
      });
    },
  });
  assert.ok(queries.includes('"бесплатная книга"'));
  const node = head(
    'adj',
    'complimentary',
    senses.map((c) => c.id)
  );
  const noun = head('noun', 'book', lexicon.lookup('noun', 'book'));
  noun.concept = noun.candidates[0];
  const tree = { head: noun, adjs: [node] };
  assert.ok(
    attachmentContext(node, lexicon.get(node.candidates[0]), tree, lexicon) > 0
  );
  assert.equal(
    attachmentContext(node, lexicon.get(node.candidates[1]), tree, lexicon),
    0
  );
});

test('normalized association prefers a specific object over a common homonym and deduplicates synonyms', () => {
  const verb = head('verb', 'revise', ['v']);
  const noun = head('noun', 'record', ['a', 'b', 'c']);
  const concepts = [
    { id: 'v', ru: { lemma: 'редактировать' } },
    {
      id: 'a',
      ru: { lemma: 'дело' },
      ruFrequency: 75000,
      attachmentFrequency: { 'object:b:редактировать': 140 },
    },
    {
      id: 'b',
      ru: { lemma: 'файл' },
      ruFrequency: 4000,
      attachmentFrequency: { 'object:b:редактировать': 125 },
    },
    {
      id: 'c',
      ru: { lemma: 'файл' },
      ruFrequency: 4000,
      attachmentFrequency: { 'object:b:редактировать': 125 },
    },
  ];
  const lexicon = lexiconOf(concepts);
  const tree = { verb, objects: [{ head: noun }] };
  assert.equal(attachmentContext(noun, concepts[1], tree, lexicon), 0);
  assert.ok(attachmentContext(noun, concepts[2], tree, lexicon) > 0.5);
  assert.equal(
    attachmentContext(noun, concepts[2], tree, lexicon),
    attachmentContext(noun, concepts[3], tree, lexicon)
  );
});
