/** Offline public-source fixtures for the two site-audit construction families. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const section = (pos, word, gender = '') =>
  `==English==\n===${pos}===\n# A fixture.\n{{trans-top|fixture}}\n* Russian: {{t|ru|${word}|${gender}}}\n{{trans-bottom}}`;
const pages = {
  reader: section('Noun', 'читатель', 'm'),
  teach: section('Verb', 'учить'),
  lesson: section('Noun', 'урок', 'm'),
  live: section('Adjective', 'живой'),
  capital: `${section('Noun', 'капитал', 'm')}\n===Adjective===\n# Main.\n{{trans-top|main}}\n* Russian: {{t|ru|главный}}\n{{trans-bottom}}`,
  require: section('Verb', 'требовать'),
  required: '==English==\n===Verb===\n# {{past participle of|en|require}}',
  restrict: section('Verb', 'ограничить', 'pf'),
  restricted: '==English==\n===Verb===\n# {{past participle of|en|restrict}}',
  supply: section('Verb', 'снабдить', 'pf'),
  supplied: '==English==\n===Verb===\n# {{past participle of|en|supply}}',
  product: section('Noun', 'товар', 'm'),
  ограничить: '==Russian==\n===Verb===\n{{ru-verb|ограничить|pf}}',
  снабдить: '==Russian==\n===Verb===\n{{ru-verb|снабдить|pf}}',
  учить: '==Russian==\n===Verb===\n{{ru-verb|учить|impf}}',
  читатель: '==Russian==\n===Noun===\n{{ru-noun|читатель|m-an}}',
  урок: '==Russian==\n===Noun===\n{{ru-noun|урок|m-in}}',
  товар: '==Russian==\n===Noun===\n{{ru-noun|товар|m-in}}',
  капитал: '==Russian==\n===Noun===\n{{ru-noun|капитал|m-in}}',
  главный: '==Russian==\n===Adjective===\n{{ru-adj|главный}}',
  требовать: '==Russian==\n===Verb===\n{{ru-verb|требовать|impf}}',
  живой: '==Russian==\n===Adjective===\n{{ru-adj|живой}}',
};
function fetchImpl(url, options) {
  assert.equal(options.headers['user-agent'], USER_AGENT);
  const p = options.body
    ? new URLSearchParams(options.body)
    : new URL(url).searchParams;
  const body = p.has('titles')
    ? {
        query: {
          pages: p
            .get('titles')
            .split('|')
            .map((title) =>
              pages[title]
                ? {
                    title,
                    revisions: [{ slots: { main: { content: pages[title] } } }],
                  }
                : { title, missing: true }
            ),
        },
      }
    : p.get('action') === 'parse'
      ? { parse: { text: '' } }
      : { query: { search: [], searchinfo: { totalhits: 0 } }, search: [] };
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}
async function vocabulary(text) {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText(text, {
    lexicon,
    fetchImpl,
    cache: false,
    words: Object.keys(pages).filter((word) => /^[a-z]+$/.test(word)),
  });
  return lexicon;
}

test('agreement distinguishes an attributive -ing subject from an activity', async () => {
  const lexicon = await vocabulary(
    'Reading students write. Reading students helps. Teaching live lessons.'
  );
  const attributed = parseSentence('Reading students write.', lexicon);
  assert.deepEqual(attributed.leftover, []);
  assert.ok(attributed.clauses[0].subject.relative);
  assert.match(
    translateDocument('Reading students write.', { lexicon }).text,
    /студенты, которые читают, пишут/i
  );
  const activity = parseSentence('Reading students helps.', lexicon);
  assert.ok(activity.clauses[0].subject.action);
  assert.equal(activity.clauses[0].subject.relative, undefined);
  assert.equal(
    translateDocument('Teaching live lessons.', { lexicon }).stats.incomplete,
    0
  );
  const purpose = translateDocument('Time to read books', { lexicon });
  assert.equal(purpose.stats.incomplete, 0, purpose.text);
  assert.match(purpose.text, /для того, чтобы читать книги/);
  const label = translateDocument('Capital required', { lexicon });
  assert.equal(label.stats.incomplete, 0, label.text);
  const imperative = parseSentence('Use students to read books.', lexicon);
  assert.equal(imperative.clauses[0].mood, 'imperative');
  assert.ok(imperative.clauses[0].xcomp);
});

test('missing long participles become finite relatives after the complete noun phrase', async () => {
  const lexicon = await vocabulary(
    'I sell restricted products. I sell products supplied to students.'
  );
  for (const source of [
    'I sell restricted products.',
    'I sell products supplied to students.',
  ]) {
    const result = translateDocument(source, { lexicon });
    assert.equal(result.stats.incomplete, 0, result.text);
    assert.doesNotMatch(result.text, /\[/);
    assert.match(result.text, /товары, которые/i);
  }
  assert.match(
    translateDocument('I sell restricted products.', { lexicon }).text,
    /которые ограничили/
  );
});

test('comma reduced relatives retain their modifiers and overt agents', async () => {
  const lexicon = await vocabulary(
    'Products, supplied by students. Products, supplied to students.'
  );
  for (const source of [
    'Products, supplied by students.',
    'Products, supplied to students.',
  ]) {
    const parsed = parseSentence(source, lexicon);
    assert.deepEqual(parsed.leftover, []);
    assert.ok(
      parsed.clauses[0].np?.participles ||
        parsed.clauses[0].subject?.participles
    );
    assert.equal(translateDocument(source, { lexicon }).stats.incomplete, 0);
  }
  assert.match(
    translateDocument('Products, supplied by students.', { lexicon }).text,
    /студенты/
  );
  // An ordinary finite past predicate must not become a noun modifier.
  assert.equal(
    parseSentence('Students wrote books.', lexicon).clauses[0].subject
      .participles,
    undefined
  );
  const series = parseSentence(
    'I read books, read books, and write books.',
    lexicon
  );
  assert.deepEqual(series.leftover, []);
  assert.equal(series.clauses.length, 3);
  assert.equal(series.clauses[0].objects[0].participles, undefined);
});

test('perfective headline passives without a participle never become future', async () => {
  const lexicon = await vocabulary('Products supplied to students.');
  const result = translateDocument('Products supplied to students.', {
    lexicon,
  });
  assert.equal(result.stats.incomplete, 0, result.text);
  assert.match(result.text, /товары снабдили студентам/i);
  assert.doesNotMatch(result.text, /снабдят/);
});
