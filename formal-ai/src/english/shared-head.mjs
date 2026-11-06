/** Bare coordinated modifiers can share the following overt noun head. */
export function sharedHead(first, second, lexicon) {
  if (
    !first.head ||
    first.head.pos !== 'noun' ||
    first.number !== 'sg' ||
    first.def ||
    first.det ||
    first.possessor ||
    first.adjs?.length ||
    first.modifiers?.length ||
    !second.head ||
    second.def ||
    second.det ||
    second.possessor ||
    !(second.adjs?.length || second.modifiers?.length)
  ) {
    return first;
  }
  const candidates = first.head.candidates || [];
  const countable = candidates.some((id) =>
    lexicon?.get(id)?.labels?.includes('countable')
  );
  if (!second.adjs?.length && !countable) {
    return first;
  }
  return {
    ...second,
    adjs: [],
    modifiers: [{ ...first.head, uncounted: true }],
    sharedHead: true,
  };
}
