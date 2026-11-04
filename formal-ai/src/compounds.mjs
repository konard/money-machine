/**
 * Compound terms: two adjacent content words that a dictionary may list as
 * one entry ("open source", "credit card", "bank account"). Such a term has
 * its own translation, which word-by-word translation would miss.
 */

import { readings, tokenize } from './english/analyze.mjs';
import { loadLexicon } from './lexicon.mjs';

const CONTENT = new Set(['noun', 'verb', 'adj', 'adv', 'propn']);

/**
 * Candidate page titles for two-word terms in a text. The last word is
 * given in its dictionary form ("bank accounts" → "bank account").
 * @param {string} text
 * @param {import('./lexicon.mjs').Lexicon} lexicon
 * @returns {string[]}
 */
export function compoundCandidates(text, lexicon, forms = []) {
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
    const dictionaryForm = forms.find(
      (f) => f.form === b.lower && f.pos === 'noun' && f.kind === 'plural'
    );
    out.add(
      `${a.lower} ${singular?.lemma || dictionaryForm?.lemma || b.lower}`
    );
  }
  return [...out].filter((t) => !lexicon.asked?.(t));
}

const PARTICLES = new Set(
  'up out off down over back away about for in on into with through around along'.split(
    ' '
  )
);
/** "asks for" → "ask for": verb lemma + following particle, as page titles. */
export function phrasalCandidates(text, lexicon = loadLexicon()) {
  const tokens = tokenize(text.replace(/```[\s\S]*?```|`[^`]*`/g, ' '));
  const out = new Set();
  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (t.kind !== 'word' || !next || !PARTICLES.has(next.lower)) {
      return;
    }
    for (const r of readings({ ...t, first: false }, lexicon)) {
      if (r.pos === 'verb') {
        out.add(`${r.lemma} ${next.lower}`);
      }
    }
  });
  return [...out];
}
