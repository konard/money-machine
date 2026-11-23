/** Experimental Wikidata Lexemes reader; no translator integration. */
import { chunks, getJson } from './fetch.mjs';
import { unstress } from './wiktionary.mjs';

const API = 'https://www.wikidata.org/w/api.php';
export const CATEGORIES = {
  noun: 'Q1084',
  verb: 'Q24905',
  adj: 'Q34698',
  adv: 'Q380057',
};
const request = async (params, options) => {
  // Wikimedia can report overload as HTTP 200. Reject it inside json(), before
  // getJson writes its cache, so its existing retry/backoff also applies here.
  const fetchImpl = async (url, init) => {
    const response = await (options?.fetchImpl || fetch)(url, init);
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      json: async () => {
        const value = await response.json();
        if (value.error) {
          const { code, info } = value.error;
          throw Object.assign(new Error(`Wikidata: ${code}: ${info}`), {
            fatal: !/too-busy|maxlag|ratelimited/.test(code),
          });
        }
        return value;
      },
    };
  };
  const body = await getJson(
    `${API}?${new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      ...params,
    })}`,
    { ...options, fetchImpl, bucket: 'wikidata-lexemes' }
  );
  if (body.error) {
    throw new Error(`Wikidata: ${body.error.code}: ${body.error.info}`);
  }
  return body;
};

/** Full lexemes (default props includes senses/forms); item labels when requested. */
export async function fetchEntities(ids, options = {}, labelsOnly = false) {
  const out = new Map();
  // Batch sequentially: callers can pool words without nested concurrency.
  for (const batch of chunks([...new Set(ids)], 50)) {
    const body = await request(
      {
        ids: batch.join('|'),
        ...(labelsOnly ? { props: 'labels', languages: 'en' } : {}),
      },
      options
    );
    for (const [id, entity] of Object.entries(body.entities || {})) {
      if (!Object.hasOwn(entity, 'missing')) {
        out.set(id, entity);
      }
    }
  }
  return out;
}

/** Non-deprecated entity-valued statements, preferred rank first. */
export function claimIds(entity, property) {
  return [...(entity.claims?.[property] || [])]
    .filter((c) => c.rank !== 'deprecated' && c.mainsnak?.snaktype === 'value')
    .sort(
      (a, b) => Number(b.rank === 'preferred') - Number(a.rank === 'preferred')
    )
    .map((c) => c.mainsnak.datavalue?.value?.id)
    .filter(Boolean);
}

/**
 * Exact English lemma and category, verified against full entities, never labels
 * alone. Search examines the first 50 relevance hits (not an exhaustive dump).
 * Omit category for all four content categories; accept a short POS or Q-id.
 */
export async function findEnglishLexemes(lemma, category, options = {}) {
  const wanted = category ? CATEGORIES[category] || category : null;
  const body = await request(
    {
      action: 'wbsearchentities',
      search: lemma,
      language: 'en',
      uselang: 'en',
      type: 'lexeme',
      limit: '50',
    },
    options
  );
  const ids = (body.search || [])
    .filter((h) => h.label?.toLowerCase() === lemma.toLowerCase())
    .map((h) => h.id);
  const entities = await fetchEntities(ids, options);
  return [...entities.values()].filter(
    (e) =>
      e.language === 'Q1860' &&
      e.lemmas?.en?.value.toLowerCase() === lemma.toLowerCase() &&
      (wanted
        ? e.lexicalCategory === wanted
        : Object.values(CATEGORIES).includes(e.lexicalCategory))
  );
}

/** English senses with glosses, P5137 grounding, and validated Russian P5972 targets. */
export async function translatedSenses(lexemes, options = {}) {
  const senses = lexemes.flatMap((lexeme) =>
    (lexeme.senses || []).map((s) => ({
      id: s.id,
      lexeme: lexeme.id,
      pos: Object.keys(CATEGORIES).find(
        (p) => CATEGORIES[p] === lexeme.lexicalCategory
      ),
      gloss: s.glosses?.en?.value || '',
      glosses: s.glosses || {},
      items: claimIds(s, 'P5137'),
      translations: claimIds(s, 'P5972'),
    }))
  );
  const targets = senses
    .flatMap((s) => s.translations)
    .filter((id) => /^L\d+-S\d+$/.test(id));
  const entities = await fetchEntities(
    targets.map((id) => id.split('-')[0]),
    options
  );
  return senses.map((s) => ({
    ...s,
    russian: s.translations.flatMap((id) => {
      const entity = entities.get(id.split('-')[0]);
      const sense = entity?.senses?.find((x) => x.id === id);
      const word = unstress(entity?.lemmas?.ru?.value);
      if (
        entity?.language !== 'Q7737' ||
        !sense ||
        !word ||
        entity.lexicalCategory !== CATEGORIES[s.pos]
      ) {
        return [];
      }
      return [
        {
          word,
          sense: id,
          lexeme: entity.id,
          gloss: sense.glosses?.ru?.value || sense.glosses?.en?.value || '',
          entity,
        },
      ];
    }),
  }));
}

// Labels are fetched for feature Q-ids, avoiding an unverified numeric id table.
const TAGS = {
  singular: 's',
  plural: 'p',
  'nominative case': 'nom',
  'genitive case': 'gen',
  'dative case': 'dat',
  'accusative case': 'acc',
  'instrumental case': 'ins',
  'prepositional case': 'pre',
  'locative case': 'loc',
  'partitive case': 'par',
  'vocative case': 'voc',
  masculine: 'm',
  feminine: 'f',
  neuter: 'n',
  'first person': '1',
  'second person': '2',
  'third person': '3',
  'first-person singular': '1|s',
  'second-person singular': '2|s',
  'third-person singular': '3|s',
  'first-person plural': '1|p',
  'second-person plural': '2|p',
  'third-person plural': '3|p',
  'past tense': 'past',
  'present tense': 'pres',
  'future tense': 'fut',
  indicative: 'ind',
  imperative: 'imp',
  'imperative mood': 'imp',
  'passive voice': 'pass',
  'active voice': 'act',
  participle: 'part',
  'past participle': 'past|part',
  'passive participle': 'pass|part',
  'past passive participle': 'past|pass|part',
  'short form': 'short',
  'short adjective': 'short',
  infinitive: 'inf',
  animate: 'an',
  inanimate: 'in',
};

function canonicalTags(labels, pos) {
  if (!labels.length || labels.some((l) => !TAGS[l])) {
    return null; // do not silently collapse unknown grammatical distinctions
  }
  const tags = new Set(labels.flatMap((l) => TAGS[l].split('|')));
  const pick = (choices) => choices.split('|').filter((t) => tags.has(t));
  const number = pick('s|p');
  const gender = pick('m|f|n');
  const kase = pick('nom|gen|dat|acc|ins|pre|loc|par|voc');
  if (tags.has('part')) {
    // The renderer consumes the dictionary form of a participle only.
    if (
      number.includes('p') ||
      gender.some((g) => g !== 'm') ||
      kase.some((c) => c !== 'nom')
    ) {
      return null;
    }
    return [...pick('past|pres|fut'), ...pick('pass|act'), 'part'].join('|');
  }
  if (pos === 'verb') {
    const tense = pick('pres|fut|past');
    const mood = tags.has('imp') ? ['imp'] : tense.length ? ['ind'] : [];
    return (
      [
        ...pick('1|2|3'),
        ...gender,
        ...number,
        ...tense,
        ...mood,
        ...pick('inf'),
      ].join('|') || null
    );
  }
  if (tags.has('short')) {
    return ['short', ...gender, ...number].join('|');
  }
  return [...kase, ...gender, ...number, ...pick('an|in')].join('|') || null;
}

/**
 * Russian tagged forms, with the same Map interface as renderRussian.
 * Unknown features remain in rawForms but are omitted from the compatible map.
 * Alternative spellings with the same tags keep the first API form.
 */
export async function russianForms(idOrEntity, options = {}) {
  const entity =
    typeof idOrEntity === 'string'
      ? (await fetchEntities([idOrEntity], options)).get(idOrEntity)
      : idOrEntity;
  if (!entity || entity.language !== 'Q7737') {
    return { forms: new Map(), rawForms: [] };
  }
  const rawForms = entity.forms || [];
  const features = await fetchEntities(
    rawForms.flatMap((f) => f.grammaticalFeatures || []),
    options,
    true
  );
  const pos = Object.keys(CATEGORIES).find(
    (p) => CATEGORIES[p] === entity.lexicalCategory
  );
  const forms = new Map();
  for (const form of rawForms) {
    const labels = (form.grammaticalFeatures || []).map((id) =>
      features.get(id)?.labels?.en?.value?.toLowerCase()
    );
    const tags = canonicalTags(labels, pos);
    const text = unstress(form.representations?.ru?.value);
    if (tags && text && !forms.has(tags)) {
      forms.set(tags, text);
    }
  }
  const gender = { Q499327: 'm', Q1775415: 'f', Q1775461: 'n' }[
    claimIds(entity, 'P5185')[0]
  ];
  const characteristics = claimIds(entity, 'P1552');
  return {
    forms,
    rawForms,
    gender,
    animate: characteristics.includes('Q51927507')
      ? true
      : characteristics.includes('Q51927539')
        ? false
        : undefined,
    pluralOnly: claimIds(entity, 'P31').includes('Q138246'),
  };
}
