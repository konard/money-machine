/** Compose a simple dictionary predicate with an instrumental manner phrase. */
import {
  englishEntries,
  fetchPages,
  renderRussian,
  russianTemplates,
  plain,
} from './wiktionary.mjs';
import { russianEntry, regularEntry } from '../russian-entry.mjs';
import { declineAdjective, declineNoun } from '../russian/morphology.mjs';
import { publicSenses, glossWords } from './sense-data.mjs';

export async function completeAdjunctDefinitions(plans, entries, options) {
  const missing = plans
    .filter((p) => p.pos === 'verb' && !p.senses.some((s) => s.russian.length))
    .flatMap((plan) =>
      (entries.get(plan.lemma) || [])
        .filter((e) => e.pos === 'verb')
        .flatMap((e) => e.definitions)
        .flatMap((definition) => {
          const m =
            /^To ([a-z]+) \([^)]*\) in ([a-z]+) ([a-z]+)(?:[.,]|$)/.exec(
              definition
            );
          // "To apply again": the verb and one adverb of its manner
          const adverb = /^To ([a-z]+) ([a-z]+)\.?$/.exec(definition);
          return m
            ? [{ plan, definition, verb: m[1], adjective: m[2], noun: m[3] }]
            : adverb
              ? [{ plan, definition, verb: adverb[1], adverb: adverb[2] }]
              : [];
        })
    );
  const pages = await fetchPages(
    missing.flatMap((x) => [x.verb, x.adjective, x.noun, x.adverb]),
    options
  );
  const bases = missing.flatMap((x) =>
    englishEntries(pages.get(x.noun) || '').flatMap((e) =>
      e.formOf.filter((f) => f.kind === 'plural').map((f) => f.lemma)
    )
  );
  (await fetchPages(bases, options)).forEach((v, k) => pages.set(k, v));
  for (let round = 0; round < 2; round += 1) {
    const targets = [...pages.values()].flatMap((v) =>
      englishEntries(v).flatMap((e) => [
        ...e.see.map((s) => s.page),
        ...e.formOf.map((f) => f.lemma),
      ])
    );
    (
      await fetchPages(
        targets.filter((w) => !pages.has(w)),
        options
      )
    ).forEach((v, k) => pages.set(k, v));
  }
  const dictionary = new Map(
    [...pages].map(([k, v]) => [k, englishEntries(v)])
  );
  const candidate = (word, pos, context) => {
    const variants = (dictionary.get(word) || [])
      .filter((e) => e.pos === pos)
      .flatMap((e) => e.formOf.map((f) => f.lemma));
    return [word, ...variants]
      .flatMap((w) => publicSenses(dictionary, w, pos))
      .filter((s) => !s.rare)
      .sort((a, b) => {
        const stem = (w) => w.replace(/(?:ing|ed|s)$/, '');
        const want = new Set(glossWords(context).map(stem));
        const overlap = (s) =>
          glossWords(`${s.gloss} ${s.definition || ''}`).filter((w) =>
            want.has(stem(w))
          ).length;
        return (
          overlap(b) - overlap(a) || (b.languages || 0) - (a.languages || 0)
        );
      })
      .flatMap((s) => s.russian)[0];
  };
  for (const x of missing.filter((x) => x.adverb)) {
    const context = x.definition;
    const verb = candidate(x.verb, 'verb', context);
    const adverb = candidate(x.adverb, 'adv', context);
    if (verb && adverb && !verb.word.includes(' ')) {
      x.plan.senses.push({
        gloss: plain(x.definition),
        definition: x.definition,
        russian: [{ word: `${verb.word} ${adverb.word}` }],
        composed: true,
      });
    }
  }
  for (const x of missing.filter((x) => !x.adverb)) {
    const base = englishEntries(pages.get(x.noun) || '')
      .flatMap((e) => e.formOf)
      .find((f) => f.kind === 'plural')?.lemma;
    if (!base) {
      continue;
    }
    const context = (entries.get(x.plan.lemma) || [])
      .flatMap((e) => e.definitions)
      .join(' ');
    const verb = candidate(x.verb, 'verb', context);
    const adj = candidate(x.adjective, 'adj', context);
    // The adjective belongs to the manner phrase itself; it is not
    // evidence for selecting the head's lexical sense.
    const noun = candidate(base, 'noun', context.replaceAll(x.adjective, ''));
    if (!verb || !adj || !noun) {
      continue;
    }
    const ruPages = await fetchPages([noun.word], options);
    const e = russianTemplates(ruPages.get(noun.word) || '').find(
      (e) => e.pos === 'noun' && e.headword
    );
    const n = e
      ? russianEntry(
          'noun',
          noun.word,
          await renderRussian(noun.word, e, options),
          e.headword
        )
      : regularEntry('noun', noun);
    if (!n) {
      continue;
    }
    const tail = `${declineAdjective(adj.word, { case: 'ins', number: 'pl' })} ${declineNoun(n, 'ins', 'pl')}`;
    x.plan.senses.push({
      gloss: plain(x.definition),
      definition: x.definition,
      russian: [{ word: `${verb.word} ${tail}` }],
      composed: true,
    });
  }
}
