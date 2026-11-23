/**
 * Which Wiktionary sense labels name a subject field. {{lb|en|electronics}}
 * is topical; {{lb|en|stative}} or {{lb|en|regional}} is grammar or usage
 * and must not become a context. The list is Wiktionary's own label data
 * (Module:labels/data/topical), read as text, never executed.
 */
import { getJson } from './fetch.mjs';
import { SOURCES } from './registry.mjs';

export const TOPICAL_MODULE = 'Module:labels/data/topical';
let topical = null;

/** labels["name"] = { aliases = {"a", "b"}, Wikidata = "Q1" } → name → {name, wikidata}. */
export function parseLabelModule(text) {
  const out = new Map();
  for (const block of text.split(/\n(?=labels\[")/)) {
    const name = /^labels\["([^"]+)"\]\s*=/.exec(block)?.[1];
    if (!name) {
      continue;
    }
    const entry = {
      name,
      wikidata: /\bWikidata\s*=\s*"(Q\d+)"/.exec(block)?.[1] || null,
    };
    const aliases = /\baliases\s*=\s*\{([^}]*)\}/.exec(block)?.[1] || '';
    for (const key of [
      name,
      ...[...aliases.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    ]) {
      out.set(key.toLowerCase(), entry);
    }
  }
  return out;
}

export async function loadTopicalLabels(options = {}) {
  try {
    const body = await getJson(
      `${SOURCES['en.wiktionary'].api}?${new URLSearchParams({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        titles: TOPICAL_MODULE,
        format: 'json',
        formatversion: '2',
      })}`,
      { ...options, bucket: 'wiktionary' }
    );
    const text = body.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
    if (text) {
      topical = parseLabelModule(text);
    }
  } catch (error) {
    if (!error.offline) {
      options.log?.(`topical labels: ${error.message}`);
    }
  }
  return topical;
}

/** The topical entry for a label; undefined while the list is not loaded. */
export function topicalLabel(label) {
  return topical ? topical.get(String(label).toLowerCase()) || null : undefined;
}
