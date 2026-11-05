/** An -ing modifier before a subject: "paying readers expect accuracy". */
import { gerundReading, has, head, reading } from './token-readings.mjs';
import { clause } from './clause-node.mjs';

export function attributiveAction(c, options, parseNP) {
  const r = gerundReading(c.peek);
  if (!r || options.attributiveProbe || !options.clauseStart) {
    return null;
  }
  const start = c.i;
  const token = c.next();
  const np = parseNP(c, {
    ...options,
    attributiveProbe: true,
    relative: false,
  });
  const finite = reading(c.peek, 'verb');
  // Agreement distinguishes "paying readers expect" from the activity
  // "paying readers costs money"; never decide from a word's spelling.
  const agrees =
    np && finite?.features.form === (np.number === 'pl' ? 'base' : '3sg');
  if (!agrees || np.action || np.pronoun || has(c.peek, 'adj')) {
    c.i = start;
    return null;
  }
  np.relative = clause(
    'declarative',
    {
      verb: head(token, r),
      frame: 'event',
      tense: 'present',
      aspect: 'simple',
      polarity: 'positive',
      modal: null,
    },
    {
      subject: { type: 'np', relativeSubject: true, number: np.number },
    }
  );
  return np;
}

/**
 * "Manual invoicing is slow", "Direct invoicing pays out": an adjective
 * before an -ing form with no noun reading describes the activity.
 */
export function describedAction(c, options, parseNP) {
  const [a, g] = [c.peek, c.at(1)];
  if (
    !options.clauseStart ||
    !has(a, 'adj') ||
    has(a, 'det') ||
    !gerundReading(g) ||
    has(g, 'noun')
  ) {
    return null;
  }
  const start = c.i;
  c.next();
  const np = parseNP(c, { ...options, clauseStart: false });
  if (!np?.action) {
    c.i = start;
    return null;
  }
  np.adjs = [head(a, reading(a, 'adj'))];
  return np;
}
