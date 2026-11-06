import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadLexicon, Lexicon } from '../../formal-ai/src/lexicon.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';
import { naturalizeRussian } from '../../formal-ai/src/russian/naturalize.mjs';
import {
  analyzeRussian,
  russianRoundTrip,
  analyzerIndex,
  tokenizeRussian,
} from '../../formal-ai/src/russian/analyze/index.mjs';
import { compareRussianMeta } from '../../formal-ai/src/russian/analyze/compare.mjs';

const lexicon = loadLexicon({ fresh: true });
const index = analyzerIndex(lexicon);
const parse = (text) => analyzeRussian(text, lexicon, { index });

test('Russian clauses round-trip exactly with complete independent parses', () => {
  for (const text of [
    'Я читаю книгу.',
    'Я не читаю книги.',
    'Она писала письмо.',
    'Она будет писать письмо.',
    'Я прочитал книгу.',
    'Я прочитаю книгу.',
    'У меня есть ручка.',
    'У меня нет ручки.',
    'Ручка на столе.',
    'Мы читаем книги.',
    'Я читаю две книги.',
    'Ты читаешь книги?',
    'Читает ли она книги?',
    'Что она читает?',
    'Книга, которую я читал, хорошая.',
    'Книга и ручка на столе.',
    'Я читаю и пишу.',
    'Прочитайте книгу.',
    'Не читайте книгу.',
    'Я читаю эту книгу.',
    'Я читаю какую-то книгу.',
    'Я читаю одну книгу.',
    'Я читаю не новую книгу.',
    'Я прочитала книгу.',
    'Я хочу читать книги.',
    'Я могу читать книги.',
    'Я не могу читать книги.',
    'Я читаю много книг.',
    'На столе есть книга.',
    'Читаю книгу.',
    'Новая книга.',
    'Я хочу прочитать книгу.',
    'Я читаю, чтобы писать письма.',
    'Он читает, потому что книга хорошая.',
    'Я не читаю и не пишу.',
    'Книга хорошая и новая.',
    'Я читаю не книгу.',
    'Я читаю не в парке.',
    'Книга не на столе.',
  ]) {
    const result = russianRoundTrip(text, lexicon, { index });
    assert.ok(
      result.complete,
      `${text}: ${JSON.stringify([result.before.leftover, result.after.leftover])}`
    );
    assert.deepEqual(result.differences, [], `${text} → ${result.russian}`);
  }
});

test('articles are never inferred; only explicit words fix definiteness', () => {
  assert.equal(
    parse('Я читаю книгу.').statements[0].objects[0].definiteness,
    'definite indefinite'
  );
  assert.equal(
    parse('Я читаю эту книгу.').statements[0].objects[0].definiteness,
    'definite'
  );
  assert.equal(
    parse('Я читаю какую-то книгу.').statements[0].objects[0].definiteness,
    'indefinite'
  );
  assert.equal(
    parse('Я читаю одну книгу.').statements[0].objects[0].definiteness,
    'indefinite'
  );
});

test('case, verb government and local negation recover roles', () => {
  const statement = parse('Мне нравится книга.').statements[0];
  assert.equal(statement.subject.pronoun.person, 1);
  assert.equal(statement.objects[0].concept, 'book.text');
  const negation = parse('Я читаю не новую книгу.').statements[0];
  assert.equal(negation.polarity, 'positive');
  assert.equal(negation.objects[0].properties[0].polarity, 'negative');
  assert.equal(
    parse('Ручка на столе.').statements[0].complement.relation,
    'rel.on'
  );
  assert.equal(
    parse('Я помогал Мэри.').statements[0].objects[0].concept,
    'mary'
  );
});

test('translator basic fixtures give source links back within grammatical ranges', () => {
  for (const text of [
    'I do not read books.',
    'I have a pen.',
    'I help Mary.',
    'We live in Moscow.',
    'Mary likes music.',
  ]) {
    const source = formalize(text, lexicon);
    const russian = naturalizeRussian(source, lexicon).text;
    const after = parse(russian);
    assert.deepEqual(after.leftover, []);
    assert.deepEqual(
      compareRussianMeta(source, after).problems,
      [],
      `${text} → ${russian}`
    );
  }
});

test('range compatibility never accepts a changed role, tense, quantity or polarity', () => {
  const source = parse('Я читаю две книги.');
  for (const text of [
    'Я не читаю две книги.',
    'Я читал две книги.',
    'Я читаю три книги.',
  ]) {
    assert.equal(
      compareRussianMeta(source, parse(text)).compatible,
      false,
      text
    );
  }
});

test('grammar works with new lexicon concepts instead of word-specific rules', () => {
  const custom = new Lexicon();
  custom.add({
    id: 'fixture.item',
    en: [],
    classes: [],
    ru: { pos: 'noun', lemma: 'лампа', gender: 'f' },
  });
  custom.add({
    id: 'fixture.action',
    en: [],
    classes: [],
    ru: {
      pos: 'verb',
      lemma: 'проверять',
      aspect: 'impf',
      government: { case: 'acc' },
      markerGovernment: { about: { preposition: 'о', case: 'prep' } },
    },
  });
  const parsed = analyzeRussian('Я проверяю лампу о лампе.', custom);
  assert.deepEqual(parsed.leftover, []);
  assert.equal(parsed.statements[0].predicate, 'fixture.action');
  assert.equal(parsed.statements[0].objects[0].concept, 'fixture.item');
  assert.equal(parsed.statements[0].modifiers[0].relation, 'rel.about');
  assert.ok(russianRoundTrip('Я проверяю лампу.', custom).complete);
});

test('unknown input and empty parses cannot be complete round trips', () => {
  assert.equal(russianRoundTrip('', lexicon, { index }).complete, false);
  const result = parse('Я абракадабрю книгу.');
  assert.ok(result.unknown.includes('абракадабрю'));
  assert.ok(result.leftover.includes('абракадабрю'));
});

test('tokenizer preserves offsets, hyphenated indefinite words and ё normalization', () => {
  const tokens = tokenizeRussian('Её что-то?');
  assert.deepEqual(
    tokens.map((t) => [t.text, t.lower, t.offset]),
    [
      ['Её', 'ее', 0],
      ['что-то', 'что-то', 3],
      ['?', '?', 9],
    ]
  );
});

test('parse-ru CLI prints meta and round-trip link differences offline', () => {
  const output = execFileSync(
    process.execPath,
    [
      'formal-ai/bin/formal-ai.mjs',
      'parse-ru',
      '--roundtrip',
      'Я читаю книгу.',
      '--offline',
    ],
    { encoding: 'utf8', env: process.env }
  );
  assert.match(output, /predicate read/);
  assert.match(output, /definiteness "definite indefinite"/);
  assert.match(output, /Exact meta links/);
});
