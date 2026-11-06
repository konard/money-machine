/** Offline public-response fixtures and context method ablations. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContextNetwork } from '../../formal-ai/src/context-network.mjs';
import { populateContexts } from '../../formal-ai/src/sources/context-data.mjs';
import { Lexicon, loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { parseLino } from '../../formal-ai/src/lino.mjs';
import {
  rankContexts,
  positionalContext,
} from '../../formal-ai/src/context-ranking.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { expandContextDefinitions } from '../../formal-ai/src/sources/context-definitions.mjs';

test('source types, Extends, deep ancestry and cycles', () => {
  const n = new ContextNetwork();
  n.define('commerce');
  n.define('finance', ['commerce']);
  n.define('payment', ['finance', 'computing']);
  n.define('computing');
  for (let i = 0; i < 20; i += 1) {
    n.define(`level${i}`, [i ? `level${i - 1}` : 'payment']);
  }
  assert.deepEqual(n.links.get('Context'), {
    source: 'Type',
    target: 'Context',
  });
  assert.deepEqual(n.links.get('payment'), {
    source: 'finance',
    target: 'payment',
  });
  assert.ok(n.isA('level19', 'commerce'));
  assert.ok(n.isA('payment', 'computing'));
  assert.equal(n.depth('payment'), 2);
  n.define('commerce', ['payment']);
  assert.ok(n.isA('level19', 'finance'));
  assert.ok(!n.ancestorsOf('payment').has('payment'));
  assert.equal(n.depth('payment'), 2);
  n.linkConcept({ id: 'a-sense', domain: 'payment' });
  assert.ok(n.contextsOf('a-sense').has('finance'));
  assert.ok(n.isA('a-sense', 'commerce'));
});

test('public topic mapping follows bounded P279 with multiple parents and local shadowing', async () => {
  const lexicon = new Lexicon();
  lexicon.add({ id: 'sense', domain: 'finance', en: [] });
  const requests = [];
  const entity = (label, parents = []) => ({
    labels: { en: { value: label } },
    claims: {
      P279: parents.map((id) => ({
        mainsnak: { datavalue: { value: { id } } },
      })),
    },
  });
  const entities = {
    Q1: entity('finance', ['Q2', 'Q3']),
    Q2: entity('commerce', ['Q4']),
    Q3: entity('economics'),
    Q4: entity('activity'),
  };
  const api = {
    cache: false,
    contextDepth: 1,
    fetchImpl: (url, init) => {
      assert.equal(init.headers['user-agent'], USER_AGENT);
      const p = new URL(url).searchParams;
      requests.push(Object.fromEntries(p));
      const body =
        p.get('action') === 'wbsearchentities'
          ? { search: [{ id: 'Q1', label: 'finance' }] }
          : {
              entities: Object.fromEntries(
                p
                  .get('ids')
                  .split('|')
                  .map((id) => [id, entities[id]])
              ),
            };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
  await populateContexts(lexicon, api);
  assert.deepEqual([...lexicon.contextNetwork.contextsOf('sense')].sort(), [
    'commerce',
    'economics',
    'finance',
  ]);
  assert.ok(!requests.some((r) => r.ids?.includes('Q4')));
  assert.equal(lexicon.contextNetwork.id('Q2'), 'commerce');
  lexicon.contextNetwork.addTree(
    parseLino(
      'context finance\n  extends local\nconcept sense\n  contexts (finance)'
    )
  );
  lexicon.contextNetwork.define('finance', ['commerce']);
  assert.ok(lexicon.contextNetwork.contextsOf('sense').has('local'));
  assert.ok(!lexicon.contextNetwork.contextsOf('sense').has('commerce'));
  const count = requests.length;
  await populateContexts(lexicon, api);
  assert.equal(requests.length, count);
});

test('a depth cut from one label keeps the parents another label fetched', async () => {
  const lexicon = new Lexicon();
  lexicon.add({ id: 'trade', domain: 'commerce', en: [] });
  lexicon.add({ id: 'money', domain: 'finance', en: [] });
  const entity = (label, parents = []) => ({
    labels: { en: { value: label } },
    claims: {
      P279: parents.map((id) => ({
        mainsnak: { datavalue: { value: { id } } },
      })),
    },
  });
  const entities = {
    Q1: entity('finance', ['Q2']),
    Q2: entity('commerce', ['Q4']),
    Q4: entity('activity'),
  };
  const ids = { finance: 'Q1', commerce: 'Q2' };
  await populateContexts(lexicon, {
    cache: false,
    contextDepth: 1,
    fetchImpl: (url) => {
      const p = new URL(url).searchParams;
      const body =
        p.get('action') === 'wbsearchentities'
          ? { search: [{ id: ids[p.get('search')], label: p.get('search') }] }
          : {
              entities: Object.fromEntries(
                p
                  .get('ids')
                  .split('|')
                  .map((id) => [id, entities[id]])
              ),
            };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  });
  const network = lexicon.contextNetwork;
  assert.deepEqual([...network.parentsOf('commerce')], ['activity']);
  assert.deepEqual([...network.contextsOf('money')].sort(), [
    'commerce',
    'finance',
  ]);
  assert.deepEqual([...network.contextsOf('trade')].sort(), [
    'activity',
    'commerce',
  ]);
});

test('contexts stay within the loaded horizon, whatever else was loaded', () => {
  const n = new ContextNetwork();
  n.horizon = 2;
  n.define('electronics', ['technique']);
  n.define('technique', ['activity']);
  n.define('activity'); // cut at the horizon when only electronics was loaded
  n.linkConcept({ id: 'bus-conductor', contexts: ['electronics'] });
  const alone = [...n.contextsOf('bus-conductor')].sort();
  const depth = n.depth('electronics', n.closure('bus-conductor'));
  // another label loads activity's own parents
  n.define('activity', ['stative', 'process']);
  n.define('process', ['occurrent']);
  assert.deepEqual([...n.contextsOf('bus-conductor')].sort(), alone);
  assert.deepEqual(alone, ['activity', 'electronics', 'technique']);
  assert.equal(n.depth('electronics', n.closure('bus-conductor')), depth);
  assert.ok(!n.isA('electronics', 'stative', n.closure('bus-conductor')));
  assert.ok(n.isA('electronics', 'stative'));
});

function vocabulary() {
  const lexicon = loadLexicon({ fresh: true });
  const add = (id, word, domain, russian, prior = 0) =>
    lexicon.add({
      id,
      en: [{ pos: 'noun', lemma: word, words: [word] }],
      domain,
      prior,
      cues: [],
      classes: [],
      ru: { pos: 'noun', lemma: russian, gender: 'm' },
    });
  add('sample.finance', 'sample', 'finance', 'банк');
  add('sample.geography', 'sample', 'geography', 'берег');
  add('deposit.only', 'deposit', 'finance', 'вклад');
  lexicon.byLemma.set('noun:deposit', ['deposit.only']);
  add('stream.only', 'stream', 'geography', 'поток');
  lexicon.contextNetwork.define('commerce');
  lexicon.contextNetwork.define('finance', ['commerce']);
  return lexicon;
}

test('statistics count words once, rank specificity, and reject incoherent options', () => {
  const lexicon = vocabulary();
  const words = [
    { candidates: ['sample.finance', 'sample.finance', 'sample.geography'] },
    { candidates: ['deposit.only'] },
  ];
  assert.deepEqual(rankContexts(words, lexicon)[0], {
    context: 'finance',
    count: 2,
    depth: 2,
  });
  assert.ok(
    !rankContexts(words, lexicon, { coherent: true }).some(
      (r) => r.context === 'geography'
    )
  );
});

test('explicit context outweighs statistics and positional evidence; weights disable each method', () => {
  const lexicon = vocabulary();
  const source = 'The sample.';
  const topic = 'The deposit. The deposit.';
  assert.equal(translateDocument(source, { lexicon, topic }).text, 'Банк.');
  assert.equal(
    translateDocument(source, { lexicon, topic, context: 'geography' }).text,
    'Берег.'
  );
  assert.equal(
    translateDocument(source, {
      lexicon,
      topic,
      context: 'geography',
      methods: { explicitContext: 0 },
    }).text,
    'Банк.'
  );
  assert.equal(
    translateDocument('The stream sample.', {
      lexicon,
      context: 'finance',
    }).sentences[0].senses.find((s) => s.word === 'sample').chosen,
    'sample.finance'
  );
  assert.equal(
    translateDocument('The stream sample.', {
      lexicon,
      topic,
    }).sentences[0].senses.find((s) => s.word === 'sample').chosen,
    'sample.geography'
  );
});

test('syntactic partner takes priority over nearer linear indicator', () => {
  const lexicon = vocabulary();
  const node = { token: 3, candidates: ['sample.finance', 'sample.geography'] };
  const partner = { token: 0, candidates: ['stream.only'] };
  const near = { token: 2, candidates: ['deposit.only'] };
  const clause = {
    subject: { head: node, modifier: partner },
    adjunct: { phrase: { head: near } },
  };
  assert.equal(
    positionalContext(
      node,
      [{ node }, { node: partner }, { node: near }],
      clause,
      lexicon
    ).context,
    'geography'
  );
});

test('up to five independent context branches are labelled and coherent', () => {
  const lexicon = vocabulary();
  const result = translateDocument('The sample.', { lexicon, options: 5 });
  assert.deepEqual(
    result.options.map((o) => o.context),
    ['finance', 'commerce', 'geography']
  );
  assert.equal(
    result.options.find((o) => o.context === 'geography').text,
    'Берег.'
  );
  assert.equal(
    translateDocument('The deposit sample.', { lexicon, options: 5 }).options
      .length,
    2
  );
  lexicon.byLemma.set('noun:stream', ['stream.only']);
  assert.equal(
    translateDocument('The deposit stream.', { lexicon, options: 5 }).options
      .length,
    0
  );
});

test('context-only lino overrides do not replace public vocabulary', () => {
  const lexicon = vocabulary();
  lexicon.addTree(parseLino('concept sample.finance\n  contexts (geography)'));
  assert.equal(lexicon.get('sample.finance').ru.lemma, 'банк');
  assert.deepEqual(
    [...lexicon.contextNetwork.contextsOf('sample.finance')],
    ['geography']
  );
});

test('unlabelled definitions need two public field terms and respect empty local bindings', async () => {
  const lexicon = new Lexicon();
  lexicon.add({
    id: 'gratis',
    en: [{ lemma: 'free', words: ['free'], pos: 'adj' }],
    gloss: 'without payment',
    cues: ['payment'],
  });
  lexicon.add({
    id: 'liberty',
    en: [{ lemma: 'free', words: ['free'], pos: 'adj' }],
    gloss: 'without restrictions',
    cues: ['restrictions'],
  });
  const pages = {
    commerce: '==English==\n===Noun===\n# The exchange of goods and services.',
    payment:
      '==English==\n===Noun===\n# Money paid in exchange for goods or services.',
    restrictions: '==English==\n===Noun===\n# A rule limiting liberty.',
  };
  const requests = [];
  const fetchImpl = (url) => {
    requests.push(url);
    const titles = new URL(url).searchParams.get('titles').split('|');
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          query: {
            pages: titles.map((title) => ({
              title,
              revisions: [{ slots: { main: { content: pages[title] || '' } } }],
            })),
          },
        }),
    });
  };
  await expandContextDefinitions(lexicon, 'commerce', {
    text: 'The free plan',
    cache: true,
    fetchImpl,
  });
  assert.ok(lexicon.contextNetwork.contextsOf('gratis').has('commerce'));
  assert.equal(lexicon.contextNetwork.contextsOf('liberty').size, 0);
  const replay = new Lexicon();
  for (const concept of lexicon.concepts.values()) {
    replay.add({ ...concept, contexts: undefined });
  }
  const count = requests.length;
  await expandContextDefinitions(replay, 'commerce', {
    text: 'The free plan',
    cache: true,
    fetchImpl: () => {
      throw Object.assign(new Error('must replay cached public responses'), {
        fatal: true,
      });
    },
  });
  assert.equal(requests.length, count);
  assert.ok(replay.contextNetwork.contextsOf('gratis').has('commerce'));
  lexicon.contextNetwork.addTree(parseLino('concept gratis\n  contexts'));
  assert.equal(lexicon.contextNetwork.contextsOf('gratis').size, 0);
});

test('an ambiguous capitalized dictionary noun retains its public senses', () => {
  const lexicon = loadLexicon({ fresh: true });
  const add = (id, russian, capital, cues) =>
    lexicon.add({
      id,
      capital,
      cues,
      classes: [],
      en: [{ lemma: 'mercury', words: ['mercury'], pos: 'noun' }],
      ru: { pos: 'noun', lemma: russian, gender: 'm' },
    });
  add('element', 'ртуть', false, ['metallic']);
  add('planetary', 'Меркурий', true, ['planet']);
  for (const [word, russian] of [
    ['planet', 'планета'],
    ['metal', 'металл'],
  ]) {
    lexicon.add({
      id: `kind:${word}`,
      cues: [],
      classes: [],
      en: [{ lemma: word, words: [word], pos: 'noun' }],
      ru: {
        pos: 'noun',
        lemma: russian,
        gender: word === 'planet' ? 'f' : 'm',
      },
    });
  }
  lexicon.setDocumentNames(new Set(['Mercury']), new Set());
  assert.equal(
    translateDocument('Mercury is a planet.', { lexicon }).text,
    'Меркурий — планета.'
  );
  assert.equal(
    translateDocument('Mercury is a metal.', { lexicon }).text,
    'Ртуть — металл.'
  );
});

test('a compound cannot swallow a finite verb followed by its determiner object', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'charges-compound',
    en: [{ pos: 'noun', lemma: 'bank charge', words: ['bank', 'charge'] }],
    ru: { pos: 'noun', lemma: 'комиссия', gender: 'f' },
  });
  lexicon.add({
    id: 'charge-verb',
    en: [{ pos: 'verb', lemma: 'charge', words: ['charge'] }],
    cues: [],
    classes: [],
    ru: {
      pos: 'verb',
      lemma: 'взимать',
      present: [
        'взимаю',
        'взимаешь',
        'взимает',
        'взимаем',
        'взимаете',
        'взимают',
      ],
      government: { case: 'acc', preposition: null },
    },
  });
  lexicon.add({
    id: 'fee-noun',
    en: [{ pos: 'noun', lemma: 'fee', words: ['fee'] }],
    cues: [],
    classes: [],
    ru: { pos: 'noun', lemma: 'плата', gender: 'f' },
  });
  assert.equal(
    translateDocument('The bank charges a fee.', { lexicon }).text,
    'Банк взимает плату.'
  );
});
