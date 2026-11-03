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

import { COMPLEX_PREPOSITIONS } from './function-words.mjs';

const has = (token, pos) => token?.readings.some((r) => r.pos === pos);
const reading = (token, pos) => token?.readings.find((r) => r.pos === pos);
const isPunct = (token) => token?.kind === 'punct';

/** Merge multi-word lexicon entries and complex prepositions. */
export function mergeMultiwords(tokens, lexicon) {
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    let merged = false;
    for (const words of COMPLEX_PREPOSITIONS) {
      if (words.every((w, k) => tokens[i + k]?.lower === w)) {
        const lemma = words.join(' ');
        out.push({
          ...t,
          text: tokens
            .slice(i, i + words.length)
            .map((x) => x.text)
            .join(' '),
          lower: lemma,
          readings: [
            {
              pos: 'prep',
              lemma,
              features: {},
              concepts: [`rel.${words.join('-')}`],
            },
          ],
        });
        i += words.length - 1;
        merged = true;
        break;
      }
    }
    if (merged) {
      continue;
    }
    for (const entry of lexicon.multiword.get(t.lower) || []) {
      if (entry.words.every((w, k) => tokens[i + k]?.lower === w)) {
        out.push({
          ...t,
          text: tokens
            .slice(i, i + entry.words.length)
            .map((x) => x.text)
            .join(' '),
          lower: entry.lemma,
          readings: [
            {
              pos: entry.pos,
              lemma: entry.lemma,
              features: entry.pos === 'noun' ? { number: 'sg' } : {},
              concepts: lexicon.lookup(entry.pos, entry.lemma),
            },
          ],
        });
        i += entry.words.length - 1;
        merged = true;
        break;
      }
    }
    if (!merged) {
      out.push(t);
    }
  }
  return out;
}

/** Cursor over a token array. */
class Cursor {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }
  get peek() {
    return this.tokens[this.i];
  }
  at(k) {
    return this.tokens[this.i + k];
  }
  next() {
    return this.tokens[this.i++];
  }
  get done() {
    return this.i >= this.tokens.length;
  }
}

const head = (token, r) => ({
  token: token.index,
  text: token.text,
  lemma: r.lemma,
  pos: r.pos,
  candidates: r.concepts,
  concept: r.concepts.length === 1 ? r.concepts[0] : null,
});

/** Can this token start a noun phrase? */
function startsNP(token) {
  return [
    'det',
    'poss',
    'num',
    'pron',
    'noun',
    'name',
    'propn',
    'adj',
    'indef',
  ].some((p) => has(token, p));
}

/**
 * Parse a noun phrase starting at the cursor.
 * @returns {object|null}
 */
export function parseNP(c, options = {}) {
  const start = c.i;
  const np = { type: 'np', adjs: [], number: null, def: null };
  let t = c.peek;
  if (!t) {
    return null;
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
    return np;
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
  if (has(c.peek, 'num') && !has(c.peek, 'det')) {
    const r = reading(c.peek, 'num');
    np.quantity = r.features.value;
    c.next();
  }
  const adjectives = [];
  while (
    c.peek &&
    (has(c.peek, 'adj') ||
      (has(c.peek, 'adv') &&
        reading(c.peek, 'adv').concepts.some(isDegree) &&
        has(c.at(1), 'adj')))
  ) {
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
    const r = reading(t2, 'adj');
    const last = adjectives[adjectives.length - 1];
    const a = head(t2, r);
    if (last?.degree && !last.lemma) {
      a.degree = last.degree;
      adjectives.pop();
    }
    if (r.features.degree) {
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
      return np;
    }
    c.i = start;
    return null;
  }
  // compound nouns: "bank account" → modifier + head
  const nouns = [];
  while (
    c.peek &&
    (has(c.peek, 'noun') || has(c.peek, 'name') || has(c.peek, 'propn'))
  ) {
    const t3 = c.peek;
    if (
      nouns.length &&
      has(t3, 'verb') &&
      !has(c.at(1), 'noun') &&
      nouns.length >= 1 &&
      verbLikely(c)
    ) {
      break;
    }
    c.next();
    const r =
      reading(t3, 'name') || reading(t3, 'noun') || reading(t3, 'propn');
    nouns.push({ t: t3, r });
    if (has(c.peek, 'poss-clitic') && possessiveClitic(c)) {
      break;
    }
    if (r.pos !== 'noun' || r.features.number === 'pl') {
      break;
    }
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
  // possessive clitic: "John's book"
  if (has(c.peek, 'poss-clitic') && possessiveClitic(c)) {
    c.next();
    const owned = parseNP(c);
    if (owned) {
      owned.possessor = np;
      owned.def = 'def';
      return attachOf(c, owned);
    }
  }
  return attachOf(c, np);
}

function isDegree(id) {
  return id === 'very' || id === 'too';
}

/** Does a noun follow within the next `k` tokens (adjectives skipped)? */
function nounAhead(c, k) {
  let j = k;
  while (has(c.at(j), 'adj') || has(c.at(j), 'num')) {
    j += 1;
  }
  const t = c.at(j);
  return Boolean(t && (has(t, 'noun') || has(t, 'name') || has(t, 'propn')));
}

/** Is the noun-or-verb token at the cursor more likely a finite verb? */
function verbLikely(c) {
  const after = c.at(1);
  return !after || startsNP(after) || isPunct(after) || has(after, 'prep');
}

/** `'s` after a noun is possessive when a noun phrase follows. */
function possessiveClitic(c) {
  if (c.peek.lower === "'") {
    return true;
  }
  const after = c.at(1);
  return Boolean(
    after && (has(after, 'noun') || has(after, 'adj')) && !has(after, 'verb')
  );
}

/** "the price of the book" → genitive modifier. */
function attachOf(c, np) {
  while (c.peek?.lower === 'of' && startsNP(c.at(1))) {
    const save = c.i;
    c.next();
    const of = parseNP(c);
    if (!of) {
      c.i = save;
      break;
    }
    np.of = of;
  }
  if (c.peek?.lower === 'and' && startsNP(c.at(1)) && !clauseAhead(c, 1)) {
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

/**
 * Parse the verb group at the cursor: auxiliaries, negation, main verb.
 * @returns {object|null} `{tense, aspect, polarity, modal, verb, passive, frame}`
 */
export function parseVerbGroup(c, subject) {
  const vg = {
    tense: 'present',
    aspect: 'simple',
    polarity: 'positive',
    modal: null,
    verb: null,
    adverbs: [],
  };
  let expect = 'finite';
  const skipAdverbs = () => {
    while (
      c.peek &&
      has(c.peek, 'adv') &&
      !has(c.peek, 'verb') &&
      !has(c.peek, 'adj') &&
      !has(c.peek, 'noun') &&
      !(
        reading(c.peek, 'adv').concepts.some(isDegree) &&
        (has(c.at(1), 'adj') || has(c.at(1), 'adv'))
      )
    ) {
      vg.adverbs.push(head(c.peek, reading(c.peek, 'adv')));
      c.next();
    }
    while (has(c.peek, 'neg')) {
      vg.polarity = 'negative';
      if (reading(c.peek, 'neg').lemma === 'never') {
        vg.adverbs.push({
          token: c.peek.index,
          text: c.peek.text,
          lemma: 'never',
          pos: 'adv',
          candidates: ['never'],
          concept: 'never',
        });
      }
      c.next();
    }
  };
  skipAdverbs();
  for (let guard = 0; guard < 6 && c.peek; guard += 1) {
    const t = c.peek;
    if (expect === 'finite' && has(t, 'modal')) {
      const r = reading(t, 'modal');
      vg.modal = r.features.modal;
      vg.tense = r.features.tense;
      c.next();
      expect = 'base';
      skipAdverbs();
      continue;
    }
    if (
      has(t, 'do') &&
      expect === 'finite' &&
      (has(c.at(1), 'neg') ||
        has(c.at(1), 'verb') ||
        subject === 'question' ||
        has(c.at(1), 'pron'))
    ) {
      const r = reading(t, 'do');
      if (
        has(c.at(1), 'neg') ||
        subject === 'question' ||
        (has(c.at(1), 'verb') && !startsNP(c.at(1)))
      ) {
        vg.tense = r.features.tense;
        vg.agree = r.features;
        c.next();
        expect = 'base';
        skipAdverbs();
        continue;
      }
    }
    if (has(t, 'have') && (expect === 'finite' || expect === 'base')) {
      const r = reading(t, 'have');
      const after = nextNonAdverb(c, 1);
      if (
        has(after, 'verb') &&
        reading(after, 'verb').features.form?.includes('pp') &&
        !(
          has(after, 'noun') &&
          !reading(after, 'verb').features.form.includes('past')
        )
      ) {
        if (expect === 'finite') {
          vg.tense = r.features.tense || vg.tense;
          vg.agree = r.features;
        }
        vg.aspect = 'perfect';
        c.next();
        expect = 'pp';
        skipAdverbs();
        continue;
      }
      if (has(after, 'be') && reading(after, 'be').features.form === 'pp') {
        if (expect === 'finite') {
          vg.tense = r.features.tense || vg.tense;
        }
        vg.aspect = 'perfect';
        c.next();
        expect = 'pp';
        skipAdverbs();
        continue;
      }
      if (c.at(1)?.lower === 'to' && has(c.at(2), 'verb')) {
        if (expect === 'finite') {
          vg.tense = r.features.tense || vg.tense;
          vg.agree = r.features;
        }
        vg.modal = 'modal.must';
        c.next();
        c.next();
        expect = 'base';
        continue;
      }
      if (expect === 'finite') {
        vg.tense = r.features.tense || vg.tense;
        vg.agree = r.features;
      }
      c.next();
      vg.verb = {
        token: t.index,
        text: t.text,
        lemma: 'have',
        pos: 'verb',
        candidates: ['have'],
        concept: 'have',
      };
      vg.frame = 'possession';
      return vg;
    }
    if (has(t, 'be')) {
      const r = reading(t, 'be');
      if (expect === 'finite') {
        vg.tense = r.features.tense || vg.tense;
        vg.agree = r.features;
      }
      c.next();
      skipAdverbs();
      const after = c.peek;
      if (
        has(after, 'verb') &&
        reading(after, 'verb').features.form === 'ing'
      ) {
        vg.aspect =
          vg.aspect === 'perfect' ? 'perfect-progressive' : 'progressive';
        expect = 'ing';
        continue;
      }
      if (
        after?.lower === 'going' &&
        c.at(1)?.lower === 'to' &&
        has(c.at(2), 'verb')
      ) {
        vg.tense = 'future';
        c.next();
        c.next();
        expect = 'base';
        continue;
      }
      if (
        has(after, 'verb') &&
        /pp/.test(reading(after, 'verb').features.form || '') &&
        !has(after, 'adj')
      ) {
        vg.passive = true;
        const v = reading(after, 'verb');
        c.next();
        vg.verb = head(after, v);
        vg.frame = 'event';
        return vg;
      }
      vg.verb = {
        token: t.index,
        text: t.text,
        lemma: 'be',
        pos: 'verb',
        candidates: ['be'],
        concept: 'be',
      };
      vg.frame = 'copula';
      return vg;
    }
    if (has(t, 'verb')) {
      const r = reading(t, 'verb');
      const form = r.features.form;
      if (
        expect === 'finite' &&
        form === 'base' &&
        subject === 'third-singular'
      ) {
        // "the bank closes" handled by 3sg reading; a bare base form after a
        // singular subject is still accepted (headlines, subjunctive)
      }
      if (expect === 'finite') {
        if (/past/.test(form)) {
          vg.tense = 'past';
        } else if (form === 'ing' || form === 'pp') {
          return null;
        } else if (
          form === 'base' &&
          t.readings.some(
            (x) => x.pos === 'verb' && x.features.form === 'past'
          ) &&
          subject !== 'third'
        ) {
          // "I put", "we read": English does not say whether this is now or before
          vg.tense = 'present|past';
        }
      }
      c.next();
      vg.verb = head(t, r);
      vg.frame = 'event';
      return vg;
    }
    break;
  }
  return vg.verb ? vg : null;
}

const ADVERB_NOUNS = new Set(['home']);

function nextNonAdverb(c, k) {
  let j = k;
  while (
    (has(c.at(j), 'adv') && !has(c.at(j), 'verb')) ||
    has(c.at(j), 'neg')
  ) {
    j += 1;
  }
  return c.at(j);
}

/**
 * Parse adverbials and objects after the verb.
 * @returns {{objects: object[], mods: object[], complement: object|null}}
 */
export function parseTail(c, frame, options = {}) {
  const takes = options.takes || [];
  const out = { objects: [], mods: [], complement: null, xcomp: null };
  for (let guard = 0; guard < 20 && c.peek && !isPunct(c.peek); guard += 1) {
    const t = c.peek;
    if (has(t, 'coord') || (has(t, 'subord') && !has(t, 'prep'))) {
      break;
    }
    if (has(t, 'wh') && out.objects.length + out.mods.length > 0) {
      break;
    }
    if (frame === 'copula' && !out.complement) {
      if (has(t, 'adj') && !nounAhead(c, 1)) {
        c.next();
        out.complement = {
          type: 'adj',
          ...head(t, reading(t, 'adj')),
          comparative: Boolean(reading(t, 'adj').features.degree),
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
    if (toVerb && (options.infinitive || !has(c.at(1), 'noun')) && !out.xcomp) {
      c.next();
      const v = c.next();
      const r = reading(v, 'verb');
      const sub = parseTail(c, 'event', {
        ...options,
        takes: options.takesOf?.(r) || [],
        infinitive: options.infinitiveOf?.(r),
      });
      out.xcomp = { verb: head(v, r), ...sub };
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
    if (
      has(t, 'adv') &&
      (!has(t, 'noun') || bareAdverb) &&
      !(has(t, 'adj') && frame === 'copula')
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

export function timeAhead(c) {
  const t = c.at(1);
  return Boolean(
    t && reading(t, 'noun')?.concepts.some((id) => TIME_NOUNS.test(id))
  );
}

function isTimeNP(np) {
  return Boolean(
    np.head &&
    (np.det === 'det.every' ||
      np.det === 'det.each' ||
      np.adjs?.some((a) => a.lemma === 'last' || a.lemma === 'next')) &&
    np.head.candidates.some((id) => TIME_NOUNS.test(id))
  );
}

export { Cursor, has, reading, isPunct, startsNP, head };
