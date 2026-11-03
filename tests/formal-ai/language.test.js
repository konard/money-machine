/**
 * Morphology, sense selection and the formal (Links Notation) layer.
 */

import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  CASES,
  declineNoun,
  declineAdjective,
  verbForms,
  conjugate,
} from '../../formal-ai/src/russian/morphology.mjs';
import { formalize, toLino } from '../../formal-ai/src/formalize.mjs';
import { DocumentMemory } from '../../formal-ai/src/senses.mjs';
import { parseLino } from '../../formal-ai/src/lino.mjs';

const lexicon = loadLexicon();
const paradigm = (id, number) =>
  CASES.map((c) => declineNoun(lexicon.get(id).ru, c, number)).join(' ');

test('nouns decline through all six cases', () => {
  assert.equal(
    paradigm('book.text', 'sg'),
    'книга книги книге книгу книгой книге'
  );
  assert.equal(paradigm('window', 'pl'), 'окна окон окнам окна окнами окнах');
  assert.equal(
    paradigm('friend', 'pl'),
    'друзья друзей друзьям друзей друзьями друзьях'
  );
  assert.equal(
    paradigm('mother', 'sg'),
    'мать матери матери мать матерью матери'
  );
  assert.equal(paradigm('name', 'sg'), 'имя имени имени имя именем имени');
  assert.equal(paradigm('cinema', 'pl'), 'кино кино кино кино кино кино');
});

test('adjectives agree in gender, number and case', () => {
  assert.equal(
    declineAdjective('большой', { gender: 'm', number: 'sg', case: 'ins' }),
    'большим'
  );
  assert.equal(
    declineAdjective('русский', { gender: 'f', number: 'sg', case: 'acc' }),
    'русскую'
  );
  assert.equal(
    declineAdjective('новый', { number: 'pl', case: 'gen' }),
    'новых'
  );
});

test('verbs conjugate, including reflexives', () => {
  assert.deepEqual(verbForms(lexicon.get('read').ru).present, [
    'читаю',
    'читаешь',
    'читает',
    'читаем',
    'читаете',
    'читают',
  ]);
  const stay = lexicon.get('stay').ru;
  assert.equal(
    conjugate(
      { ...stay.perfective },
      { tense: 'future', person: 2, number: 'sg' }
    ),
    'останешься'
  );
  assert.equal(
    conjugate(
      { ...stay.perfective },
      { tense: 'past', person: 1, number: 'pl' }
    ),
    'остались'
  );
});

const chosen = (sentence, word, memory) => {
  const [statement] = formalize(sentence, lexicon, memory).senses.filter(
    (d) => d.word.toLowerCase() === word
  );
  return statement?.chosen;
};

test('nearby words select the sense', () => {
  assert.equal(
    chosen('I need some money from the bank.', 'bank'),
    'bank.finance'
  );
  assert.equal(
    chosen('We sat on the bank of the river.', 'bank'),
    'bank.river'
  );
  assert.equal(chosen('The mouse ate the cheese.', 'mouse'), 'mouse.animal');
  assert.equal(chosen('Click the mouse twice.', 'mouse'), 'mouse.device');
  assert.equal(chosen('He plays the guitar.', 'plays'), 'play.music');
  assert.equal(chosen('She plays football.', 'plays'), 'play.game');
  assert.equal(chosen('I saw him last week.', 'last'), 'last.previous');
  assert.equal(chosen('This is the last page.', 'last'), 'last');
});

test('document memory carries a sense into the next sentence', () => {
  const memory = new DocumentMemory();
  formalize('We walked along the river.', lexicon, memory);
  assert.equal(chosen('The bank was steep.', 'bank', memory), 'bank.river');
});

test('the formal layer is Links Notation with concepts, ranges and groundings', () => {
  const { statements } = formalize('I opened an account at the bank.', lexicon);
  const lino = toLino(statements, lexicon);
  assert.match(lino, /concept bank\.finance\n\s+grounded-in Q22687/);
  assert.match(lino, /predicate open/);
  const tree = parseLino(lino);
  assert.equal(tree.children[0].name, 'statement');
  const you = toLino(formalize('You read.', lexicon).statements, lexicon);
  assert.match(you, /number \(singular plural\)/);
  assert.match(you, /tense \(present past\)/);
});

test('every Russian entry has a lemma (or phrase text)', () => {
  const fresh = loadLexicon({ fresh: true });
  for (const concept of fresh.concepts.values()) {
    if (concept.ru) {
      assert.ok(
        concept.ru.pos === 'phrase' ? concept.ru.text : concept.ru.lemma,
        concept.id
      );
    }
  }
});
