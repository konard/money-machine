/** Commas around parenthetic expressions attested in the Russian lexicon. */
export function punctuateParenthetics(text, lexicon) {
  const words = [
    ...new Set(
      [...lexicon.concepts.values()]
        .filter((c) => c.ru?.parenthetic)
        .map((c) => c.ru.lemma)
    ),
  ].sort((a, b) => b.length - a.length);
  if (!words.length) {
    return text;
  }
  const pattern = words
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return text
    .replace(
      new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'giu'),
      (word, offset, source) => {
        const before = source.slice(0, offset).trimEnd();
        const after = source.slice(offset + word.length).trimStart();
        return `${/[\p{L}\p{N})\]»]$/u.test(before) ? ',' : ''}${word}${after && !/^[,;:!?.)\]»]/.test(after) ? ',' : ''}`;
      }
    )
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/,(?=\S)/g, ', ');
}
