/** Reported speech, existential questions, place adverbs and name gender. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import {
  givenNameGender,
  primaryGivenName,
} from '../../formal-ai/src/public-expressions.mjs';

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

test('a headline participle is a passive; "before doing" is «прежде чем»', () => {
  assert.match(ru('No money sent.'), /^Деньги не отправл/);
  assert.match(ru('All books sent.'), /^Все книги отправл/);
  assert.match(ru('Tom sent.'), /отправил\.$/);
  assert.equal(
    ru('Read the book before paying.'),
    'Прочитайте книгу, прежде чем платить.'
  );
});

test('an -ing phrase after the subject is a relative clause', () => {
  assert.match(
    ru('Students selling books pay taxes.'),
    /^Студенты, которые продают книги, платят/
  );
});

test('a word that is first of all a place is not a given name', () => {
  const page = (first, second) =>
    `==English==\n===Proper noun===\n{{en-prop}}\n\n# ${first}\n# ${second}\n`;
  assert.equal(
    primaryGivenName(page('{{place|en|country}}', '{{given name|en|female}}')),
    false
  );
  assert.equal(primaryGivenName(page('{{given name|en|female}}', 'x')), true);
  assert.equal(primaryGivenName('==English==\n===Noun===\n# a thing\n'), null);
});

test('"per" a unit of time is «в», per anything else «за»', () => {
  assert.equal(ru('Students pay $5 per book.'), 'Студенты платят $5 за книгу.');
  assert.equal(ru('Students pay $5 per day.'), 'Студенты платят $5 в день.');
});

test('a fronted adverb before a request; "like" before a verb is a preposition', () => {
  assert.equal(ru('Always read the book.'), 'Всегда прочитайте книгу.');
  assert.match(ru('Students like Tom read books.'), /^Студенты как \S+ чита/);
});

test('a slash offers alternatives; "2/10" is one quantity', () => {
  assert.equal(
    ru('Students read the book/letter.'),
    'Студенты прочитали книгу/письмо.'
  );
  assert.match(ru('Students read the book/letter shop.'), /книги\/письма/);
  assert.match(ru('The book costs 2/10.'), /2\/10/);
});

test('a comma series of verbs closed by "and" shares the subject', () => {
  assert.equal(
    ru('We open shops, write letters, and sell books.'),
    'Мы открываем магазины, пишем письма и продаём книги.'
  );
});

test('words with digits and letter pairs are single tokens', async () => {
  const { tokenize } = await import('../../formal-ai/src/english/analyze.mjs');
  const words = (s) => tokenize(s).map((t) => t.text);
  assert.deepEqual(words('B2B and MP3 for A/B-test'), [
    'B2B',
    'and',
    'MP3',
    'for',
    'A/B-test',
  ]);
  assert.deepEqual(words('US/UK'), ['US', 'or', 'UK']);
  assert.deepEqual(words('rated 2/10'), ['rated', '2/10']);
});

test('a statement opening with "when" is a clause link, not a question', () => {
  assert.match(
    ru('When students read books, we work.'),
    /^Когда студенты \S+ книги, мы работаем\.$/
  );
});

test('a quantifier standing alone is a pronoun with plural agreement', () => {
  assert.equal(ru('Both work.'), 'Оба работают.');
  assert.equal(ru('Everyone works.'), 'Все работают.');
});

test('a fragment may be prepositional phrases only', () => {
  assert.equal(ru('In the morning.'), 'Утром.');
});

test('"about" before a measured count approximates it', () => {
  assert.equal(
    ru('We met in about 3 days.'),
    'Мы встретились примерно через 3 дня.'
  );
  assert.equal(ru('We work about 3 days.'), 'Мы работаем примерно 3 дня.');
});

test('coordinated adjectives before a noun', () => {
  assert.match(
    ru('Students read new and old books.'),
    /^Студенты \S+ новые и старые книги\.$/
  );
});
