/** Keep attested synonyms available when their reverse meanings differ. */
import { definitionUsage, languageSection, plain } from './wiktionary.mjs';

function reverseMeaning(word, plan, pages) {
  const section = languageSection(pages.get(word) || '', 'Russian');
  const pattern =
    plan.pos === 'noun'
      ? /^={3,5}Noun={3,5}\s*\n([\s\S]*?)(?=^={2,3}[^=]|$(?![\s\S]))/gm
      : /^={3,5}Verb={3,5}\s*\n([\s\S]*?)(?=^={2,3}[^=]|$(?![\s\S]))/gm;
  const definitions = [...section.matchAll(pattern)]
    .map((m) => m[1])
    .join('\n');
  return [...definitions.matchAll(/^#[^#*:](.*)$/gm)]
    .map((m) => m[1])
    .find((definition) =>
      [...definition.matchAll(/\[\[([^\]#|]+)(?:[^\]]*)\]\]/g)].some(
        (m) => m[1] === plan.lemma
      )
    );
}

export function translationSenses(plan, pages) {
  if (!['noun', 'verb'].includes(plan.pos)) {
    return plan.senses;
  }
  return plan.senses.flatMap((sense) => {
    const seen = new Set();
    const alternatives = sense.russian.filter((candidate) => {
      if (seen.has(candidate.word)) {
        return false;
      }
      seen.add(candidate.word);
      return true;
    });
    const primary =
      alternatives[0] && reverseMeaning(alternatives[0].word, plan, pages);
    // A normally used, exactly attested noun needs no speculative synonym.
    if (plan.pos === 'noun' && primary && !definitionUsage(primary).rare) {
      return [sense];
    }
    return [
      sense,
      ...alternatives.slice(1).flatMap((candidate) => {
        const reverse = reverseMeaning(candidate.word, plan, pages);
        if (!reverse) {
          return [];
        }
        const usage = definitionUsage(reverse);
        return [
          {
            ...sense,
            labels: [...(sense.labels || []), ...usage.labels],
            rare: sense.rare || usage.rare,
            reverseDefinition: plain(reverse),
            russian: [candidate],
            context: `${sense.context || ''} ${plain(reverse).replace(/\([^)]*\)/g, '')}`,
            synonymAlternative: true,
          },
        ];
      }),
    ];
  });
}
