import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';
import { englishRoundTrip } from '../../formal-ai/src/english/round-trip.mjs';

const lexicon = loadLexicon({ fresh: true });
const ru = (text) => translateDocument(text, { lexicon }).text;

test('a negation before "or" covers both predicates: ¬(A ∨ B)', () => {
  const [first, second] = formalize(
    'He does not read or write.',
    lexicon
  ).statements;
  assert.equal(first.polarity, 'negative');
  assert.equal(second.polarity, 'negative');
  assert.equal(second.sharedPolarity, true);
  assert.equal(ru('He does not read or write.'), 'Он не читает и не пишет.');
  const trip = englishRoundTrip('He does not read or write.', lexicon);
  assert.ok(trip.exact, JSON.stringify(trip.differences));
  assert.equal(trip.english, 'He does not read or write.');
});

test('a shared modal carries the shared negation once', () => {
  assert.equal(ru('I cannot read or write.'), 'Я не могу читать или писать.');
});

test('a negation before "and" stays with its own predicate', () => {
  const [, second] = formalize(
    'I do not read books and write letters.',
    lexicon
  ).statements;
  assert.equal(second.polarity, 'positive');
  assert.equal(second.sharedPolarity, undefined);
});

test('"no" keeps its determiner and negates the statement', () => {
  const [s] = formalize('No cat can fly.', lexicon).statements;
  assert.equal(s.subject.determiner, 'det.no');
  assert.equal(s.polarity, 'negative');
  assert.equal(ru('No cat can fly.'), 'Никакая кошка не может лететь.');
  const trip = englishRoundTrip('No cat can fly.', lexicon);
  assert.ok(trip.exact, JSON.stringify(trip.differences));
  assert.equal(trip.english, 'No cat can fly.');
});

test('"neither" is a negative determiner: ни один … не', () => {
  const [s] = formalize('Neither answer is correct.', lexicon).statements;
  assert.equal(s.subject.determiner, 'det.neither');
  assert.equal(s.polarity, 'negative');
  assert.match(ru('Neither answer is correct.'), /^Ни один ответ не /);
  assert.match(
    englishRoundTrip('Neither answer is correct.', lexicon).english,
    /^Neither answer is /
  );
});

test('"neither A nor B": a negative pair, «ни A, ни B не …»', () => {
  const [s] = formalize(
    'Neither the cat nor the dog sleeps.',
    lexicon
  ).statements;
  assert.equal(s.subject.coordination, 'conj.nor');
  assert.equal(s.subject.correlative, true);
  assert.equal(s.polarity, 'negative');
  assert.equal(
    ru('Neither the cat nor the dog sleeps.'),
    'Ни кошка, ни собака не спят.'
  );
  assert.equal(
    ru('I like neither tea nor coffee.'),
    'Мне не нравятся ни чай, ни кофе.'
  );
  for (const sentence of [
    'Neither the cat nor the dog sleeps.',
    'Neither the cats nor the dogs sleep.',
    'I like neither tea nor coffee.',
  ]) {
    const trip = englishRoundTrip(sentence, lexicon);
    assert.ok(trip.exact, JSON.stringify(trip.differences));
    assert.equal(trip.english, sentence);
  }
});

test('"either A or B" agrees with the nearer item: «либо A, либо B придёт»', () => {
  assert.match(
    ru('Either Tom or Mary will come.'),
    /^Либо .+, либо .+ придёт\.$/
  );
  const trip = englishRoundTrip('Either Tom or Mary will come.', lexicon);
  assert.ok(trip.exact, JSON.stringify(trip.differences));
  assert.equal(trip.english, 'Either Tom or Mary will come.');
});
