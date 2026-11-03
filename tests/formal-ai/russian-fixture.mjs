/** Minimal lexical attestation for fixtures that exercise regular morphology. */
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';

const HEADINGS = {
  noun: 'Noun',
  verb: 'Verb',
  adj: 'Adjective',
  adv: 'Adverb',
};
export function attestRussian(pages) {
  for (const page of Object.values(pages)) {
    for (const entry of englishEntries(page)) {
      if (!HEADINGS[entry.pos]) {
        continue;
      }
      for (const sense of entry.senses) {
        for (const { word } of sense.russian) {
          for (const part of word.split(' ')) {
            pages[part] ||=
              `==Russian==\n===${HEADINGS[entry.pos]}===\n# Fixture lexical entry.`;
          }
        }
      }
    }
  }
  return pages;
}

export function russianFixture(vocabulary, title) {
  const found = Object.values(vocabulary).find((entry) =>
    entry[1].split(' ').includes(title)
  );
  return found
    ? `==Russian==\n===${found[0]}===\n# Fixture lexical entry.`
    : null;
}
