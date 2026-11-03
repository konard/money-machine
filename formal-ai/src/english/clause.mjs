/**
 * Sentence → clauses in the meta language.
 *
 * Handles declaratives, yes/no and wh-questions (by undoing subject–aux
 * inversion), imperatives, existentials ("there is"), possession ("have"),
 * copular clauses, infinitival complements ("want to read") and clause
 * linking by coordinators and subordinators.
 */

import { analyze } from './analyze.mjs';
import {
  Cursor,
  has,
  reading,
  isPunct,
  startsNP,
  timeAhead,
  head,
  parseNP,
  parseVerbGroup,
  parseTail,
  mergeMultiwords,
} from './parser.mjs';

const AUX = ['be', 'do', 'have', 'modal'];

/** Union of `en takes` prepositions across a verb reading's concepts. */
function takesOf(lexicon) {
  return (r) => [
    ...new Set(r.concepts.flatMap((id) => lexicon.get(id)?.takes || [])),
  ];
}

/** Verbs that take a bare "to"-infinitive complement. */
function infinitiveOf(lexicon) {
  return (r) =>
    r.concepts.some((id) => {
      const cls = lexicon.get(id)?.classes || [];
      return (
        cls.includes('desire') ||
        cls.includes('aspectual') ||
        id === 'learn' ||
        id === 'forget' ||
        id === 'remember'
      );
    });
}

/** Match a whole fixed phrase ("thank you very much"). */
function matchPhrase(tokens, lexicon) {
  const wordsOnly = tokens
    .filter((t) => !isPunct(t))
    .map((t) => t.lower.replace(/^'/, ''));
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
  const analyzed = mergeMultiwords(analyze(sentence, lexicon), lexicon);
  analyzed.forEach((t, i) => {
    t.position = i;
  });
  const last = analyzed[analyzed.length - 1];
  const punctuation = isPunct(last) && /[.!?]/.test(last.text) ? last.text : '';
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
  const c = new Cursor(tokens);
  let link = null;
  while (!c.done) {
    const t = c.peek;
    if (isPunct(t)) {
      c.next();
      continue;
    }
    // "That is a good idea": demonstrative subject, not the conjunction
    const demonstrativeThat =
      t.lower === 'that' &&
      result.clauses.length === 0 &&
      ['be', 'modal', 'aux'].some((p) => has(c.at(1), p));
    // "After dinner we…" is a fronted phrase, "After we ate…" a clause link
    const frontedPhrase =
      has(t, 'prep') && has(t, 'subord') && leadingPhraseAhead(c);
    if (
      !demonstrativeThat &&
      !frontedPhrase &&
      ((has(t, 'subord') && !has(t, 'wh')) ||
        (has(t, 'subord') &&
          has(t, 'wh') &&
          result.clauses.length > 0 &&
          !ctx.question))
    ) {
      link = {
        ...(link || {}),
        concept: reading(t, 'subord').concepts[0],
        text: t.text,
      };
      c.next();
      continue;
    }
    if (has(t, 'coord') && result.clauses.length > 0) {
      link = { concept: reading(t, 'coord').concepts[0], text: t.text };
      c.next();
      continue;
    }
    const before = c.i;
    const previous = result.clauses[result.clauses.length - 1];
    const clause =
      (link &&
        previous?.subject &&
        !previous.subject.implicit &&
        ellipsis(c, ctx, previous)) ||
      parseClause(c, ctx, result.clauses.length === 0);
    if (!clause || c.i === before) {
      result.leftover.push(c.next().text);
      continue;
    }
    if (link) {
      clause.link = link;
      link = null;
    }
    result.clauses.push(clause);
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
  // wh-question
  if (has(t, 'wh') && (ctx.question || initial)) {
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
  // imperative
  if (isImperativeStart(c)) {
    return parseImperative(c, ctx);
  }
  const start = c.i;
  const leading = parseLeading(c);
  const subject = parseNP(c, { clauseStart: true });
  if (!subject) {
    c.i = start;
    return null;
  }
  const third = subject.pronoun
    ? subject.pronoun.person === 3 && subject.number === 'sg'
    : subject.number !== 'pl' && !subject.coord;
  const vg = parseVerbGroup(c, third ? 'third' : null);
  if (!vg) {
    return { type: 'fragment', np: subject, mood: 'declarative' };
  }
  const tail = parseTail(c, vg.frame, tailOptions(ctx, vg));
  return clause('declarative', vg, {
    subject,
    ...tail,
    mods: [...leading, ...tail.mods],
  });
}

/** Would `parseLeading` take a prepositional phrase here? */
function leadingPhraseAhead(c) {
  const save = c.i;
  const mods = parseLeading(c);
  c.i = save;
  return mods.length > 0;
}

/**
 * "I came home and went to bed": a finite verb right after a coordinator
 * shares the previous clause's subject.
 */
function ellipsis(c, ctx, previous) {
  const t = c.peek;
  const r = reading(t, 'verb');
  const finite = r && ['past', 'past|pp', '3sg'].includes(r.features.form);
  const auxiliary = AUX.some((p) => has(t, p)) && !has(c.at(1), 'pron');
  if (!finite && !auxiliary) {
    return null;
  }
  const save = c.i;
  const subject = previous.subject;
  const third = subject.pronoun
    ? subject.pronoun.person === 3 && subject.number === 'sg'
    : subject.number !== 'pl' && !subject.coord;
  const vg = parseVerbGroup(c, third ? 'third' : null);
  if (!vg) {
    c.i = save;
    return null;
  }
  const tail = parseTail(c, vg.frame, tailOptions(ctx, vg));
  return clause('declarative', vg, {
    subject: { ...subject, implicit: true },
    ...tail,
  });
}

/** A subject comes next (after an optional comma). */
function subjectAhead(c) {
  const t = c.peek?.text === ',' ? c.at(1) : c.peek;
  if (!t) {
    return false;
  }
  return (
    ['pron', 'det', 'poss', 'name', 'propn', 'num'].some((p) => has(t, p)) ||
    (has(t, 'noun') && !has(t, 'verb'))
  );
}

/**
 * Fronted adverbials before the subject: "On Tuesday we…", "Next Friday
 * I…", "Yesterday, they…". Each is marked `fronted` so the Russian keeps it
 * first.
 */
function parseLeading(c) {
  const mods = [];
  const done = (mod) => {
    mods.push({ ...mod, fronted: true });
    if (c.peek?.text === ',') {
      c.next();
    }
  };
  for (let guard = 0; guard < 4 && c.peek; guard += 1) {
    const t = c.peek;
    const save = c.i;
    if (has(t, 'prep')) {
      c.next();
      const np = parseNP(c);
      if (np && subjectAhead(c)) {
        done({
          type: 'pp',
          relation: reading(t, 'prep').concepts[0],
          prep: t.lower,
          np,
          token: t.index,
        });
        continue;
      }
      c.i = save;
      break;
    }
    if (
      ['every', 'each', 'last', 'next', 'this'].includes(t.lower) &&
      timeAhead(c)
    ) {
      const np = parseNP(c);
      if (np && subjectAhead(c)) {
        done({ type: 'time', np });
        continue;
      }
      c.i = save;
      break;
    }
    if (
      has(t, 'adv') &&
      !has(t, 'wh') &&
      !has(t, 'verb') &&
      (!has(t, 'noun') || has(c.at(1), 'pron') || c.at(1)?.text === ',')
    ) {
      c.next();
      if (subjectAhead(c)) {
        done({ type: 'adv', ...head(t, reading(t, 'adv')) });
        continue;
      }
      c.i = save;
    }
    break;
  }
  return mods;
}

function tailOptions(ctx, vg) {
  const r = vg.verb && { concepts: vg.verb.candidates };
  return {
    takes: r ? ctx.takesOf(r) : [],
    infinitive: r ? ctx.infinitiveOf(r) : false,
    takesOf: ctx.takesOf,
    infinitiveOf: ctx.infinitiveOf,
  };
}

function isImperativeStart(c) {
  const t = c.peek;
  if (t.lower === 'please') {
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
  // "Book a table" vs "Books are…": a noun reading wins only before a verb
  if (
    has(t, 'noun') &&
    (has(c.at(1), 'be') || has(c.at(1), 'verb') || has(c.at(1), 'modal'))
  ) {
    return false;
  }
  return true;
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
    adverbs: [],
  };
  const tail = parseTail(c, 'event', tailOptions(ctx, vg));
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

function clause(mood, vg, parts) {
  return {
    type: 'clause',
    mood,
    frame: parts.frame || vg.frame,
    tense: vg.tense,
    aspect: vg.aspect,
    polarity: vg.polarity,
    modal: vg.modal,
    passive: Boolean(vg.passive),
    verb: vg.verb,
    subject: parts.subject || null,
    objects: parts.objects || [],
    complement: parts.complement || null,
    mods: [
      ...(vg.adverbs || []).map((a) => ({ type: 'adv', ...a })),
      ...(parts.mods || []),
    ],
    xcomp: parts.xcomp || null,
    wh: parts.wh || null,
    stranded: parts.stranded || null,
    polite: parts.polite || false,
    inclusive: parts.inclusive || false,
  };
}

export { isPunct };
