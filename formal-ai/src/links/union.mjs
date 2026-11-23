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
    // layer → concept → addresses: a concept's links without a full scan
    this.byConcept = new Map(this.order.map((name) => [name, new Map()]));
  }

  add(concept, layer, provenance = layer) {
    if (!this.layers.has(layer)) {
      this.order.push(layer);
      this.layers.set(layer, new Map());
      this.byConcept.set(layer, new Map());
    }
    const origin = sourceLayer(concept.source);
    const named =
      concept.source && Object.hasOwn(SOURCES, origin)
        ? { ...concept, source: origin }
        : concept;
    const links = this.layers.get(layer);
    const index = this.byConcept.get(layer);
    for (const link of conceptLinks(named)) {
      const previous = links.get(link.address);
      if (previous && previous.concept !== link.concept) {
        index.get(previous.concept)?.delete(link.address);
      }
      links.set(link.address, { ...link, layer, provenance });
      if (!index.has(link.concept)) {
        index.set(link.concept, new Set());
      }
      index.get(link.concept).add(link.address);
    }
    return this;
  }

  /** Drop a concept's links that match, in every layer. */
  remove(id, matches) {
    for (const [layer, links] of this.layers) {
      const addresses = this.byConcept.get(layer).get(id);
      for (const address of [...(addresses || [])]) {
        if (matches(links.get(address))) {
          links.delete(address);
          addresses.delete(address);
        }
      }
    }
  }

  links(id) {
    const merged = new Map();
    for (const layer of this.order) {
      const links = this.layers.get(layer);
      const addresses =
        id === undefined ? links.keys() : this.byConcept.get(layer).get(id);
      for (const address of addresses || []) {
        if (!merged.has(address)) {
          merged.set(address, links.get(address));
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
