/**
 * English tokenizer and morphological analyzer.
 *
 * New in this copy: Formal AI's JS pipeline matches whole surface strings,
 * so "went", "banks" or "children" never reach the lexeme for "go", "bank"
 * or "child". Here every token gets all of its readings (part of speech,
 * lemma, features); the parser picks the one that fits the clause.
 */

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

const WORD = /[A-Za-z]+(?:-[A-Za-z]+)*|\d+(?:[.,]\d+)*|'[a-z]+|[^\sA-Za-z\d]/g;

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
    for (const piece of raw.match(WORD) || []) {
      push(
        piece,
        /^\d/.test(piece)
          ? 'number'
          : /^[A-Za-z']/.test(piece)
            ? 'word'
            : 'punct'
      );
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
  if (token.kind === 'number') {
    add('num', w, { value: Number(w.replace(/,/g, '')) });
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
    add('indef', w, {}, [INDEFINITES[w]]);
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
  contentReadings(token, lexicon, add);
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
  const capitalized = /^[A-Z]/.test(token.text);
  const names = lexicon.lookup('name', w);
  if (names.length && capitalized) {
    add('name', w, { number: 'sg' }, names);
  }
  for (const pos of ['noun', 'verb', 'adj', 'adv']) {
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
  if (capitalized && !token.first && !names.length && w !== 'i') {
    add('propn', token.text, { number: 'sg' });
  }
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
  const tokens = tokenize(sentence);
  const firstWord = tokens.findIndex((t) => t.kind !== 'punct');
  const out = tokens.map((t, i) => {
    const token = { ...t, first: i === firstWord };
    token.readings = readings(token, lexicon);
    return token;
  });
  // "what's", "it's", "there's", "that's": the clitic is "is"
  out.forEach((token, i) => {
    const previous = out[i - 1];
    if (
      token.lower === "'s" &&
      previous &&
      (['wh', 'pron', 'there'].some((p) =>
        previous.readings.some((r) => r.pos === p)
      ) ||
        ['that', 'this', 'here'].includes(previous.lower))
    ) {
      token.readings = token.readings.filter((r) => r.pos === 'be');
    }
  });
  return out;
}
