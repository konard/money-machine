import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { rncFixture } from './rnc-fixture.mjs';

// Offline dictionary responses exercise the same public-data pre-pass as
// the evaluation, including a dictionary-licensed ambiguous "you" subject.
const entries = {
  know: ['Verb', 'знать'],
  think: ['Verb', 'думать', "#: {{ux|en|I '''think''' that they can help.}}"],
  help: ['Verb', 'помогать'],
  read: ['Verb', 'читать'],
  see: ['Verb', 'видеть'],
  work: ['Verb', 'работать'],
  want: ['Verb', 'хотеть', '#: {{ux|en|I want someone to read.}}'],
  book: ['Noun', 'книга'],
};
let vocabulary;
async function fixture() {
  if (!vocabulary) {
    vocabulary = loadLexicon({ fresh: true });
    await resolveText('', {
      words: Object.keys(entries),
      lexicon: vocabulary,
      cache: false,
      fetchImpl: (url, options) => {
        assert.equal(options.headers['user-agent'], USER_AGENT);
        const params = new URL(url).searchParams;
        const corpus = rncFixture(params);
        if (corpus) {
          return Promise.resolve(corpus);
        }
        const pages = (params.get('titles') || '').split('|').map((title) => {
          const e = entries[title];
          if (!e) {
            return { title, missing: true };
          }
          const [pos, ru, usage = ''] = e;
          const content = `==English==\n===${pos}===\n# Fixture.\n${usage}\n{{trans-top|fixture}}\n* Russian: {{t|ru|${ru}}}\n{{trans-bottom}}`;
          return { title, revisions: [{ slots: { main: { content } } }] };
        });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ query: { pages } }),
        });
      },
    });
  }
  return vocabulary;
}

test('finite complements preserve their subjects and add Russian что without swallowing an object pronoun', async () => {
  const lexicon = await fixture();
  for (const text of [
    'I do not think I can help.',
    'I do not think you can help.',
  ]) {
    const parsed = parseSentence(text, lexicon);
    assert.deepEqual(parsed.leftover, [], text);
    assert.equal(parsed.clauses.length, 2, text);
    assert.equal(parsed.clauses[1].link.concept, 'conj.that');
    assert.equal(parsed.clauses[0].objects.length, 0);
    const result = translateDocument(text, { lexicon });
    assert.ok(!result.text.includes('['), result.text);
    assert.match(result.text, /^Я не думаю, что (я могу|вы можете) /);
  }
});

test('embedded how/what use declarative English order and retain the Russian question word', async () => {
  const lexicon = await fixture();
  for (const [word, ru] of [
    ['how', 'как'],
    ['what', 'что'],
  ]) {
    const text = `I know ${word} you read.`;
    const parsed = parseSentence(text, lexicon);
    assert.deepEqual(parsed.leftover, []);
    assert.equal(parsed.clauses.length, 2);
    assert.equal(parsed.clauses[1].subject.pronoun.lemma, 'you');
    assert.equal(
      parsed.clauses[1].wh.slot,
      word === 'how' ? 'adverbial' : 'object'
    );
    const result = translateDocument(text, { lexicon });
    assert.ok(!result.text.includes('['), result.text);
    assert.ok(result.text.includes(`, ${ru} вы `), result.text);
  }
});

test('object pronouns and object-controlled infinitives are not finite complements', async () => {
  const lexicon = await fixture();
  const direct = parseSentence('I help you.', lexicon);
  assert.equal(direct.clauses.length, 1);
  assert.equal(direct.clauses[0].objects[0].pronoun.lemma, 'you');
  const object = parseSentence('I see them work.', lexicon);
  assert.equal(object.clauses.length, 1);
  assert.equal(object.clauses[0].finiteLink, null);
  const controlled = parseSentence('I want you to read a book.', lexicon);
  assert.deepEqual(controlled.leftover, []);
  assert.equal(controlled.clauses.length, 1);
  assert.equal(controlled.clauses[0].objects[0].pronoun.lemma, 'you');
  assert.ok(controlled.clauses[0].xcomp);
  assert.doesNotThrow(() =>
    parseSentence('I think her book is good.', lexicon)
  );
});
