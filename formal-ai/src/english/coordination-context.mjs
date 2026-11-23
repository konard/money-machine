/** Alternative coordinated modifiers do not describe each other's meaning. */
export function alternativeTokens(tree, target) {
  const tokens = new Set();
  const contains = (node) =>
    node === target ||
    (node &&
      typeof node === 'object' &&
      Object.entries(node).some(
        ([key, value]) => key !== 'candidates' && contains(value)
      ));
  const collect = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Number.isFinite(node.token)) {
      tokens.add(node.token);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'candidates') {
        collect(value);
      }
    }
  };
  const visit = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.coord && node.items?.some(contains)) {
      node.items.filter((item) => !contains(item)).forEach(collect);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'candidates') {
        visit(value);
      }
    }
  };
  visit(tree);
  return tokens;
}
