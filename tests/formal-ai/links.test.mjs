import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseLino, childrenNamed } from '../../formal-ai/src/lino.mjs';
import { Lexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  parseConcept,
  linksConcept,
} from '../../formal-ai/src/links/schema.mjs';
import { writeLino } from '../../formal-ai/src/links/write.mjs';
import { UnionLinks } from '../../formal-ai/src/links/union.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';

const parse = (text) =>
  childrenNamed(parseLino(text), 'concept').map(parseConcept);

test('writer round trips every legacy concept, including grammar defaults', () => {
  for (const dir of [
    'formal-ai/data/overrides',
    'tests/formal-ai/fixtures/vocabulary',
  ]) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.lino'))) {
      const concepts = parse(readFileSync(`${dir}/${file}`, 'utf8'));
      assert.deepEqual(parse(writeLino(concepts)), concepts, file);
    }
  }
});

test('writer preserves public evidence, empty values, quotes and multiline glosses', () => {
  const concepts = [
    {
      id: 'external:#"\n',
      en: [{ pos: 'phrase', words: ['value', 'added', 'tax'] }],
      ru: {
        pos: 'noun',
        lemma: 'налог',
        forms: { 'sg.gen': 'налога' },
        government: { case: 'gen', preposition: null },
      },
      gloss: 'a "quoted" # gloss\nwith (brackets) and \\ escapes',
      source: 'en.wikipedia',
      contexts: ['finance', 'multi word'],
      frames: [{ kind: 'object', markers: ['to'] }],
      sentencePairs: [
        { englishWord: 'tax', russianWords: ['налог'], russian: 'Налог.' },
      ],
      ruFrequency: 17,
      optional: undefined,
      nested: { empty: undefined },
    },
    { id: 'empty', en: [], ru: null, contexts: [] },
  ];
  assert.deepEqual(parse(writeLino(concepts)), concepts);
});

test('union shadows by address in registry order, independent of load order', () => {
  const union = new UnionLinks();
  union.add(
    {
      id: 'x',
      gloss: 'later',
      ru: { forms: { 'sg.gen': 'later', 'pl.gen': 'kept' } },
    },
    'wikidata'
  );
  union.add(
    { id: 'x', gloss: 'first', contexts: ['science'] },
    'en.wiktionary'
  );
  union.add(
    { id: 'x', ru: { forms: { 'sg.gen': 'override' } }, extra: true },
    'overrides',
    'local.lino'
  );
  assert.deepEqual(union.get('x'), {
    id: 'x',
    gloss: 'first',
    contexts: ['science'],
    extra: true,
    ru: { forms: { 'sg.gen': 'override', 'pl.gen': 'kept' } },
  });
  assert.equal(
    union.links('x').find((l) => l.path.join('.') === 'ru.forms.sg.gen')
      .provenance,
    'local.lino'
  );
});

const publicBook = () => ({
  id: 'wikt:book:noun:1',
  en: [{ pos: 'noun', lemma: 'book', words: ['book'] }],
  ru: {
    pos: 'noun',
    lemma: 'книга',
    gender: 'f',
    forms: { 'sg.gen': 'книги' },
  },
  source: 'wiktionary',
});

test('a form-only overlay fills a gap and corrects a slot without redefining the public concept', () => {
  const lexicon = new Lexicon();
  lexicon.addTree(
    parseLino(
      'concept wikt:book:noun:1\n  form sg.gen книги\n  form pl.gen книг\n  contexts (publishing)'
    ),
    'patch.lino'
  );
  assert.equal(lexicon.get('wikt:book:noun:1'), undefined);
  lexicon.add(publicBook());
  const concept = lexicon.get('wikt:book:noun:1');
  assert.equal(concept.ru.lemma, 'книга');
  assert.deepEqual(concept.ru.forms, { 'sg.gen': 'книги', 'pl.gen': 'книг' });
  assert.deepEqual([...lexicon.contextsOf(concept)], ['publishing']);
  const links = lexicon.mergedLinks('book');
  assert.equal(
    links.find((l) => l.path.join('.') === 'ru.lemma').layer,
    'en.wiktionary'
  );
  assert.equal(
    links.find((l) => l.path.join('.') === 'ru.forms.pl.gen').layer,
    'overrides'
  );
  assert.deepEqual(
    parse(writeLino([linksConcept(concept.id, links)]))[0],
    linksConcept(concept.id, links)
  );
});

test('per-link correction measurably fixes an attested inflection while keeping other links', () => {
  const lexicon = new Lexicon();
  lexicon.add(publicBook());
  const sentence = 'Books.';
  // A bad public form can be corrected independently of its lemma and senses.
  lexicon.get('wikt:book:noun:1').ru.forms['pl.nom'] = 'книга';
  assert.equal(translateDocument(sentence, { lexicon }).text, 'Книга.');
  lexicon.addTree(
    parseLino('concept wikt:book:noun:1\n  form pl.nom книги'),
    'patch.lino'
  );
  assert.equal(translateDocument(sentence, { lexicon }).text, 'Книги.');
});

test('links CLI prints parseable notation with per-link provenance offline', () => {
  const result = spawnSync(
    process.execPath,
    ['formal-ai/bin/formal-ai.mjs', 'links', 'book', '--offline'],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /layer overrides/);
  assert.ok(
    parse(result.stdout).some((c) => c.en.some((en) => en.lemma === 'book'))
  );
});

test('plain partial fields can also be added to a written concept', () => {
  const concept = publicBook();
  const text = `${writeLino([concept])}  form pl.gen книг\n  contexts (publishing)\n`;
  const parsed = parse(text)[0];
  assert.equal(parsed.ru.forms['pl.gen'], 'книг');
  assert.deepEqual(parsed.contexts, ['publishing']);
});

test('frequency link provenance preserves an explicit override', () => {
  const lexicon = new Lexicon();
  lexicon.add(publicBook());
  lexicon.links.add(
    { id: 'wikt:book:noun:1', ruFrequency: 42 },
    'overrides',
    'patch.lino'
  );
  lexicon.get('wikt:book:noun:1').ruFrequency = 7;
  const links = lexicon.mergedLinks('book');
  const frequency = links.find((l) => l.path[0] === 'ruFrequency');
  assert.equal(frequency.value, 42);
  assert.equal(frequency.layer, 'overrides');
});

test('partial corrections survive later public enrichment without dropping new properties', () => {
  const lexicon = new Lexicon();
  lexicon.addTree(
    parseLino('concept wikt:book:noun:1\n  form pl.gen книг'),
    'patch.lino'
  );
  lexicon.add(publicBook());
  const c = lexicon.get('wikt:book:noun:1');
  c.ru.forms['pl.gen'] = 'bad public update';
  c.ru.forms['pl.dat'] = 'книгам';
  lexicon.applyOverrides();
  assert.equal(c.ru.forms['pl.gen'], 'книг');
  assert.equal(c.ru.forms['pl.dat'], 'книгам');
});
