/** Keep attested synonyms available when their reverse meanings differ. */
import { definitionUsage, languageSection, plain } from './wiktionary.mjs';
import { glossWords, hypernym } from './sense-data.mjs';

const reverseHeadWords = (text) =>
  glossWords(
    plain(text.split(/\{\{(?:q|qualifier|gl|gloss)\|/)[0]).replace(
      /\([^)]*\)/g,
      ''
    )
  );

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

/**
 * A sense whose own translations never name the lemma on their own pages
 * borrows a sibling sense's translation that does, when that translation's
 * definition shares a word with this sense's gloss: "expect" (look forward
 * to, anticipate) has only наде́яться "to hope", while ожида́ть "to expect,
 * to anticipate", listed under another sense, names both.
 */
function siblingTranslation(plan, pages) {
  const attested = (sense) =>
    sense.russian.some((c) => reverseMeaning(c.word, plan, pages));
  const siblings = plan.senses
    .filter((s) => !s.variant && !s.side)
    .flatMap((s) => s.russian.slice(0, 1))
    .map((candidate) => ({
      candidate,
      reverse: reverseMeaning(candidate.word, plan, pages),
    }))
    .filter((x) => x.reverse && !definitionUsage(x.reverse).rare);
  return (sense) => {
    if (!sense.russian.length || attested(sense)) {
      return sense;
    }
    const gloss = glossWords(plain(sense.gloss || ''), plan.lemma);
    const borrowed = siblings.find(
      ({ candidate, reverse }) =>
        !sense.russian.some((c) => c.word === candidate.word) &&
        reverseHeadWords(reverse).some((w) => gloss.includes(w))
    );
    return borrowed
      ? { ...sense, russian: [borrowed.candidate, ...sense.russian] }
      : sense;
  };
}

export function translationSenses(plan, pages) {
  if (!['noun', 'verb'].includes(plan.pos)) {
    return plan.senses;
  }
  return plan.senses.map(siblingTranslation(plan, pages)).flatMap((sense) => {
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
      // Functional relative-infinitive glosses explicitly identify a type
      // ("place in which to sit"). Align that type with a reverse synonym;
      // broad ordinary glosses alone do not justify changing a noun default.
      const head = hypernym(sense.gloss);
      if (
        head &&
        /\b(?:in|on|at|for|with|by) which to\b/.test(sense.gloss) &&
        !reverseHeadWords(primary).includes(head)
      ) {
        const precise = alternatives.slice(1).find((candidate) => {
          const reverse = reverseMeaning(candidate.word, plan, pages);
          return (
            reverse &&
            !definitionUsage(reverse).rare &&
            reverseHeadWords(reverse).includes(head)
          );
        });
        if (precise) {
          return [
            sense,
            {
              ...sense,
              russian: [precise],
              labels: [...(sense.labels || []), 'distributive'],
              synonymAlternative: true,
            },
          ];
        }
      }
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
