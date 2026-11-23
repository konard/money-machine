import { attestRussian } from './russian-fixture.mjs';
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { rncFixture } from './rnc-fixture.mjs';

// "account" is both a noun and a verb; "nostro" has no page at all.
const section = (pos, ru) =>
  `===${pos}===\n# Fixture.\n{{trans-top|fixture}}\n* Russian: {{t|ru|${ru}}}\n{{trans-bottom}}`;
const wiki = attestRussian({
  withdrawal: `==English==\n${section('Noun', 'вывод')}`,
  account: `==English==\n${section('Noun', 'счёт')}\n${section('Verb', 'отчитываться')}`,
  local: `==English==\n${section('Adjective', 'местный')}`,
  possible: `==English==\n${section('Adjective', 'возможный')}`,
});
const words = ['withdrawal', 'account', 'local', 'possible'];

async function fixture() {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    words,
    lexicon,
    cache: false,
    fetchImpl: (url) => {
      const params = new URL(url).searchParams;
      const corpus = rncFixture(params);
      if (corpus) {
        return Promise.resolve(corpus);
      }
      const pages = (params.get('titles') || '').split('|').map((title) => {
        const content = wiki[title];
        return content
          ? { title, revisions: [{ slots: { main: { content } } }] }
          : { title, missing: true };
      });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ query: { pages } }),
      });
    },
  });
  return lexicon;
}

test('a plural subject never takes a third-person singular verb', async () => {
  const lexicon = await fixture();
  // the name "Wise" ends a noun phrase, so "accounts" could be its verb
  const { text } = translateDocument(
    'Withdrawals to local Wise accounts are possible.',
    { lexicon }
  );
  assert.ok(!text.includes('['), text);
  assert.match(text, /счет|счёт/);
  assert.match(text, /^Выводы в местные счета Wise возможн/);
});

test('phrases after a coordinated subject belong to its nearest conjunct', async () => {
  const lexicon = await fixture();
  const parsed = parseSentence(
    'Payoneer and local withdrawals to local accounts are possible.',
    lexicon
  );
  assert.deepEqual(parsed.leftover, []);
  const { subject } = parsed.clauses[0];
  assert.ok(subject.coord);
  assert.equal(subject.items.at(-1).pps.length, 1);
});
