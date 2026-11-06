/** Unlabelled senses may identify a field through their definition's nouns.
 * For explicit views only: two distinct field terms must agree, through at
 * most one dictionary expansion. Raw responses use the normal public cache.
 */
import { fetchPages, englishEntries, plain } from './wiktionary.mjs';
import { glossWords } from './sense-data.mjs';

const definitions = (page) =>
  englishEntries(page || '')
    .filter((e) => e.pos === 'noun' && !e.rare)
    .flatMap((e) =>
      (e.rawDefinitions || []).slice(0, 3).map((d) => plain(d.split('\n')[0]))
    )
    .join(' ');

export async function expandContextDefinitions(lexicon, context, options = {}) {
  const network = lexicon.contextNetwork;
  const name = network.id(context);
  const present = new Set(
    (options.text || '').toLowerCase().match(/[a-z]+/g) || []
  );
  const senses = [...lexicon.concepts.values()].filter(
    (c) =>
      !network.directContextsOf(c).size &&
      !network.bindings.has(c.id) &&
      c.en?.some((e) => present.has(e.lemma?.toLowerCase()))
  );
  if (!senses.length) {
    return;
  }
  try {
    const fields = await fetchPages([name], options);
    const field = new Set(
      glossWords(
        `${definitions(fields.get(name))} ${network.descriptions.get(name) || ''}`,
        name
      )
    );
    if (!field.size) {
      return;
    }
    const cues = [...new Set(senses.flatMap((c) => c.cues || []))].slice(0, 64);
    const pages = await fetchPages(cues, options);
    for (const sense of senses) {
      const expanded = glossWords(
        `${sense.definition || sense.gloss || ''} ${(sense.cues || []).map((cue) => definitions(pages.get(cue))).join(' ')}`
      );
      const shared = [...new Set(expanded)].filter((word) => field.has(word));
      if (shared.length < 2) {
        continue;
      }
      sense.contexts = [name];
      sense.contextSource = {
        source: 'dictionary definitions',
        context: name,
        shared,
      };
      network.linkConcept(sense);
    }
  } catch (error) {
    options.log?.(`context definitions ${name}: ${error.message}`);
  }
}
