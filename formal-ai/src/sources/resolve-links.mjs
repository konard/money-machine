/** Keep source evidence loading outside the size-limited translation pre-pass. */
import { populateContexts as populatePublicContexts } from './context-data.mjs';
import { loadSourceLinks } from './link-adapters.mjs';
import { pool } from './fetch.mjs';

export async function populateContexts(lexicon, options = {}) {
  await populatePublicContexts(lexicon, options);
  await pool(options.words || [], 3, (word) =>
    loadSourceLinks(word, lexicon, options)
  );
  lexicon.applyOverrides();
}
