/** Offline checks for dictionary-derived whole-document evidence. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lexicon, loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  topicProfile,
  documentTopicContext,
} from '../../formal-ai/src/topic-context.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import {
  TranslationContext,
  translateSentence,
} from '../../formal-ai/src/translate.mjs';
import { quantityRange } from '../../formal-ai/src/russian/quantity-range.mjs';
import { renderModifiers } from '../../formal-ai/src/russian/naturalize.mjs';
import {
  englishEntries,
  fetchPages,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { DocumentMemory, resolveSenses } from '../../formal-ai/src/senses.mjs';

function add(lexicon, id, word, definition, ru, pos = 'noun') {
  const concept = {
    id,
    gloss: definition,
    definition,
    cues: [],
    classes: [],
    source: 'fixture',
    en: [{ pos, words: [word], lemma: word }],
    ru: { pos, lemma: ru, gender: 'm' },
  };
  lexicon.add(concept);
  return concept;
}

function fixture() {
  const lexicon = new Lexicon();
  const commercial = add(
    lexicon,
    'free.payment',
    'free',
    'Obtainable without any payment.',
    'бесплатный',
    'adj'
  );
  const liberty = add(
    lexicon,
    'free.liberty',
    'free',
    'Not imprisoned or enslaved.',
    'свободный',
    'adj'
  );
  const node = {
    text: 'free',
    lemma: 'free',
    candidates: [liberty.id, commercial.id],
  };
  return { lexicon, commercial, liberty, node };
}

test('public dictionary definitions supply topic expansion with a stubbed fetch', async () => {
  const { lexicon, commercial, node } = fixture();
  const pages = await fetchPages(['invoice'], {
    cache: false,
    fetchImpl: (_url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: [
                {
                  title: 'invoice',
                  revisions: [
                    {
                      slots: {
                        main: {
                          content:
                            '==English==\n===Noun===\n# A request for payment.\n{{trans-top|request for payment}}\n* Russian: {{t|ru|счёт|m}}\n{{trans-bottom}}',
                        },
                      },
                    },
                  ],
                },
              ],
            },
          }),
      });
    },
  });
  const sense = englishEntries(pages.get('invoice'))[0].senses[0];
  add(
    lexicon,
    'invoice.public',
    'invoice',
    sense.definition,
    sense.russian[0].word
  );
  assert.ok(
    documentTopicContext(
      node,
      commercial,
      lexicon,
      topicProfile('Invoice.', lexicon)
    ) > 0
  );
});

test('a document supplies distinctive terms even outside the ambiguous sentence', () => {
  const { lexicon, commercial, liberty, node } = fixture();
  const profile = topicProfile('Subscription payments. A free plan.', lexicon);
  assert.ok(documentTopicContext(node, commercial, lexicon, profile) > 0);
  assert.equal(documentTopicContext(node, liberty, lexicon, profile), 0);
  const unrelated = topicProfile(
    'The prisoners escaped. Enslaved workers.',
    lexicon
  );
  assert.equal(documentTopicContext(node, commercial, lexicon, unrelated), 0);
  assert.ok(documentTopicContext(node, liberty, lexicon, unrelated) > 0);
});

test('a topic occurrence is not counted again through decaying document memory', () => {
  const { lexicon, commercial, node } = fixture();
  commercial.cues = ['payment'];
  const memory = new DocumentMemory();
  memory.setTopic('Payments.');
  memory.profile = topicProfile('Payments.', lexicon);
  memory.remember(['payment']);
  const decisions = resolveSenses(
    {
      tokens: [{ index: 0, text: 'free', lower: 'free', readings: [] }],
      clauses: [{ type: 'fragment', head: { ...node, pos: 'adj', token: 0 } }],
      unknown: [],
      leftover: [],
    },
    lexicon,
    memory
  );
  assert.equal(decisions[0].chosen, commercial.id);
  assert.ok(
    !decisions[0].evidence.some((e) => e.startsWith('document memory'))
  );
});

test('unambiguous definitions expand a topic without importing remote homonyms', () => {
  const { lexicon, commercial, node } = fixture();
  add(lexicon, 'invoice', 'invoice', 'A request for payment.', 'счёт');
  assert.ok(
    documentTopicContext(
      node,
      commercial,
      lexicon,
      topicProfile('Invoice', lexicon)
    ) > 0
  );
  add(lexicon, 'invoice.other', 'invoice', 'A forest animal.', 'зверь');
  assert.equal(
    documentTopicContext(
      node,
      commercial,
      lexicon,
      topicProfile('Invoice', lexicon)
    ),
    0
  );
  assert.equal(
    documentTopicContext(
      node,
      commercial,
      lexicon,
      topicProfile('Free.', lexicon)
    ),
    0
  );
});

test('synonyms do not dilute distinctiveness; protected spans and repetitions add no evidence', () => {
  const { lexicon, commercial, liberty, node } = fixture();
  const ordinary = topicProfile('Payments.', lexicon);
  const score = documentTopicContext(node, commercial, lexicon, ordinary);
  for (let i = 0; i < 6; i += 1) {
    const id = `synonym${i}`;
    add(lexicon, id, 'free', commercial.definition, 'бесплатный', 'adj');
    node.candidates.push(id);
  }
  assert.equal(
    documentTopicContext(node, commercial, lexicon, ordinary),
    score
  );
  assert.equal(
    documentTopicContext(
      node,
      commercial,
      lexicon,
      topicProfile('Payments payments payments.', lexicon)
    ),
    score
  );
  const protectedProfile = topicProfile(
    '`payment` https://example.org/payment\n```\npayment\n```',
    lexicon
  );
  assert.equal(
    documentTopicContext(node, commercial, lexicon, protectedProfile),
    0
  );
  const common = { ...liberty, definition: commercial.definition };
  lexicon.concepts.set(liberty.id, common);
  assert.equal(documentTopicContext(node, commercial, lexicon, ordinary), 0);
});

test('document and sentence APIs accept independent topics and retain useful sentence-only defaults', () => {
  const lexicon = loadLexicon({ fresh: true });
  const { commercial, liberty } = fixture();
  lexicon.add(commercial);
  lexicon.add(liberty);
  add(lexicon, 'plan.fixture', 'plan', 'An intended course of action.', 'план');
  const options = { lexicon, topic: 'Subscription payment and pricing.' };
  const result = translateDocument('A free plan. It is free.', options);
  assert.match(result.text, /Бесплатный/);
  assert.ok(
    result.sentences.every(
      (s) =>
        s.senses.find((d) => d.word.toLowerCase() === 'free')?.chosen ===
        commercial.id
    )
  );
  assert.equal(
    translateSentence(
      'A free plan.',
      new TranslationContext(options)
    ).senses.find((d) => d.word === 'free').chosen,
    commercial.id
  );
  assert.ok(translateDocument('A free plan.', { lexicon }).text.length);
  assert.equal(
    translateDocument('A free plan.', {
      lexicon,
      topic: 'Imprisoned and enslaved.',
    }).sentences[0].senses.find((d) => d.word === 'free').chosen,
    liberty.id
  );
});

test('only a paired quantity endpoint becomes до, without mutating the source modifiers', () => {
  const from = {
    kind: 'relation',
    relation: 'rel.from',
    entity: { name: '$5' },
  };
  const to = { kind: 'relation', relation: 'rel.to', entity: { name: '$50' } };
  assert.equal(quantityRange([from, to])[1].relation, 'rel.until');
  assert.equal(to.relation, 'rel.to');
  assert.equal(quantityRange([to])[0], to);
  assert.equal(
    quantityRange([
      { ...from, entity: { name: 'London' } },
      { ...to, entity: { name: 'Paris' } },
    ])[1].relation,
    'rel.to'
  );
  assert.deepEqual(
    renderModifiers([from, to], { lexicon: new Lexicon(), notes: new Set() })
      .after,
    ['от $5', 'до $50']
  );
});
