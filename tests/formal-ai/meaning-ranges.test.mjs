/** Offline range metadata and reverse evidence, independent of live dictionaries. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  formalize,
  statement,
  toLino,
} from '../../formal-ai/src/formalize.mjs';
import {
  rangeOverlap,
  scoreRanges,
} from '../../formal-ai/src/meaning-ranges.mjs';
import { roundTripEvidence } from '../../formal-ai/src/round-trip.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const head = (pos, ids) => ({ pos, candidates: ids, concept: ids[0] });

test('all content roles keep ranges beside legacy scalar links, including nonfinite verbs', () => {
  const verb = head('verb', ['v1', 'v2']);
  const adjective = {
    ...head('adj', ['a1', 'a2']),
    degree: head('adv', ['d1', 'd2']),
  };
  const adv = { type: 'adv', ...head('adv', ['r1', 'r2']) };
  const clause = {
    type: 'clause',
    tense: 'present',
    verb,
    subject: { head: head('noun', ['n1', 'n2']), adjs: [adjective] },
    objects: [],
    mods: [adv],
    complement: { type: 'adj', ...adjective },
    xcomp: { verb, objects: [], mods: [adv] },
  };
  const s = statement(clause, loadLexicon());
  assert.equal(s.predicate, 'v1');
  assert.deepEqual(s.candidates, ['v1', 'v2']);
  assert.deepEqual(s.subject.candidates, ['n1', 'n2']);
  assert.deepEqual(s.subject.properties[0].candidates, ['a1', 'a2']);
  assert.deepEqual(s.complement.candidates, ['a1', 'a2']);
  assert.deepEqual(s.complement.degreeCandidates, ['d1', 'd2']);
  assert.deepEqual(s.modifiers[0].candidates, ['r1', 'r2']);
  assert.deepEqual(s.complementClause.candidates, ['v1', 'v2']);
  assert.match(toLino([s]), /candidates \(v1 v2\)/);
});

test('formalize preserves non-tied alternatives rather than equating range with score ties', () => {
  const lexicon = loadLexicon({ fresh: true });
  const ids = lexicon.lookup('verb', 'read');
  const existing = lexicon.get(ids[0]);
  lexicon.add({ ...existing, id: 'test:read:alternative', prior: -20 });
  const s = formalize('I read a book.', lexicon).statements[0];
  assert.ok(s.candidates.includes('test:read:alternative'));
  assert.ok(s.candidates.includes(s.predicate));
});

test('Jaccard rewards coverage and penalizes added meanings; absent data is unknown', () => {
  assert.equal(rangeOverlap(['vary', 'fluctuate'], ['vary', 'fluctuate']), 1);
  assert.equal(rangeOverlap(['vary', 'fluctuate'], ['vary', 'wander']), 1 / 3);
  assert.equal(rangeOverlap(['vary'], ['wander']), 0);
  assert.equal(rangeOverlap(['vary'], []), null);
});

test('grammar narrows the source independently of reverse scores; switch is local', () => {
  const concepts = new Map([
    [
      'v1',
      { gloss: 'to carry', frames: ['transitive'], englishRange: ['carry'] },
    ],
    [
      'v2',
      {
        gloss: 'to roam',
        frames: ['intransitive'],
        englishRange: ['roam', 'wander'],
      },
    ],
  ]);
  const lexicon = { get: (id) => concepts.get(id) };
  const node = head('verb', ['v1', 'v2']);
  const clause = { verb: node, objects: [{ head: {} }] };
  for (const weight of [0, 1]) {
    const scores = { v1: 0, v2: 0 };
    const evidence = { v1: [], v2: [] };
    scoreRanges(node, clause, lexicon, scores, evidence, {
      rangeOverlap: weight,
    });
    assert.deepEqual(node.range, ['v1']);
    assert.equal(scores.v1, weight);
    assert.equal(scores.v2, 0);
    assert.equal(evidence.v1.length, weight);
  }
});

test('pre-pass reads ru English blocks and unions different English tables listing the lemma', async () => {
  const ru = { lemma: 'бродить' };
  const sense = { gloss: 'wander freely', russian: [{ word: ru.lemma }] };
  const plans = [
    { lemma: 'range', pos: 'verb', senses: [sense] },
    {
      lemma: 'roam',
      pos: 'verb',
      senses: [{ gloss: 'travel widely', russian: [{ word: ru.lemma }] }],
    },
  ];
  let fetched = false;
  const check = await roundTripEvidence(plans, new Map(), new Map(), {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(new URL(url).host, 'ru.wiktionary.org');
      assert.equal(options.headers['user-agent'], USER_AGENT);
      fetched = true;
      return {
        ok: true,
        json: () => ({
          query: {
            pages: [
              {
                title: ru.lemma,
                revisions: [
                  {
                    slots: {
                      main: {
                        content:
                          '= {{-ru-}} =\n{{перев-блок|двигаться|en=[[wander]], {{t|en|ramble}}}}\n{{перев-блок|другое|en=[[ferment]]}}',
                      },
                    },
                  },
                ],
              },
            ],
          },
        }),
      };
    },
  });
  assert.ok(fetched);
  const range = check.range(plans[0], ru);
  for (const term of ['wander', 'ramble', 'ferment', 'travel', 'widely']) {
    assert.ok(range.includes(term), term);
  }
  assert.equal(check.range(plans[0], { lemma: 'неизвестный' }).length, 0);
});
