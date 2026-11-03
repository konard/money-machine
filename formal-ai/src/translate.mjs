/**
 * English → Russian translation through the meta language.
 */

import { loadLexicon } from './lexicon.mjs';
import { formalize } from './formalize.mjs';
import { naturalizeRussian } from './russian/naturalize.mjs';
import { DocumentMemory } from './senses.mjs';

/** Translation state shared by the sentences of one document. */
export class TranslationContext {
  constructor(options = {}) {
    this.lexicon = options.lexicon || loadLexicon();
    this.options = options;
    this.memory = new DocumentMemory();
    this.discourse = { referents: [] };
  }
}

/**
 * Translate one sentence.
 * @param {string} sentence
 * @param {TranslationContext} [context]
 * @returns {{source: string, text: string, formal: object, notes: string[],
 *   unknown: string[], leftover: string[], senses: object[], complete: boolean}}
 */
export function translateSentence(
  sentence,
  context = new TranslationContext()
) {
  const formal = formalize(sentence, context.lexicon, context.memory);
  const ru = naturalizeRussian(
    formal,
    context.lexicon,
    context.options,
    context.discourse
  );
  const complete =
    formal.unknown.length === 0 &&
    formal.leftover.length === 0 &&
    !/\[/.test(ru.text);
  return {
    source: sentence,
    text: ru.text,
    formal,
    notes: ru.notes,
    unknown: formal.unknown,
    leftover: formal.leftover,
    senses: formal.senses,
    complete,
  };
}
