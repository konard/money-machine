/** A gloss that names its object ("take on a position") wants that object. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSenses } from '../../formal-ai/src/senses.mjs';

function choose(objectConcept) {
  const entries = new Map([
    ['suppose', { id: 'suppose', gloss: 'to suppose to be true', prior: 0.3 }],
    ['position', { id: 'position', gloss: 'take on a position', prior: 0.2 }],
  ]);
  const verb = {
    token: 0,
    text: 'assumes',
    pos: 'verb',
    candidates: [...entries.keys()],
  };
  const object = { token: 1, text: 'x', pos: 'noun', concept: objectConcept };
  const parsed = {
    tokens: [
      {
        index: 0,
        lower: 'assumes',
        kind: 'word',
        readings: [{ lemma: 'assume' }],
      },
      { index: 1, lower: 'x', kind: 'word', readings: [{ lemma: 'x' }] },
    ],
    clauses: [{ verb, objects: [{ head: object }] }],
  };
  resolveSenses(parsed, { get: (id) => entries.get(id) });
  return verb.concept;
}

test('an unrelated object does not favour a sense naming another object', () => {
  assert.equal(choose('wikt:income:noun:1'), 'suppose');
});

test('the named object itself still favours that sense', () => {
  assert.equal(choose('wikt:position:noun:1'), 'position');
});
