import { parseFragment } from './fragment.mjs';
import { calendarPredicate } from './calendar.mjs';
import { bareInfinitiveOf, infinitiveOf } from './infinitive.mjs';
import { ellipsis, tailOptions } from './ellipsis.mjs';
import { preferNominal } from './nominal-evidence.mjs';
import {
  labelledFacts,
  parseFactList,
  unknownFactWords,
} from './fact-list.mjs';
/**
 * Sentence → clauses in the meta language.
 *
 * Declaratives, questions, imperatives, existentials, possession, copulas,
 * infinitival complements and clause linking.
 */

import { clause } from './clause-node.mjs';
import {
  attachPhrases,
  earlierVerb,
  subjectPhrases,
} from './subject-phrases.mjs';
import { headlineCopula, adjectiveListAhead } from './headline-copula.mjs';
import { reducedPassive } from './reduced-passive.mjs';
import { relativePredicates } from './relative-predicates.mjs';
import {
  frontedRequest,
  leadingPhraseAhead,
  parseLeading,
} from './leading.mjs';
import { takesOf, matchPhrase, leadingPhrase } from './fixed-phrases.mjs';
import { participleValue, mergeLabelValues } from './label-value.mjs';
import { outerVerbAt } from './relative-end.mjs';
import { superlatives } from './quantity.mjs';
import { analyze } from './analyze.mjs';
import { parseInverted } from './inverted.mjs';
import {
  isImperativeStart,
  noteStatement,
  nounPairAhead,
} from './imperative-start.mjs';
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
  // a clause inside a phrase: "per month (method not published)"
  const inner = fragments.leftover.length
    ? parseClauses(tokens, { ...outer, fragments: false })
    : fragments;
  currentCtx = outer;
  return inner.leftover.length < fragments.leftover.length ? inner : fragments;
});

/**
 * "the tools developers use": a relative whose own subject leaves the
 * object slot as its gap.
 * @returns {{end: number, clause?: object}} where its subject ended
 */
function objectGap(c, np, explicit, stopAt) {
  const start = c.i;
  const parsed = parseNP(c, { clauseStart: true, stopAt });
  const end = c.i;
  // "the tools developers use": without "that", a relative's subject is
  // determined, plural or a name; a bare singular noun ("agents help you
  // …") is the outer verb read as a noun
  const word = c.tokens.find((t) => t.index === parsed?.head?.token);
  const bare =
    !explicit &&
    parsed?.head?.pos === 'noun' &&
    (parsed.number === 'sg' ||
      // "FAQ (…) says pay depends", "Outschool says payouts continue": a
      // plural opening with a 3sg verb
      (c.i === start + 1 ? word : c.tokens[start])?.readings.some(
        (r) => r.pos === 'verb' && r.features?.form === '3sg'
      )) &&
    !parsed.det &&
    !parsed.poss &&
    !parsed.quantity &&
    !parsed.def;
  const subject = !bare && parsed;
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
          return { end };
        }
        tail = shorter;
      }
    }
    // An occupied object slot or complement ("pay is low") is no gap…
    // …but after "that" the gap may be the subject: "that captures traffic"
    const occupied =
      (tail.objects.length || (vg.frame === 'copula' && tail.complement)) &&
      !tail.stranded;
    if (occupied && !explicit) {
      return { end };
    }
    if (!occupied) {
      tail.objects.push({
        type: 'np',
        relativeSubject: true,
        number: np.number,
        ...(tail.stranded ? { marker: tail.stranded } : {}),
      });
      return { end, clause: clause('declarative', vg, { subject, ...tail }) };
    }
  }
  return { end };
}

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
  const found = objectGap(c, np, explicit);
  // "the tools that developers use": a subject that took the verb as its
  // last noun ends before it
  const last = found.end - 1;
  if (!found.clause && last > start && has(c.tokens[last], 'verb')) {
    c.i = start;
    const shorter = objectGap(c, np, explicit, last);
    if (shorter.clause) {
      return shorter.clause;
    }
  }
  if (found.clause) {
    return found.clause;
  }
  c.i = start;
  if (!explicit) {
    return null;
  }
  const subjectVerb = parseVerbGroup(
    c,
    np.number === 'pl' || (np.coord && !np.correlative) ? null : 'third'
  );
  if (!subjectVerb) {
    return null;
  }
  const gap = { type: 'np', relativeSubject: true, number: np.number };
  // a later predicate ends before the outer verb ("or runs games can…")
  const predicate = (vg, later) =>
    vg &&
    clause('declarative', vg, {
      subject: gap,
      ...parseTail(c, vg.frame, {
        ...tailOptions(currentCtx, vg),
        ...(later ? { finiteComplementAhead: () => false } : {}),
      }),
    });
  const verb = c.tokens.find((x) => x.index === subjectVerb.verb?.token);
  return relativePredicates(
    c,
    predicate(subjectVerb),
    reading(verb, 'verb')?.features.form,
    () =>
      predicate(parseVerbGroup(c, np.number === 'pl' ? null : 'third'), true)
  );
});

/**
 * Parse an English sentence into clauses.
 * @param {string} sentence
 * @param {import('../lexicon.mjs').Lexicon} lexicon
 * @returns {{tokens: object[], clauses: object[], punctuation: string, unknown: string[], leftover: string[]}}
 */
export function parseSentence(sentence, lexicon, options = {}) {
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
    bareInfinitiveOf: bareInfinitiveOf(lexicon),
    question: punctuation === '?',
  };
  const clauses = parseClauses(tokens, ctx);
  if (
    clauses.leftover.length > 0 ||
    !clauses.list.length ||
    !/[.!?]/.test(punctuation) ||
    options.fragmentStyle ||
    tokens.some((t) => t.text === ',')
  ) {
    const fragments = parseClauses(tokens, { ...ctx, fragments: true });
    if (
      fragments.leftover.length < clauses.leftover.length ||
      ((!/[.!?]/.test(punctuation) || options.fragmentStyle) &&
        preferNominal(tokens, clauses, fragments, lexicon)) ||
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
  Object.assign(
    clauses,
    parseFactList(tokens, ctx) ||
      (clauses.leftover.length && labelledFacts(tokens, ctx, parseClauses)) ||
      {}
  );
  mergeLabelValues(clauses.list);
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
  result.unknown = unknownFactWords(unknown, clauses.list);
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
      // "(e.g. eBay)": a parenthesis after a clause encloses the next item
      if (
        [';', ':', ',', '(', '='].includes(t.text) &&
        (result.list.length || t.text === '(')
      ) {
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
        // "When dogs bark, we run": a clause link, as mid-sentence
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
    if (
      isPunct(c.at(-1)) &&
      c.at(-1).text === '(' &&
      !ctx.fragments &&
      calendarPredicate(c) === null
    ) {
      const fragment = parseFragment(c, ctx);
      if (fragment && (c.done || c.peek.text === ')')) {
        result.list.push(link ? { ...fragment, link } : fragment);
        link = null;
        continue;
      }
      c.i = before;
    }
    const previous = result.list[result.list.length - 1];
    // "add tests, write it, and fix code": a series shares the subject
    const series =
      link?.separator === ',' &&
      !link.concept &&
      has(t, 'verb') &&
      c.tokens.slice(c.i + 1).some((x) => has(x, 'coord'));
    const clause =
      ((link?.concept || series) &&
        previous?.subject &&
        (!previous.subject.implicit || previous.elided) &&
        ellipsis(c, ctx, previous, link)) ||
      parseClause(
        c,
        { ...ctx, embedded: link?.embedded },
        // "Confidence: estimated; last checked …": a semicolon starts afresh,
        // and so does "where required" after its subordinator
        result.list.length === 0 ||
          link?.separator === ';' ||
          Boolean(link?.concept && has(c.at(-1), 'subord'))
      );
    if (!clause || c.i === before) {
      c.i = before;
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

/** Parse one clause at the cursor. */
function parseClause(c, ctx, initial) {
  const t = c.peek;
  const property = has(t, 'neg') ? c.at(1) : t;
  const afterProperty = c.at(has(t, 'neg') ? 2 : 1);
  if (
    has(property, 'adj') &&
    // "where possible" is a clause whose subject goes unsaid
    !has(c.at(-1), 'subord') &&
    !property.readings.some(
      (r) => r.pos === 'verb' && /pp/.test(r.features.form || '')
    ) &&
    (!afterProperty ||
      [':', ';'].includes(afterProperty.text) ||
      // "… is not published (unverified)."
      (afterProperty.text === ')' && c.at(-1)?.text === '(') ||
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
  const datedPredicate = has(t, 'noun') ? calendarPredicate(c) : null;
  if (datedPredicate !== null) {
    const dated = parseDeclarative(c, { ...ctx, stopAt: datedPredicate });
    if (dated?.verb) {
      return dated;
    }
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
  const value = participleValue(c);
  if (value) {
    return value;
  }
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
  // ("do" is a noun too: "a do", yet "Do you…?" still asks)
  if (
    ctx.question &&
    AUX.some((p) => has(t, p)) &&
    (!has(t, 'noun') || has(t, 'do'))
  ) {
    return parseInverted(c, ctx, null, tailOptions);
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
  // "Only apply for…", "First check the rules": a noun reading yields
  // before a word that is only a verb, or a verb before its object
  const verbOnly =
    c
      .at(1)
      ?.readings.every(
        (r) => r.pos === 'verb' && r.features?.form === 'base'
      ) ||
    (reading(c.at(1), 'verb')?.features.form === 'base' &&
      (['det', 'poss'].some((p) => has(c.at(2), p)) ||
        // "Then get consent": a singular noun "get" has no bare verb
        (startsNP(c.at(2)) && isImperativeStart(c.from(1)))));
  if (
    has(t, 'adv') &&
    t.lower !== 'please' &&
    !['verb', 'wh', 'neg', 'det', 'pron'].some((p) => has(t, p)) &&
    (!has(t, 'noun') || verbOnly)
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
  const fronted = has(t, 'prep') && frontedRequest(c, ctx, parseImperative);
  if (fronted) {
    return fronted;
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
  if (ambiguous && nounPairAhead(c)) {
    return parseDeclarative(c, ctx);
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
      (!bareSingular(declarative.subject) ||
        stopsShort ||
        (declarative.frame === 'copula' &&
          (declarative.verb?.token === null ||
            declarative.verb?.token === undefined) &&
          declarative.subject?.adjs?.length));
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
    : subject.number !== 'pl' && (!subject.coord || subject.correlative);
  const afterSubject = c.i;
  let vg = parseVerbGroup(c, third ? 'third' : 'other', subject);
  // "Marketplaces like Etsy charge fees": a preposition before a verb
  if (vg && has(c.tokens[afterSubject], 'prep') && !subject.pronoun) {
    const verbEnd = c.i;
    c.i = afterSubject;
    const phrases = subjectPhrases(c, third ? 'third' : 'other');
    if (phrases) {
      attachPhrases(subject, phrases.pps);
      vg = phrases.vg;
    } else {
      c.i = verbEnd;
    }
  }
  if (!vg && has(c.peek, 'prep')) {
    const phrases = subjectPhrases(c, third ? 'third' : 'other');
    if (phrases) {
      attachPhrases(subject, phrases.pps);
      vg = phrases.vg;
    }
  }
  if (!vg) {
    // "the aggregator forwards royalties: the compound took the verb
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
    // "Prices high": only when no word of the compound is the verb
    const headline = headlineCopula(c, ctx, subject);
    if (headline) {
      return headline;
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
      // "…, mostly Canva": a leading adverb stays with the phrase
      mods: [...leading, ...tail.mods],
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
  // "Open an account and deposit money": a second request
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
    const save = c.i;
    // "which countries it accepts": the asked-for phrase, then its clause
    if (r.features.role === 'determiner' && startsNP(c.peek)) {
      wh.np = parseNP(c, { relative: false });
    }
    const embedded = parseDeclarative(c, { ...ctx, question: false });
    if (embedded?.type === 'clause') {
      fillWh(embedded, wh);
      embedded.wh = wh;
      return embedded;
    }
    // "what changed": the wh-word is the embedded clause's subject
    c.i = save;
    delete wh.np;
    if (!ctx.embedded) {
      return null;
    }
  }
  // "which book", "whose car"
  if (r.features.role === 'determiner' && startsNP(c.peek)) {
    wh.np = parseNP(c, { relative: false });
  }
  // "how many / how much" not modelled: report through leftover
  if (AUX.some((p) => has(c.peek, p))) {
    const save = c.i;
    const inverted = parseInverted(c, ctx, wh, tailOptions);
    if (inverted) {
      fillWh(inverted, wh);
      return inverted;
    }
    c.i = save;
  }
  // wh-word is the subject: "Who lives here?", "What happened?"
  const vg = parseVerbGroup(c, wh.np?.number === 'pl' ? null : 'third');
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
