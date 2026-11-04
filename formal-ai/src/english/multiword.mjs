/**
 * Multi-word units: lexicon entries spelled with several words ("credit
 * card", "set up") and complex prepositions ("according to").
 */

import { COMPLEX_PREPOSITIONS } from './function-words.mjs';

/** Merge multi-word lexicon entries and complex prepositions. */
export function mergeMultiwords(tokens, lexicon) {
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    let merged = false;
    // Resolved Wikidata labels take priority over common-word readings
    // ("United" and "Kingdom") and over shorter overlapping entities.
    let nameEnd = i;
    for (
      let j = i;
      j < tokens.length &&
      /^[A-Z]/.test(tokens[j].text) &&
      tokens[j].kind === 'word';
      j += 1
    ) {
      const name = tokens
        .slice(i, j + 1)
        .map((x) => x.text)
        .join(' ');
      if (lexicon.nameLabel?.(name)) {
        nameEnd = j + 1;
      }
    }
    if (nameEnd > i + 1) {
      const name = tokens
        .slice(i, nameEnd)
        .map((x) => x.text)
        .join(' ');
      out.push({
        ...t,
        text: name,
        lower: name.toLowerCase(),
        readings: [
          {
            pos: 'propn',
            lemma: name,
            features: { number: 'sg' },
            concepts: [],
          },
        ],
      });
      i = nameEnd - 1;
      continue;
    }

    const prepositions = [
      ...(lexicon.multiword.get(t.lower) || [])
        .filter((e) => e.pos === 'prep')
        .map((e) => e.words),
      ...COMPLEX_PREPOSITIONS,
    ].sort((a, b) => b.length - a.length);
    for (const words of prepositions) {
      if (words.every((w, k) => tokens[i + k]?.lower === w)) {
        const lemma = words.join(' ');
        out.push({
          ...t,
          text: tokens
            .slice(i, i + words.length)
            .map((x) => x.text)
            .join(' '),
          lower: lemma,
          readings: [
            {
              pos: 'prep',
              lemma,
              features: {},
              concepts: lexicon.lookup('prep', lemma).length
                ? lexicon.lookup('prep', lemma)
                : [`rel.${words.join('-')}`],
            },
          ],
        });
        i += words.length - 1;
        merged = true;
        break;
      }
    }
    if (merged) {
      continue;
    }
    // the first word of a phrasal verb may be inflected: "asked for"
    const verbLemmas = t.readings
      .filter((r) => r.pos === 'verb')
      .map((r) => r.lemma);
    const multi = [t.lower, ...verbLemmas].flatMap(
      (w) => lexicon.multiword.get(w) || []
    );
    for (const entry of multi) {
      const inflected = entry.pos === 'verb' && entry.words[0] !== t.lower;
      const firstOk = inflected
        ? verbLemmas.includes(entry.words[0])
        : entry.words[0] === t.lower;
      const n = entry.words.length;
      // the last word of a compound noun may be plural: "bank accounts"
      const plural =
        entry.pos === 'noun' &&
        tokens[i + n - 1]?.readings?.some(
          (r) =>
            r.pos === 'noun' &&
            r.features?.number === 'pl' &&
            r.lemma === entry.words[n - 1]
        );
      // "is reading books": a progressive verb, not the compound "reading book"
      const progressive =
        entry.pos === 'noun' &&
        /ing$/.test(t.lower) &&
        tokens[i - 1]?.readings?.some((r) => r.pos === 'be');
      if (
        firstOk &&
        !progressive &&
        entry.words
          .slice(1)
          .every(
            (w, k) => tokens[i + k + 1]?.lower === w || (plural && k === n - 2)
          )
      ) {
        const verb =
          inflected &&
          t.readings.find(
            (r) => r.pos === 'verb' && r.lemma === entry.words[0]
          );
        out.push({
          ...t,
          text: tokens
            .slice(i, i + entry.words.length)
            .map((x) => x.text)
            .join(' '),
          lower: entry.lemma,
          readings: [
            {
              pos: entry.pos,
              lemma: entry.lemma,
              features: verb
                ? verb.features
                : entry.pos === 'noun'
                  ? { number: plural ? 'pl' : 'sg' }
                  : entry.pos === 'verb'
                    ? { form: 'base' }
                    : {},
              concepts: lexicon.lookup(entry.pos, entry.lemma),
            },
          ],
        });
        i += entry.words.length - 1;
        merged = true;
        break;
      }
    }
    if (!merged) {
      out.push(t);
    }
  }
  return out;
}
