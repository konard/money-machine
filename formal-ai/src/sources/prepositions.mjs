/** Productive multiword prepositions and their attested Russian government. */
import { tokenize } from '../english/analyze.mjs';
import { PREPOSITIONS } from '../english/function-words.mjs';
import {
  englishEntries,
  fetchPages,
  languageSection,
  russianTemplates,
} from './wiktionary.mjs';

import { prepositionCase } from './case-notes.mjs';

export function prepositionCandidates(text) {
  const tokens = tokenize(text);
  const out = new Set();
  for (let i = 0; i < tokens.length; i += 1) {
    for (let n = 2; n <= 4; n += 1) {
      const span = tokens.slice(i, i + n);
      if (span.length !== n || span.some((t) => t.kind !== 'word')) {
        break;
      }
      if (span.some((t) => PREPOSITIONS[t.lower] || t.lower === 'as')) {
        out.add(span.map((t) => t.lower).join(' '));
      }
    }
  }
  return [...out];
}

/** A stub entry can delegate to dictionary synonyms, never invented mappings. */
function synonyms(entry) {
  return entry.rawDefinitions.flatMap((d) => {
    const first = d.split('\n')[0];
    // Only synonym-only definitions; ordinary explanations are not aliases.
    if (
      !/^\[\[/.test(first) ||
      /[^\s;,./]/.test(first.replace(/\[\[[^\]]+\]\]/g, ''))
    ) {
      return [];
    }
    return [...first.matchAll(/\[\[([^|\]#]+)(?:[^\]]*)\]\]/g)].map((m) =>
      m[1].toLowerCase()
    );
  });
}

export async function learnPrepositions(text, lexicon, options = {}) {
  const candidates = prepositionCandidates(text).filter(
    (p) => !lexicon.asked(`prep:${p}`)
  );
  if (!candidates.length) {
    return;
  }
  const entries = new Map();
  const pages = new Map();
  let queue = candidates;
  for (let round = 0; round < 3 && queue.length; round += 1) {
    const fetched = await fetchPages(queue, options);
    queue.forEach((title) => pages.set(title, fetched.get(title) || ''));
    const next = new Set();
    for (const title of queue) {
      const page = pages.get(title);
      const list = englishEntries(
        title.endsWith('/translations') && !page.includes('==English==')
          ? `==English==\n===Preposition===\n${page}`
          : page
      ).filter((e) => e.pos === 'prep' && !e.rare);
      entries.set(title, list);
      for (const e of list) {
        for (const target of [
          ...synonyms(e),
          ...e.see.map((s) => s.page),
          ...(e.subpage ? [`${title}/translations`] : []),
        ]) {
          if (!pages.has(target)) {
            next.add(target);
          }
        }
      }
    }
    queue = [...next];
  }
  const translations = (title, seen = new Set()) => {
    if (seen.has(title)) {
      return [];
    }
    seen = new Set([...seen, title]);
    return (entries.get(title) || []).flatMap((e) => {
      const own = e.senses.flatMap((s) => s.russian);
      return own.length
        ? own
        : [
            ...synonyms(e),
            ...e.see.map((s) => s.page),
            ...(e.subpage ? [`${title}/translations`] : []),
          ].flatMap((s) => translations(s, seen));
    });
  };
  const plans = candidates.map((lemma) => ({
    lemma,
    russian: translations(lemma),
  }));
  const russian = [
    ...new Set(
      plans.flatMap((p) =>
        p.russian.flatMap((c) => [c.word, c.word.split(' ').at(-1)])
      )
    ),
  ];
  const ruPages = await fetchPages(russian, options);
  const government = (word) => {
    const section = languageSection(ruPages.get(word) || '', 'Russian');
    const prep =
      /^={3,5}\s*(?:Preposition|Prepositional phrase)\s*={3,5}\s*\n([\s\S]*?)(?=^={3}[^=]|$(?![\s\S]))/m.exec(
        section
      )?.[1];
    return prep ? prepositionCase(prep) : null;
  };
  for (const plan of plans) {
    const choices = plan.russian.flatMap((c) => {
      const kase =
        c.case ||
        government(c.word) ||
        (/^в .+ (?:от|из)$/.test(c.word) &&
        government(c.word.split(' ').at(-1)) === 'gen'
          ? 'gen'
          : null);
      if (kase) {
        return [{ ...c, pos: 'prep', case: kase }];
      }
      // A closed prepositional phrase can translate as an adverb, with no
      // complement. Do not reinterpret a later homonymous preposition as its head.
      return russianTemplates(ruPages.get(c.word) || '').some(
        (e) => e.pos === 'adv' && e.headword
      )
        ? [{ ...c, pos: 'adv' }]
        : [];
    });
    const borrowed = !(entries.get(plan.lemma) || []).some((e) =>
      e.senses.some((s) => s.russian.length)
    );
    if (borrowed) {
      // Among delegated synonyms, prefer a Russian preposition attested
      // as a whole over an assembled paraphrase with only a case qualifier.
      choices.sort(
        (a, b) =>
          Number(Boolean(government(b.word))) -
          Number(Boolean(government(a.word)))
      );
    }
    const choice = choices[0];
    if (!choice) {
      continue;
    }
    const id = `wikt:${choice.pos}:${plan.lemma.replaceAll(' ', '-')}`;
    if (!lexicon.get(id)) {
      lexicon.add({
        id,
        en: [
          { pos: choice.pos, lemma: plan.lemma, words: plan.lemma.split(' ') },
        ],
        ru: { pos: choice.pos, lemma: choice.word, case: choice.case },
        classes: [],
        source: 'wiktionary',
        gloss: plan.lemma,
      });
    }
  }
  lexicon.markAsked(candidates.map((p) => `prep:${p}`));
}
