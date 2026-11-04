/** Small noun phrase helpers shared with the core parser. */
import { head, reading, has } from './token-readings.mjs';
import { STANDALONE_DETERMINERS } from './function-words.mjs';

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
