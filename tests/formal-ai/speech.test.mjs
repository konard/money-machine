/** Reported speech, existential questions, place adverbs and name gender. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { givenNameGender } from '../../formal-ai/src/public-expressions.mjs';

const ru = (text) => translateDocument(text).text;

test('a past verb before a clause is the predicate, not a participle', () => {
  assert.match(ru('Mary said that she was tired.'), /^Мэри \S+ла, что она/);
  // without "that" too
  assert.match(
    ru('Mary said she was here.'),
    /^Мэри \S+ла, что она была здесь/
  );
});

test('"Is there…?" asks whether something exists', () => {
  assert.equal(ru('Is there a bank here?'), 'Здесь есть банк?');
  assert.equal(ru('We were there.'), 'Мы были там.');
});

test('a given name tells its sex from public data', () => {
  const page = (sex) =>
    `==English==\n===Proper noun===\n{{en-prop}}\n\n# {{given name|en|${sex}}}\n`;
  assert.equal(givenNameGender(page('female')), 'f');
  assert.equal(givenNameGender(page('male')), 'm');
  const item = (id) => ({
    claims: { P31: [{ mainsnak: { datavalue: { value: { id } } } }] },
  });
  assert.equal(givenNameGender(item('Q11879590')), 'f');
  assert.equal(givenNameGender(item('Q12308941')), 'm');
  assert.equal(givenNameGender(null), null);
});

test('"as": equatives, roles and a clause link', () => {
  assert.match(ru('Tom is as tall as Mary.'), /такой же высокий, как Мэри\.$/);
  assert.match(ru('Tom himself wrote the letter.'), /^Сам \S+ написал письмо/);
  assert.equal(ru('The book itself is cheap.'), 'Сама книга дешёвая.');
  assert.match(ru('As I said, the price is low.'), /^Как я \S+л, цена/);
});
