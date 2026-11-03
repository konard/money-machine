/** Explicit Russian case government in public dictionary annotations. */
const CASES = {
  genitive: 'gen',
  dative: 'dat',
  accusative: 'acc',
  instrumental: 'ins',
  prepositional: 'prep',
  locative: 'prep',
};

export function prepositionCase(text = '') {
  const atom = /\{\{\+obj\|ru\|(gen|dat|acc|ins|pre|prep|loc)(?=[|}])/.exec(
    text
  )?.[1];
  if (atom) {
    return /^(pre|loc)$/.test(atom) ? 'prep' : atom;
  }
  const note =
    /(?:\+|with|takes|governs)\s*(?:the\s+)?(genitive|dative|accusative|instrumental|prepositional|locative)\b/i.exec(
      text
    );
  return note ? CASES[note[1].toLowerCase()] : null;
}
