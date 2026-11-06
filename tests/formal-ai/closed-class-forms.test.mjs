/** A form of a grammatical word never fetches that word's content senses. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';

const pages = {
  // "@": a preposition, and in Malaysian English a conjunction "or"
  '@': '==English==\n===Preposition===\n# [[at|At]] a rate of.\n===Conjunction===\n# {{lb|en|Malaysia|informal}} [[or]]\n',
  // "or" also names the heraldic tincture gold
  or: '==English==\n===Noun===\n# {{lb|en|heraldry}} The tincture gold.\n{{trans-top|tincture}}\n* Russian: {{t|ru|золото|n}}\n{{trans-bottom}}\n',
};
const requested = [];
const fetchImpl = (url, options) => {
  const p =
    options?.method === 'POST'
      ? new URLSearchParams(options.body)
      : new URL(url).searchParams;
  let body = {};
  if (p.has('titles')) {
    const titles = p.get('titles').split('|');
    requested.push(...titles);
    body = {
      query: {
        pages: titles.map((title) => ({
          title,
          ...(pages[title]
            ? { revisions: [{ slots: { main: { content: pages[title] } } }] }
            : { missing: true }),
        })),
      },
    };
  } else if (p.get('list') === 'search') {
    body = { query: { search: [] } };
  } else if (p.get('action') === 'wbsearchentities') {
    body = { search: [] };
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};

test('a form of a conjunction keeps "or" a conjunction', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', { words: ['@'], lexicon, fetchImpl, cache: false });
  assert.ok(!requested.includes('or'));
  assert.deepEqual(lexicon.lookup('noun', 'or'), []);
});
