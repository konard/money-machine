/** Bare infinitives, copulative verbs and defining verbs, from public data. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { senseFrames } from '../../formal-ai/src/sources/verb-frames.mjs';
import { bareInventory } from '../../formal-ai/src/sources/infinitive-frames.mjs';
import { definingVerbs } from '../../formal-ai/src/sources/sense-data.mjs';
import {
  bareInfinitiveOf,
  objectBeforeBareVerb,
} from '../../formal-ai/src/english/infinitive.mjs';
import { linksAdjective } from '../../formal-ai/src/english/object-complement.mjs';
import { closedClass } from '../../formal-ai/src/unknown-words.mjs';
import { Cursor } from '../../formal-ai/src/english/cursor.mjs';

test('Wiktionary qualifiers mark bare-infinitive and copulative senses', () => {
  const let1 =
    '# {{lb|en|transitive}} To [[allow]] to, not to prevent {{qualifier|+ infinitive, but usually without {{m|en|to}}}}.';
  const make =
    '# {{lb|en|ditransitive|second object is a verb}} To [[cause]] (to do something).';
  const stay =
    '# {{lb|en|intransitive|copulative}} To [[continue]] to have a particular [[quality]].';
  assert.ok(senseFrames(let1, 'let').includes('bare-infinitive'));
  assert.ok(senseFrames(make, 'make').includes('bare-infinitive'));
  assert.ok(senseFrames(stay, 'stay').includes('copulative'));
  assert.ok(!senseFrames(stay, 'stay').includes('bare-infinitive'));
});

test('the catenative appendix lists verbs before a bare infinitive', () => {
  const text = [
    "== Followed by a ''to''-infinitive ==",
    '[[want]]',
    '== Followed by a bare infinitive ==',
    '[[help]]',
    '[[go]] / [[come]]',
    "==Followed by ''and''==",
    '[[try]]',
  ].join('\n');
  assert.deepEqual([...bareInventory(text)], ['help', 'go', 'come']);
});

test('a verb sense is not about the verbs that define it', () => {
  const sense = {
    id: 'wikt:do:verb:7',
    definition: 'To work for or on, by way of caring for; to look after.',
  };
  assert.deepEqual([...definingVerbs(sense)], ['work', 'look']);
  assert.equal(definingVerbs({ id: 'wikt:work:noun:1', gloss: 'to' }).size, 0);
});

test('bare infinitives and linking verbs read concept flags', () => {
  const concepts = new Map([
    ['help:1', { bareInfinitive: true }],
    ['let:1', { frames: ['bare-infinitive'] }],
    ['stay:1', { frames: ['copulative'] }],
    ['ship:1', { frames: ['transitive'] }],
  ]);
  const lexicon = { get: (id) => concepts.get(id) };
  const of = bareInfinitiveOf(lexicon);
  assert.equal(of({ concepts: ['help:1'] }), true);
  assert.equal(of({ concepts: ['let:1'] }), true);
  assert.equal(of({ concepts: ['ship:1'] }), false);
  assert.equal(linksAdjective(['stay:1'], lexicon), true);
  assert.equal(linksAdjective(['ship:1'], lexicon), false);
});

test('"make the agent write tests": the object ends before the verb', () => {
  const token = (text, ...readings) => ({
    text,
    lower: text,
    kind: 'word',
    readings: readings.map(([pos, form]) => ({
      pos,
      lemma: text,
      concepts: [],
      features: form ? { form } : {},
    })),
  });
  const c = new Cursor([
    token('the', ['det']),
    token('agent', ['noun']),
    token('write', ['noun'], ['verb', 'base']),
    token('tests', ['noun']),
  ]);
  c.i = 4;
  const parse = (k) => {
    k.i = k.tokens.length;
    return { type: 'np', size: k.tokens.length };
  };
  const np = objectBeforeBareVerb(c, 0, { type: 'np', size: 4 }, parse, {
    bareInfinitive: true,
  });
  assert.equal(np.size, 2);
  assert.equal(c.i, 2);
  const same = new Cursor(c.tokens);
  same.i = 4;
  const kept = objectBeforeBareVerb(same, 0, { size: 4 }, parse, {});
  assert.equal(kept.size, 4);
});

test('"do" is looked up as a verb of its own', () => {
  const lexicon = { lookup: () => [], get: () => null, irregular: () => [] };
  assert.equal(closedClass('do', lexicon), false);
  assert.equal(closedClass('the', lexicon), true);
});
