/** General Russian lemma ranks from Wiktionary's public RNC frequency appendix.
 * Raw API responses use the shared persistent cache; the index is built once.
 * Numbered pages repeat 1,000-word ranges; lettered pages repeat 250-word
 * ranges within them. Never concatenate those overlapping lists.
 */
import { getJson, pool } from './fetch.mjs';

export const RNC_TITLE =
  'Appendix:Frequency dictionary of the modern Russian language (the Russian National Corpus)';
const API = 'https://en.wiktionary.org/w/api.php';
export const normalizeLemma = (word) =>
  word
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0301/g, '')
    .normalize('NFC')
    .replace(/ё/g, 'е');

/** Parse all three appendix formats, retaining homonyms' original row ranks. */
export function parseRanks(text, offset = 0) {
  const rows = [];
  let rank = offset;
  for (const line of text.split('\n')) {
    if (!/^#\s+/.test(line)) {
      continue;
    }
    const match = line.match(
      /^#\s+(?:\[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*\((\w+)\)|([^,{}]+),\s*(\w+)|\{\{l\|ru\|([^|}]+)\|pos=(\w+)\}\})/
    );
    if (!match) {
      continue;
    }
    rank += 1;
    rows.push([
      normalizeLemma(match[1] || match[3] || match[5]),
      { rank, pos: match[2] || match[4] || match[6] },
    ]);
  }
  return rows;
}

async function load(options) {
  const request = (params) =>
    getJson(`${API}?${new URLSearchParams({ ...params, format: 'json' })}`, {
      ...options,
      bucket: 'rnc-frequency',
    });
  const titles = new Set([RNC_TITLE]);
  let continuation = {};
  do {
    const body = await request({
      action: 'query',
      list: 'allpages',
      apnamespace: '100',
      apprefix: RNC_TITLE.slice('Appendix:'.length),
      aplimit: '500',
      ...continuation,
    });
    if (!body.query?.allpages) {
      throw new Error('Missing RNC appendix listing');
    }
    for (const page of body.query.allpages) {
      if (
        page.title === RNC_TITLE ||
        new RegExp(
          `^${RNC_TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\d+[A-D]?$`
        ).test(page.title)
      ) {
        titles.add(page.title);
      }
    }
    continuation = body.continue;
  } while (continuation);
  const pages = await pool([...titles], 3, async (title) => {
    const body = await request({
      action: 'parse',
      prop: 'wikitext',
      page: title,
    });
    const text = body.parse?.wikitext?.['*'] ?? body.parse?.wikitext;
    if (typeof text !== 'string') {
      throw new Error(`Missing RNC wikitext: ${title}`);
    }
    const suffix = title.slice(RNC_TITLE.length).match(/^\/(\d+)([A-D])?$/);
    const offset = suffix
      ? (Number(suffix[1]) - 1) * 1000 +
        (suffix[2] ? (suffix[2].charCodeAt(0) - 65) * 250 : 0)
      : 0;
    return parseRanks(text, offset);
  });
  const ranks = new Map();
  // The full main-page list is authoritative; subpages fill gaps only.
  for (const rows of pages) {
    for (const [lemma, entry] of rows) {
      if (!ranks.has(lemma)) {
        ranks.set(lemma, entry);
      }
    }
  }
  if (!ranks.size) {
    throw new Error('Empty RNC frequency dictionary');
  }
  return ranks;
}

let pending;
/** Failed loads are retryable. Custom fetch/cache:false calls stay isolated. */
export function russianCorpusRanks(options = {}) {
  if (options.fetchImpl || options.cache === false) {
    return load(options);
  }
  pending ||= load(options).catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
