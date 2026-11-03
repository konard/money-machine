/**
 * Shallow English clause parser.
 *
 * Produces the meta-language structure directly: a clause with mood,
 * tense, aspect, polarity, modality, a frame (event, copula, possession,
 * existence) and noun phrases whose heads still carry every candidate
 * concept. Sense choice happens afterwards (`senses.mjs`), because it needs
 * the whole sentence and the document.
 *
 * Unparsed material is never dropped silently: it is returned in
 * `clause.leftover` and reported by the translator.
 */

import {
  has,
  reading,
  isPunct,
  head,
  startsNP,
  gerundReading,
  participleReading,
  personLike,
} from './token-readings.mjs';
import { Cursor } from './cursor.mjs';
import { parseQuantity, quantityDegree } from './quantity.mjs';
import { mergeMultiwords } from './multiword.mjs';
export { parseVerbGroup } from './verb-group.mjs';

/**
 * Parse a noun phrase starting at the cursor.
 * @returns {object|null}
 */
export function parseNP(c, options = {}) {
  options = { ...c.grammar, ...options };
  const start = c.i;
  if (!options.quantityInner) {
    const quantity = parseQuantity(c, options, parseNP);
    if (quantity) {
      return quantity;
    }
  }
  const np = { type: 'np', adjs: [], number: null, def: null };
  let t = c.peek;
  if (!t) {
    return null;
  }
  if (gerundReading(t) && !options.nominal) {
    const r = gerundReading(c.next());
    const tail = parseTail(c, 'event', {
      ...options,
      nonfinite: true,
      takes: options.takesOf?.(r) || [],
      infinitive: options.infinitiveOf?.(r),
    });
    return attachOf(
      c,
      {
        type: 'np',
        number: 'sg',
        action: { verb: head(t, r), ...tail },
        nominalization:
          has(t, 'noun') && !tail.objects.length && !tail.mods.length
            ? { type: 'np', head: head(t, reading(t, 'noun')), number: 'sg' }
            : null,
      },
      options
    );
  }
  if (has(t, 'pron') && !(t.lower === 'her' && nounAhead(c, 1))) {
    const r = reading(t, 'pron');
    c.next();
    np.pronoun = { lemma: r.lemma, ...r.features, token: t.index };
    np.number = r.features.number;
    return np;
  }
  if (has(t, 'indef')) {
    const r = reading(t, 'indef');
    c.next();
    np.head = head(t, r);
    np.number = 'sg';
    np.indefinite = true;
    np.number = r.features.number || 'sg';
    return attachOf(c, np, options);
  }
  if (
    has(t, 'det') &&
    !(
      t.lower === 'that' &&
      options.clauseStart &&
      !['be', 'modal', 'aux'].some((p) => has(c.at(1), p))
    )
  ) {
    const r = reading(t, 'det');
    np.def = r.features.def;
    np.det = r.features.det || null;
    np.detNumber = r.features.number || null;
    c.next();
  } else if (has(t, 'poss')) {
    const r = reading(t, 'poss');
    np.possessor = {
      type: 'np',
      pronoun: { lemma: r.lemma, ...r.features, token: t.index },
      number: r.features.number,
    };
    np.def = 'def';
    c.next();
  }
  if (
    c.peek?.kind === 'quantity' &&
    /\p{Sc}/u.test(c.peek.text) &&
    nounAhead(c, 1)
  ) {
    np.amount = c.next().text;
  } else if (has(c.peek, 'num') && !has(c.peek, 'det')) {
    const r = reading(c.peek, 'num');
    np.quantity = r.features.value;
    np.quantityText = c.peek.text;
    c.next();
  } else if (
    c.peek?.kind === 'quantity' &&
    !/[\p{Sc}%]/u.test(c.peek.text) &&
    nounAhead(c, 1)
  ) {
    // "~190 markets", "50K plays", "1-2 students": a count before a noun
    const n = Number(/\d+(?:\.\d+)?/.exec(c.peek.text.replace(/,/g, ''))[0]);
    const scale = /k/i.test(c.peek.text)
      ? 1000
      : /m/i.test(c.peek.text)
        ? 1e6
        : 1;
    np.quantity = /[–-]/.test(c.peek.text) ? 5 : n * scale;
    np.quantityText = c.next().text;
  }
  const adjectives = [];
  while (
    c.peek &&
    ((quantityDegree(c.peek) && has(c.at(1), 'adj')) ||
      has(c.peek, 'adj') ||
      (participleReading(c.peek) && nounAhead(c, 1)) ||
      (has(c.peek, 'adv') &&
        reading(c.peek, 'adv').concepts.some(isDegree) &&
        has(c.at(1), 'adj')))
  ) {
    const degree = quantityDegree(c.peek);
    if (degree && has(c.at(1), 'adj')) {
      c.next();
      adjectives.push({ comparison: degree });
      continue;
    }
    const t2 = c.peek;
    if (has(t2, 'adv') && !has(t2, 'adj')) {
      c.next();
      adjectives.push({ degree: head(t2, reading(t2, 'adv')) });
      continue;
    }
    // an adjective followed by nothing nominal ends the phrase: "is big"
    if (!nounAhead(c, 1) && !has(c.at(1), 'adj')) {
      if (has(t2, 'noun') || has(t2, 'name')) {
        break;
      }
      if (c.i === start) {
        return null;
      }
      break;
    }
    c.next();
    const r = participleReading(t2) || reading(t2, 'adj');
    const last = adjectives[adjectives.length - 1];
    const a = head(t2, r);
    if (r.pos === 'verb') {
      a.participle = 'past-passive';
    }
    if (last?.comparison) {
      a.comparison = last.comparison;
      adjectives.pop();
    }
    if (last?.degree && !last.lemma) {
      a.degree = last.degree;
      adjectives.pop();
    }
    if (r.features.degree === 'superlative') {
      a.superlative = true;
    } else if (r.features.degree) {
      a.comparative = true;
    }
    adjectives.push(a);
  }
  np.adjs = adjectives;
  t = c.peek;
  const nounish = t && (has(t, 'noun') || has(t, 'name') || has(t, 'propn'));
  if (!nounish) {
    // "this", "those" standing alone: "What is this?", "This is my house."
    if (
      ['det.this', 'det.that'].includes(np.det) &&
      !adjectives.length &&
      np.quantity === undefined
    ) {
      np.demonstrative = np.det === 'det.this' ? 'this' : 'that';
      np.number = np.detNumber || 'sg';
      return np;
    }
    if (np.quantity !== undefined && !np.det && !np.possessor) {
      np.numeral = true;
      return attachOf(c, np, options);
    }
    c.i = start;
    return null;
  }
  // compound nouns: "bank account" → modifier + head
  const nouns = [];
  let afterAdjective = false;
  while (
    c.peek &&
    (has(c.peek, 'noun') || has(c.peek, 'name') || has(c.peek, 'propn')) &&
    // "Month 3-6": a quantity after a noun names it, it is no compound
    !(nouns.length && c.peek.kind === 'quantity') &&
    !(options.stopAt !== undefined && c.i >= options.stopAt)
  ) {
    const t3 = c.peek;
    // "bought a car yesterday": a word that can be an adverb and ends the
    // clause is no second noun of a compound
    const after = c.at(1);
    if (
      nouns.length &&
      has(t3, 'adv') &&
      (!after ||
        isPunct(after) ||
        has(after, 'coord') ||
        has(after, 'subord') ||
        (has(after, 'prep') && !has(after, 'noun')))
    ) {
      break;
    }
    // "payment links": a bare singular noun is no subject, so a following
    // plural noun continues the compound
    const bareCompound =
      nouns.length === 1 &&
      !np.def &&
      !np.possessor &&
      np.quantity === undefined &&
      nouns[0].r.pos === 'noun' &&
      nouns[0].r.features.number !== 'pl' &&
      t3.readings.some((x) => x.pos === 'noun' && x.features.number === 'pl');
    if (
      nouns.length &&
      !options.fragment &&
      !afterAdjective &&
      !bareCompound &&
      !baseAfterSingular(t3, nouns[nouns.length - 1].r) &&
      has(t3, 'verb') &&
      !has(c.at(1), 'noun') &&
      nouns.length >= 1 &&
      verbLikely(c)
    ) {
      break;
    }
    c.next();
    afterAdjective = false;
    const r =
      reading(t3, 'name') || reading(t3, 'noun') || reading(t3, 'propn');
    const previous = nouns[nouns.length - 1];
    if (
      r.pos === 'propn' &&
      previous?.r.pos === 'propn' &&
      !r.features.opaque &&
      !previous.r.features.opaque
    ) {
      // "Mercari US", "Gray Swan Arena": one multi-word name
      const text = `${previous.t.text} ${t3.text}`;
      previous.t = { ...previous.t, text, lower: text.toLowerCase() };
      previous.r = { ...r, lemma: text };
    } else {
      nouns.push({ t: t3, r });
    }
    if (has(c.peek, 'poss-clitic') && possessiveClitic(c)) {
      break;
    }
    if (r.features.number === 'pl') {
      break;
    }
    // "Stripe direct deposit": a name or noun modifying an adjective + noun
    if (
      has(c.peek, 'adj') &&
      !has(c.peek, 'prep') &&
      nounAhead(c, 1) &&
      !(has(c.peek, 'verb') && verbLikely(c) && !baseAfterSingular(c.peek, r))
    ) {
      while (has(c.peek, 'adj') && nounAhead(c, 1)) {
        const a = c.next();
        adjectives.push(head(a, reading(a, 'adj')));
      }
      afterAdjective = true;
      continue;
    }
    if (r.pos !== 'noun' && !has(c.peek, 'noun') && !has(c.peek, 'propn')) {
      break;
    }
  }
  if (!nouns.length) {
    // a stop before the first noun leaves no noun phrase
    c.i = start;
    return null;
  }
  const last = nouns[nouns.length - 1];
  np.head = head(last.t, last.r);
  if (last.r.pos === 'propn') {
    np.name = last.t.text;
  }
  np.number = last.r.features.number || 'sg';
  if (
    np.quantity !== undefined &&
    np.quantity !== 1 &&
    last.r.pos === 'noun' &&
    np.number === 'sg'
  ) {
    np.number = 'pl';
  }
  if (nouns.length > 1) {
    np.modifiers = nouns.slice(0, -1).map((n) => head(n.t, n.r));
  }
  // "Month 3-6", "Tier 2", "page 5": a number naming the item
  if (
    last.r.pos === 'noun' &&
    /quantity|number/.test(c.peek?.kind) &&
    np.quantity === undefined &&
    (!c.at(1) ||
      isPunct(c.at(1)) ||
      has(c.at(1), 'prep') ||
      has(c.at(1), 'coord'))
  ) {
    np.label = c.next().text;
  }
  // possessive clitic: "John's book"
  if (has(c.peek, 'poss-clitic') && possessiveClitic(c)) {
    const clitic = c.i;
    c.next();
    const owned = parseNP(c, { stopAt: options.stopAt });
    if (owned) {
      owned.possessor = np;
      owned.def = 'def';
      return attachOf(c, owned, options);
    }
    // "Tom's happy": no owned noun, the clitic is "is"
    c.i = clitic;
  }
  return attachOf(c, np, options);
}

/** A reduced passive relative: "an account entered at withdrawal time". */
function attachParticiple(c, np, options) {
  const r = participleReading(c.peek);
  if (
    !r ||
    np.pronoun ||
    np.participles ||
    (options.stopAt !== undefined && c.i >= options.stopAt)
  ) {
    return;
  }
  // "Mary said (that) she…": a verb of saying or knowing before a clause
  if (
    options.clauseStart &&
    ((has(c.at(1), 'subord') && !has(c.at(1), 'prep')) ||
      reading(c.at(1), 'pron')?.features?.case === 'nom') &&
    c.peek.readings.some((x) => x.pos === 'verb' && x.features.form === 'past')
  ) {
    return;
  }
  // A subject's ordinary past-tense predicate must remain finite.
  if (
    options.clauseStart &&
    c.peek.readings.some(
      (x) => x.pos === 'verb' && /base|past|3sg/.test(x.features.form || '')
    ) &&
    !c.tokens
      .slice(c.i + 1)
      .some(
        (t) =>
          has(t, 'be') ||
          has(t, 'modal') ||
          t.readings.some((x) => x.pos === 'verb' && x.features.form === '3sg')
      )
  ) {
    return;
  }
  const v = c.next();
  const tail = parseTail(c, 'event', { ...options, nonfinite: true });
  np.participles = [{ verb: head(v, r), ...tail }];
}

/**
 * "is here": an adjective whose every sense is borrowed from another word
 * (Wiktionary's "here: [[alive]]") gives way to the word's own adverb.
 */
function borrowedAdjective(t, lexicon) {
  const own = (pos) =>
    (reading(t, pos)?.concepts || []).filter(
      (id) => !lexicon?.get(id)?.variant
    );
  return Boolean(
    lexicon && has(t, 'adv') && !own('adj').length && own('adv').length
  );
}

function isDegree(id) {
  return id === 'very' || id === 'too';
}

/** Does a noun follow within the next `k` tokens (adjectives skipped)? */
function nounAhead(c, k) {
  let j = k;
  while (
    has(c.at(j), 'adj') ||
    has(c.at(j), 'num') ||
    participleReading(c.at(j))
  ) {
    j += 1;
  }
  const t = c.at(j);
  return Boolean(t && (has(t, 'noun') || has(t, 'name') || has(t, 'propn')));
}

/** "Stripe direct …": a bare base form cannot be the verb of a singular noun. */
function baseAfterSingular(t, r) {
  return (
    r.features.number !== 'pl' &&
    t.readings.every((x) => x.pos !== 'verb' || x.features.form === 'base')
  );
}

/** Is the noun-or-verb token at the cursor more likely a finite verb? */
function verbLikely(c) {
  const after = c.at(1);
  return (
    !after ||
    startsNP(after) ||
    isPunct(after) ||
    has(after, 'prep') ||
    has(after, 'adv')
  );
}

/** `'s` after a noun is possessive when a noun phrase follows. */
function possessiveClitic(c) {
  if (c.peek.lower === "'") {
    return true;
  }
  const after = c.at(1);
  // "Audiomack's free route": an adjective (even one that is also a
  // verb) before a noun still starts the owned noun phrase
  return Boolean(
    after &&
    (has(after, 'noun') || has(after, 'adj')) &&
    (!has(after, 'verb') || (has(after, 'adj') && nounAhead(c, 2)))
  );
}

const RELATIVES = new Set(['who', 'which', 'that']);
let relativeParser = null;

/** The clause parser registers how to read "who/which/that …". */
export function setRelativeParser(fn) {
  relativeParser = fn;
}

let parentheticalParser = null;

/** The clause parser registers how to read the inside of "( … )". */
export function setParentheticalParser(fn) {
  parentheticalParser = fn;
}

/** "Upwork (pre-May contracts 10%)": the parenthesis belongs to the noun. */
function attachParenthesis(c, np) {
  if (!parentheticalParser || c.peek?.text !== '(') {
    return;
  }
  let depth = 0;
  for (let j = c.i; j < c.tokens.length; j += 1) {
    depth += c.tokens[j].text === '(' ? 1 : c.tokens[j].text === ')' ? -1 : 0;
    if (depth === 0) {
      const inside = c.tokens.slice(c.i + 1, j);
      const parsed = inside.length ? parentheticalParser(inside) : null;
      if (parsed && !parsed.leftover.length) {
        np.parenthetical = parsed.list;
        c.i = j + 1;
      }
      return;
    }
  }
}

/** "the price of the book" → genitive modifier. */
function attachOf(c, np, options = {}) {
  while (c.peek?.lower === 'of' && startsNP(c.at(1))) {
    const save = c.i;
    c.next();
    const of = parseNP(c);
    if (!of) {
      c.i = save;
      break;
    }
    np.of = of;
    if (np.quantity !== undefined) {
      np.partitive = true;
    }
  }
  attachParticiple(c, np, options);
  attachParenthesis(c, np);
  // "people who try this", "programmes that tolerate links"
  if (
    relativeParser &&
    options.relative !== false &&
    (RELATIVES.has(c.peek?.lower) || startsNP(c.peek)) &&
    !np.pronoun &&
    !np.relative
  ) {
    const save = c.i;
    const relative = relativeParser(c, np);
    if (relative) {
      np.relative = relative;
    } else {
      c.i = save;
    }
  }
  if (options.item) {
    return np;
  }
  const list = commaList(c, np);
  if (list) {
    return list;
  }
  if (
    c.peek?.lower === 'and' &&
    startsNP(c.at(1)) &&
    !clauseAhead(c, 1) &&
    !parallelVerb(c, 1)
  ) {
    const save = c.i;
    c.next();
    const other = parseNP(c);
    if (other) {
      return {
        type: 'np',
        coord: 'conj.and',
        items: [np, ...(other.coord === 'conj.and' ? other.items : [other])],
        number: 'pl',
      };
    }
    c.i = save;
  }
  return np;
}

/**
 * "Kenya, Nigeria and Ghana", "A, B, or C": a comma list is one
 * coordination only when it ends in "and"/"or" + a noun phrase.
 */
function commaList(c, first) {
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
function parallelVerb(c, k) {
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
    ['prep', 'det', 'pron', 'poss', 'to', 'adv', 'num'].some((p) =>
      has(after, p)
    ) ||
    // a request's second verb may take a bare object: "and deposit money"
    (form === 'base' && has(after, 'noun') && !has(c.at(k), 'adj'))
  );
}

/** Is a finite verb coming after an NP at offset k (so "and" joins clauses)? */
function clauseAhead(c, k) {
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

const ADVERB_NOUNS = new Set(['home']);

/**
 * Parse adverbials and objects after the verb.
 * @returns {{objects: object[], mods: object[], complement: object|null}}
 */
/**
 * After a prepositional phrase, "and"/"or" followed by another one,
 * perhaps across an adverb set off by commas ("and, more often, from").
 * @returns {{comma: number}|null} position of the closing comma, or -1
 */
function coordinatedPP(c) {
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

export function parseTail(c, frame, options = {}) {
  const takes = options.takes || [];
  const out = { objects: [], mods: [], complement: null, xcomp: null };
  let closingComma = -1;
  for (
    let guard = 0;
    guard < 20 && c.peek && (!isPunct(c.peek) || c.i === closingComma);
    guard += 1
  ) {
    const t = c.peek;
    if (c.i === closingComma) {
      c.next();
      continue;
    }
    // "from search and, more often, from links": coordinated phrases
    const ahead =
      has(t, 'coord') && out.mods.at(-1)?.type === 'pp' && coordinatedPP(c);
    if (ahead) {
      c.next();
      if (ahead.comma >= 0) {
        c.next();
        closingComma = ahead.comma;
      }
      out.mods.push({ type: 'conj', conj: t.lower });
      continue;
    }
    if (!options.nonfinite && options.finiteComplementAhead) {
      const link = options.finiteComplementAhead(c);
      if (link) {
        out.finiteLink = link;
        break;
      }
    }
    if (
      options.nonfinite &&
      (has(t, 'be') ||
        has(t, 'modal') ||
        (has(t, 'verb') &&
          !has(t, 'noun') &&
          !gerundReading(t) &&
          !participleReading(t)))
    ) {
      break;
    }
    if (has(t, 'coord') || (has(t, 'subord') && !has(t, 'prep'))) {
      break;
    }
    // "before you publish it": a clause link, not a preposition
    if (has(t, 'subord') && clauseAhead(c, 1)) {
      break;
    }
    if (has(t, 'wh') && out.objects.length + out.mods.length > 0) {
      break;
    }
    const degree = quantityDegree(t);
    if (degree) {
      const next = c.at(1);
      const pos =
        frame === 'copula' && !out.complement && has(next, 'adj')
          ? 'adj'
          : has(next, 'adv') && !has(next, 'noun')
            ? 'adv'
            : null;
      if (pos) {
        c.next();
        c.next();
        const item = { ...head(next, reading(next, pos)), comparison: degree };
        if (pos === 'adj') {
          out.complement = { type: 'adj', ...item };
        } else {
          out.mods.push({ type: 'adv', ...item });
        }
        continue;
      }
      const np = parseQuantity(c, options, parseNP);
      if (np) {
        out.objects.push(np);
        continue;
      }
      c.next();
      out.mods.push({ type: 'quantity', comparison: degree });
      continue;
    }
    if (t.lower === 'than') {
      const save = c.i;
      c.next();
      const np = parseNP(c);
      if (np) {
        out.mods.push({ type: 'comparison', np });
        continue;
      }
      c.i = save;
      break;
    }
    if (frame === 'copula' && !out.complement) {
      if (
        has(t, 'adj') &&
        !nounAhead(c, 1) &&
        !borrowedAdjective(t, options.lexicon)
      ) {
        c.next();
        out.complement = {
          type: 'adj',
          ...head(t, reading(t, 'adj')),
          comparative: reading(t, 'adj').features.degree === 'comparative',
          superlative: reading(t, 'adj').features.degree === 'superlative',
        };
        continue;
      }
      if (
        has(t, 'adv') &&
        reading(t, 'adv').concepts.some(isDegree) &&
        has(c.at(1), 'adj')
      ) {
        const degree = head(t, reading(t, 'adv'));
        c.next();
        const a = c.next();
        out.complement = { type: 'adj', ...head(a, reading(a, 'adj')), degree };
        continue;
      }
    }
    const toVerb =
      t.lower === 'to' &&
      has(c.at(1), 'verb') &&
      reading(c.at(1), 'verb').features.form === 'base';
    // "to wait", "to track sales": a word that is mostly a verb, or one
    // followed by its own object, is an infinitive after a verb's object
    const mostlyVerb =
      toVerb &&
      has(c.at(1), 'noun') &&
      out.objects.length > 0 &&
      (reading(c.at(1), 'verb').concepts.length >=
        reading(c.at(1), 'noun').concepts.length ||
        startsNP(c.at(2)));
    if (
      toVerb &&
      (options.infinitive || !has(c.at(1), 'noun') || mostlyVerb) &&
      !out.xcomp
    ) {
      c.next();
      const v = c.next();
      const r = reading(v, 'verb');
      const sub = parseTail(c, 'event', {
        ...options,
        takes: options.takesOf?.(r) || [],
        infinitive: options.infinitiveOf?.(r),
      });
      out.xcomp = { verb: head(v, r), ...sub };
      // "build ratings to get offers": after a thing, "to" states a goal;
      // after a person ("ask them to wait") it is what the person does
      const object = out.objects[out.objects.length - 1];
      if (object && !personLike(object, options.lexicon)) {
        out.xcomp.purpose = true;
      }
      continue;
    }
    const bounded = parseQuantity(c, options, parseNP);
    if (bounded) {
      if (frame === 'copula' && !out.complement) {
        out.complement = { type: 'np', np: bounded };
      } else {
        out.objects.push(bounded);
      }
      continue;
    }
    if (has(t, 'prep') && (!c.at(1) || isPunct(c.at(1)))) {
      // stranded preposition: "What are you thinking about?"
      c.next();
      out.stranded = t.lower;
      continue;
    }
    if (has(t, 'prep')) {
      const save = c.i;
      c.next();
      if (
        has(c.peek, 'adv') &&
        reading(c.peek, 'adv').features &&
        !startsNP(c.peek)
      ) {
        // "go to home" never happens; "from here"
        const a = c.next();
        out.mods.push({
          type: 'pp',
          relation: reading(t, 'prep').concepts[0],
          prep: t.lower,
          adv: head(a, reading(a, 'adv')),
        });
        continue;
      }
      const np = parseNP(c);
      if (!np) {
        c.i = save;
        break;
      }
      if (takes.includes(t.lower) && out.objects.length === 0) {
        np.marker = t.lower;
        out.objects.push(np);
      } else if (frame === 'copula' && !out.complement) {
        out.complement = {
          type: 'pp',
          relation: reading(t, 'prep').concepts[0],
          prep: t.lower,
          np,
          token: t.index,
        };
      } else {
        out.mods.push({
          type: 'pp',
          relation: reading(t, 'prep').concepts[0],
          prep: t.lower,
          np,
          token: t.index,
        });
      }
      continue;
    }
    // bare "home" after a verb is the adverb: "go home", "stay home"
    const bareAdverb =
      has(t, 'adv') &&
      has(t, 'noun') &&
      ADVERB_NOUNS.has(t.lower) &&
      !has(c.at(1), 'noun') &&
      c.at(1)?.lower !== "'s";
    // "ship orders fast", "track sales weekly": a bare word that ends the
    // clause is the adverb, not an object noun
    const next = c.at(1);
    const finalAdverb =
      has(t, 'adv') &&
      (!next ||
        isPunct(next) ||
        has(next, 'coord') ||
        has(next, 'subord') ||
        (has(next, 'prep') && !has(next, 'noun')));
    if (
      has(t, 'adv') &&
      (!has(t, 'noun') || bareAdverb || finalAdverb) &&
      !(
        has(t, 'adj') &&
        frame === 'copula' &&
        !borrowedAdjective(t, options.lexicon)
      )
    ) {
      c.next();
      out.mods.push({ type: 'adv', ...head(t, reading(t, 'adv')) });
      continue;
    }
    if (
      ['every', 'each', 'last', 'next', 'this'].includes(t.lower) &&
      timeAhead(c)
    ) {
      const np = parseNP(c);
      out.mods.push({ type: 'time', np });
      continue;
    }
    if (startsNP(t) && !(has(t, 'verb') && out.objects.length > 0)) {
      const np = parseNP(c);
      if (!np) {
        break;
      }
      if (frame === 'copula' && !out.complement) {
        out.complement = { type: 'np', np };
      } else if (isTimeNP(np)) {
        out.mods.push({ type: 'time', np });
      } else {
        out.objects.push(np);
      }
      continue;
    }
    break;
  }
  return out;
}

const TIME_NOUNS =
  /^(day|week|month|year|morning|evening|night|summer|winter|autumn|spring\.season|time|hour|minute|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)$/;

// a time noun by its English word: hand-written ids ("day") and learned
// ones ("wikt:day:noun:1") alike
const timeNoun = (lemma, ids = []) =>
  TIME_NOUNS.test(String(lemma || '').toLowerCase()) ||
  ids.some((id) => TIME_NOUNS.test(id) || TIME_NOUNS.test(id.split(':')[1]));

export function timeAhead(c) {
  const t = c.at(1);
  const r = t && reading(t, 'noun');
  return Boolean(r && timeNoun(r.lemma, r.concepts));
}

function isTimeNP(np) {
  return Boolean(
    np.head &&
    (np.det === 'det.every' ||
      np.det === 'det.each' ||
      np.adjs?.some((a) => a.lemma === 'last' || a.lemma === 'next')) &&
    timeNoun(np.head.lemma, np.head.candidates)
  );
}

export { Cursor, has, reading, isPunct, startsNP, head, mergeMultiwords };
