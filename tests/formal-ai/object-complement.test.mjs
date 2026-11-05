/** Object complements: "keep repos active", "keep your account active". */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cursor } from '../../formal-ai/src/english/cursor.mjs';
import {
  objectBeforeState,
  objectComplement,
  stateSense,
  statesObject,
} from '../../formal-ai/src/english/object-complement.mjs';
import { documentTopicContext } from '../../formal-ai/src/topic-context.mjs';

const concepts = new Map(
  [
    {
      id: 'keep:4',
      labels: ['ditransitive'],
      definition:
        'To maintain the condition of; to preserve in a certain state.',
    },
    { id: 'keep:1', definition: 'To maintain possession of.' },
    { id: 'render:1', definition: 'To cause to become.' },
    { id: 'ship:1', labels: ['transitive'], definition: 'To send by water.' },
    {
      id: 'stay:1',
      labels: ['intransitive'],
      definition: 'To remain in a certain state.',
    },
  ].map((c) => [c.id, c])
);
const lexicon = { get: (id) => concepts.get(id), concepts };

const token = (text, ...pos) => ({
  text,
  lower: text,
  kind: pos[0] === 'punct' ? 'punct' : 'word',
  readings: pos.map((p) => ({
    pos: p,
    lemma: text,
    features: {},
    concepts: [`${text}:${p}`],
  })),
});

test('verb senses that keep or bring an object into a state', () => {
  assert.ok(stateSense(concepts.get('keep:4')));
  assert.ok(stateSense(concepts.get('render:1')));
  assert.ok(!stateSense(concepts.get('keep:1')));
  // an intransitive sense has no object to put in a state
  assert.ok(!stateSense(concepts.get('stay:1')));
  assert.ok(statesObject(['keep:1', 'keep:4'], lexicon));
  assert.ok(!statesObject(['ship:1'], lexicon));
});

test('an adjective after the object of a state verb is its complement', () => {
  const tokens = [token('active', 'adj', 'noun'), token('.', 'punct')];
  const out = { objects: [{}], mods: [], complement: null };
  const c = new Cursor(tokens);
  assert.ok(
    objectComplement(c, 'event', out, { lexicon, verbConcepts: ['keep:4'] })
  );
  assert.equal(out.complement.object, true);
  assert.equal(c.i, 1);
  // "ship orders fast": a verb with no state sense keeps its adverb
  const other = { objects: [{}], mods: [], complement: null };
  assert.ok(
    !objectComplement(new Cursor(tokens), 'event', other, {
      lexicon,
      verbConcepts: ['ship:1'],
    })
  );
});

test('an object that swallowed the state as a compound head is read again', () => {
  const tokens = [token('account', 'noun'), token('active', 'adj', 'noun')];
  const c = new Cursor(tokens);
  c.i = 2; // a noun phrase read "account active"
  const parse = (k) => {
    const np = { head: k.next() };
    return np;
  };
  const np = objectBeforeState(c, 0, { head: tokens[1] }, parse, {
    lexicon,
    verbConcepts: ['keep:4'],
  });
  assert.equal(np.head.text, 'account');
  assert.equal(c.i, 1);
});

test('the head of a definition does not vote for the document topic', () => {
  const saw = {
    id: 'set:5',
    genus: 'amount',
    definition: 'The amount by which the teeth of a saw protrude.',
  };
  const group = {
    id: 'set:31',
    definition: 'A matching collection of things.',
  };
  const lx = { get: (id) => ({ 'set:5': saw, 'set:31': group })[id] };
  const node = { lemma: 'set', candidates: ['set:5', 'set:31'] };
  const profile = new Map([['fee', new Set(['fee', 'amount'])]]);
  assert.equal(documentTopicContext(node, saw, lx, profile), 0);
});
