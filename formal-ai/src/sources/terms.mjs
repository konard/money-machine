import { compoundCandidates } from '../compounds.mjs';
import { compoundFits } from './sense-data.mjs';
/** Exact public concept labels supplement missing dictionary translations. */
import { chunks, getJson, pool } from './fetch.mjs';
import { plain } from './wiktionary.mjs';

const API = 'https://www.wikidata.org/w/api.php';

/**
 * Search whole terms, never translate a fuzzy search hit. Only conceptual
 * items (subclasses, rather than named instances such as books or people)
 * with a Russian label can supply common-noun vocabulary.
 */
export async function termSenses(titles, options = {}) {
  const hits = new Map();
  const request = (params) =>
    getJson(`${API}?${new URLSearchParams(params)}`, {
      ...options,
      bucket: 'wikidata',
    }).catch(() => ({}));
  await pool([...new Set(titles)], 2, async (title) => {
    const body = await request({
      action: 'wbsearchentities',
      format: 'json',
      search: title,
      language: 'en',
      uselang: 'en',
      type: 'item',
      limit: '5',
    });
    hits.set(
      title,
      (body.search || [])
        .filter((h) => h.label === title || h.match?.text === title)
        .map((h) => h.id)
    );
  });
  // Keep subsequent batches independent of parallel search completion order.
  const orderedHits = [...hits].sort(([a], [b]) => a.localeCompare(b));
  hits.clear();
  orderedHits.forEach(([title, ids]) => hits.set(title, ids));
  const entities = {};
  for (const ids of chunks([...new Set([...hits.values()].flat())], 50)) {
    const body = await request({
      action: 'wbgetentities',
      format: 'json',
      ids: ids.join('|'),
      props: 'labels|aliases|descriptions|claims|sitelinks',
      languages: 'ru|en|mul',
    });
    Object.assign(entities, body.entities || {});
  }
  const plans = [];
  for (const [lemma, ids] of hits) {
    const senses = ids.flatMap((id) => {
      const e = entities[id];
      const names = [e?.labels?.en, ...(e?.aliases?.en || [])];
      const word = e?.labels?.ru?.value;
      if (
        !e?.claims?.P279?.length ||
        !names.some((n) => n?.value === lemma) ||
        !word ||
        !/^[а-яё -]+$/i.test(word)
      ) {
        return [];
      }
      return [
        {
          gloss: e.descriptions?.en?.value || e.labels.en.value,
          russian: [{ word, attested: true }],
          source: 'wikidata',
          entity: id,
        },
      ];
    });
    if (senses.length) {
      plans.push({ lemma, pos: 'noun', senses });
    }
  }
  return plans;
}

/** Add missing lemmas, preserving dictionary inflections and compositional phrases. */
export async function supplementTerms(
  text,
  { entries, plans, lexicon, words, forms, options }
) {
  const missingTerms = [...entries]
    .filter(
      ([title, list]) =>
        words.includes(title) &&
        !forms.some((f) => f.form === title) &&
        /^[a-z]+(?: [a-z]+)*$/.test(title) &&
        !lexicon.lookup('noun', title).length &&
        !plans.some(
          (p) =>
            p.lemma === title &&
            p.senses.some((s) => s.russian.length && !s.variant && !s.side)
        ) &&
        list.some(
          (e) =>
            e.pos === 'noun' &&
            e.rawDefinitions.length &&
            !e.formOf.length &&
            !e.rare
        )
    )
    .map(([title]) => title);
  const compounds = compoundCandidates(text, lexicon).filter(
    (title) =>
      !plans.some(
        (p) => p.lemma === title && p.senses.some((s) => s.russian.length)
      )
  );
  const terms = await termSenses([...missingTerms, ...compounds], options);
  for (const plan of terms) {
    const definitions = (entries.get(plan.lemma) || [])
      .filter((e) => e.pos === 'noun')
      .flatMap((e) => e.rawDefinitions);
    if (definitions.length === 1) {
      plan.senses.forEach((s) => {
        s.definition = plain(definitions[0].split('\n')[0]);
      });
    }
  }
  return terms.filter(
    (p) =>
      !p.lemma.includes(' ') ||
      entries
        .get(p.lemma)
        ?.some((e) => e.pos === 'noun' && e.rawDefinitions.length) ||
      compoundFits(p, text)
  );
}
