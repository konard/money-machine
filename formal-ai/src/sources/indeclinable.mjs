/** Indeclinable nouns missing from English Wiktionary's Russian entries. */
import { chunks, getJson, pool } from './fetch.mjs';

/** Russian Wiktionary's zero-declension noun templates are public morphology. */
export function indeclinableNoun(wikitext, word) {
  const section = wikitext
    .split(/^=\s*\{\{-ru-\}\}\s*=\s*$/m)[1]
    ?.split(/^=\s*[^=]/m)[0];
  if (!section) {
    return null;
  }
  const template = /\{\{сущ ru ([mfn]) (?:in?a|anim|inan) 0\b/.exec(section);
  if (
    !template &&
    !/несклоняем(?:ое|ый|ая)|\{\{сущ[^{}]*\bнескл\b/.test(section)
  ) {
    return null;
  }
  return {
    pos: 'noun',
    lemma: word,
    gender: template?.[1] || 'n',
    animate: false,
    indeclinable: true,
    at: 'в',
  };
}

/** Look up only nouns whose missing paradigm cannot safely be guessed. */
export async function russianIndeclinables(words, options = {}) {
  const out = new Map();
  await pool(chunks([...new Set(words)], 50), 2, async (titles) => {
    const body = await getJson(
      `https://ru.wiktionary.org/w/api.php?${new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        titles: titles.join('|'),
      })}`,
      { ...options, bucket: 'wiktionary' }
    );
    for (const page of body.query?.pages || []) {
      const text = page.revisions?.[0]?.slots?.main?.content;
      const entry = text && indeclinableNoun(text, page.title);
      if (entry) {
        out.set(page.title, entry);
      }
    }
  });
  return out;
}
