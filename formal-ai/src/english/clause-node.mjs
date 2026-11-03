/** Construct the clause structure from parsed verb and argument features. */
export function clause(mood, vg, parts) {
  return {
    type: 'clause',
    mood,
    frame: parts.frame || vg.frame,
    tense: vg.tense,
    aspect: vg.aspect,
    polarity: vg.polarity,
    modal: vg.modal,
    ...(vg.sharedModal ? { sharedModal: true } : {}),
    passive: Boolean(vg.passive),
    generic: parts.generic || false,
    labelPredicate: parts.labelPredicate || false,
    verb: vg.verb,
    subject: parts.subject || null,
    objects: parts.objects || [],
    complement: parts.complement || null,
    mods: [
      ...(vg.adverbs || []).map((a) => ({ type: 'adv', ...a })),
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
