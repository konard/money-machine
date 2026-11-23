/** Offline checks of compounds, regular entries, verb forms and clause frames. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  compoundNoun,
  regularEntry,
  resolveNames,
  unknownWords,
} from '../../formal-ai/src/resolve.mjs';
import { compoundCandidates } from '../../formal-ai/src/compounds.mjs';
import { sameFormPasts } from '../../formal-ai/src/forms.mjs';
import { readings, tokenize } from '../../formal-ai/src/english/analyze.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { declineNoun } from '../../formal-ai/src/russian/morphology.mjs';

const ru = (text) =>
  translateDocument(text, { lexicon: loadLexicon({ fresh: true }) }).text;

test('a Russian compound noun declines its adjectives and head, keeps its tail', () => {
  const head = { pos: 'noun', lemma: 'счёт', gender: 'm', animate: false };
  const entry = compoundNoun('банковский счёт', (w) =>
    w === 'счёт' ? head : null
  );
  assert.equal(entry.compound.head, 'счёт');
  assert.deepEqual(entry.compound.adjectives, ['банковский']);
  assert.equal(declineNoun(entry, 'ins', 'sg'), 'банковским счётом');
  assert.equal(
    compoundNoun('a b', () => null),
    null
  );
});

test('regular entries: fixed multiword adverbs, native -ство nouns, no guessed foreign stems', () => {
  assert.deepEqual(regularEntry('adv', { word: 'в основном' }), {
    pos: 'adv',
    lemma: 'в основном',
    regular: true,
  });
  assert.equal(regularEntry('noun', { word: 'спонсорство' }).gender, 'n');
  assert.equal(regularEntry('noun', { word: 'кенгуру' }), null);
});

test('two-word compound candidates use the singular of the last word', () => {
  const candidates = compoundCandidates(
    'I open bank accounts.',
    loadLexicon({ fresh: true })
  );
  assert.ok(candidates.includes('bank account'), candidates.join(', '));
});

test('verbs whose past equals the base learn it from {{en-verb}}', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const pages = { cost: '==English==\n===Verb===\n{{en-verb|~s|~ing|~}}' };
  const fetchImpl = (url, options) => {
    const p =
      options?.method === 'POST'
        ? new URLSearchParams(options.body)
        : new URL(url).searchParams;
    const titles = (p.get('titles') || '').split('|').filter(Boolean);
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          query: {
            pages: titles.map((title) =>
              pages[title]
                ? {
                    title,
                    revisions: [{ slots: { main: { content: pages[title] } } }],
                  }
                : { title, missing: true }
            ),
          },
        }),
    });
  };
  lexicon.add({
    id: 'test.cost',
    source: 'learned:test',
    classes: [],
    en: [{ pos: 'verb', words: ['cost'] }],
  });
  const before = readings(
    { text: 'cost', lower: 'cost', kind: 'word' },
    lexicon
  );
  assert.ok(!before.some((r) => r.features?.form === 'past'));
  const added = await sameFormPasts('It cost a lot.', {
    lexicon,
    fetchImpl,
    cache: false,
  });
  assert.equal(added, 1);
  const forms = lexicon.irregular('cost').map((r) => r.feature);
  assert.deepEqual(forms.sort(), ['participle', 'past']);
});

test('clause frames: purpose infinitive, object negation, agent passive', () => {
  assert.equal(
    ru('Read the book to learn Russian.'),
    'Прочитайте книгу, чтобы изучать русский язык.'
  );
  assert.equal(ru('The man has no book.'), 'У мужчины нет книги.');
  assert.equal(ru('Books are written by people.'), 'Книги пишутся людьми.');
});

test('words in other alphabets stay whole and are kept as foreign names', () => {
  const tokens = tokenize('Korlátolt felelősségű társaság (Kft.)');
  assert.deepEqual(
    tokens.slice(0, 3).map((t) => t.text),
    ['Korlátolt', 'felelősségű', 'társaság']
  );
  const r = readings(
    { text: 'társaság', lower: 'társaság', kind: 'word' },
    loadLexicon({ fresh: true })
  );
  assert.ok(r.some((x) => x.pos === 'propn' && x.features.foreign));
});

test('a capitalized word starting a line is a sentence start, not a name', () => {
  const lexicon = loadLexicon({ fresh: true });
  const words = unknownWords(
    'Linking accounts\n\nZorbify artist page',
    lexicon
  );
  assert.ok(words.includes('zorbify'), words.join(', '));
});

test('one shared word is not enough context to outrank a popular entity', async () => {
  const entities = {
    Qcountry: {
      labels: { en: { value: 'Kenya' }, ru: { value: 'Кения' } },
      descriptions: { en: { value: 'country in East Africa' } },
      sitelinks: { a: {}, b: {}, c: {} },
    },
    Qrock: {
      labels: { en: { value: 'Kenya' } },
      descriptions: { en: { value: 'asteroid not covered' } },
      sitelinks: { a: {} },
    },
  };
  const lexicon = loadLexicon({ fresh: true });
  const fetchImpl = (url) => {
    const p = new URL(url).searchParams;
    const body =
      p.get('action') === 'wbsearchentities'
        ? {
            search: Object.keys(entities).map((id) => ({
              id,
              label: 'Kenya',
            })),
          }
        : p.get('action') === 'wbgetentities'
          ? { entities }
          : { query: { pages: [] } };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
  const hits = await resolveNames(['Kenya'], {
    lexicon,
    fetchImpl,
    cache: false,
    topic: 'Not covered: Kenya and others.',
  });
  assert.equal(hits.get('Kenya'), 'Qcountry');
});
