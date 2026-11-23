/**
 * "a bot that summarizes channels, translates or runs games": a relative
 * clause may go on with more predicates of the same relative subject.
 */

import { has, reading } from './token-readings.mjs';
import { parallelVerb } from './lists.mjs';

const LINKS = { and: 'conj.and', or: 'conj.or' };

/**
 * @param {object} c - cursor after the first predicate
 * @param {object} first - the relative clause
 * @param {string} form - the finite form of its verb ("3sg", "past")
 * @param {() => object|null} predicate - parse one more predicate
 * @returns {object} the clause, with `coordinated` predicates if a series
 *   ending in "and"/"or" follows
 */
export function relativePredicates(c, first, form, predicate) {
  const start = c.i;
  const more = [];
  while (c.peek && !more.at(-1)?.link) {
    const save = c.i;
    if (c.peek.text === ',') {
      c.next();
    }
    const word = c.peek?.lower;
    const link = LINKS[word] && { concept: LINKS[word], text: c.peek.text };
    if (link) {
      c.next();
    }
    const verb = reading(c.peek, 'verb');
    // the same finite form, then the end, a comma or an object
    const same =
      c.i > save &&
      verb?.features?.form === form &&
      !has(c.peek, 'det') &&
      (parallelVerb(c, 0) ||
        c.at(1)?.text === ',' ||
        Boolean(LINKS[c.at(1)?.lower]));
    const next = same && predicate();
    if (!next) {
      c.i = save;
      break;
    }
    more.push(link ? { ...next, link } : next);
  }
  if (!more.at(-1)?.link) {
    c.i = start;
    return first;
  }
  return { ...first, coordinated: more };
}
