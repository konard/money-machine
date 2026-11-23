import { generateEnglish } from '../../english/generate.mjs';
import { compareMeta } from '../../english/round-trip.mjs';
import { formalize } from '../../formalize.mjs';
import { DocumentMemory } from '../../senses.mjs';
import { analyzeRussian } from './index.mjs';
import { compareRussianMeta } from './compare.mjs';

const complete = (formal) =>
  Boolean(formal?.statements.length) &&
  !formal.unknown.length &&
  !formal.leftover.length;

/** Analyse only the rendered Russian when generating the return English. */
export function viaRussian(translation, lexicon, options = {}) {
  const { source, text: russian, formal: before } = translation;
  const russianMeta = before ? analyzeRussian(russian, lexicon, options) : null;
  const russianComparison = before
    ? compareRussianMeta(before, russianMeta)
    : null;
  const russianComplete = complete(russianMeta);
  const english = russianComplete
    ? generateEnglish(russianMeta, lexicon)
    : null;
  const after = english
    ? formalize(
        english,
        lexicon,
        Object.assign(new DocumentMemory(), options.memory),
        options
      )
    : null;
  const differences = before && after ? compareMeta(before, after) : null;
  const finished = Boolean(
    before && translation.complete && russianComplete && complete(after)
  );
  return {
    source,
    russian,
    english,
    before,
    russianMeta,
    after,
    russianComparison,
    differences,
    notes: translation.notes,
    complete: finished,
    exact: finished && russianComparison.exact && differences.length === 0,
  };
}
