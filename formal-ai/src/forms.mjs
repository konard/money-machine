/**
 * Complete the Russian forms of known verbs from Wiktionary.
 *
 * A verb may already be in the lexicon without every form a sentence
 * needs: "payouts will be sent" needs the past passive participle of
 * отправить (отправленный). The forms are read from the word's rendered
 * Wiktionary conjugation table, the same source as for resolved words.
 */

import { readings, tokenize } from './english/analyze.mjs';
import { loadLexicon } from './lexicon.mjs';
import {
  fetchPages,
  renderRussian,
  russianTemplates,
  unstress,
} from './sources/wiktionary.mjs';

// the conjugation table cell each missing form is read from
const SLOTS = {
  pastPassive: 'past|pass|part',
  converb: 'pres|adv|part',
  imperative: '2|s|imp',
};

/**
 * Russian verb entries missing a form the text needs: participles
 * ("sent", "using") and imperatives (a base form opening a sentence:
 * "Answer the question." needs ответь).
 */
function missingForms(text, lexicon) {
  const out = [];
  const seen = new Set();
  const tokens = tokenize(text);
  tokens.forEach((t, i) => {
    if (t.kind !== 'word') {
      return;
    }
    const previous = tokens[i - 1];
    const opening =
      !previous || (previous.kind !== 'word' && /[.!?:;]/.test(previous.text));
    for (const r of readings(t, lexicon)) {
      const form = r.features?.form || '';
      const slot =
        r.pos !== 'verb'
          ? null
          : /pp|past/.test(form)
            ? 'pastPassive'
            : /ing/.test(form)
              ? 'converb'
              : form === 'base' && opening
                ? 'imperative'
                : null;
      if (!slot) {
        continue;
      }
      for (const id of r.concepts || []) {
        const ru = lexicon.get(id)?.ru;
        if (ru?.pos !== 'verb') {
          continue;
        }
        const entries =
          slot === 'converb'
            ? [ru, ru.transitive]
            : slot === 'imperative'
              ? [ru, ru.perfective]
              : [ru.perfective || ru, ru.transitive?.perfective];
        for (const e of entries) {
          if (e?.lemma && !e[slot] && !seen.has(e)) {
            seen.add(e);
            out.push({ verb: e, slot });
          }
        }
      }
    }
  });
  return out;
}

/**
 * Fill the forms the text needs (`pastPassive`, `converb`, `imperative`)
 * from the verbs' Wiktionary conjugation tables.
 * @returns {Promise<number>} how many entries were completed
 */
export async function completeForms(
  text,
  { lexicon = loadLexicon(), fetchImpl, cache = true, log = () => {} } = {}
) {
  const options = { fetchImpl, cache };
  await completeDegrees(text, { lexicon, fetchImpl, cache, log });
  const verbs = missingForms(text, lexicon);
  if (!verbs.length) {
    return 0;
  }
  const pages = await fetchPages(
    [...new Set(verbs.map((v) => v.verb.lemma))],
    options
  );
  let done = 0;
  for (const { verb, slot } of verbs) {
    const page = pages.get(verb.lemma);
    const entry = page
      ? russianTemplates(page).find((e) => e.pos === 'verb' && e.headword)
      : null;
    if (!entry) {
      continue;
    }
    try {
      const { forms } = await renderRussian(verb.lemma, entry, options);
      const form = forms.get(SLOTS[slot]);
      if (form) {
        verb[slot] = unstress(form.split(',')[0]).trim();
        done += 1;
      }
    } catch (error) {
      log(`render ${verb.lemma}: ${error.message}`);
    }
  }
  return done;
}

/**
 * Past and participle forms the same as the base ("set", "put", "cost"):
 * the English headword template `{{en-verb|~s|~ting|~}}` says so (`~` is
 * the lemma itself, `+` the regular form, a fourth slot the participle).
 * Only such verbs need this; other irregular forms have pages of their
 * own ("sent" → send).
 */
export async function sameFormPasts(
  text,
  { lexicon = loadLexicon(), fetchImpl, cache = true } = {}
) {
  const words = new Set();
  for (const t of tokenize(text).filter((x) => x.kind === 'word')) {
    const found = readings({ ...t, text: t.lower }, lexicon);
    if (
      /^[a-z]+[td]$/.test(t.lower) &&
      found.some((r) => r.pos === 'verb' && r.lemma === t.lower) &&
      !found.some((r) => r.pos === 'verb' && /past|pp/.test(r.features?.form))
    ) {
      words.add(t.lower);
    }
  }
  if (!words.size) {
    return 0;
  }
  const pages = await fetchPages([...words], { fetchImpl, cache });
  let added = 0;
  for (const word of words) {
    const template = /\{\{en-verb((?:\|[^|}]*)*)\}\}/.exec(
      pages.get(word) || ''
    );
    if (!template) {
      continue;
    }
    const slots = template[1].split('|').slice(1);
    const first = (slot) => (slot || '').split(',')[0].replace(/<[^>]*>/g, '');
    const past = first(slots[2]);
    const participle = slots[3] ? first(slots[3]) : past;
    if (past === '~') {
      lexicon.addForm(word, { pos: 'verb', lemma: word, feature: 'past' });
      added += 1;
    }
    if (participle === '~' || (participle === '+' && past === '~')) {
      lexicon.addForm(word, {
        pos: 'verb',
        lemma: word,
        feature: 'participle',
      });
    }
  }
  return added;
}

/** Complete irregular adjective/adverb comparatives only when degree is used. */
async function completeDegrees(text, options) {
  const { lexicon, log } = options;
  const tokens = tokenize(text);
  const entries = new Set();
  for (const [i, token] of tokens.entries()) {
    const found = readings(token, lexicon);
    if (
      !/^(more|less|most|least)$/.test(tokens[i - 1]?.lower || '') &&
      !found.some((r) => r.features?.degree)
    ) {
      continue;
    }
    for (const reading of found.filter((r) => ['adj', 'adv'].includes(r.pos))) {
      for (const id of reading.concepts) {
        const entry = lexicon.get(id)?.ru;
        if (entry && !entry.comparative) {
          entries.add(entry);
        }
      }
    }
  }
  if (!entries.size) {
    return;
  }
  const pages = await fetchPages(
    [...new Set([...entries].map((e) => e.lemma))],
    options
  );
  for (const entry of entries) {
    const page = pages.get(entry.lemma);
    const source =
      page &&
      russianTemplates(page).find((e) => e.pos === entry.pos && e.headword);
    if (!source) {
      continue;
    }
    try {
      const { forms } = await renderRussian(entry.lemma, source, options);
      const comparative = forms.get('comd') || forms.get('comparative');
      if (comparative) {
        entry.comparative = unstress(comparative.split(',')[0]).trim();
      }
    } catch (error) {
      log(`render ${entry.lemma}: ${error.message}`);
    }
  }
}
