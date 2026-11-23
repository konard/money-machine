import { test } from 'node:test';
import assert from 'node:assert/strict';
import { methodWeight, parseMethods } from '../../formal-ai/src/methods.mjs';

test('method switches parse weights, on and off', () => {
  assert.deepEqual(parseMethods('documentTopic=off, roundTrip=0.25,x=on'), {
    documentTopic: 0,
    roundTrip: 0.25,
    x: 1,
  });
  assert.deepEqual(parseMethods('bad=maybe'), {});
});

test('a call option overrides the default weight of a method', () => {
  assert.equal(methodWeight({ documentTopic: 0 }, 'documentTopic'), 0);
  assert.equal(typeof methodWeight(undefined, 'documentTopic'), 'number');
  assert.equal(methodWeight(undefined, 'unknownMethod'), 1);
});
