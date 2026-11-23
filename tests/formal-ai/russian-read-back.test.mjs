import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';
import {
  readBack,
  russianFormIndex,
  sourceLinks,
} from '../../formal-ai/src/russian/read-back.mjs';

const lexicon = loadLexicon({ fresh: true });
const index = russianFormIndex(lexicon);
const check = (english, russian) =>
  readBack(
    russian ?? translateDocument(english, { lexicon }).text,
    formalize(english, lexicon),
    lexicon,
    index
  );
const statusOf = (result, concept) =>
  result.links.find((l) => l.concept === concept);

test('translations read back to the meta links they came from', () => {
  for (const english of [
    'I do not read books.',
    'She will write a letter.',
    'The pen is on the table.',
    'I have a pen.',
    'Good morning!',
  ]) {
    const result = check(english);
    assert.ok(result.survives, `${english}: ${JSON.stringify(result.links)}`);
  }
});

test('a Russian tense narrows a tense range without losing it', () => {
  const result = check('I read a book.', 'Я прочитал книгу.');
  assert.ok(result.survives);
  assert.match(statusOf(result, 'read').narrowed, /present\/past → past/);
  const wrong = check('I will read a book.', 'Я читал книгу.');
  assert.equal(statusOf(wrong, 'read').status, 'changed');
});

test('lost negation, number and added meanings are reported', () => {
  const positive = check('I do not read books.', 'Я читаю книги.');
  assert.equal(positive.survives, false);
  assert.deepEqual(statusOf(positive, 'read').changes, [
    'polarity negative → positive',
  ]);
  const singular = check('I do not read books.', 'Я не читаю книгу.');
  assert.match(statusOf(singular, 'book.text').changes[0], /^number plural/);
  const added = check('I do not read books.', 'Я не читаю книги и письма.');
  assert.deepEqual(added.added, ['письма']);
});

test('a gerund may be read back as its verb or as its noun reading', () => {
  const links = sourceLinks({
    statements: [
      {
        type: 'statement',
        predicate: 'read',
        tense: 'present',
        polarity: 'positive',
        mood: 'declarative',
        object: {
          action: { predicate: 'write' },
          nominalization: { concept: 'letter.message' },
        },
      },
    ],
  });
  assert.deepEqual(
    links.map((l) => [l.kind, l.concept, Boolean(l.optional)]),
    [
      ['predicate', 'read', false],
      ['action', 'write', false],
      ['entity', 'letter.message', true],
    ]
  );
});

test('modality, negative determiners and coordinations are read back', () => {
  for (const english of [
    'No cat can fly.',
    'I cannot read or write.',
    'He does not read or write.',
    'Neither the cat nor the dog sleeps.',
    'Either the cat or the dog sleeps.',
    'I like neither tea nor coffee.',
    'Neither answer is correct.',
  ]) {
    const result = check(english);
    assert.ok(result.survives, `${english}: ${JSON.stringify(result.links)}`);
    assert.deepEqual(result.unread, [], english);
  }
  // «может» is "can" or "may": readable, in a wider range
  assert.equal(statusOf(check('No cat can fly.'), 'fly').status, 'widened');
});

test('a dropped modal, determiner or coordination is a lost link', () => {
  const modal = check('No cat can fly.', 'Никакая кошка не летает.');
  assert.ok(!modal.survives);
  assert.deepEqual(statusOf(modal, 'fly').changes, ['modality modal.can lost']);
  const no = check('No cat can fly.', 'Кошка не может лететь.');
  assert.deepEqual(statusOf(no, 'cat').changes, ['determiner det.no lost']);
  const nor = check(
    'Neither the cat nor the dog sleeps.',
    'Кошка и собака не спят.'
  );
  assert.equal(nor.links.find((l) => l.kind === 'coordination').status, 'lost');
});
