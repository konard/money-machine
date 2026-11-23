/** Russian number notation: digit groups, decimal comma, тыс./млн/млрд. */

const SCALE = {
  k: 'тыс.',
  K: 'тыс.',
  m: 'млн',
  M: 'млн',
  b: 'млрд',
  B: 'млрд',
};

/**
 * Russian notation of a quantity: "$1k–$20k" → "$1 тыс.–$20 тыс.",
 * "2,000.5" → "2 000,5", "~$50" → "≈$50".
 */
export function localizeQuantity(text) {
  return text
    .replace(/^~/, '≈')
    .replace(/([\dkKmMbB%])-(?=[\p{Sc}~]?\d)/gu, '$1–')
    .replace(/\d+(?:,\d{2,3})+(?:\.\d+)?|\d+\.\d+/g, (n) =>
      n
        .replace(/,/g, '')
        .split('.')
        .map((part, i) =>
          i ? part : part.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
        )
        .join(',')
    )
    .replace(/(\d)([kKmMbB])(?![a-z])/g, (_, d, s) => `${d}\u00a0${SCALE[s]}`);
}
