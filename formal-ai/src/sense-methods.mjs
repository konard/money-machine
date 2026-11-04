/** Switchable evidence kept separate from the grammatical sense constraints. */
import { methodWeight } from './methods.mjs';

export function methodEvidence(concept, memory, word, semantic, topic) {
  const evidence = [];
  const domain = concept?.domain;
  const weight = methodWeight(memory.methods, 'domainLabels');
  // "chemistry: a number of a reaction": a specialist sense, unlikely
  // unless the document is about that field
  if (
    domain &&
    !semantic &&
    !concept.core &&
    !memory.mentions(domain, word) &&
    !(memory.familyWeight(domain) >= 0.4)
  ) {
    evidence.push({
      score: -0.2 * weight,
      reason: `specialist sense (${domain}) (${(-0.2 * weight).toFixed(2)})`,
    });
  }
  if (
    domain &&
    memory.mentions(domain, word) &&
    !(topic && concept.cues?.includes(domain)) &&
    !((concept.cues || []).includes(domain) && memory.topicWeight(domain, word))
  ) {
    // A field label already counted as a topical cue is one piece of
    // evidence, not a second independent vote for this meaning.
    evidence.push({
      score: 0.3 * weight,
      reason: `dictionary field ${domain} in document (+${(0.3 * weight).toFixed(2)})`,
    });
  }
  const back =
    (concept?.roundTrip?.score || 0) *
    0.05 *
    methodWeight(memory.methods, 'roundTrip');
  if (back) {
    evidence.push({
      score: back,
      reason: `lexical round trip ${concept.roundTrip.status} (${back.toFixed(2)})`,
    });
  }
  return evidence;
}
