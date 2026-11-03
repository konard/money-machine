/** Perfect tense, contact relatives, auxiliaries and sentence-initial verbs. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  englishEntries,
  renderRussian,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import { glossWords } from '../../formal-ai/src/sources/sense-data.mjs';

const ru = (text) => translateDocument(text).text;

test('a present perfect is a completed action in the past', () => {
  assert.equal(ru('I have sent the letter.'), 'Я отправил письмо.');
  assert.equal(ru('She has finished the work.'), 'Она закончила работу.');
  // a state that still lasts stays in the present
  assert.equal(
    ru('We have lived here for ten years.'),
    'Мы живём здесь десять лет.'
  );
});

test('a relative clause without "that" ends before the outer verb', () => {
  assert.equal(
    ru('The money we save goes to the bank.'),
    'Деньги, которые мы копим, идут в банк.'
  );
  // который of an animate noun takes the genitive-like accusative
  assert.equal(ru('People we know pay.'), 'Люди, которых мы знаем, платят.');
});

test('only an auxiliary takes "n\'t"', () => {
  const lexicon = loadLexicon();
  // "does" as a plural noun ("doe") must not become the subject's head
  lexicon.addForm('does', { pos: 'noun', lemma: 'letter', feature: 'plural' });
  assert.equal(ru("He doesn't help."), 'Он не помогает.');
});

test('a sentence-initial verb before a determiner is an order, not a name', () => {
  const lexicon = loadLexicon();
  lexicon.givenNames ||= new Set();
  lexicon.givenNames.add('Open');
  lexicon.setNameLabel('Open', 'Опен');
  assert.equal(ru('Open the file.'), 'Откройте файл.');
});

test('an ed-form is the past and the past participle', () => {
  const [entry] = englishEntries(
    '==English==\n===Verb===\n{{head|en|verb form}}\n\n# {{infl of|en|pay||ed-form}}\n----\n'
  );
  assert.deepEqual(
    entry.formOf.map((f) => [f.kind, f.lemma]),
    [['ed-form', 'pay']]
  );
});

test('animacy is read from a declension caption', async () => {
  const html =
    '<div class="NavHead">Declension of <b>челове́к</b> (<span><a href="/wiki/Appendix:Russian_nouns#Declension_tables" title="Appendix:Russian nouns">anim masc-form velar-stem accent-a irreg</a></span>)</div>';
  const fetchImpl = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ parse: { text: html } }),
    });
  const r = await renderRussian(
    'человек',
    { source: '{{ru-noun-table|челове́к|*}}' },
    { fetchImpl, cache: false }
  );
  assert.equal(r.animate, true);
});

test('a "See …" cross-reference gives no context cues', () => {
  assert.deepEqual(
    glossWords('A linguistic category of speakers. See grammatical person.'),
    ['linguistic', 'category', 'speakers']
  );
});

test('\'s is "has" only as an auxiliary, "is" or a possessive otherwise', () => {
  assert.equal(ru("Anna's car needs money."), 'Машине Анны нужны деньги.');
  assert.equal(ru("Anna's new car is red."), 'Новая машина Анны красная.');
  assert.equal(ru("Anna's happy."), 'Анна счастлива.');
  assert.equal(ru("She's sent the letter."), 'Она отправила письмо.');
  assert.equal(ru("He's got a car."), 'У него есть машина.');
  assert.equal(ru('He has got two cards.'), 'У него есть две карты.');
});

test('coordinated prepositional phrases stay in one clause', () => {
  assert.equal(
    ru('Money comes from work and from the bank.'),
    'Деньги приходят с работы и из банка.'
  );
  assert.equal(
    ru('Money comes from work and, more often, from the bank.'),
    'Деньги более часто приходят с работы и из банка.'
  );
});

test('a second verb shares the subject, tense and modal of the first', () => {
  assert.equal(
    ru('We live in London and work in Moscow.'),
    'Мы живём в Лондоне и работаем в Москве.'
  );
  assert.equal(ru('They will come and help.'), 'Они придут и будут помогать.');
  assert.equal(
    ru('You can open an account and save money.'),
    'Вы можете открыть счёт и накопить деньги.'
  );
});
