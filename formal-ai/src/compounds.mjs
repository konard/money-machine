/**
 * Compound terms: two adjacent content words that a dictionary may list as
 * one entry ("open source", "credit card", "bank account"). Such a term has
 * its own translation, which word-by-word translation would miss.
 */

import { readings, tokenize } from './english/analyze.mjs';

const CONTENT = new Set(['noun', 'verb', 'adj', 'adv', 'propn']);

/**
 * Candidate page titles for two-word terms in a text. The last word is
 * given in its dictionary form ("bank accounts" → "bank account").
 * @param {string} text
 * @param {import('./lexicon.mjs').Lexicon} lexicon
 * @returns {string[]}
 */
export function compoundCandidates(text, lexicon) {
  const out = new Set();
  const clean = text
    .replace(/```[\s\S]*?```|`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)|https?:\/\/\S+|<[^>]+>/g, ' ');
  const tokens = tokenize(clean);
  const content = (token) => {
    if (token?.kind !== 'word' || !/^[a-z]{2,}$/.test(token.lower)) {
      return null;
    }
    const found = readings({ ...token, text: token.lower }, lexicon);
    return found.length && found.every((r) => CONTENT.has(r.pos))
      ? found
      : found.length
        ? null
        : [];
  };
  for (let i = 0; i + 1 < tokens.length; i += 1) {
    const [a, b] = [tokens[i], tokens[i + 1]];
    if (!content(a)) {
      continue;
    }
    const second = content(b);
    if (!second) {
      continue;
    }
    const singular = second.find(
      (r) => r.pos === 'noun' && r.features?.number === 'pl' && r.lemma
    );
    out.add(`${a.lower} ${singular ? singular.lemma : b.lower}`);
  }
  return [...out].filter((t) => !lexicon.asked?.(t));
}
