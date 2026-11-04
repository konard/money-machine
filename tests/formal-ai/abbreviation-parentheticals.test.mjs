/** "e.g." is a word with the senses of "for example"; "( … )" stays. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../formal-ai/src/english/analyze.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';

const pages = {
  'e.g.':
    '==English==\n===Adverb===\n# {{non-gloss|An {{glossary|initialism}} used to introduce an example}}: [[for the sake of]] an [[example]]; [[for example]].\n',
  'for example':
    '==English==\n===Prepositional phrase===\n# As an example.\n{{trans-top|as an example}}\n* Russian: {{t+|ru|наприме́р}}\n{{trans-bottom}}\n',
  например:
    '==Russian==\n===Adverb===\n{{ru-adv|наприме́р}}\n\n# [[for example]]\n',
};
const fetchImpl = (url, options) => {
  const p =
    options?.method === 'POST'
      ? new URLSearchParams(options.body)
      : new URL(url).searchParams;
  let body = {};
  if (p.has('titles')) {
    body = {
      query: {
        pages: p
          .get('titles')
          .split('|')
          .map((title) => ({
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

test('a dotted abbreviation is one token', () => {
  assert.deepEqual(
    tokenize('(e.g. eBay)').map((t) => t.text),
    ['(', 'e.g.', 'eBay', ')']
  );
});

test('an initialism names its expansion after the explanation', () => {
  const [entry] = englishEntries(pages['e.g.']);
  assert.deepEqual(entry.formOf, [
    { kind: 'alternative form', lemma: 'for example' },
  ]);
});

test('an adverb borrows the senses of a prepositional phrase', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', { words: ['e.g.'], lexicon, fetchImpl, cache: false });
  const ids = lexicon.lookup('adv', 'e.g.');
  assert.ok(ids.some((id) => lexicon.get(id).ru?.lemma === 'например'));
});
