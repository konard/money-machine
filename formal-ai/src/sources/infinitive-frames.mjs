/** Public, cached complement inventory; examples alone can also express purpose. */
import { senseFrames } from './verb-frames.mjs';
import { DETERMINERS, POSSESSIVES } from '../english/function-words.mjs';
import { fetchPages, englishEntries } from './wiktionary.mjs';

export const hasComplementFrame = (sense) =>
  sense.frames?.some((f) =>
    [
      'object-to',
      'to-infinitive',
      'to-example',
      'that',
      'question',
      'about',
    ].includes(f)
  );

export const CATENATIVES = 'Appendix:English catenative verbs';

/** Only the explicitly active to-infinitive sections, excluding purpose notes. */
export function catenativeInventory(text = '') {
  const words = new Set();
  let active = false;
  let word;
  let block = [];
  const finish = () => {
    if (word && !/infinitive of purpose|\)[ \t]*\*/i.test(block.join('\n'))) {
      words.add(word);
    }
    word = undefined;
    block = [];
  };
  for (const line of text.split('\n')) {
    if (/^==[^=]/.test(line)) {
      finish();
      active = /^== Followed by a ''to''-infinitive(?: ==| or)/.test(line);
    }
    const next = /^\[\[([a-z]+(?: [a-z]+)*)(?:\|[^\]]+)?\]\]/.exec(line)?.[1];
    if (active && next) {
      finish();
      word = next;
    }
    block.push(line);
  }
  finish();
  return words;
}

/** Attach lemma-level availability separately from sense-level frame evidence. */
export async function learnInfinitiveFrames(entries, lexicon, options) {
  if (
    ![...entries.values()].flat().some((e) => ['verb', 'adj'].includes(e.pos))
  ) {
    return;
  }
  const targets = [
    ...new Set(
      [...entries]
        .flatMap(([lemma, list]) =>
          list
            .filter((e) => e.pos === 'adj' && !e.rare)
            .flatMap((e) =>
              e.rawDefinitions.flatMap((raw) => senseFrames(raw, lemma))
            )
        )
        .filter((f) => f.startsWith('to-example:'))
        .map((f) => f.slice(11))
    ),
  ].filter(
    (w) =>
      !DETERMINERS[w] &&
      !POSSESSIVES[w] &&
      !lexicon.lookup('verb', w).length &&
      !lexicon.lookup('noun', w).length &&
      !entries.has(w)
  );
  const [pages, targetPages] = await Promise.all([
    fetchPages([CATENATIVES], options),
    fetchPages(targets, options),
  ]);
  const isVerb = (word) =>
    lexicon.lookup('verb', word).length ||
    (entries.get(word) || englishEntries(targetPages.get(word) || '')).some(
      (e) =>
        e.pos === 'verb' &&
        !e.rare &&
        !e.formOf.some(
          (f) => f.lemma !== word && !/alternative|spelling/.test(f.kind)
        )
    );
  const inventory = catenativeInventory(pages.get(CATENATIVES));
  for (const [lemma, list] of entries) {
    for (const pos of ['verb', 'adj']) {
      const own = list.filter((e) => e.pos === pos && !e.rare);
      if (!own.length) {
        continue;
      }
      const concepts = lexicon.lookup(pos, lemma).map((id) => lexicon.get(id));
      const evidence = own.flatMap((e) =>
        e.rawDefinitions.flatMap((raw) => senseFrames(raw, lemma))
      );
      const explicit = evidence.includes('to-infinitive');
      const example = evidence.some(
        (f) => f.startsWith('to-example:') && isVerb(f.slice(11))
      );
      const takes =
        explicit || (pos === 'verb' ? inventory.has(lemma) : example);
      for (const concept of concepts) {
        if (evidence.includes('prep:to')) {
          concept.prepositionalTo = true;
        }
        concept.infinitiveComplement =
          takes || (inventory.size ? false : undefined);
        if (takes && concept.frames?.includes('to-example')) {
          concept.frames = [...new Set([...concept.frames, 'to-infinitive'])];
        }
      }
    }
  }
}
