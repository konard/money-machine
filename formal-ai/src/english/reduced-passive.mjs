/**
 * Headline-style passives: "Payment received.", "No minimum stated.",
 * "All taxes included." — a common noun followed only by a transitive
 * verb's past participle and nothing it could take as an object is
 * a passive statement with "is/are" left out.
 */

import { has, personLike } from './token-readings.mjs';

const transitive = (verb, lexicon) => {
  const frames = (verb.candidates || []).map(
    (id) => lexicon?.get(id)?.frames || []
  );
  // no sense is intransitive only ("arrived", "grew" stay active)
  return (
    frames.length > 0 &&
    (frames.some((f) => f.includes('transitive')) ||
      !frames.some((f) => f.includes('intransitive')))
  );
};

// headlines drop articles: "Payment received", "No fee charged"; "The bank
// closed" is an ordinary past
const QUANTIFIERS = new Set(['det.no', 'det.all', 'det.every', 'det.each']);
const headline = (np) =>
  np.det ? QUANTIFIERS.has(np.det) : np.def !== 'def' && np.def !== 'indef';

/** Turn a clause into a present passive when it reads as a headline. */
export function reducedPassive(c, result, lexicon) {
  const vg = result.verb;
  const token = vg && c.tokens[vg.token];
  if (
    !token ||
    result.passive ||
    result.modal ||
    result.tense !== 'past' ||
    result.objects.length ||
    result.complement ||
    (result.xcomp && !result.mods.some((m) => m.type === 'pp')) ||
    result.finiteLink ||
    !result.subject?.head ||
    result.subject.pronoun ||
    result.subject.name ||
    !headline(result.subject) ||
    personLike(result.subject, lexicon) ||
    !token.readings.some(
      (r) => r.pos === 'verb' && /pp/.test(r.features?.form || '')
    ) ||
    // the clause ends here: "Payment received." / "…received today."
    (c.peek && !/^[.!;:)]$/.test(c.peek.text) && !has(c.peek, 'coord')) ||
    !transitive(vg, lexicon)
  ) {
    return result;
  }
  return {
    ...result,
    passive: true,
    tense: 'present',
    ...(result.xcomp ? { xcomp: { ...result.xcomp, purpose: true } } : {}),
  };
}
