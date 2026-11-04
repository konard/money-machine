/**
 * Unified concept links. A link address is [concept id, ...property path].
 * Scalar/list fields occupy one address; Russian morphology has one address
 * per property (in particular one per form slot). Arrays retain their order.
 * Existing indented concept notation is accepted alongside lossless links-v1.
 */
import { childrenNamed, field, words } from '../lino.mjs';

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
        pastPassive: attrs['perf-pp'],
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
export function parseConcept(node) {
  if (field(node, 'schema') === 'links-v1') {
    return parseWrittenConcept(node);
  }
  const concept = {
    id: node.value,
    gloss: field(node, 'gloss'),
    grounding: field(node, 'grounded-in') || null,
    excludedGroundings: words(field(node, 'wikidata-exclude')),
    classes: words(field(node, 'class')),
    domain: field(node, 'domain'),
    contexts:
      field(node, 'contexts') === undefined
        ? undefined
        : words(field(node, 'contexts')),
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
  if (field(node, 'source') !== undefined) {
    concept.source = field(node, 'source');
  }
  for (const child of node.children) {
    if (
      !Object.hasOwn(concept, child.name) &&
      field(child, 'json') !== undefined
    ) {
      concept[child.name] = decodeValue(field(child, 'json'));
    }
  }
  return concept;
}

/** Stable, unambiguous addresses (ids and slots may contain punctuation). */
export const addressOf = (id, path) => JSON.stringify([id, ...path]);

export function conceptLinks(concept) {
  const links = [];
  const visit = (value, path) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length
    ) {
      for (const [key, child] of Object.entries(value)) {
        visit(child, [...path, key]);
      }
    } else {
      links.push({
        address: addressOf(concept.id, path),
        concept: concept.id,
        path,
        value,
      });
    }
  };
  for (const [key, value] of Object.entries(concept)) {
    if (key !== 'id') {
      // English readings and ordered evidence lists are single typed links.
      visit(value, [key]);
    }
  }
  return links;
}

export function linksConcept(id, links) {
  const concept = { id };
  // Parents first: an empty object must not overwrite an independently supplied child.
  for (const { path, value } of [...links].sort(
    (a, b) => a.path.length - b.path.length
  )) {
    let parent = concept;
    for (const key of path.slice(0, -1)) {
      if (!parent[key] || typeof parent[key] !== 'object') {
        parent[key] = {};
      }
      parent = parent[key];
    }
    parent[path.at(-1)] = globalThis.structuredClone(value);
  }
  return concept;
}

const ALIASES = {
  'grounded-in': 'grounding',
  'wikidata-exclude': 'excludedGroundings',
  class: 'classes',
  'object-class': 'objectClasses',
};
export const fieldName = (key) =>
  Object.entries(ALIASES).find(([, value]) => value === key)?.[0] || key;

// JSON extensions retain public-source evidence and grammatical properties
// which the original compact ru/en syntax cannot express (including undefined).
export const encodeValue = (value) =>
  JSON.stringify(value, (_, x) => (x === undefined ? { $undefined: true } : x));
export function decodeValue(text) {
  const visit = (x) => {
    if (x && typeof x === 'object') {
      if (x.$undefined === true && Object.keys(x).length === 1) {
        return undefined;
      }
      for (const key of Object.keys(x)) {
        x[key] = visit(x[key]);
      }
    }
    return x;
  };
  return visit(JSON.parse(text));
}

function parseWrittenConcept(node) {
  const concept = { id: node.value };
  for (const child of node.children) {
    if (child.name === 'schema') {
      continue;
    }
    const json = field(child, 'json');
    const value = json === undefined ? child.value : decodeValue(json);
    if (child.name === 'form') {
      const [slot] = words(child.value);
      concept.ru ??= {};
      concept.ru.forms ??= {};
      concept.ru.forms[slot] =
        json === undefined ? words(child.value)[1] : value;
    } else if (
      child.name === 'en' &&
      !Array.isArray(value) &&
      value !== undefined
    ) {
      (concept.en ??= []).push(
        json === undefined ? parseEnglish(child.value) : value
      );
    } else {
      const key = ALIASES[child.name] || child.name;
      if (json === undefined && child.name === 'ru') {
        concept.ru = parseRussian(child.value, node);
      } else if (
        json === undefined &&
        [
          'classes',
          'excludedGroundings',
          'contexts',
          'cues',
          'objectClasses',
          'takes',
        ].includes(key)
      ) {
        concept[key] = words(child.value);
      } else {
        concept[key] = value;
      }
    }
  }
  return concept;
}

/** Only explicitly declared links belong to a local overlay, never defaults. */
export function parseOverlay(node) {
  if (field(node, 'schema') === 'links-v1') {
    return parseConcept(node);
  }
  const parsed = parseConcept(node);
  const out = { id: node.value };
  for (const child of node.children) {
    const key = ALIASES[child.name] || child.name;
    if (Object.hasOwn(parsed, key)) {
      out[key] =
        key === 'ru' && out.ru?.forms
          ? { ...parsed.ru, forms: { ...parsed.ru?.forms, ...out.ru.forms } }
          : parsed[key];
    } else if (child.name === 'source') {
      out.source = child.value;
    } else if (child.name === 'form') {
      const [slot, surface] = words(child.value);
      out.ru ??= {};
      out.ru.forms ??= {};
      out.ru.forms[slot] = surface;
    }
  }
  return out;
}
