/**
 * A subject modified by an active participle phrase: "Businesses
 * localizing content pay for review" — the phrase is a relative clause
 * («предприятия, которые локализуют контент»), recognised only when a
 * finite verb follows it.
 */

import { clause } from './clause-node.mjs';
import { parseTail } from './parser.mjs';
import { gerundReading, has, head } from './token-readings.mjs';

const finiteAhead = (t) =>
  ['be', 'modal', 'do', 'have'].some((p) => has(t, p)) ||
  t?.readings.some(
    (r) => r.pos === 'verb' && /base|3sg|past/.test(r.features?.form || '')
  );

/** Attach "localizing content" to the subject NP; false if it is not one. */
export function attachIngRelative(c, np, options) {
  const r = gerundReading(c.peek);
  if (
    !r ||
    !options.clauseStart ||
    np.pronoun ||
    np.relative ||
    np.participles ||
    (options.stopAt !== undefined && c.i >= options.stopAt)
  ) {
    return false;
  }
  const save = c.i;
  const v = c.next();
  // the phrase ends right before a finite verb: try each candidate end
  // ("content pay": "pay" is the clause's verb, not a compound's head)
  const tokens = c.tokens;
  let tail = null;
  for (let k = c.i + 1; k < tokens.length && !tail; k += 1) {
    if (!finiteAhead(tokens[k])) {
      continue;
    }
    c.tokens = tokens.slice(0, k);
    c.i = save + 1;
    const found = parseTail(c, 'event', { nonfinite: true });
    c.tokens = tokens;
    if (c.i === k && !found.complement) {
      tail = found;
    }
  }
  if (!tail) {
    c.tokens = tokens;
    c.i = save;
    return false;
  }
  np.relative = clause(
    'declarative',
    {
      verb: head(v, r),
      frame: 'event',
      tense: 'present',
      aspect: 'simple',
      polarity: 'positive',
      modal: null,
    },
    {
      subject: { type: 'np', relativeSubject: true, number: np.number },
      ...tail,
    }
  );
  return true;
}
