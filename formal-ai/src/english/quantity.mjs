/** Closed-class degree operators: lexical translations still come from sources. */
export const quantityDegree = (token) =>
  ({
    more: 'greater',
    less: 'lesser',
    fewer: 'lesser',
    most: 'greatest',
    least: 'least',
  })[token?.lower];

/** Closed-class approximators before a count. */
const APPROXIMATE = {
  about: 'approximate',
  around: 'approximate',
  approximately: 'approximate',
  roughly: 'approximate',
  nearly: 'almost',
  almost: 'almost',
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
