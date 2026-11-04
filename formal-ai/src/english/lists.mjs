/** Comma lists, parallel predicates and a clause ahead. */

import { Cursor } from './cursor.mjs';
import { parseNP } from './parser.mjs';
import { has, reading, startsNP } from './token-readings.mjs';

/**
 * "Kenya, Nigeria and Ghana", "A, B, or C": a comma list is one
 * coordination only when it ends in "and"/"or" + a noun phrase.
 */
export function commaList(c, first) {
  if (c.peek?.text !== ',' || !startsNP(c.at(1)) || clauseAhead(c, 1)) {
    return null;
  }
  const save = c.i;
  const items = [first];
  while (c.peek?.text === ',') {
    c.next();
    const word = c.peek?.lower;
    if ((word === 'and' || word === 'or') && startsNP(c.at(1))) {
      break;
    }
    if (!startsNP(c.peek) || clauseAhead(c, 0)) {
      c.i = save;
      return null;
    }
    const item = parseItem(c);
    if (!item) {
      c.i = save;
      return null;
    }
    items.push(item);
  }
  const word = c.peek?.lower;
  if ((word !== 'and' && word !== 'or') || !startsNP(c.at(1))) {
    c.i = save;
    return null;
  }
  c.next();
  const last = parseItem(c);
  if (!last) {
    c.i = save;
    return null;
  }
  items.push(last);
  return {
    type: 'np',
    coord: word === 'or' ? 'conj.or' : 'conj.and',
    items,
    number: word === 'or' ? first.number : 'pl',
  };
}

/** One item of a list: a noun phrase without its own coordination. */
function parseItem(c) {
  const np = parseNP(c, { item: true });
  return np?.coord ? null : np;
}

/**
 * After "and", a word in the same finite form as the clause's verb that
 * takes a complement is a second predicate ("lives … and works for").
 */
export function parallelVerb(c, k) {
  const r = reading(c.at(k), 'verb');
  const form = r?.features.form;
  if (
    !c.finite ||
    !form ||
    !(
      form === c.finite ||
      form.split('|').some((f) => c.finite.split('|').includes(f))
    )
  ) {
    return false;
  }
  const after = c.at(k + 1);
  return (
    !after ||
    (after.kind === 'punct' && /[.!?;]/.test(after.text)) ||
    ['prep', 'det', 'pron', 'poss', 'to', 'adv', 'num'].some((p) =>
      has(after, p)
    ) ||
    // a request's second verb may take a bare object: "and deposit money"
    (form === 'base' && has(after, 'noun') && !has(c.at(k), 'adj'))
  );
}

/** Is a finite verb coming after an NP at offset k (so "and" joins clauses)? */
export function clauseAhead(c, k) {
  const probe = new Cursor(c.tokens);
  probe.i = c.i + k;
  const np = parseNP(probe);
  if (!np) {
    return false;
  }
  const t = probe.peek;
  return Boolean(
    t &&
    (has(t, 'be') ||
      has(t, 'have') ||
      has(t, 'do') ||
      has(t, 'modal') ||
      (has(t, 'verb') && reading(t, 'verb').features.form !== 'base') ||
      (has(t, 'verb') && np.pronoun))
  );
}
