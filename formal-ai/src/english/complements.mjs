/** Finite complements: an overt subject plus an agreeing verb, not an object NP. */
import { Cursor, has, parseNP, parseVerbGroup } from './parser.mjs';

// These subject forms cannot be objects of the preceding English verb.
const SUBJECT_ONLY = new Set(['i', 'he', 'she', 'we', 'they']);

export function finiteComplementAhead(c, predicate, ctx) {
  const wh = has(c.peek, 'wh');
  const probe = new Cursor(c.tokens);
  probe.i = c.i + (wh ? 1 : 0);
  probe.grammar = ctx;
  const start = probe.peek;
  // Restrict the initial implementation to pronoun subjects. A noun can
  // otherwise absorb the next finite verb as a compound or relative.
  if (!has(start, 'pron')) {
    return null;
  }
  const licensed = predicate?.candidates.some((id) =>
    ctx.lexicon.get(id)?.frames?.includes('that')
  );
  if (!wh && !SUBJECT_ONLY.has(start.lower) && !licensed) {
    return null;
  }
  const subject = parseNP(probe, { clauseStart: true });
  if (!subject?.pronoun) {
    return null;
  }
  const third = subject.pronoun.person === 3 && subject.number === 'sg';
  const verb = parseVerbGroup(probe, third ? 'third' : null);
  return verb ? (wh ? 'wh' : 'that') : null;
}
