/**
 * Prepositional phrases inside a subject: "Money from sales goes…",
 * "One lead per month covers…". They are tried only when no verb follows
 * the bare subject; a noun of the phrase may be the verb ("month covers"),
 * so the phrase is read up to each word that can be a finite verb, the
 * earliest first.
 */

import { has, parseNP, reading, startsNP } from './parser.mjs';
import { parseVerbGroup } from './verb-group.mjs';

const FINITE = /3sg|past|base/;

/**
 * @param {object} c - cursor right after the subject
 * @param {string|null} person - 'third' for a singular subject
 * @returns {{pps: object[], vg: object}|null} with the cursor at the
 *   verb's end, or null with the cursor unchanged
 */
export function subjectPhrases(c, person) {
  const start = c.i;
  const attempt = (limit) => {
    c.i = start;
    const pps = [];
    while (has(c.peek, 'prep') && startsNP(c.at(1)) && c.i < limit) {
      const prep = c.next();
      const np = parseNP(c, { stopAt: limit, relative: false });
      if (!np) {
        return null;
      }
      pps.push({
        type: 'pp',
        relation: reading(prep, 'prep').concepts[0],
        np,
      });
    }
    if (!pps.length) {
      return null;
    }
    const vg = parseVerbGroup(c, person);
    return vg ? { pps, vg } : null;
  };
  // the earliest possible verb first: "lead per month covers fixed cost"
  let found = null;
  for (let k = start + 2; !found && k < c.tokens.length; k += 1) {
    const t = c.tokens[k];
    if (
      t.readings.some(
        (r) => r.pos === 'verb' && FINITE.test(r.features?.form || '')
      ) ||
      ['be', 'modal', 'have', 'do'].some((p) => has(t, p))
    ) {
      found = attempt(k);
    }
  }
  found ||= attempt(Infinity);
  if (!found) {
    c.i = start;
  }
  return found;
}

/** How many readings a word has besides being a finite verb. */
export function verbAmbiguity(t) {
  return new Set(
    t.readings.map((r) => (r.pos === 'verb' ? r.features?.form : r.pos))
  ).size;
}

/**
 * "Tom pays fixed cost", "The lead covers fixed cost": a word inside the
 * greedy subject that can be a finite verb, and is a plainer verb than
 * the one the greedy reading found ("pays" vs "cost"), is the verb when
 * the clause read that way reaches as far.
 * @param {object} c - cursor at the end of the greedy clause
 * @param {number} start - clause start
 * @param {number} verbAt - token index of the greedy reading's verb
 * @param {(stopAt: number) => object|null} reparse - clause ending its
 *   subject before `stopAt`, cursor after it
 * @returns {object|null} the better clause (cursor after it) or null
 */
export function earlierVerb(c, start, verbAt, reparse) {
  const end = c.i;
  const verb = c.tokens[verbAt];
  // "says top tutors": an adjective before a noun; "times mean many
  // writers" keeps its verb before a determiner
  const after = c.tokens[verbAt + 1];
  const modifier =
    verb?.readings.some((r) => r.pos === 'adj') &&
    verb.readings.some(
      (r) => r.pos === 'verb' && r.features?.form === 'base'
    ) &&
    after?.readings.some((r) => r.pos === 'noun') &&
    !after.readings.some((r) => ['det', 'pron'].includes(r.pos));
  // A participle or uninflected adjective/verb may belong to the object
  // of an earlier finite verb: "says top tutors", "covers fixed cost".
  if (
    !verb?.readings.some(
      (r) => r.pos === 'verb' && /past|pp/.test(r.features?.form || '')
    ) &&
    !modifier
  ) {
    return null;
  }
  for (let k = start + 1; k < verbAt; k += 1) {
    const t = c.tokens[k];
    if (
      !t.readings.some(
        (r) =>
          r.pos === 'verb' &&
          /3sg|past/.test(r.features?.form || '') &&
          (!modifier || r.features?.form === '3sg')
      ) ||
      verbAmbiguity(t) >= verbAmbiguity(verb)
    ) {
      continue;
    }
    const retry = reparse(k);
    if (retry?.type === 'clause' && retry.verb?.token === k && c.i >= end) {
      return retry;
    }
  }
  c.i = end;
  return null;
}

/** "Payoneer and Wise withdrawals to local accounts": the nearest conjunct. */
export function attachPhrases(subject, pps) {
  (subject.coord ? subject.items.at(-1) : subject).pps = pps;
}
