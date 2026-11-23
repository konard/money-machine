/** Context types: a link's source is its type; Extends adds other parents. */
import { field, childrenNamed, words } from './lino.mjs';

export class ContextNetwork {
  constructor() {
    this.links = new Map([
      ['Type', { source: 'Type', target: 'Type' }],
      ['Context', { source: 'Type', target: 'Context' }],
      ['Meaning', { source: 'Type', target: 'Meaning' }],
    ]);
    this.aliases = new Map();
    this.overrides = new Set();
    this.bindings = new Map();
    this.concepts = new Map();
    this.loaded = new Set();
    this.descriptions = new Map();
    this.extraParents = new Map();
    this.ancestry = new Map();
    // Public parents are followed only as far as the loader fetched them from
    // each label, so extra loaded graph cannot change a word's contexts.
    this.horizon = Infinity;
  }

  id(name) {
    const key = String(name).trim();
    if (['Context', 'Meaning', 'Type', 'Extends'].includes(key)) {
      return key;
    }
    return this.aliases.get(key.toLowerCase()) || key.toLowerCase();
  }

  alias(name, id) {
    this.aliases.set(String(name).toLowerCase(), id);
    this.ancestry.clear();
  }

  /** (S: T S), with additional (p: S T2), (m: Extends p). */
  define(name, parents = ['Context'], { local = false } = {}) {
    const id = this.id(name);
    if (this.overrides.has(id) && !local) {
      return id;
    }
    if (local) {
      this.overrides.add(id);
    }
    this.ancestry.clear();
    for (const pair of this.extraParents.get(id) || []) {
      this.links.delete(pair);
      this.links.delete(`${pair}:mark`);
    }
    const extra = [];
    const ids = parents.map((p) =>
      ['Context', 'Meaning', 'Type'].includes(p) ? p : this.id(p)
    );
    this.links.set(id, { source: ids[0] || 'Context', target: id });
    ids.slice(1).forEach((parent, i) => {
      const pair = `${id}:extends:${i}`;
      this.links.set(pair, { source: id, target: parent });
      this.links.set(`${pair}:mark`, { source: 'Extends', target: pair });
      extra.push(pair);
    });
    this.extraParents.set(id, extra);
    return id;
  }

  parentsOf(name) {
    const id = this.links.has(name) ? name : this.id(name);
    const out = new Set();
    const link = this.links.get(id);
    if (link && link.source !== id) {
      out.add(link.source);
    }
    for (const pair of this.extraParents.get(id) || []) {
      out.add(this.id(this.links.get(pair).target));
    }
    return out;
  }

  ancestorsOf(name) {
    const id = this.links.has(name) ? name : this.id(name);
    if (this.ancestry.has(id)) {
      return new Set(this.ancestry.get(id));
    }
    const seen = new Set([id]);
    const out = new Set();
    const pending = [...this.parentsOf(id)];
    while (pending.length) {
      const parent = pending.pop();
      if (seen.has(parent)) {
        continue;
      }
      seen.add(parent);
      out.add(parent);
      pending.push(...this.parentsOf(parent));
    }
    this.ancestry.set(id, out);
    return new Set(out);
  }

  /** With a closure, only parents inside its horizon count. */
  isA(child, parent, closure) {
    const a = this.links.has(child) ? child : this.id(child);
    const b = this.links.has(parent) ? parent : this.id(parent);
    if (a === b) {
      return true;
    }
    if (!closure) {
      return this.ancestorsOf(a).has(b);
    }
    const seen = new Set([a]);
    const pending = [a];
    while (pending.length) {
      for (const p of this.boundedParents(pending.pop(), closure)) {
        if (p === b) {
          return true;
        }
        if (!seen.has(p)) {
          seen.add(p);
          pending.push(p);
        }
      }
    }
    return false;
  }

  /** A node at the horizon reads as a direct child of Context. */
  boundedParents(id, closure) {
    if (!closure) {
      return this.parentsOf(id);
    }
    const level = closure.get(id);
    return level !== undefined && level < this.horizon
      ? this.parentsOf(id)
      : new Set(['Context']);
  }

  /** Context id -> fewest steps from a direct context, within the horizon. */
  closure(concepts) {
    const out = new Map();
    let level = [
      ...new Set(
        [concepts].flat().flatMap((c) => [...this.directContextsOf(c)])
      ),
    ];
    for (let step = 0; level.length; step += 1) {
      const next = [];
      for (const id of level) {
        if (out.has(id)) {
          continue;
        }
        out.set(id, step);
        if (step < this.horizon) {
          next.push(...this.parentsOf(id));
        }
      }
      level = next.filter((id) => !out.has(id));
    }
    return out;
  }

  /** Shortest path to Context: cycles cannot inflate specificity. */
  depth(name, closure) {
    let level = [this.id(name)];
    const seen = new Set();
    for (let depth = 0; level.length; depth += 1) {
      if (level.includes('Context')) {
        return depth;
      }
      const next = [];
      for (const id of level) {
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        next.push(...this.boundedParents(id, closure));
      }
      level = next.filter((id) => !seen.has(id));
    }
    return 0;
  }

  directContextsOf(concept) {
    if (typeof concept === 'string') {
      concept = this.concepts.get(concept) || { id: concept };
    }
    const local = this.bindings.get(
      typeof concept === 'string' ? concept : concept?.id
    );
    return new Set(
      (
        local ||
        concept?.contexts ||
        (concept?.domain ? [concept.domain] : [])
      ).map((c) => this.id(c))
    );
  }

  linkConcept(concept) {
    this.concepts.set(concept.id, concept);
    const contexts = [...this.directContextsOf(concept)];
    for (const context of contexts) {
      if (!this.links.has(context)) {
        this.define(context);
      }
    }
    this.define(concept.id, ['Meaning', ...contexts]);
  }

  contextsOf(concept) {
    return new Set(
      [...this.closure(concept).keys()].filter(
        (id) => !['Context', 'Type', 'Meaning'].includes(id)
      )
    );
  }

  /** Local definitions replace public parents/bindings, including empty ones. */
  addTree(root) {
    for (const node of childrenNamed(root, 'context')) {
      const parents = childrenNamed(node, 'extends').flatMap((n) =>
        n.value.startsWith('(') ? words(n.value) : [n.value]
      );
      const id = this.define(
        node.value,
        parents.length ? parents : ['Context'],
        { local: true }
      );
      for (const alias of childrenNamed(node, 'alias')) {
        this.alias(alias.value, id);
      }
    }
    for (const node of childrenNamed(root, 'concept')) {
      const context = field(node, 'contexts');
      if (context !== undefined) {
        this.bindings.set(node.value, words(context));
        if (this.concepts.has(node.value)) {
          this.linkConcept(this.concepts.get(node.value));
        }
      }
    }
  }
}

export const contextsOf = (concept, network = new ContextNetwork()) =>
  network.contextsOf(concept);
