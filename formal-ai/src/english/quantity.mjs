import { has, head, reading, startsNP } from './token-readings.mjs';
import { nounAhead } from './predicate-adjectives.mjs';

/** Closed-class degree operators: lexical translations still come from sources. */
export const quantityDegree = (token) =>
  ({
    more: 'greater',
    less: 'lesser',
    fewer: 'lesser',
    most: 'greatest',
    least: 'least',
  })[token?.lower];

/** "is more stable", "pays less", "more than 50": a degree word in a
 * predicate grades an adjective, an adverb or an amount. */
export function parseDegree(c, frame, out, options, parseNP) {
  const degree = quantityDegree(c.peek);
  if (!degree) {
    return false;
  }
  const next = c.at(1);
  // "get most submissions": a determiner of the object, not a degree
  if (degree === 'greatest' && has(next, 'noun') && !has(next, 'adj')) {
    return false;
  }
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
    return true;
  }
  const np = parseQuantity(c, options, parseNP);
  if (np) {
    out.objects.push(np);
    return true;
  }
  c.next();
  out.mods.push({ type: 'quantity', comparison: degree });
  return true;
}

/** Closed-class approximators before a count. */
const APPROXIMATE = {
  about: 'approximate',
  around: 'approximate',
  approximately: 'approximate',
  roughly: 'approximate',
  nearly: 'almost',
  almost: 'almost',
  // "max $20 per payout", "min $1.50": a bound written as a label
  max: 'maximum',
  min: 'minimum',
};

/** A number or a quantity token ("4", "$20", "1-2"). */
export const countAhead = (t) =>
  /quantity|number/.test(t?.kind || '') ||
  Boolean(t?.readings?.some((r) => r.pos === 'num'));

/** A measured amount: money, a percentage, a unit or a time period. */
function measure(np, lexicon) {
  if (/[\p{Sc}%]/u.test(`${np.quantityText || ''}${np.name || ''}`)) {
    return true;
  }
  return (np.head?.candidates || []).some((id) => {
    const x = lexicon?.get(id);
    return (
      x?.classes?.some((k) => ['time', 'period', 'unit'].includes(k)) ||
      /\b(?:currency|unit|measure)\b/.test(x?.gloss || '')
    );
  });
}

/** Quantified constructions, kept separate from the core noun parser. */
export function parseQuantity(c, options, parseNP) {
  const start = c.i;
  const words = (n) =>
    c.tokens
      .slice(c.i, c.i + n)
      .map((t) => t.lower)
      .join(' ');
  const degree = quantityDegree(c.peek);
  if (
    degree &&
    degree !== 'greatest' &&
    c.at(1)?.lower !== 'than' &&
    !c.at(1)?.readings.some((r) => r.pos === 'adj' || r.pos === 'adv')
  ) {
    c.next();
    const np = parseNP(c, { ...options, quantityInner: true });
    if (np) {
      return { ...np, quantifier: degree };
    }
    c.i = start;
    return null;
  }
  let bound;
  let length = 0;
  if (degree && words(2).endsWith(' than')) {
    bound = degree === 'greater' ? 'above' : 'below';
    length = 2;
  } else if (words(2) === 'up to' || words(1) === 'up to') {
    bound = 'upper';
    length = words(1) === 'up to' ? 1 : 2;
  } else if (words(2) === 'at least' || words(1) === 'at least') {
    bound = 'lower';
    length = words(1) === 'at least' ? 1 : 2;
  } else if (words(1) === 'between') {
    bound = 'range';
    length = 1;
  } else if (APPROXIMATE[words(1)] && countAhead(c.at(1))) {
    // "about 4 days", "nearly $20"
    bound = APPROXIMATE[words(1)];
    length = 1;
  }
  if (!bound) {
    return null;
  }
  c.i += length;
  let rangeFrom;
  if (bound === 'range') {
    const r = c.peek?.readings.find((r) => r.pos === 'num');
    if (!r || c.at(1)?.lower !== 'and') {
      c.i = start;
      return null;
    }
    rangeFrom = r.features.value;
    c.i += 2;
  }
  const np = parseNP(c, { ...options, quantityInner: true });
  if (
    !np ||
    (np.quantity === undefined && !/\d/.test(np.name || np.head?.text || '')) ||
    // after a verb, "about 3 options" is a topic; "about 3 hours" a measure
    (options.measureOnly &&
      /approximate|almost/.test(bound) &&
      !measure(np, options.lexicon))
  ) {
    c.i = start;
    return null;
  }
  return { ...np, bound, ...(rangeFrom !== undefined ? { rangeFrom } : {}) };
}

/** Productive English superlative morphology, without content-word tables. */
export function superlatives(tokens, lexicon) {
  for (const t of tokens) {
    if (quantityDegree(t) || t.lower === 'than') {
      t.readings.push({
        pos: 'grammar',
        lemma: 'least',
        concepts: [],
        features: {},
      });
    }
    if (!/est$/.test(t.lower) || t.readings.some((r) => r.pos === 'adj')) {
      continue;
    }
    const stem = t.lower.slice(0, -3);
    const bases = [
      stem,
      `${stem}e`,
      stem.replace(/i$/, 'y'),
      stem.replace(/(.)\1$/, '$1'),
    ];
    for (const lemma of bases) {
      const concepts = lexicon.lookup('adj', lemma);
      if (!concepts.length) {
        continue;
      }
      t.readings.push({
        pos: 'adj',
        lemma,
        concepts,
        features: { degree: 'superlative' },
      });
      break;
    }
  }
  return tokens;
}

/** A verified currency code next to a number is a unit, on either side. */
export function parseCurrency(c, lexicon) {
  const unit = (t) =>
    t?.readings?.flatMap((r) =>
      r.concepts
        .filter((id) => lexicon?.get(id)?.classes?.includes('currency'))
        .map((id) => ({ ...r, concepts: [id] }))
    )[0];
  const before = unit(c.peek);
  const amount = c.at(before ? 1 : 0);
  const r = before || unit(c.at(1));
  if (!r || !/^\d[\d,.]*(?:[–-]\d[\d,.]*)?\+?$/.test(amount?.text || '')) {
    return null;
  }
  const token = c.at(before ? 0 : 1);
  c.i += 2;
  return {
    type: 'np',
    adjs: [],
    number: 'pl',
    head: {
      token: token.index,
      text: token.text,
      lemma: r.lemma,
      pos: 'noun',
      candidates: r.concepts,
      concept: r.concepts[0],
    },
    quantity: /[–-]/.test(amount.text)
      ? 5
      : Number(amount.text.replaceAll(',', '').replace('+', '')),
    quantityText: amount.text,
    ...(/[–-]/.test(amount.text)
      ? {
          bound: 'range',
          rangeFrom: Number(amount.text.split(/[–-]/)[0].replaceAll(',', '')),
          quantity: Number(amount.text.split(/[–-]/)[1].replaceAll(',', '')),
          quantityText: amount.text.split(/[–-]/)[1],
        }
      : {}),
  };
}

/** A verified monetary unit takes precedence over spaced identifier syntax. */
export function currencyTokens(tokens, lexicon) {
  return tokens
    .flatMap((t) => {
      const m = /^([A-Z]{3}) (\d+)$/.exec(t.text);
      if (
        !m ||
        !lexicon
          .lookup('noun', m[1].toLowerCase())
          .some((id) => lexicon.get(id)?.classes.includes('currency'))
      ) {
        return [t];
      }
      return [
        { text: m[1], lower: m[1].toLowerCase(), kind: 'word' },
        { text: m[2], lower: m[2], kind: 'number' },
      ];
    })
    .map((t, index) => ({ ...t, index }));
}

/** An amount or a count before the noun: "$50 fee", "two users", "~190 markets". */
export function parseCount(c, np) {
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
    /\d/.test(c.peek.text) &&
    !/[\p{Sc}%]/u.test(c.peek.text) &&
    nounAhead(c, 1)
  ) {
    // "~190 markets", "50K plays", "1-2 students": a count before a noun
    // a range counts as its upper bound: «1–2 студента», «5–15 студентов»
    const n = Number(
      /\d+(?:\.\d+)?(?!.*\d)/.exec(c.peek.text.replace(/,/g, ''))[0]
    );
    const scale = /k/i.test(c.peek.text)
      ? 1000
      : /m/i.test(c.peek.text)
        ? 1e6
        : 1;
    np.quantity = n * scale;
    np.quantityText = c.next().text;
  }
}

/** "nearly all countries", "almost every user": an approximated quantifier. */
export function approximateQuantifier(c, parse) {
  const bound = APPROXIMATE[c.peek?.lower];
  const det = reading(c.at(1), 'det');
  if (!bound || !['all', 'every', 'each', 'no'].includes(det?.lemma)) {
    return null;
  }
  const start = c.i;
  c.next();
  const np = parse(c);
  if (!np) {
    c.i = start;
    return null;
  }
  return { ...np, bound };
}

/** "from here": a preposition before an adverb that starts no phrase. */
export function adverbPhrase(c, t, out) {
  if (
    has(c.peek, 'adv') &&
    reading(c.peek, 'adv').features &&
    !startsNP(c.peek) &&
    !countAhead(c.at(1)) &&
    !startsNP(c.at(1))
  ) {
    const a = c.next();
    out.mods.push({
      type: 'pp',
      relation: reading(t, 'prep').concepts[0],
      prep: t.lower,
      adv: head(a, reading(a, 'adv')),
    });
    return true;
  }
  return false;
}
