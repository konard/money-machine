/** Lexicon `ru` entries from rendered Russian Wiktionary words. */

import { languageSection, unstress } from './sources/wiktionary.mjs';

/** Dictionary usage marks, restricted to the Russian language section. */
export function russianParenthetic(page = '') {
  const text = page.includes('==Russian==')
    ? languageSection(page, 'Russian')
    : /=\s*\{\{-ru-\}\}\s*=/.test(page)
      ? page
      : '';
  return /\{\{(?:gloss|gl|lb|label|qualifier|q)\|[^{}]*\bparenthe(?:tic|tical)\b[^{}]*\}\}|вводное\s+слово|(?<![а-яё])вводн\./i.test(
    text
  );
}

const tag = (forms, ...keys) => keys.map((k) => forms.get(k)).find(Boolean);
/** Lexicon `ru` entry from a rendered Russian word. */
export function russianEntry(pos, word, rendered, head, page = '') {
  const { forms } = rendered;
  const comparative = tag(forms, 'comd', 'comparative')?.split(',')[0].trim();
  if (pos === 'noun') {
    const cells = {};
    for (const [tags, form] of forms) {
      const m = /^(nom|gen|dat|acc|ins|pre|loc|par|voc)\|([sp])$/.exec(tags);
      if (m && ['nom', 'gen', 'dat', 'acc', 'ins', 'pre'].includes(m[1])) {
        cells[
          `${m[2] === 's' ? 'sg' : 'pl'}.${m[1] === 'pre' ? 'prep' : m[1]}`
        ] = form.split(',')[0].trim();
      }
    }
    if (
      !rendered.indeclinable &&
      !Object.keys(cells).length &&
      /[иуюо]$/.test(word)
    ) {
      return regularEntry('noun', { word, gender: rendered.gender });
    }
    const pluralOnly =
      rendered.pluralOnly || (!cells['sg.nom'] && cells['pl.nom']);
    return {
      pos: 'noun',
      lemma: pluralOnly ? cells['pl.nom'] || word : word,
      gender: rendered.gender || formGender(word, cells),
      animate: Boolean(rendered.animate),
      pluraliaTantum: Boolean(pluralOnly),
      at: 'в',
      forms: Object.keys(cells).length ? cells : undefined,
      indeclinable: rendered.indeclinable || undefined,
    };
  }
  if (pos === 'verb') {
    const perf = head?.positional?.[1] === 'pf';
    const kind = perf ? 'fut' : 'pres';
    const present = ['1|s', '2|s', '3|s', '1|p', '2|p', '3|p'].map((p) =>
      tag(forms, `${p}|${kind}|ind`)
    );
    return {
      pos: 'verb',
      lemma: word,
      aspect: perf ? 'perf' : 'impf',
      present: present.every(Boolean)
        ? present.map((f) => f.split(',')[0].trim())
        : undefined,
      past: [tag(forms, 'm|s|past|ind'), tag(forms, 'f|s|past|ind')].every(
        Boolean
      )
        ? [tag(forms, 'm|s|past|ind'), tag(forms, 'f|s|past|ind')]
        : undefined,
      imperative: tag(forms, '2|s|imp'),
      converb: tag(forms, 'pres|adv|part')?.split(',')[0].trim(),
      pastPassive:
        unstress(tag(forms, 'past|pass|part')?.split(',')[0] || '').trim() ||
        undefined,
      partner:
        unstress(
          (head?.named?.[perf ? 'impf' : 'pf'] || '').split(',')[0]
        ).trim() || undefined,
    };
  }
  if (pos === 'adj') {
    return {
      pos: 'adj',
      lemma: word,
      comparative,
      short: tag(forms, 'short|m|s')?.split(',')[0],
      shortForms: Object.fromEntries(
        [
          ['m', 'short|m|s'],
          ['f', 'short|f|s'],
          ['n', 'short|n|s'],
          ['p', 'short|p'],
        ]
          .map(([k, t]) => [k, tag(forms, t)?.split(',')[0].trim()])
          .filter(([, v]) => v)
      ),
    };
  }
  return {
    pos: 'adv',
    lemma: word,
    comparative,
    parenthetic: russianParenthetic(page) || undefined,
  };
}
/** Lexicon `ru` entry for a word without a Wiktionary page, by its ending. */
const ADJECTIVE_FORM = /^[а-яё-]+(?:ый|ий|ой|ая|яя|ое|ее|ые|ие)$/i;
/** Masculine nominative of an agreeing adjective form (`домашняя`). */
function masculine(form) {
  const m = /^(.*?)(ая|яя|ое|ее|ые|ие)$/.exec(form);
  if (!m) {
    return form;
  }
  const soft = /^(яя|ее|ие)$/.test(m[2]) || /[кгхжшщч]$/.test(m[1]);
  return m[1] + (soft ? 'ий' : 'ый');
}
/**
 * A Russian noun phrase translation (`домашняя страница`, `страница
 * товара`): leading adjectives agree with the head noun; the rest is fixed.
 * @param {string} phrase
 * @param {(word: string) => object|null} nounEntry
 */
export function compoundNoun(phrase, nounEntry) {
  const parts = phrase.split(' ');
  if (parts.length > 4 || parts.some((w) => !/^[а-яё-]+$/i.test(w))) {
    return null;
  }
  let i = 0;
  while (i < parts.length - 1 && ADJECTIVE_FORM.test(parts[i])) {
    i += 1;
  }
  const head = nounEntry(parts[i]);
  if (!head || head.pos !== 'noun' || head.compound) {
    return null;
  }
  return {
    ...head,
    lemma: phrase,
    compound: {
      adjectives: parts.slice(0, i).map(masculine),
      head: head.lemma,
      tail: parts.slice(i + 1).join(' '),
    },
  };
}

export function regularEntry(
  pos,
  { word, gender, aspect, plural, indeclinable }
) {
  // a fixed multiword adverb ("в основном") does not inflect
  if (pos === 'adv' && /^[а-яё-]+(?: [а-яё-]+){1,2}$/i.test(word)) {
    return { pos: 'adv', lemma: word, regular: true };
  }
  if (word.includes(' ') || !/^[а-яё-]+$/i.test(word)) {
    return null;
  }
  if (pos === 'verb' && /(ть|ться|ти|чь)$/.test(word)) {
    // -ировать verbs are usually both aspects
    const both = /ировать(ся)?$/.test(word);
    return {
      pos: 'verb',
      lemma: word,
      aspect: aspect === 'pf' && !both ? 'perf' : 'impf',
      regular: true,
    };
  }
  if (pos === 'adj' && /(ый|ий|ой)$/.test(word)) {
    return { pos: 'adj', lemma: word, regular: true };
  }
  if (pos === 'adv' && /[оеи]$/.test(word)) {
    return { pos: 'adv', lemma: word, regular: true };
  }
  if (pos === 'noun') {
    if (indeclinable) {
      return { pos, lemma: word, gender: gender || 'n', indeclinable: true };
    }
    // These endings may belong to foreign stems; only public inflection
    // data can decide whether they decline. Do not invent a paradigm.
    // (native neuter suffixes such as -ство, -ание, -ло still decline)
    if (/[иуюо]$/.test(word) && !/.{3}(?:ств|тв|л|к|н|ч|щ)о$/.test(word)) {
      return null;
    }
    const g =
      { m: 'm', f: 'f', n: 'n' }[gender] ||
      (/[ая]$|ь$/.test(word)
        ? /ь$/.test(word)
          ? null
          : 'f'
        : /[ое]$/.test(word)
          ? 'n'
          : /[бвгджзклмнпрстфхцчшщй]$/.test(word)
            ? 'm'
            : null);
    if (!g) {
      return null;
    }
    return {
      pos: 'noun',
      lemma: word,
      gender: g,
      animate: false,
      pluraliaTantum: Boolean(plural),
      at: 'в',
      regular: true,
    };
  }
  return null;
}

/**
 * A declension table without a gender tag (Великобритания): the forms show
 * it. -а/-я is feminine, -о/-е neuter, a consonant masculine; -ь is
 * feminine when its instrumental is -ью (тетрадью), else masculine.
 */
function formGender(word, cells) {
  const nom = cells['sg.nom'] || word;
  if (/ь$/.test(nom)) {
    return /ью$/.test(cells['sg.ins'] || '') ? 'f' : 'm';
  }
  return /[ая]$/.test(nom) ? 'f' : /[оеё]$/.test(nom) ? 'n' : 'm';
}
