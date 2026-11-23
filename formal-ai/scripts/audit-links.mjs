#!/usr/bin/env node
/** Compare Kaikki topics/tags with our own parser, without changing translations.
 * node formal-ai/scripts/audit-links.mjs bank free plan tax run
 */
import {
  kaikkiLinks,
  compareKaikkiCoverage,
} from '../src/sources/link-adapters.mjs';
import {
  englishEntries,
  fetchPages,
  definitionUsage,
} from '../src/sources/wiktionary.mjs';
import { publicSenses } from '../src/sources/sense-data.mjs';

const words = process.argv.slice(2);
const options = { sources: { kaikki: true } };
const pages = await fetchPages(words, options);
for (const word of words) {
  try {
    const kaikki = await kaikkiLinks(word, options);
    const entries = new Map([[word, englishEntries(pages.get(word) || '')]]);
    const own = ['noun', 'verb', 'adj', 'adv'].flatMap((pos) =>
      publicSenses(entries, word, pos)
    );
    const definitions = entries
      .get(word)
      .flatMap((entry) => entry.rawDefinitions.map(definitionUsage));
    console.log(
      JSON.stringify({
        word,
        translationSenseCoverage: compareKaikkiCoverage(kaikki, own),
        definitionCoverage: compareKaikkiCoverage(kaikki, definitions),
      })
    );
  } catch (error) {
    console.error(`${word}: ${error.message}`);
    process.exitCode = 1;
  }
}
