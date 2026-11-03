/** Compound translations can contain an inflected Russian headword. */
import { compoundNoun } from '../russian-entry.mjs';

/** Corpus queries retain an obligatorily plural translation's head form. */
export function translationHead(ru) {
  return (
    (ru?.pluraliaTantum && ru.forms?.['pl.nom']) ||
    ru?.compound?.head ||
    ru?.lemma
  );
}

export function translatedCompound(word, russian, lemmaOf) {
  return compoundNoun(word, (form) => {
    const lemma = lemmaOf.get(`noun:${form}`) || form;
    const entry = russian(lemma, 'noun', { word: lemma });
    if (!entry) {
      return null;
    }
    return entry.forms?.['pl.nom'] === form
      ? { ...entry, pluraliaTantum: true }
      : entry;
  });
}
