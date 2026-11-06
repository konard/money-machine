/**
 * How common a Russian word is: the number of Russian Wikipedia articles
 * that contain it (search API total hits). An encyclopedia is not a
 * balanced corpus, so the translator uses this only as a gentle hint that
 * separates living words from rare or archaic ones (платформа 31 000 vs
 * помост 350; роялти 600 vs царственность 40).
 */

import { getJson, pool } from './fetch.mjs';

const API = 'https://ru.wikipedia.org/w/api.php';

/**
 * @param {string[]} words
 * @param {{fetchImpl?: Function, cache?: boolean}} [options]
 * @returns {Promise<Map<string, number>>} word → total hits
 */
export async function russianFrequencies(words, options = {}) {
  const out = new Map();
  await pool([...new Set(words)], 3, async (word) => {
    const body = await getJson(
      `${API}?${new URLSearchParams({
        action: 'query',
        list: 'search',
        format: 'json',
        srlimit: '1',
        srinfo: 'totalhits',
        srprop: '',
        srsearch: `"${word}"`,
      })}`,
      { ...options, bucket: 'ruwiki-frequency' }
    ).catch(() => null);
    const hits = body?.query?.searchinfo?.totalhits;
    if (Number.isFinite(hits)) {
      out.set(word, hits);
    }
  });
  return out;
}
