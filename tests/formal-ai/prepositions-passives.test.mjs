/** Offline dictionary learning and modal passive grammar. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { mergeMultiwords } from '../../formal-ai/src/english/multiword.mjs';
import { analyze } from '../../formal-ai/src/english/analyze.mjs';
import {
  learnPrepositions,
  prepositionCandidates,
} from '../../formal-ai/src/sources/prepositions.mjs';
import { prepositionCase } from '../../formal-ai/src/sources/case-notes.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import { senseFrames } from '../../formal-ai/src/sources/verb-frames.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const entry = (pos, body) => `==English==\n===${pos}===\n${body}`;
const translation = (ru) =>
  `{{trans-top|fixture}}\n* Russian: ${ru}\n{{trans-bottom}}`;
function fixture(pages) {
  const requests = [];
  return {
    requests,
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const params = new URL(url).searchParams;
      assert.ok(params.has('titles'), url);
      const titles = params.get('titles').split('|');
      requests.push(titles);
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: titles.map((title) =>
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
          }),
      });
    },
  };
}
const pages = {
  'depending on': entry(
    'Preposition',
    `# Conditioned upon.\n${translation('{{t|ru|в зависимости от}}, {{t|ru|по}}')}`
  ),
  от: '==Russian==\n===Preposition===\n{{head|ru|preposition}} {{+obj|ru|gen}}',
  по: '==Russian==\n===Preposition===\n{{head|ru|preposition}} {{+obj|ru|dat}}',
  'in addition to': entry('Preposition', '# [[besides]].'),
  besides: entry(
    'Preposition',
    `# In addition.\n${translation('{{t|ru|кроме}}')}`
  ),
  кроме:
    '==Russian==\n===Preposition===\n{{head|ru|preposition}} {{+obj|ru|gen}}',
  'with respect to': entry(
    'Prepositional phrase',
    `# Concerning.\n${translation('{{t|ru|относительно}} {{+obj|ru|gen}}')}`
  ),
};

test('resolve pre-pass learns multiword prepositions, synonyms, case and a leading PP', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const api = fixture(pages);
  await learnPrepositions(
    'I work depending on the bank. In addition to books, I work. With respect to books, I work.',
    lexicon,
    api
  );
  const prep = mergeMultiwords(analyze('depending on', lexicon), lexicon)[0];
  assert.equal(prep.readings[0].pos, 'prep');
  assert.equal(lexicon.get(prep.readings[0].concepts[0]).ru.case, 'gen');
  assert.equal(
    translateDocument('I work depending on the bank.', { lexicon }).text,
    'Я работаю в зависимости от банка.'
  );
  assert.equal(
    translateDocument('In addition to books, I work.', { lexicon }).text,
    'Кроме книг я работаю.'
  );
  assert.equal(
    translateDocument('With respect to books, I work.', { lexicon }).text,
    'Относительно книг я работаю.'
  );
  assert.ok(api.requests.some((batch) => batch.includes('besides')));
  const count = api.requests.length;
  await learnPrepositions('I work depending on the bank.', lexicon, api);
  assert.equal(api.requests.length, count);
});

test('closed prepositional phrases retain an attested adverb reading', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await learnPrepositions(
    'At first, I work.',
    lexicon,
    fixture({
      'at first': entry(
        'Prepositional phrase',
        `# Initially.\n${translation('{{t|ru|сначала}}, {{t|ru|прежде}}')}`
      ),
      сначала: '==Russian==\n===Adverb===\n{{ru-adv|сначала}}',
      прежде:
        '==Russian==\n===Preposition===\n{{head|ru|preposition}} {{+obj|ru|gen}}',
    })
  );
  assert.deepEqual(lexicon.lookup('prep', 'at first'), []);
  assert.equal(
    translateDocument('At first, I work.', { lexicon }).text,
    'Сначала я работаю.'
  );
});

test('candidate spans stop at punctuation; unsupported case never defaults to genitive', async () => {
  assert.ok(
    prepositionCandidates('With respect to books.').includes('with respect to')
  );
  assert.ok(!prepositionCandidates('books. In addition').includes('books in'));
  const lexicon = loadLexicon({ fresh: true });
  await learnPrepositions(
    'Near to books.',
    lexicon,
    fixture({
      'near to': entry(
        'Preposition',
        `# Near.\n${translation('{{t|ru|неизвестно}}')}`
      ),
    })
  );
  assert.deepEqual(lexicon.lookup('prep', 'near to'), []);
});

test('translation qualifiers belong to their own candidate; case can come from usage notes', () => {
  const [sense] = englishEntries(
    entry(
      'Preposition',
      translation('{{t|ru|к}}, {{t|ru|перед}} {{qualifier|+ instrumental}}')
    )
  )[0].senses;
  assert.equal(sense.russian[0].case, undefined);
  assert.equal(sense.russian[1].case, 'ins');
  assert.equal(prepositionCase('{{q|+ genitive}}'), 'gen');
  assert.equal(prepositionCase('{{+obj|ru|dat|catpos=prep}}'), 'dat');
  assert.equal(prepositionCase('takes the dative'), 'dat');
  assert.equal(prepositionCase('An ordinary explanation.'), null);
  assert.ok(
    senseFrames('{{lb|en|ambitransitive}} To give.').includes('transitive')
  );
});

test('modal negated be + ambiguous participle selects a verb and keeps passive agreement', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.confirm',
    source: 'fixture',
    classes: [],
    en: [{ pos: 'verb', lemma: 'confirm', words: ['confirm'] }],
    ru: {
      pos: 'verb',
      lemma: 'подтверждать',
      aspect: 'impf',
      perfective: {
        lemma: 'подтвердить',
        aspect: 'perf',
        pastPassive: 'подтверждённый',
      },
    },
  });
  lexicon.add({
    id: 'fixture.confirmed.adj',
    source: 'fixture',
    classes: [],
    en: [{ pos: 'adj', lemma: 'confirmed', words: ['confirmed'] }],
    ru: { pos: 'adj', lemma: 'закоренелый' },
  });
  assert.equal(
    translateDocument('The book could not be confirmed.', { lexicon }).text,
    'Книга не могла быть подтверждена.'
  );
  assert.equal(
    translateDocument('The books must be confirmed.', { lexicon }).text,
    'Книги должны быть подтверждены.'
  );
  assert.equal(
    translateDocument('The book can be confirmed.', { lexicon }).text,
    'Книга может быть подтверждена.'
  );
  lexicon.setNameLabel('Tom', 'Том');
  assert.equal(
    translateDocument('The books should be confirmed by Tom.', { lexicon })
      .text,
    'Книги должен подтверждать Том.'
  );
  lexicon.add({
    id: 'fixture.polish',
    source: 'fixture',
    classes: [],
    en: [{ pos: 'verb', lemma: 'polish', words: ['polish'] }],
    ru: { pos: 'verb', lemma: 'полировать', aspect: 'impf' },
  });
  assert.equal(
    translateDocument('The book can be polished.', { lexicon }).text,
    'Книга может полироваться.'
  );
});
