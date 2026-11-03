/** Fixed expressions and given-name evidence from public dictionary entries. */
import { tokenize } from './english/analyze.mjs';
import { englishEntries, matchingDefinition } from './sources/wiktionary.mjs';

const CLITICS = {
  "'re": 'are',
  "'m": 'am',
  "'ve": 'have',
  "'ll": 'will',
  "'s": 'is',
};
const phraseWords = (text) =>
  tokenize(text)
    .filter((t) => t.kind === 'word' || t.kind === 'clitic')
    .map((t) => CLITICS[t.lower] || t.lower.replace(/^'/, ''))
    .filter((w) => /\p{L}/u.test(w));

function phraseForms(words) {
  let forms = [[]];
  for (const word of words) {
    const clitic = Object.entries(CLITICS).find(
      ([, full]) => full === word
    )?.[0];
    forms = forms.flatMap((prefix) => [
      [...prefix, word],
      ...(prefix.length && clitic ? [[...prefix, clitic.slice(1)]] : []),
    ]);
  }
  return forms.map((words) => ({ pos: 'phrase', words }));
}

/** Include sentence titles first, then contiguous n-grams, never across lines. */
export function phraseCandidates(text) {
  const out = new Set();
  const clean = text
    .replace(/```[\s\S]*?```|`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)|https?:\/\/\S+|<[^>]+>/g, ' ');
  for (const sentence of clean.split(/[.!?\n]+/)) {
    const words = phraseWords(sentence);
    if (!words.length) {
      continue;
    }
    out.add(words.join(' '));
    const raw = (
      sentence
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .match(/\p{L}+(?:'\p{L}+)*/gu) || []
    ).join(' ');
    if (raw.includes("'")) {
      out.add(raw);
    }
    for (let n = Math.min(5, words.length); n >= 1; n -= 1) {
      for (let i = 0; i + n <= words.length; i += 1) {
        out.add(words.slice(i, i + n).join(' '));
      }
    }
  }
  for (const title of [...out]) {
    const contracted = title.replace(
      /\b(i|you|we|they|he|she|it) (am|are|is|have|will)\b/g,
      (_, pronoun, auxiliary) =>
        pronoun +
        Object.entries(CLITICS).find(([, full]) => full === auxiliary)[0]
    );
    for (const variant of [title, contracted]) {
      out.add(variant);
      if (/\bi\b/.test(variant)) {
        out.add(variant.replace(/\bi\b/g, 'I'));
      }
    }
  }
  return [...out];
}

/** Wiktionary also files fixed expressions under these POS headings. */
export function publicEntries(page) {
  const normalized = page
    .replace(
      /^(={3,5})\s*(?:Proverb|Idiom|Saying|Particle)\s*\1\s*$/gm,
      '$1Phrase$1'
    )
    // Sentence punctuation belongs to the input sentence, not the lexeme.
    .replace(
      /(\{\{tt?\+?\|ru\|)([^{}]*)(\}\})/g,
      (_, open, body, close) =>
        open +
        body.replace(/[!?]+(?=\||$)/g, '').replace(/\/[^|]+/g, '') +
        close
    )
    .replace(
      /\{\{(?:ng|n-g|non-gloss|non-gloss definition)\|([^{}]*)\}\}/g,
      '$1'
    );
  const entries = englishEntries(normalized);
  for (const e of entries.filter((e) => ['intj', 'phrase'].includes(e.pos))) {
    // Some pages put a phrase's tables after a later POS heading. Borrow
    // only tables whose gloss matches the phrase rather than that POS.
    if (!e.senses.length) {
      e.senses = entries
        .filter((other) => other !== e)
        .flatMap((other) =>
          other.senses.filter(
            (s) =>
              matchingDefinition(s.gloss, e.rawDefinitions).definition &&
              !matchingDefinition(s.gloss, other.rawDefinitions).definition
          )
        );
    }
  }
  return entries;
}

export function learnPhrases(candidates, entries, sensesOf, lexicon) {
  const resolved = [];
  for (const title of candidates) {
    let senses = (entries.get(title) || [])
      .filter((e) => ['intj', 'phrase'].includes(e.pos) && !e.rare)
      .flatMap((e) => sensesOf(title, e.pos))
      .filter((s) => s.russian?.length && !s.rare)
      .sort((a, b) => (b.languages || 0) - (a.languages || 0));
    if (senses.some((s) => !s.side && !s.seeAlso)) {
      senses = senses.filter((s) => !s.side && !s.seeAlso);
    }
    const sense = senses[0];
    const id = `wikt:phrase:${title}`;
    if (!sense || lexicon.get(id)) {
      continue;
    }
    lexicon.add({
      id,
      gloss: sense.gloss,
      en: phraseForms(phraseWords(title)),
      ru: { pos: 'phrase', text: sense.russian[0].word },
      source: 'wiktionary',
    });
    resolved.push(id);
  }
  return resolved;
}

/** Only the English proper-noun definition supplies name evidence. */
export function givenNameEntries(page) {
  return publicEntries(page).filter(
    (e) =>
      e.pos === 'propn' &&
      !e.rare &&
      e.rawDefinitions.some((d) => /\{\{given name\|en(?:\||\}\})/.test(d))
  );
}

/** Prefer a marked transliteration over a historical cognate of a name. */
export function givenNameLabel(page) {
  const senses = givenNameEntries(page)
    .flatMap((e) => e.senses)
    .filter((s) => s.russian?.length)
    .sort((a, b) => (b.languages || 0) - (a.languages || 0));
  if (!senses.length) {
    return null;
  }
  const line = page.match(
    /^\*\s*Russian:.*\{\{(?:qualifier|q|i)\|transliteration\}\}([^\n]*)/m
  )?.[1];
  if (line) {
    const entry = englishEntries(
      `==English==\n===Proper noun===\n{{trans-top|name}}\n* Russian: ${line}\n{{trans-bottom}}`
    )[0];
    return entry?.senses[0]?.russian[0]?.word || senses[0].russian[0].word;
  }
  return senses[0].russian[0].word;
}

export function markGivenName(lexicon, name) {
  lexicon.givenNames ||= new Set();
  lexicon.givenNames.add(name);
}

export function isGivenName(entity) {
  return (entity?.claims?.P31 || []).some((claim) =>
    ['Q12308941', 'Q11879590'].includes(claim.mainsnak?.datavalue?.value?.id)
  );
}
