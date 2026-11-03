/** Time phrases: "every Monday", "last year", a time noun ahead. */

import { reading } from './token-readings.mjs';

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
