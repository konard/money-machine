/** Comma lists, parallel predicates and a clause ahead. */

import { Cursor } from './cursor.mjs';
import { parseNP } from './parser.mjs';
import { has, reading, startsNP } from './token-readings.mjs';
import { COORDINATORS } from './function-words.mjs';
import { quantityDegree } from './quantity.mjs';

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
    // "reproduce bugs, write fixes and tests": a verb like the one before
    if (!startsNP(c.peek) || clauseAhead(c, 0) || parallelVerb(c, 0)) {
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

/**
 * "neither the FAQ nor the terms", "either a card or a bank": a correlative
 * pair. The verb agrees with the nearer item ("neither A nor B publishes").
 */
export function eitherOr(c) {
  const pair = { neither: 'nor', either: 'or' }[c.peek?.lower];
  if (!pair || !startsNP(c.at(1))) {
    return null;
  }
  const save = c.i;
  c.next();
  const first = parseItem(c);
  const joined = first && c.peek?.lower === pair && startsNP(c.at(1));
  const last = joined && c.next() && parseItem(c);
  if (!last) {
    c.i = save;
    return null;
  }
  return {
    type: 'np',
    coord: COORDINATORS[pair],
    correlative: true,
    items: [first, last],
    number: last.number,
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
    // …and so may a statement's: "summarizes channels or runs games"
    (/^(?:base|3sg)$/.test(form) && has(after, 'noun') && !has(c.at(k), 'adj'))
  );
}

/**
 * Is a finite verb coming after an NP at offset k (so "and" joins clauses)?
 * The probe's noun phrase may itself be a comma list, which probes every later
 * comma: remembered per position, or a long list takes exponential time.
 */
const probed = new WeakMap();
export function clauseAhead(c, k) {
  let known = probed.get(c.tokens);
  if (known?.grammar !== c.grammar) {
    known = { grammar: c.grammar, at: new Map() };
    probed.set(c.tokens, known);
  }
  const at = c.i + k;
  if (!known.at.has(at)) {
    known.at.set(at, probeClause(c, at));
  }
  return known.at.get(at);
}

function probeClause(c, at) {
  const probe = new Cursor(c.tokens);
  probe.grammar = c.grammar;
  probe.i = at;
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

/**
 * After a prepositional phrase, "and"/"or" followed by another one,
 * perhaps across an adverb set off by commas ("and, more often, from").
 * @returns {{comma: number}|null} position of the closing comma, or -1
 */
export function coordinatedPP(c) {
  if (!['and', 'or'].includes(c.peek.lower)) {
    return null;
  }
  if (has(c.at(1), 'prep') && startsNP(c.at(2))) {
    return { comma: -1 };
  }
  if (c.at(1)?.text !== ',') {
    return null;
  }
  let k = 2;
  while (c.at(k) && (has(c.at(k), 'adv') || quantityDegree(c.at(k)))) {
    k += 1;
  }
  return k > 2 && c.at(k)?.text === ',' && has(c.at(k + 1), 'prep')
    ? { comma: c.i + k }
    : null;
}

/** "… (…) and link the source": a verb right before its object's determiner. */
export function verbObjectAhead(c, k) {
  const t = c.at(k);
  return (
    has(t, 'verb') &&
    !['det', 'poss', 'num', 'adj'].some((p) => has(t, p)) &&
    ['det', 'poss'].some((p) => has(c.at(k + 1), p))
  );
}
