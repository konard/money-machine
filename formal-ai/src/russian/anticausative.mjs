/** The reflexive counterpart of a transitive verb used without an object. */
import { isPerson } from './phrase.mjs';

/**
 * "The meeting started" → собрание началось: a thing undergoes the event;
 * "we started" / "Tom started" → начали: a person still acts;
 * "we met" → встретились: a reflexive meaning of its own.
 */
export function anticausative(entry, s, ctx) {
  return Boolean(
    entry.intransitive &&
    // a fragment with no subject ("says only") has nothing to undergo it
    s.subject &&
    !s.subject.implicit &&
    (!entry.intransitiveRussian || ctx.voiceReliable !== false) &&
    // A transitive-only English predicate needs a middle construction:
    // an objectless present with a manner modifier ("updates automatically").
    (!entry.intransitiveMiddleOnly ||
      (s.tense === 'present' &&
        !s.modality &&
        (s.modifiers || []).some((m) => m.kind === 'adverb'))) &&
    !(s.objects || []).length &&
    !s.complementClause &&
    s.voice !== 'passive' &&
    !(
      entry.anticausative &&
      (isPerson(s.subject, ctx) || ctx.lexicon.givenNames?.has(s.subject?.name))
    )
  );
}
