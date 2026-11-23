#!/usr/bin/env node
/**
 * node formal-ai/scripts/overrides.mjs [--reference=dir] [--write]
 *
 * Converter and diff report between public data and a reference
 * vocabulary. Every content word of the reference vocabulary (by default
 * the hand-written test vocabulary) is learned from Wiktionary/Wikidata
 * with an empty vocabulary, and the Russian the public data gives is
 * compared with the reference:
 *
 *   first    public data's most likely sense is the reference translation
 *   some     the reference translation is one of the public senses
 *   none     public data translates the word differently
 *   missing  public data has nothing for the word
 *
 * A word needs an override when one of its reference senses is missing
 * or translated otherwise, or when its first reference sense is not
 * public data's first; words listed in data/overrides/accepted.txt (the
 * public translation is as good) never do. With --write, the reference
 * concepts of those words are written to data/overrides/, file by file.
 */
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLexicon } from '../src/lexicon.mjs';
import { resolveText } from '../src/resolve.mjs';
import { translateDocument } from '../src/document.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OVERRIDES = join(here, '..', 'data', 'overrides');
const CONTENT = ['noun', 'verb', 'adj', 'adv'];

const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

/** Words whose public translation is accepted: "noun loan" per line. */
export function acceptedWords(file = join(OVERRIDES, 'accepted.txt')) {
  if (!existsSync(file)) {
    return new Set();
  }
  return new Set(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim().replace(/\s+/g, ' '))
      .filter(Boolean)
  );
}

/** Concept blocks of a lino file by id, with the comment lines above. */
export function conceptBlocks(text) {
  const blocks = new Map();
  for (const m of text.matchAll(/^concept (\S+)\n(?:[ \t]+.*(?:\n|$))*/gm)) {
    blocks.set(m[1], m[0].trimEnd());
  }
  return blocks;
}

const normal = (s) =>
  s
    .toLowerCase()
    .replace(/[.,!?«»"]/g, '')
    .trim();

/** Compare public data with the reference vocabulary, word by word. */
export async function compare(reference, options = {}) {
  const pub = loadLexicon({
    fresh: true,
    dir: mkdtempSync(join(tmpdir(), 'formal-ai-empty-')),
  });
  const words = new Map(); // "pos lemma" → reference concepts in order
  const phrases = [];
  for (const c of reference.concepts.values()) {
    for (const en of c.en || []) {
      if (CONTENT.includes(en.pos) && c.ru?.lemma) {
        const key = `${en.pos} ${en.words.join(' ')}`;
        words.set(key, [...(words.get(key) || []), c]);
      } else if (
        ['phrase', 'name'].includes(en.pos) &&
        (c.ru?.lemma || c.ru?.text)
      ) {
        phrases.push({ c, en });
      }
    }
  }
  const lemmas = [
    ...new Set([...words.keys()].map((k) => k.split(' ').slice(1).join(' '))),
  ];
  await resolveText(lemmas.join('\n'), {
    lexicon: pub,
    words: lemmas,
    topic: '',
    ...options,
  });
  const rows = [];
  for (const [key, concepts] of words) {
    const [pos, ...rest] = key.split(' ');
    const lemma = rest.join(' ');
    const ids = pub.lookup(pos, lemma);
    const ranked = ids
      .map((id) => pub.get(id))
      .sort((a, b) => (b.prior || 0) - (a.prior || 0))
      .map((c) => c.ru?.lemma);
    const kinds = concepts.map((c) => {
      const same = (r) =>
        r && (r === c.ru.lemma || r === c.ru.perfective?.lemma);
      return !ids.length
        ? 'missing'
        : same(ranked[0])
          ? 'first'
          : ranked.some(same)
            ? 'some'
            : 'none';
    });
    rows.push({
      key,
      concepts,
      kinds,
      public: [...new Set(ranked)].slice(0, 5),
      wrong:
        kinds.some((k) => k === 'none' || k === 'missing') ||
        kinds[0] !== 'first',
    });
  }
  // phrases and names: does the public pipeline give the reference text?
  for (const { c, en } of phrases) {
    const text = en.words
      .map((w) => (en.pos === 'name' ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
    const source =
      en.pos === 'name'
        ? `I know ${text}.`
        : `${text[0].toUpperCase()}${text.slice(1)}.`;
    await resolveText(source, { lexicon: pub, ...options });
    const out = translateDocument(source, { lexicon: pub }).text;
    const want = c.ru.text || c.ru.lemma;
    const ok = normal(out).includes(normal(want));
    rows.push({
      key: `${en.pos} ${text}`,
      concepts: [c],
      kinds: [ok ? 'first' : 'none'],
      public: [out],
      wrong: !ok,
    });
  }
  return rows;
}

async function main() {
  const dir =
    arg('reference') ||
    join(here, '..', '..', 'tests', 'formal-ai', 'fixtures', 'vocabulary');
  const reference = loadLexicon({ fresh: true, dir });
  const accepted = acceptedWords();
  const rows = await compare(reference);
  const tally = {};
  for (const r of rows) {
    for (const k of r.kinds) {
      tally[k] = (tally[k] || 0) + 1;
    }
  }
  const needed = rows.filter((r) => r.wrong && !accepted.has(r.key));
  console.log(
    JSON.stringify({
      ...tally,
      words: rows.length,
      overrides: needed.length,
      accepted: rows.filter((r) => r.wrong && accepted.has(r.key)).length,
    })
  );
  for (const r of rows.filter((x) => x.wrong)) {
    console.log(
      `${accepted.has(r.key) ? 'accepted' : 'override'}\t${r.key}\t${r.concepts.map((c, i) => `${c.id}:${r.kinds[i]}`).join(' ')}\t→ ${r.concepts.map((c) => c.ru.lemma || c.ru.text).join(', ')}\tpublic: ${r.public.join(', ')}`
    );
  }
  if (!process.argv.includes('--write')) {
    return;
  }
  // the reference concepts of each word needing an override, file by file
  const byFile = new Map();
  const seen = new Set();
  for (const r of needed) {
    for (const c of r.concepts) {
      if (seen.has(c.id)) {
        continue;
      }
      seen.add(c.id);
      const file = basename(c.source);
      const block = conceptBlocks(readFileSync(c.source, 'utf8')).get(c.id);
      if (block) {
        byFile.set(file, [
          ...(byFile.get(file) || []),
          `# public data: ${r.public.join(', ')}\n${block}`,
        ]);
      }
    }
  }
  for (const [file, blocks] of byFile) {
    const header = `# Corrections of public data (generated by scripts/overrides.mjs from the\n# reference vocabulary, then reviewed). An override concept replaces what\n# Wiktionary/Wikidata say about its word; every other word is learned from\n# public data while the translator runs.\n`;
    writeFileSync(join(OVERRIDES, file), `${header}\n${blocks.join('\n\n')}\n`);
    console.log(`wrote ${blocks.length} concepts to data/overrides/${file}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
