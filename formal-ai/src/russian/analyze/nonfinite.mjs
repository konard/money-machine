/** Auxiliary/modal forms are inverted from the generator, not a second dictionary. */
import { modalWord } from '../naturalize.mjs';
import { lower } from './tokenizer.mjs';
export function modalIndex() {
  const index = new Map();
  for (const modality of [
    'modal.can',
    'modal.may',
    'modal.must',
    'modal.should',
  ]) {
    for (const tense of ['present', 'past', 'future']) {
      for (const person of [1, 2, 3]) {
        for (const number of ['sg', 'pl']) {
          for (const gender of ['m', 'f', 'n']) {
            const word = modalWord(
              { modality, tense },
              { person, number, gender }
            );
            if (!word) {
              continue;
            }
            const key = lower(word);
            const previous = index.get(key) || [];
            previous.push({ modality, tense, person, number, gender });
            index.set(key, previous);
          }
        }
      }
    }
  }
  return index;
}
const MODALS = modalIndex();
export function modalGroup(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    for (const length of [2, 1]) {
      const forms = MODALS.get(
        tokens
          .slice(i, i + length)
          .map((t) => t.lower)
          .join(' ')
      );
      if (!forms) {
        continue;
      }
      const infinitiveAt = tokens.findIndex(
        (t, j) =>
          j >= i + length &&
          t.readings.some((r) => r.pos === 'verb' && r.mood === 'infinitive')
      );
      if (infinitiveAt < 0) {
        continue;
      }
      const tenses = [...new Set(forms.map((r) => r.tense))];
      const modalities = [...new Set(forms.map((r) => r.modality))];
      return {
        at: i,
        length,
        infinitiveAt,
        tense: tenses.join(' '),
        modalities,
      };
    }
  }
  return null;
}
