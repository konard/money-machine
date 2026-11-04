/** Dictionary evidence for eventive readings of ambiguous participles. */
import { has, reading } from './token-readings.mjs';

/** Retain evidence from the adjective's own entry, including translation pointers. */
export function predicateEvidence(entries, plan) {
  if (plan.pos !== 'adj') {
    return undefined;
  }
  const sections = (entries.get(plan.lemma) || []).filter(
    (e) => e.pos === 'adj'
  );
  const blocks = sections.flatMap((e) => e.rawDefinitions || []);
  const definitions = blocks.map((b) => b.split('\n')[0]).join(' ');
  const prepositions = blocks.flatMap((b) =>
    [...b.matchAll(/'''([^'\n]+)'''\s+(in|on|at|to|from|for|with|about|of)\b/g)]
      .filter((m) => m[1].toLowerCase() === plan.lemma)
      .map((m) => m[2])
  );
  return {
    derived:
      /(?:past participle of|ed-form|has or have been|has been|is or has)/i.test(
        definitions
      ),
    restricted:
      blocks.length > 0 &&
      blocks.every((b) =>
        /\|(?:informal|rare|obsolete|archaic|in combination|attributive)(?:\||\}\})/.test(
          b.split('\n')[0]
        )
      ),
    prepositions,
  };
}

/** Positive lexical evidence supplements agents and event adverbs in the grammar. */
export function eventiveParticiple(c, participle, subject) {
  const lexicon = c.grammar?.lexicon;
  if (!lexicon) {
    return false;
  }
  const adjectives = (reading(c.peek, 'adj')?.concepts || []).map((id) =>
    lexicon.get(id)
  );
  const verbs = participle.concepts.map((id) => lexicon.get(id));
  const next = c.at(1);
  // An attested adjective complement keeps its state reading (interested in).
  if (
    adjectives.some((a) =>
      a?.predicateEvidence?.prepositions.includes(next?.lower)
    )
  ) {
    return false;
  }
  const adjunct =
    has(next, 'prep') &&
    !has(next, 'det') &&
    !(next.lower === 'to' && has(c.at(2), 'verb'));
  const derived = adjectives.some(
    (a) =>
      a?.predicateEvidence?.derived ||
      a?.ru?.passive ||
      verbs.some((v) =>
        [v?.ru?.pastPassive, v?.ru?.perfective?.pastPassive].includes(
          a?.ru?.lemma
        )
      )
  );
  const restricted =
    adjectives.length &&
    adjectives.every(
      (a) => a?.predicateEvidence?.restricted || a?.usagePenalty
    );
  const object = subject?.head;
  const candidates = object?.concept
    ? [object.concept]
    : object?.candidates || [];
  const inanimate =
    candidates.length > 0 &&
    candidates.every((id) => lexicon.get(id)?.ru?.animate === false);
  return Boolean(
    (adjunct && (derived || restricted)) || (inanimate && restricted)
  );
}
