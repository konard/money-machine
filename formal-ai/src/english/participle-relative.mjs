/**
 * Reduced passive relatives after a noun: "an account entered at
 * withdrawal time".
 */

import { parseTail } from './parser.mjs';
import { has, head, participleReading, reading } from './token-readings.mjs';

/** A reduced passive relative: "an account entered at withdrawal time". */
export function attachParticiple(c, np, options) {
  const detached = c.peek?.text === ',';
  const r = participleReading(detached ? c.at(1) : c.peek);
  if (
    !r ||
    (detached &&
      (c.at(1)?.readings || []).some(
        (x) => x.pos === 'verb' && x.features.form === 'base'
      )) ||
    np.pronoun ||
    np.participles ||
    (options.stopAt !== undefined && c.i >= options.stopAt)
  ) {
    return;
  }
  // "Mary said (that) she…": a verb of saying or knowing before a clause
  if (
    !detached &&
    options.clauseStart &&
    ((has(c.at(1), 'subord') && !has(c.at(1), 'prep')) ||
      reading(c.at(1), 'pron')?.features?.case === 'nom') &&
    c.peek.readings.some((x) => x.pos === 'verb' && x.features.form === 'past')
  ) {
    return;
  }
  // A subject's ordinary past-tense predicate must remain finite.
  if (
    !detached &&
    options.clauseStart &&
    c.peek.readings.some(
      (x) => x.pos === 'verb' && /base|past|3sg/.test(x.features.form || '')
    ) &&
    !c.tokens
      .slice(c.i + 1)
      .some(
        (t) =>
          has(t, 'be') ||
          has(t, 'modal') ||
          t.readings.some((x) => x.pos === 'verb' && x.features.form === '3sg')
      )
  ) {
    return;
  }
  if (detached) {
    c.next();
  }
  const v = c.next();
  const tail = parseTail(c, 'event', { ...options, nonfinite: true });
  np.participles = [{ verb: head(v, r), ...tail }];
}
