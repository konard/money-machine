/** Empty tables may use exact English translations on Russian pages. */
import { getJson, pool } from './fetch.mjs';
import { governmentPages } from './government.mjs';
import { unstress } from './wiktionary.mjs';

const CATEGORIES = {
  verb: 'Русские глаголы',
  noun: 'Русские существительные',
  adj: 'Русские прилагательные',
};

/** A word whose every translation table lacks Russian ("taxable",
 * "consolidation") may be named on Russian pages, in their English lines;
 * adverbs are left out, as particles ("on") would take a full-word sense. */
export async function completeReverseVerbs(plans, options, context) {
  const wanted = new Set([
    ...(context.words || []),
    ...(context.forms || []).map((f) => f.lemma),
  ]);
  const missing = plans.filter(
    (p) =>
      CATEGORIES[p.pos] &&
      wanted.has(p.lemma) &&
      /^[a-z]+$/.test(p.lemma) &&
      !p.senses.some((s) => s.russian.length && !s.side && !s.variant)
  );
  await pool(missing, 2, async (plan) => {
    const body = await getJson(
      `https://ru.wiktionary.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', list: 'search', srsearch: `"${plan.lemma}" incategory:"${CATEGORIES[plan.pos]}"`, srlimit: '10' })}`,
      { ...options, bucket: 'wiktionary-ru' }
    ).catch(() => ({}));
    const titles = (body.query?.search || [])
      .map((s) => s.title)
      .filter((t) => /^[а-яё-]+$/i.test(t));
    const pages = await governmentPages(titles, options);
    for (const [word, text] of pages) {
      const russian =
        text
          .split(/=\s*\{\{-ru-\}\}\s*=/)[1]
          ?.split(/^=\s*\{\{-[a-z]+-\}\}/m)[0] || '';
      // each comma- or semicolon-separated item is one translation; a word
      // linked inside a phrase ("have a [[good]] night's sleep") is not
      const translations = [...russian.matchAll(/^\|en=([^\n]*)/gm)].flatMap(
        (m) =>
          m[1].split(/[,;]/).map((item) =>
            item
              .replace(/\{\{(?:t|trad|п|перевод)\|en\|([^|}]+)[^}]*\}\}/g, '$1')
              .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
              .replace(/\([^)]*\)|<!--.*?-->/g, '')
              .replace(plan.pos === 'verb' ? /^\s*to\s+/ : /^$/, '')
              .trim()
          )
      );
      if (!translations.includes(plan.lemma)) {
        continue;
      }
      // A reverse entry establishes a reading, without aligning unrelated senses.
      plan.senses.push({
        gloss: plan.lemma,
        definition: plan.lemma,
        russian: [{ word: unstress(word) }],
        source: 'wiktionary-ru',
      });
    }
  });
}
