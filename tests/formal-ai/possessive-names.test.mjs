import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { formalize } from '../../formal-ai/src/formalize.mjs';

const lexicon = loadLexicon({ fresh: true });
const ru = (text) => translateDocument(text, { lexicon }).text;
const subject = (text) => formalize(text, lexicon).statements[0].subject;

test('"\'s" before a noun that is also a bare verb is possessive', () => {
  // "book" is also a verb, but a bare base form cannot follow "is"
  const s = subject("Tom's book is here.");
  assert.equal(s.possessor?.name, 'Tom');
  assert.match(ru("Tom's book is here."), /^Книга Tom здесь\.$/);
});

test('"\'s" before an -ing form stays "is"', () => {
  assert.equal(ru("Tom's cooking dinner."), 'Tom готовит ужин.');
});

test('a name keeps its possessor in Russian', () => {
  assert.equal(subject("Tom's Mary is here.").possessor?.name, 'Tom');
  assert.equal(ru("Tom's Mary is here."), 'Мэри Tom здесь.');
});

test('a usage example without "that" still shows the that frame', async () => {
  const { senseFrames } =
    await import('../../formal-ai/src/sources/verb-frames.mjs');
  const said = senseFrames(
    "{{lb|en|transitive}} To tell.\n#: {{ux|en|He '''said''' he would be here tomorrow.}}",
    'said'
  );
  assert.ok(said.includes('that'), said.join(' '));
  const named = senseFrames(
    "{{lb|en|transitive}} To pronounce.\n#: {{ux|en|Please '''say''' your name slowly.}}",
    'say'
  );
  assert.ok(!named.includes('that'), named.join(' '));
});

test('a light verb in a two-word synonym is no cue of the sense', async () => {
  const { glossWords } =
    await import('../../formal-ai/src/sources/sense-data.mjs');
  const cues = glossWords(
    'To give consideration; heed; pay attention',
    'x',
    true
  );
  assert.ok(cues.includes('attention') && !cues.includes('pay'), cues.join());
  assert.ok(glossWords('pay attention; heed', 'x').includes('pay'));
});
