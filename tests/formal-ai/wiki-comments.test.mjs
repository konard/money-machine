/** Editors' HTML comments in wikitext are not dictionary content. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';

test('a comment after trans-top keeps the translation table', () => {
  const page =
    '==English==\n===Noun===\n# The quality of being [[eligible]].\n' +
    '{{trans-top|quality of being eligible}}<!-- a note for editors -->\n' +
    '* Russian: {{t+|ru|пригодность|f}}\n{{trans-bottom}}\n';
  const [entry] = englishEntries(page);
  assert.deepEqual(
    entry.senses.flatMap((s) => s.russian.map((r) => r.word)),
    ['пригодность']
  );
});
