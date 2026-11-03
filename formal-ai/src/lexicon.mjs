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
import { parseLino, childrenNamed, field, words } from './lino.mjs';

export const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'data'
);

const unquote = (text) => text.replace(/^"(.*)"$/s, '$1');

/** Split `key:value` attribute tokens from flags. */
function attributes(tokens) {
  const attrs = {};
  const flags = new Set();
  for (const token of tokens) {
    const i = token.indexOf(':');
    if (i > 0) {
      attrs[token.slice(0, i)] = token.slice(i + 1);
    } else {
      flags.add(token);
    }
  }
  return { attrs, flags };
}

const list = (value) => (value ? value.split(',') : undefined);

/** Parse an `en <pos> …` line. */
function parseEnglish(value) {
  const [pos, ...rest] = words(value);
  if (pos === 'phrase') {
    return { pos, words: rest.map((w) => w.toLowerCase()) };
  }
  const [lemma, ...forms] = rest;
  const entry = { pos, lemma, words: lemma.toLowerCase().split('+') };
  if (pos === 'noun' && forms[0]) {
    entry.plural = forms[0];
  }
  if (pos === 'verb') {
    if (forms[0]) {
      entry.past = forms[0];
    }
    if (forms[1]) {
      entry.participle = forms[1];
    }
  }
  if (pos === 'adj' && forms[0]) {
    entry.comparative = forms[0];
  }
  return entry;
}

/** Parse a `ru <pos> …` line plus `form` children. */
function parseRussian(value, node) {
  const text = value.trim();
  const pos = text.split(/\s+/)[0];
  if (pos === 'phrase') {
    return { pos, text: unquote(text.slice(pos.length).trim()) };
  }
  const [, lemmaRaw, ...rest] = words(text);
  const lemma = lemmaRaw.replace(/\+/g, ' ');
  const { attrs, flags } = attributes(rest);
  const entry = { pos, lemma };
  if (pos === 'noun') {
    entry.gender = ['m', 'f', 'n'].find((g) => flags.has(g)) || 'm';
    entry.animate = flags.has('anim');
    entry.stressEnd = flags.has('end') || undefined;
    entry.pluraliaTantum = flags.has('plt');
    entry.indeclinable = flags.has('indecl');
    entry.plural = attrs.pl;
    entry.stem = attrs.stem;
    entry.locative = attrs.loc;
    entry.at = attrs.at || 'в';
    entry.when = attrs.when;
    entry.adjective = attrs.adj;
    entry.adverb = attrs.adv;
    const forms = {};
    for (const f of childrenNamed(node, 'form')) {
      const [slot, surface] = words(f.value);
      forms[slot] = surface;
    }
    if (Object.keys(forms).length) {
      entry.forms = forms;
    }
  } else if (pos === 'verb') {
    entry.aspect = 'impf';
    entry.present = list(attrs.pres);
    entry.past = list(attrs.past);
    entry.imperative = attrs.imp;
    if (attrs.perf) {
      entry.perfective = {
        lemma: attrs.perf,
        aspect: 'perf',
        present: list(attrs['perf-pres']),
        past: list(attrs['perf-past']),
        imperative: attrs['perf-imp'],
      };
    }
    if (attrs.hab) {
      entry.habitual = {
        lemma: attrs.hab,
        aspect: 'impf',
        present: list(attrs['hab-pres']),
      };
    }
    entry.government = parseGovernment(attrs.gov || 'acc');
    entry.markerGovernment = Object.fromEntries(
      Object.entries(attrs)
        .filter(([key]) => key.startsWith('gov.'))
        .map(([key, value]) => [key.slice(4), parseGovernment(value)])
    );
    // gov@device:ins – government chosen by the object's concept class
    entry.classGovernment = Object.fromEntries(
      Object.entries(attrs)
        .filter(([key]) => key.startsWith('gov@'))
        .map(([key, value]) => [key.slice(4), parseGovernment(value)])
    );
    entry.recipient = attrs.rec || 'dat';
    entry.motion = flags.has('motion');
    entry.experiencer = flags.has('exp-dat');
    entry.datPredicate = attrs['dat-pred'];
    entry.reflexiveIntransitive = flags.has('refl-intr');
    entry.subjectConcept = attrs.subj;
    entry.prefer = attrs.prefer;
  } else if (pos === 'adj') {
    entry.short = attrs.short;
    entry.predicateShort =
      flags.has('pred:short') || flags.has('pred') || attrs.pred === 'short';
  } else if (pos === 'adv') {
    entry.negative = flags.has('neg');
    entry.direction = attrs.to?.replace(/\+/g, ' ');
  }
  return entry;
}

/**
 * Parse `gov:` values: `acc`, `dat`, `в+acc`, `на+prep`.
 * @returns {{preposition: string|null, case: string}}
 */
export function parseGovernment(value) {
  const [a, b] = value.split('+');
  return b ? { preposition: a, case: b } : { preposition: null, case: a };
}

/** Build a concept from its Links Notation node. */
function parseConcept(node) {
  const concept = {
    id: node.value,
    gloss: field(node, 'gloss'),
    grounding: field(node, 'grounded-in') || null,
    excludedGroundings: words(field(node, 'wikidata-exclude')),
    classes: words(field(node, 'class')),
    cues: words(field(node, 'cues')).map((w) => w.toLowerCase()),
    objectClasses: words(field(node, 'object-class')),
    syntax: field(node, 'syntax') || null,
    takes: childrenNamed(node, 'en')
      .map((n) => words(n.value))
      .filter((w) => w[0] === 'takes')
      .map((w) => w[1]),
    en: childrenNamed(node, 'en')
      .filter((n) => !n.value.startsWith('takes '))
      .map((n) => parseEnglish(n.value)),
    ru: null,
  };
  const ru = childrenNamed(node, 'ru')[0];
  if (ru) {
    concept.ru = parseRussian(ru.value, node);
  }
  return concept;
}

/** In-memory lexicon with English lookup indexes. */
export class Lexicon {
  constructor() {
    this.concepts = new Map();
    this.byLemma = new Map();
    this.byForm = new Map();
    this.multiword = new Map();
    this.phrases = [];
  }

  /** Add every `concept` under a parsed Links Notation root. */
  addTree(root, source = '') {
    for (const node of childrenNamed(root, 'concept')) {
      const concept = parseConcept(node);
      concept.source = source;
      this.add(concept);
    }
    return this;
  }

  add(concept) {
    const existing = this.concepts.get(concept.id);
    if (existing && existing.source === concept.source) {
      throw new Error(`duplicate concept ${concept.id} in ${concept.source}`);
    }
    if (
      existing &&
      existing.source.endsWith('.lino') &&
      !concept.source.includes('learned')
    ) {
      throw new Error(
        `concept ${concept.id} defined in ${existing.source} and ${concept.source}`
      );
    }
    if (existing) {
      // later sources (learned data) only fill gaps
      if (!existing.grounding && concept.grounding) {
        existing.grounding = concept.grounding;
      }
      return;
    }
    this.concepts.set(concept.id, concept);
    for (const en of concept.en) {
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

  /** Concept ids for a part of speech and English lemma. */
  lookup(pos, lemma) {
    return this.byLemma.get(`${pos}:${lemma.toLowerCase()}`) || [];
  }

  get(id) {
    return this.concepts.get(id);
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

  /** Names of the document being translated (see `documentNames`). */
  setDocumentNames(names) {
    this.documentNames = names;
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
