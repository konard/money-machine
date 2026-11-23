/**
 * The public sources the translator may ask, each a switchable layer
 * (docs/meaning-context-vision.md §2). A disabled source answers as if it
 * had no data, so the translation degrades instead of failing.
 *
 * Switch per call (`options.sources`), per process
 * (`FORMAL_AI_SOURCES="tatoeba=off,ru.wikipedia=off"`) or from the CLI
 * (`--sources ...`). Requests are tagged with a cache bucket; every bucket
 * belongs to exactly one source.
 */
export const SOURCES = {
  'en.wiktionary': {
    api: 'https://en.wiktionary.org/w/api.php',
    buckets: ['wiktionary', 'wiktionary-render', 'wiktionary-reverse'],
    license: 'CC BY-SA 4.0',
    provides:
      'English senses, labels, frames, per-sense Russian translations; Russian entries and inflection',
  },
  'rnc-frequency': {
    api: 'https://en.wiktionary.org/w/api.php',
    buckets: ['rnc-frequency'],
    license: 'CC BY-SA 4.0',
    provides: 'Russian National Corpus frequency lists (Wiktionary appendices)',
  },
  'ru.wiktionary': {
    api: 'https://ru.wiktionary.org/w/api.php',
    buckets: ['wiktionary-ru'],
    license: 'CC BY-SA 4.0',
    provides:
      'Russian senses, government, aspect partners, related and derived words',
  },
  wikidata: {
    api: 'https://www.wikidata.org/w/api.php',
    buckets: ['wikidata'],
    license: 'CC0',
    provides: 'items, labels in both languages, P31/P279 hierarchy, fields',
  },
  'wikidata-lexemes': {
    enabled: false,
    status: 'evidence adapter, default off (not measured for translation)',
    api: 'https://www.wikidata.org/w/api.php',
    buckets: ['wikidata-lexemes'],
    license: 'CC0',
    provides: 'lexeme senses: item (P5137), translation (P5972), field (P9488)',
  },
  'ru.wikipedia': {
    api: 'https://ru.wikipedia.org/w/api.php',
    buckets: ['ruwiki-frequency', 'ruwiki-context'],
    license: 'CC BY-SA 4.0',
    provides: 'Russian usage counts and co-occurrence',
  },
  'en.wikipedia': {
    enabled: false,
    api: 'https://en.wikipedia.org/w/api.php',
    buckets: ['enwiki-langlinks'],
    license: 'CC BY-SA 4.0',
    provides: 'Russian titles of English multiword terms (language links)',
    status: 'evidence adapter, default off (not measured for translation)',
  },
  tatoeba: {
    enabled: false,
    api: 'https://api.tatoeba.org/unstable/sentences',
    buckets: ['tatoeba'],
    license: 'CC BY 2.0 FR',
    provides: 'English–Russian sentence pairs',
    status: 'evidence adapter, default off (not measured for translation)',
  },
  kaikki: {
    enabled: false,
    api: 'https://kaikki.org/dictionary/English/meaning/',
    buckets: ['kaikki'],
    license: 'CC BY-SA 4.0 (Wiktionary)',
    provides: 'Wiktionary parsed to JSON: senses, topics, translations',
    status: 'evidence adapter, default off (not measured for translation)',
  },
  'wikidata-sparql': {
    api: 'https://query.wikidata.org/sparql',
    buckets: ['wikidata-sparql'],
    license: 'CC0',
    provides: 'bulk lexeme and hierarchy queries',
    status: 'reachable, adapter to do',
  },
};

const BY_BUCKET = new Map(
  Object.entries(SOURCES).flatMap(([name, s]) =>
    s.buckets.map((bucket) => [bucket, name])
  )
);

/** The source a cache bucket belongs to. */
export const sourceOf = (bucket) => BY_BUCKET.get(bucket) || null;

/** "a=off,b" → { a: false, b: true } */
export function parseSources(spec = '') {
  return Object.fromEntries(
    spec
      .split(',')
      .map((part) => part.trim().split('='))
      .filter(([name]) => name)
      .map(([name, value = 'on']) => [
        name,
        !/^(?:off|false|no|0)$/i.test(value),
      ])
  );
}

let configured = {};
let fromEnv;

/** Set the process-wide switches (the CLI does this). */
export function configureSources(switches = {}) {
  configured = { ...switches };
}

/** Whether a request of this bucket may be answered. */
export function bucketEnabled(bucket, switches) {
  const name = sourceOf(bucket);
  if (!name) {
    return true;
  }
  fromEnv ??= parseSources(process.env.FORMAL_AI_SOURCES || '');
  return (
    switches?.[name] ??
    configured[name] ??
    fromEnv[name] ??
    SOURCES[name].enabled ??
    true
  );
}
