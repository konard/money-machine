/** Offline checks of how public Wiktionary data becomes lexicon senses. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  englishEntries,
  matchingDefinition,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';

const english = (body) => `==English==\n${body}\n----\n`;

/** A MediaWiki API stand-in serving the given pages; all else is missing. */
function wiki(pages) {
  return (url, options) => {
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
}

test('a translation subpage is no reason to read bare-link definitions as variants', () => {
  const [entry] = englishEntries(
    english(
      '===Noun===\n{{en-noun}}\n\n# A mammal.\n# {{lb|en|slang}} [[foot|Foot]].\n\n====Translations====\n{{see translation subpage|Noun}}'
    )
  );
  assert.equal(entry.subpage, true);
  assert.deepEqual(entry.formOf, []);
});

test('humorous inflections are no reading of the word', () => {
  const [entry] = englishEntries(
    english(
      '===Noun===\n{{en-noun|-}}\n\n# {{lb|en|humorous}} {{plural of|en|pan}}'
    )
  );
  assert.deepEqual(entry.formOf, []);
});

test('each translated sense records how many languages translate it', () => {
  const [entry] = englishEntries(
    english(
      '===Noun===\n{{en-noun}}\n\n# A writing tool.\n\n====Translations====\n{{trans-top|writing tool}}\n* French: {{t|fr|stylo|m}}\n* German: {{t|de|Stift|m}}\n* Russian: {{t|ru|ру́чка|f}}\n*: Bokmål: {{t|nb|penn}}\n{{trans-bottom}}'
    )
  );
  assert.equal(entry.senses[0].languages, 3);
});

test('a loose gloss–definition match carries no labels over', () => {
  const definitions = [
    '{{lb|en|informal|or|meteorology}} A 24-hour period beginning at 6am or sunrise.',
  ];
  const loose = matchingDefinition(
    'period between sunrise and sunset',
    definitions
  );
  assert.deepEqual(loose.labels, []);
  const close = matchingDefinition('24-hour period beginning at sunrise', [
    ...definitions,
  ]);
  assert.ok(close.labels.includes('meteorology'));
});

test('public senses: capitalized titles, translation breadth, untranslated bases', async () => {
  const table = (gloss, langs, ru) =>
    `{{trans-top|${gloss}}}\n${Array.from(
      { length: langs },
      (_, k) => `* L${k}: {{t|x${k}|w}}`
    ).join('\n')}\n* Russian: {{t|ru|${ru}|f}}\n{{trans-bottom}}`;
  const pages = {
    // "monday" has no page of its own: the word is found under "Monday"
    Monday: english(
      `===Noun===\n{{en-noun}}\n\n# The day after Sunday.\n\n====Translations====\n{{trans-top|day of the week}}\n* Russian: {{t|ru|понеде́льник|m}}\n{{trans-bottom}}`
    ),
    // the enclosure is listed first, the writing tool translated widely
    quill: english(
      `===Noun===\n{{en-noun}}\n\n# An enclosure.\n# A writing tool.\n\n====Translations====\n${table('enclosure', 3, 'огра́да')}\n${table('writing tool', 40, 'ру́чка')}`
    ),
    // a past participle of a word nobody translates
    sprint: english(
      `===Verb===\n{{en-verb}}\n\n# To run fast.\n\n====Translations====\n{{trans-top|to run fast}}\n* Russian: {{t|ru|бежа́ть|impf}}\n{{trans-bottom}}\n\n===Verb===\n{{head|en|verb forms}}\n\n# {{past participle of|en|sprunt}}`
    ),
  };
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('monday quill sprint', {
    lexicon,
    words: ['monday', 'quill', 'sprint'],
    fetchImpl: wiki(pages),
    cache: false,
  });
  const top = (pos, word) =>
    lexicon
      .lookup(pos, word)
      .map((id) => lexicon.get(id))
      .sort((a, b) => b.prior - a.prior)[0]?.ru?.lemma;
  assert.equal(top('noun', 'monday'), 'понедельник');
  assert.equal(top('noun', 'quill'), 'ручка');
  assert.equal(top('verb', 'sprint'), 'бежать');
});
