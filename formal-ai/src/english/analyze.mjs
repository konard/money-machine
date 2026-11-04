/**
 * English tokenizer and morphological analyzer.
 *
 * New in this copy: Formal AI's JS pipeline matches whole surface strings,
 * so "went", "banks" or "children" never reach the lexeme for "go", "bank"
 * or "child". Here every token gets all of its readings (part of speech,
 * lemma, features); the parser picks the one that fits the clause.
 */

import { currencyTokens } from './quantity.mjs';
import { IDENTIFIER, isIdentifier } from './identifiers.mjs';

import {
  PRONOUNS,
  POSSESSIVES,
  DETERMINERS,
  NUMBERS,
  PREPOSITIONS,
  SUBORDINATORS,
  COORDINATORS,
  WH_WORDS,
  BE,
  HAVE,
  DO,
  MODALS,
  NEGATORS,
  CONTRACTIONS,
  INDEFINITES,
} from './function-words.mjs';

// "$1k–$20k", "~$50", "10-15%", "£6": one quantity, kept as written
const AMOUNT = '~?\\p{Sc}?\\d+(?:[.,]\\d+)*(?:[kKmMbB](?![a-z]))?%?\\+?';
const QUANTITY = new RegExp(
  `^(?:~|\\p{Sc}\\d|\\d+(?:[.,]\\d+)*(?:%|\\+|[kKmMbB](?![a-z])|[–-]\\d))`,
  'u'
);
const WORD = new RegExp(
  `${IDENTIFIER}|${AMOUNT}(?:[–-]${AMOUNT})?|\\p{Lu}/\\p{Lu}(?:-\\p{L}+)?(?![\\p{L}\\d])|\\p{Ll}(?:\\.\\p{Ll})+\\.|\\p{L}+(?:\\d+\\p{L}*)*(?:[.-]\\p{L}+(?:\\d+\\p{L}*)*)*|\\d+(?:[.,]\\d+)*|'[a-z]+|[^\\s\\p{L}\\d]`,
  'gu'
);

/**
 * Split a sentence into tokens, expanding contractions.
 * @param {string} sentence
 * @returns {{text: string, lower: string, index: number, kind: string}[]}
 */
export function tokenize(sentence) {
  const text = sentence.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const out = [];
  const push = (t, kind) => out.push({ text: t, lower: t.toLowerCase(), kind });
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const lower = raw.toLowerCase().replace(/[.,!?;:"]+$/, '');
    const rest = raw.slice(lower.length);
    if (CONTRACTIONS[lower]) {
      const caps = raw[0] !== raw[0].toLowerCase();
      CONTRACTIONS[lower].forEach((w, i) =>
        push(i === 0 && caps ? w[0].toUpperCase() + w.slice(1) : w, 'word')
      );
      splitRest(rest, push);
      continue;
    }
    const m = /^(.*[a-z])(n't|'s|'m|'re|'ve|'ll|'d|')$/i.exec(
      raw.slice(0, lower.length)
    );
    if (m && m[1].length > 0) {
      push(m[1], 'word');
      push(m[2].toLowerCase(), 'clitic');
      splitRest(rest, push);
      continue;
    }
    if (raw === '+') {
      push(raw, 'word');
      continue;
    }
    for (const piece of raw.match(WORD) || []) {
      push(
        piece,
        isIdentifier(piece)
          ? 'identifier'
          : QUANTITY.test(piece) && !/^\d+(?:,\d{3})*$/.test(piece)
            ? 'quantity'
            : /^\d/.test(piece)
              ? 'number'
              : /^[\p{L}']/u.test(piece)
                ? 'word'
                : 'punct'
      );
    }
  }
  // Standards written as an acronym and number form one identifier.
  for (let i = out.length - 2; i >= 0; i -= 1) {
    if (/^[A-Z]{2,}$/.test(out[i].text) && out[i + 1].kind === 'number') {
      const text = `${out[i].text} ${out[i + 1].text}`;
      out.splice(i, 2, { text, lower: text.toLowerCase(), kind: 'identifier' });
    }
  }
  // "$150-400/month" → "$150-400 per month"; "£6/$6" stays one quantity
  for (let i = out.length - 2; i > 0; i -= 1) {
    if (out[i].text === '/' && out[i - 1].kind === 'quantity') {
      if (out[i + 1].kind === 'word') {
        out[i] = { text: 'per', lower: 'per', kind: 'word' };
      } else if (/quantity|number/.test(out[i + 1].kind)) {
        const text = `${out[i - 1].text}/${out[i + 1].text}`;
        out.splice(i - 1, 3, { text, lower: text, kind: 'quantity' });
      }
    } else if (
      // "tax/payment setup": alternatives written with a slash
      out[i].text === '/' &&
      ['word', 'identifier'].includes(out[i - 1].kind) &&
      out[i + 1].kind === 'word' &&
      // both common words or both names: "tax/payment", "US/UK"
      // (the first may open the sentence: "Low/none")
      (out[i - 1].kind === 'identifier' ||
        (new RegExp(
          `^[\\p{Ll}${i === 1 ? '\\p{Lu}' : ''}][\\p{Ll}-]+$`,
          'u'
        ).test(out[i - 1].text) &&
          /^\p{Ll}[\p{Ll}-]+$/u.test(out[i + 1].text)) ||
        (/^\p{Lu}/u.test(out[i - 1].text) &&
          /^\p{Lu}[\p{L}\d]+$/u.test(out[i + 1].text))) &&
      ![out[i - 1].lower, out[i + 1].lower].some((w) =>
        ['and', 'or'].includes(w)
      )
    ) {
      out[i] = { text: 'or', lower: 'or', kind: 'word', slash: true };
    } else if (
      // "2/10", "24/7": a score or a ratio is one quantity
      out[i].text === '/' &&
      out[i - 1].kind === 'number' &&
      out[i + 1].kind === 'number'
    ) {
      const text = `${out[i - 1].text}/${out[i + 1].text}`;
      out.splice(i - 1, 3, { text, lower: text, kind: 'quantity' });
    }
  }
  return out.map((t, index) => ({ ...t, index }));
}

function splitRest(rest, push) {
  for (const ch of rest) {
    push(ch, 'punct');
  }
}

const SIBILANT = /(s|x|z|ch|sh|o)$/;

/** Candidate base forms for an inflected English word. */
function stems(word) {
  const out = [];
  const add = (lemma, feature) => out.push({ lemma, feature });
  if (word.endsWith('ies') && word.length > 4) {
    add(`${word.slice(0, -3)}y`, 's');
  }
  if (word.endsWith('es') && SIBILANT.test(word.slice(0, -2))) {
    add(word.slice(0, -2), 's');
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    add(word.slice(0, -1), 's');
  }
  if (word.endsWith('ied') && word.length > 4) {
    add(`${word.slice(0, -3)}y`, 'ed');
  }
  if (word.endsWith('ed') && word.length > 3) {
    const base = word.slice(0, -2);
    add(base, 'ed');
    add(`${base}e`, 'ed');
    if (/([bdgklmnprt])\1$/.test(base)) {
      add(base.slice(0, -1), 'ed');
    }
  }
  if (word.endsWith('ing') && word.length > 4) {
    const base = word.slice(0, -3);
    add(base, 'ing');
    add(`${base}e`, 'ing');
    if (/([bdgklmnprt])\1$/.test(base)) {
      add(base.slice(0, -1), 'ing');
    }
    if (base.endsWith('y')) {
      add(`${base.slice(0, -1)}ie`, 'ing');
    }
  }
  if (word.endsWith('er') && word.length > 3) {
    const base = word.slice(0, -2);
    add(base, 'er');
    add(`${base}e`, 'er');
    if (/([bdgmnpt])\1$/.test(base)) {
      add(base.slice(0, -1), 'er');
    }
  }
  return out;
}

/**
 * Every reading of a token.
 * @param {object} token
 * @param {import('../lexicon.mjs').Lexicon} lexicon
 * @returns {object[]} readings `{pos, lemma, features, concepts}`
 */
export function readings(token, lexicon) {
  const w = token.lower;
  const out = [];
  const add = (pos, lemma, features = {}, concepts = []) =>
    out.push({ pos, lemma, features, concepts });
  if (token.kind === 'punct') {
    add('punct', token.text);
    return out;
  }
  if (token.kind === 'identifier') {
    add('propn', token.text, { number: 'sg', opaque: true });
    return out;
  }
  if (token.kind === 'quantity') {
    add('propn', token.text, { number: 'sg', opaque: true, quantity: true });
    return out;
  }
  if (token.kind === 'number') {
    add('num', w, { value: Number(w.replace(/,/g, '')) });
    return out;
  }
  const currency = lexicon
    .lookup('noun', w)
    .filter((id) => lexicon.get(id)?.classes?.includes('currency'));
  if (currency.length) {
    add('noun', w, { number: 'sg' }, currency);
    return out;
  }
  // "US", "KYC", "MRR": an acronym is a name, never the pronoun "us"
  if (/^[A-Z][A-Z0-9]+s?$/.test(token.text) && !token.shouting) {
    add('propn', token.text, { number: 'sg', acronym: true });
    return out;
  }
  if (w === "n't" || NEGATORS.has(w)) {
    add('neg', w === 'never' ? 'never' : 'not');
  }
  if (w === "'s") {
    add('be', 'be', BE.is);
    add('have', 'have', HAVE.has);
    add('poss-clitic', "'s");
    return out;
  }
  if (w === "'") {
    add('poss-clitic', "'s");
    return out;
  }
  if (w === 'to') {
    add('to', 'to');
  }
  if (w === 'there') {
    add('there', 'there');
  }
  if (PRONOUNS[w] && !(w === 'her' && false)) {
    add('pron', w, PRONOUNS[w]);
  }
  if (INDEFINITES[w]) {
    add('indef', w, { number: w === 'others' ? 'pl' : 'sg' }, [INDEFINITES[w]]);
  }
  if (POSSESSIVES[w]) {
    add('poss', w, POSSESSIVES[w]);
  }
  if (DETERMINERS[w]) {
    add('det', w, DETERMINERS[w]);
  }
  if (NUMBERS[w] !== undefined) {
    add('num', w, { value: NUMBERS[w] });
  }
  if (PREPOSITIONS[w]) {
    add('prep', w, {}, [PREPOSITIONS[w]]);
  }
  if (SUBORDINATORS[w]) {
    add('subord', w, {}, [SUBORDINATORS[w]]);
  }
  if (COORDINATORS[w]) {
    add('coord', w, {}, [COORDINATORS[w]]);
  }
  if (WH_WORDS[w]) {
    add('wh', w, WH_WORDS[w], [WH_WORDS[w].concept]);
  }
  if (BE[w]) {
    add('be', 'be', BE[w]);
  }
  if (HAVE[w]) {
    add('have', 'have', HAVE[w]);
  }
  if (DO[w]) {
    add('do', 'do', DO[w]);
  }
  if (MODALS[w]) {
    add('modal', w, MODALS[w]);
  }
  // Capitalization never turns a grammatical negator into a name.
  if (!out.some((r) => r.pos === 'neg')) {
    const grammatical = out.length > 0;
    contentReadings(token, lexicon, add);
    // "Do you…": a grammatical word starting a sentence is no name
    if (grammatical && token.first) {
      return out.filter((r) => r.pos !== 'propn');
    }
  }
  return out;
}

/** Placeholder for inline code, links and URLs kept out of translation. */
export const PLACEHOLDER = /^Xp[ch][a-j]+Q$/;

function contentReadings(token, lexicon, add) {
  const w = token.lower;
  if (PLACEHOLDER.test(token.text)) {
    add('propn', token.text, { number: 'sg', opaque: true });
    return;
  }
  if (lexicon.foreignWords?.has(token.text) && !contentFound(lexicon, w)) {
    add('propn', token.text, { number: 'sg', foreign: true });
    return;
  }
  const capitalized = /^\p{Lu}/u.test(token.text);
  // a capitalized word with a known name label is that name (Google,
  // Apple) — unless it names a time: "January" is a given name too
  const timeWord = [
    w,
    ...lexicon
      .irregular(w)
      .filter((r) => r.pos === 'noun')
      .map((r) => r.lemma),
  ].some((lemma) =>
    lexicon
      .lookup('noun', lemma)
      .some((id) => lexicon.get(id)?.classes?.includes('time'))
  );
  if (
    capitalized &&
    !timeWord &&
    !token.notName &&
    // "Edit the JSON": a verb opening a sentence before a determiner is an
    // order, not the given name Edit
    !(
      token.first &&
      token.beforeDeterminer &&
      lexicon.lookup('verb', w).length
    ) &&
    // "Profit is tiny … the profit": a sentence-opening given name the
    // document also writes in lowercase is that common word
    ((lexicon.givenNames?.has(token.text) &&
      lexicon.nameLabel?.(token.text) &&
      !(token.first && lexicon.documentWords?.has(w))) ||
      (!token.first && lexicon.nameLabel?.(token.text)) ||
      (token.first &&
        lexicon.documentNames?.has(token.text) &&
        !(token.nominalStart && lexicon.lookup('adj', w).length) &&
        !lexicon.lookup('name', w).length))
  ) {
    add('propn', token.text, { number: 'sg' });
    return;
  }
  const names = lexicon.lookup('name', w);
  if (names.length && capitalized) {
    add('name', w, { number: 'sg' }, names);
  }
  for (const pos of ['noun', 'verb', 'adj', 'adv', 'postp']) {
    const direct = lexicon.lookup(pos, w);
    if (direct.length) {
      const features =
        pos === 'noun'
          ? { number: 'sg' }
          : pos === 'verb'
            ? { form: 'base' }
            : {};
      add(pos, w, features, direct);
    }
  }
  for (const irr of lexicon.irregular(w)) {
    const concepts = lexicon.lookup(irr.pos, irr.lemma);
    if (irr.feature === 'plural') {
      add('noun', irr.lemma, { number: 'pl' }, concepts);
    } else if (irr.feature === 'past') {
      add('verb', irr.lemma, { form: 'past' }, concepts);
    } else if (irr.feature === 'participle') {
      add('verb', irr.lemma, { form: 'pp' }, concepts);
    }
  }
  for (const { lemma, feature } of stems(w)) {
    if (feature === 's') {
      const nouns = lexicon.lookup('noun', lemma);
      if (nouns.length && !hasIrregularPlural(lexicon, nouns, lemma)) {
        add('noun', lemma, { number: 'pl' }, nouns);
      }
      const verbs = lexicon.lookup('verb', lemma);
      if (verbs.length) {
        add('verb', lemma, { form: '3sg' }, verbs);
      }
    } else if (feature === 'ed' || feature === 'ing') {
      const verbs = lexicon.lookup('verb', lemma);
      if (
        verbs.length &&
        !(feature === 'ed' && hasIrregularPast(lexicon, verbs, lemma))
      ) {
        add(
          'verb',
          lemma,
          { form: feature === 'ed' ? 'past|pp' : 'ing' },
          verbs
        );
      }
    } else if (feature === 'er') {
      const adjs = lexicon.lookup('adj', lemma);
      if (adjs.length) {
        add('adj', lemma, { degree: 'comparative' }, adjs);
      }
    }
  }
  // a capitalized word that is nothing else is a name, even first
  // in the sentence ("PayPal, Payoneer…")
  // "eBay", "iOS", "pre-May": mixed case marks a name
  if (!capitalized && /[A-Z]/.test(token.text) && !contentFound(lexicon, w)) {
    add('propn', token.text, { number: 'sg' });
    return;
  }
  if (
    capitalized &&
    !names.length &&
    w !== 'i' &&
    (!token.first || !contentFound(lexicon, w))
  ) {
    add('propn', token.text, { number: 'sg' });
    return;
  }
  // a word in letters English does not use ("társaság", "honorários") is
  // foreign: it is kept as written, like a name
  if (/[^a-z'-]/.test(w) && !contentFound(lexicon, w)) {
    add('propn', token.text, { number: 'sg', foreign: true });
  }
}

/** Has the lexicon any content reading of this word (or its stems)? */
function contentFound(lexicon, w) {
  return (
    ['noun', 'verb', 'adj', 'adv'].some(
      (pos) => lexicon.lookup(pos, w).length
    ) ||
    lexicon.irregular(w).length > 0 ||
    stems(w).some(({ lemma }) =>
      ['noun', 'verb', 'adj'].some((pos) => lexicon.lookup(pos, lemma).length)
    )
  );
}

function hasIrregularPlural(lexicon, ids, lemma) {
  return ids.every((id) =>
    lexicon
      .get(id)
      .en.some((e) => e.pos === 'noun' && e.lemma === lemma && e.plural)
  );
}

function hasIrregularPast(lexicon, ids, lemma) {
  return ids.every((id) =>
    lexicon
      .get(id)
      .en.some((e) => e.pos === 'verb' && e.lemma === lemma && e.past)
  );
}

/**
 * Tokenize and analyze a sentence.
 * @param {string} sentence
 * @param {import('../lexicon.mjs').Lexicon} lexicon
 */
export function analyze(sentence, lexicon) {
  // A spaced plus joins peers; a suffix in "100+" belongs to the count.
  const tokens = currencyTokens(tokenize(sentence), lexicon).map((t) =>
    t.text === '+' && t.kind === 'word' ? { ...t, lower: 'and' } : t
  );
  const firstWord = tokens.findIndex((t) => t.kind !== 'punct');
  // a sentence in capitals is not a row of acronyms
  const letters = tokens.filter(
    (t) => t.kind === 'word' && /[A-Za-z]{2}/.test(t.text)
  );
  const shouting =
    letters.length > 1 && letters.every((t) => t.text === t.text.toUpperCase());
  const out = tokens.map((t, i) => {
    const token = {
      ...t,
      first: i === firstWord,
      shouting,
      beforeDeterminer: Boolean(
        tokens[i + 1] && DETERMINERS[tokens[i + 1].lower]
      ),
      nominalStart: Boolean(
        tokens[i + 1] && lexicon.lookup('noun', tokens[i + 1].lower).length
      ),
    };
    token.readings = readings(token, lexicon);
    return token;
  });
  // "Very cheap", "Try to join": a sentence-opening dictionary word that is
  // also a given name is that name only before a verb ("Rose went home")
  const opening = out[firstWord];
  const next = out[firstWord + 1];
  if (
    opening?.readings.length === 1 &&
    opening.readings[0].pos === 'propn' &&
    contentFound(lexicon, opening.lower) &&
    !lexicon.documentNames?.has(opening.text) &&
    next?.readings.length &&
    !next.readings.some(
      (r) =>
        ['be', 'modal', 'have', 'do', 'coord', 'punct'].includes(r.pos) ||
        (r.pos === 'verb' && /3sg|past/.test(r.features?.form || ''))
    ) &&
    next.kind !== 'punct'
  ) {
    opening.readings = readings({ ...opening, notName: true }, lexicon);
  }
  out.forEach((token, i) => {
    const previous = out[i - 1];
    if (token.lower === "'s") {
      // 's is "has" only as an auxiliary: "she's done it", "he's got";
      // "Tom's car needs fuel" is no "Tom has car-needs"
      let j = i + 1;
      while (
        out[j] &&
        out[j].readings.length &&
        out[j].readings.every((r) => ['adv', 'neg'].includes(r.pos))
      ) {
        j += 1;
      }
      const participle =
        ['got', 'been'].includes(out[j]?.lower) ||
        out[j]?.readings.some(
          (r) => r.pos === 'verb' && /pp/.test(r.features?.form || '')
        );
      // "what's", "it's", "there's", "that's": no possessive
      const clause =
        previous &&
        (['wh', 'pron', 'there'].some((p) =>
          previous.readings.some((r) => r.pos === p)
        ) ||
          ['that', 'this', 'here'].includes(previous.lower));
      // a participle with an object after it is a perfect: "she's done it"
      const object =
        participle &&
        out[j + 1]?.readings.some((r) => ['pron', 'det'].includes(r.pos));
      token.readings = token.readings.filter(
        (r) =>
          (r.pos === 'have' && participle) ||
          (r.pos === 'be' && !(object || out[j]?.lower === 'got')) ||
          (r.pos === 'poss-clitic' && !clause)
      );
    }
    // only an auxiliary takes "n't": "does" before it is no plural noun
    const auxiliary = token.readings.filter((r) =>
      ['be', 'do', 'modal', 'have'].includes(r.pos)
    );
    if (out[i + 1]?.lower === "n't" && auxiliary.length) {
      token.readings = auxiliary;
    }
  });
  return mergeNumerals(sharedSlashReadings(out));
}

/**
 * "two thousand", "one hundred fifty": number words form one numeral;
 * a round numeral after another is its multiplier.
 */
function mergeNumerals(out) {
  const num = (t) => t?.readings.find((r) => r.pos === 'num')?.features.value;
  for (let i = 0; i < out.length - 1; i += 1) {
    if (num(out[i]) === undefined || out[i].kind !== 'word') {
      continue;
    }
    let value = num(out[i]);
    let j = i + 1;
    while (num(out[j]) !== undefined && out[j].kind === 'word') {
      const next = num(out[j]);
      if (next >= 100 && next > value) {
        value *= next;
      } else if (next < value && value >= 100) {
        value += next;
      } else {
        break;
      }
      j += 1;
    }
    if (j > i + 1) {
      const text = out
        .slice(i, j)
        .map((t) => t.text)
        .join(' ');
      out.splice(i, j - i, {
        ...out[i],
        text,
        lower: text.toLowerCase(),
        readings: [
          { pos: 'num', lemma: text, features: { value }, concepts: [] },
        ],
      });
    }
  }
  return out;
}

function sharedSlashReadings(out) {
  // "low/medium risk": slash alternatives are the same part of speech,
  // so each keeps only the readings the other shares
  out.forEach((token, i) => {
    const [a, b] = [out[i - 1], out[i + 1]];
    if (!token.slash || !a || !b) {
      return;
    }
    const shared = a.readings
      .map((r) => r.pos)
      .filter((p) => b.readings.some((r) => r.pos === p));
    if (shared.length) {
      for (const t of [a, b]) {
        t.readings = t.readings.filter((r) => shared.includes(r.pos));
      }
    }
  });
  return out;
}
