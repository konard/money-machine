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
  contactRelativeAhead,
  baseAfterSingular,
  verbLikely,
  reading,
  isPunct,
  head,
  startsNP,
  gerundReading,
  participleReading,
} from './token-readings.mjs';
import { parseToInfinitive } from './infinitive.mjs';
import { attributiveAction } from './attributive-action.mjs';
import { parseCalendar, calendarAhead } from './calendar.mjs';
import { Cursor } from './cursor.mjs';
import { sharedHead } from './shared-head.mjs';
import { nounFirst, nounModifier } from './nominal-evidence.mjs';
import { STANDALONE_DETERMINERS } from './function-words.mjs';
import { borrowedAdjective, standalone } from './noun-helpers.mjs';
import {
  countAhead,
  parseQuantity,
  parseCurrency,
  quantityDegree,
} from './quantity.mjs';
import { mergeMultiwords } from './multiword.mjs';
import { isTimeNP, timeAhead } from './time-phrase.mjs';
import { asPhrase } from './as-phrase.mjs';
import {
  coordinatedAdjectives,
  degreeAdverb,
  nounAhead,
} from './predicate-adjectives.mjs';
import { attachIngRelative } from './ing-relative.mjs';
import { attachParticiple } from './participle-relative.mjs';
import { clauseAhead, commaList, parallelVerb } from './lists.mjs';
export { parseVerbGroup } from './verb-group.mjs';
import { intransitiveAttribute } from './verb-group.mjs';

/**
 * Parse a noun phrase starting at the cursor.
 * @returns {object|null}
 */
export function parseNP(c, options = {}) {
  options = { ...c.grammar, ...options };
  const start = c.i;
  const attributed = attributiveAction(c, options, parseNP);
  if (attributed) {
    return attributed;
  }
  const calendar =
    parseCalendar(c, options.lexicon) || parseCurrency(c, options.lexicon);
  if (calendar) {
    return calendar;
  }
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
  if (
    gerundReading(t) &&
    !options.nominal &&
    // "pass onboarding tests": a verb that takes no gerund has a noun object
    !(options.gerundObject === false && has(t, 'noun') && startsNP(c.at(1))) &&
    !contactRelativeAhead(c) &&
    !intransitiveAttribute(c)
  ) {
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
    // "a few" (несколько), "a little" (немного): one quantifier
    const paired = { few: ['det.several', 'pl'], little: ['det.some', 'sg'] };
    if (t.lower === 'a' && paired[c.peek?.lower] && nounAhead(c, 1)) {
      [np.det, np.detNumber] = paired[c.next().lower];
    }
    // "both work": a plural quantifier takes no singular noun, so a word
    // that may also be a verb is the verb
    const n = c.peek;
    if (
      STANDALONE_DETERMINERS[np.det] &&
      np.detNumber === 'pl' &&
      has(n, 'verb') &&
      n.readings.every(
        (x) => x.pos !== 'noun' || x.features?.number === 'sg'
      ) &&
      !nounAhead(c, 1)
    ) {
      return standalone(c, np, options, attachOf);
    }
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
    !(
      options.fragment &&
      nounFirst(c.peek, options.lexicon) &&
      nounFirst(c.peek, options.lexicon, 'adj') &&
      nounAhead(c, 1)
    ) &&
    !(nounModifier(c.peek, options.lexicon) && has(c.at(1), 'noun')) &&
    // a conjunction is no adjective ("or", heraldic gold)
    !has(c.peek, 'coord') &&
    ((quantityDegree(c.peek) && has(c.at(1), 'adj')) ||
      has(c.peek, 'adj') ||
      (participleReading(c.peek) && nounAhead(c, 1)) ||
      (degreeAdverb(c.peek) && has(c.at(1), 'adj')))
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
    // an adjective followed by nothing nominal ends the phrase: "is big";
    // a limit right after a word that may be a noun ends it too
    const limited =
      options.stopAt !== undefined &&
      c.i + 1 >= options.stopAt &&
      (has(t2, 'noun') || has(t2, 'name'));
    // "rated 2/10": a score or an amount takes no adjective
    const amountAhead = c.at(1)?.kind === 'quantity';
    // "low/medium risk": alternative adjectives written with a slash
    // …or with "and"/"or": "raw or unpublished video"
    const pair =
      (c.at(1)?.slash || ['and', 'or'].includes(c.at(1)?.lower)) &&
      (has(c.at(2), 'adj') || participleReading(c.at(2))) &&
      nounAhead(c, 3);
    if (
      limited ||
      amountAhead ||
      (has(t2, 'noun') && participleReading(c.at(1)) && !nounAhead(c, 1)) ||
      (!pair && !nounAhead(c, 1) && !has(c.at(1), 'adj'))
    ) {
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
    if (pair) {
      const join = c.next();
      const t4 = c.next();
      const r4 = reading(t4, 'adj') || participleReading(t4);
      a.alternative = head(t4, r4);
      if (r4.pos === 'verb') {
        a.alternative.participle = 'past-passive';
      }
      if (!join.slash) {
        a.alternative.join = join.lower === 'and' ? 'conj.and' : 'conj.or';
      }
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
    // "both reject", "many of them": a quantifier standing alone
    if (
      STANDALONE_DETERMINERS[np.det] &&
      !adjectives.length &&
      np.quantity === undefined
    ) {
      return standalone(c, np, options, attachOf);
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
    // nor a noun; a preposition before its noun phrase is a preposition
    // ("at month 6", not the @ sign)
    !has(c.peek, 'coord') &&
    !(nouns.length && has(c.peek, 'modal') && has(c.at(1), 'be')) &&
    !(nouns.length && has(c.peek, 'prep') && startsNP(c.at(1))) &&
    // "Month 3-6": a quantity after a noun names it, it is no compound
    !(nouns.length && c.peek.kind === 'quantity') &&
    !(options.stopAt !== undefined && c.i >= options.stopAt)
  ) {
    const t3 = c.peek;
    // A secondary noun borrowed through a related entry cannot absorb an
    // ordinary predicate adjective after the subject.
    if (
      nouns.length &&
      has(t3, 'adj') &&
      !nounAhead(c, 1) &&
      reading(t3, 'noun')?.concepts.every((id) => {
        const sense = options.lexicon?.get(id);
        return sense?.related || sense?.variant;
      }) &&
      reading(t3, 'adj').concepts.some(
        (id) => !options.lexicon?.get(id)?.related
      )
    ) {
      break;
    }
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
        (has(after, 'prep') && (!has(after, 'noun') || startsNP(c.at(2)))))
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
      !(
        options.infinitiveObject &&
        has(t3, 'noun') &&
        c.at(1)?.lower === 'to' &&
        c.at(2)?.lower === 'be' &&
        c
          .at(3)
          ?.readings.some(
            (r) => r.pos === 'verb' && /pp/.test(r.features.form || '')
          )
      ) &&
      !baseAfterSingular(t3, nouns[nouns.length - 1].r) &&
      has(t3, 'verb') &&
      !has(c.at(1), 'noun') &&
      nouns.length >= 1 &&
      verbLikely(c) &&
      // "keyboard testing.", "with B2B targets.": an -ing word, or any
      // word inside a phrase after the verb, ending the phrase is a noun
      !(
        (options.inPhrase ||
          t3.readings.every(
            (x) => x.pos !== 'verb' || x.features.form === 'ing'
          )) &&
        (!c.at(1) || isPunct(c.at(1)) || has(c.at(1), 'coord'))
      )
    ) {
      break;
    }
    c.next();
    afterAdjective = false;
    let r = reading(t3, 'name') || reading(t3, 'noun') || reading(t3, 'propn');
    if (
      r.pos === 'noun' &&
      options.lexicon?.massPlurals?.has(r.lemma) &&
      (np.detNumber === 'pl' ||
        (!np.detNumber &&
          c.peek?.readings.some(
            (x) => x.pos === 'verb' && x.features.form === 'base'
          )))
    ) {
      r = { ...r, features: { ...r.features, number: 'pl' } };
    }
    const previous = nouns[nouns.length - 1];
    if (
      r.pos === 'propn' &&
      previous?.r.pos === 'propn' &&
      !previous.alternative &&
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
    // "tax/payment setup": alternative modifiers written with a slash
    // or of the head: "the tax/fee"
    if (
      c.peek?.slash &&
      ['noun', 'name', 'propn'].some((p) => has(c.at(1), p)) &&
      !(options.stopAt !== undefined && c.i + 1 >= options.stopAt)
    ) {
      c.next();
      const t4 = c.next();
      nouns[nouns.length - 1].alternative = head(
        t4,
        reading(t4, r.pos) ||
          reading(t4, 'noun') ||
          reading(t4, 'name') ||
          reading(t4, 'propn')
      );
      if (['noun', 'name', 'propn'].some((p) => has(c.peek, p))) {
        continue;
      }
    }
    if (has(c.peek, 'poss-clitic') && possessiveClitic(c)) {
      break;
    }
    // "with sales teams.": inside a phrase a plural before a final noun
    // is that noun's modifier
    // …and so is it before a noun and a plain verb: "Sales teams earn"
    const pluralModifier =
      has(c.peek, 'noun') &&
      ((options.inPhrase &&
        (!c.at(1) || isPunct(c.at(1)) || has(c.at(1), 'coord'))) ||
        (options.clauseStart &&
          !has(c.at(1), 'noun') &&
          ['be', 'modal', 'verb'].some((p) => has(c.at(1), p)) &&
          c
            .at(1)
            .readings.every(
              (x) => x.pos !== 'verb' || /base|past/.test(x.features.form)
            )));
    if (r.features.number === 'pl' && !pluralModifier) {
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
  if (last.alternative) {
    np.alternative = last.alternative;
  }
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
    np.modifiers = nouns.slice(0, -1).map((n) => ({
      ...head(n.t, n.r),
      ...(n.alternative ? { alternative: n.alternative } : {}),
      // "sales teams" → команды продаж
      ...(n.r.features?.number === 'pl' ? { plural: true } : {}),
    }));
  }
  // "Month 3-6", "Tier 2", "page 5": a number naming the item
  if (
    last.r.pos === 'noun' &&
    /quantity|number/.test(c.peek?.kind) &&
    np.quantity === undefined &&
    (!c.at(1) ||
      isPunct(c.at(1)) ||
      c
        .at(1)
        ?.readings.some(
          (r) => r.pos === 'verb' && /past|pp|3sg/.test(r.features.form || '')
        ) ||
      has(c.at(1), 'prep') ||
      has(c.at(1), 'coord'))
  ) {
    np.label = c.next().text;
  }
  // "the payment itself", "Tom himself": an emphatic reflexive
  if (reading(c.peek, 'pron')?.features?.case === 'refl') {
    c.next();
    np.emphatic = true;
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
        np.parentheticalFinal = c.tokens
          .slice(j + 1)
          .every((t) => /^[.!?;]$/.test(t.text));
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
    const of = parseNP(c, { stopAt: options.stopAt });
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
  attachIngRelative(c, np, options);
  attachParenthesis(c, np);
  // "people who try this", "programmes that tolerate links"
  if (
    relativeParser &&
    options.relative !== false &&
    !(has(c.peek, 'prep') && startsNP(c.at(1))) &&
    !has(c.peek, 'modal') &&
    !(options.stopAt !== undefined && c.i >= options.stopAt) &&
    (RELATIVES.has(c.peek?.lower) || startsNP(c.peek)) &&
    !(
      ['all', 'both', 'each'].includes(c.peek?.lower) && has(c.at(1), 'verb')
    ) &&
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
    ['and', 'or'].includes(c.peek?.lower) &&
    !c.peek.slash &&
    startsNP(c.at(1)) &&
    !clauseAhead(c, 1) &&
    !parallelVerb(c, 1)
  ) {
    const save = c.i;
    const coord = c.next().lower === 'or' ? 'conj.or' : 'conj.and';
    const other = parseNP(c, {
      stopAt: options.stopAt,
      inPhrase: options.inPhrase,
    });
    if (other) {
      return {
        type: 'np',
        coord,
        items: [
          sharedHead(np, other, options.lexicon),
          ...(other.coord === coord ? other.items : [other]),
        ],
        // "a card or a bank": one of them
        number: coord === 'conj.or' ? np.number : 'pl',
      };
    }
    c.i = save;
  }
  return np;
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
          !(has(t, 'adj') && nounAhead(c, 1)) &&
          !gerundReading(t) &&
          !participleReading(t)))
    ) {
      break;
    }
    if (t.lower === 'as' && asPhrase(c, frame, out, options)) {
      continue;
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
        // "are in the pen": a preposition before its noun phrase
        !(has(t, 'prep') && startsNP(c.at(1))) &&
        !borrowedAdjective(t, options.lexicon)
      ) {
        c.next();
        out.complement = {
          type: 'adj',
          ...head(t, reading(t, 'adj')),
          comparative: reading(t, 'adj').features.degree === 'comparative',
          superlative: reading(t, 'adj').features.degree === 'superlative',
        };
        coordinatedAdjectives(c, out.complement);
        continue;
      }
      if (degreeAdverb(t) && has(c.at(1), 'adj')) {
        const degree = head(t, reading(t, 'adv'));
        c.next();
        const a = c.next();
        out.complement = { type: 'adj', ...head(a, reading(a, 'adj')), degree };
        coordinatedAdjectives(c, out.complement);
        continue;
      }
    }
    if (parseToInfinitive(c, frame, out, options, parseTail)) {
      continue;
    }
    // "ask about 3 options": a preposition the verb takes is no bound
    const bounded =
      !takes.includes(c.peek?.lower) &&
      parseQuantity(c, { ...options, measureOnly: true }, parseNP);
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
        !startsNP(c.peek) &&
        !countAhead(c.at(1))
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
      const np = parseNP(c, { inPhrase: true });
      if (!np) {
        c.i = save;
        break;
      }
      // "assumes about $20": an amount is approximated, not an object
      const amount =
        np.head?.pos === 'propn' && /^~?\p{Sc}?\d/u.test(np.name || '');
      if (takes.includes(t.lower) && out.objects.length === 0 && !amount) {
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
        (has(next, 'prep') && (!has(next, 'noun') || startsNP(c.at(2)))));
    // "sell new and used books": an adjective coordinated before a noun
    const pairedAdjective =
      has(t, 'adj') &&
      ['and', 'or'].includes(next?.lower) &&
      (has(c.at(2), 'adj') || participleReading(c.at(2))) &&
      has(c.at(3), 'noun');
    if (
      has(t, 'adv') &&
      !pairedAdjective &&
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
    if (calendarAhead(c)) {
      out.mods.push({ type: 'pp', relation: 'rel.in', np: parseNP(c) });
      continue;
    }
    if (startsNP(t) && !(has(t, 'verb') && out.objects.length > 0)) {
      const np = parseNP(c, {
        infinitiveObject: true,
        gerundObject: options.gerund,
      });
      if (!np) {
        break;
      }
      if (has(c.peek, 'postp')) {
        // "two days ago": a postposition after its noun phrase
        const p = c.next();
        out.mods.push({
          type: 'pp',
          relation: reading(p, 'postp').concepts[0],
          postposition: true,
          np,
        });
      } else if (frame === 'copula' && !out.complement) {
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

export { timeAhead };
export { Cursor, has, reading, isPunct, startsNP, head, mergeMultiwords };
