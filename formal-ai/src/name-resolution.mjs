/** Exact Wikidata names, contextual ranking and Russian declensions. */
import { loadLexicon } from './lexicon.mjs';
import { chunks, getJson, pool } from './sources/fetch.mjs';
import { entityContext } from './sources/entity-context.mjs';
import {
  isGivenName,
  givenRank,
  markGivenName,
} from './public-expressions.mjs';
import {
  fetchPages,
  russianTemplates,
  renderRussian,
} from './sources/wiktionary.mjs';
import { russianEntry, regularEntry } from './russian-entry.mjs';

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
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
        !unrelatedPerson(name, e) &&
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
    const given = (id) => givenRank(lexicon, name, entities[id]);
    // the English text names what English calls so: "EU" is an English
    // alias of the European Union, only a Portuguese one of the US
    const english = (id) =>
      ['en', 'mul'].some((l) =>
        [entities[id]?.labels?.[l], ...(entities[id]?.aliases?.[l] || [])].some(
          (a) => a?.value === name
        )
      )
        ? 1
        : 0;
    const id = [...ids].sort(
      (a, b) =>
        given(b) - given(a) ||
        labelled(b) - labelled(a) ||
        english(b) - english(a) ||
        overlap(b, name) - overlap(a, name) ||
        links(b) - links(a)
    )[0];
    hits.set(name, id);
    lexicon.nameEntities ||= new Map();
    lexicon.nameEntities.set(name, entities[id]);
    if (isGivenName(entities[id])) {
      markGivenName(lexicon, name, entities[id]);
    }
    // an abbreviation keeps a Russian abbreviation of the same name
    // (EU → ЕС, the initials of «Европейский союз»), not an older one
    // (US → САСШ, a historical name)
    const label = entities[id]?.labels?.ru?.value?.split(' / ')[0];
    const initials = (label || '')
      .split(/[\s-]+/)
      .filter((w) => w.length > 2)
      .map((w) => w[0].toUpperCase())
      .join('');
    const ru =
      (/^[A-Z]{2,5}$/.test(name) &&
        (entities[id]?.aliases?.ru || []).find(
          (a) => /^[А-ЯЁ]{2,5}$/.test(a.value) && a.value === initials
        )?.value) ||
      label;
    // only a Cyrillic label is a translation; a different Latin label
    // means the search hit another thing (MRR → a magazine)
    // An appended subtype does not translate the acronym itself.
    const subtype =
      /^[A-Z0-9]{2,6}$/.test(name) &&
      [`${name}-`, `${name} `].some((prefix) => ru?.startsWith(prefix));
    if (ru && !subtype && !/\(|,/.test(ru) && /[а-яё]/i.test(ru)) {
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
export async function declineNames(hits, { lexicon, fetchImpl, cache }) {
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

/** A lone nickname/alias cannot identify an unrelated full-name human. */
function unrelatedPerson(name, entity) {
  const human = (entity?.claims?.P31 || []).some(
    (claim) => claim.mainsnak?.datavalue?.value?.id === 'Q5'
  );
  const label = entity?.labels?.en?.value || entity?.labels?.mul?.value;
  return human && !/\s/.test(name) && /\s/.test(label || '');
}
