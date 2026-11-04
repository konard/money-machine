/** Time phrases: "every Monday", "last year", a time noun ahead. */

import { has, reading } from './token-readings.mjs';

const TIME_NOUNS =
  /^(day|week|month|year|morning|evening|night|summer|winter|autumn|spring\.season|time|hour|minute|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)$/;

// a time noun by its English word: hand-written ids ("day") and learned
// ones ("wikt:day:noun:1") alike
const timeNoun = (lemma, ids = []) =>
  TIME_NOUNS.test(String(lemma || '').toLowerCase()) ||
  ids.some((id) => TIME_NOUNS.test(id) || TIME_NOUNS.test(id.split(':')[1]));

export function timeAhead(c) {
  const t = c.at(1);
  const r = t && reading(t, 'noun');
  return Boolean(r && timeNoun(r.lemma, r.concepts));
}

export function isTimeNP(np) {
  return Boolean(
    np.head &&
    (np.det === 'det.every' ||
      np.det === 'det.each' ||
      np.adjs?.some((a) => a.lemma === 'last' || a.lemma === 'next')) &&
    timeNoun(np.head.lemma, np.head.candidates)
  );
}

/**
 * "30 days after the sale", "2 weeks before launch": a counted time span
 * before after/before measures the distance from what follows.
 */
export function offsetModifier(c, np) {
  // "7 days earlier": the span is how much earlier (by 7 days)
  const comparative =
    has(c.peek, 'adv') &&
    c.peek.readings.some((r) => r.features?.degree === 'comparative');
  const relation = comparative
    ? 'rel.by'
    : reading(c.peek, 'prep')?.concepts?.[0];
  return ['rel.after', 'rel.before', 'rel.by'].includes(relation) &&
    np?.head &&
    (np.quantity !== undefined || np.quantityText) &&
    timeNoun(np.head.lemma, np.head.candidates)
    ? { type: 'pp', relation, offset: true, np }
    : null;
}

/** "is paid 20 days after sale": a counted time span and after/before ahead. */
export function offsetAhead(c, from) {
  for (let k = from; k < from + 4 && c.at(k + 1); k += 1) {
    const t = c.at(k);
    const r = reading(t, 'noun');
    if (t.kind === 'punct') {
      return false;
    }
    if (
      r &&
      timeNoun(r.lemma, r.concepts) &&
      c.at(k - 1)?.kind === 'number' &&
      ['rel.after', 'rel.before'].includes(
        reading(c.at(k + 1), 'prep')?.concepts?.[0]
      )
    ) {
      return true;
    }
  }
  return false;
}
