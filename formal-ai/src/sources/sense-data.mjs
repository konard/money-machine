/** Dictionary-derived evidence shared by the resolver and sense scorer. */
export function genus(definition = '') {
  const words = definition.toLowerCase().match(/[a-z]+/g) || [];
  return words.find((w) => !/^(the|a|an|any|one|some|of|to)$/.test(w));
}

/** Empty tables can inherit a sibling translation with the same genus. */
export function borrowGenus(senses) {
  return senses.map((s) => {
    if (s.russian.length || !s.definition) {
      return s;
    }
    const head = genus(s.definition);
    const sibling = senses.find(
      (x) =>
        x !== s &&
        x.russian.length &&
        !x.variant &&
        head &&
        genus(x.definition) === head
    );
    return sibling ? { ...s, russian: sibling.russian, borrowed: true } : s;
  });
}

export function usagePenalty(sense) {
  if (sense.rare) {
    return 1;
  }
  return 0;
}
