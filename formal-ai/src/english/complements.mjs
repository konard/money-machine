/** Finite complements: an overt subject plus an agreeing verb, not an object NP. */
import { Cursor, has, parseNP, parseVerbGroup, reading } from './parser.mjs';
import { startsNP } from './token-readings.mjs';

// These subject forms cannot be objects of the preceding English verb.
const SUBJECT_ONLY = new Set(['i', 'he', 'she', 'we', 'they']);

export function finiteComplementAhead(c, predicate, ctx) {
  const wh = has(c.peek, 'wh');
  const probe = new Cursor(c.tokens);
  probe.i = c.i + (wh ? 1 : 0);
  // the outer subject's limit (a retry's stopAt) is not this clause's
  probe.grammar = { ...ctx, stopAt: undefined };
  if (wh) {
    const asked = whClause(probe, reading(c.peek, 'wh'));
    if (asked) {
      return asked;
    }
    probe.i = c.i + 1;
  }
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

/**
 * "say what changed": the wh-word is the subject of a past or 3sg verb;
 * "limits which countries it accepts": a wh-phrase and then its clause.
 */
function whClause(probe, r) {
  const t = probe.peek;
  if (
    t?.readings.some(
      (x) => x.pos === 'verb' && /3sg|past/.test(x.features?.form || '')
    ) &&
    !t.readings.some((x) => ['noun', 'pron', 'det'].includes(x.pos))
  ) {
    return 'wh';
  }
  if (r?.features.role !== 'determiner' || !startsNP(t)) {
    return null;
  }
  const asked = parseNP(probe, { clauseStart: true, relative: false });
  if (!asked) {
    return null;
  }
  const agree = (np) =>
    (np.pronoun
      ? np.pronoun.person === 3 && np.number === 'sg'
      : np.number !== 'pl') && 'third';
  if (parseVerbGroup(probe, agree(asked))) {
    return 'wh';
  }
  const subject =
    has(probe.peek, 'pron') && parseNP(probe, { clauseStart: true });
  return subject && parseVerbGroup(probe, agree(subject)) ? 'wh' : null;
}
