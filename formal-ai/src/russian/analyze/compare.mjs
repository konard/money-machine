/** Exact comparison stays compareMeta; this separately reports range widening. */
import { compareMeta } from '../../english/round-trip.mjs';
const RANGE_FIELDS = new Set([
  'definiteness',
  'number',
  'gender',
  'tense',
  'aspect',
]);
const at = (formal, path) =>
  path.split('.').reduce((value, key) => value?.[key], formal);
export function compareRussianMeta(before, after) {
  const differences = compareMeta(before, after);
  const ranges = [];
  const problems = [];
  for (const difference of differences) {
    const { kind, before: a, after: b, change } = difference;
    // These links encode evidence supplied by Russian morphology, not an
    // additional claim about the English source's aspect/lexical sense.
    if (kind === 'russianAspect' && change === 'added') {
      continue;
    }
    if (
      ['relationRange', 'modalityRange'].includes(kind) &&
      change === 'added'
    ) {
      continue;
    }
    if (['concept', 'predicate', 'candidates'].includes(kind)) {
      const parent = difference.path.replace(
        /\.(?:concept|predicate|candidates)(?:\.\d+)?$/,
        ''
      );
      const source = at(before, parent);
      const read = at(after, parent);
      const wanted =
        source?.candidates ||
        [source?.concept || source?.predicate].filter(Boolean);
      if (
        wanted.length &&
        read?.candidates &&
        wanted.every((id) => read.candidates.includes(id))
      ) {
        ranges.push(difference);
        continue;
      }
    }
    if (kind === 'relation' || kind === 'modality') {
      const parent = at(
        after,
        difference.path.replace(/\.(relation|modality)$/, '')
      );
      if (a && parent?.[`${kind}Range`]?.includes(a)) {
        ranges.push(difference);
        continue;
      }
    }
    if (RANGE_FIELDS.has(kind) && typeof b === 'string') {
      const read = b.split(' ');
      const source = typeof a === 'string' ? a.split(' ') : [];
      if (
        (source.length && source.every((v) => read.includes(v))) ||
        (change === 'added' &&
          kind === 'definiteness' &&
          b === 'definite indefinite')
      ) {
        ranges.push(difference);
        continue;
      }
    }
    problems.push(difference);
  }
  return {
    differences,
    ranges,
    problems,
    exact: !differences.length,
    compatible: !problems.length,
  };
}
