/** Sense-specific evidence from a grammatical partner, never a word table. */
import { INDEFINITES, PRONOUNS } from './english/function-words.mjs';
import { attachments } from './english/attachments.mjs';
import { translationHead } from './sources/translation-morphology.mjs';

const stem = (s) =>
  s
    .toLowerCase()
    .replace(/ies$/, 'y')
    .replace(/(?:s|ed|ing)$/, '');
const words = (s) =>
  new Set(
    (s?.match(/[a-z]{3,}/gi) || [])
      .map((w) => w.toLowerCase())
      .filter(
        (w) => !Object.hasOwn(INDEFINITES, w) && !Object.hasOwn(PRONOUNS, w)
      )
      .map(stem)
  );
const describes = (c) =>
  words(
    `${c?.gloss || ''} ${c?.definition || ''} ${(c?.examples || []).join(' ')}`
  );

export function attachmentContext(node, concept, tree, lexicon) {
  let best = 0;
  for (const { a, b, relation } of attachments(tree)) {
    const partner = a === node ? b : b === node ? a : null;
    if (!partner) {
      continue;
    }
    const alternatives = node.candidates
      .map((id) => lexicon.get(id))
      .filter(Boolean);
    const own = describes(concept);
    const distinctive = (word) =>
      own.has(word) &&
      alternatives.filter((c) => describes(c).has(word)).length <=
        alternatives.length / 2;
    const direct = stem(partner.lemma || partner.text || '');
    let score = distinctive(direct) ? 1.2 : 0;
    const senses = partner.candidates
      .map((id) => lexicon.get(id))
      .filter(Boolean);
    // A hypernym must belong to the selected or highest-prior sense, not a remote homonym.
    const representative =
      senses.find((c) => c.id === partner.concept) ||
      [...senses].sort((a, b) => (b.prior || 0) - (a.prior || 0))[0];
    if (representative?.genus && distinctive(stem(representative.genus))) {
      score = Math.max(score, 0.6);
    }
    const lemma = translationHead(representative?.ru);
    const key = `${relation}:${a === node ? 'a' : 'b'}:${lemma}`;
    const count = concept?.attachmentFrequency?.[key];
    const rivals = alternatives.filter(
      (c) =>
        c.ru?.lemma !== concept?.ru?.lemma &&
        Number.isFinite(c.attachmentFrequency?.[key])
    );
    if (Number.isFinite(count) && count > 0 && rivals.length) {
      // Association per occurrence: a common noun co-occurs with everything.
      // Normalize only when *all* compared lemmas have corpus frequencies.
      const normalized = [concept, ...rivals].every((c) =>
        Number.isFinite(c.ruFrequency)
      );
      const rate = (c) =>
        c.attachmentFrequency[key] /
        (normalized ? Math.max(1, c.ruFrequency) : 1);
      const unique = new Map([concept, ...rivals].map((c) => [c.ru.lemma, c]));
      const floor = normalized
        ? 1 /
          [...unique.values()].reduce(
            (sum, c) => sum + Math.max(1, c.ruFrequency),
            0
          )
        : 1;
      const ratio =
        (rate(concept) + floor) / (Math.max(...rivals.map(rate)) + floor);
      const confidence = count / (count + Math.sqrt(count));
      if (ratio >= 3) {
        score += Math.min(1.2, confidence * 0.6 * Math.log10(ratio));
      }
    }
    best = Math.max(best, score);
  }
  return best;
}
