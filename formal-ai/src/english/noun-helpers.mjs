/** Small noun phrase helpers shared with the core parser. */
import { head, reading, has } from './token-readings.mjs';
import { STANDALONE_DETERMINERS } from './function-words.mjs';
import { degreeAdverb, nounAhead } from './predicate-adjectives.mjs';

/**
 * "is here": an adjective whose every sense is borrowed from another word
 * (Wiktionary's "here: [[alive]]") gives way to the word's own adverb.
 */
export function borrowedAdjective(t, lexicon) {
  const own = (pos) =>
    (reading(t, pos)?.concepts || []).filter(
      (id) => !lexicon?.get(id)?.variant
    );
  return Boolean(
    lexicon && has(t, 'adv') && !own('adj').length && own('adv').length
  );
}

/** A quantifier as the whole noun phrase: "both", "many of them". */
export function standalone(c, np, options, attachOf) {
  const d = c.tokens[c.i - 1];
  const concept = STANDALONE_DETERMINERS[np.det];
  np.head = head(d, { pos: 'indef', lemma: d.lower, concepts: [concept] });
  np.number = np.det === 'det.each' ? 'sg' : 'pl';
  np.det = null;
  np.indefinite = true;
  return attachOf(c, np, options);
}

/**
 * "Outschool says payouts continue": after a name, a word that agrees with
 * it as a verb and is followed by a noun and a verb introduces a clause.
 */
export function verbAfterName(c, previous) {
  return (
    previous?.r.pos === 'propn' &&
    c.peek?.readings.some(
      (x) => x.pos === 'verb' && x.features.form === '3sg'
    ) &&
    has(c.at(1), 'noun') &&
    has(c.at(2), 'verb')
  );
}

/**
 * "is still open": an adverb before a lone adjective (or -ing verb) ending
 * the predicate; read as adjective + noun it would be a bare singular noun
 * phrase ("a still"), which a predicate does not take.
 */
export function stateAdverb(c, t, out) {
  const next = c.at(1);
  const after = c.at(2);
  const taken =
    has(t, 'adv') &&
    // "very good" is a degree of the adjective (see degreeComplement)
    !degreeAdverb(t) &&
    !has(t, 'det') &&
    (has(next, 'adj') ||
      next?.readings.some(
        (x) => x.pos === 'verb' && x.features.form === 'ing'
      )) &&
    !has(after, 'noun') &&
    !has(after, 'adj') &&
    !has(after, 'propn');
  if (taken) {
    // "is still open" → ещё открыт: the adverb before the state
    c.next();
    out.mods.push({
      type: 'adv',
      ...head(t, reading(t, 'adv')),
      preverbal: true,
    });
  }
  return taken;
}

/**
 * "first $50 licence", "next 10 days": an adjective before a count or an
 * amount comes first in English, but describes the noun after them.
 */
export function adjectiveBeforeCount(c) {
  const count = c.at(1)?.kind === 'quantity' || has(c.at(1), 'num');
  if (
    !has(c.peek, 'adj') ||
    has(c.peek, 'det') ||
    has(c.peek, 'num') ||
    !count ||
    !nounAhead(c, 2)
  ) {
    return [];
  }
  const t = c.next();
  return [head(t, reading(t, 'adj'))];
}

/** A plural noun ending a phrase: no head for a singular determiner. */
export function pluralOnly(t, next) {
  const nouns = t.readings.filter((r) => r.pos === 'noun');
  return (
    nouns.length > 0 &&
    nouns.every((r) => r.features?.number === 'pl') &&
    !has(next, 'noun')
  );
}

/**
 * "sell WordPress themes on Etsy": a name before a plural that ends the
 * object names the kind; "Outschool says…" opens a clause.
 */
export function nameOfKind(c, first, options) {
  const after = c.at(1);
  return (
    first.r.pos === 'propn' &&
    !options.clauseStart &&
    (!after ||
      after.kind === 'punct' ||
      ['coord', 'prep'].some((p) => has(after, p)))
  );
}
