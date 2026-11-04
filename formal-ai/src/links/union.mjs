/** Ordered union: the first member owning an address wins (link-cli #149). */
import { SOURCES, sourceOf } from '../sources/registry.mjs';
import { conceptLinks, linksConcept } from './schema.mjs';

export function sourceLayer(source = '') {
  if (source.endsWith('.lino') && !source.includes('learned')) {
    return 'overrides';
  }
  if (sourceOf(source)) {
    return sourceOf(source);
  }
  return Object.hasOwn(SOURCES, source) ? source : source || 'public';
}

export class UnionLinks {
  constructor(order = ['overrides', ...Object.keys(SOURCES)]) {
    this.order = [...order];
    this.layers = new Map(this.order.map((name) => [name, new Map()]));
  }

  add(concept, layer, provenance = layer) {
    if (!this.layers.has(layer)) {
      this.order.push(layer);
      this.layers.set(layer, new Map());
    }
    const origin = sourceLayer(concept.source);
    const named =
      concept.source && Object.hasOwn(SOURCES, origin)
        ? { ...concept, source: origin }
        : concept;
    for (const link of conceptLinks(named)) {
      this.layers.get(layer).set(link.address, { ...link, layer, provenance });
    }
    return this;
  }

  links(id) {
    const merged = new Map();
    for (const layer of this.order) {
      for (const [address, link] of this.layers.get(layer)) {
        if ((id === undefined || link.concept === id) && !merged.has(address)) {
          merged.set(address, link);
        }
      }
    }
    return [...merged.values()];
  }

  get(id) {
    return linksConcept(id, this.links(id));
  }

  ids() {
    return [...new Set(this.links().map((link) => link.concept))];
  }
}
