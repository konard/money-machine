/**
 * International words: "platform" and платформа share spelling because they
 * share the meaning that crossed languages, usually the modern one. Comparing
 * spellings needs no dictionary and marks that sense of a word.
 */
const LATIN = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'u',
  я: 'a',
};

const english = (word) =>
  word
    .toLowerCase()
    .replace(/ph/g, 'f')
    .replace(/ck|c(?=[aou]|$)|q/g, 'k')
    .replace(/c/g, 's')
    .replace(/x/g, 'ks')
    .replace(/y/g, 'i')
    .replace(/(.)\1/g, '$1');
const russian = (word) =>
  [...word.toLowerCase()]
    .map((letter) => LATIN[letter] ?? letter)
    .join('')
    .replace(/(.)\1/g, '$1');

function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(
        row[j] + 1,
        next[j - 1] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    row = next;
  }
  return row[b.length];
}

/** 0–1: how alike the two words are spelled; 0 below a clear resemblance. */
export function cognateShare(word, translation) {
  if (!word || !translation || word.length < 4 || /\s/.test(translation)) {
    return 0;
  }
  const [a, b] = [english(word), russian(translation)];
  const share = 1 - editDistance(a, b) / Math.max(a.length, b.length);
  return share >= 0.6 ? share : 0;
}
