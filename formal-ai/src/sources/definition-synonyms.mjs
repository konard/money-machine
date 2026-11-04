/** Empty translation tables can use explicitly named dictionary equivalents. */
import { englishEntries, fetchPages } from './wiktionary.mjs';
import { glossWords } from './sense-data.mjs';

export function definitionSynonyms(sense) {
  const text = (sense.definition || '').replace(/[.]$/, '');
  // Only an entire definition consisting of coordinated bare verbs is an
  // equivalence. "To manage with the hands" has a narrower meaning.
  if (!/^To [a-z]+(?:(?:, (?:or |and )?| (?:or|and) )[a-z]+)+$/.test(text)) {
    return [];
  }
  return text
    .slice(3)
    .split(/, (?:or |and )?| (?:or|and) /)
    .filter((word) => /^[a-z]+$/.test(word));
}

export async function completeSynonymDefinitions(plans, options) {
  await completeNominalGlosses(plans, options);
  const missing = plans.flatMap((plan) =>
    plan.pos === 'verb' &&
    !plan.senses.some(
      (sense) =>
        sense.russian.length &&
        !sense.side &&
        !sense.variant &&
        (sense.languages || 0) >=
          Math.max(
            0,
            ...plan.senses
              .filter((s) => !s.side && !s.variant)
              .map((s) => s.languages || 0)
          )
    )
      ? plan.senses
          .filter(
            (sense) =>
              !sense.russian.length &&
              !sense.side &&
              !sense.variant &&
              !sense.rare
          )
          .map((sense) => ({ sense, targets: definitionSynonyms(sense) }))
          .filter(({ targets }) => targets.length >= 2)
      : []
  );
  if (!missing.length) {
    return;
  }
  const pages = await fetchPages(
    [...new Set(missing.flatMap(({ targets }) => targets))],
    options
  );
  for (const { sense, targets } of missing) {
    const context = new Set(glossWords(sense.definition));
    const candidates = targets.flatMap((target) =>
      englishEntries(pages.get(target) || '')
        .filter((entry) => entry.pos === 'verb' && !entry.rare)
        .flatMap((entry) => entry.senses)
        .filter(
          (other) =>
            other.russian.length &&
            !other.rare &&
            !(
              sense.frames?.includes('transitive') &&
              other.frames?.includes('intransitive') &&
              !other.frames.includes('transitive')
            )
        )
        .map((other) => ({
          other,
          overlap: glossWords(
            `${other.gloss} ${other.definition || ''}`,
            target
          ).filter((word) => context.has(word)).length,
        }))
        .filter(({ overlap }) => overlap > 0)
    );
    candidates.sort(
      (a, b) =>
        b.overlap - a.overlap ||
        (b.other.languages || 0) - (a.other.languages || 0)
    );
    if (candidates.length) {
      sense.russian = candidates[0].other.russian;
    }
  }
}

/** A final bare apposition in a translation gloss names an equivalent noun. */
async function completeNominalGlosses(plans, options) {
  const missing = plans.flatMap((plan) =>
    ['noun', 'adj'].includes(plan.pos)
      ? plan.senses
          .filter((s) => !s.russian.length && !s.rare && !s.side && !s.variant)
          .map((sense) => ({
            sense,
            pos: plan.pos,
            target:
              plan.pos === 'adj'
                ? /;\s*([a-z]+)[.]?$/.exec(sense.definition || '')?.[1]
                : /,\s*([a-z]+)$/.exec(sense.gloss)?.[1],
          }))
          .filter(({ target }) => target && target !== plan.lemma)
      : []
  );
  if (!missing.length) {
    return;
  }
  const pages = await fetchPages(
    [...new Set(missing.map((x) => x.target))],
    options
  );
  for (const { sense, target, pos } of missing) {
    const context = new Set(
      glossWords(`${sense.gloss} ${sense.definition || ''}`, target)
    );
    const candidates = englishEntries(pages.get(target) || '')
      .filter((e) => e.pos === pos && !e.rare)
      .flatMap((e) => e.senses)
      .filter((s) => s.russian.length && !s.rare)
      .map((other) => ({
        other,
        overlap: new Set(
          glossWords(`${other.gloss} ${other.definition || ''}`, target).filter(
            (w) => context.has(w)
          )
        ).size,
      }))
      .sort(
        (a, b) =>
          b.overlap - a.overlap ||
          (b.other.languages || 0) - (a.other.languages || 0)
      );
    if (candidates.length) {
      sense.russian = candidates[0].other.russian;
    }
  }
}
