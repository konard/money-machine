/** Construct the clause structure from parsed verb and argument features. */
export function clause(mood, vg, parts) {
  // "is very cheap": an adverb right before the predicate adjective is its
  // degree, not a clause adverb
  let adverbs = vg.adverbs || [];
  let complement = parts.complement || null;
  const degree = adverbs.find(
    (a) => complement?.type === 'adj' && a.token === complement.token - 1
  );
  if (degree && !complement.degree && !complement.comparison) {
    adverbs = adverbs.filter((a) => a !== degree);
    complement = { ...complement, degree };
  }
  return {
    type: 'clause',
    mood,
    frame: parts.frame || vg.frame,
    tense: vg.tense,
    aspect: vg.aspect,
    polarity: vg.polarity,
    modal: vg.modal,
    ...(vg.sharedModal ? { sharedModal: true } : {}),
    ...(vg.sharedPolarity ? { sharedPolarity: true } : {}),
    passive: Boolean(vg.passive),
    generic: parts.generic || false,
    labelPredicate: parts.labelPredicate || false,
    verb: vg.verb,
    subject: parts.subject || null,
    objects: parts.objects || [],
    complement,
    mods: [
      ...adverbs.map((a) => ({ type: 'adv', ...a })),
      ...(parts.mods || []),
    ],
    xcomp: parts.xcomp || null,
    wh: parts.wh || null,
    stranded: parts.stranded || null,
    polite: parts.polite || false,
    inclusive: parts.inclusive || false,
    finiteLink: parts.finiteLink || null,
  };
}
