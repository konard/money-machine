/** Soft semantic evidence from other dictionary meanings in the clause. */
const stem = (w) => w.replace(/ies$/, 'y').replace(/s$/, '');

export function dictionaryContext(node, concept, heads, lexicon) {
  if (!concept?.domain || !concept.cues?.length) {
    return 0;
  }
  const alternatives = node.candidates.map(
    (id) => new Set((lexicon.get(id)?.cues || []).map(stem))
  );
  const distinctive = concept.cues
    .map(stem)
    .filter(
      (cue) =>
        cue.length > 3 &&
        alternatives.filter((set) => set.has(cue)).length <=
          Math.max(1, alternatives.length / 2)
    );
  let shared = 0;
  for (const { node: other } of heads) {
    if (other === node || other.pos !== 'noun') {
      continue;
    }
    const senses = other.candidates
      .map((id) => lexicon.get(id))
      .filter(Boolean);
    const representative = senses.find((s) => s.core) || senses[0];
    const cues = new Set((representative?.cues || []).map(stem));
    shared += distinctive.some((cue) => cues.has(cue)) ? 1 : 0;
  }
  return Math.min(0.4, shared * 0.2);
}

/** Compare verb–object association per noun occurrence, rather than raw counts. */
export function nounObjectContext(node, concept, heads, lexicon) {
  if (node.pos !== 'noun' || !Number.isFinite(concept?.ruFrequency)) {
    return 0;
  }
  const lemma = concept.ru?.compound?.head || concept.ru?.lemma;
  let best = 0;
  for (const { node: verb, parent } of heads) {
    if (verb.pos !== 'verb' || !parent?.objects?.some((o) => o.head === node)) {
      continue;
    }
    const candidates = verb.candidates
      .map((id) => lexicon.get(id))
      .filter((c) => c?.core && !c.related && !c.synonymAlternative);
    for (const c of candidates) {
      const count = c.objectFrequency?.[lemma];
      if (!Number.isFinite(count)) {
        continue;
      }
      const supported = Math.max(0, count - Math.sqrt(count));
      best = Math.max(
        best,
        Math.min(
          0.6,
          0.2 *
            Math.log10(
              1 + (1000 * supported) / Math.max(1, concept.ruFrequency)
            )
        )
      );
    }
  }
  return best;
}
