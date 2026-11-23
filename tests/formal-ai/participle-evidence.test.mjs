/** Offline dictionary evidence for ambiguous passive predicates and headlines. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { predicateEvidence } from '../../formal-ai/src/english/participle-evidence.mjs';
import { periodicAdverb } from '../../formal-ai/src/russian/periodic-adverb.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const adjective = (definition, ru, example = '') =>
  `==English==\n===Adjective===\n# ${definition}\n${example}\n{{trans-top|${definition}}}\n* Russian: {{t|ru|${ru}}}\n{{trans-bottom}}`;

function fixture(pages) {
  return {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const u = new URL(url);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : u.searchParams;
      let body;
      if (p.get('titles')) {
        body = {
          query: {
            pages: p
              .get('titles')
              .split('|')
              .map((title) =>
                pages[title]
                  ? {
                      title,
                      revisions: [
                        { slots: { main: { content: pages[title] } } },
                      ],
                    }
                  : { title, missing: true }
              ),
          },
        };
      } else if (p.get('action') === 'parse') {
        body = { parse: { text: '' } };
      } else if (u.hostname === 'ru.wikipedia.org') {
        body = { query: { searchinfo: { totalhits: 0 } } };
      } else {
        throw Object.assign(new Error(`Unexpected fixture request: ${url}`), {
          fatal: true,
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}

async function vocabulary() {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.care',
    source: 'fixture',
    en: [{ pos: 'noun', lemma: 'care', words: ['care'] }],
    ru: { pos: 'noun', lemma: 'забота', gender: 'f', animate: false },
  });
  const pages = {
    used: adjective('That is or has or have been used.', 'используемый'),
    built: adjective('{{lb|en|informal}} Muscular.', 'крепкий'),
    sold: adjective('{{lb|en|informal}} Convinced.', 'убеждённый'),
    interested: adjective(
      'Having or showing interest.',
      'заинтересованный',
      "#: {{ux|en|She is '''interested''' in music.}}"
    ),
  };
  for (const ru of [
    'используемый',
    'крепкий',
    'убеждённый',
    'заинтересованный',
  ]) {
    pages[ru] = `==Russian==\n===Adjective===\n{{ru-adj|${ru}}}`;
  }
  await resolveText('', {
    lexicon,
    words: Object.keys(pages).slice(0, 4),
    ...fixture(pages),
  });
  lexicon.add({
    id: 'fixture.interest',
    source: 'fixture',
    en: [{ pos: 'verb', lemma: 'interest', words: ['interest'] }],
    ru: { pos: 'verb', lemma: 'интересовать' },
  });
  return lexicon;
}

test('public adjective evidence distinguishes adjunct passives from ordinary states', async () => {
  const lexicon = await vocabulary();
  for (const text of [
    'It is used in the bank.',
    'It is built with care.',
    'Used in the bank.',
    'Built with care.',
    'The book was sold.',
  ]) {
    const parsed = parseSentence(text, lexicon);
    assert.equal(parsed.clauses[0].passive, true, text);
    assert.equal(parsed.leftover.length, 0, text);
  }
  for (const text of [
    'I am tired.',
    'She is interested in music.',
    'He is built.',
    'I am sold.',
  ]) {
    const parsed = parseSentence(text, lexicon);
    assert.equal(parsed.clauses[0].passive, false, text);
  }
  assert.equal(
    translateDocument('It is used in the bank.', { lexicon }).text,
    'Оно используется в банке.'
  );
});

test('a rare adjective definition does not erase ordinary adjective senses', () => {
  const entries = new Map([
    [
      'invented',
      [
        {
          pos: 'adj',
          rawDefinitions: ['# Constant.', '# {{lb|en|rare}} Other.'],
        },
      ],
    ],
  ]);
  assert.equal(
    predicateEvidence(entries, { pos: 'adj', lemma: 'invented' }).restricted,
    false
  );
});

test('recurring headline passives do not become completed results or nominal fragments', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.weekly',
    source: 'fixture',
    gloss: 'every week',
    en: [{ pos: 'adv', lemma: 'weekly', words: ['weekly'] }],
    ru: { pos: 'adv', lemma: 'еженедельно' },
  });
  const parsed = parseSentence('Used weekly.', lexicon);
  assert.equal(parsed.clauses[0].passive, true);
  assert.equal(parsed.clauses[0].aspect, 'simple');
  assert.equal(
    translateDocument('Used weekly.', { lexicon }).text,
    'Используется еженедельно.'
  );
});

test('a modal auxiliary cannot be the compound head or contact-relative subject', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.must',
    source: 'fixture',
    en: [{ pos: 'noun', lemma: 'must', words: ['must'] }],
    ru: { pos: 'noun', lemma: 'сусло', gender: 'n' },
  });
  const parsed = parseSentence('Books must be cheap or very good.', lexicon);
  assert.equal(parsed.clauses[0].modal, 'modal.must');
  assert.equal(parsed.clauses[0].subject.head.lemma, 'book');
  assert.equal(parsed.clauses[0].subject.relative, undefined);
});

test('productive periodic adverbs use the same-word adjective meaning', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.periodic.adj',
    source: 'fixture',
    gloss: 'every month',
    en: [{ pos: 'adj', lemma: 'monthly', words: ['monthly'] }],
    ru: { pos: 'adj', lemma: 'ежемесячный', shortForms: { n: 'ежемесячно' } },
  });
  const concept = {
    gloss: 'every month',
    en: [{ pos: 'adv', lemma: 'monthly' }],
    ru: { pos: 'adv', lemma: 'месячно', regular: true },
  };
  assert.equal(periodicAdverb(concept, lexicon).lemma, 'ежемесячно');
  assert.equal(
    periodicAdverb({ ...concept, gloss: 'in a different manner' }, lexicon)
      .lemma,
    'месячно'
  );
});

test('an adjective entry that is an irregular past-participle form supplies a verb reading', async () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.weave',
    source: 'fixture',
    en: [{ pos: 'verb', lemma: 'weave', words: ['weave'] }],
    ru: { pos: 'verb', lemma: 'ткать' },
  });
  await resolveText('', {
    lexicon,
    words: ['woven'],
    ...fixture({
      woven: '==English==\n===Adjective===\n# {{past participle of|en|weave}}',
    }),
  });
  const parsed = parseSentence('It is woven by Tom.', lexicon);
  assert.equal(parsed.clauses[0].passive, true);
  assert.equal(parsed.clauses[0].verb.lemma, 'weave');
});
