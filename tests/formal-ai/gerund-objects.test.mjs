import { attestRussian } from './russian-fixture.mjs';
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import {
  CATENATIVES,
  gerundInventory,
} from '../../formal-ai/src/sources/infinitive-frames.mjs';
import { rncFixture } from './rnc-fixture.mjs';

const APPENDIX = [
  "== Followed by a ''to''-infinitive ==",
  '[[want]]',
  '== Followed by a gerund/present participle ==',
  '[[enjoy]]',
  "== In the passive voice followed by a ''to''-infinitive ==",
  '[[say]]',
  "== Followed by a ''to''-infinitive or a gerund/present participle ==",
  '[[start]]',
].join('\n');

test('the appendix names the verbs followed by a gerund', () => {
  assert.deepEqual([...gerundInventory(APPENDIX)].sort(), ['enjoy', 'start']);
});

const section = (pos, ru) =>
  `===${pos}===\n# Fixture.\n{{trans-top|fixture}}\n* Russian: {{t|ru|${ru}}}\n{{trans-bottom}}`;
const wiki = attestRussian({
  pass: `==English==\n${section('Verb', 'сдать')}`,
  enjoy: `==English==\n${section('Verb', 'наслаждаться')}`,
  onboard: `==English==\n${section('Verb', 'интегрировать')}`,
  onboarding: `==English==\n${section('Noun', 'онбординг')}\n===Verb===\n# {{present participle of|en|onboard}}`,
  test: `==English==\n${section('Noun', 'экзамен')}`,
  [CATENATIVES]: APPENDIX,
});

async function fixture() {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    words: ['pass', 'enjoy', 'onboard', 'onboarding', 'test'],
    lexicon,
    cache: false,
    fetchImpl: (url) => {
      const params = new URL(url).searchParams;
      const corpus = rncFixture(params);
      if (corpus) {
        return Promise.resolve(corpus);
      }
      const pages = (params.get('titles') || '').split('|').map((title) =>
        wiki[title]
          ? {
              title,
              revisions: [{ slots: { main: { content: wiki[title] } } }],
            }
          : { title, missing: true }
      );
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ query: { pages } }),
      });
    },
  });
  return lexicon;
}

test('a verb that takes no gerund has a noun object, not a gerund phrase', async () => {
  const lexicon = await fixture();
  const pass = parseSentence('Pass onboarding tests.', lexicon);
  assert.deepEqual(pass.leftover, []);
  const [object] = pass.clauses[0].objects;
  assert.equal(object.action, undefined);
  assert.equal(object.head.lemma, 'test');
  const enjoy = parseSentence('Enjoy onboarding tests.', lexicon);
  assert.ok(enjoy.clauses[0].objects[0].action, 'enjoy takes a gerund');
});
