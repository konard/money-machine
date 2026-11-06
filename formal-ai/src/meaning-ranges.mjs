/** Ranges are alternatives left open by grammar, not score ties. */
import { glossWords } from './sources/sense-data.mjs';
import { methodWeight } from './methods.mjs';

/** Content features shared by the forward and reverse dictionary evidence. */
export function meaningFeatures(concept) {
  const lemma = concept.en?.[0]?.lemma || '';
  return glossWords(
    `${concept.gloss || ''} ${concept.definition || ''}`,
    lemma
  );
}

/** Jaccard penalizes both uncovered source meanings and added target meanings. */
export function rangeOverlap(source, target) {
  const a = new Set(source);
  const b = new Set(target);
  if (!a.size || !b.size) {
    return null; // Missing evidence is not a demonstrated mismatch.
  }
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / new Set([...a, ...b]).size;
}

function verbOwner(tree, node) {
  if (!tree || typeof tree !== 'object') {
    return null;
  }
  if (tree.verb === node) {
    return tree;
  }
  for (const [key, value] of Object.entries(tree)) {
    if (key !== 'candidates') {
      const owner = verbOwner(value, node);
      if (owner) {
        return owner;
      }
    }
  }
  return null;
}

/** Narrow only on explicit grammatical contradictions; priors cannot erase senses. */
export function contextualRange(node, clause, lexicon) {
  const owner = node.pos === 'verb' && verbOwner(clause, node);
  const direct = owner?.objects?.some((o) => !o.marker);
  const compatible = node.candidates.filter((id) => {
    const frames = lexicon.get(id)?.frames || [];
    return !(
      (direct || owner?.passive) &&
      frames.includes('intransitive') &&
      !frames.includes('transitive')
    );
  });
  // An incomplete dictionary must not erase a word from the meta language.
  return compatible.length ? compatible : [...node.candidates];
}

/** Set the source range before adding any reverse evidence (no circular vote). */
export function scoreRanges(node, clause, lexicon, scores, evidence, methods) {
  node.range = contextualRange(node, clause, lexicon);
  const source = node.range.flatMap((id) =>
    meaningFeatures(lexicon.get(id) || {})
  );
  const weight = methodWeight(methods, 'rangeOverlap');
  for (const id of node.candidates) {
    const overlap = rangeOverlap(source, lexicon.get(id)?.englishRange || []);
    if (overlap === null || !weight) {
      continue;
    }
    const score = overlap * weight;
    scores[id] = Number((scores[id] + score).toFixed(2));
    evidence[id].push(
      `rangeOverlap Jaccard ${overlap.toFixed(3)} (+${score.toFixed(2)})`
    );
  }
}

/** Scalar concept links retain their existing shape; the range is a sibling. */
export function rangeLink(node, key = 'candidates') {
  const candidates = node?.range || node?.candidates;
  return candidates?.length ? { [key]: [...candidates] } : {};
}
