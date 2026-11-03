/** Resolve vocabulary, senses and Russian forms from public dictionaries. */

import { entityContext } from './sources/entity-context.mjs';
import { learnHyphenated, hyphenatedTitles } from './hyphenated.mjs';
import { readings, tokenize } from './english/analyze.mjs';
import { completeForms, sameFormPasts } from './forms.mjs';
import { compoundCandidates } from './compounds.mjs';
import { russianIndeclinables } from './sources/indeclinable.mjs';
import { russianFrequencies } from './sources/frequency.mjs';
import { contextFrequencies } from './sources/context-frequency.mjs';
import { borrowGenus, genus, usagePenalty } from './sources/sense-data.mjs';
import {
  russianCorpusRanks,
  normalizeLemma,
} from './sources/rnc-frequency.mjs';
import { loadLexicon } from './lexicon.mjs';
import { chunks, getJson, pool } from './sources/fetch.mjs';
import {
  englishEntries,
  fetchPages,
  matchingDefinition,
  renderRussian,
  russianTemplates,
  unstress,
} from './sources/wiktionary.mjs';

const STOP = new Set(
  'the a an of to in on for and or by with from at as is are be that which who someone something one ones its it their used being made having into out up over than such any some other e g etc especially usually typically'.split(
    ' '
  )
);
const POS_RU = { noun: 'noun', verb: 'verb', adj: 'adj', adv: 'adv' };
const FEATURE = {
  plural: 'plural',
  past: 'past',
  'simple past': 'past',
  'past participle': 'participle',
};
/** Words of a text that the lexicon has no reading for. */
export function unknownWords(text, lexicon = loadLexicon()) {
  const out = new Set();
  const clean = text
    .replace(/```[\s\S]*?```|`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)|https?:\/\/\S+|<[^>]+>/g, ' ');
  // a line starts a sentence or a list item, whatever ends the line above
  const tokens = clean
    .split('\n')
    .flatMap((line) => tokenize(line).map((t, k) => ({ ...t, lineStart: !k })));
  // a word written only with a capital inside sentences is a name
  // ("works for Google"), not the common word "google"
  const lowercase = new Set(
    tokens.filter((t) => t.text === t.lower).map((t) => t.lower)
  );
  for (const [i, token] of tokens.entries()) {
    const w = token.lower;
    if (
      token.kind !== 'word' ||
      !/^\p{Ll}[\p{Ll}-]*\p{Ll}$/u.test(w) ||
      w.length < 2
    ) {
      continue;
    }
    const initial =
      token.lineStart || /^[.!?:#*\-–—|>"(]$/.test(tokens[i - 1].text);
    if (!initial && token.text !== w && !lowercase.has(w)) {
      continue;
    }
    // a closed-class word is known; a content word is looked up unless
    // public sources were already asked about it (the built-in lexicon
    // may know "deposit" as a verb only)
    const found = readings({ ...token, text: w, first: true }, lexicon);
    const closed = found.some(
      (r) => !['propn', 'noun', 'verb', 'adj', 'adv', 'name'].includes(r.pos)
    );
    if (!closed && !lexicon.asked?.(w)) {
      out.add(w);
    }
  }
  return [...out];
}

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
/** Capitalized words and acronyms that may be names (PayPal, Google, KYC). */
export function nameCandidates(text, lexicon = loadLexicon()) {
  const out = new Set();
  const clean = text
    .replace(/```[\s\S]*?```|`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)|https?:\/\/\S+|<[^>]+>/g, ' ');
  const tokens = tokenize(clean);
  const capital = (t) => t?.kind === 'word' && /^[A-Z]/.test(t.text);
  for (let i = 0; i < tokens.length; i += 1) {
    if (!capital(tokens[i]) || tokens[i].text === 'I') {
      continue;
    }
    // Try longest spans first, including shorter spans when a sentence's
    // first capitalized word precedes the actual name ("Visit Hong Kong").
    let end = i + 1;
    while (capital(tokens[end])) {
      end += 1;
    }
    for (let j = end; j > i; j -= 1) {
      const name = tokens
        .slice(i, j)
        .map((t) => t.text)
        .join(' ');
      if (
        !lexicon.lookup('name', name.toLowerCase()).length &&
        !lexicon.nameLabel(name)
      ) {
        out.add(name);
      }
    }
  }
  return [...out];
}
/**
 * Russian labels of names from Wikidata: the first search hit whose
 * English label or alias is exactly the name.
 */
export async function resolveNames(
  names,
  { lexicon = loadLexicon(), fetchImpl, cache = true, topic = '' } = {}
) {
  const options = { fetchImpl, cache, bucket: 'wikidata' };
  const hits = new Map();
  const verified = new Map();
  await pool(names, 2, async (name) => {
    const body = await getJson(
      `${WIKIDATA}?${new URLSearchParams({ action: 'wbsearchentities', format: 'json', search: name, language: 'en', uselang: 'en', type: 'item', limit: topic ? '50' : '5' })}`,
      options
    ).catch(() => ({}));
    const exact = (body.search || []).filter(
      (h) => h.label === name || h.match?.text === name
    );
    // Search can return an expanded label even for an exact alias (EU).
    // Fetch aliases to verify those results, never accept a fuzzy match.
    const candidates = body.search || [];
    if (candidates.length) {
      hits.set(
        name,
        candidates.map((h) => h.id)
      );
      verified.set(name, new Set(exact.map((h) => h.id)));
    }
  });
  // Fetch descriptions and instance claims before ranking exact aliases.
  const entities = {};
  for (const batch of chunks([...new Set([...hits.values()].flat())], 50)) {
    const body = await getJson(
      `${WIKIDATA}?${new URLSearchParams({ action: 'wbgetentities', format: 'json', ids: batch.join('|'), props: 'labels|aliases|sitelinks|descriptions|claims', ...(topic ? {} : { languages: 'ru|en|mul' }) })}`,
      options
    ).catch(() => ({}));
    Object.assign(entities, body.entities || {});
  }
  const overlap = await entityContext(entities, topic, options);
  const links = (id) => Object.keys(entities[id]?.sitelinks || {}).length;
  for (const [name, candidates] of hits) {
    const ids = candidates.filter((id) => {
      const e = entities[id];
      return (
        verified.get(name)?.has(id) ||
        Object.values(e?.labels || {}).some((a) => a.value === name) ||
        Object.values(e?.aliases || {})
          .flat()
          .some((a) => a.value === name)
      );
    });
    if (!ids.length) {
      hits.delete(name);
      continue;
    }
    // a word is the thing labelled so before one that merely has it as
    // an alias ("José" the given name, not Saint Joseph); acronyms are
    // aliases by nature (EU)
    const labelled = (id) =>
      !/^[A-Z0-9]{2,6}s?$/.test(name) &&
      ['en', 'mul'].some((l) => entities[id]?.labels?.[l]?.value === name)
        ? 1
        : 0;
    const id = [...ids].sort(
      (a, b) =>
        overlap(b, name) - overlap(a, name) ||
        labelled(b) - labelled(a) ||
        links(b) - links(a)
    )[0];
    hits.set(name, id);
    const ru =
      (/^[A-Z]{2,5}$/.test(name) &&
        (entities[id]?.aliases?.ru || []).find((a) =>
          /^[А-ЯЁ]{2,5}$/.test(a.value)
        )?.value) ||
      entities[id]?.labels?.ru?.value?.split(' / ')[0];
    // only a Cyrillic label is a translation; a different Latin label
    // means the search hit another thing (MRR → a magazine)
    if (ru && !/\(|,/.test(ru) && /[а-яё]/i.test(ru)) {
      lexicon.setNameLabel(name, ru);
    } else {
      // Exact entities without a Russian label still form one name.
      lexicon.setNameLabel(name, name);
    }
  }
  await declineNames(hits, { lexicon, fetchImpl, cache });
  return hits;
}
/**
 * Case forms of Russian name labels, from the label's own
 * Wiktionary page (Великобритания → в Великобритании); a word without a
 * page is declined by its ending when that shows a gender.
 */
async function declineNames(hits, { lexicon, fetchImpl, cache }) {
  const options = { fetchImpl, cache };
  const labels = [...hits.keys()]
    .map((name) => [name, lexicon.nameLabel(name)])
    .filter(
      ([, label]) =>
        label &&
        /^[А-ЯЁ][А-ЯЁа-яё -]+$/.test(label) &&
        !/^[А-ЯЁ]{2,5}$/.test(label)
    );
  if (!labels.length) {
    return;
  }
  const pages = await fetchPages(
    [...new Set(labels.map(([, l]) => l))],
    options
  );
  await pool(labels, 4, async ([name, label]) => {
    const page = pages.get(label);
    const e = page
      ? russianTemplates(page).find(
          (x) => ['noun', 'propn'].includes(x.pos) && x.headword
        )
      : null;
    let entry = null;
    if (e) {
      try {
        const rendered = await renderRussian(label, e, options);
        entry = russianEntry('noun', label, rendered, e.headword);
      } catch {
        entry = null;
      }
    }
    entry ||= /[аяь]$|[бвгджзклмнпрстфхцчшщ]$/.test(label)
      ? regularEntry('noun', { word: label })
      : null;
    if (entry) {
      lexicon.setNameEntry(name, entry);
    }
  });
}

const PARTICLES = new Set(
  'up out off down over back away about for in on into with through around along'.split(
    ' '
  )
);
/** "asks for" → "ask for": verb lemma + following particle, as page titles. */
export function phrasalCandidates(text, lexicon = loadLexicon()) {
  const tokens = tokenize(text.replace(/```[\s\S]*?```|`[^`]*`/g, ' '));
  const out = new Set();
  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (t.kind !== 'word' || !next || !PARTICLES.has(next.lower)) {
      return;
    }
    for (const r of readings({ ...t, first: false }, lexicon)) {
      if (r.pos === 'verb') {
        out.add(`${r.lemma} ${next.lower}`);
      }
    }
  });
  return [...out];
}
/** Labels that say how a word is used, not what field it belongs to. */
const USAGE_LABEL =
  /^(?:transitive|intransitive|ditransitive|catenative|ambitransitive|ergative|reflexive|countable|uncountable|informal|colloquial|slang|figurative(?:ly)?|formal|literal(?:ly)?|idiomatic|attributive|plural|singular|in the plural|by extension|now|often|usually|especially|also|chiefly|mainly|sometimes|rare|obsolete|archaic|dated|US|UK|British|American|Canada|Australia|Ireland|NZ|India|Scotland|with|of|_|and|or)$/i;
/**
 * Field of a sense: a field label of its definition (finance, computing)
 * or the field prefix of its translation gloss ("law: demand for…").
 */
function senseDomain(sense) {
  const label = (sense.labels || []).find(
    (l) => /^[a-z][a-z -]{2,24}$/i.test(l) && !USAGE_LABEL.test(l)
  );
  if (label) {
    return label.toLowerCase();
  }
  return sense.seeAlso
    ? null
    : /^([a-z][a-z ]{2,20}): /.exec(sense.gloss)?.[1] || null;
}
/** Content words of a gloss, used as context cues. */
function glossWords(gloss, headword = '') {
  return [
    ...new Set(
      gloss
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 2 && !STOP.has(w) && w !== headword)
    ),
  ];
}

const tag = (forms, ...keys) => keys.map((k) => forms.get(k)).find(Boolean);
/** Lexicon `ru` entry from a rendered Russian word. */
function russianEntry(pos, word, rendered, head) {
  const { forms } = rendered;
  const comparative = tag(forms, 'comd', 'comparative')?.split(',')[0].trim();
  if (pos === 'noun') {
    const cells = {};
    for (const [tags, form] of forms) {
      const m = /^(nom|gen|dat|acc|ins|pre|loc|par|voc)\|([sp])$/.exec(tags);
      if (m && ['nom', 'gen', 'dat', 'acc', 'ins', 'pre'].includes(m[1])) {
        cells[
          `${m[2] === 's' ? 'sg' : 'pl'}.${m[1] === 'pre' ? 'prep' : m[1]}`
        ] = form.split(',')[0].trim();
      }
    }
    if (
      !rendered.indeclinable &&
      !Object.keys(cells).length &&
      /[иуюо]$/.test(word)
    ) {
      return regularEntry('noun', { word, gender: rendered.gender });
    }
    const pluralOnly =
      rendered.pluralOnly || (!cells['sg.nom'] && cells['pl.nom']);
    return {
      pos: 'noun',
      lemma: pluralOnly ? cells['pl.nom'] || word : word,
      gender: rendered.gender || 'm',
      animate: Boolean(rendered.animate),
      pluraliaTantum: Boolean(pluralOnly),
      at: 'в',
      forms: Object.keys(cells).length ? cells : undefined,
      indeclinable: rendered.indeclinable || undefined,
    };
  }
  if (pos === 'verb') {
    const perf = head?.positional?.[1] === 'pf';
    const kind = perf ? 'fut' : 'pres';
    const present = ['1|s', '2|s', '3|s', '1|p', '2|p', '3|p'].map((p) =>
      tag(forms, `${p}|${kind}|ind`)
    );
    return {
      pos: 'verb',
      lemma: word,
      aspect: perf ? 'perf' : 'impf',
      present: present.every(Boolean)
        ? present.map((f) => f.split(',')[0].trim())
        : undefined,
      past: [tag(forms, 'm|s|past|ind'), tag(forms, 'f|s|past|ind')].every(
        Boolean
      )
        ? [tag(forms, 'm|s|past|ind'), tag(forms, 'f|s|past|ind')]
        : undefined,
      imperative: tag(forms, '2|s|imp'),
      converb: tag(forms, 'pres|adv|part')?.split(',')[0].trim(),
      pastPassive:
        unstress(tag(forms, 'past|pass|part')?.split(',')[0] || '').trim() ||
        undefined,
      partner:
        unstress(
          (head?.named?.[perf ? 'impf' : 'pf'] || '').split(',')[0]
        ).trim() || undefined,
    };
  }
  if (pos === 'adj') {
    return {
      pos: 'adj',
      lemma: word,
      comparative,
      short: tag(forms, 'short|m|s')?.split(',')[0],
      shortForms: Object.fromEntries(
        [
          ['m', 'short|m|s'],
          ['f', 'short|f|s'],
          ['n', 'short|n|s'],
          ['p', 'short|p'],
        ]
          .map(([k, t]) => [k, tag(forms, t)?.split(',')[0].trim()])
          .filter(([, v]) => v)
      ),
    };
  }
  return { pos: 'adv', lemma: word, comparative };
}
/** Lexicon `ru` entry for a word without a Wiktionary page, by its ending. */
const ADJECTIVE_FORM = /^[а-яё-]+(?:ый|ий|ой|ая|яя|ое|ее|ые|ие)$/i;
/** Masculine nominative of an agreeing adjective form (`домашняя`). */
function masculine(form) {
  const m = /^(.*?)(ая|яя|ое|ее|ые|ие)$/.exec(form);
  if (!m) {
    return form;
  }
  const soft = /^(яя|ее|ие)$/.test(m[2]) || /[кгхжшщч]$/.test(m[1]);
  return m[1] + (soft ? 'ий' : 'ый');
}
/**
 * A Russian noun phrase translation (`домашняя страница`, `страница
 * товара`): leading adjectives agree with the head noun; the rest is fixed.
 * @param {string} phrase
 * @param {(word: string) => object|null} nounEntry
 */
export function compoundNoun(phrase, nounEntry) {
  const parts = phrase.split(' ');
  if (parts.length > 4 || parts.some((w) => !/^[а-яё-]+$/i.test(w))) {
    return null;
  }
  let i = 0;
  while (i < parts.length - 1 && ADJECTIVE_FORM.test(parts[i])) {
    i += 1;
  }
  const head = nounEntry(parts[i]);
  if (!head || head.pos !== 'noun' || head.compound) {
    return null;
  }
  return {
    ...head,
    lemma: phrase,
    compound: {
      adjectives: parts.slice(0, i).map(masculine),
      head: head.lemma,
      tail: parts.slice(i + 1).join(' '),
    },
  };
}

export function regularEntry(
  pos,
  { word, gender, aspect, plural, indeclinable }
) {
  // a fixed multiword adverb ("в основном") does not inflect
  if (pos === 'adv' && /^[а-яё-]+(?: [а-яё-]+){1,2}$/i.test(word)) {
    return { pos: 'adv', lemma: word, regular: true };
  }
  if (word.includes(' ') || !/^[а-яё-]+$/i.test(word)) {
    return null;
  }
  if (pos === 'verb' && /(ть|ться|ти|чь)$/.test(word)) {
    // -ировать verbs are usually both aspects
    const both = /ировать(ся)?$/.test(word);
    return {
      pos: 'verb',
      lemma: word,
      aspect: aspect === 'pf' && !both ? 'perf' : 'impf',
      regular: true,
    };
  }
  if (pos === 'adj' && /(ый|ий|ой)$/.test(word)) {
    return { pos: 'adj', lemma: word, regular: true };
  }
  if (pos === 'adv' && /[оеи]$/.test(word)) {
    return { pos: 'adv', lemma: word, regular: true };
  }
  if (pos === 'noun') {
    if (indeclinable) {
      return { pos, lemma: word, gender: gender || 'n', indeclinable: true };
    }
    // These endings may belong to foreign stems; only public inflection
    // data can decide whether they decline. Do not invent a paradigm.
    // (native neuter suffixes such as -ство, -ание, -ло still decline)
    if (/[иуюо]$/.test(word) && !/.{3}(?:ств|тв|л|к|н|ч|щ)о$/.test(word)) {
      return null;
    }
    const g =
      { m: 'm', f: 'f', n: 'n' }[gender] ||
      (/[ая]$|ь$/.test(word)
        ? /ь$/.test(word)
          ? null
          : 'f'
        : /[ое]$/.test(word)
          ? 'n'
          : /[бвгджзклмнпрстфхцчшщй]$/.test(word)
            ? 'm'
            : null);
    if (!g) {
      return null;
    }
    return {
      pos: 'noun',
      lemma: word,
      gender: g,
      animate: false,
      pluraliaTantum: Boolean(plural),
      at: 'в',
      regular: true,
    };
  }
  return null;
}
/**
 * Resolve every unknown word of `text` into the lexicon.
 * @returns {Promise<{words: number, resolved: string[], missing: string[]}>}
 */
export async function resolveText(
  text,
  {
    lexicon = loadLexicon(),
    fetchImpl,
    cache = true,
    log = () => {},
    words: only,
    topic = text,
  } = {}
) {
  const options = { fetchImpl, cache };
  const words = only || unknownWords(text, lexicon);
  const done = new Set();
  const entries = new Map(); // lemma → english entries
  const forms = []; // {form, lemma, kind, pos}
  // two-word terms are asked for too; most such titles do not exist
  let queue = [
    ...new Set([
      ...(only ? words : [...words, ...compoundCandidates(text, lexicon)]),
      ...hyphenatedTitles(words),
    ]),
  ];
  for (let round = 0; round < 3 && queue.length; round += 1) {
    const pages = await fetchPages(queue, options);
    queue.forEach((q) => done.add(q));
    const next = new Set();
    for (const title of queue) {
      const page = pages.get(title);
      if (!page) {
        continue;
      }
      const list = englishEntries(page);
      entries.set(title, list);
      for (const e of list) {
        for (const f of e.formOf) {
          forms.push({ form: title, lemma: f.lemma, kind: f.kind, pos: e.pos });
          // a variant ("doc" ← "document") borrows the target's senses,
          // so the target page is needed even when the lexicon knows it
          const variantOf = /alternative|spelling/.test(f.kind);
          if (
            !done.has(f.lemma) &&
            (variantOf || !lexicon.lookup(e.pos, f.lemma).length)
          ) {
            next.add(f.lemma);
          }
        }
        for (const s of e.see) {
          if (!done.has(s.page)) {
            next.add(s.page);
          }
        }
        if (e.subpage && !done.has(`${title}/translations`)) {
          next.add(`${title}/translations`);
        }
      }
    }
    queue = [...next];
  }
  log(`wiktionary: ${words.length} unknown words, ${entries.size} pages`);

  // English sense → Russian candidates
  const plans = [];
  const sensesOf = (title, pos) => {
    const own = entries.get(title) || [];
    const sub = (entries.get(`${title}/translations`) || []).filter(
      (e) => e.pos === pos
    );
    // a translation subpage has no definitions: match the main page's
    const mainDefinitions = own
      .filter((e) => e.pos === pos)
      .flatMap((e) => e.rawDefinitions || []);
    const subSenses = sub.map((e) => ({
      ...e,
      senses: e.senses.map((x) =>
        x.definition
          ? x
          : { ...x, ...matchingDefinition(x.gloss, mainDefinitions) }
      ),
    }));
    return [...own.filter((e) => e.pos === pos), ...subSenses].flatMap((e) => [
      ...e.senses,
      ...e.see.flatMap((s) =>
        (entries.get(s.page) || [])
          .filter((x) => x.pos === pos)
          .flatMap((x) =>
            x.senses.map((sense) => ({
              ...sense,
              gloss: `${s.gloss}: ${sense.gloss}`,
              seeAlso: true,
            }))
          )
      ),
    ]);
  };
  // one plan per (lemma, pos): the word's own senses first, then those of
  // words it is a variant of ("fee" the payment before "fee" ← "fief")
  const own = new Map();
  const variant = new Map();
  const append = (map, key, senses) =>
    map.set(key, [...(map.get(key) || []), ...senses]);
  for (const [title, list] of entries) {
    if (title.endsWith('/translations')) {
      continue;
    }
    for (const e of list) {
      if (
        !POS_RU[e.pos] ||
        e.rare ||
        (e.pos !== 'verb' && lexicon.lookup(e.pos, title).length)
      ) {
        continue;
      }
      // Inflections use the base's senses rather than a lexicalized homonym.
      if (
        list.some(
          (x) => x.pos === e.pos && x.formOf.some((f) => FEATURE[f.kind])
        )
      ) {
        continue;
      }
      const known = lexicon.lookup(e.pos, title).length > 0;
      own.set(
        `${e.pos}:${title}`,
        sensesOf(title, e.pos)
          .filter(
            (s) =>
              !known ||
              s.frames?.some((f) =>
                ['object-to', 'to', 'that', 'question', 'about'].includes(f)
              )
          )
          .map((s) => ({ ...s, frameOnly: known }))
      );
      // "earn" the verb has senses of its own; "earn" as a spelling of
      // "erne" (eagle) in another part of speech would only mislead
      const ownElsewhere = list.some(
        (x) => x.pos !== e.pos && !x.rare && x.senses.length
      );
      if (ownElsewhere && !sensesOf(title, e.pos).length) {
        own.delete(`${e.pos}:${title}`);
        continue;
      }
      for (const f of e.formOf.filter(
        (x) => /alternative|spelling|form$/.test(x.kind) && !FEATURE[x.kind]
      )) {
        append(variant, `${e.pos}:${title}`, sensesOf(f.lemma, e.pos));
      }
    }
  }
  for (const key of new Set([...own.keys(), ...variant.keys()])) {
    const [pos, ...rest] = key.split(':');
    const seen = new Set();
    const senses = [
      ...(own.get(key) || []),
      // a variant's senses are less likely than the word's own
      ...(variant.get(key) || []).map((x) => ({ ...x, variant: true })),
    ].filter((x) => !seen.has(x.gloss) && seen.add(x.gloss));
    if (senses.length) {
      plans.push({ lemma: rest.join(':'), pos, senses: borrowGenus(senses) });
    }
  }

  // Russian words: fetch pages, keep candidates whose entry has the same POS
  const russianWords = new Set();
  for (const plan of plans) {
    for (const s of plan.senses) {
      s.russian.slice(0, 3).forEach((c) => {
        russianWords.add(c.word);
        // the words of «домашняя страница» decline one by one
        if (plan.pos === 'noun' && c.word.includes(' ')) {
          c.word.split(' ').forEach((w) => russianWords.add(w));
        }
      });
    }
  }
  const ruPages = await fetchPages(
    [...russianWords].filter((w) => !w.includes(' ')),
    options
  );
  const ruEntry = (word, pos) => {
    const page = ruPages.get(word);
    const e = page ? russianTemplates(page).find((x) => x.pos === pos) : null;
    return e?.headword ? e : null;
  };
  // a candidate that is only a form of another word stands for that word
  const lemmaOf = new Map();
  for (const word of russianWords) {
    const page = ruPages.get(word);
    for (const e of page ? russianTemplates(page) : []) {
      if (!e.headword && e.lemma) {
        lemmaOf.set(`${e.pos}:${word}`, e.lemma);
      }
    }
  }
  const lemmaPages = await fetchPages(
    [...new Set(lemmaOf.values())].filter((w) => !ruPages.has(w)),
    options
  );
  lemmaPages.forEach((v, k) => ruPages.set(k, v));
  for (const plan of plans) {
    for (const sense of plan.senses) {
      sense.russian = sense.russian.map((c) => {
        const lemma = lemmaOf.get(`${POS_RU[plan.pos]}:${c.word}`);
        return lemma ? { ...c, word: lemma } : c;
      });
    }
  }
  // verb partners (заработать ↔ зарабатывать) need their own pages
  const partners = new Set();
  for (const word of russianWords) {
    const e = ruEntry(word, 'verb');
    const named = e?.headword?.named || {};
    for (const p of [named.pf, named.impf].filter(Boolean)) {
      partners.add(unstress(p.split(',')[0]).trim());
    }
  }
  const partnerPages = await fetchPages(
    [...partners].filter((w) => !ruPages.has(w)),
    options
  );
  partnerPages.forEach((v, k) => ruPages.set(k, v));

  const rendered = new Map();
  const want = [];
  for (const plan of plans) {
    for (const s of plan.senses) {
      const words = s.russian
        .slice(0, 3)
        .flatMap((c) =>
          plan.pos === 'noun' && c.word.includes(' ')
            ? c.word.split(' ').map((word) => ({ word }))
            : [c]
        );
      for (const c of words) {
        const e = ruEntry(c.word, POS_RU[plan.pos]);
        if (e) {
          want.push([c.word, e]);
          const partner =
            e.headword?.named?.[
              e.headword?.positional?.[1] === 'pf' ? 'impf' : 'pf'
            ];
          if (partner) {
            const p = unstress(partner.split(',')[0]).trim();
            const pe = ruEntry(p, 'verb');
            if (pe) {
              want.push([p, pe]);
            }
          }
        }
      }
    }
  }
  await pool(want, 4, async ([word, e]) => {
    const key = `${e.pos}:${word}`;
    if (!rendered.has(key)) {
      rendered.set(key, null);
      try {
        rendered.set(key, {
          entry: e,
          result: await renderRussian(word, e, options),
        });
      } catch (error) {
        log(`render ${word}: ${error.message}`);
      }
    }
  });
  const uncertainNouns = plans
    .filter((p) => p.pos === 'noun')
    .flatMap((p) => p.senses.flatMap((s) => s.russian.slice(0, 3)))
    .map((c) => c.word)
    .filter(
      (w) =>
        /^[а-яё-]+$/i.test(w) &&
        /[иуюое]$/.test(w) &&
        !rendered.get(`noun:${w}`)
    );
  const indeclinables = await russianIndeclinables(uncertainNouns, options);
  const russian = (word, pos, candidate) => {
    if (pos === 'noun' && word.includes(' ')) {
      return compoundNoun(word, (w) => russian(w, 'noun', { word: w }));
    }
    if (pos === 'noun' && indeclinables.has(word)) {
      return indeclinables.get(word);
    }
    const r = rendered.get(`${pos}:${word}`);
    if (r) {
      return {
        ...russianEntry(pos, word, r.result, r.entry.headword),
        ...(r.entry.government ? { government: r.entry.government } : {}),
      };
    }
    // no page of its own: keep the word only when its ending shows the
    // part of speech, so regular morphology can inflect it
    return candidate && !ruPages.has(word)
      ? regularEntry(pos, candidate)
      : null;
  };

  // imperfective lemma with its perfective partner, governing accusative
  const finishVerb = (ru) => {
    const partner = ru.partner ? russian(ru.partner, 'verb') : null;
    if (ru.aspect === 'perf' && partner) {
      Object.assign(ru, {
        ...partner,
        perfective: { ...ru, perfective: undefined },
      });
    } else if (partner) {
      ru.perfective = { ...partner, aspect: 'perf' };
    }
    ru.government ||= { preposition: null, case: 'acc' };
    ru.markerGovernment = {};
    ru.classGovernment = {};
    ru.recipient = 'dat';
    return ru;
  };
  const resolved = [];
  for (const plan of plans) {
    let rank = 0;
    const ownSenses = plan.senses.some((s) => !s.variant && s.russian.length);
    plan.senses.forEach((s, i) => {
      const ru =
        s.russian.map((c) => russian(c.word, POS_RU[plan.pos])).find(Boolean) ||
        s.russian
          .map((c) => russian(c.word, POS_RU[plan.pos], c))
          .find(Boolean);
      if (!ru) {
        return;
      }
      if (ru.pos === 'verb') {
        finishVerb(ru);
        // a -ся verb takes no direct object: keep a transitive
        // alternative for clauses with one ("try this" → пробовать)
        if (/ся$/.test(ru.lemma)) {
          const transitive = s.russian
            .map((c) => russian(c.word, 'verb'))
            .find(
              (x) =>
                x && !/ся$/.test(x.lemma) && x.lemma !== ru.perfective?.lemma
            );
          if (transitive) {
            ru.transitive = finishVerb(transitive);
          }
        }
      }
      const id = `wikt:${plan.lemma}:${plan.pos}:${i + 1}`;
      if (lexicon.get(id)) {
        return;
      }
      lexicon.add({
        id,
        gloss: s.gloss,
        frames: s.frames,
        frameOnly: s.frameOnly,
        related: s.seeAlso || undefined,
        grounding: null,
        excludedGroundings: [],
        classes: [],
        genus:
          s.borrowed && plan.pos === 'noun' ? genus(s.definition) : undefined,
        cues: glossWords(`${s.gloss} ${s.definition || ''}`, plan.lemma),
        usagePenalty: usagePenalty(s),
        domain: senseDomain(s),
        objectClasses: [],
        syntax: null,
        takes: [],
        // translation tables follow the definitions, which are ordered by
        // history more than by frequency: a gentle preference only
        // a variant's senses ("app" ← "appearance") are far less likely
        // than the word's own ones
        prior:
          ((s.variant ? (ownSenses ? 0.05 : 0.15) : 0.3) /
            Math.sqrt(rank + 1)) *
          (s.rare ? 0.3 : 1),
        variant: s.variant || undefined,
        en: [
          {
            pos: plan.pos,
            lemma: plan.lemma,
            words: plan.lemma.toLowerCase().split(/\s+/),
          },
        ],
        ru,
        source: 'wiktionary',
      });
      rank += 1;
      resolved.push(id);
    });
  }
  // how common each candidate translation is, where a word has several
  const ambiguous = resolved
    .map((id) => lexicon.get(id))
    .filter((c) => c?.ru?.lemma && plans.length);
  const lemmas = ambiguous
    .map((c) => c.ru.lemma)
    .filter((w) => !w.includes(' '));
  const frequency = await russianFrequencies(lemmas, options);
  for (const c of ambiguous) {
    if (frequency.has(c.ru.lemma)) {
      c.ruFrequency = frequency.get(c.ru.lemma);
    }
  }
  const corpus = await russianCorpusRanks(options).catch(() => null);
  if (corpus) {
    for (const c of lexicon.concepts.values()) {
      // A phrase's head cannot be inferred safely from word order alone.
      if (!c.ru?.lemma || /\s/.test(c.ru.lemma)) {
        continue;
      }
      const entry = corpus.get(normalizeLemma(c.ru.lemma));
      c.ruRank = entry?.rank;
    }
  }
  for (const f of forms) {
    const feature = FEATURE[f.kind];
    if (feature && lexicon.lookup(f.pos, f.lemma).length) {
      lexicon.addForm(f.form, { pos: f.pos, lemma: f.lemma, feature });
    }
  }
  lexicon.markAsked([...words, ...done]);
  if (!only) {
    await sameFormPasts(text, { lexicon, fetchImpl, cache });
    await completeForms(
      `${text} ${words
        .filter((w) => w.includes('-'))
        .join(' ')
        .replaceAll('-', ' ')}`,
      { lexicon, fetchImpl, cache, log }
    );
  }
  resolved.push(...learnHyphenated(words, lexicon, topic));
  const missing = words.filter(
    (w) =>
      !readings({ text: w, lower: w, kind: 'word', first: true }, lexicon).some(
        (r) => r.pos !== 'propn'
      )
  );
  const names = nameCandidates(text, lexicon).filter(
    (n) =>
      n.includes(' ') ||
      /[.-]/.test(n) ||
      /^[A-Z][A-Z0-9]+s?$/.test(n) ||
      !readings(
        {
          text: n.toLowerCase(),
          lower: n.toLowerCase(),
          kind: 'word',
          first: true,
        },
        lexicon
      ).length
  );
  await resolveNames(names, { lexicon, fetchImpl, cache, topic });
  if (!only) {
    const phrasal = phrasalCandidates(text, lexicon).filter(
      (p) => !lexicon.asked(p)
    );
    if (phrasal.length) {
      const inner = await resolveText('', {
        lexicon,
        fetchImpl,
        cache,
        log,
        words: phrasal,
      });
      resolved.push(...inner.resolved);
    }
  }
  if (!only) {
    await contextFrequencies(text, lexicon, options);
  }
  log(`resolved ${resolved.length} senses; still unknown: ${missing.length}`);
  return { words: words.length, resolved, missing };
}
