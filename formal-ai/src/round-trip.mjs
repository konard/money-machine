import { meaningFeatures } from './meaning-ranges.mjs';
import { glossWords, publicSenses } from './sources/sense-data.mjs';
/** Lexical attestation of a meaning, distinct from sentence correctness. */
import { fetchPages, plain, unstress } from './sources/wiktionary.mjs';

const normalize = (s) => unstress(s).toLowerCase().trim();
const english = (concept) =>
  new Set(
    [...(concept.en || []).map((e) => e.lemma), ...(concept.synonyms || [])]
      .filter(Boolean)
      .map(normalize)
  );
const result = (status, source) => ({
  status,
  score: status === 'survives' ? 1 : status === 'anotherMeaning' ? -1 : 0,
  source,
});

/** Nested templates are allowed in the en= field of a Russian translation block. */
export function russianTranslations(page = '') {
  const sections = page.split(/^=+\s*\{\{-ru-\}\}\s*=+\s*$/m);
  if (sections.length > 1) {
    page = sections[1].split(/^=+\s*\{\{-[a-z-]+-\}\}\s*=+/m)[0];
  } else if (/\{\{-[a-z-]+-\}\}/.test(page)) {
    return [];
  }
  const out = [];
  for (const match of page.matchAll(/\{\{перев-блок\|/g)) {
    let depth = 1;
    let end = match.index + match[0].length;
    for (; end < page.length && depth; end += 1) {
      if (page.slice(end, end + 2) === '{{') {
        depth += 1;
        end += 1;
      } else if (page.slice(end, end + 2) === '}}') {
        depth -= 1;
        end += 1;
      }
    }
    const block = page.slice(match.index + match[0].length, end - 2);
    const field = /(?:^|\|)en\s*=([\s\S]*?)(?=\n?\|[a-z-]+\s*=|$)/.exec(
      block
    )?.[1];
    if (!field) {
      continue;
    }
    const terms = [
      ...[...field.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)].map((m) => m[1]),
      ...[...field.matchAll(/\{\{(?:t\+?|l|trad)\|en\|([^|}]+)/g)].map(
        (m) => m[1]
      ),
      ...field
        .replace(/\{\{[^{}]*\}\}/g, '')
        .replace(/\[\[[^\]]*\]\]/g, '')
        .split(/[,;\n]/),
    ]
      .map((s) => normalize(plain(s)))
      .filter((s) => /^[a-z]+(?:[ -][a-z]+)*$/.test(s));
    out.push({ gloss: block.split('|')[0].trim(), terms });
  }
  return out;
}

/** Only same-sense English tables prove identity for a polysemous word. */
export function lexicalRoundTrip(
  concept,
  { senses = [], russianPage = '' } = {}
) {
  const lemma = normalize(concept?.ru?.lemma || '');
  if (!lemma) {
    return result('unknown');
  }
  const tables = senses.filter((s) => s.gloss === concept.gloss);
  const lists = (s) => s.russian?.some((r) => normalize(r.word) === lemma);
  if (tables.some(lists)) {
    return result('survives', 'English same-sense translation table');
  }
  // A return to the same spelling under a different gloss is not identity.
  if (tables.length && senses.some(lists)) {
    return result(
      'anotherMeaning',
      'English different-sense translation table'
    );
  }
  const wanted = english(concept);
  const blocks = russianTranslations(russianPage);
  if (blocks.some((b) => b.terms.some((t) => wanted.has(t)))) {
    // Without a same-sense English table, a homonym cannot be disambiguated
    // just by seeing its spelling on the Russian side.
    const polysemous = new Set(senses.map((s) => s.gloss)).size > 1;
    if (!polysemous) {
      return result('survives', 'Russian English translation block');
    }
  }
  return result('unknown');
}

/** Load once in the resolver, never during synchronous sense scoring. */
export async function roundTripEvidence(plans, entries, government, options) {
  const pages = new Map(government);
  const tables = new Map();
  const memo = new Map();
  const check = (concept) => {
    const word = concept.en?.[0]?.lemma;
    const pos = concept.en?.[0]?.pos;
    const key = `${word}:${pos}`;
    if (!tables.has(key)) {
      tables.set(key, publicSenses(entries, word, pos));
    }
    const senses = tables.get(key);
    const identity = `${key}:${concept.gloss}:${concept.ru?.lemma}`;
    if (memo.has(identity)) {
      return memo.get(identity);
    }
    const synonyms = [word, `${word}/translations`].flatMap((w) =>
      (entries.get(w) || []).flatMap((e) =>
        (e.see || [])
          .filter((r) => r.synonym && r.gloss === concept.gloss)
          .map((r) => r.page)
      )
    );
    const evidence = lexicalRoundTrip(
      { ...concept, synonyms: [...(concept.synonyms || []), ...synonyms] },
      { senses, russianPage: pages.get(concept.ru?.lemma) }
    );
    memo.set(identity, evidence);
    return evidence;
  };
  const words = [
    ...new Set(
      plans.flatMap((p) =>
        p.senses.flatMap((s) =>
          s.russian
            .filter(
              (r) =>
                check({
                  gloss: s.gloss,
                  en: [{ lemma: p.lemma, pos: p.pos }],
                  ru: { lemma: r.word },
                }).status === 'unknown'
            )
            .map((r) => r.word)
        )
      )
    ),
  ];
  try {
    const extra = await fetchPages(
      words.filter((w) => !pages.has(w)),
      { ...options, language: 'ru' }
    );
    extra.forEach((v, k) => pages.set(k, v));
  } catch (error) {
    if (!error.offline) {
      throw error;
    }
  }
  // Union all observed English tables listing each Russian lemma, not just
  // the table that justified the selected concept. Keep Russian polysemy too.
  const ranges = new Map();
  for (const plan of plans) {
    for (const sense of plan.senses) {
      for (const ru of sense.russian) {
        const key = `${plan.pos}:${normalize(ru.word)}`;
        if (!ranges.has(key)) {
          ranges.set(key, new Set());
        }
        const features = meaningFeatures({
          ...sense,
          en: [{ lemma: plan.lemma }],
        });
        features.forEach((word) => ranges.get(key).add(word));
      }
    }
  }
  const reverse = new Map();
  check.range = (plan, ru) => {
    const key = `${plan.pos}:${normalize(ru.lemma)}`;
    if (!reverse.has(key)) {
      const terms = russianTranslations(pages.get(ru.lemma)).flatMap((b) =>
        b.terms.flatMap((term) => glossWords(term))
      );
      reverse.set(key, [...new Set([...(ranges.get(key) || []), ...terms])]);
    }
    return reverse.get(key);
  };
  memo.clear();
  check.meaning = (sense, plan, ru) =>
    check({
      gloss: sense.gloss,
      en: [{ lemma: plan.lemma, pos: plan.pos }],
      ru,
    });
  return check;
}
