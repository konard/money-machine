/** "a 60-day hold", "a 30-minute lesson": a hyphenated count and unit. */
import { Cursor } from './cursor.mjs';

const has = (t, pos) => Boolean(t?.readings?.some((r) => r.pos === pos));

/**
 * A count joined by a hyphen to a unit noun, before the noun it measures,
 * is how long or how large that thing is: a `rel.for` phrase marked
 * `measure`, spelled again as "60-day" in English.
 * @returns {object|null} the phrase, with the cursor past the unit
 */
export function measureAhead(c, options, parseNP) {
  const [count, unit, next] = [c.peek, c.at(1), c.at(2)];
  if (
    !count?.measure ||
    !has(unit, 'noun') ||
    !['noun', 'adj', 'name', 'propn'].some((p) => has(next, p))
  ) {
    return null;
  }
  const inner = new Cursor([
    count,
    { ...unit, readings: unit.readings.filter((r) => r.pos === 'noun') },
  ]);
  inner.grammar = c.grammar;
  const np = parseNP(inner, { ...options, stopAt: undefined });
  if (!np || !inner.done || np.quantity === undefined) {
    return null;
  }
  c.i += 2;
  return { type: 'pp', relation: 'rel.for', measure: true, np };
}
