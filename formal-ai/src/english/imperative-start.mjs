/**
 * How a sentence starts: with an imperative verb, or with a statement
 * whose subject goes unsaid.
 */

import {
  Cursor,
  has,
  reading,
  isPunct,
  parseVerbGroup,
  parseTail,
} from './parser.mjs';
import { clause } from './clause-node.mjs';

const IT = {
  type: 'np',
  pronoun: { lemma: 'it', person: 3, number: 'sg', gender: 'n' },
  number: 'sg',
  implicit: true,
};

/**
 * "Pays only on spending", "Fully passive after install": a statement
 * whose subject, the thing described, goes unsaid.
 */
export function noteStatement(c, ctx, tailOptions) {
  if (subjectlessStart(c)) {
    const vg = parseVerbGroup(c, 'third');
    if (vg) {
      const tail = parseTail(c, vg.frame, tailOptions(ctx, vg));
      return clause('declarative', vg, { subject: IT, ...tail });
    }
  }
  if (participleStart(c)) {
    const passive = adjectivePredicate(c, ctx, tailOptions, true);
    if (passive) {
      return passive;
    }
  }
  return adjectiveStart(c, ctx)
    ? adjectivePredicate(c, ctx, tailOptions)
    : null;
}

/**
 * "Generated from the catalog by a script", "Written by a team": a past
 * participle opening a sentence before a preposition is a passive whose
 * subject, the thing described, goes unsaid.
 */
function participleStart(c) {
  const [a, after] = [c.peek, c.at(1)];
  return Boolean(
    a?.first &&
    a.readings.some(
      (r) => r.pos === 'verb' && /pp/.test(r.features?.form || '')
    ) &&
    after &&
    (has(after, 'prep') || has(after, 'adv')) &&
    !has(after, 'det') &&
    // "Used to pay": "to" before a verb is an infinitive
    !(
      after.lower === 'to' &&
      c
        .at(2)
        ?.readings.some((r) => r.pos === 'verb' && r.features?.form === 'base')
    )
  );
}

export function isImperativeStart(c) {
  const t = c.peek;
  if (t.lower === 'please') {
    return true;
  }
  // "Never share your password"
  if (
    reading(t, 'neg')?.lemma === 'never' &&
    reading(c.at(1), 'verb')?.features.form === 'base'
  ) {
    return true;
  }
  if (has(t, 'do') && has(c.at(1), 'neg') && has(c.at(2), 'verb')) {
    return true;
  }
  if (t.lower === 'let' && c.at(1)?.lower === 'us') {
    return true;
  }
  if (!has(t, 'verb') || has(t, 'pron') || has(t, 'det')) {
    return false;
  }
  const r = reading(t, 'verb');
  if (r.features.form !== 'base') {
    return false;
  }
  // "Direct sponsorships need no platform": a modifier, a noun and a verb
  // that agrees with that noun make a subject, not an imperative
  if ((has(t, 'adj') || has(t, 'noun')) && agreeingSubjectAhead(c)) {
    return false;
  }
  // "Book a table" vs "Books are…": a noun reading wins only before a verb
  if (
    has(t, 'noun') &&
    (has(c.at(1), 'be') || has(c.at(1), 'verb') || has(c.at(1), 'modal'))
  ) {
    return false;
  }
  return true;
}

/** "sponsorships need", "fee applies": a noun then a verb agreeing with it. */
function agreeingSubjectAhead(c) {
  // A modifier may precede a compound head: "Long development times mean".
  if (has(c.peek, 'adj')) {
    for (let k = 2; k < c.tokens.length; k += 1) {
      const head = c.at(k - 1);
      if (!has(head, 'noun')) {
        break;
      }
      const plural = reading(head, 'noun').features?.number === 'pl';
      if (
        c
          .at(k)
          ?.readings.some(
            (r) =>
              r.pos === 'verb' && r.features?.form === (plural ? 'base' : '3sg')
          )
      ) {
        return true;
      }
    }
  }
  const noun = c.at(1);
  const verb = c.at(2);
  if (!has(noun, 'noun') || !verb || has(verb, 'det') || has(verb, 'prep')) {
    return false;
  }
  const plural = reading(noun, 'noun').features?.number === 'pl';
  if (has(verb, 'modal') || has(verb, 'be')) {
    return true;
  }
  return (verb.readings || []).some(
    (r) =>
      r.pos === 'verb' &&
      (r.features?.form === 'past' ||
        r.features?.form === (plural ? 'base' : '3sg'))
  );
}

/**
 * "Pays only on spending", "Takes about 5 minutes": a third-person verb
 * opening a sentence, with no verb ahead that a plural noun reading of it
 * could be the subject of ("Costs vary", "Costs in Europe are higher").
 */
function subjectlessStart(c) {
  const t = c.peek;
  if (
    !t?.first ||
    has(t, 'pron') ||
    has(t, 'det') ||
    !t.readings.some((r) => r.pos === 'verb' && r.features?.form === '3sg')
  ) {
    return false;
  }
  if (!has(t, 'noun')) {
    return true;
  }
  for (let k = 1; c.at(k) && !isPunct(c.at(k)); k += 1) {
    const x = c.at(k);
    // "spending you would make": a pronoun opens a clause of its own
    if (['coord', 'subord', 'wh', 'pron'].some((p) => has(x, p))) {
      break;
    }
    // "on any phone": a noun after a determiner or preposition is no verb
    const before = c.at(k - 1);
    if (has(x, 'noun') && ['det', 'prep', 'adj'].some((p) => has(before, p))) {
      continue;
    }
    if (
      has(x, 'be') ||
      has(x, 'modal') ||
      x.readings.some(
        (r) => r.pos === 'verb' && ['base', 'past'].includes(r.features?.form)
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * "Fully passive after install", "Free to join": a sentence opening with an
 * adjective (after degree adverbs) that modifies no noun is a predicate
 * whose subject is the thing described.
 */
function adjectiveStart(c, ctx) {
  let k = 0;
  while (
    has(c.at(k), 'adv') &&
    (!has(c.at(k), 'adj') || has(c.at(k + 1), 'adj'))
  ) {
    k += 1;
  }
  const a = c.at(k);
  const after = c.at(k + 1);
  return Boolean(
    c.peek?.first &&
    has(a, 'adj') &&
    // "Free to join": a verb reading yields to "to" + infinitive
    ((after?.lower === 'to' &&
      ctx.infinitiveOf?.(reading(a, 'adj')) !== false) ||
      !a.readings.some(
        (r) => r.pos === 'verb' && r.features?.form === 'base'
      )) &&
    !has(a, 'det') &&
    !has(a, 'pron') &&
    (!after ||
      isPunct(after) ||
      ['prep', 'subord', 'coord'].some((p) => has(after, p)) ||
      after.lower === 'to') &&
    !(after && has(after, 'noun') && !has(after, 'prep'))
  );
}

/** "Fully passive after install" → (it is) fully passive after install. */
function adjectivePredicate(c, ctx, tailOptions, passive = false) {
  const be = {
    text: 'is',
    lower: 'is',
    kind: 'word',
    index: -1,
    readings: [
      { pos: 'be', lemma: 'be', features: { form: '3sg' }, concepts: ['be'] },
    ],
  };
  const reordered = new Cursor([be, ...c.tokens.slice(c.i)]);
  reordered.grammar = ctx;
  const vg = parseVerbGroup(reordered);
  if (!vg) {
    return null;
  }
  if (passive !== Boolean(vg.passive)) {
    return null;
  }
  // a bare participle states a result: "Generated by…" → сгенерировано
  if (passive) {
    const ru = ctx.lexicon?.get(vg.verb.candidates[0])?.ru;
    if (
      !has(reordered.peek, 'adv') &&
      (ru?.perfective || ru?.aspect === 'perf')
    ) {
      vg.aspect = 'perfect';
    }
  }
  const tail = parseTail(reordered, vg.frame, tailOptions(ctx, vg));
  if (!passive && !tail.complement) {
    return null;
  }
  c.i += reordered.i - 1;
  return clause('declarative', vg, { subject: IT, ...tail });
}
