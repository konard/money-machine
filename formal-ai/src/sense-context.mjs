/** Soft semantic evidence from other dictionary meanings in the clause. */
const stem = (w) => w.replace(/ies$/, 'y').replace(/s$/, '');

export function dictionaryContext(node, concept, heads, lexicon) {
  // A membership predicate selects the collective reading of its object,
  // rather than another homonymous meaning (an activity versus software).
  if (
    node.pos === 'noun' &&
    /\b(?:set|series|collection|group) of\b|\b(?:organization|association|society)\b/.test(
      concept?.gloss || ''
    )
  ) {
    const membership = heads.some(
      ({ node: verb, parent }) =>
        verb.pos === 'verb' &&
        parent?.objects?.some(
          (o) => o.head === node || o.items?.some((item) => item.head === node)
        ) &&
        verb.candidates.some((id) =>
          /\b(?:become|be) (?:a )?member of\b/.test(
            lexicon.get(id)?.gloss || ''
          )
        )
    );
    if (membership) {
      return 3;
    }
  }
  if ((!concept?.domain && node.pos !== 'adj') || !concept?.cues?.length) {
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
    const representative =
      senses.find((s) => s.id === other.concept) ||
      senses.find((s) => s.core) ||
      senses[0];
    const cues = new Set((representative?.cues || []).map(stem));
    shared += distinctive.some((cue) => cues.has(cue)) ? 1 : 0;
  }
  return Math.min(
    node.pos === 'adj' ? 1.2 : 0.4,
    shared * (node.pos === 'adj' ? 1.2 : 0.2)
  );
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

/** Membership predicates select collective objects, using dictionary/entity evidence. */
export function membershipContext(concept, owner, lexicon) {
  if (!/\b(?:become|be) (?:a )?member of\b/.test(concept?.gloss || '')) {
    return 0;
  }
  const collective = (np) => {
    if (np?.items) {
      return np.items.some(collective);
    }
    const entity = lexicon.nameEntities?.get(np?.name || np?.head?.text);
    const description = entity?.descriptions?.en?.value || '';
    const senses = (np?.head?.candidates || []).map(
      (id) => lexicon.get(id)?.gloss || ''
    );
    return (
      /\b(?:organization|company|platform|marketplace|community|association)\b/.test(
        description
      ) ||
      senses.some((gloss) =>
        /\b(?:set|series|collection|group) of\b|\b(?:organization|association|society)\b/.test(
          gloss
        )
      )
    );
  };
  return owner?.objects?.some(collective) ? 3 : 0;
}
