/** Resolve vocabulary, senses and Russian forms from public dictionaries. */

import { supplementTerms } from './sources/terms.mjs';
import { entityContext } from './sources/entity-context.mjs';
import { learnHyphenated, hyphenatedTitles } from './hyphenated.mjs';
import { readings, tokenize } from './english/analyze.mjs';
import { completeForms, sameFormPasts } from './forms.mjs';
import { compoundCandidates } from './compounds.mjs';
import {
  phraseCandidates,
  publicEntries,
  learnPhrases,
  givenNameLabel,
  markGivenName,
  isGivenName,
} from './public-expressions.mjs';
import { russianIndeclinables } from './sources/indeclinable.mjs';
import { russianFrequencies } from './sources/frequency.mjs';
import { contextFrequencies } from './sources/context-frequency.mjs';
import {
  borrowGenus,
  genus,
  senseClasses,
  usagePenalty,
  publicSenses,
  senseDomain,
  glossWords,
} from './sources/sense-data.mjs';
import {
  russianCorpusRanks,
  normalizeLemma,
} from './sources/rnc-frequency.mjs';
import { loadLexicon } from './lexicon.mjs';
import { compoundNoun, regularEntry, russianEntry } from './russian-entry.mjs';

export { compoundNoun, regularEntry };
import { chunks, getJson, pool } from './sources/fetch.mjs';
import { governmentPages, governmentResolver } from './sources/government.mjs';
import {
  fetchPages,
  languageSection,
  renderRussian,
  russianTemplates,
  unstress,
} from './sources/wiktionary.mjs';

const POS_RU = { noun: 'noun', verb: 'verb', adj: 'adj', adv: 'adv' };
const FEATURE = {
  plural: 'plural',
  past: 'past',
  'simple past': 'past',
  'past participle': 'participle',
  'ed-form': 'past',
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
    // a preposition may be a content word too ("like", "near", "past"),
    // and so may "there" ("went there"):
    // only other grammatical words are never looked up
    const closed = found.some(
      (r) =>
        ![
          'propn',
          'noun',
          'verb',
          'adj',
          'adv',
          'name',
          'prep',
          'there',
        ].includes(r.pos)
    );
    if (!closed && !lexicon.asked?.(w)) {
      out.add(w);
    }
  }
  return [...out];
}

/**
 * Words written with a capital inside sentences that the lexicon does not
 * know: names mostly, but also months and weekdays ("in January").
 */
export function capitalizedWords(text, lexicon = loadLexicon()) {
  const out = new Set();
  for (const line of text.replace(/```[\s\S]*?```|`[^`]*`/g, ' ').split('\n')) {
    const tokens = tokenize(line);
    for (const [i, t] of tokens.entries()) {
      if (
        i > 0 &&
        t.kind === 'word' &&
        /^\p{Lu}\p{Ll}+$/u.test(t.text) &&
        !/^[.!?:#*\-–—|>"(]$/.test(tokens[i - 1].text) &&
        !lexicon.lookup('noun', t.lower).length &&
        !lexicon.asked?.(t.lower)
      ) {
        out.add(t.lower);
      }
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
  {
    lexicon = loadLexicon(),
    fetchImpl,
    cache = true,
    topic = '',
    givenOnly = new Set(),
  } = {}
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
  // Network completion order must not change entity/declension request batches.
  const orderedHits = [...hits].sort(([a], [b]) => a.localeCompare(b));
  hits.clear();
  orderedHits.forEach(([name, ids]) => hits.set(name, ids));
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
        (!givenOnly.has(name) || isGivenName(e)) &&
        (verified.get(name)?.has(id) ||
          Object.values(e?.labels || {}).some((a) => a.value === name) ||
          Object.values(e?.aliases || {})
            .flat()
            .some((a) => a.value === name))
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
        Number(isGivenName(entities[b])) - Number(isGivenName(entities[a])) ||
        labelled(b) - labelled(a) ||
        overlap(b, name) - overlap(a, name) ||
        links(b) - links(a)
    )[0];
    hits.set(name, id);
    if (isGivenName(entities[id])) {
      markGivenName(lexicon, name, entities[id]);
    }
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
      if (lexicon.givenNames?.has(name)) {
        entry.animate = true;
      }
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
  const capitalOf = new Map(); // "Monday" → "monday"
  const phrases = only ? [] : phraseCandidates(text);
  const dictionaryNames = new Map();
  // two-word terms are asked for too; most such titles do not exist
  let queue = [
    ...new Set([
      ...(only ? words : [...words, ...compoundCandidates(text, lexicon)]),
      ...hyphenatedTitles(words),
    ]),
  ];
  // a capitalized word inside a sentence is learned only as a time word
  // ("in January"); as anything else it is a name
  const timeOnly = new Set(
    only
      ? []
      : capitalizedWords(text, lexicon).filter((w) => !queue.includes(w))
  );
  for (const w of timeOnly) {
    const upper = w[0].toUpperCase() + w.slice(1);
    capitalOf.set(upper, w);
    queue.push(upper);
  }
  // "monday", "march", "english": the page titled with a capital too
  for (const w of [...queue]) {
    const upper = w[0].toUpperCase() + w.slice(1);
    if (/^\p{Ll}[\p{Ll}-]*$/u.test(w) && !queue.includes(upper)) {
      capitalOf.set(upper, w);
      queue.push(upper);
    }
  }
  // a word asked under its capital title ("January") is no phrase
  const phraseOnly = new Set(
    phrases.filter((p) => !queue.includes(p) && !timeOnly.has(p))
  );
  queue.push(...phrases.filter((p) => !queue.includes(p) && !lexicon.asked(p)));
  for (let round = 0; round < 3 && queue.length; round += 1) {
    const pages = await fetchPages(queue, options);
    queue.forEach((q) => done.add(q));
    const next = new Set();
    for (const title of queue) {
      const page = pages.get(title);
      const key = capitalOf.get(title) || title;
      if (page && /^[A-Z][a-z]+$/.test(title)) {
        const label = givenNameLabel(page);
        if (label) {
          lexicon.setNameLabel(title, label);
          markGivenName(lexicon, title, page);
          dictionaryNames.set(title, null);
        }
      }
      // a capitalized page ("January", "English" the language) holds the
      // word's proper-noun meanings; they stand beside the word's own
      const list = (page ? publicEntries(page) : [])
        .filter(
          (e) =>
            // "January" is a month and also a given name: only an entry
            // that is nothing but a given name is left to names
            !e.rawDefinitions.length ||
            !e.rawDefinitions.every((d) =>
              /\{\{given name\|en(?:\||\}\})/.test(d)
            )
        )
        .map((e) =>
          key === title
            ? e
            : { ...e, pos: e.pos === 'propn' ? 'noun' : e.pos, capital: true }
        );
      if (!page) {
        continue;
      }
      entries.set(key, [...(entries.get(key) || []), ...list]);
      for (const e of list) {
        if (phraseOnly.has(title) && !['intj', 'phrase'].includes(e.pos)) {
          continue;
        }
        const promote = (target) => {
          if (!phraseOnly.has(title) && phraseOnly.delete(target)) {
            next.add(target);
          }
        };
        for (const f of e.formOf) {
          promote(f.lemma);
          // "Sundays" → "Sunday": a capital page's base is learned under
          // the lowercase word too
          const lemma =
            key !== title && /^\p{Lu}\p{Ll}+$/u.test(f.lemma)
              ? f.lemma.toLowerCase()
              : f.lemma;
          if (lemma !== f.lemma) {
            capitalOf.set(f.lemma, lemma);
          }
          forms.push({ form: key, lemma, kind: f.kind, pos: e.pos });
          // a variant ("doc" ← "document") borrows the target's senses,
          // so the target page is needed even when the lexicon knows it
          const variantOf = /alternative|spelling/.test(f.kind);
          if (
            !done.has(f.lemma) &&
            (variantOf || !lexicon.lookup(e.pos, lemma).length)
          ) {
            next.add(f.lemma);
          }
        }
        for (const s of e.see) {
          promote(s.page);
          if (!done.has(s.page)) {
            next.add(s.page);
          }
        }
        if (e.subpage && !done.has(`${title}/translations`)) {
          next.add(`${title}/translations`);
          if (key !== title) {
            capitalOf.set(`${title}/translations`, `${key}/translations`);
          }
        }
      }
    }
    queue = [...next];
  }
  log(`wiktionary: ${words.length} unknown words, ${entries.size} pages`);

  // English sense → Russian candidates
  const plans = [];
  const sensesOf = (title, pos) => publicSenses(entries, title, pos);
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
        phraseOnly.has(title) ||
        e.rare ||
        (e.pos !== 'verb' && lexicon.lookup(e.pos, title).length)
      ) {
        continue;
      }
      // Inflections use the base's senses rather than a lexicalized homonym.
      if (
        list.some(
          (x) =>
            x.pos === e.pos &&
            // "read": past of itself; its own senses still count
            x.formOf.some(
              (f) =>
                FEATURE[f.kind] &&
                f.lemma !== title &&
                // a base nobody translates ("run" ← Scots "rin") does not
                // displace the word's own senses
                (lexicon.lookup(e.pos, f.lemma).length > 0 ||
                  sensesOf(f.lemma, e.pos).some((z) => z.russian?.length))
            )
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
              !timeOnly.has(title) ||
              (e.pos === 'noun' && senseClasses(s).includes('time'))
          )
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

  if (!only) {
    plans.push(
      ...(await supplementTerms(text, {
        entries,
        plans,
        lexicon,
        words,
        forms,
        options,
      }))
    );
  }

  // Russian words: fetch pages, keep candidates whose entry has the same POS
  const russianWords = new Set();
  for (const plan of plans) {
    for (const s of plan.senses) {
      s.russian.forEach((c) => {
        russianWords.add(c.word);
        // the words of «домашняя страница» decline one by one
        if (['noun', 'adv'].includes(plan.pos) && c.word.includes(' ')) {
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
    const list = page ? russianTemplates(page) : [];
    for (const e of list) {
      // a homograph that is also a word of its own stays itself: есть
      // "eat" (not a form of быть), полка "shelf" (not of полок)
      if (
        !e.headword &&
        e.lemma &&
        !list.some((x) => x.pos === e.pos && x.headword)
      ) {
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
  const government = await governmentPages(
    plans
      .filter((p) => p.pos === 'verb')
      .flatMap((p) => p.senses.flatMap((s) => s.russian.map((c) => c.word)))
      .concat(
        [...partners],
        [...russianWords].filter(
          (w) => !languageSection(ruPages.get(w) || '', 'Russian')
        )
      ),
    options
  );

  const rendered = new Map();
  const want = [];
  for (const plan of plans) {
    for (const s of plan.senses) {
      const words = s.russian.flatMap((c) =>
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
    .flatMap((p) => p.senses.flatMap((s) => s.russian))
    .map((c) => c.word)
    .filter(
      (w) =>
        /^[а-яё-]+$/i.test(w) &&
        /[иуюое]$/.test(w) &&
        !rendered.get(`noun:${w}`)
    );
  const indeclinables = await russianIndeclinables(uncertainNouns, options);
  const russian = (word, pos, candidate, renderedOnly) => {
    if (pos === 'noun' && word.includes(' ')) {
      return compoundNoun(word, (w) => russian(w, 'noun', { word: w }));
    }
    if (pos === 'noun' && indeclinables.has(word)) {
      return indeclinables.get(word);
    }
    const r = rendered.get(`${pos}:${word}`);
    if (r) {
      const entry = russianEntry(pos, word, r.result, r.entry.headword);
      if (entry.pos === 'noun' && candidate) {
        // the translation's own marks: машина|f, деньги|f-p
        if (!r.result.gender && candidate.gender) {
          entry.gender = candidate.gender;
        }
        if (
          candidate.plural &&
          !entry.pluraliaTantum &&
          entry.forms?.['pl.nom']
        ) {
          entry.pluraliaTantum = true;
          entry.lemma = entry.forms['pl.nom'];
        }
      }
      return entry;
    }
    if (
      pos === 'adv' &&
      word
        .split(' ')
        .every(
          (w) =>
            languageSection(ruPages.get(w) || '', 'Russian') ||
            /=\s*\{\{-ru-\}\}\s*=/.test(government.get(w) || '')
        )
    ) {
      return { pos: 'adv', lemma: word, regular: true };
    }
    // Regular morphology needs lexical attestation, not merely a plausible
    // Cyrillic ending. A verified Russian concept label is evidence too.
    return candidate &&
      !renderedOnly &&
      (candidate.attested ||
        /=\s*\{\{-ru-\}\}\s*=/.test(government.get(word) || '') ||
        russianTemplates(ruPages.get(word) || '').some(
          (e) => e.pos === POS_RU[pos]
        ))
      ? regularEntry(pos, candidate)
      : null;
  };

  const { choose, finish: finishVerb } = governmentResolver({
    russian,
    ruPages,
    government,
    lexicon,
  });
  const resolved = learnPhrases(phrases, entries, sensesOf, lexicon);
  for (const plan of plans) {
    let rank = 0;
    const ownSenses = plan.senses.some(
      (s) => !s.variant && !s.side && s.russian.length
    );
    // the most widely translated of the word's own senses
    const most = Math.max(
      0,
      ...plan.senses
        .filter((s) => !s.variant && !s.side)
        .map((s) => s.languages || 0)
    );
    plan.senses.forEach((s, i) => {
      const sense = { ...s, lemma: plan.lemma };
      const ru = choose(s.russian, POS_RU[plan.pos], sense);
      if (!ru) {
        return;
      }
      if (ru.pos === 'verb') {
        finishVerb(ru, sense);
        // a -ся verb takes no direct object: keep a transitive
        // alternative for clauses with one ("try this" → пробовать)
        if (
          /ся$/.test(ru.lemma) &&
          !ru.experiencer &&
          !ru.government.preposition &&
          ru.government.case === 'acc'
        ) {
          const transitive = s.russian
            .map((c) => russian(c.word, 'verb'))
            .find(
              (x) =>
                x && !/ся$/.test(x.lemma) && x.lemma !== ru.perfective?.lemma
            );
          if (transitive) {
            ru.transitive = finishVerb(transitive, sense);
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
        related: s.side || undefined,
        grounding: null,
        excludedGroundings: [],
        classes: plan.pos === 'noun' ? senseClasses(s) : [],
        genus:
          s.borrowed && plan.pos === 'noun' ? genus(s.definition) : undefined,
        cues: glossWords(
          `${s.gloss} ${s.definition || ''} ${s.context || ''} ${(s.labels || []).join(' ')}`,
          plan.lemma
        ),
        capital: s.capital || undefined,
        usagePenalty: usagePenalty(s),
        // the most widely translated sense is the word's core meaning even
        // under a field label ("telephone", labelled telephony)
        domain: senseDomain(s),
        core: Boolean(most && (s.languages || 0) >= most),
        objectClasses: [],
        syntax:
          plan.pos === 'adv' &&
          /(?:form|forming|mark).*comparative/i.test(s.gloss)
            ? 'degree'
            : null,
        takes: [],
        // translation tables follow the definitions, which are ordered by
        // history more than by frequency: a gentle preference only
        // a variant's senses ("app" ← "appearance") are far less likely
        // than the word's own ones
        // and how widely each sense is translated says more about how
        // common it is ("pen": the enclosure is listed first, the
        // writing tool is translated into 129 languages, the enclosure 47)
        prior:
          (s.variant || s.side ? (ownSenses ? 0.05 : 0.15) : 0.3) *
          (most
            ? 0.4 / Math.sqrt(rank + 1) +
              0.6 * Math.sqrt(Math.min(1, (s.languages || 0) / most))
            : 1 / Math.sqrt(rank + 1)) *
          (s.rare && !(most && (s.languages || 0) >= most) ? 0.3 : 1),
        variant: s.variant || undefined,
        en: [
          {
            pos: plan.pos,
            lemma: plan.lemma,
            words: plan.lemma.toLowerCase().split(/\s+/),
          },
        ],
        ru,
        source: s.source || 'wiktionary',
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
      if (f.kind === 'ed-form') {
        lexicon.addForm(f.form, {
          pos: f.pos,
          lemma: f.lemma,
          feature: 'participle',
        });
      }
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
  const names = nameCandidates(text, lexicon);
  const internal = new Set(
    [...text.matchAll(/\b[a-z][a-z'-]*[,;(]?\s+([A-Z][a-z]+)\b/g)].map(
      (m) => m[1]
    )
  );
  const givenOnly = new Set(
    names.filter(
      (n) =>
        !(
          internal.has(n) ||
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
        )
    )
  );
  await resolveNames(names, { lexicon, fetchImpl, cache, topic, givenOnly });
  await declineNames(dictionaryNames, { lexicon, fetchImpl, cache });
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
