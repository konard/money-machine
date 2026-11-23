import { reflexivePages } from '../sources/reflexive.mjs';
import {
  translatedCompound,
  translationParts,
} from '../sources/translation-morphology.mjs';
import { translatedPredicate } from '../sources/definition-verbs.mjs';
import { russianIndeclinables } from '../sources/indeclinable.mjs';
import {
  regularEntry,
  russianEntry,
  russianParenthetic,
} from '../russian-entry.mjs';
import { pool } from '../sources/fetch.mjs';
import { governmentPages } from '../sources/government.mjs';
import {
  fetchPages,
  languageSection,
  renderRussian,
  russianTemplates,
  unstress,
} from '../sources/wiktionary.mjs';
import { POS_RU } from './word-classes.mjs';

/**
 * Phase 3: the Russian pages the candidates need — their own pages, the
 * lemma of a candidate that is only a form, aspect partners, government
 * (ru.wiktionary), reflexive partners — and their rendered inflection.
 */
export async function russianPages({ plans, voicePlans, options, log }) {
  const russianWords = new Set();
  for (const plan of voicePlans) {
    for (const s of plan.senses) {
      s.russian.forEach((c) => {
        russianWords.add(c.word);
        if (c.word.includes(' ')) {
          translationParts(c.word, plan.pos).forEach((w) =>
            russianWords.add(w)
          );
        }
      });
    }
  }
  const adverbPhrases = new Set(
    plans
      .filter((p) => p.pos === 'adv')
      .flatMap((p) => p.senses.flatMap((s) => s.russian.map((c) => c.word)))
  );
  const ruPages = await fetchPages(
    [...russianWords].filter((w) => !w.includes(' ')),
    options
  );
  const phrasePages = await fetchPages(
    [...adverbPhrases].filter((w) => w.includes(' ')),
    options
  ).catch(() => new Map());
  phrasePages.forEach((page, word) => ruPages.set(word, page));
  const ruEntry = (word, pos) => {
    const page = ruPages.get(word);
    const list = page ? russianTemplates(page) : [];
    // a country name (Испания) is a proper noun with the same declension
    const e =
      list.find((x) => x.pos === pos) ||
      (pos === 'noun' && list.find((x) => x.pos === 'propn'));
    return e?.headword ? { ...e, pos } : null;
  };
  // a candidate that is only a form of another word stands for that word
  const lemmaOf = new Map();
  for (const word of russianWords) {
    const page = ruPages.get(word);
    const list = page ? russianTemplates(page) : [];
    for (const e of list) {
      // a homograph that is also a word of its own stays itself: есть
      // "eat" (not a form of быть), полка "shelf" (not of полок)
      if (
        !e.headword &&
        e.lemma &&
        !list.some((x) => x.pos === e.pos && x.headword)
      ) {
        lemmaOf.set(`${e.pos}:${word}`, e.lemma);
      }
    }
  }
  const lemmaPages = await fetchPages(
    [...new Set(lemmaOf.values())].filter((w) => !ruPages.has(w)),
    options
  );
  lemmaPages.forEach((v, k) => ruPages.set(k, v));
  for (const plan of plans) {
    for (const sense of plan.senses) {
      sense.russian = sense.russian.map((c) => {
        const lemma = lemmaOf.get(`${POS_RU[plan.pos]}:${c.word}`);
        return lemma ? { ...c, word: lemma } : c;
      });
    }
  }
  // verb partners (заработать ↔ зарабатывать) need their own pages
  const partners = new Set();
  for (const word of russianWords) {
    const e = ruEntry(word, 'verb');
    const named = e?.headword?.named || {};
    for (const p of [named.pf, named.impf].filter(Boolean)) {
      partners.add(unstress(p.split(',')[0]).trim());
    }
  }
  const partnerPages = await fetchPages(
    [...partners].filter((w) => !ruPages.has(w)),
    options
  );
  partnerPages.forEach((v, k) => ruPages.set(k, v));
  const government = await governmentPages(
    voicePlans
      .filter((p) => p.pos === 'verb')
      .flatMap((p) => p.senses.flatMap((s) => s.russian.map((c) => c.word)))
      .concat(
        [...partners],
        [...russianWords].filter(
          (w) => !languageSection(ruPages.get(w) || '', 'Russian')
        )
      ),
    options
  );
  const reflexives = await reflexivePages(
    voicePlans
      .filter((p) => p.pos === 'verb')
      .flatMap((p) => p.senses.flatMap((s) => s.russian.map((c) => c.word))),
    ruPages,
    government,
    options
  );
  const phraseGovernment = await governmentPages(
    [...adverbPhrases].filter(
      (w) =>
        w.includes(' ') && !languageSection(ruPages.get(w) || '', 'Russian')
    ),
    { ...options, russianPhrases: true }
  ).catch(() => new Map());
  phraseGovernment.forEach((page, word) => government.set(word, page));
  const rendered = new Map();
  const want = [];
  for (const plan of voicePlans) {
    for (const s of plan.senses) {
      const words = s.russian.flatMap((c) =>
        c.word.includes(' ') && plan.pos !== 'adv'
          ? translationParts(c.word, plan.pos).map((word) => ({ word }))
          : [c]
      );
      for (const c of words) {
        const e = ruEntry(c.word, POS_RU[plan.pos]);
        if (e) {
          want.push([c.word, e]);
          const partner =
            e.headword?.named?.[
              e.headword?.positional?.[1] === 'pf' ? 'impf' : 'pf'
            ];
          if (partner) {
            const p = unstress(partner.split(',')[0]).trim();
            const pe = ruEntry(p, 'verb');
            if (pe) {
              want.push([p, pe]);
            }
          }
        }
      }
    }
  }
  for (const word of new Set(reflexives.values())) {
    const e = ruEntry(word, 'verb');
    if (e) {
      want.push([word, e]);
      for (const p of [e.headword?.named?.pf, e.headword?.named?.impf].filter(
        Boolean
      )) {
        const partner = unstress(p.split(',')[0]).trim();
        const pe = ruEntry(partner, 'verb');
        if (pe) {
          want.push([partner, pe]);
        }
      }
    }
  }
  await pool(want, 4, async ([word, e]) => {
    const key = `${e.pos}:${word}`;
    if (!rendered.has(key)) {
      rendered.set(key, null);
      try {
        rendered.set(key, {
          entry: e,
          result: await renderRussian(word, e, options),
        });
      } catch (error) {
        log(`render ${word}: ${error.message}`);
      }
    }
  });
  const uncertainNouns = plans
    .filter((p) => p.pos === 'noun')
    .flatMap((p) => p.senses.flatMap((s) => s.russian))
    .map((c) => c.word)
    .filter(
      (w) =>
        /^[а-яё-]+$/i.test(w) &&
        /[иуюое]$/.test(w) &&
        !rendered.get(`noun:${w}`)
    );
  const indeclinables = await russianIndeclinables(uncertainNouns, options);
  return { ruPages, lemmaOf, government, reflexives, rendered, indeclinables };
}

/**
 * A Russian lexical entry for a candidate word, from the pages above;
 * null when the word is not attested as that part of speech.
 */
export function russianEntries({
  ruPages,
  lemmaOf,
  government,
  rendered,
  indeclinables,
}) {
  const russian = (word, pos, candidate, renderedOnly) => {
    if (['verb', 'adj'].includes(pos) && word.includes(' ')) {
      return translatedPredicate(word, pos, russian, candidate);
    }
    if (pos === 'noun' && word.includes(' ')) {
      const entry = translatedCompound(word, russian, lemmaOf);
      return entry && candidate?.plural
        ? { ...entry, pluraliaTantum: true }
        : entry;
    }
    if (pos === 'noun' && indeclinables.has(word)) {
      return indeclinables.get(word);
    }
    const r = rendered.get(`${pos}:${word}`);
    if (r) {
      const entry = russianEntry(
        pos,
        word,
        r.result,
        r.entry.headword,
        ruPages.get(word) || government.get(word)
      );
      if (entry?.pos === 'noun' && candidate) {
        // own marks: машина|f, деньги|f-p (but зарпла́та|f-p is singular)
        if (!r.result.gender && candidate.gender) {
          entry.gender = candidate.gender;
        }
        if (
          candidate.plural &&
          !entry.pluraliaTantum &&
          entry.forms?.['pl.nom'] &&
          unstress(entry.forms['sg.nom'] || '') !== unstress(word)
        ) {
          entry.pluraliaTantum = true;
          entry.lemma = entry.forms['pl.nom'];
        }
      }
      return entry;
    }
    if (
      pos === 'adv' &&
      (languageSection(ruPages.get(word) || '', 'Russian') ||
        /=\s*\{\{-ru-\}\}\s*=/.test(government.get(word) || '') ||
        word
          .split(' ')
          .every(
            (w) =>
              languageSection(ruPages.get(w) || '', 'Russian') ||
              /=\s*\{\{-ru-\}\}\s*=/.test(government.get(w) || '')
          ))
    ) {
      return {
        pos: 'adv',
        lemma: word,
        regular: true,
        parenthetic:
          russianParenthetic(ruPages.get(word) || government.get(word)) ||
          undefined,
      };
    }
    // Regular morphology needs lexical attestation, not merely a plausible
    // Cyrillic ending. A verified Russian concept label is evidence too.
    return candidate &&
      !renderedOnly &&
      (candidate.attested ||
        /=\s*\{\{-ru-\}\}\s*=/.test(government.get(word) || '') ||
        russianTemplates(ruPages.get(word) || '').some(
          (e) => e.pos === POS_RU[pos] || (pos === 'noun' && e.pos === 'propn')
        ))
      ? regularEntry(pos, candidate)
      : null;
  };
  return russian;
}
