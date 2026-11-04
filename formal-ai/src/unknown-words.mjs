/** Which words of a text the public sources must be asked about. */
import { readings, tokenize } from './english/analyze.mjs';
import { loadLexicon } from './lexicon.mjs';

/** A grammatical word, never looked up; "like", "there" and "hundred" may
 * be content words ("went there", "several hundred"). */
export function closedClass(word, lexicon) {
  const open = ['propn', 'noun', 'verb', 'adj', 'adv', 'name', 'prep', 'there'];
  return readings(
    { text: word, lower: word, kind: 'word', first: true },
    lexicon
  ).some(
    (r) =>
      !open.includes(r.pos) && !(r.pos === 'num' && r.features?.value >= 100)
  );
}
/** Words of a text that the lexicon has no reading for. */
export function unknownWords(text, lexicon = loadLexicon()) {
  const out = new Set();
  const clean = text
    .replace(/```[\s\S]*?```|`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)|https?:\/\/\S+|<[^>]+>/g, ' ');
  // a line starts a sentence or a list item, whatever ends the line above
  const tokens = clean
    .split('\n')
    .flatMap((line) => tokenize(line).map((t, k) => ({ ...t, lineStart: !k })));
  // a word only ever capitalized inside sentences is a name ("Google")
  const lowercase = new Set(
    tokens.filter((t) => t.text === t.lower).map((t) => t.lower)
  );
  for (const [i, token] of tokens.entries()) {
    const w = token.lower;
    if (
      token.kind !== 'word' ||
      // "e.g." and "i.e." are words too
      !/^\p{Ll}[\p{Ll}-]*\p{Ll}$|^\p{Ll}(?:\.\p{Ll})+\.$/u.test(w) ||
      w.length < 2
    ) {
      continue;
    }
    const initial =
      token.lineStart || /^[.!?:#*\-–—|>"(]$/.test(tokens[i - 1].text);
    if (!initial && token.text !== w && !lowercase.has(w)) {
      continue;
    }
    // a content word is looked up unless public sources were asked already
    const closed = closedClass(w, lexicon);
    if (!closed && !lexicon.asked?.(w)) {
      out.add(w);
    }
  }
  return [...out];
}
/** Unknown capitals inside sentences: names, months and weekdays. */
export function capitalizedWords(text, lexicon = loadLexicon()) {
  const out = new Set();
  for (const line of text.replace(/```[\s\S]*?```|`[^`]*`/g, ' ').split('\n')) {
    const tokens = tokenize(line);
    for (const [i, t] of tokens.entries()) {
      if (
        i > 0 &&
        t.kind === 'word' &&
        /^\p{Lu}\p{Ll}+$/u.test(t.text) &&
        !/^[.!?:#*\-–—|>"(]$/.test(tokens[i - 1].text) &&
        !lexicon.lookup('noun', t.lower).length &&
        !lexicon.asked?.(t.lower)
      ) {
        out.add(t.lower);
      }
    }
  }
  return [...out];
}
