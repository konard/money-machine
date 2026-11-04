/** Prefer the matching periodic adjective over derivation from a time-unit noun. */
export function periodicAdverb(concept, lexicon) {
  const adv = concept?.ru;
  if (
    !adv?.regular ||
    !/\b(?:every|each|once an?)\b/.test(concept.gloss || '')
  ) {
    return adv;
  }
  const lemma = concept.en?.find((e) => e.pos === 'adv')?.lemma;
  const adjective = lexicon
    .lookup('adj', lemma || '')
    .map((id) => lexicon.get(id))
    .find((a) => a.gloss === concept.gloss && a.ru?.shortForms?.n);
  return adjective ? { ...adv, lemma: adjective.ru.shortForms.n } : adv;
}
