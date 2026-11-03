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
      items: np.items.map((n) => entity(n, lexicon)),
      number: 'plural',
    };
  }
  const e = {};
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
    e.concept = np.head.concept || np.head.candidates?.[0] || null;
    if (np.head.ambiguous) {
      e.ambiguous = np.head.candidates;
    }
    if (np.indefinite) {
      e.indefinite = true;
    }
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
    e.modifiers = np.modifiers.map((m) => ({
      concept: m.concept || m.candidates?.[0] || null,
      name: m.concept ? undefined : m.text,
    }));
  }
  if (np.of) {
    e.of = entity(np.of, lexicon);
  }
  if (np.marker) {
    e.marker = np.marker;
  }
  return e;
}

function property(a) {
  const p = { concept: a.concept || a.candidates?.[0] || null };
  if (a.degree) {
    p.degree = a.degree.concept || a.degree.candidates?.[0];
  }
  if (a.comparative) {
    p.comparative = true;
  }
  return p;
}

function modifier(m, lexicon) {
  const out = modifierCore(m, lexicon);
  return m.fronted ? { ...out, position: 'front' } : out;
}

function modifierCore(m, lexicon) {
  if (m.type === 'adv') {
    return { kind: 'adverb', concept: m.concept || m.candidates?.[0] };
  }
  if (m.type === 'time') {
    return { kind: 'time', entity: entity(m.np, lexicon) };
  }
  const out = { kind: 'relation', relation: m.relation };
  if (m.np) {
    out.entity = entity(m.np, lexicon);
  }
  if (m.adv) {
    out.adverb = m.adv.concept || m.adv.candidates?.[0];
  }
  return out;
}

function complement(c, lexicon) {
  if (!c) {
    return null;
  }
  if (c.type === 'adj') {
    const p = { kind: 'property', concept: c.concept || c.candidates?.[0] };
    if (c.degree) {
      p.degree = c.degree.concept || c.degree.candidates?.[0];
    }
    if (c.comparative) {
      p.comparative = true;
    }
    return p;
  }
  if (c.type === 'np') {
    return { kind: 'entity', entity: entity(c.np, lexicon) };
  }
  return modifier(c, lexicon);
}

function predicateClause(x, lexicon) {
  return {
    predicate: x.verb.concept || x.verb.candidates?.[0],
    objects: x.objects.map((o) => entity(o, lexicon)),
    modifiers: x.mods.map((m) => modifier(m, lexicon)),
    complementClause: x.xcomp ? predicateClause(x.xcomp, lexicon) : undefined,
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
      link: clause.link?.concept,
    };
  }
  const s = {
    type: 'statement',
    mood: clause.mood,
    frame: clause.frame,
    tense: clause.tense.replace('|', ' '),
    aspect: clause.aspect,
    polarity: clause.polarity,
  };
  if (clause.modal) {
    s.modality = clause.modal;
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
  s.subject = entity(clause.subject, lexicon);
  if (clause.objects.length) {
    s.objects = clause.objects.map((o) => entity(o, lexicon));
  }
  const comp = complement(clause.complement, lexicon);
  if (comp) {
    s.complement = comp;
  }
  if (clause.mods.length) {
    s.modifiers = clause.mods.map((m) => modifier(m, lexicon));
  }
  if (clause.xcomp) {
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

/**
 * Formalize one English sentence.
 * @param {string} sentence
 * @param {import('./lexicon.mjs').Lexicon} lexicon
 * @param {DocumentMemory} [memory]
 * @returns {{sentence: string, statements: object[], punctuation: string,
 *   senses: object[], unknown: string[], leftover: string[]}}
 */
export function formalize(sentence, lexicon, memory = new DocumentMemory()) {
  const parsed = parseSentence(sentence, lexicon);
  const senses = resolveSenses(parsed, lexicon, memory);
  memory.remember(sentenceWords(parsed));
  const statements = parsed.clauses.map((c) => statement(c, lexicon));
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
