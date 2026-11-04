/** Russian → the same statement/entity meta schema as formalize.mjs. */
import { tokenizeRussian } from './tokenizer.mjs';
import { analyzerIndex, readings } from './morphology.mjs';
import { parseClause } from './clause.mjs';
import { CONJUNCTIONS } from '../words.mjs';
import { has } from './phrase.mjs';
import { naturalizeRussian } from '../naturalize.mjs';
import { compareMeta } from '../../english/round-trip.mjs';
import { indexRussianNames } from '../read-back.mjs';
export { analyzerIndex } from './morphology.mjs';
export { tokenizeRussian } from './tokenizer.mjs';

const punctuation = (t) => /^[,;:.!?—–()-]$/.test(t.text);
const finite = (t) =>
  has(t, (r) => r.pos === 'verb' && (r.tense || r.mood === 'imperative'));
const zeroPredicate = (tokens) => {
  const subject = tokens.findIndex((t) =>
    has(t, (r) => (r.pronoun || r.pos === 'noun') && r.case === 'nom')
  );
  return (
    subject >= 0 &&
    tokens.some((t, i) => i > subject && has(t, (r) => r.pos === 'adj'))
  );
};

function clauses(tokens, ctx, options = {}) {
  // Remove comma-delimited relative clauses only after parsing them. The
  // antecedent's token carries the result into its independently parsed NP.
  for (let i = 1; i < tokens.length; i += 1) {
    if (!has(tokens[i], (r) => r.pos === 'relative')) {
      continue;
    }
    const begin = tokens[i - 1]?.text === ',' ? i - 1 : i;
    let end = tokens.findIndex((t, j) => j > i && t.text === ',');
    if (end < 0) {
      end = tokens.length;
    }
    const antecedent = tokens[begin - 1];
    if (!antecedent) {
      continue;
    }
    const inner = tokens.slice(i, end);
    const relative = parseClause(
      inner.filter((t) => !punctuation(t)),
      ctx,
      { antecedent }
    );
    antecedent.relative = relative;
    // Subject relatives agree with the antecedent, not with an arbitrary
    // case-syncretic reading of который.
    const number = relative.subject?.relativePronoun
      ? relative.subject.number
      : relative.objects?.find((e) => e.relativePronoun)?.number;
    if (number) {
      antecedent.relativeNumber = number;
    }
    tokens.splice(begin, Math.min(tokens.length - begin, end - begin + 1));
    i = begin;
  }
  const cuts = [];
  const conjunctions = Object.entries(CONJUNCTIONS).sort(
    (a, b) => b[1].text.length - a[1].text.length
  );
  for (let i = 0; i < tokens.length; i += 1) {
    const match = conjunctions.find(([, v]) =>
      v.text.split(' ').every((w, j) => tokens[i + j]?.lower === w)
    );
    const link = match?.[0];
    const length = match?.[1].text.split(' ').length || 1;
    const right = tokens.slice(i + length);
    const zeroCopula = zeroPredicate(right);
    if (
      !link ||
      (!tokens.slice(0, i).some(finite) &&
        !zeroPredicate(tokens.slice(0, i))) ||
      (!right.some(finite) && !zeroCopula)
    ) {
      continue;
    }
    const rightVerb = tokens.findIndex((t, j) => j >= i + length && finite(t));
    const hasSubject = tokens
      .slice(i + length, rightVerb < 0 ? tokens.length : rightVerb)
      .some((t) =>
        has(t, (r) => (r.pos === 'noun' || r.pronoun) && r.case === 'nom')
      );
    if (
      hasSubject ||
      finite(tokens[i + length]) ||
      (tokens[i + length]?.lower === 'не' && finite(tokens[i + length + 1]))
    ) {
      cuts.push({ at: i, link, length });
      i += length - 1;
    }
  }
  const result = [];
  let start = 0;
  let link;
  for (const cut of [...cuts, { at: tokens.length }]) {
    const chunk = tokens.slice(start, cut.at).filter((t) => !punctuation(t));
    if (chunk.length) {
      const s = parseClause(chunk, ctx, options);
      if (link) {
        s.link = link;
      }
      if (!s.subject && result.at(-1)?.subject) {
        s.subject = { ...result.at(-1).subject, implicit: true };
      }
      result.push(s);
    }
    tokens
      .slice(cut.at, cut.at + (cut.length || 0))
      .forEach((t) => ctx.used.add(t));
    start = cut.at + (cut.length || 0);
    link = cut.link;
  }
  return result;
}

export function analyzeRussian(sentence, lexicon, options = {}) {
  const index = options.index || analyzerIndex(lexicon);
  indexRussianNames(index, lexicon);
  const tokens = readings(tokenizeRussian(sentence), index);
  const ctx = { lexicon, used: new Set() };
  const statements = [];
  let start = 0;
  for (let i = 0; i <= tokens.length; i += 1) {
    if (i < tokens.length && !/^[.!?]$/.test(tokens[i].text)) {
      continue;
    }
    const chunk = tokens.slice(start, i);
    const text = chunk.map((t) => t.lower).join(' ');
    const phrase = [...lexicon.concepts].find(
      ([, c]) =>
        c.ru?.pos === 'phrase' &&
        tokenizeRussian(c.ru.text)
          .filter((t) => !punctuation(t))
          .map((t) => t.lower)
          .join(' ') === text
    );
    if (phrase) {
      statements.push({ type: 'phrase', concept: phrase[0] });
      chunk.forEach((t) => ctx.used.add(t));
    } else if (chunk.length) {
      statements.push(
        ...clauses(chunk, ctx, { question: tokens[i]?.text === '?' })
      );
    }
    start = i + 1;
  }
  const unparsed = tokens.filter((t) => !punctuation(t) && !ctx.used.has(t));
  return {
    sentence,
    statements,
    punctuation: sentence.match(/[.!?]$/)?.[0] || '',
    senses: [],
    unknown: unparsed.filter((t) => !t.readings.length).map((t) => t.text),
    leftover: unparsed.map((t) => t.text),
  };
}

export function russianRoundTrip(text, lexicon, options = {}) {
  const index = options.index || analyzerIndex(lexicon);
  const before = analyzeRussian(text, lexicon, { ...options, index });
  const secondPerson = before.statements.find(
    (s) => s.subject?.pronoun?.person === 2
  )?.subject;
  const speaker = before.statements.find(
    (s) => s.subject?.pronoun?.person === 1
  )?.subject;
  let russian;
  let generationError;
  try {
    russian = naturalizeRussian(before, lexicon, {
      ...(secondPerson?.number === 'singular' ? { you: 'ty' } : {}),
      ...(speaker?.pronoun?.gender === 'feminine'
        ? { speakerGender: 'f' }
        : {}),
      ...(secondPerson?.pronoun?.gender === 'feminine'
        ? { addresseeGender: 'f' }
        : {}),
      ...options,
    }).text;
  } catch (error) {
    // Malformed/incomplete public entries must be measurable failures,
    // never silently successful round trips of an empty analysis.
    generationError = error.message;
  }
  const after =
    russian === undefined
      ? { statements: [], unknown: [], leftover: [generationError] }
      : analyzeRussian(russian, lexicon, { ...options, index });
  const differences = compareMeta(before, after);
  const complete =
    before.statements.length > 0 &&
    !before.unknown.length &&
    !before.leftover.length &&
    !after.unknown.length &&
    !after.leftover.length;
  return {
    russian,
    before,
    after,
    differences,
    exact: !differences.length,
    complete,
    ...(generationError ? { generationError } : {}),
  };
}
