/**
 * Adverbs of time made from a noun's instrumental case: "in the morning"
 * → утром, "in summer" → летом, "at night" → ночью.
 *
 * Nothing about specific words is built in: for a noun that follows
 * "in", "at" or "during" in the text, the instrumental singular of its
 * Russian noun is looked up on Wiktionary, and if that form has a
 * Russian adverb entry glossed with the same English phrase ("in the
 * morning"), the phrase is rendered with the adverb.
 */

import { fetchPages } from './wiktionary.mjs';
import { declineNoun } from '../russian/morphology.mjs';
import { readings } from '../english/analyze.mjs';

const RELATIONS = { in: 'rel.in', at: 'rel.at', during: 'rel.during' };

/** Nouns after "in/at/during (the)" in a text. */
export function timePhraseWords(text) {
  const out = new Set();
  for (const m of text
    .toLowerCase()
    .matchAll(/\b(?:in|at|during)\s+(?:the\s+)?([a-z]+)\b/g)) {
    out.add(m[1]);
  }
  return [...out];
}

/** Definitions of the Russian adverb on a Wiktionary page, as plain text. */
export function russianAdverbGlosses(page) {
  const russian = /(?:^|\n)==Russian==\n([\s\S]*?)(?=\n==[^=]|$)/.exec(
    page || ''
  )?.[1];
  const adverb = /(?:^|\n)===Adverb===\n([\s\S]*?)(?=\n===|$)/.exec(
    russian || ''
  )?.[1];
  return (adverb || '')
    .split('\n')
    .filter((line) => /^#\s/.test(line))
    .map((line) =>
      line
        .slice(1)
        .replace(/\{\{[^{}]*\}\}/g, '')
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
        .replace(/[.;,].*$/, '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
}

/** The relations ("rel.in") whose phrase with `word` the glosses repeat. */
export function adverbRelations(glosses, word) {
  const pattern = new RegExp(`^(in|at|during)(?: the)? ${word}$`);
  return [
    ...new Set(
      glosses
        .map((g) => pattern.exec(g)?.[1])
        .filter(Boolean)
        .map((p) => RELATIONS[p])
    ),
  ];
}

/**
 * Give the Russian nouns of time words in `text` that have an adverb of
 * their instrumental case that adverb as `ru.when` (as hand-written
 * entries have it), rendered for "in/at/during (the) X".
 */
export async function learnTimeAdverbs(text, lexicon, options = {}) {
  const targets = [];
  const nouns = timePhraseWords(text).flatMap((form) =>
    readings({ text: form, lower: form, kind: 'word' }, lexicon)
      .filter((r) => r.pos === 'noun')
      .map((r) => r.lemma)
  );
  for (const word of new Set(nouns)) {
    for (const id of lexicon.lookup('noun', word)) {
      const ru = lexicon.get(id)?.ru;
      if (ru?.pos !== 'noun' || ru.indeclinable || ru.when || ru.whenChecked) {
        continue;
      }
      let form;
      try {
        form = declineNoun(ru, 'ins', 'sg');
      } catch {
        continue;
      }
      if (form && /^[а-яё]+$/.test(form)) {
        targets.push({ ru, word, form });
      }
    }
  }
  if (!targets.length) {
    return;
  }
  const pages = await fetchPages([...new Set(targets.map((t) => t.form))], {
    fetchImpl: options.fetchImpl,
    cache: options.cache,
  });
  for (const t of targets) {
    t.ru.whenChecked = true;
    if (
      adverbRelations(russianAdverbGlosses(pages.get(t.form)), t.word).length
    ) {
      t.ru.when = t.form;
    }
  }
}
