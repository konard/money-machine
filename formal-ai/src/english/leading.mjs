/** Fronted adverbials before a subject: "On Tuesday we…", "Yesterday, I…". */

import { has, head, parseNP, reading, timeAhead } from './parser.mjs';

/** A subject comes next (after an optional comma). */
export function subjectAhead(c) {
  const t = c.peek?.text === ',' ? c.at(1) : c.peek;
  if (!t) {
    return false;
  }
  return (
    ['pron', 'det', 'poss', 'name', 'propn', 'num'].some((p) => has(t, p)) ||
    (has(t, 'noun') && !has(t, 'verb'))
  );
}

/**
 * Fronted adverbials before the subject: "On Tuesday we…", "Next Friday
 * I…", "Yesterday, they…". Each is marked `fronted` so the Russian keeps it
 * first.
 */
export function parseLeading(c) {
  const mods = [];
  const done = (mod) => {
    mods.push({ ...mod, fronted: true });
    if (c.peek?.text === ',') {
      c.next();
    }
  };
  for (let guard = 0; guard < 4 && c.peek; guard += 1) {
    const t = c.peek;
    const save = c.i;
    if (has(t, 'prep')) {
      c.next();
      const np = parseNP(c, { relative: false });
      if (np && subjectAhead(c)) {
        done({
          type: 'pp',
          relation: reading(t, 'prep').concepts[0],
          prep: t.lower,
          np,
          token: t.index,
        });
        continue;
      }
      c.i = save;
      break;
    }
    if (
      ['every', 'each', 'last', 'next', 'this'].includes(t.lower) &&
      timeAhead(c)
    ) {
      const np = parseNP(c, { relative: false });
      if (np && subjectAhead(c)) {
        done({ type: 'time', np });
        continue;
      }
      c.i = save;
      break;
    }
    if (
      has(t, 'adv') &&
      !has(t, 'wh') &&
      // "Still, users pay": a comma sets off a sentence adverb
      (!has(t, 'verb') || c.at(1)?.text === ',') &&
      (!has(t, 'noun') || has(c.at(1), 'pron') || c.at(1)?.text === ',') &&
      // "new payout rule": an adjective before its noun
      !(has(t, 'adj') && has(c.at(1), 'noun'))
    ) {
      c.next();
      if (subjectAhead(c)) {
        done({ type: 'adv', ...head(t, reading(t, 'adv')) });
        continue;
      }
      c.i = save;
    }
    break;
  }
  return mods;
}

/** Would `parseLeading` take a prepositional phrase here? */
export function leadingPhraseAhead(c) {
  const save = c.i;
  const mods = parseLeading(c);
  c.i = save;
  return mods.length > 0;
}
