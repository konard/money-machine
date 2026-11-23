/** A headline can omit present be before a predicate adjective. */
import { has } from './token-readings.mjs';
import { nounAhead } from './predicate-adjectives.mjs';
import { parseTail } from './parser.mjs';
import { clause } from './clause-node.mjs';

export function headlineCopula(c, ctx, subject) {
  if (!has(c.peek, 'adj') || has(c.peek, 'prep') || nounAhead(c, 1)) {
    return null;
  }
  const save = c.i;
  const tail = parseTail(c, 'copula', ctx);
  if (tail.complement) {
    return clause(
      'declarative',
      {
        frame: 'copula',
        verb: { pos: 'verb', lemma: 'be', concept: 'be', candidates: ['be'] },
        adverbs: [],
        tense: 'present',
        aspect: 'simple',
        polarity: 'positive',
      },
      { subject, ...tail }
    );
  }
  c.i = save;
  return null;
}

/** "low, median, high": every item of the list to its end is an adjective. */
export function adjectiveListAhead(c, k) {
  const rest = c.tokens.slice(c.i + k);
  const end = rest.findIndex((x) => [':', ';', '.', ')'].includes(x.text));
  const list = end < 0 ? rest : rest.slice(0, end);
  return (
    list.length > 2 &&
    list.every((x, i) =>
      i % 2 ? x.text === ',' || has(x, 'coord') : has(x, 'adj')
    ) &&
    list.length % 2 === 1
  );
}
