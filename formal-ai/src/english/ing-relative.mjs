/**
 * A subject modified by an active participle phrase: "Businesses
 * localizing content pay for review" — the phrase is a relative clause
 * («предприятия, которые локализуют контент»), recognised only when a
 * finite verb follows it.
 */

import { clause } from './clause-node.mjs';
import { parseTail } from './parser.mjs';
import { gerundReading, has, head } from './token-readings.mjs';

// "Stripe missing in many reference countries": a singular subject takes
// no base form, so "reference" is no verb of its clause
const finiteAhead = (t, np) =>
  ['be', 'modal', 'do', 'have'].some((p) => has(t, p)) ||
  t?.readings.some(
    (r) =>
      r.pos === 'verb' &&
      (np?.number === 'sg' ? /3sg|past/ : /base|3sg|past/).test(
        r.features?.form || ''
      )
  );

/** Attach "localizing content" to the subject NP; false if it is not one. */
export function attachIngRelative(c, np, options) {
  const r = gerundReading(c.peek);
  if (r && !options.clauseStart) {
    return attachPostposedIng(c, np, options, r);
  }
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
    if (!finiteAhead(tokens[k], np)) {
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
    // "60-day hold matching the refund window": with no verb ahead, the
    // phrase modifies a noun of a heading
    return (
      !tokens.slice(save + 1).some((t) => finiteAhead(t, np)) &&
      attachPostposedIng(c, np, { ...options, clauseStart: false }, r)
    );
  }
  np.relative = relativeOf(v, r, np, tail);
  return true;
}

/** «которые локализуют контент»: the relative clause of an -ing phrase. */
function relativeOf(v, r, np, tail) {
  return clause(
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
}

/**
 * "a hold matching the refund window", "sellers wanting fast assets": an
 * -ing participle with its object after a noun later in a clause is a
 * relative clause too («удержание, которое соответствует окну возврата»).
 */
function attachPostposedIng(c, np, options, r) {
  const next = c.at(1);
  if (
    options.nonfinite ||
    np.pronoun ||
    np.relative ||
    np.participles ||
    (options.stopAt !== undefined && c.i >= options.stopAt) ||
    !next ||
    // a determiner surely opens the participle's object; otherwise the
    // -ing word must be no noun ("sound effects licensing")
    !(
      ['det', 'poss'].some((p) => has(next, p)) ||
      (!has(c.peek, 'noun') && ['adj', 'noun'].some((p) => has(next, p))) ||
      // "sellers wanting fast assets": after a plural, before a modifier
      (np.number === 'pl' && has(next, 'adj'))
    )
  ) {
    return false;
  }
  const save = c.i;
  const v = c.next();
  const tail = parseTail(c, 'event', {
    nonfinite: true,
    stopAt: options.stopAt,
  });
  if (!tail.objects.length || tail.complement) {
    c.i = save;
    return false;
  }
  np.relative = relativeOf(v, r, np, tail);
  return true;
}
