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
