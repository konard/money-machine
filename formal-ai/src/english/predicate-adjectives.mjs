/**
 * Adjectives in the predicate: degree adverbs before them, coordinated
 * lists after them, and the test for a noun they would modify instead.
 */
import {
  has,
  head,
  participleReading,
  reading,
  startsNP,
} from './token-readings.mjs';

/** "very", "fully": a word that is only an adverb, before an adjective. */
export function degreeAdverb(t) {
  return has(t, 'adv') && t.readings.every((r) => r.pos === 'adv');
}

/**
 * "cheap, fast and safe", "tiny but nearly certain": more adjectives
 * coordinated with a predicate adjective share its subject; they are kept
 * on the complement as `also` ({link, adjective, degree}).
 */
export function coordinatedAdjectives(c, complement) {
  for (;;) {
    const save = c.i;
    const comma = c.peek?.lower === ',';
    if (comma) {
      c.next();
    }
    const link = has(c.peek, 'coord') ? reading(c.next(), 'coord') : null;
    if (!comma && !link) {
      return;
    }
    const degree =
      degreeAdverb(c.peek) && has(c.at(1), 'adj')
        ? head(c.peek, reading(c.next(), 'adv'))
        : null;
    const t = c.peek;
    // "cheap and fast cars": an adjective before its noun starts a phrase
    if (!has(t, 'adj') || nounAhead(c, 1)) {
      c.i = save;
      return;
    }
    c.next();
    (complement.also ||= []).push({
      link: link ? link.concepts[0] : null,
      adjective: head(t, reading(t, 'adj')),
      degree,
    });
  }
}

/** Does a noun follow within the next `k` tokens (adjectives skipped)? */
export function nounAhead(c, k) {
  let j = k;
  const nominal = (t) => has(t, 'noun') || has(t, 'name') || has(t, 'propn');
  while (
    // "concentrated in popular maintainers": "in" there is a preposition
    !(has(c.at(j), 'prep') && startsNP(c.at(j + 1))) &&
    (has(c.at(j), 'adj') || has(c.at(j), 'num') || participleReading(c.at(j)))
  ) {
    // "the high cost": a word that may be a noun ends the phrase when
    // nothing nominal follows it ("cost" is also a participle)
    const next = c.at(j + 1);
    if (
      nominal(c.at(j)) &&
      (!nominal(next) || (has(next, 'prep') && startsNP(c.at(j + 2)))) &&
      !has(next, 'adj') &&
      !participleReading(next)
    ) {
      return true;
    }
    j += 1;
  }
  const t = c.at(j);
  return Boolean(
    t &&
    !(has(t, 'prep') && startsNP(c.at(j + 1))) &&
    (has(t, 'noun') || has(t, 'name') || has(t, 'propn'))
  );
}
