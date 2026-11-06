/**
 * Concept lexicon loader.
 *
 * Mutation of Formal AI's seed lexicon (`meanings` → `lexeme <lang>` →
 * `surface`): one `concept` node per meaning, carrying the English surface
 * forms that can express it and the Russian lexeme with the grammatical
 * data needed to inflect it. Several concepts may share an English surface
 * (`bank`); the sense selector picks one from context.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLino, childrenNamed } from './lino.mjs';
import {
  parseConcept,
  parseOverlay,
  conceptLinks,
  linksConcept,
} from './links/schema.mjs';
import { UnionLinks, sourceLayer } from './links/union.mjs';
export { parseConcept, parseGovernment } from './links/schema.mjs';
import { ContextNetwork } from './context-network.mjs';

// Content words come from public sources (Wiktionary, Wikidata) while the
// translator runs; `data/overrides/` holds only corrections of that data,
// and an override concept takes the place of what public data says about
// its word. FORMAL_AI_DATA points at another vocabulary (the tests use a
// fixed hand-written one).
export const DATA_DIR =
  globalThis.process?.env?.FORMAL_AI_DATA ||
  join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'overrides');

/** In-memory lexicon with English lookup indexes. */
export class Lexicon {
  constructor() {
    this.contextNetwork = new ContextNetwork();
    this.links = new UnionLinks();
    this.partialOverrides = new Map();
    this.concepts = new Map();
    this.byLemma = new Map();
    this.byForm = new Map();
    this.multiword = new Map();
    this.phrases = [];
  }

  /** Add every `concept` under a parsed Links Notation root. */
  addTree(root, source = '') {
    this.contextNetwork.addTree(root);
    for (const node of childrenNamed(root, 'concept')) {
      const current = this.concepts.get(node.value);
      if (current && sourceLayer(current.source) !== 'overrides') {
        this.links.add(current, sourceLayer(current.source), current.source);
      }
      const overlay = parseOverlay(node);
      this.links.add(overlay, sourceLayer(source), source);
      if (
        sourceLayer(source) === 'overrides' &&
        !childrenNamed(node, 'en').length &&
        !childrenNamed(node, 'ru').length
      ) {
        for (const link of conceptLinks(overlay)) {
          this.partialOverrides.set(link.address, link);
        }
      }
      const previous = this.concepts.get(node.value);
      if (
        previous &&
        !childrenNamed(node, 'en').length &&
        !childrenNamed(node, 'ru').length
      ) {
        Object.assign(previous, this.links.get(node.value));
        this.contextNetwork.linkConcept(previous);
      }
      if (
        !childrenNamed(node, 'en').length &&
        !childrenNamed(node, 'ru').length
      ) {
        continue;
      }
      const concept = parseConcept(node);
      concept.source = source;
      this.add(concept, { local: true });
    }
    return this;
  }

  add(concept, { local = false } = {}) {
    const existing = this.concepts.get(concept.id);
    if (local && existing && existing.source === concept.source) {
      throw new Error(`duplicate concept ${concept.id} in ${concept.source}`);
    }
    if (
      existing &&
      local &&
      existing.source?.endsWith('.lino') &&
      !concept.source?.includes('learned')
    ) {
      throw new Error(
        `concept ${concept.id} defined in ${existing.source} and ${concept.source}`
      );
    }
    if (!local) {
      this.links.add(concept, sourceLayer(concept.source), concept.source);
      concept = {
        ...concept,
        ...this.links.get(concept.id),
        source: existing?.source || concept.source,
      };
    }
    if (existing) {
      // later sources (learned data) only fill gaps in explicitly stored links
      const grounding = existing.grounding || concept.grounding;
      Object.assign(existing, concept);
      if (grounding) {
        existing.grounding = grounding;
      }
      concept = existing;
    }
    this.concepts.set(concept.id, concept);
    this.contextNetwork.linkConcept(concept);
    if (existing) {
      this.byLemma.clear();
      this.byForm.clear();
      this.multiword.clear();
      this.phrases = [];
      for (const entry of this.concepts.values()) {
        this.indexConcept(entry);
      }
    } else {
      this.indexConcept(concept);
    }
  }

  indexConcept(concept) {
    for (const en of concept.en || []) {
      if (en.pos === 'phrase') {
        this.phrases.push({ words: en.words, concept: concept.id });
        continue;
      }
      const key = `${en.pos}:${en.words.join(' ')}`;
      push(this.byLemma, key, concept.id);
      if (en.words.length > 1) {
        push(this.multiword, en.words[0], {
          words: en.words,
          pos: en.pos,
          lemma: en.words.join(' '),
        });
      }
      for (const [feature, form] of irregularForms(en)) {
        push(this.byForm, form.toLowerCase(), {
          pos: en.pos,
          lemma: en.words.join(' '),
          feature,
        });
      }
    }
    this.phrases.sort((a, b) => b.words.length - a.words.length);
  }

  /** Reapply partial corrections after public enrichers mutate concept objects. */
  applyOverrides() {
    const ids = new Set(
      [...this.partialOverrides.values()].map((link) => link.concept)
    );
    for (const id of ids) {
      const concept = this.concepts.get(id);
      if (!concept) {
        continue;
      }
      const links = new Map(
        conceptLinks(concept).map((link) => [link.address, link])
      );
      for (const [address, link] of this.partialOverrides) {
        if (link.concept === id) {
          links.set(address, link);
        }
      }
      Object.assign(concept, linksConcept(id, links.values()));
      this.contextNetwork.linkConcept(concept);
    }
  }

  /** Evidence-only layers are inspectable without participating in sense choice. */
  addEvidence(concepts, layer) {
    for (const concept of concepts) {
      this.links.add(concept, layer);
    }
  }

  /** Include properties enriched after add(), with their actual source. */
  mergedLinks(word) {
    for (const concept of this.concepts.values()) {
      const layer = sourceLayer(concept.source);
      if (layer !== 'overrides') {
        this.links.add(concept, layer, concept.source);
      }
      for (const [key, source] of [
        ['ruFrequency', 'ru.wikipedia'],
        ['ruRank', 'rnc-frequency'],
      ]) {
        if (concept[key] !== undefined) {
          // Frequency belongs to its own layer, not the dictionary layer.
          this.links.remove(
            concept.id,
            (link) => link.path[0] === key && link.layer !== 'overrides'
          );
          this.links.add({ id: concept.id, [key]: concept[key] }, source);
        }
      }
    }
    const wanted = word.toLowerCase();
    const ids = this.links.ids().filter((id) => {
      const c = this.links.get(id);
      return (
        id === word ||
        c.en?.some(
          (en) =>
            (en.lemma || en.words?.join(' ') || '')
              .toLowerCase()
              .replaceAll('+', ' ') === wanted
        )
      );
    });
    return ids.flatMap((id) => this.links.links(id));
  }

  /** Concept ids for a part of speech and English lemma. */
  lookup(pos, lemma) {
    return this.byLemma.get(`${pos}:${lemma.toLowerCase()}`) || [];
  }

  get(id) {
    return this.concepts.get(id);
  }

  /** Dictionary contexts of a meaning (or its id), including ancestors. */
  contextsOf(concept) {
    return this.contextNetwork.contextsOf(concept);
  }

  /** Russian label of a proper name (from Wikidata), if known. */
  nameLabel(name) {
    return this.names?.get(name);
  }

  /** Words already looked up in public sources (found or not). */
  asked(word) {
    return this.askedWords?.has(word) || false;
  }

  markAsked(words) {
    this.askedWords ||= new Set();
    words.forEach((w) => this.askedWords.add(w));
  }

  /**
   * Names of the document being translated (see `documentNames`), and the
   * words it writes in lowercase somewhere.
   */
  setDocumentNames(names, words) {
    this.documentNames = names;
    this.documentWords = words;
  }

  /** Russian noun entry of a name label, for its case forms. */
  nameEntry(name) {
    return this.nameEntries?.get(name);
  }

  setNameEntry(name, entry) {
    this.nameEntries ??= new Map();
    this.nameEntries.set(name, entry);
  }

  setNameLabel(name, label) {
    this.names ??= new Map();
    this.names.set(name, label);
  }

  /** Register an inflected form learned from a source (paid → pay, past). */
  addForm(form, reading) {
    push(this.byForm, form.toLowerCase(), reading);
  }

  /** Irregular readings of an English surface form. */
  irregular(form) {
    return this.byForm.get(form.toLowerCase()) || [];
  }
}

function push(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  const bucket = map.get(key);
  if (!bucket.some((v) => JSON.stringify(v) === JSON.stringify(value))) {
    bucket.push(value);
  }
}

function* irregularForms(en) {
  if (en.plural) {
    yield ['plural', en.plural];
  }
  if (en.past) {
    yield ['past', en.past];
  }
  if (en.participle) {
    yield ['participle', en.participle];
  }
}

let cached = null;

/**
 * Load every `*.lino` file in the data directory (and `learned/`).
 * @param {{dir?: string, fresh?: boolean}} [options]
 * @returns {Lexicon}
 */
export function loadLexicon(options = {}) {
  if (cached && !options.fresh && !options.dir) {
    return cached;
  }
  const dir = options.dir || DATA_DIR;
  const lexicon = new Lexicon();
  const dirs = [dir, join(dir, 'learned')].filter(existsSync);
  for (const d of dirs) {
    for (const name of readdirSync(d)
      .filter((n) => n.endsWith('.lino'))
      .sort()) {
      if (name === 'clients.lino') {
        continue;
      }
      lexicon.addTree(
        parseLino(readFileSync(join(d, name), 'utf8')),
        join(d, name)
      );
    }
  }
  if (!options.dir) {
    cached = lexicon;
  }
  return lexicon;
}
