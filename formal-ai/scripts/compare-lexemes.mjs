#!/usr/bin/env node
/**
 * node formal-ai/scripts/compare-lexemes.mjs [150] [optional-results.json]
 * Cache: FORMAL_AI_CACHE (otherwise getJson's usual user cache).
 * Counts translated senses, not translation candidates; API errors are fatal.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pages, paragraphs } from './sample.mjs';
import { unknownWords } from '../src/resolve.mjs';
import { pool } from '../src/sources/fetch.mjs';
import {
  englishEntries,
  fetchPages,
  renderRussian,
  russianTemplates,
  unstress,
} from '../src/sources/wiktionary.mjs';
import {
  CATEGORIES,
  findEnglishLexemes,
  translatedSenses,
  russianForms,
} from '../src/sources/lexemes.mjs';

const CONTENT = new Set(Object.keys(CATEGORIES));
const INFLECTION =
  /^(plural|past|simple past|past participle|present participle|third-person singular)$/;

/** Frequency-ranked lemmas from site prose; Wiktionary supplies inflection links. */
async function sampleWords(count, options) {
  const text = pages()
    .flatMap(paragraphs)
    .map((p) => p.text)
    .join('\n')
    .replace(/```[\s\S]*?```|`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)|https?:\/\/\S+|<[^>]+>/g, ' ');
  const eligible = new Set(unknownWords(text));
  const frequencies = new Map();
  // Count lowercase words only: product names (Stripe, Amazon, AI) and ordinal
  // suffixes (15th) must not masquerade as common dictionary content words.
  for (const match of text.matchAll(
    /(?<![A-Za-z0-9])([A-Za-z]+(?:-[A-Za-z]+)*)(?![A-Za-z0-9])/g
  )) {
    const word = match[1];
    if (word === word.toLowerCase() && word !== 'as' && eligible.has(word)) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }
  }
  const ranked = [...frequencies]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count * 4);
  const entries = new Map();
  let queue = ranked.map(([w]) => w);
  for (let round = 0; round < 3 && queue.length; round += 1) {
    const fetched = await fetchPages(queue, options);
    for (const title of queue) {
      entries.set(title, englishEntries(fetched.get(title) || ''));
    }
    const next = new Set();
    for (const title of queue) {
      for (const e of entries.get(title)) {
        for (const other of [
          ...e.formOf.map((f) => f.lemma),
          ...e.see.map((s) => s.page),
          ...(e.subpage ? [`${title}/translations`] : []),
        ]) {
          if (!entries.has(other)) {
            next.add(other);
          }
        }
      }
    }
    queue = [...next];
  }
  const lemmas = new Map();
  for (const [word, frequency] of ranked) {
    const list = (entries.get(word) || []).filter(
      (e) => CONTENT.has(e.pos) && !e.rare
    );
    if (!list.length) {
      continue;
    }
    const inflected = list
      .flatMap((e) => e.formOf)
      .filter((f) => INFLECTION.test(f.kind))
      .sort(
        (a, b) =>
          (frequencies.get(b.lemma) || 0) - (frequencies.get(a.lemma) || 0)
      )[0];
    // Retain a word's own lexical senses (e.g. an adjective beside a verb form).
    // Include translation subpages here: run's own senses precede its archaic
    // form-of link to rin; paid without translated own senses leads to pay.
    const hasOwnMeaning = wiktionarySenses(word, entries).length > 0;
    const lemma = inflected && !hasOwnMeaning ? inflected.lemma : word;
    if (!/^[a-z][a-z-]+$/.test(lemma)) {
      continue;
    }
    lemmas.set(lemma, (lemmas.get(lemma) || 0) + frequency);
  }
  const picked = [...lemmas]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count);
  if (picked.length !== count) {
    throw new Error(
      `Only ${picked.length} content lemmas found for requested ${count}`
    );
  }
  return { picked, entries, candidateSurfaceWords: ranked.length };
}

function wiktionarySenses(word, entries) {
  const own = entries.get(word) || [];
  const out = [];
  for (const pos of CONTENT) {
    const list = own.filter((e) => e.pos === pos && !e.rare);
    const all = [
      ...list,
      ...(entries.get(`${word}/translations`) || []).filter(
        (e) => e.pos === pos
      ),
    ];
    const senses = all.flatMap((e) => [
      ...e.senses,
      ...e.see.flatMap((s) =>
        (entries.get(s.page) || [])
          .filter((x) => x.pos === pos)
          .flatMap((x) => x.senses)
      ),
      ...e.formOf
        .filter((f) => !INFLECTION.test(f.kind))
        .flatMap((f) =>
          (entries.get(f.lemma) || [])
            .filter((x) => x.pos === pos)
            .flatMap((x) => x.senses)
        ),
    ]);
    const seen = new Set();
    for (const s of senses) {
      if (s.russian.length && !seen.has(s.gloss)) {
        seen.add(s.gloss);
        out.push({ ...s, pos });
      }
    }
  }
  return out;
}

export async function compare(count = 150, options = {}) {
  const baseFetch = options.fetchImpl || fetch;
  options = {
    ...options,
    fetchImpl: async (url, init) => {
      const response = await baseFetch(url, init);
      return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        json: async () => {
          const value = await response.json();
          if (value.error) {
            const { code, info } = value.error;
            throw Object.assign(new Error(`${code}: ${info}`), {
              fatal: !/too-busy|maxlag|ratelimited/.test(code),
            });
          }
          return value;
        },
      };
    },
  };
  const { picked, entries, candidateSurfaceWords } = await sampleWords(
    count,
    options
  );
  console.error(
    `Comparing ${picked.length} frequent content lemmas (pool 2; cached APIs).`
  );
  let done = 0;
  const rows = await pool(picked, 2, async ([word, frequency]) => {
    const wikt = wiktionarySenses(word, entries);
    const lexemes = await findEnglishLexemes(word, undefined, options);
    const all = await translatedSenses(lexemes, options);
    const senses = all.filter((s) => s.russian.length);
    const top = senses[0]?.russian[0];
    const forms = top ? await russianForms(top.entity, options) : null;
    done += 1;
    if (done % 10 === 0) {
      console.error(`${done}/${count}`);
    }
    return {
      word,
      frequency,
      wiktionary: wikt.length,
      lexemes: senses.length,
      wiktTop: wikt[0]?.russian[0]?.word || null,
      wiktPos: wikt[0]?.pos || null,
      lexemeTop: top?.word || null,
      agree:
        wikt.length && top
          ? unstress(wikt[0].russian[0].word).toLowerCase() ===
            top.word.toLowerCase()
          : null,
      lexemeForms: forms?.forms.size || 0,
      lexemeRawForms: forms?.rawForms.length || 0,
      englishLexemes: lexemes.length,
      englishSenses: all.length,
      groundedSenses: all.filter((s) => s.items.length).length,
      lexemeDetails: senses.map((s) => ({
        id: s.id,
        pos: s.pos,
        gloss: s.gloss,
        items: s.items,
        russian: s.russian.map(({ word, sense, lexeme }) => ({
          word,
          sense,
          lexeme,
        })),
      })),
    };
  });
  // Measure actual rendered Wiktionary forms for the first candidate, separately.
  const ruPages = await fetchPages(
    [...new Set(rows.map((r) => r.wiktTop).filter(Boolean))],
    options
  );
  const formsByWord = new Map();
  const wanted = new Map(
    rows.filter((r) => r.wiktTop).map((r) => [`${r.wiktPos}:${r.wiktTop}`, r])
  );
  await pool([...wanted], 2, async ([key, row]) => {
    const word = row.wiktTop;
    const e = russianTemplates(ruPages.get(word) || '').find(
      (x) => x.pos === row.wiktPos && x.headword
    );
    formsByWord.set(
      key,
      e ? (await renderRussian(word, e, options)).forms.size : 0
    );
  });
  for (const row of rows) {
    row.wiktForms = formsByWord.get(`${row.wiktPos}:${row.wiktTop}`) || 0;
  }
  const n = (predicate) => rows.filter(predicate).length;
  const summary = {
    words: rows.length,
    candidateSurfaceWords,
    wiktionaryCovered: n((r) => r.wiktionary > 0),
    lexemesCovered: n((r) => r.lexemes > 0),
    both: n((r) => r.wiktionary > 0 && r.lexemes > 0),
    lexemesOnly: n((r) => !r.wiktionary && r.lexemes > 0),
    wiktionaryOnly: n((r) => r.wiktionary > 0 && !r.lexemes),
    neither: n((r) => !r.wiktionary && !r.lexemes),
    agree: n((r) => r.agree === true),
    disagree: n((r) => r.agree === false),
    wiktionarySenses: rows.reduce((s, r) => s + r.wiktionary, 0),
    lexemeTranslatedSenses: rows.reduce((s, r) => s + r.lexemes, 0),
    englishLexemesFound: n((r) => r.englishLexemes > 0),
    englishSenses: rows.reduce((s, r) => s + r.englishSenses, 0),
    groundedSenses: rows.reduce((s, r) => s + r.groundedSenses, 0),
    lexemeTopWithForms: n((r) => r.lexemeForms > 0),
    lexemeTopWithRawForms: n((r) => r.lexemeRawForms > 0),
    wiktTopWithForms: n((r) => r.wiktForms > 0),
  };
  return { date: new Date().toISOString(), summary, rows };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const count = Number(process.argv[2] || 150);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Count must be a positive integer');
  }
  const result = await compare(count);
  console.log(
    '| Word | Freq | Wikt senses | Lexeme senses | Wikt top | Lexeme top | Agree | Forms W/L |'
  );
  console.log('| --- | ---: | ---: | ---: | --- | --- | --- | --- |');
  for (const r of result.rows) {
    console.log(
      `| ${r.word} | ${r.frequency} | ${r.wiktionary} | ${r.lexemes} | ${r.wiktTop || '—'} | ${r.lexemeTop || '—'} | ${r.agree === null ? '—' : r.agree ? 'yes' : 'no'} | ${r.wiktForms}/${r.lexemeForms} |`
    );
  }
  console.log(`\n${JSON.stringify(result.summary, null, 2)}`);
  if (process.argv[3]) {
    writeFileSync(process.argv[3], `${JSON.stringify(result, null, 2)}\n`);
  }
}
