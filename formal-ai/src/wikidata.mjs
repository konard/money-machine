/**
 * Wikidata as a source of meanings.
 *
 * - `groundLexicon` links concepts to Wikidata items. A candidate item is
 *   accepted only when its Russian label equals the concept's Russian lemma,
 *   so a grounding is evidence that both languages name the same thing, not
 *   a guess. Run `formal-ai ground --write` to store `grounded-in` lines.
 * - `learnNoun` drafts a new noun concept from Wikidata: the item for the
 *   English word, its Russian label, and the grammatical gender (P5185) of
 *   the matching Russian lexeme. Drafts go to `data/learned/nouns.lino` for
 *   review; they carry `source wikidata` so they are easy to audit.
 *
 * Responses are cached under `~/.cache/formal-ai/wikidata`.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DATA_DIR, loadLexicon } from './lexicon.mjs';
import { declineNoun } from './russian/morphology.mjs';

const API = 'https://www.wikidata.org/w/api.php';
const USER_AGENT =
  'formal-ai-translator/0.1 (https://github.com/konard/money-machine)';
const GENDER = { Q499327: 'm', Q1775415: 'f', Q1775461: 'n' };
const NOUN = 'Q1084';
// instances of these are individual works, people or name lists, never the
// general meaning of a common noun
const NOT_A_MEANING = new Set([
  'Q5',
  'Q11424',
  'Q482994',
  'Q134556',
  'Q7366',
  'Q3305213',
  'Q7725634',
  'Q5398426',
  'Q7889',
  'Q215380',
  'Q4167410',
  'Q13442814',
  'Q101352',
  'Q47461344',
  'Q1002697',
]);
const TAXON = 'Q16521';
const ORGANISM_CLASSES = new Set([
  'animal',
  'organism',
  'plant',
  'bird',
  'fish',
]);
/** Response cache directory (resolved on first use, not at import). */
const cacheDir = () =>
  join(
    process.env.XDG_CACHE_HOME || join(homedir(), '.cache'),
    'formal-ai',
    'wikidata'
  );

/** Comparable form of a Russian word. */
export function normalizeRu(word) {
  return String(word || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0301/g, '')
    .normalize('NFC')
    .replace(/ё/g, 'е')
    .trim();
}

async function api(params, { fetchImpl = fetch, cache = true } = {}) {
  const query = new URLSearchParams({ format: 'json', ...params }).toString();
  const key = createHash('sha1').update(query).digest('hex');
  const file = cache ? join(cacheDir(), `${key}.json`) : null;
  if (cache && existsSync(file)) {
    return JSON.parse(readFileSync(file, 'utf8'));
  }
  const response = await fetchImpl(`${API}?${query}`, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Wikidata ${response.status} for ${params.action}`);
  }
  const body = await response.json();
  if (cache) {
    mkdirSync(cacheDir(), { recursive: true });
    writeFileSync(file, JSON.stringify(body));
  }
  return body;
}

/** Items whose English label or alias matches `word`. */
export async function searchItems(word, options) {
  const body = await api(
    {
      action: 'wbsearchentities',
      search: word,
      language: 'en',
      uselang: 'en',
      type: 'item',
      limit: '10',
    },
    options
  );
  return (body.search || []).map((s) => s.id);
}

/** Labels and claims for up to 50 ids. */
export async function getEntities(ids, options) {
  if (!ids.length) {
    return {};
  }
  const body = await api(
    {
      action: 'wbgetentities',
      ids: ids.join('|'),
      props: 'labels|descriptions|claims|lemmas',
      languages: 'en|ru',
    },
    options
  );
  return body.entities || {};
}

/** Words of a concept's gloss, classes and cues, for matching descriptions. */
function conceptWords(concept) {
  return new Set(
    [concept.gloss || '', ...concept.classes, ...concept.cues]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2)
  );
}

/**
 * Items for a concept: search hits whose Russian label is the concept's
 * Russian lemma (or its nominative plural, as taxa are labelled), scored by
 * how many words of the item's English description occur in the concept's
 * gloss, classes and cues.
 * @returns {Promise<{id: string, ru: string, en: string, score: number}[]>}
 */
export async function groundingCandidates(concept, options) {
  const ruLemma = concept.ru.lemma;
  const forms = new Set([normalizeRu(ruLemma)]);
  try {
    forms.add(normalizeRu(declineNoun(concept.ru, 'nom', 'pl')));
  } catch {
    // indeclinable or irregular: lemma only
  }
  const ids = await searchItems(concept.en[0].lemma, options);
  const entities = await getEntities(ids, options);
  const words = conceptWords(concept);
  const out = [];
  ids.forEach((id, rank) => {
    const e = entities[id];
    const ru = e?.labels?.ru?.value;
    if (concept.excludedGroundings?.includes(id)) {
      return;
    }
    if (!ru || !forms.has(normalizeRu(ru))) {
      return;
    }
    const types = (e.claims?.P31 || []).map(
      (c) => c.mainsnak?.datavalue?.value?.id
    );
    if (types.some((t) => NOT_A_MEANING.has(t))) {
      return;
    }
    if (
      types.includes(TAXON) &&
      !concept.classes.some((c) => ORGANISM_CLASSES.has(c))
    ) {
      return;
    }
    // "type of settlement in Estonia": a local variety, not the general sense
    const properName = concept.en[0].pos === 'name';
    if (
      !properName &&
      /\b(?:in|of) (?:the )?[A-Z]/.test(e.descriptions?.en?.value || '')
    ) {
      return;
    }
    const description =
      `${e.labels?.en?.value || ''} ${e.descriptions?.en?.value || ''}`.toLowerCase();
    const overlap = description
      .split(/[^a-z]+/)
      .filter((w) => words.has(w)).length;
    out.push({
      id,
      ru,
      en: e.labels?.en?.value || concept.en[0].lemma,
      description: e.descriptions?.en?.value || '',
      score: overlap - rank * 0.01,
    });
  });
  return out.sort((a, b) => b.score - a.score);
}

/** Back-compatible single lookup. */
export async function findGrounding(enLemma, ruLemma, options) {
  const concept = {
    en: [{ lemma: enLemma }],
    ru: { lemma: ruLemma, gender: 'm' },
    gloss: '',
    classes: [],
    cues: [],
  };
  return (await groundingCandidates(concept, options))[0] || null;
}

/** Grammatical gender of a Russian noun from its Wikidata lexeme. */
export async function russianGender(ruLemma, options) {
  const body = await api(
    {
      action: 'wbsearchentities',
      search: ruLemma,
      language: 'ru',
      uselang: 'ru',
      type: 'lexeme',
      limit: '10',
    },
    options
  );
  const ids = (body.search || []).map((s) => s.id);
  const entities = await getEntities(ids, options);
  for (const id of ids) {
    const lexeme = entities[id];
    const lemma = lexeme?.lemmas?.ru?.value;
    if (
      lexeme?.lexicalCategory !== NOUN ||
      normalizeRu(lemma) !== normalizeRu(ruLemma)
    ) {
      continue;
    }
    for (const claim of lexeme.claims?.P5185 || []) {
      const gender = GENDER[claim.mainsnak?.datavalue?.value?.id];
      if (gender) {
        return { gender, lexeme: id };
      }
    }
  }
  return null;
}

/**
 * Check every concept with a Russian noun, adjective or verb against
 * Wikidata.
 * @param {{write?: boolean, limit?: number, fetchImpl?: Function}} options
 * @returns {Promise<string>} report
 */
export async function groundLexicon({
  write = false,
  limit = 0,
  fetchImpl,
} = {}) {
  const lexicon = loadLexicon({ fresh: true });
  const todo = [...lexicon.concepts.values()].filter(
    (c) =>
      !c.grounding &&
      c.ru &&
      c.en[0] &&
      ['noun'].includes(c.ru.pos) &&
      !c.classes.includes('name')
  );
  const selected = limit ? todo.slice(0, limit) : todo;
  const found = [];
  const missing = [];
  const candidates = new Map();
  for (const concept of selected) {
    try {
      candidates.set(
        concept.id,
        await groundingCandidates(concept, { fetchImpl })
      );
    } catch (error) {
      missing.push({ concept, error: error.message });
    }
  }
  // homonyms: senses that share an English lemma must not share an item,
  // and the item must be preferred by its description, not by search rank
  const senses = (concept) =>
    [...lexicon.concepts.values()].filter(
      (c) =>
        c.id !== concept.id &&
        c.ru?.pos === concept.ru.pos &&
        c.en.some(
          (e) => e.pos === concept.en[0].pos && e.lemma === concept.en[0].lemma
        )
    );
  for (const concept of selected) {
    const list = candidates.get(concept.id);
    if (!list) {
      continue;
    }
    const best = list[0];
    if (!best) {
      missing.push({ concept });
      continue;
    }
    const rivals = senses(concept);
    if (rivals.length) {
      const contested = rivals.some((r) =>
        (candidates.get(r.id) || []).some(
          (h) => h.id === best.id && h.score >= best.score
        )
      );
      if (best.score < 1 || contested) {
        missing.push({
          concept,
          error: `ambiguous with ${rivals.map((r) => r.id).join(', ')}: best hit ${best.id} (${best.description}) not clearly this sense`,
        });
        continue;
      }
    }
    found.push({ concept, hit: best });
  }
  if (write) {
    writeGroundings(found);
  }
  const lines = [
    `checked ${selected.length} concepts: ${found.length} grounded, ${missing.length} without a matching item`,
  ];
  for (const { concept, hit } of found) {
    lines.push(
      `  + ${concept.id} → ${hit.id} (${hit.en} / ${hit.ru}; ${hit.description}; overlap ${Math.round(hit.score)})`
    );
  }
  for (const { concept, error } of missing) {
    lines.push(
      `  - ${concept.id}: ${error || `no item labelled "${concept.ru.lemma}" among hits for "${concept.en[0].lemma}"`}`
    );
  }
  if (!write && found.length) {
    lines.push('run with --write to store these groundings');
  }
  return lines.join('\n');
}

/** Insert `grounded-in` lines right after each `concept <id>` line. */
function writeGroundings(found) {
  const byId = new Map(found.map(({ concept, hit }) => [concept.id, hit.id]));
  for (const name of readdirSync(DATA_DIR).filter((f) => f.endsWith('.lino'))) {
    const file = join(DATA_DIR, name);
    const lines = readFileSync(file, 'utf8').split('\n');
    let changed = false;
    const out = [];
    for (const line of lines) {
      out.push(line);
      const m = /^concept (\S+)\s*$/.exec(line);
      if (m && byId.has(m[1])) {
        out.push(`  grounded-in ${byId.get(m[1])}`);
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(file, out.join('\n'));
    }
  }
}

/**
 * Draft a noun concept for an English word from Wikidata.
 * @returns {Promise<string>} the Links Notation written (or that would be)
 */
export async function learnNoun(word, { dryRun = false, fetchImpl } = {}) {
  const lexicon = loadLexicon({ fresh: true });
  if (lexicon.lookup('noun', word.toLowerCase()).length) {
    return `"${word}" is already in the lexicon`;
  }
  const ids = await searchItems(word, { fetchImpl });
  const entities = await getEntities(ids, { fetchImpl });
  const item = ids
    .map((id) => entities[id])
    .find((e) => e?.labels?.ru?.value && /^[а-яё-]+$/i.test(e.labels.ru.value));
  if (!item) {
    return `no Wikidata item for "${word}" with a one-word Russian label`;
  }
  const ru = item.labels.ru.value.toLowerCase();
  const gender = await russianGender(ru, { fetchImpl });
  if (!gender) {
    return `found ${item.id} (${ru}) but no Russian noun lexeme with a gender; add it by hand`;
  }
  const animate = (item.claims?.P31 || []).some((c) =>
    ['Q5', 'Q729', 'Q16521'].includes(c.mainsnak?.datavalue?.value?.id)
  );
  const id = lexicon.get(word.toLowerCase())
    ? `${word.toLowerCase()}.${item.id.toLowerCase()}`
    : word.toLowerCase();
  const text = [
    '',
    `concept ${id}`,
    `  grounded-in ${item.id}`,
    `  gloss "${(item.labels.en?.value || word).replace(/"/g, "'")}"`,
    '  source wikidata',
    `  en noun ${word.toLowerCase()}`,
    `  ru noun ${ru} ${gender.gender}${animate ? ' anim' : ''}`,
    '',
  ].join('\n');
  if (!dryRun) {
    mkdirSync(join(DATA_DIR, 'learned'), { recursive: true });
    appendFileSync(join(DATA_DIR, 'learned', 'nouns.lino'), text);
  }
  return text.trim();
}
