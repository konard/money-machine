import { infinitiveOf } from './infinitive.mjs';
/**
 * Sentence → clauses in the meta language.
 *
 * Handles declaratives, yes/no and wh-questions (by undoing subject–aux
 * inversion), imperatives, existentials ("there is"), possession ("have"),
 * copular clauses, infinitival complements ("want to read") and clause
 * linking by coordinators and subordinators.
 */

import { clause } from './clause-node.mjs';
import { earlierVerb, subjectPhrases } from './subject-phrases.mjs';
import { reducedPassive } from './reduced-passive.mjs';
import { leadingPhraseAhead, parseLeading } from './leading.mjs';
import { outerVerbAt } from './relative-end.mjs';
import { superlatives } from './quantity.mjs';
import { analyze } from './analyze.mjs';
import { finiteComplementAhead } from './complements.mjs';
import { isImperativeStart, noteStatement } from './imperative-start.mjs';
import {
  Cursor,
  has,
  reading,
  isPunct,
  startsNP,
  head,
  parseNP,
  parseVerbGroup,
  parseTail,
  mergeMultiwords,
  setRelativeParser,
  setParentheticalParser,
} from './parser.mjs';

const AUX = ['be', 'do', 'have', 'modal'];

let currentCtx = null;

setParentheticalParser((tokens) => {
  if (!currentCtx) {
    return null;
  }
  const outer = currentCtx;
  // a parenthesis usually holds a phrase: prefer that reading on a tie
  const fragments = parseClauses(tokens, { ...outer, fragments: true });
  const inner = fragments.leftover.length
    ? parseClauses(tokens, outer)
    : fragments;
  currentCtx = outer;
  return inner.leftover.length < fragments.leftover.length ? inner : fragments;
});

// Relatives with an overt subject have an object gap; otherwise a subject gap.
setRelativeParser((c, np) => {
  if (!currentCtx) {
    return null;
  }
  const explicit = ['who', 'which', 'that'].includes(c.peek?.lower);
  if (explicit) {
    c.next();
  }
  const start = c.i;
  const subject = parseNP(c, { clauseStart: true });
  const vg =
    subject &&
    parseVerbGroup(
      c,
      subject.number === 'pl' || subject.pronoun ? null : 'third'
    );
  if (vg) {
    const tailStart = c.i;
    let tail = parseTail(c, vg.frame, tailOptions(currentCtx, vg));
    // "the money we earn goes to the bank": the object the tail found is
    // the verb of the outer clause; the relative ends before it
    if (tail.objects.length && !tail.stranded && !explicit) {
      const end = outerVerbAt(c.tokens, tailStart, c.i, np);
      if (end >= tailStart) {
        const tokens = c.tokens;
        c.tokens = tokens.slice(0, end);
        c.i = tailStart;
        const shorter = parseTail(c, vg.frame, tailOptions(currentCtx, vg));
        c.tokens = tokens;
        if (shorter.objects.length || c.i !== end) {
          return null;
        }
        tail = shorter;
      }
    }
    // An occupied direct-object slot cannot also be the relative gap.
    if (tail.objects.length && !tail.stranded) {
      return null;
    }
    tail.objects.push({
      type: 'np',
      relativeSubject: true,
      number: np.number,
      ...(tail.stranded ? { marker: tail.stranded } : {}),
    });
    return clause('declarative', vg, { subject, ...tail });
  }
  c.i = start;
  if (!explicit) {
    return null;
  }
  const subjectVerb = parseVerbGroup(
    c,
    np.number === 'pl' || np.coord ? null : 'third'
  );
  if (!subjectVerb) {
    return null;
  }
  const tail = parseTail(
    c,
    subjectVerb.frame,
    tailOptions(currentCtx, subjectVerb)
  );
  return clause('declarative', subjectVerb, {
    subject: { type: 'np', relativeSubject: true, number: np.number },
    ...tail,
  });
});

/** Union of `en takes` prepositions across a verb reading's concepts. */
function takesOf(lexicon) {
  return (r) => [
    ...new Set(
      r.concepts.flatMap((id) => {
        const c = lexicon.get(id);
        return [
          ...(c?.takes || []),
          ...(c?.prepositionalTo || c?.frames?.includes('prep:to')
            ? ['prep:to']
            : []),
        ];
      })
    ),
  ];
}

/** Match a whole fixed phrase ("thank you very much"). */
function matchPhrase(tokens, lexicon) {
  const wordsOnly = tokens
    .filter((t) => !isPunct(t))
    .flatMap((t) => t.lower.replace(/^'/, '').split(/\s+/));
  for (const p of lexicon.phrases) {
    if (
      p.words.length === wordsOnly.length &&
      p.words.every((w, i) => w === wordsOnly[i])
    ) {
      return p.concept;
    }
  }
  return null;
}

/** Leading phrase followed by a comma: "Hello, John." / "Yes, I do." */
function leadingPhrase(tokens, lexicon) {
  const comma = tokens.findIndex((t) => t.text === ',');
  if (comma <= 0) {
    return null;
  }
  const concept = matchPhrase(tokens.slice(0, comma), lexicon);
  return concept ? { concept, rest: tokens.slice(comma + 1) } : null;
}

/**
 * Parse an English sentence into clauses.
 * @param {string} sentence
 * @param {import('../lexicon.mjs').Lexicon} lexicon
 * @returns {{tokens: object[], clauses: object[], punctuation: string, unknown: string[], leftover: string[]}}
 */
export function parseSentence(sentence, lexicon) {
  const analyzed = mergeMultiwords(
    superlatives(analyze(sentence, lexicon), lexicon),
    lexicon
  );
  analyzed.forEach((t, i) => {
    t.position = i;
  });
  const last = analyzed[analyzed.length - 1];
  const punctuation =
    isPunct(last) && /[.!?;:]/.test(last.text) ? last.text : '';
  const body = punctuation ? analyzed.slice(0, -1) : analyzed;
  const unknown = body
    .filter((t) => t.kind === 'word' && t.readings.length === 0)
    .map((t) => t.text);
  const result = {
    tokens: analyzed,
    clauses: [],
    punctuation,
    unknown,
    leftover: [],
  };
  const whole = matchPhrase(body, lexicon);
  if (whole) {
    result.unknown = [];
    result.clauses.push({ type: 'phrase', concept: whole });
    return result;
  }
  let tokens = body;
  const lead = leadingPhrase(body, lexicon);
  if (lead) {
    result.clauses.push({
      type: 'phrase',
      concept: lead.concept,
      trailing: ',',
    });
    tokens = lead.rest;
  }
  const ctx = {
    lexicon,
    takesOf: takesOf(lexicon),
    infinitiveOf: infinitiveOf(lexicon),
    question: punctuation === '?',
  };
  const clauses = parseClauses(tokens, ctx);
  // headings, labels and list items are often noun phrases without a verb:
  // read them as fragments when that leaves fewer words unparsed
  if (
    clauses.leftover.length > 0 ||
    !clauses.list.length ||
    !punctuation ||
    tokens.some((t) => t.text === ',')
  ) {
    const fragments = parseClauses(tokens, { ...ctx, fragments: true });
    if (
      fragments.leftover.length < clauses.leftover.length ||
      (fragments.leftover.length === clauses.leftover.length &&
        fragments.list.length > 1 &&
        fragments.list.every(
          (x, i) => x.np?.adjs?.length && (!i || x.link?.separator === ',')
        )) ||
      (!punctuation &&
        fragments.leftover.length === clauses.leftover.length &&
        fragments.list.some((x) => x.np?.participles)) ||
      // a heading "Value" or "Time to first dollar" names, it does not order
      (!punctuation &&
        fragments.leftover.length <= clauses.leftover.length &&
        clauses.list.length === 1 &&
        clauses.list[0].mood === 'imperative' &&
        !clauses.list[0].objects.length &&
        !clauses.list[0].complement &&
        !clauses.list[0].xcomp &&
        has(tokens[clauses.list[0].verb?.token], 'noun'))
    ) {
      Object.assign(clauses, fragments);
    }
  }
  for (const [i, item] of clauses.list.entries()) {
    if (!item.labelPredicate || clauses.list[i + 1]?.link?.separator !== ':') {
      continue;
    }
    const values = [];
    for (const value of clauses.list.slice(i + 1)) {
      if (
        value.type !== 'fragment' ||
        !value.np ||
        value.link?.separator === ';'
      ) {
        break;
      }
      values.push(value.np);
    }
    if (values.length) {
      item.labelSubject =
        values.length === 1
          ? values[0]
          : { coord: 'and', items: values, number: 'pl' };
    }
  }
  result.clauses.push(...clauses.list);
  result.leftover.push(...clauses.leftover);
  return result;
}

/** Clauses of a token run, with the words no clause could take. */
function parseClauses(tokens, ctx) {
  const result = { list: [], leftover: [] };
  currentCtx = ctx;
  const c = new Cursor(tokens);
  c.grammar = ctx;
  let link = null;
  while (!c.done) {
    const t = c.peek;
    if (isPunct(t)) {
      if ([';', ':', ','].includes(t.text) && result.list.length) {
        link = { ...(link || {}), separator: t.text };
      }
      c.next();
      continue;
    }
    // "That is a good idea": demonstrative subject, not the conjunction
    const demonstrativeThat =
      t.lower === 'that' &&
      result.list.length === 0 &&
      ['be', 'modal', 'aux'].some((p) => has(c.at(1), p));
    // "After dinner we…" is a fronted phrase, "After we ate…" a clause link
    const frontedPhrase =
      has(t, 'prep') && has(t, 'subord') && leadingPhraseAhead(c);
    if (
      !demonstrativeThat &&
      !frontedPhrase &&
      ((has(t, 'subord') && !has(t, 'wh')) ||
        // "When dogs bark, we run": a statement opening with "when" is
        // a clause link, as it is mid-sentence
        (has(t, 'subord') && has(t, 'wh') && !ctx.question))
    ) {
      const previous = result.list.at(-1);
      const candidates = previous?.verb?.candidates || [];
      const asksQuestion = candidates.some((id) => {
        const concept = ctx.lexicon.get(id);
        return (
          concept?.frames?.includes('question') ||
          /\b(?:question|inquire|ascertain)\b/.test(concept?.gloss || '')
        );
      });
      link = {
        ...(link || {}),
        concept:
          t.lower === 'if' && previous && !link?.separator && asksQuestion
            ? 'conj.whether'
            : reading(t, 'subord').concepts[0],
        text: t.text,
      };
      c.next();
      continue;
    }
    // "a ceiling, not a typical outcome": contrast with the phrase before
    if (
      has(t, 'neg') &&
      result.list.length > 0 &&
      isPunct(c.at(-1)) &&
      startsNP(c.at(1)) &&
      !AUX.some((p) => has(c.at(1), p))
    ) {
      link = { concept: 'conj.not', text: t.text };
      c.next();
      continue;
    }
    if (has(t, 'coord') && result.list.length > 0) {
      link = { concept: reading(t, 'coord').concepts[0], text: t.text };
      c.next();
      continue;
    }
    const before = c.i;
    // "(cost $0)", "(e.g. Fiverr)": a parenthesis usually holds a phrase
    if (isPunct(c.at(-1)) && c.at(-1).text === '(' && !ctx.fragments) {
      const fragment = parseFragment(c, ctx);
      if (fragment && (c.done || c.peek.text === ')')) {
        result.list.push(fragment);
        continue;
      }
      c.i = before;
    }
    const previous = result.list[result.list.length - 1];
    // "you add tests, write the report, and fix code": a comma series of
    // verbs closed by "and" shares the first clause's subject
    const series =
      link?.separator === ',' &&
      !link.concept &&
      has(t, 'verb') &&
      c.tokens.slice(c.i + 1).some((x) => has(x, 'coord'));
    const clause =
      ((link?.concept || series) &&
        previous?.subject &&
        (!previous.subject.implicit || previous.elided) &&
        ellipsis(c, ctx, previous)) ||
      parseClause(
        c,
        { ...ctx, embedded: link?.embedded },
        result.list.length === 0
      );
    if (!clause || c.i === before) {
      result.leftover.push(c.next().text);
      continue;
    }
    if (link) {
      clause.link = link;
      link = null;
    }
    result.list.push(clause);
    if (clause.finiteLink) {
      link = {
        concept: clause.finiteLink === 'that' ? 'conj.that' : null,
        embedded: true,
      };
      continue;
    }
    while (
      !c.done &&
      !isPunct(c.peek) &&
      !has(c.peek, 'coord') &&
      !has(c.peek, 'subord')
    ) {
      result.leftover.push(c.next().text);
    }
  }
  return result;
}

/** "low, median, high": every item of the list to its end is an adjective. */
function adjectiveListAhead(c, k) {
  const rest = c.tokens.slice(c.i + k);
  const end = rest.findIndex((x) => [':', ';', '.', ')'].includes(x.text));
  const list = end < 0 ? rest : rest.slice(0, end);
  return (
    list.length > 2 &&
    list.every((x, i) =>
      i % 2 ? x.text === ',' || has(x, 'coord') : has(x, 'adj')
    ) &&
    list.length % 2 === 1
  );
}

/** Parse one clause at the cursor. */
function parseClause(c, ctx, initial) {
  const t = c.peek;
  const property = has(t, 'neg') ? c.at(1) : t;
  const afterProperty = c.at(has(t, 'neg') ? 2 : 1);
  if (
    has(property, 'adj') &&
    !property.readings.some(
      (r) => r.pos === 'verb' && /pp/.test(r.features.form || '')
    ) &&
    (!afterProperty ||
      [':', ';'].includes(afterProperty.text) ||
      adjectiveListAhead(c, has(t, 'neg') ? 1 : 0))
  ) {
    const negative = has(t, 'neg');
    c.i += negative ? 2 : 1;
    return {
      type: 'fragment',
      property: head(property, reading(property, 'adj')),
      negative,
    };
  }
  if (ctx.fragments) {
    return parseFragment(c, ctx);
  }
  // A whole NP before a colon is a label, even with a verbal head reading.
  const labelStart = c.i;
  const label = parseFragment(c, ctx);
  if (label && c.peek?.text === ':') {
    return label;
  }
  c.i = labelStart;
  // Labels allow adverbs and subjectless negative passive predicates.
  if (has(t, 'adv') && (!c.at(1) || [':', ';'].includes(c.at(1)?.text))) {
    c.next();
    return {
      type: 'fragment',
      mods: [{ type: 'adv', ...head(t, reading(t, 'adv')) }],
    };
  }
  if (has(t, 'neg')) {
    const save = c.i;
    const vg = parseVerbGroup(c);
    if (vg && (c.peek?.text === ':' || c.done)) {
      vg.passive = true;
      vg.tense = 'present';
      return clause('declarative', vg, { labelPredicate: true });
    }
    c.i = save;
  }
  // wh-question
  if (has(t, 'wh') && (ctx.question || initial || ctx.embedded)) {
    return parseWhQuestion(c, ctx);
  }
  // yes/no question: aux first
  if (ctx.question && AUX.some((p) => has(t, p)) && !has(t, 'noun')) {
    return parseInverted(c, ctx, null);
  }
  // existential: there is / there are
  if (
    (has(t, 'there') && has(c.at(1), 'be')) ||
    (has(t, 'there') && has(c.at(1), 'modal') && has(c.at(2), 'be'))
  ) {
    c.next();
    const vg = parseVerbGroup(c);
    const theme = parseNP(c);
    const tail = parseTail(c, 'event', ctx);
    return clause('declarative', vg, {
      frame: 'existence',
      subject: theme,
      ...tail,
    });
  }
  // "Elsewhere use PayPal": a fronted adverb before a request ("please"
  // is the request's own politeness)
  if (
    has(t, 'adv') &&
    t.lower !== 'please' &&
    !['verb', 'noun', 'wh', 'neg', 'det', 'pron'].some((p) => has(t, p))
  ) {
    const save = c.i;
    c.next();
    if (c.peek?.text === ',') {
      c.next();
    }
    if (c.peek && isImperativeStart(c)) {
      const request = parseImperative(c, ctx);
      if (request) {
        const adv = head(t, reading(t, 'adv'));
        request.mods = [
          { type: 'adv', ...adv, fronted: true },
          ...request.mods,
        ];
        return request;
      }
    }
    c.i = save;
  }
  // "Pays only on spending", "Fully passive after install": a note-style
  // statement whose subject is the thing described
  const note = initial && noteStatement(c, ctx, tailOptions);
  if (note) {
    return note;
  }
  // imperative
  const imperativeStart = isImperativeStart(c);
  const ambiguous =
    (has(t, 'noun') || has(t, 'adj')) &&
    has(t, 'verb') &&
    reading(t, 'verb').features?.form === 'base' &&
    !has(t, 'pron') &&
    !has(t, 'det');
  if (imperativeStart && !ambiguous) {
    return parseImperative(c, ctx);
  }
  if (ambiguous) {
    // "Track orders and payouts" vs "Direct sponsorships need…": the
    // reading that covers more of the sentence wins
    const start = c.i;
    const imperative = parseImperative(c, ctx);
    const end = c.i;
    c.i = start;
    const declarative = parseDeclarative(c, ctx);
    const reached = c.i;
    // an English singular count noun needs a determiner: "Ship the
    // orders fast" has no subject "ship"
    // …unless the request stops short where the statement goes on to a
    // finite verb: "Pay per review depends on star rating"
    const stopsShort =
      reached > end &&
      !c.tokens.slice(end).every((x) => x.kind === 'punct') &&
      declarative?.verb?.token >= end;
    const sentence =
      declarative &&
      declarative.type !== 'fragment' &&
      (!bareSingular(declarative.subject) || stopsShort);
    if (sentence && reached > end) {
      return declarative;
    }
    // on a tie the subject must start with an adjective ("Direct
    // sponsorships need…"); "Ship orders fast" is a request, and an English
    // singular count noun needs a determiner
    if (
      sentence &&
      reached === end &&
      !imperativeStart &&
      has(t, 'adj') &&
      declarative.subject?.adjs?.length &&
      !bareSingular(declarative.subject)
    ) {
      return declarative;
    }
    if (imperative && (imperativeStart || reached <= end || !sentence)) {
      c.i = end;
      return imperative;
    }
    c.i = reached;
    return declarative;
  }
  return parseDeclarative(c, ctx);
}

function bareSingular(np) {
  return Boolean(
    np &&
    np.number === 'sg' &&
    !np.det &&
    !np.def &&
    !np.possessor &&
    !np.pronoun &&
    !np.name &&
    np.quantity === undefined &&
    !np.coord
  );
}

/** Subject, verb group and tail: "Fees are low." */
function parseDeclarative(c, ctx) {
  const start = c.i;
  const leading = parseLeading(c);
  const subject = parseNP(c, { clauseStart: true, stopAt: ctx.stopAt });
  if (!subject) {
    c.i = start;
    return null;
  }
  const third = subject.pronoun
    ? subject.pronoun.person === 3 && subject.number === 'sg'
    : subject.number !== 'pl' && !subject.coord;
  const afterSubject = c.i;
  let vg = parseVerbGroup(c, third ? 'third' : null);
  // "Marketplaces like Etsy charge fees": a verb that is also a
  // preposition opens a phrase of the subject when a verb follows it
  if (vg && has(c.tokens[afterSubject], 'prep') && !subject.pronoun) {
    const verbEnd = c.i;
    c.i = afterSubject;
    const phrases = subjectPhrases(c, third ? 'third' : null);
    if (phrases) {
      subject.pps = phrases.pps;
      vg = phrases.vg;
    } else {
      c.i = verbEnd;
    }
  }
  if (!vg && has(c.peek, 'prep')) {
    const phrases = subjectPhrases(c, third ? 'third' : null);
    if (phrases) {
      subject.pps = phrases.pps;
      vg = phrases.vg;
    }
  }
  if (!vg) {
    // "the aggregator forwards royalties": the compound took the verb
    // "Tom's car needs fuel": any noun of the compound may be the verb
    // "Mary said that she…": a participle of the subject may be the verb
    // "The price of the book covers…": a noun inside the subject's phrase
    if (!ctx.retried && c.i - start > 1) {
      const end = c.i;
      for (let k = end - 1; k > start; k -= 1) {
        if (
          !c.tokens[k].readings.some(
            (r) => r.pos === 'verb' && /3sg|past/.test(r.features.form || '')
          ) &&
          !(k === end - 1 && has(c.tokens[k], 'verb'))
        ) {
          continue;
        }
        c.i = start;
        const retry = parseDeclarative(c, {
          ...ctx,
          retried: true,
          stopAt: k,
        });
        if (
          retry?.type === 'clause' &&
          (c.i > end ||
            (c.i === end && k < end - 1) ||
            (c.i < end && has(c.peek, 'subord') && !has(c.peek, 'wh')))
        ) {
          return retry;
        }
      }
      c.i = end;
    }
    const afterNP = c.i;
    const tail = parseTail(c, 'fragment', ctx);
    if (tail.objects.length || tail.complement || tail.xcomp) {
      c.i = afterNP;
      tail.mods = [];
    }
    return {
      type: 'fragment',
      np: subject,
      mods: tail.mods,
      mood: 'declarative',
    };
  }
  const tail = parseTail(c, vg.frame, tailOptions(ctx, vg));
  const result = clause('declarative', vg, {
    subject,
    ...tail,
    mods: [...leading, ...tail.mods],
  });
  const better =
    !ctx.retried &&
    vg.verb &&
    earlierVerb(c, start, vg.verb.token, (stopAt) => {
      c.i = start;
      return parseDeclarative(c, { ...ctx, retried: true, stopAt });
    });
  return better || reducedPassive(c, result, ctx.lexicon);
}

/** A noun phrase with its prepositional phrases: "direct deposit to bank". */
function parseFragment(c, ctx) {
  const start = c.i;
  const leading = parseLeading(c);
  // in a phrase without a verb, "contracts" is a noun
  const np = parseNP(c, { fragment: true });
  if (!np) {
    // "on demand after clearance": phrases without a head noun
    const only = has(c.peek, 'prep') && parseTail(c, 'fragment', ctx);
    if (only?.mods?.length && !only.objects?.length && !only.complement) {
      return { type: 'fragment', mods: [...leading, ...only.mods] };
    }
    c.i = start;
    return null;
  }
  const afterNP = c.i;
  const tail = parseTail(c, 'fragment', { ...ctx, takes: [] });
  if (tail.objects.length || tail.complement || tail.xcomp) {
    // a fragment has no objects: leave those words for the next phrase
    c.i = afterNP;
    tail.mods = [];
  }
  return {
    type: 'fragment',
    np,
    mods: [...leading, ...tail.mods],
    mood: 'declarative',
  };
}

/**
 * "I came home and went to bed": a finite verb right after a coordinator
 * shares the previous clause's subject.
 */
function ellipsis(c, ctx, previous) {
  const t = c.peek;
  const r = reading(t, 'verb');
  const subject = previous.subject;
  const third = subject.pronoun
    ? subject.pronoun.person === 3 && subject.number === 'sg'
    : subject.number !== 'pl' && !subject.coord;
  // "we live in London and work in Paris": a base verb shares a plural
  // or first/second-person subject of a present clause
  const finite =
    r &&
    (['past', 'past|pp', '3sg'].includes(r.features.form) ||
      (r.features.form === 'base' &&
        previous.mood === 'declarative' &&
        // "they will come and help": the base shares the future too
        (previous.modal ||
          previous.tense === 'future' ||
          (!third && previous.tense === 'present'))));
  const auxiliary = AUX.some((p) => has(t, p)) && !has(c.at(1), 'pron');
  if (!finite && !auxiliary) {
    return null;
  }
  const save = c.i;
  // "she can read and write": after a modal the base verb agrees with nothing
  const agree =
    third && !previous.modal && previous.tense !== 'future' ? 'third' : null;
  let vg = parseVerbGroup(c, agree);
  if (!vg && has(c.peek, 'prep')) {
    const phrases = subjectPhrases(c, agree);
    if (phrases) {
      subject.pps = phrases.pps;
      vg = phrases.vg;
    }
  }
  if (!vg) {
    c.i = save;
    return null;
  }
  if (r?.features.form === 'base' && !auxiliary) {
    vg.tense = previous.tense;
    vg.modal = previous.modal;
    vg.sharedModal = Boolean(previous.modal);
  }
  const tail = parseTail(c, vg.frame, tailOptions(ctx, vg));
  return {
    ...clause('declarative', vg, {
      subject: { ...subject, implicit: true },
      ...tail,
    }),
    elided: true,
  };
}

function tailOptions(ctx, vg) {
  const r = vg.verb && { concepts: vg.verb.candidates };
  return {
    takes: r ? ctx.takesOf(r) : [],
    infinitive: r ? ctx.infinitiveOf(r) : false,
    takesOf: ctx.takesOf,
    infinitiveOf: ctx.infinitiveOf,
    lexicon: ctx.lexicon,
    finiteComplementAhead: (c) => finiteComplementAhead(c, vg.verb, ctx),
  };
}

function parseImperative(c, ctx) {
  let polite = false;
  let polarity = 'positive';
  let inclusive = false;
  if (c.peek.lower === 'please') {
    polite = true;
    c.next();
  }
  if (has(c.peek, 'do') && has(c.at(1), 'neg')) {
    polarity = 'negative';
    c.next();
    c.next();
  }
  const adverbs = [];
  if (reading(c.peek, 'neg')?.lemma === 'never') {
    polarity = 'negative';
    adverbs.push({
      ...head(c.peek, reading(c.peek, 'neg')),
      pos: 'adv',
      candidates: ['never'],
      concept: 'never',
      fronted: true,
    });
    c.next();
  }
  if (c.peek?.lower === 'let' && c.at(1)?.lower === 'us') {
    inclusive = true;
    c.next();
    c.next();
  }
  const t = c.next();
  const r = reading(t, 'verb');
  if (!r) {
    return null;
  }
  const vg = {
    tense: 'present',
    aspect: 'simple',
    polarity,
    modal: null,
    verb: head(t, r),
    frame: 'event',
    adverbs,
  };
  // "Open an account and deposit money": a base verb after "and" is a
  // second request
  const finite = c.finite;
  c.finite = 'base';
  const tail = parseTail(c, 'event', tailOptions(ctx, vg));
  c.finite = finite;
  if (c.peek?.lower === 'please') {
    polite = true;
    c.next();
  }
  const subject = {
    type: 'np',
    pronoun: {
      lemma: inclusive ? 'we' : 'you',
      person: inclusive ? 1 : 2,
      number: inclusive ? 'pl' : 'sg|pl',
    },
    implicit: true,
  };
  return clause('imperative', vg, { subject, polite, inclusive, ...tail });
}

/** Undo subject–aux inversion: "Do you like tea" → "you do like tea". */
function parseInverted(c, ctx, wh) {
  const auxStart = c.i;
  const aux = [c.next()];
  while (has(c.peek, 'neg')) {
    aux.push(c.next());
  }
  // "Is there a bank here?": an existential question
  if (has(aux[0], 'be') && has(c.peek, 'there') && !wh) {
    c.next();
    const reordered = new Cursor([...aux, ...c.tokens.slice(c.i)]);
    reordered.grammar = ctx;
    const vg = parseVerbGroup(reordered);
    const theme = vg && parseNP(reordered);
    if (theme) {
      const tail = parseTail(reordered, 'event', ctx);
      c.i += reordered.i - aux.length;
      return clause('question', vg, {
        frame: 'existence',
        subject: theme,
        ...tail,
      });
    }
    c.i = auxStart;
    return null;
  }
  const subject = parseNP(c);
  if (!subject) {
    c.i = auxStart;
    if (wh) {
      // "Who lives here?" – the wh-word is the subject
      return null;
    }
    return null;
  }
  const rest = c.tokens.slice(c.i);
  const reordered = new Cursor([...aux, ...rest]);
  reordered.grammar = ctx;
  const vg = parseVerbGroup(reordered, 'question');
  if (!vg) {
    return null;
  }
  const tail = parseTail(reordered, vg.frame, tailOptions(ctx, vg));
  c.i += reordered.i - aux.length;
  return clause('question', vg, { subject, ...tail, wh });
}

function parseWhQuestion(c, ctx) {
  const t = c.next();
  const r = reading(t, 'wh');
  const wh = {
    concept: r.concepts[0],
    role: r.features.role,
    token: t.index,
    text: t.text,
  };
  // "How it works": a heading without inversion is an embedded question
  const heading =
    !ctx.question &&
    r.features.role !== 'determiner' &&
    startsNP(c.peek) &&
    !AUX.some((p) => has(c.peek, p));
  if (ctx.embedded || heading) {
    const embedded = parseDeclarative(c, { ...ctx, question: false });
    if (!embedded || embedded.type !== 'clause') {
      return null;
    }
    fillWh(embedded, wh);
    embedded.wh = wh;
    return embedded;
  }
  // "which book", "whose car"
  if (r.features.role === 'determiner' && startsNP(c.peek)) {
    wh.np = parseNP(c);
  }
  // "how many / how much" not modelled: report through leftover
  if (AUX.some((p) => has(c.peek, p))) {
    const save = c.i;
    const inverted = parseInverted(c, ctx, wh);
    if (inverted) {
      fillWh(inverted, wh);
      return inverted;
    }
    c.i = save;
  }
  // wh-word is the subject: "Who lives here?", "What happened?"
  const vg = parseVerbGroup(c, 'third');
  if (!vg) {
    return null;
  }
  const tail = parseTail(c, vg.frame, tailOptions(ctx, vg));
  const subject = wh.np || { type: 'np', wh: wh.concept, number: 'sg' };
  if (wh.np) {
    wh.np.wh = wh.concept;
  }
  return clause('question', vg, {
    subject,
    ...tail,
    wh: { ...wh, slot: 'subject' },
  });
}

/** Decide which slot the wh-word fills after inversion. */
function fillWh(cl, wh) {
  if (cl.stranded) {
    wh.stranded = cl.stranded;
  }
  const marker = cl.stranded ? { marker: cl.stranded } : {};
  if (wh.np) {
    wh.np.wh = wh.concept;
    if (cl.frame === 'copula' && !cl.complement) {
      cl.complement = { type: 'np', np: wh.np };
    } else {
      cl.objects.unshift(wh.np);
    }
    wh.slot = 'object';
    return;
  }
  if (['place', 'time', 'reason', 'manner'].includes(wh.role) && !cl.stranded) {
    wh.slot = 'adverbial';
    return;
  }
  if (cl.frame === 'copula' && !cl.complement) {
    cl.complement = {
      type: 'np',
      np: { type: 'np', wh: wh.concept, number: 'sg' },
    };
    wh.slot = 'complement';
    return;
  }
  const verbTakes = cl.objects.length === 0;
  if (verbTakes) {
    cl.objects.push({ type: 'np', wh: wh.concept, number: 'sg', ...marker });
    wh.slot = 'object';
  } else if (cl.xcomp && cl.xcomp.objects.length === 0) {
    cl.xcomp.objects.push({ type: 'np', wh: wh.concept, number: 'sg' });
    wh.slot = 'xcomp-object';
  } else {
    wh.slot = 'object';
  }
}

export { isPunct };
