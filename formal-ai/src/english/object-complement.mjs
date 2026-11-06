/**
 * Object complements: "keep repos active", "keep it simple". After its
 * object, an adjective names the state the verb keeps or brings the object
 * into, when the verb has such a sense in the dictionary ("to maintain the
 * condition of; to preserve in a certain state", "to cause to become").
 */
import { has, head, reading, isPunct } from './token-readings.mjs';
import { nounAhead } from './predicate-adjectives.mjs';
import { borrowedAdjective } from './noun-helpers.mjs';

const STATE_SENSE =
  /\b(?:maintain|preserve|keep)\b[^.;]*\b(?:condition|state)\b|\bcause (?:\w+ )?to (?:be|become|remain)\b|\bcause or allow\b[^.;]*\bto remain\b/i;
const NOT_TRANSITIVE = /^(?:intransitive|archaic|obsolete)$/;

/** A verb sense that puts or keeps its object in a state. */
export const stateSense = (c) =>
  Boolean(
    c &&
    STATE_SENSE.test(c.definition || c.gloss || '') &&
    !(c.labels || []).some((l) => NOT_TRANSITIVE.test(l))
  );

const known = new WeakMap();
/** Does one of the verb's senses put its object into a state? */
export function statesObject(concepts, lexicon) {
  if (!lexicon || !concepts?.length) {
    return false;
  }
  const memo = known.get(lexicon) || new Map();
  known.set(lexicon, memo);
  const key = concepts.join(' ');
  if (!memo.has(key)) {
    memo.set(
      key,
      concepts.some((id) => stateSense(lexicon.get(id)))
    );
  }
  return memo.get(key);
}

/**
 * Read an object complement at the cursor into `out.complement`; true when
 * one was read.
 */
export function objectComplement(c, frame, out, options) {
  const t = c.peek;
  const next = c.at(1);
  if (
    frame === 'copula' ||
    out.complement ||
    out.objects.length === 0 ||
    !has(t, 'adj') ||
    nounAhead(c, 1) ||
    borrowedAdjective(t, options.lexicon) ||
    !(
      !next ||
      isPunct(next) ||
      has(next, 'coord') ||
      has(next, 'subord') ||
      has(next, 'prep')
    ) ||
    !statesObject(options.verbConcepts, options.lexicon)
  ) {
    return false;
  }
  c.next();
  const r = reading(t, 'adj');
  out.complement = { type: 'adj', ...head(t, r), object: true };
  return true;
}

/**
 * "keep your account active": an object noun phrase that swallowed the
 * state as its head (account active, a compound) is read again without
 * that last word, which is then the complement. `parse` reads a noun
 * phrase from a cursor.
 */
export function objectBeforeState(c, start, np, parse, options) {
  const last = c.tokens[c.i - 1];
  const next = c.peek;
  if (
    !np ||
    c.i - start < 2 ||
    !has(last, 'adj') ||
    !has(c.tokens[c.i - 2], 'noun') ||
    !(!next || isPunct(next) || has(next, 'coord') || has(next, 'subord')) ||
    !statesObject(options.verbConcepts, options.lexicon)
  ) {
    return np;
  }
  const shorter = new c.constructor(c.tokens.slice(0, c.i - 1));
  shorter.i = start;
  const object = parse(shorter);
  if (!object || shorter.i !== c.i - 1) {
    return np;
  }
  c.i -= 1;
  return object;
}

/** "stay", "seem": a verb with a sense the dictionary calls copulative. */
export function linksAdjective(concepts, lexicon) {
  return (concepts || []).some((id) =>
    lexicon?.get(id)?.frames?.includes('copulative')
  );
}

/** Does one of the verb's senses take two objects ("give users access")? */
export function takesTwoObjects(concepts, lexicon) {
  return (concepts || []).some((id) => {
    const c = lexicon?.get(id);
    return (
      c?.frames?.includes('ditransitive') ||
      (c?.labels || []).includes('ditransitive')
    );
  });
}
