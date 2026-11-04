/** Fill empty tables from Russian meanings and compositional English glosses. */
import { englishEntries, fetchPages } from './wiktionary.mjs';
import { declineAdjective } from '../russian/morphology.mjs';
import { senseDomain } from './sense-data.mjs';
import { completeVerbDefinitions } from './definition-verbs.mjs';
import { completeRussianMeanings } from './russian-meanings.mjs';
import { completeSynonymDefinitions } from './definition-synonyms.mjs';

export async function completeDefinitions(
  plans,
  options,
  entries,
  context = {}
) {
  if (entries) {
    await completeRussianMeanings(plans, entries, { ...options, ...context });
  }
  await completeVerbDefinitions(plans, options);
  await completeSynonymDefinitions(plans, options);
  const missing = plans
    .filter((p) => p.pos === 'noun')
    .flatMap((p) =>
      p.senses.filter(
        (s) =>
          !s.russian.length &&
          !s.side &&
          !s.variant &&
          senseDomain(s) &&
          /^[a-z]+ [a-z]+$/.test(s.gloss)
      )
    );
  if (!missing.length) {
    return;
  }
  const pages = await fetchPages(
    [...new Set(missing.flatMap((s) => s.gloss.split(' ')))],
    options
  );
  const candidates = (word, pos) =>
    englishEntries(pages.get(word) || '')
      .filter((e) => e.pos === pos && !e.rare && !e.formOf.length)
      .flatMap((e) =>
        e.senses.filter((s) => !s.rare).flatMap((s) => s.russian)
      );
  for (const sense of missing) {
    const [modifier, head] = sense.gloss.split(' ');
    const adj = candidates(modifier, 'adj').find((c) =>
      /(?:ый|ий|ой)$/.test(c.word)
    );
    const noun = candidates(head, 'noun').find(
      (c) => c.gender && !c.word.includes(' ')
    );
    if (adj && noun) {
      sense.russian = [
        {
          word: `${declineAdjective(adj.word, { case: 'nom', gender: noun.gender })} ${noun.word}`,
          gender: noun.gender,
        },
      ];
      sense.composed = true;
    }
  }
}
