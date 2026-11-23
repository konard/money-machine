/** Grammatical partners shared by public corpus lookup and sense scoring. */
export function attachments(tree) {
  const pairs = [];
  const add = (a, b, relation) => {
    if (a?.candidates?.length && b?.candidates?.length) {
      pairs.push({ a, b, relation });
    }
  };
  const nominal = (np, f) => {
    if (np?.items) {
      np.items.forEach((item) => nominal(item, f));
    } else if (np?.head && !np.modifiers?.length) {
      // "share location history": the verb selects the compound, not its head
      f(np.head);
    }
  };
  const visit = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.head) {
      for (const adj of node.adjs || []) {
        add(adj, node.head, adj.participle ? 'object' : 'property');
        add(
          adj.alternative,
          node.head,
          adj.alternative?.participle ? 'object' : 'property'
        );
      }
    }
    if (node.verb && node.frame !== 'copula') {
      nominal(node.subject, (head) =>
        add(node.verb, head, node.passive ? 'object' : 'subject')
      );
      for (const object of node.objects || []) {
        if (!object.marker) {
          nominal(object, (head) => add(node.verb, head, 'object'));
        }
      }
      for (const mod of node.mods || []) {
        if (mod.pos === 'adv') {
          add(mod, node.verb, 'manner');
        }
      }
    }
    if (node.complement?.type === 'adj') {
      nominal(node.subject, (head) => {
        add(node.complement, head, 'property');
        for (const other of node.complement.also || []) {
          add(other.adjective, head, 'property');
        }
      });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'candidates') {
        if (Array.isArray(value)) {
          value.forEach(visit);
        } else {
          visit(value);
        }
      }
    }
  };
  visit(tree);
  return pairs;
}
