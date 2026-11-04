/** Commas around parenthetic expressions attested in the Russian lexicon. */
export function markParenthetic(word, entry) {
  return entry?.parenthetic ? `\uE000${word}\uE001` : word;
}

/** Only the selected adverb occurrence is marked; homonymous predicates stay plain. */
export function punctuateParenthetics(text) {
  return text
    .replace(
      /\uE000([^\uE000\uE001]+)\uE001/g,
      (marked, word, offset, source) => {
        const before = source.slice(0, offset).trimEnd();
        const after = source.slice(offset + marked.length).trimStart();
        return `${/[\p{L}\p{N})\]»]$/u.test(before) ? ', ' : ''}${word}${after && !/^[,;:!?.)\]»]/.test(after) ? ',' : ''}`;
      }
    )
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',');
}
