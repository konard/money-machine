/** Offsets and punctuation survive tokenization; ё/е share dictionary keys. */
export const lower = (text) => text.toLowerCase().replace(/ё/g, 'е');
export function tokenizeRussian(text) {
  return [
    ...text.matchAll(/[$€£]?[\p{L}\d]+(?:[.,'’-][\p{L}\d]+)*|[^\s]/gu),
  ].map((match) => ({
    text: match[0],
    lower: lower(match[0]),
    offset: match.index,
  }));
}
