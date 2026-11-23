/**
 * "Confidence: estimated", "Confidence: high", "Status: approved": a label
 * whose value is a property of it — an adjective or a passive participle.
 */
import { has, head, isPunct } from './parser.mjs';

/** A participle alone in its part of the sentence: "…: estimated;". */
export function participleValue(c) {
  const t = c.peek;
  const pp = t?.readings.find(
    (r) => r.pos === 'verb' && /pp/.test(r.features?.form || '')
  );
  if (
    !pp ||
    ['noun', 'adj', 'det', 'pron'].some((p) => has(t, p)) ||
    (c.at(1) && !(isPunct(c.at(1)) && c.at(1).text !== ','))
  ) {
    return null;
  }
  c.next();
  return {
    type: 'fragment',
    property: { ...head(t, pp), participle: 'passive' },
  };
}

/** Join a label and the property after its colon into one fact. */
export function mergeLabelValues(list) {
  for (let i = list.length - 2; i >= 0; i -= 1) {
    const [label, value] = [list[i], list[i + 1]];
    if (
      label.type === 'fragment' &&
      label.np &&
      !label.np.name &&
      !label.factValue &&
      !label.property &&
      !label.answer &&
      value.type === 'fragment' &&
      value.link?.separator === ':' &&
      value.property &&
      !value.np &&
      !value.negative &&
      !value.mods?.length
    ) {
      list.splice(i, 2, {
        ...label,
        factProperty: value.property,
        valueSeparator: ':',
      });
    }
  }
}

/** A capital letter naming an item: "Tier C", "plan B". */
export function letterLabel(token) {
  // "I" and "A" are words of their own: a pronoun, an article
  return (
    token?.kind === 'word' &&
    /^[A-Z]$/.test(token.text) &&
    !token.readings?.some((r) => /pron|det/.test(r.pos))
  );
}
