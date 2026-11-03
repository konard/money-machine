/** Token readings and semantic heads shared by English phrase parsing. */
export const has = (token, pos) => token?.readings.some((r) => r.pos === pos);
export const reading = (token, pos) =>
  token?.readings.find((r) => r.pos === pos);
export const isPunct = (token) => token?.kind === 'punct';

export const head = (token, r) => ({
  token: token.index,
  text: token.text,
  lemma: r.lemma,
  pos: r.pos,
  candidates: r.concepts,
  concept: r.concepts.length === 1 ? r.concepts[0] : null,
});

/** Can this token start a noun phrase? */
export function startsNP(token) {
  return (
    [
      'det',
      'poss',
      'num',
      'pron',
      'noun',
      'name',
      'propn',
      'adj',
      'indef',
    ].some((p) => has(token, p)) ||
    Boolean(gerundReading(token) || participleReading(token))
  );
}

/** Morphology, rather than a list of verbs, identifies nonfinite heads. */
export function gerundReading(token) {
  return token?.readings.find(
    (r) => r.pos === 'verb' && r.features.form === 'ing'
  );
}
export function participleReading(token) {
  return token?.readings.find(
    (r) => r.pos === 'verb' && /pp/.test(r.features.form || '')
  );
}

/** Is a noun phrase a person (who can be asked or helped to do things)? */
export function personLike(np, lexicon) {
  if (np.pronoun) {
    return !(np.pronoun.person === 3 && np.pronoun.gender === 'n');
  }
  // a name is more often a company or a product than a person here
  if (np.coord) {
    return np.items?.some((x) => personLike(x, lexicon));
  }
  const concept = lexicon?.get(np.head?.concept || np.head?.candidates?.[0]);
  return Boolean(
    concept &&
    (concept.classes?.some((c) => /person|human|animate/.test(c)) ||
      concept.ru?.animate ||
      /\b(person|people|someone|who|one that)\b/.test(concept.gloss || ''))
  );
}
