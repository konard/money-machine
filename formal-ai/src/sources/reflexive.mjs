import { senseFrames } from './verb-frames.mjs';
/** Reflexive counterparts must be dictionary-attested, never suffix guesses. */
import {
  englishEntries,
  fetchPages,
  languageSection,
  russianTemplates,
  unstress,
} from './wiktionary.mjs';
import { governmentPages } from './government.mjs';

/** Inflected seed verbs may have skipped their already-known English lemma. */
export async function voiceDictionary(lemmas, entries, lexicon, options) {
  const pages = await fetchPages(
    [...lemmas].filter(
      (lemma) =>
        lemma && lexicon.lookup('verb', lemma).length && !entries.has(lemma)
    ),
    options
  );
  const out = new Map(entries);
  pages.forEach((page, lemma) => out.set(lemma, englishEntries(page)));
  return out;
}

/** Frames from main-page definitions survive empty or unmatched tables. */
export function englishVoiceFrames(entries, lemma) {
  return (entries.get(lemma) || [])
    .filter((e) => e.pos === 'verb')
    .flatMap((e) =>
      (e.rawDefinitions || [])
        .filter((d) => !/\|(?:rare|obsolete|archaic|dated)[|}]/.test(d))
        .flatMap((d) => senseFrames(d))
    );
}

/** A definition of a change of state: "to become larger", "to come to an end". */
export const changeOfState = (definition = '') =>
  /^to (?:make or )?(?:become|come to|undergo)\b/i.test(definition.trim());

/**
 * An English verb whose subject can undergo the event ("the door opened",
 * "prices increased", "the meeting started"): an `ergative` sense, or an
 * intransitive one defined as a change of state. "Pay" (to give money; to
 * suffer consequences) has intransitive senses with an acting subject.
 */
export function englishErgative(entries, lemma) {
  return (entries.get(lemma) || [])
    .filter((e) => e.pos === 'verb')
    .some((e) =>
      (e.rawDefinitions || [])
        .filter((d) => !/\|(?:rare|obsolete|archaic|dated)[|}]/.test(d))
        .some((d) => {
          const labels =
            /\{\{(?:lb|lbl|label)\|en\|([^}]*)\}\}/.exec(d)?.[1] || '';
          const text = d
            .replace(/\{\{[^{}]*\}\}/g, ' ')
            .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
            .replace(/^[#*:\s]+/, '')
            .replace(/^\([^)]*\)\s*/, '');
          return (
            /(?:^|\|)ergative(?:\||$)/.test(labels) ||
            (/(?:^|\|)intransitive(?:\||$)/.test(labels) && changeOfState(text))
          );
        })
    );
}

const section = (page) =>
  unstress(
    page.includes('==Russian==') ? languageSection(page, 'Russian') : page
  );

/** Dictionary links and Russian related-word blocks explicitly name relatives. */
function related(word, page = '') {
  const text = section(page);
  const links = [
    ...text.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]|\{\{(?:l|m)\|ru\|([^|}]+)/g),
  ];
  return (
    links.some((m) => (m[1] || m[2]).trim() === word) ||
    [...text.matchAll(/\{\{родств-блок[^{}]*\}\}/g)].some((m) =>
      (m[0].match(/[а-яё-]+/g) || []).includes(word)
    )
  );
}

/** Related/derived-word links on the Russian predicate's own dictionary page. */
export function reflexiveCounterpart(word, page = '') {
  return related(`${word}ся`, page) ? `${word}ся` : null;
}

/** The counterpart's own page can attest the relationship in the other direction. */
export function reflexiveOf(word, page = '') {
  const text = section(page);
  return (
    related(word, page) &&
    (/\{\{гл ru [^|}\n]*-ся/.test(text) ||
      /\{\{(?:reflexive of|ru-verb)[^}]*\}\}/.test(text))
  );
}

/** An explicitly named Russian aspect partner is lexical attestation too. */
export function reflexivePartner(page = '') {
  return unstress(/\|соотв=([^|}\n]+)/.exec(page)?.[1] || '').trim() || null;
}

export function reflexiveAspect(page = '') {
  const type = /\{\{гл ru ([^|}\n]+)/.exec(page)?.[1] || '';
  return /НСВ/.test(type) ? 'impf' : /СВ/.test(type) ? 'pf' : undefined;
}

/** Fetch attested counterparts through the ordinary cached source layer. */
export async function reflexivePages(words, ruPages, government, options) {
  const links = new Map();
  const candidates = [];
  for (const word of new Set(words)) {
    if (!/^[а-яё-]+$/.test(word) || /с[яь]$/.test(word)) {
      continue;
    }
    const target =
      reflexiveCounterpart(word, ruPages.get(word)) ||
      reflexiveCounterpart(word, government.get(word));
    if (target) {
      links.set(word, target);
    } else {
      candidates.push(word);
    }
  }
  const reverse = await governmentPages(
    candidates.map((w) => `${w}ся`),
    options
  );
  // in candidate order: the pages arrive in network order, and the later
  // batches must not depend on it (a recording replays the same requests)
  for (const base of candidates) {
    const word = `${base}ся`;
    const page = reverse.get(word);
    if (page !== undefined && reflexiveOf(base, page)) {
      links.set(base, word);
      government.set(word, page);
    }
  }
  const pages = await fetchPages(
    [...new Set(links.values())].filter((word) => !ruPages.has(word)),
    options
  );
  pages.forEach((page, word) => ruPages.set(word, page));
  const partners = [...new Set(links.values())].flatMap((word) =>
    russianTemplates(ruPages.get(word) || '').flatMap((e) =>
      [e.headword?.named?.pf, e.headword?.named?.impf]
        .filter(Boolean)
        .map((p) => unstress(p.split(',')[0]).trim())
    )
  );
  const partnerPages = await fetchPages(
    partners.filter((p) => !ruPages.has(p)),
    options
  );
  partnerPages.forEach((page, word) => ruPages.set(word, page));
  return links;
}
