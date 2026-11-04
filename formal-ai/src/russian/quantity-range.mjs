/** A paired numerical interval uses от … до, independent of its predicate. */
export function quantityRange(modifiers = []) {
  const quantity = (e) =>
    e?.quantity !== undefined ||
    e?.numeral ||
    /^~?\p{Sc}?\d/u.test(e?.name || '');
  return modifiers.map((modifier, i) =>
    modifier.relation === 'rel.to' &&
    quantity(modifier.entity) &&
    modifiers[i - 1]?.relation === 'rel.from' &&
    quantity(modifiers[i - 1].entity)
      ? { ...modifier, relation: 'rel.until' }
      : modifier
  );
}
