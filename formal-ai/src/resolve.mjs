/** Resolve vocabulary, senses and Russian forms from public dictionaries. */
import { loadTopicalLabels } from './sources/label-data.mjs';
import { unknownWords, capitalizedWords } from './unknown-words.mjs';
import { learnActionNouns } from './sources/action-nouns.mjs';
import { populateContexts } from './sources/resolve-links.mjs';
import { learnInfinitiveFrames } from './sources/infinitive-frames.mjs';
import { learnPrepositions } from './sources/prepositions.mjs';
import { learnUnitSymbols } from './sources/unit-symbols.mjs';
import { nameCandidates } from './name-candidates.mjs';
import { resolveNames, declineNames } from './name-resolution.mjs';
import { learnHyphenated } from './hyphenated.mjs';
import { readings } from './english/analyze.mjs';
import { completeForms, sameFormPasts } from './forms.mjs';
import { phrasalCandidates } from './compounds.mjs';
import { contextFrequencies } from './sources/context-frequency.mjs';
import { learnTimeAdverbs } from './sources/time-adverbs.mjs';
import { loadLexicon } from './lexicon.mjs';
import { compoundNoun, regularEntry } from './russian-entry.mjs';
import { englishPages, learnForms } from './resolve/english-pages.mjs';
import { sensePlans } from './resolve/sense-plans.mjs';
import { russianPages, russianEntries } from './resolve/russian-pages.mjs';
import { learnConcepts, corpusEvidence } from './resolve/concepts.mjs';

export { phrasalCandidates } from './compounds.mjs';
export { compoundNoun, regularEntry, resolveNames, nameCandidates };
export { unknownWords, capitalizedWords };

/**
 * Resolve every unknown word of `text` into the lexicon: ask the public
 * sources for just the pages the text needs, phase by phase (resolve/),
 * and keep each word's text-independent facts as concepts.
 * @returns {Promise<{words: number, resolved: string[], missing: string[]}>}
 */
export async function resolveText(
  text,
  {
    lexicon = loadLexicon(),
    fetchImpl,
    cache = true,
    log = () => {},
    words: only,
    topic = text,
    context,
    methods,
    sources,
  } = {}
) {
  const options = { fetchImpl, cache, sources };
  if (!only) {
    await learnPrepositions(text, lexicon, options);
    await learnUnitSymbols(text, lexicon, options);
  }
  const words = only || unknownWords(text, lexicon);
  if ((options.words = words).length) {
    await loadTopicalLabels(options); // which sense labels are fields
  }
  const pages = await englishPages({ text, lexicon, options, words, only });
  const { done, entries, forms, dictionaryNames } = pages;
  log(`wiktionary: ${words.length} unknown words, ${entries.size} pages`);
  const run = { text, lexicon, options, words, only, log, ...pages };
  Object.assign(run, await sensePlans(run));
  Object.assign(run, await russianPages(run));
  run.russian = russianEntries(run);
  const resolved = await learnConcepts(run);
  await corpusEvidence(resolved, run.plans, lexicon, options);
  learnForms(forms, lexicon);
  await learnInfinitiveFrames(entries, lexicon, options);
  await learnActionNouns(text, lexicon, options);
  lexicon.markAsked([...words, ...done]);
  if (!only) {
    await sameFormPasts(text, { lexicon, fetchImpl, cache });
    await completeForms(
      `${text} ${words
        .filter((w) => w.includes('-'))
        .join(' ')
        .replaceAll('-', ' ')}`,
      { lexicon, fetchImpl, cache, log }
    );
  }
  resolved.push(...learnHyphenated(words, lexicon, topic));
  const missing = words.filter(
    (w) =>
      !readings({ text: w, lower: w, kind: 'word', first: true }, lexicon).some(
        (r) => r.pos !== 'propn'
      )
  );
  const names = [
    ...new Set([...nameCandidates(text, lexicon), ...dictionaryNames.keys()]),
  ];
  const internal = new Set(
    [...text.matchAll(/\b[a-z][a-z'-]*[,;(]?\s+([A-Z][a-z]+)\b/g)].map(
      (m) => m[1]
    )
  );
  const givenOnly = new Set(
    names.filter(
      (n) =>
        !(
          internal.has(n) ||
          // "Kenya is…": a page that is first of all a country, not a name
          lexicon.notGivenFirst?.has(n) ||
          n.includes(' ') ||
          /[.-]/.test(n) ||
          /^[A-Z][A-Z0-9]+s?$/.test(n) ||
          !readings(
            {
              text: n.toLowerCase(),
              lower: n.toLowerCase(),
              kind: 'word',
              first: true,
            },
            lexicon
          ).length
        )
    )
  );
  await resolveNames(names, { ...options, lexicon, topic, givenOnly, methods });
  await declineNames(dictionaryNames, { lexicon, fetchImpl, cache });
  // "AI-generated": a compound whose part is a name known only now
  resolved.push(
    ...learnHyphenated(
      words.filter(
        (w) => /^[a-z\d]+-/.test(w) && !lexicon.lookup('adj', w).length
      ),
      lexicon,
      topic
    )
  );
  if (!only) {
    // A phrase page read for its expressions has taught no verb yet, so
    // "asked" alone would hide "hand over"; ask once as a verb of its own.
    const phrasal = phrasalCandidates(text, lexicon).filter(
      (p) => !lexicon.asked(`phrasal ${p}`)
    );
    if (phrasal.length) {
      lexicon.markAsked(phrasal.map((p) => `phrasal ${p}`));
      const inner = await resolveText('', {
        lexicon,
        fetchImpl,
        cache,
        log,
        words: phrasal,
      });
      resolved.push(...inner.resolved);
    }
  }
  if (!only) {
    await contextFrequencies(text, lexicon, options);
    await learnTimeAdverbs(text, lexicon, options);
  }
  log(`resolved ${resolved.length} senses; still unknown: ${missing.length}`);
  await populateContexts(lexicon, { ...options, context, text, log });
  return { words: words.length, resolved, missing };
}
