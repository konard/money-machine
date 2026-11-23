import { closedClass, capitalizedWords } from '../unknown-words.mjs';
import { hyphenatedTitles } from '../hyphenated.mjs';
import { compoundCandidates } from '../compounds.mjs';
import {
  phraseCandidates,
  publicEntries,
  givenNameLabel,
  markGivenName,
  noteNotGivenFirst,
} from '../public-expressions.mjs';
import { fetchPages, languageSection } from '../sources/wiktionary.mjs';
import { FEATURE } from './word-classes.mjs';

/**
 * Phase 1: the English Wiktionary pages a text needs — its unknown words,
 * their capitalized titles, phrases, compounds, and the pages their
 * entries point to (base forms, variants, translation subpages), in at
 * most three rounds.
 */
export async function englishPages({ text, lexicon, options, words, only }) {
  const done = new Set();
  const entries = new Map(); // lemma → english entries
  const forms = []; // {form, lemma, kind, pos}
  const capitalOf = new Map(); // "Monday" → "monday"
  const phrases = only ? [] : phraseCandidates(text);
  const dictionaryNames = new Map();
  // two-word terms are asked for too; most such titles do not exist
  let queue = [
    ...new Set([
      ...(only ? words : [...words, ...compoundCandidates(text, lexicon)]),
      ...hyphenatedTitles(words),
    ]),
  ];
  // a capital inside a sentence is learned only as a time word ("January")
  const timeOnly = new Set(
    only
      ? []
      : capitalizedWords(text, lexicon).filter((w) => !queue.includes(w))
  );
  for (const w of timeOnly) {
    const upper = w[0].toUpperCase() + w.slice(1);
    capitalOf.set(upper, w);
    queue.push(upper);
  }
  // "monday", "march", "english": the page titled with a capital too
  for (const w of [...queue]) {
    const upper = w[0].toUpperCase() + w.slice(1);
    if (/^\p{Ll}[\p{Ll}-]*$/u.test(w) && !queue.includes(upper)) {
      capitalOf.set(upper, w);
      queue.push(upper);
    }
  }
  // a word asked under its capital title ("January") is no phrase
  const phraseOnly = new Set(
    phrases.filter((p) => !queue.includes(p) && !timeOnly.has(p))
  );
  queue.push(...phrases.filter((p) => !queue.includes(p) && !lexicon.asked(p)));
  for (let round = 0; round < 3 && queue.length; round += 1) {
    const pages = await fetchPages(queue, options);
    queue.forEach((q) => done.add(q));
    const next = new Set();
    for (const title of queue) {
      const page = pages.get(title);
      const key = capitalOf.get(title) || title;
      if (
        page &&
        !languageSection(page, 'English') &&
        /^==[^=]+==/m.test(page)
      ) {
        lexicon.foreignWords ||= new Set();
        lexicon.foreignWords.add(title);
      }
      if (page && /^[A-Z][a-z]+$/.test(title)) {
        noteNotGivenFirst(lexicon, title, page);
        const label = givenNameLabel(page);
        if (label) {
          lexicon.setNameLabel(title, label);
          markGivenName(lexicon, title, page);
          dictionaryNames.set(title, null);
        }
      }
      // a capitalized page ("January", "English" the language) holds the
      // word's proper-noun meanings; they stand beside the word's own
      const list = (page ? publicEntries(page) : [])
        .filter(
          (e) =>
            // "January" is a month and also a given name: only an entry
            // that is nothing but a given name is left to names
            !e.rawDefinitions.length ||
            !e.rawDefinitions.every((d) =>
              /\{\{given name\|en(?:\||\}\})/.test(d)
            )
        )
        .map((e) =>
          key === title
            ? e
            : { ...e, pos: e.pos === 'propn' ? 'noun' : e.pos, capital: true }
        );
      if (!page) {
        continue;
      }
      entries.set(key, [...(entries.get(key) || []), ...list]);
      for (const e of list) {
        if (phraseOnly.has(title) && !['intj', 'phrase'].includes(e.pos)) {
          continue;
        }
        // "@" ← "or" (a conjunction): grammatical words are built in
        const promote = (target) => {
          if (
            !phraseOnly.has(title) &&
            !closedClass(target, lexicon) &&
            phraseOnly.delete(target)
          ) {
            next.add(target);
          }
        };
        for (const f of e.formOf) {
          promote(f.lemma);
          // "Sundays" → "Sunday": a capital page's base, learned lowercase too
          const lemma =
            key !== title && /^\p{Lu}\p{Ll}+$/u.test(f.lemma)
              ? f.lemma.toLowerCase()
              : f.lemma;
          if (lemma !== f.lemma) {
            capitalOf.set(f.lemma, lemma);
          }
          const pos = /past participle|ed-form/.test(f.kind) ? 'verb' : e.pos;
          forms.push({ form: key, lemma, kind: f.kind, pos });
          // a variant ("doc" ← "document") needs its target's page and senses
          const variantOf = /alternative|spelling/.test(f.kind);
          if (
            !done.has(f.lemma) &&
            !closedClass(lemma, lexicon) &&
            (variantOf || !lexicon.lookup(pos, lemma).length)
          ) {
            next.add(f.lemma);
          }
        }
        for (const s of e.see) {
          promote(s.page);
          if (!done.has(s.page)) {
            next.add(s.page);
          }
        }
        if (e.subpage && !done.has(`${title}/translations`)) {
          next.add(`${title}/translations`);
          if (key !== title) {
            capitalOf.set(`${title}/translations`, `${key}/translations`);
          }
        }
      }
    }
    if (!only) {
      for (const title of compoundCandidates(text, lexicon, forms)) {
        if (!done.has(title)) {
          next.add(title);
        }
      }
    }
    queue = [...next];
  }
  return {
    done,
    entries,
    forms,
    capitalOf,
    phrases,
    dictionaryNames,
    timeOnly,
    phraseOnly,
  };
}

/** Inflections the pages named (plural, past, participle) become forms. */
export function learnForms(forms, lexicon) {
  for (const f of forms) {
    const feature = FEATURE[f.kind];
    if (feature && lexicon.lookup(f.pos, f.lemma).length) {
      lexicon.addForm(f.form, { pos: f.pos, lemma: f.lemma, feature });
      if (f.kind === 'ed-form') {
        lexicon.addForm(f.form, {
          pos: f.pos,
          lemma: f.lemma,
          feature: 'participle',
        });
      }
    }
  }
}
