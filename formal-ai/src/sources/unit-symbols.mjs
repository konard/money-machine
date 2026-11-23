/**
 * Unit symbols after numbers ("after 30 d", "3 h", "5 kg"): the symbol's
 * Translingual Wiktionary entry names the unit's Wikidata item
 * ({{senseid|mul|Q573}} day), whose Russian unit symbol (P5061, «сут.»)
 * or Russian label is the translation.
 */
import { fetchPages, languageSection } from './wiktionary.mjs';
import { getEntities } from '../wikidata.mjs';

/** Symbols written right after a number: "14–90 d", "2 GB". */
export function unitSymbolCandidates(text, lexicon) {
  const out = new Set();
  for (const m of text.matchAll(
    /(?:^|[\s(])\d[\d.,]*(?:[–-]\d[\d.,]*)?\s?([A-Za-z]{1,3})(?=$|[\s.,;:)/])/g
  )) {
    const symbol = m[1];
    if (!lexicon.lookup('noun', symbol).length) {
      out.add(symbol);
    }
  }
  // "$29/mo": a symbol after a rate's slash even if also a word ("mo", moment)
  for (const m of text.matchAll(/\d\/([a-z]{1,3})(?![A-Za-z])/g)) {
    out.add(m[1]);
  }
  return [...out].filter(
    (symbol) =>
      !lexicon.lookup('noun', symbol).some((id) => id.startsWith('unit:'))
  );
}

/** Wikidata items of a page's senses in a language: {{senseid|mul|Q573}}. */
export function senseItems(page, language, code) {
  const section = languageSection(page || '', language);
  return [
    ...section.matchAll(
      new RegExp(`^#\\s*\\{\\{senseid\\|${code}\\|(Q\\d+)\\}\\}`, 'gm')
    ),
  ].map((m) => m[1]);
}

/** Wikidata items of a page's Translingual symbol senses, in order. */
export function symbolItems(page) {
  return senseItems(page, 'Translingual', 'mul');
}

/**
 * Pages naming the unit a symbol abbreviates: {{SI-unit-abb|kilo|gram}}
 * → "kilogram", {{abbr of|en|gigabyte}} → "gigabyte".
 */
export function abbreviatedUnits(page) {
  const out = [];
  for (const m of (page || '').matchAll(
    /^#\s*\{\{SI-unit-abb\|([^|}]*)\|([^|}]+)/gm
  )) {
    out.push(`${m[1]}${m[2]}`.trim());
  }
  const english = languageSection(page || '', 'English');
  for (const m of english.matchAll(
    /^#\s*\{\{(?:abbr|init|initialism|abbreviation) of\|en\|([^|}]+)/gm
  )) {
    out.push(m[1].trim());
  }
  return [...new Set(out)];
}

/** Russian symbol of a unit item: its P5061 in Russian, else none. */
function russianSymbol(entity) {
  return (entity?.claims?.P5061 || [])
    .map((c) => c.mainsnak?.datavalue?.value)
    .find((v) => v?.language === 'ru')?.text;
}

/**
 * Learn the units of symbols written after numbers in `text`.
 * @returns {Promise<string[]>} the symbols learned
 */
export async function learnUnitSymbols(text, lexicon, options = {}) {
  const symbols = unitSymbolCandidates(text, lexicon);
  if (!symbols.length) {
    return [];
  }
  const pages = await fetchPages(symbols, options);
  const targets = new Map(
    symbols.map((symbol) => [symbol, abbreviatedUnits(pages.get(symbol))])
  );
  const unitPages = await fetchPages(
    [...new Set([...targets.values()].flat())],
    options
  );
  const candidates = new Map();
  for (const symbol of symbols) {
    // Translingual symbol senses first ("d" the day), then the units the
    // symbol abbreviates ("kg" → kilogram, "GB" → gigabyte)
    const ids = [
      ...symbolItems(pages.get(symbol)),
      ...senseItems(pages.get(symbol), 'English', 'en'),
      ...targets
        .get(symbol)
        .flatMap((unit) => senseItems(unitPages.get(unit), 'English', 'en')),
    ];
    candidates.set(symbol, [...new Set(ids)]);
  }
  const entities = await getEntities(
    [...new Set([...candidates.values()].flat())],
    options
  );
  const items = new Map();
  for (const [symbol, ids] of candidates) {
    // the first item that is a unit with a Russian symbol: "h" hour, not
    // the hecto prefix
    const id = ids.find((q) => russianSymbol(entities[q]));
    if (id) {
      items.set(symbol, id);
    }
  }
  const learned = [];
  for (const [symbol, id] of items) {
    const ru = russianSymbol(entities[id]);
    const label = entities[id]?.labels?.en?.value;
    if (!ru || !label) {
      continue;
    }
    lexicon.add({
      id: `unit:${id}`,
      gloss: label,
      grounding: id,
      excludedGroundings: [],
      classes: ['unit'],
      cues: [],
      objectClasses: [],
      syntax: null,
      takes: [],
      prior: 0.5,
      en: [{ pos: 'noun', lemma: symbol, words: [symbol.toLowerCase()] }],
      ru: { pos: 'noun', lemma: ru, gender: 'n', indeclinable: true },
      source: 'unit-symbol',
    });
    learned.push(symbol);
  }
  return learned;
}
