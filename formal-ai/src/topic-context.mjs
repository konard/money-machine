/** Whole-document evidence from distinctive dictionary definition words. */
import { analyze } from './english/analyze.mjs';
import { glossWords } from './sources/sense-data.mjs';

const stem = (word) =>
  word.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '');
const words = (text) => new Set(glossWords(text).map(stem));
const describes = (concept) =>
  words(concept?.definition || concept?.gloss || '');

/**
 * Definition words of the dictionary itself ("make", "cause", "person"):
 * in at least 2% of all definitions (and 20 of them), they describe how
 * definitions are written, not what a sense is about.
 */
const general = new WeakMap();
function generalCues(lexicon) {
  const size = lexicon.concepts?.size || 0;
  const known = general.get(lexicon);
  if (known?.size === size) {
    return known.cues;
  }
  const counts = new Map();
  for (const concept of lexicon.concepts?.values() || []) {
    for (const cue of describes(concept)) {
      counts.set(cue, (counts.get(cue) || 0) + 1);
    }
  }
  const cues = new Set(
    [...counts]
      .filter(([, n]) => n >= 20 && n >= 0.02 * size)
      .map(([cue]) => cue)
  );
  general.set(lexicon, { size, cues });
  return cues;
}

/** Each source lemma gets one vote; repeated boilerplate cannot dominate. */
export function topicProfile(text, lexicon) {
  const profile = new Map();
  const plain = text.replace(
    /```[\s\S]*?```|`[^`]*`|https?:\/\/\S+|<[^>]+>/g,
    ' '
  );
  for (const word of words(plain)) {
    profile.set(word, new Set([word]));
  }
  const expanded = new Set();
  for (const token of analyze(plain, lexicon)) {
    const readings = (token.readings || []).filter((r) =>
      ['noun', 'verb', 'adj', 'adv'].includes(r.pos)
    );
    if (!readings.length) {
      continue;
    }
    const lemma = stem(readings[0].lemma || token.lower);
    if (expanded.has(lemma)) {
      continue;
    }
    expanded.add(lemma);
    const senses = [...new Set(readings.flatMap((r) => r.concepts || []))]
      .map((id) => lexicon.get(id))
      .filter((c) => c && !c.related && !c.usagePenalty);
    // Expand only agreement across meanings, never the union of homonyms.
    const definitions = senses.map(describes);
    const shared = definitions.length
      ? [...definitions[0]].filter((w) => definitions.every((d) => d.has(w)))
      : [];
    profile.set(lemma, new Set([lemma, ...shared]));
  }
  return profile;
}

/** Compare meanings, deduplicating Russian synonyms of the same definition. */
export function documentTopicContext(node, concept, lexicon, memory) {
  // a bare profile (no field to compare with) or the document memory
  const profile = memory instanceof Map ? memory : memory?.profile;
  if (!profile?.size || node.uncounted) {
    return 0;
  }
  const alternatives = new Map(
    node.candidates.map((id) => {
      const c = lexicon.get(id);
      return [`${c?.gloss} ${c?.definition || ''}`, describes(c)];
    })
  );
  if (alternatives.size < 2) {
    return 0;
  }
  const own = stem(node.lemma || node.text || '');
  const generic = generalCues(lexicon);
  const description = describes(concept);
  const matches = [...description].filter(
    (cue) =>
      cue !== own &&
      !generic.has(cue) &&
      [...alternatives.values()].filter((d) => d.has(cue)).length <=
        alternatives.size / 2 &&
      [...profile].some(
        ([lemma, terms]) =>
          lemma !== own &&
          terms.has(cue) &&
          (memory?.distinctive?.(lemma) ?? true)
      )
  );
  // A bounded vote: definitions cannot win simply by being long.
  return Math.min(
    1.2,
    (1.2 * matches.length) / Math.sqrt(description.size || 1)
  );
}
