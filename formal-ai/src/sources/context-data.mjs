/** Wiktionary topic labels → exact Wikidata field labels → bounded P279. */
import { getJson, chunks } from './fetch.mjs';
import { expandContextDefinitions } from './context-definitions.mjs';

const api = (params, options) =>
  getJson(
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`,
    { ...options, bucket: 'wikidata' }
  );

export async function populateContexts(lexicon, options = {}) {
  const network = lexicon.contextNetwork;
  if (!network) {
    return;
  }
  const labels = new Set(
    [...lexicon.concepts.values()].flatMap((c) => [
      ...network.directContextsOf(c),
    ])
  );
  if (options.context) {
    labels.add(network.id(options.context));
  }
  const maxDepth = Math.min(8, Math.max(0, options.contextDepth ?? 3));
  network.horizon = maxDepth;
  for (const label of labels) {
    if (network.loaded.has(label) || network.overrides.has(label)) {
      continue;
    }
    network.loaded.add(label);
    if (!network.links.has(label)) {
      network.define(label);
    }
    try {
      const search = await api(
        {
          action: 'wbsearchentities',
          search: label,
          language: 'en',
          type: 'item',
          limit: '5',
        },
        options
      );
      const hit =
        search.search?.find((s) => s.label === label) ||
        search.search?.find(
          (s) =>
            String(s.match?.text || s.label || '').toLowerCase() === label &&
            !/^\p{Lu}/u.test(s.label || '')
        );
      if (!hit) {
        continue;
      }
      const names = new Map([[hit.id, label]]);
      let pending = [hit.id];
      const seen = new Set();
      for (let depth = 0; pending.length && depth <= maxDepth; depth += 1) {
        const next = new Set();
        for (const batch of chunks(
          pending.filter((id) => !seen.has(id)).slice(0, 50),
          50
        )) {
          batch.forEach((id) => seen.add(id));
          const body = await api(
            {
              action: 'wbgetentities',
              ids: batch.join('|'),
              props: 'labels|descriptions|claims',
              languages: 'en',
            },
            options
          );
          const entities = body.entities || {};
          for (const [id, entity] of Object.entries(entities)) {
            const name =
              names.get(id) ||
              entity?.labels?.en?.value?.toLowerCase() ||
              id.toLowerCase();
            names.set(id, name);
            network.alias(id, name);
            if (entity?.descriptions?.en?.value) {
              network.descriptions.set(name, entity.descriptions.en.value);
            }
          }
          for (const [id, entity] of Object.entries(entities)) {
            const parents =
              depth < maxDepth
                ? (entity?.claims?.P279 || [])
                    .flatMap((c) => c.mainsnak?.datavalue?.value?.id || [])
                    .slice(0, 8)
                : [];
            // A depth cut must not erase parents another label fetched.
            if (parents.length) {
              network.define(
                names.get(id),
                parents.map((p) => names.get(p) || p.toLowerCase())
              );
            } else if (!network.links.has(network.id(names.get(id)))) {
              network.define(names.get(id));
            }
            parents.forEach((p) => next.add(p));
          }
        }
        pending = [...next].filter((id) => !seen.has(id));
      }
      // References created before a parent's English label arrived remain aliases.
      for (const link of network.links.values()) {
        if (/^q\d+$/i.test(link.source)) {
          link.source = network.id(link.source);
        }
        if (/^q\d+$/i.test(link.target)) {
          link.target = network.id(link.target);
        }
      }
    } catch (error) {
      network.loaded.delete(label);
      if (error.offline) {
        continue;
      }
      options.log?.(`context ${label}: ${error.message}`);
    }
  }
  if (options.context) {
    await expandContextDefinitions(lexicon, options.context, options);
  }
}
