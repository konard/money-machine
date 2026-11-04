/** Finite complements: an overt subject plus an agreeing verb, not an object NP. */
import { Cursor, has, parseNP, parseVerbGroup } from './parser.mjs';
import { startsNP } from './token-readings.mjs';

// These subject forms cannot be objects of the preceding English verb.
const SUBJECT_ONLY = new Set(['i', 'he', 'she', 'we', 'they']);

export function finiteComplementAhead(c, predicate, ctx) {
  const wh = has(c.peek, 'wh');
  const probe = new Cursor(c.tokens);
  probe.i = c.i + (wh ? 1 : 0);
  probe.grammar = ctx;
  const start = probe.peek;
  const licensed = predicate?.candidates.some((id) =>
    ctx.lexicon.get(id)?.frames?.includes('that')
  );
  // A noun subject only after a verb whose dictionary frame takes a "that"
  // clause ("says the pay is low"): elsewhere a noun can absorb the next
  // finite verb as a compound or relative.
  if (!has(start, 'pron') && !(licensed && !wh && startsNP(start))) {
    return null;
  }
  if (!wh && !SUBJECT_ONLY.has(start.lower) && !licensed) {
    return null;
  }
  const subject = parseNP(probe, { clauseStart: true });
  if (!subject || (!subject.pronoun && has(start, 'pron'))) {
    return null;
  }
  const third = subject.pronoun
    ? subject.pronoun.person === 3 && subject.number === 'sg'
    : subject.number !== 'pl' && !subject.coord;
  const verb = parseVerbGroup(probe, third ? 'third' : null);
  return verb ? (wh ? 'wh' : 'that') : null;
}
