/** Nominal fragments use the same noun and adjunct grammar as clauses. */
import { parseLeading } from './leading.mjs';
import { parseNP, parseTail, has } from './parser.mjs';

/** A noun phrase with its prepositional phrases: "direct deposit to bank". */
export function parseFragment(c, ctx) {
  const start = c.i;
  const leading = parseLeading(c);
  // in a phrase without a verb, "contracts" is a noun
  const np = parseNP(c, { fragment: true });
  if (!np) {
    // "on demand after clearance": phrases without a head noun
    const only = has(c.peek, 'prep') && parseTail(c, 'fragment', ctx);
    if (only?.mods?.length && !only.objects?.length && !only.complement) {
      return { type: 'fragment', mods: [...leading, ...only.mods] };
    }
    c.i = start;
    return null;
  }
  const afterNP = c.i;
  const tail = parseTail(c, 'fragment', { ...ctx, takes: [] });
  if (
    tail.objects.length ||
    tail.complement ||
    (tail.xcomp && !tail.xcomp.objects.length)
  ) {
    // a fragment has no objects: leave those words for the next phrase
    c.i = afterNP;
    tail.mods = [];
  } else if (tail.xcomp) {
    // "months to recover costs": the infinitive states the noun's purpose.
    np.purpose = tail.xcomp;
  }
  return {
    type: 'fragment',
    np,
    mods: [...leading, ...tail.mods],
    mood: 'declarative',
  };
}
