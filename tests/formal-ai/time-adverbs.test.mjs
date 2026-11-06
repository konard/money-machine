/** Instrumental adverbs of time learned from Wiktionary ("in the morning"). */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adverbRelations,
  learnTimeAdverbs,
  russianAdverbGlosses,
  timePhraseWords,
} from '../../formal-ai/src/sources/time-adverbs.mjs';
import { Lexicon } from '../../formal-ai/src/lexicon.mjs';

const MORNING = `==Russian==

===Adverb===
{{ru-adv|[[утро|у́тром]]}}

# in the [[morning]]
#: {{uxi|ru|[[сего́дня]] '''у́тром'''|this morning}}

===Noun===
{{head|ru|noun form|head=у́тром|g=n-in}}

# {{inflection of|ru|у́тро||ins|s}}
`;

test('adverb glosses of a Russian page name the English phrase', () => {
  assert.deepEqual(russianAdverbGlosses(MORNING), ['in the morning']);
  assert.deepEqual(adverbRelations(['in the morning'], 'morning'), ['rel.in']);
  assert.deepEqual(adverbRelations(['in summer'], 'summer'), ['rel.in']);
  assert.deepEqual(adverbRelations(['in the morning'], 'evening'), []);
  assert.deepEqual(timePhraseWords('We met in the morning at night.'), [
    'morning',
    'night',
  ]);
});

test('a time noun with such an adverb is rendered with it', async () => {
  const lexicon = new Lexicon();
  lexicon.add({
    id: 'morning',
    gloss: 'early part of the day',
    en: [{ pos: 'noun', lemma: 'morning', words: ['morning'] }],
    source: 'test',
    ru: { pos: 'noun', lemma: 'утро', gender: 'n' },
  });
  const asked = [];
  const fetchImpl = (url, options) => {
    const p =
      options?.method === 'POST'
        ? new URLSearchParams(options.body)
        : new URL(url).searchParams;
    const titles = p.get('titles').split('|');
    asked.push(...titles);
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          query: {
            pages: titles.map((title) =>
              title === 'утром'
                ? {
                    title,
                    revisions: [{ slots: { main: { content: MORNING } } }],
                  }
                : { title, missing: true }
            ),
          },
        }),
    });
  };
  await learnTimeAdverbs('We met in the morning.', lexicon, {
    fetchImpl,
    cache: false,
  });
  assert.deepEqual(asked, ['утром']);
  assert.equal(lexicon.get('morning').ru.when, 'утром');
});

test('repeated times, calendar ranges and postpositions', async () => {
  const { translateDocument } =
    await import('../../formal-ai/src/document.mjs');
  const { loadLexicon } = await import('../../formal-ai/src/lexicon.mjs');
  const ru = (text) => translateDocument(text).text;
  assert.equal(ru('I work in the mornings.'), 'Я работаю по утрам.');
  assert.equal(
    ru('We work from Monday to Friday.'),
    'Мы работаем с понедельника по пятницу.'
  );
  // a postposition learned from Wiktionary's ===Postposition=== section
  const lexicon = loadLexicon();
  if (!lexicon.get('test.ago')) {
    lexicon.add({
      id: 'test.ago',
      gloss: 'before now',
      en: [{ pos: 'postp', lemma: 'ago', words: ['ago'] }],
      ru: { pos: 'adv', lemma: 'назад' },
      source: 'test',
    });
  }
  assert.equal(ru('We met two days ago.'), 'Мы встретились два дня назад.');
});
