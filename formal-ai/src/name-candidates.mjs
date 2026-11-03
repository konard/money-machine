/** Words of a text that may be names, asked of Wikidata. */

import { tokenize } from './english/analyze.mjs';
import { loadLexicon } from './lexicon.mjs';

/** Capitalized words and acronyms that may be names (PayPal, Google, KYC). */
export function nameCandidates(text, lexicon = loadLexicon()) {
  const out = new Set();
  const clean = text
    .replace(/```[\s\S]*?```|`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)|https?:\/\/\S+|<[^>]+>/g, ' ');
  const tokens = tokenize(clean);
  const capital = (t) => t?.kind === 'word' && /^[A-Z]/.test(t.text);
  for (let i = 0; i < tokens.length; i += 1) {
    if (!capital(tokens[i]) || tokens[i].text === 'I') {
      continue;
    }
    // Try longest spans first, including shorter spans when a sentence's
    // first capitalized word precedes the actual name ("Visit Hong Kong").
    let end = i + 1;
    while (capital(tokens[end])) {
      end += 1;
    }
    for (let j = end; j > i; j -= 1) {
      const name = tokens
        .slice(i, j)
        .map((t) => t.text)
        .join(' ');
      if (
        !lexicon.lookup('name', name.toLowerCase()).length &&
        !lexicon.nameLabel(name)
      ) {
        out.add(name);
      }
    }
  }
  return [...out];
}
