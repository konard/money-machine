/** Russian-language definitions of English headwords, from Russian Wiktionary. */
import { governmentPages } from './government.mjs';
import { plain, unstress } from './wiktionary.mjs';

const POS = { сущ: 'noun', гл: 'verb', прил: 'adj', нареч: 'adv' };

export function russianMeanings(text) {
  const section =
    text
      .split(/^=\s*\{\{-en-\}\}\s*=\s*$/m)[1]
      ?.split(/^=\s*\{\{-[a-z]+-\}\}\s*=/m)[0] || '';
  const out = [];
  let pos;
  let meaning = false;
  for (const line of section.split('\n')) {
    const head = line.match(/\{\{(сущ|гл|прил|нареч) en(?:[ |}]|$)/);
    if (head) {
      pos = POS[head[1]];
    }
    if (/^=/.test(line)) {
      meaning = /^=+\s*Значение\s*=+/.test(line);
    }
    if (!meaning || !pos || !/^#[^#*:]/.test(line)) {
      continue;
    }
    const raw = line.slice(1).split(/\{\{пример\b/)[0];
    if (/\{\{(?:устар|редк|неол|прост|обсц)/.test(raw)) {
      continue;
    }
    const word = unstress(plain(raw))
      .replace(/\s*\(([^)]*)\)/g, (_, note) =>
        /^(как|в|на|с|к|по|за|для|от|из|о|об)$/.test(note) ? ` ${note}` : ''
      )
      .trim()
      .split(/[,;]|\s+или\s+/)[0]
      .trim()
      .replace(/[.!?]$/, '');
    const headword = word.split(' ')[0];
    const lexical =
      !/^(такой|тот|то|это|кто|что|который|какой)$/.test(headword) &&
      (pos !== 'verb' || /(?:ть|ти|чь|ться|тись)$/.test(headword));
    if (lexical && /^[а-яё -]+$/i.test(word)) {
      out.push({ pos, word });
    }
  }
  return out;
}

export async function completeRussianMeanings(plans, entries, options) {
  const translatedParticiples = new Set(
    (options.forms || [])
      .filter(
        (f) =>
          f.pos === 'verb' &&
          plans.some(
            (p) =>
              p.lemma === f.lemma &&
              p.pos === 'verb' &&
              p.senses.some((s) => s.russian.length)
          )
      )
      .map((f) => f.form)
  );
  const wanted =
    options.words &&
    new Set([...options.words, ...(options.forms || []).map((f) => f.lemma)]);
  // Entries without translation tables still have independently attested definitions.
  for (const [lemma, list] of entries) {
    if (!/^[a-z]+(?: [a-z]+)*$/.test(lemma) || (wanted && !wanted.has(lemma))) {
      continue;
    }
    for (const entry of list) {
      if (
        !Object.values(POS).includes(entry.pos) ||
        entry.rare ||
        entry.formOf.length ||
        list.some((e) => e.pos === entry.pos && e.formOf.length) ||
        entry.senses.length ||
        entry.subpage ||
        (entry.pos === 'adj' && translatedParticiples.has(lemma)) ||
        options.lexicon?.lookup(entry.pos, lemma).length ||
        plans.some((p) => p.lemma === lemma && p.pos === entry.pos)
      ) {
        continue;
      }
      const senses = entry.definitions
        .filter(Boolean)
        .map((definition) => ({ gloss: definition, definition, russian: [] }));
      if (senses.length) {
        plans.push({ lemma, pos: entry.pos, senses });
      }
    }
  }
  const missing = plans.filter(
    (p) =>
      (!wanted || wanted.has(p.lemma)) &&
      !(p.pos === 'adj' && translatedParticiples.has(p.lemma)) &&
      p.senses.some((s) => !s.russian.length && !s.side && !s.variant)
  );
  if (!missing.length) {
    return;
  }
  const pages = await governmentPages(
    missing.map((p) => p.lemma),
    options,
    true
  );
  for (const plan of missing) {
    const meanings = russianMeanings(pages.get(plan.lemma) || '').filter(
      (m) => m.pos === plan.pos
    );
    // With no bilingual alignment, only an unambiguous dictionary meaning
    // may fill an individual English sense. Preserve alternatives separately.
    if (
      plan.senses.length === 1 &&
      meanings.length === 1 &&
      !plan.senses[0].russian.length
    ) {
      // a phrase from a Russian dictionary's own definition ("облагаемый
      // налогом") is attested by it, though it has no page of its own
      plan.senses[0].russian = [
        {
          word: meanings[0].word,
          ...(plan.pos === 'adj' && meanings[0].word.includes(' ')
            ? { attested: true }
            : {}),
        },
      ];
      plan.senses[0].source = 'wiktionary-ru';
    }
  }
}
