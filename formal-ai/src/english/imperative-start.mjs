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
import { calendarAhead } from './calendar.mjs';

/** The word starts a sentence, a parenthesis or a part after a semicolon. */
const opens = (c) =>
  Boolean(c.peek?.first || c.i === 0 || c.at(-1)?.text === ';');

/** "where required", "as agreed": a participle right after a subordinator. */
const afterLink = (c) =>
  has(c.at(-1), 'subord') &&
  ['where', 'as', 'if', 'when', 'unless'].includes(c.at(-1).lower);

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
  const opening = participleStart(c);
  if (opening) {
    const passive = adjectivePredicate(c, ctx, tailOptions, opening - 1);
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
  // "Last checked 3 November 2026", "Not published for…": adverbs and a
  // negation may come first
  let k = 0;
  while (
    k < 3 &&
    (has(c.at(k), 'adv') || has(c.at(k), 'neg')) &&
    !isPunct(c.at(k + 1))
  ) {
    k += 1;
  }
  const [a, after] = [c.at(k), c.at(k + 1)];
  // how many adverbs open it, plus one; 0 when it is no such start
  return (
    Boolean(
      (opens(c) || afterLink(c)) &&
      a?.readings.some(
        (r) => r.pos === 'verb' && /pp/.test(r.features?.form || '')
      ) &&
      ((afterLink(c) && (!after || isPunct(after))) ||
        (after &&
          (has(after, 'prep') ||
            has(after, 'adv') ||
            calendarAhead(c, k + 1)))) &&
      !has(after, 'det') &&
      // "Used to pay": "to" before a verb is an infinitive
      !(
        after?.lower === 'to' &&
        c
          .at(k + 2)
          ?.readings.some(
            (r) => r.pos === 'verb' && r.features?.form === 'base'
          )
      )
    ) && k + 1
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
  // …and only one that agrees with it ("get consent": no singular "get"
  // takes a bare "consent")
  const plural = reading(t, 'noun')?.features?.number === 'pl';
  if (
    has(t, 'noun') &&
    (has(c.at(1), 'be') ||
      has(c.at(1), 'modal') ||
      c
        .at(1)
        ?.readings.some(
          (x) =>
            x.pos === 'verb' &&
            (plural ? /base|past/ : /3sg|past/).test(x.features?.form || '')
        ))
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
      // "Direct invoicing pays": a gerund heads the subject too
      const gerund = reading(head, 'verb')?.features?.form === 'ing';
      if (!has(head, 'noun') && !gerund) {
        break;
      }
      const plural = reading(head, 'noun')?.features?.number === 'pl';
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
    !opens(c) ||
    has(t, 'pron') ||
    has(t, 'det') ||
    !t.readings.some((r) => r.pos === 'verb' && r.features?.form === '3sg')
  ) {
    return false;
  }
  if (!has(t, 'noun')) {
    return true;
  }
  if (nounPairAhead(c)) {
    return false;
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
 * "Content & media", "Services and freelancing": a noun joined at once to
 * another noun or a gerund is the first of two names of things, no verb.
 */
export function nounPairAhead(c) {
  const [t, link, next] = [c.peek, c.at(1), c.at(2)];
  return (
    has(t, 'noun') &&
    has(link, 'coord') &&
    Boolean(next) &&
    next.readings.some(
      (r) =>
        r.pos === 'noun' || (r.pos === 'verb' && r.features?.form === 'ing')
    ) &&
    !next.readings.some(
      (r) => r.pos === 'verb' && ['base', '3sg'].includes(r.features?.form)
    )
  );
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
    (opens(c) || (afterLink(c) && (!after || isPunct(after)))) &&
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
      // "Legal everywhere": an adverb that is nothing else
      after.readings.every((r) => r.pos === 'adv') ||
      after.lower === 'to') &&
    !(after && has(after, 'noun') && !has(after, 'prep'))
  );
}

/** "Fully passive after install" → (it is) fully passive after install. */
function adjectivePredicate(c, ctx, tailOptions, adverbs = false) {
  // a number: a passive opened by that many adverbs ("Last checked…")
  const passive = adverbs !== false;
  const be = {
    text: 'is',
    lower: 'is',
    kind: 'word',
    index: -1,
    readings: [
      { pos: 'be', lemma: 'be', features: { form: '3sg' }, concepts: ['be'] },
    ],
  };
  const rest = c.tokens.slice(c.i).map((t, k) =>
    k < (adverbs || 0)
      ? {
          ...t,
          readings: t.readings.filter((r) => ['adv', 'neg'].includes(r.pos)),
        }
      : // "where required": the participle of a passive, not an adjective
        passive && k === adverbs
        ? { ...t, readings: t.readings.filter((r) => r.pos === 'verb') }
        : t
  );
  const reordered = new Cursor([be, ...rest]);
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
