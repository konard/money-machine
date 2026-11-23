/** Verb equivalents whose definitions explicitly restrict their object classes. */
import { englishEntries, fetchPages } from './wiktionary.mjs';
import { glossWords } from './sense-data.mjs';

export async function completeRestrictedDefinitions(plans, options) {
  const missing = plans
    .filter((p) => p.pos === 'verb')
    .flatMap((p) =>
      p.senses
        .filter((s) => !s.russian.length && !s.rare && !s.side && !s.variant)
        .flatMap((sense) => {
          const m =
            /^To ([a-z]+) ([a-z]+(?:, [a-z]+)* or (?:other )?[a-z]+)[.]?$/.exec(
              sense.definition || ''
            );
          return m
            ? [
                {
                  sense,
                  target: m[1],
                  objects: glossWords(m[2]).filter((w) => w !== 'other'),
                },
              ]
            : [];
        })
    );
  const pages = await fetchPages(
    missing.map((x) => x.target),
    options
  );
  for (const { sense, target, objects } of missing) {
    const candidates = englishEntries(pages.get(target) || '')
      .filter((e) => e.pos === 'verb' && !e.rare)
      .flatMap((e) => e.senses)
      .filter((s) => s.russian.length && !s.rare)
      .map((s) => ({
        s,
        overlap: glossWords(`${s.gloss} ${s.definition || ''}`, target).filter(
          (w) => objects.includes(w)
        ).length,
      }))
      .filter((x) => x.overlap)
      .sort(
        (a, b) =>
          b.overlap - a.overlap || (b.s.languages || 0) - (a.s.languages || 0)
      );
    if (candidates.length) {
      sense.russian = candidates[0].s.russian;
      sense.objectClasses = objects;
      sense.frames = [...new Set([...(sense.frames || []), 'transitive'])];
    }
  }
}
