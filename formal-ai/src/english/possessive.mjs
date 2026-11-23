/** The possessive clitic: "John's book" rather than "John is". */
import { has } from './token-readings.mjs';
import { nounAhead } from './predicate-adjectives.mjs';

/** `'s` after a noun is possessive when a noun phrase follows. */
export function possessiveClitic(c) {
  if (c.peek.lower === "'") {
    return true;
  }
  const after = c.at(1);
  const name = (t) =>
    /^[A-Z]/.test(t?.text) && (has(t, 'propn') || has(t, 'name'));
  // "Audiomack's free route": an adjective (even one that is also a verb)
  // before a noun starts the owned noun phrase; so does a name ("the
  // site's FAQ says") or a noun that is also a bare verb ("tutor FAQ")
  return Boolean(
    after &&
    (has(after, 'noun') || has(after, 'adj') || name(after)) &&
    (!has(after, 'verb') ||
      (has(after, 'adj') && nounAhead(c, 2)) ||
      // "Tom's book is here": a bare base form cannot follow "is"
      (has(after, 'noun') &&
        after.readings.every(
          (r) => r.pos !== 'verb' || r.features?.form === 'base'
        )))
  );
}
