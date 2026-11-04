/** Opt-in public evidence adapters. They never change translation rankings. */
import { getJson } from './fetch.mjs';
import { SOURCES, bucketEnabled } from './registry.mjs';
import { findEnglishLexemes, translatedSenses, claimIds } from './lexemes.mjs';

const english = (word, pos = 'noun') => ({
  pos,
  ...(pos === 'phrase' ? {} : { lemma: word }),
  words: word.toLowerCase().split(/\s+/),
});
const request = (source, params, options) =>
  getJson(`${SOURCES[source].api}?${new URLSearchParams(params)}`, {
    ...options,
    bucket: SOURCES[source].buckets[0],
  });

/** Exact Russian article titles for English multiword terms, including redirects. */
export async function wikipediaLinks(word, options = {}) {
  if (!word.trim().includes(' ')) {
    return [];
  }
  const body = await request(
    'en.wikipedia',
    {
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'langlinks',
      titles: word,
      redirects: '1',
      lllang: 'ru',
      lllimit: 'max',
    },
    options
  );
  return Object.values(body.query?.pages || {}).flatMap((page) => {
    if (Object.hasOwn(page, 'missing')) {
      return [];
    }
    const title = page.langlinks?.find((link) => link.lang === 'ru')?.title;
    return title
      ? [
          {
            id: `enwiki:${page.pageid || page.title}`,
            en: [english(word, 'phrase')],
            ru: { pos: 'phrase', text: title },
            source: 'en.wikipedia',
          },
        ]
      : [];
  });
}

/** Sense ids stay external ids; P5972 is evidence, not an unverified synonym. */
export async function lexemeLinks(word, options = {}) {
  const lexemes = await findEnglishLexemes(word, undefined, options);
  const senses = await translatedSenses(lexemes, options);
  return senses.map((sense) => {
    const lexeme = lexemes.find((l) => l.id === sense.lexeme);
    const raw = lexeme.senses.find((s) => s.id === sense.id);
    const fields = [
      ...new Set([...claimIds(lexeme, 'P9488'), ...claimIds(raw, 'P9488')]),
    ];
    return {
      id: `wikidata:${sense.id}`,
      en: [english(word, sense.pos)],
      ru: sense.russian[0]
        ? { pos: sense.pos, lemma: sense.russian[0].word }
        : null,
      gloss: sense.gloss,
      grounding: sense.items[0] || null,
      items: sense.items,
      contexts: fields,
      translations: sense.translations,
      russianSenses: sense.russian.map(({ word, sense, lexeme, gloss }) => ({
        word,
        sense,
        lexeme,
        gloss,
      })),
      source: 'wikidata-lexemes',
    };
  });
}

/** Sentence co-occurrence, deliberately not word-level translation claims. */
export async function tatoebaLinks(word, options = {}) {
  const body = await request(
    'tatoeba',
    {
      lang: 'eng',
      q: word,
      'trans:lang': 'rus',
      sort: 'relevance',
    },
    options
  );
  return (body.data || []).flatMap((sentence) => {
    if (sentence.is_unapproved || (sentence.lang && sentence.lang !== 'eng')) {
      return [];
    }
    const translations = sentence.translations || [];
    const direct = Array.isArray(translations[0])
      ? translations[0]
      : translations;
    const pairs = direct
      .filter(
        (s) =>
          s?.lang === 'rus' &&
          s.text &&
          !s.is_unapproved &&
          s.is_direct !== false
      )
      .map((s) => ({
        english: sentence.text,
        russian: s.text,
        sentence: sentence.id,
        translation: s.id,
        englishWord: word,
        license: sentence.license,
        translationLicense: s.license,
        russianWords:
          s.text.toLowerCase().match(/[а-яё]+(?:-[а-яё]+)*/gu) || [],
      }));
    return pairs.length
      ? [
          {
            id: `tatoeba:${sentence.id}:${word}`,
            en: [english(word)],
            sentencePairs: pairs,
            source: 'tatoeba',
          },
        ]
      : [];
  });
}

/** Per-sense topics and grammatical/usage tags remain separate evidence. */
export async function kaikkiLinks(word, options = {}) {
  if (!word || /[\r\n]/.test(word)) {
    return [];
  }
  const encoded = encodeURIComponent(word);
  const url = `${SOURCES.kaikki.api}${encodeURIComponent(word.slice(0, 1))}/${encodeURIComponent(word.slice(0, 2))}/${encoded}.jsonl`;
  const body = await getJson(url, {
    ...options,
    bucket: 'kaikki',
    jsonLines: true,
  });
  return (Array.isArray(body) ? body : []).flatMap((entry, entryIndex) =>
    (entry.senses || []).map((sense, i) => ({
      id: `kaikki:${word}:${entry.pos}:${entryIndex}:${i + 1}`,
      en: [english(word, entry.pos)],
      gloss: (sense.glosses || []).join('; '),
      contexts: [...new Set(sense.topics || [])],
      labels: sense.tags || [],
      source: 'kaikki',
    }))
  );
}

/** Compare coverage, not ordinal sense numbers: parsers can split senses differently. */
export function compareKaikkiCoverage(kaikki, wiktionary) {
  const topics = (list) =>
    new Set(list.flatMap((c) => [...(c.contexts || []), ...(c.labels || [])]));
  const a = topics(kaikki);
  const b = topics(wiktionary);
  return {
    kaikkiSenses: kaikki.length,
    wiktionarySenses: wiktionary.length,
    shared: [...a].filter((topic) => b.has(topic)).sort(),
    kaikkiOnly: [...a].filter((topic) => !b.has(topic)).sort(),
    wiktionaryOnly: [...b].filter((topic) => !a.has(topic)).sort(),
  };
}

export const LINK_ADAPTERS = {
  'wikidata-lexemes': lexemeLinks,
  'en.wikipedia': wikipediaLinks,
  tatoeba: tatoebaLinks,
  kaikki: kaikkiLinks,
};

/** Registry order also determines ownership when adapters share addresses. */
export async function loadSourceLinks(word, lexicon, options = {}) {
  for (const [source, spec] of Object.entries(SOURCES)) {
    const adapter = LINK_ADAPTERS[source];
    if (!adapter || !bucketEnabled(spec.buckets[0], options.sources)) {
      continue;
    }
    try {
      lexicon.addEvidence(await adapter(word, options), source);
    } catch (error) {
      // Inspection must make missing evidence visible instead of silently hiding it.
      options.log?.(`${source}: ${error.message}`);
      if (options.strict) {
        throw error;
      }
    }
  }
}
