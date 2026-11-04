/** Dictionary POS order is evidence for fragments, never a lexical command list. */
import { has, reading } from './token-readings.mjs';
import { publicSenses } from '../sources/sense-data.mjs';

/** Keep the source's section order and definition counts, before translation filtering. */
export function rememberPartsOfSpeech(entries, lexicon) {
  lexicon.partsOfSpeech ||= new Map();
  for (const [lemma, sections] of entries) {
    if (lemma.endsWith('/translations')) {
      continue;
    }
    const counts = {};
    const order = [];
    for (const section of sections) {
      if (section.capital || section.rare) {
        continue;
      }
      if (!order.includes(section.pos)) {
        order.push(section.pos);
      }
      counts[section.pos] =
        (counts[section.pos] || 0) + (section.rawDefinitions?.length || 0);
    }
    if (order.length) {
      lexicon.partsOfSpeech.set(lemma, { order, counts });
    }
    // Overrides retain their translations, but inherit attested grammar.
    const senses = publicSenses(entries, lemma, 'verb');
    for (const id of lexicon.lookup('verb', lemma)) {
      const concept = lexicon.get(id);
      const frames = senses
        .filter((s) => s.russian.some((r) => r.word === concept.ru?.lemma))
        .flatMap((s) => s.frames || []);
      if (frames.length) {
        concept.frames = [...new Set([...(concept.frames || []), ...frames])];
      }
    }
  }
}

export function nounFirst(token, lexicon, competitor = 'verb') {
  const noun = reading(token, 'noun');
  if (!noun) {
    return false;
  }
  if (!has(token, competitor)) {
    return true;
  }
  const data = lexicon.partsOfSpeech?.get(noun.lemma);
  return Boolean(
    data &&
    data.order.indexOf('noun') >= 0 &&
    (data.order.indexOf(competitor) < 0 ||
      data.order.indexOf('noun') < data.order.indexOf(competitor) ||
      data.counts.noun > data.counts[competitor]) &&
    data.counts.noun > 0
  );
}

/** A bare compound can name an item; an article after its first word signals an object. */
function nominalStart(tokens, lexicon) {
  const first = tokens[0];
  if (!first) {
    return false;
  }
  if (has(first, 'num') || first.kind === 'quantity') {
    return true;
  }
  if (has(first, 'det') || has(first, 'pron') || has(first, 'neg')) {
    return !has(first, 'verb') && !has(first, 'neg');
  }
  let end = tokens.findIndex(
    (t) => (has(t, 'prep') || has(t, 'subord')) && !has(t, 'det')
  );
  if (end < 0) {
    end = tokens.length;
  }
  const compound = tokens.slice(0, end);
  // A complex bare object after an exclusively transitive verb is a strong
  // request reading. A following gerund independently supports a nominal chain.
  const verb = reading(first, 'verb');
  if (
    compound.length > 2 &&
    verb &&
    !compound[1].readings.some(
      (r) => r.pos === 'verb' && r.features.form === 'ing'
    ) &&
    verb.concepts.length &&
    verb.concepts.every((id) => {
      const frames = lexicon.get(id)?.frames || [];
      return frames.includes('transitive') && !frames.includes('intransitive');
    })
  ) {
    return false;
  }
  if (compound.length < 2) {
    return !has(first, 'verb');
  }
  if (
    compound.some((t) =>
      ['det', 'pron', 'poss', 'be', 'modal', 'do', 'have'].some((p) =>
        has(t, p)
      )
    )
  ) {
    return false;
  }
  if (!(
    nounFirst(first, lexicon) ||
    has(first, 'propn') ||
    has(first, 'adj')
  )) {
    return false;
  }
  // Plural subjects followed by base verbs are ordinary statements ("Costs vary").
  if (
    reading(first, 'noun')?.features.number === 'pl' &&
    has(compound[1], 'verb')
  ) {
    return false;
  }
  return compound.every(
    (t) =>
      has(t, 'propn') ||
      has(t, 'adj') ||
      has(t, 'num') ||
      nounFirst(t, lexicon) ||
      t.readings.some((r) => r.pos === 'verb' && r.features.form === 'ing')
  );
}

/** Break ties only when the complete alternative is a series of nominal items. */
export function preferNominal(tokens, clauses, fragments, lexicon) {
  if (
    fragments.leftover.length ||
    !fragments.list.length ||
    fragments.list.some((x) => x.type !== 'fragment')
  ) {
    return false;
  }
  const items = [];
  let item = [];
  for (const token of tokens) {
    if (
      [',', ';', ':', '+'].includes(token.text) ||
      (has(token, 'coord') && !token.slash)
    ) {
      if (item.length) {
        items.push(item);
      }
      item = [];
    } else if (token.kind !== 'punct') {
      item.push(token);
    }
  }
  if (item.length) {
    items.push(item);
  }
  return (
    clauses.list.some((c) => c.type === 'clause') &&
    items.length > 0 &&
    items.every((part) => nominalStart(part, lexicon))
  );
}
