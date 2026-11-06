/** "as": a role ("work as a writer") or an equative ("as tall as Mary"). */

import { parseNP } from './parser.mjs';
import { clauseAhead } from './lists.mjs';
import { has, head, reading } from './token-readings.mjs';

/** Parse an "as" phrase in a clause tail into `out`; false if none. */
export function asPhrase(c, frame, out, options) {
  if (clauseAhead(c, 1)) {
    return false;
  }
  const save = c.i;
  c.next();
  if (asComparison(c, frame, out)) {
    return true;
  }
  const np = parseNP(c, { stopAt: options.stopAt });
  if (np) {
    out.mods.push({ type: 'role', np });
    return true;
  }
  c.i = save;
  return false;
}

/** "as tall as Mary": an equative adjective or adverb and its standard. */
function asComparison(c, frame, out) {
  const word = c.peek;
  const pos =
    frame === 'copula' && !out.complement && has(word, 'adj')
      ? 'adj'
      : has(word, 'adv')
        ? 'adv'
        : null;
  if (!pos || c.at(1)?.lower !== 'as') {
    return false;
  }
  const save = c.i;
  c.next();
  c.next();
  const np = parseNP(c);
  if (!np) {
    c.i = save;
    return false;
  }
  const item = { ...head(word, reading(word, pos)), comparison: 'equal' };
  if (pos === 'adj') {
    out.complement = { type: 'adj', ...item };
  } else {
    out.mods.push({ type: 'adv', ...item });
  }
  out.mods.push({ type: 'comparison', np, equal: true });
  return true;
}
