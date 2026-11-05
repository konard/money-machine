/**
 * Formalization: English sentence → meta-language statements.
 *
 * The meta language follows Formal AI's rule of one link per meaning:
 * every content word becomes a concept id (grounded in Wikidata when the
 * grounding is known), and every grammatical meaning becomes an explicit
 * attribute (tense, aspect, polarity, number, definiteness…). When English
 * leaves a meaning open (is "you" one person or several?) the statement
 * keeps the exact range (`number (singular plural)`) instead of guessing;
 * the naturalizer narrows it and reports the choice.
 */

import { parseSentence } from './english/clause.mjs';
import { resolveSenses, DocumentMemory, sentenceWords } from './senses.mjs';
import { quote } from './lino.mjs';
import { rangeLink } from './meaning-ranges.mjs';

const NUMBER = { sg: 'singular', pl: 'plural', 'sg|pl': 'singular plural' };
const DEF = { def: 'definite', indef: 'indefinite' };

/** Clean an entity (noun phrase). */
function entity(np, lexicon) {
  if (!np) {
    return null;
  }
  if (np.coord) {
    return {
      coordination: np.coord,
      // "neither A nor B": the pair is said with its own words
      ...(np.correlative ? { correlative: true } : {}),
      items: np.items.map((n) => entity(n, lexicon)),
      floatingQuantifier: np.floatingQuantifier,
      // English agreement follows the nearer item of a pair
      number: np.correlative ? NUMBER[np.number] || 'singular' : 'plural',
    };
  }
  if (np.relativeSubject) {
    return {
      relativePronoun: true,
      number: NUMBER[np.number] || 'singular',
      marker: np.marker,
    };
  }
  const e = {};
  if (np.action) {
    e.action = predicateClause(np.action, lexicon);
    if (np.nominalization) {
      e.nominalization = entity(np.nominalization, lexicon);
    }
  }
  if (np.participles) {
    e.participles = np.participles.map((x) => ({
      ...predicateClause(x, lexicon),
      voice: 'passive',
    }));
  }
  if (np.relative) {
    e.relative = statement(np.relative, lexicon);
  }
  if (np.pronoun) {
    const p = np.pronoun;
    e.pronoun = { person: p.person, number: NUMBER[p.number] };
    if (p.gender) {
      e.pronoun.gender = { m: 'masculine', f: 'feminine', n: 'neuter' }[
        p.gender
      ];
    }
    if (p.case === 'refl') {
      e.pronoun.reflexive = true;
    }
    if (p.case === 'poss') {
      e.pronoun.independent = true;
    }
    if (np.implicit) {
      e.implicit = true;
    }
    if (np.marker) {
      e.marker = np.marker;
    }
    e.number = NUMBER[p.number];
    return e;
  }
  if (np.wh) {
    e.question = np.wh;
  }
  if (np.demonstrative) {
    e.demonstrative = np.demonstrative;
    e.number = NUMBER[np.number] || 'singular';
    return e;
  }
  if (np.head) {
    Object.assign(e, rangeLink(np.head));
    e.concept = np.head.concept || np.head.candidates?.[0] || null;
    if (!e.concept) {
      // an unknown word stays as written
      e.untranslated = np.head.text;
    }
    if (np.head.ambiguous) {
      e.ambiguous = np.head.candidates;
    }
    if (np.indefinite) {
      e.indefinite = true;
    }
  }
  if (np.floatingQuantifier) {
    e.floatingQuantifier = np.floatingQuantifier;
  }
  if (np.name) {
    e.name = np.name;
  }
  if (np.numeral) {
    e.numeral = true;
  }
  e.number = NUMBER[np.number] || 'singular';
  if (np.def) {
    e.definiteness = DEF[np.def];
  }
  if (np.det) {
    e.determiner = np.det;
  }
  if (np.quantity !== undefined) {
    e.quantity = np.quantity;
    if (/^\d/.test(String(np.quantityText || ''))) {
      e.digits = true;
    }
    if (/\d/.test(np.quantityText || '') && !/^\d+$/.test(np.quantityText)) {
      e.quantityText = np.quantityText;
    }
  }
  if (np.digits) {
    e.digits = true;
  }
  if (np.possessor) {
    e.possessor = entity(np.possessor, lexicon);
  }
  const props = (np.adjs || []).filter((a) => a.concept || a.candidates);
  if (props.length) {
    e.properties = props.map((a) => property(a));
  }
  if (np.modifiers?.length) {
    const modifier = (m) => ({
      concept: m.concept || m.candidates?.[0] || null,
      ...rangeLink(m),
      name: m.concept ? undefined : m.text,
      ...(m.alternative ? { alternative: modifier(m.alternative) } : {}),
      ...(m.plural ? { number: 'plural' } : {}),
    });
    e.modifiers = np.modifiers.map(modifier);
  }
  if (np.alternative) {
    e.alternative = {
      concept: np.alternative.concept || np.alternative.candidates?.[0] || null,
      ...rangeLink(np.alternative),
      name: np.alternative.concept ? undefined : np.alternative.text,
    };
  }
  if (np.amount) {
    e.amount = np.amount;
  }
  if (np.purpose) {
    e.purpose = predicateClause(np.purpose, lexicon);
  }
  if (np.quantifier) {
    e.quantifier = np.quantifier;
  }
  if (np.bound) {
    e.bound = np.bound;
  }
  if (np.rangeFrom !== undefined) {
    e.rangeFrom = np.rangeFrom;
  }
  if (np.partitive) {
    e.partitive = true;
  }
  if (np.of) {
    e.of = entity(np.of, lexicon);
  }
  if (np.pps || np.measures) {
    e.relations = [...(np.measures || []), ...(np.pps || [])].map((m) =>
      modifier(m, lexicon)
    );
  }
  if (np.emphatic) {
    e.emphatic = true;
  }
  if (np.calendar) {
    e.calendar = np.calendar;
  }
  if (np.label) {
    e.label = np.label;
  }
  if (np.parenthetical) {
    e.parenthetical = np.parenthetical.map((x) => statement(x, lexicon));
    e.parentheticalFinal = np.parentheticalFinal;
  }
  if (np.marker) {
    e.marker = np.marker;
  }
  return e;
}

function property(a) {
  const p = {
    concept: a.concept || a.candidates?.[0] || null,
    ...rangeLink(a),
  };
  if (a.participle) {
    p.participle = a.participle;
  }
  if (a.alternative) {
    p.alternative = property(a.alternative);
  }
  if (a.join) {
    p.join = a.join;
  }
  if (a.degree) {
    p.degree = a.degree.concept || a.degree.candidates?.[0];
    Object.assign(p, rangeLink(a.degree, 'degreeCandidates'));
  }
  if (a.superlative) {
    p.superlative = true;
  }
  if (a.comparison) {
    p.comparison = a.comparison;
  }
  if (a.comparative) {
    p.comparative = true;
  }
  return p;
}

function modifier(m, lexicon) {
  const out = modifierCore(m, lexicon);
  if (m.fronted) {
    return { ...out, position: 'front' };
  }
  // "you then fill": an adverb before the English verb precedes the Russian one
  return m.preverbal && out.kind === 'adverb'
    ? { ...out, position: 'preverbal' }
    : out;
}

function modifierCore(m, lexicon) {
  if (m.type === 'adv') {
    return {
      kind: 'adverb',
      ...rangeLink(m),
      concept: m.concept || m.candidates?.[0],
      comparison: m.comparison,
    };
  }
  if (m.type === 'role') {
    return { kind: 'role', entity: entity(m.np, lexicon) };
  }
  if (m.type === 'quantity' || m.type === 'comparison') {
    return {
      kind: m.type,
      comparison: m.comparison,
      equal: m.equal || undefined,
      entity: m.np ? entity(m.np, lexicon) : undefined,
    };
  }
  if (m.type === 'time') {
    return { kind: 'time', entity: entity(m.np, lexicon) };
  }
  if (m.type === 'conj') {
    return { kind: 'conj', conj: m.conj };
  }
  const out = { kind: 'relation', relation: m.relation };
  if (m.measure) {
    out.measure = true;
  }
  if (m.postposition) {
    out.postposition = true;
  }
  if (m.offset) {
    out.offset = true;
  }
  if (m.np) {
    out.entity = entity(m.np, lexicon);
  }
  if (m.adv) {
    out.adverb = m.adv.concept || m.adv.candidates?.[0];
    Object.assign(out, rangeLink(m.adv, 'adverbCandidates'));
  }
  return out;
}

function complement(c, lexicon) {
  if (!c) {
    return null;
  }
  if (c.type === 'adj') {
    const p = {
      kind: 'property',
      concept: c.concept || c.candidates?.[0],
      ...rangeLink(c),
    };
    if (c.degree) {
      p.degree = c.degree.concept || c.degree.candidates?.[0];
      Object.assign(p, rangeLink(c.degree, 'degreeCandidates'));
    }
    if (c.comparison || c.superlative) {
      p.comparison = c.comparison || 'greatest';
    }
    if (c.comparative) {
      p.comparative = true;
    }
    if (c.also) {
      p.also = c.also.map((x) => ({
        link: x.link || undefined,
        ...complement({ type: 'adj', ...x.adjective, degree: x.degree }),
      }));
    }
    return p;
  }
  if (c.type === 'np') {
    return { kind: 'entity', entity: entity(c.np, lexicon) };
  }
  return modifier(c, lexicon);
}

/**
 * Objects, the last one with the state an object complement puts it in
 * ("keep repos active": repos, state active).
 */
function objects(x, lexicon) {
  const out = x.objects.map((o) => entity(o, lexicon));
  if (x.complement?.object && out.length) {
    out[out.length - 1] = {
      ...out[out.length - 1],
      state: complement(x.complement, lexicon),
    };
  }
  return out;
}

function predicateClause(x, lexicon) {
  return {
    predicate: x.verb.concept || x.verb.candidates?.[0],
    ...rangeLink(x.verb),
    subject: x.subject ? entity(x.subject, lexicon) : undefined,
    voice: x.passive ? 'passive' : undefined,
    objects: objects(x, lexicon),
    modifiers: x.mods.map((m) => modifier(m, lexicon)),
    complementClause: x.xcomp ? predicateClause(x.xcomp, lexicon) : undefined,
    purpose: x.purpose || undefined,
  };
}

/** Clean one parsed clause into a statement. */
export function statement(clause, lexicon) {
  if (clause.type === 'phrase') {
    return { type: 'phrase', concept: clause.concept };
  }
  if (clause.type === 'fragment') {
    return {
      type: 'fragment',
      entity: entity(clause.np, lexicon),
      factValue: clause.factValue
        ? entity(clause.factValue, lexicon)
        : undefined,
      answer: clause.answer,
      factFocus: clause.factFocus ? property(clause.factFocus) : undefined,
      valueSeparator: clause.valueSeparator,
      labelProperty: clause.labelProperty
        ? property(clause.labelProperty)
        : undefined,
      property: clause.property ? property(clause.property) : undefined,
      factProperty: clause.factProperty
        ? property(clause.factProperty)
        : undefined,
      negative: clause.negative || undefined,
      modifiers: (clause.mods || []).map((m) => modifier(m, lexicon)),
      link: clause.link?.concept,
      separator: clause.link?.separator,
    };
  }
  const s = {
    type: 'statement',
    separator: clause.link?.separator,
    mood: clause.mood,
    frame: clause.frame,
    tense: clause.tense.replace('|', ' '),
    aspect: clause.aspect,
    polarity: clause.polarity,
  };
  if (clause.generic) {
    s.generic = true;
  }
  if (clause.sharedPolarity) {
    // "don't market yourself or set prices": the negation is said once and
    // covers the coordination
    s.sharedPolarity = true;
  }
  if (clause.modal) {
    s.modality = clause.modal;
    if (clause.sharedModal) {
      // "can sign up and earn": the modal is said once
      s.sharedModality = true;
    }
  }
  if (clause.labelSubject) {
    s.labelSubject = entity(clause.labelSubject, lexicon);
  }
  if (clause.passive) {
    s.voice = 'passive';
  }
  if (clause.link) {
    s.link = clause.link.concept;
  }
  if (clause.polite) {
    s.politeness = 'polite';
  }
  if (clause.inclusive) {
    s.inclusive = true;
  }
  s.predicate = clause.verb.concept || clause.verb.candidates?.[0];
  Object.assign(s, rangeLink(clause.verb));
  s.subject = entity(clause.subject, lexicon);
  // "agents help you…, write fixes": a series says its subject once
  if (clause.elided && clause.subject?.implicit && !clause.subject.pronoun) {
    s.subject = { ...s.subject, implicit: true };
  }
  // "no homepage names it": both languages negate the verb (negative
  // concord in Russian: «никакая … не называет»), and the quantifier stays:
  // "no X" is not "the X"
  if (
    ['det.no', 'det.neither'].includes(s.subject?.determiner) ||
    s.subject?.coordination === 'conj.nor'
  ) {
    s.polarity = 'negative';
    s.generic = true;
  }
  if (clause.objects.length) {
    s.objects = objects(clause, lexicon);
    // "need no platform": Russian negates the verb («не нужна никакая»)
    if (
      s.objects.some(
        (o) => o?.determiner === 'det.no' || o?.coordination === 'conj.nor'
      ) &&
      s.polarity === 'positive'
    ) {
      s.polarity = 'negative';
    }
  }
  const comp =
    !clause.complement?.object && complement(clause.complement, lexicon);
  if (comp) {
    s.complement = comp;
  }
  if (clause.mods.length) {
    s.modifiers = clause.mods.map((m) => modifier(m, lexicon));
  }
  // "is a way to earn money", "have a chance to win": the infinitive says
  // what the noun is for, not a second predicate of be/have
  const own =
    clause.xcomp &&
    ['be', 'have'].includes(clause.verb?.lemma) &&
    (clause.complement?.np?.head
      ? s.complement?.entity
      : clause.objects?.length === 1 && clause.objects[0].head
        ? s.objects?.[0]
        : null);
  if (own && !own.purpose) {
    own.purpose = predicateClause(clause.xcomp, lexicon);
  } else if (clause.xcomp) {
    s.complementClause = predicateClause(clause.xcomp, lexicon);
  }
  if (clause.wh) {
    s.question = { concept: clause.wh.concept, slot: clause.wh.slot };
    if (clause.wh.stranded) {
      s.question.relation = clause.wh.stranded;
    }
  }
  return s;
}

const TIME_LINKS = new Set([
  'conj.before',
  'conj.after',
  'conj.when',
  'conj.if',
  'conj.until',
  'conj.once',
]);

/**
 * English uses the present in time and condition clauses for a future
 * event ("before you publish it" next to a request or a future). The meta
 * language states the meaning, so such a clause is in the future.
 */
function futureInTimeClauses(statements) {
  const prospective = statements.some(
    (s) =>
      s.type === 'statement' &&
      !TIME_LINKS.has(s.link) &&
      (s.mood === 'imperative' || s.tense === 'future' || s.modality)
  );
  if (!prospective) {
    return statements;
  }
  return statements.map((s) =>
    s.type === 'statement' &&
    TIME_LINKS.has(s.link) &&
    s.tense === 'present' &&
    s.aspect === 'simple' &&
    s.mood !== 'imperative'
      ? { ...s, tense: 'future' }
      : s
  );
}

/**
 * Formalize one English sentence.
 * @param {string} sentence
 * @param {import('./lexicon.mjs').Lexicon} lexicon
 * @param {DocumentMemory} [memory]
 * @returns {{sentence: string, statements: object[], punctuation: string,
 *   senses: object[], unknown: string[], leftover: string[]}}
 */
export function formalize(
  sentence,
  lexicon,
  memory = new DocumentMemory(),
  options = {}
) {
  const parsed = parseSentence(sentence, lexicon, options);
  const senses = resolveSenses(parsed, lexicon, memory);
  memory.remember(sentenceWords(parsed));
  const statements = futureInTimeClauses(
    parsed.clauses.map((c) => statement(c, lexicon))
  );
  return {
    sentence,
    statements,
    punctuation: parsed.punctuation,
    senses,
    unknown:
      parsed.clauses.some((c) => c.type === 'phrase') &&
      parsed.clauses.length === 1
        ? []
        : parsed.unknown,
    leftover: parsed.leftover,
  };
}

/**
 * Serialize statements as indented Links Notation. Concepts that are
 * grounded print their Wikidata id on a child line.
 * @param {object[]} statements
 * @param {import('./lexicon.mjs').Lexicon} [lexicon]
 * @returns {string}
 */
export function toLino(statements, lexicon) {
  const lines = [];
  const emit = (key, value, depth) => {
    const pad = '  '.repeat(depth);
    if (value === undefined || value === null || value === false) {
      return;
    }
    if (Array.isArray(value)) {
      if (value.every((v) => typeof v !== 'object')) {
        lines.push(`${pad}${key} (${value.join(' ')})`);
        return;
      }
      value.forEach((v) => emit(singular(key), v, depth));
      return;
    }
    if (typeof value === 'object') {
      lines.push(`${pad}${key}`);
      for (const [k, v] of Object.entries(value)) {
        if (k === 'type') {
          continue;
        }
        emit(k, v, depth + 1);
      }
      return;
    }
    if (value === true) {
      lines.push(`${pad}${key}`);
      return;
    }
    const text =
      /\s/.test(String(value)) && /^(number|tense)$/.test(key)
        ? `(${value})`
        : quote(value);
    lines.push(`${pad}${key} ${text}`);
    if (lexicon && ['concept', 'predicate', 'relation'].includes(key)) {
      const grounding = lexicon.get(String(value))?.grounding;
      if (grounding) {
        lines.push(`${pad}  grounded-in ${grounding}`);
      }
    }
  };
  for (const s of statements) {
    emit(s.type || 'statement', s, 0);
  }
  return lines.join('\n');
}

function singular(key) {
  if (key === 'properties') {
    return 'property';
  }
  if (key === 'modifiers') {
    return 'modifier';
  }
  if (key === 'items') {
    return 'item';
  }
  return key.replace(/s$/, '');
}
