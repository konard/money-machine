/** Conservative recovery of missing translations from bilingual public evidence. */
import { getJson, pool } from './fetch.mjs';
import {
  englishEntries,
  fetchPages,
  languageSection,
  plain,
  russianTemplates,
} from './wiktionary.mjs';
import { glossWords } from './sense-data.mjs';

const roots = (text) =>
  new Set(glossWords(plain(text)).map((w) => w.replace(/s$/, '')));
const linked = (raw, word) =>
  [...raw.matchAll(/\[\[([^\]#|]+)(?:[^\]]*)\]\]/g)].some((m) => m[1] === word);

/** An adverb may share a translation with another section of the same page,
 * but only if the Russian adverb itself explicitly translates this lemma. */
export async function completeCrossPOS(
  plans,
  entries = new Map(),
  options = {}
) {
  // A lexical mass reading can coexist with a plural inflection (data).
  // Preserve both numbers for parsing, even when the base lacks translations.
  if (options.lexicon) {
    options.lexicon.massPlurals ||= new Set();
    for (const [lemma, list] of entries) {
      const nouns = list.filter((e) => e.pos === 'noun');
      if (
        nouns.some((e) => e.formOf.some((f) => f.kind === 'plural')) &&
        nouns.some((e) =>
          e.rawDefinitions.some((d) =>
            /\|(?:uncountable|collective)[|}]/.test(d)
          )
        )
      ) {
        options.lexicon.massPlurals.add(lemma);
      }
    }
  }
  const missing = plans.filter(
    (p) => p.pos === 'adv' && p.senses.every((s) => !s.russian.length)
  );
  const candidates = (p) =>
    (entries.get(p.lemma) || [])
      .filter((e) => e.pos === 'adj')
      .flatMap((e) => e.senses.flatMap((s) => s.russian));
  const pages = await fetchPages(
    missing.flatMap((p) => candidates(p).map((c) => c.word)),
    options
  );
  for (const plan of missing) {
    const attested = candidates(plan).filter((c) => {
      const page = pages.get(c.word) || '';
      return (
        russianTemplates(page).some((e) => e.pos === 'adv' && e.headword) &&
        englishEntries(`==English==${languageSection(page, 'Russian')}`).some(
          (e) =>
            e.pos === 'adv' &&
            e.rawDefinitions.some((d) => linked(d.split('\n')[0], plan.lemma))
        )
      );
    });
    if (attested.length) {
      plan.senses.forEach((s) => {
        s.russian = attested;
      });
    }
  }
}

/** Empty plural-noun senses can use exact reverse links, aligned by meaning.
 * Search hits alone never establish a translation; quotations and other
 * languages are excluded, and a shared content word in the definitions is required. */
export async function completeReverseNouns(plans, context, options) {
  const forms = (context.forms || []).filter(
    (f) =>
      f.pos === 'noun' && f.kind === 'plural' && context.words?.includes(f.form)
  );
  await pool(forms, 2, async (form) => {
    const plan = plans.find((p) => p.lemma === form.lemma && p.pos === 'noun');
    const missing =
      plan?.senses.filter(
        (s) => !s.russian.length && !s.side && !s.variant && !s.rare
      ) || [];
    if (!missing.length) {
      return;
    }
    const body = await getJson(
      `https://en.wiktionary.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', list: 'search', srsearch: `"${form.form}" incategory:"Russian nouns"`, srlimit: '10' })}`,
      { ...options, bucket: 'wiktionary-reverse' }
    ).catch(() => ({}));
    const titles = (body.query?.search || [])
      .map((x) => x.title)
      .filter((t) => /^[а-яё-]+$/i.test(t));
    const pages = await fetchPages(titles, options);
    const candidates = [...pages].flatMap(([word, page]) => {
      const section = languageSection(page, 'Russian');
      if (!russianTemplates(page).some((e) => e.pos === 'noun' && e.headword)) {
        return [];
      }
      return englishEntries(`==English==${section}`)
        .filter((e) => e.pos === 'noun')
        .flatMap((e) => e.rawDefinitions)
        .filter((d) => linked(d.split('\n')[0], form.form))
        .map((raw) => ({ word, raw: raw.split('\n')[0] }));
    });
    for (const sense of missing) {
      const want = roots(`${sense.gloss} ${sense.definition || ''}`);
      const ranked = candidates
        .map((c) => {
          const have = roots(c.raw);
          const overlap = [...want].filter((w) => have.has(w)).length;
          const plural =
            /\bin the plural\b/.test(c.raw) &&
            sense.labels?.includes('in the plural');
          return { ...c, score: overlap ? overlap + (plural ? 0.5 : 0) : 0 };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);
      if (ranked.length && (!ranked[1] || ranked[0].score > ranked[1].score)) {
        sense.russian = [{ word: ranked[0].word }];
      }
    }
  });
}
