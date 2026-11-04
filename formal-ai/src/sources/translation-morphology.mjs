/** Compound translations can contain an inflected Russian headword. */
import { compoundNoun } from '../russian-entry.mjs';

/** A Russian lemma keeps its known paradigm across English senses. */
export function reuseMorphology(entry, lexicon) {
  if (!entry?.regular || entry.pos !== 'verb') {
    return entry;
  }
  const known = [...lexicon.concepts.values()]
    .map((c) => c.ru)
    .find(
      (ru) =>
        ru?.pos === 'verb' &&
        ru.lemma === entry.lemma &&
        (ru.past || ru.present)
    );
  if (!known) {
    return entry;
  }
  const result = { ...entry };
  for (const key of [
    'present',
    'past',
    'imperative',
    'pastPassive',
    'converb',
  ]) {
    if (known[key]) {
      result[key] = known[key];
    }
  }
  return result;
}

/** A predicate's complement is fixed; only its lexical head inflects. */
export function translationParts(word, pos) {
  return word
    .split(' ')
    .slice(0, ['verb', 'adj'].includes(pos) ? 1 : undefined);
}

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
