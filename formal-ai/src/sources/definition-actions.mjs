/** Action nouns can inherit an attested nominalization of a dictionary verb. */
import {
  englishEntries,
  fetchPages,
  russianTemplates,
  plain,
  unstress,
} from './wiktionary.mjs';

export async function completeActionDefinitions(
  plans,
  entries,
  options,
  context = {}
) {
  const wanted =
    context.words &&
    new Set([...context.words, ...(context.forms || []).map((f) => f.lemma)]);
  const missing = [...entries]
    .filter(
      ([lemma]) =>
        (!wanted || wanted.has(lemma)) &&
        !plans.some(
          (p) =>
            p.lemma === lemma &&
            p.pos === 'noun' &&
            p.senses.some((s) => s.russian.length)
        )
    )
    .flatMap(([lemma, list]) =>
      list
        .filter(
          (e) =>
            e.pos === 'noun' &&
            !e.rare &&
            !e.senses.some((s) => s.russian.length)
        )
        .flatMap((e) => e.rawDefinitions || [])
        .flatMap((raw) => {
          const m =
            /^(?:The |An? )?act of \[\[([a-z]+(?: [a-z]+)*)(?:\|[^\]]+)?\]\]/i.exec(
              raw
            );
          return m
            ? [{ lemma, definition: plain(raw.split('\n')[0]), verb: m[1] }]
            : [];
        })
    );
  const pages = await fetchPages(
    missing.map((x) => x.verb),
    options
  );
  const synonyms = [...pages.values()].flatMap((text) =>
    englishEntries(text)
      .filter((e) => e.pos === 'verb')
      .flatMap((e) => e.rawDefinitions || [])
      .flatMap((raw) =>
        [...raw.matchAll(/\{\{syn\|en\|([^{}]+)\}\}/g)].flatMap((m) =>
          m[1].split('|').filter((w) => /^[a-z]+$/.test(w))
        )
      )
  );
  (await fetchPages(synonyms, options)).forEach((v, k) => pages.set(k, v));
  const verbs = (word) =>
    englishEntries(pages.get(word) || '')
      .filter((e) => e.pos === 'verb' && !e.rare)
      .flatMap((e) => e.senses)
      .filter((s) => !s.rare)
      .flatMap((s) => s.russian);
  for (const x of missing) {
    const own = englishEntries(pages.get(x.verb) || '')
      .filter((e) => e.pos === 'verb')
      .flatMap((e) => e.rawDefinitions || [])
      .flatMap((raw) =>
        [...raw.matchAll(/\{\{syn\|en\|([^{}]+)\}\}/g)].flatMap((m) =>
          m[1].split('|').filter((w) => /^[a-z]+$/.test(w))
        )
      );
    const nouns = [...verbs(x.verb), ...own.flatMap(verbs)]
      .map((c) => unstress(c.word).replace(/ся$/, ''))
      .filter((w) => /ировать$/.test(w))
      .map((w) => w.replace(/ировать$/, 'ация'));
    const ru = await fetchPages(nouns, options);
    const word = nouns.find((w) =>
      russianTemplates(ru.get(w) || '').some(
        (e) => e.pos === 'noun' && e.headword
      )
    );
    if (!word) {
      continue;
    }
    let plan = plans.find((p) => p.lemma === x.lemma && p.pos === 'noun');
    if (!plan) {
      plan = { lemma: x.lemma, pos: 'noun', senses: [] };
      plans.push(plan);
    }
    if (!plan.senses.some((s) => s.russian.length)) {
      plan.senses.push({
        gloss: x.definition,
        definition: x.definition,
        russian: [{ word }],
        composed: true,
      });
    }
  }
}
