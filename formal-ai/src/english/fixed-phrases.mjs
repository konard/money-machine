/** Lexicon-driven phrase lookups: fixed phrases and verb prepositions. */
import { isPunct } from './parser.mjs';

/** Union of `en takes` prepositions across a verb reading's concepts. */
export function takesOf(lexicon) {
  return (r) => [
    ...new Set(
      r.concepts.flatMap((id) => {
        const c = lexicon.get(id);
        return [
          ...(c?.takes || []),
          ...(c?.prepositionalTo || c?.frames?.includes('prep:to')
            ? ['prep:to']
            : []),
        ];
      })
    ),
  ];
}

/** Match a whole fixed phrase ("thank you very much"). */
export function matchPhrase(tokens, lexicon) {
  const wordsOnly = tokens
    .filter((t) => !isPunct(t))
    .flatMap((t) => t.lower.replace(/^'/, '').split(/\s+/));
  for (const p of lexicon.phrases) {
    if (
      p.words.length === wordsOnly.length &&
      p.words.every((w, i) => w === wordsOnly[i])
    ) {
      return p.concept;
    }
  }
  return null;
}

/** Leading phrase followed by a comma: "Hello, John." / "Yes, I do." */
export function leadingPhrase(tokens, lexicon) {
  const comma = tokens.findIndex((t) => t.text === ',');
  if (comma <= 0) {
    return null;
  }
  const concept = matchPhrase(tokens.slice(0, comma), lexicon);
  return concept ? { concept, rest: tokens.slice(comma + 1) } : null;
}
