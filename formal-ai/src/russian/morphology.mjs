/**
 * Russian inflection: noun and adjective declension, verb conjugation.
 *
 * New in this copy of Formal AI. The upstream engine only stores lemma
 * surfaces (`lexeme ru / surface / text`), so it can name a concept in
 * Russian but cannot put it in the case, number or gender a sentence needs.
 *
 * The rules cover the regular paradigms. Anything irregular is supplied by
 * the lexicon (`forms`, `present`, `past`, `plural` fields) rather than
 * hard-coded here, so fixing a word is a data change.
 *
 * Cases: nom gen dat acc ins prep. Numbers: sg pl. Genders: m f n.
 */

export const CASES = ['nom', 'gen', 'dat', 'acc', 'ins', 'prep'];

const HUSHING = 'жшчщ';
const VELAR = 'гкх';
const VOWELS = 'аеёиоуыэюя';

const last = (s) => s[s.length - 1] || '';
const isVowel = (ch) => VOWELS.includes(ch);
const syllables = (s) => [...s].filter(isVowel).length;

/** `ы` becomes `и` after velars and hushing consonants. */
function fixY(stem, ending) {
  if (ending.startsWith('ы') && (VELAR + HUSHING).includes(last(stem))) {
    return `и${ending.slice(1)}`;
  }
  if (ending.startsWith('я') && HUSHING.includes(last(stem))) {
    return `а${ending.slice(1)}`;
  }
  if (ending.startsWith('ю') && HUSHING.includes(last(stem))) {
    return `у${ending.slice(1)}`;
  }
  return ending;
}

/**
 * Insert a fleeting vowel into a zero-ending genitive plural stem
 * (`девушк` → `девушек`, `лодк` → `лодок`, `копейк` → `копеек`).
 */
function fleeting(stem) {
  const n = /([бвгдзклмпрстфхцчшщ])н$/.exec(stem);
  if (n && !isVowel(stem[stem.length - 3] || 'а')) {
    return stem;
  }
  if (n) {
    return `${stem.slice(0, -1)}${VELAR.includes(n[1]) ? 'о' : 'е'}н`;
  }
  const m = /([бвгджзйклмнпрстфхцчшщь])(к)$/.exec(stem);
  if (!m) {
    return stem;
  }
  const before = m[1];
  const base = stem.slice(0, -2);
  if (before === 'й' || before === 'ь') {
    return `${base}ек`;
  }
  if (HUSHING.includes(before)) {
    return `${base}${before}ек`;
  }
  return `${base}${before}ок`;
}

/**
 * Build the 12-cell paradigm of a noun.
 * @param {object} entry - `{lemma, gender, animate, stem, plural, stressEnd,
 *   indeclinable, pluraliaTantum, forms}`; `forms` overrides cells such as
 *   `{'pl.gen': 'людей'}`
 * @returns {Record<string, string>} keys `sg.nom` ... `pl.prep`
 */
export function nounParadigm(entry) {
  const lemma = entry.lemma;
  const g = entry.gender || 'm';
  const out = {};
  const put = (num, endings, stem) => {
    CASES.forEach((c, i) => {
      if (endings[i] !== null) {
        out[`${num}.${c}`] = stem + fixY(stem, endings[i]);
      }
    });
  };
  if (entry.indeclinable || /[A-Za-z]/.test(lemma)) {
    for (const n of ['sg', 'pl']) {
      for (const c of CASES) {
        out[`${n}.${c}`] = lemma;
      }
    }
    return out;
  }
  const end = last(lemma);
  let pluralStem = entry.pluralStem || null;
  if (lemma.endsWith('мя') && g === 'n') {
    const s = lemma.slice(0, -1);
    put('sg', ['я', 'ени', 'ени', 'я', 'енем', 'ени'], s);
    put('pl', ['ена', 'ён', 'енам', 'ена', 'енами', 'енах'], s);
  } else if (end === 'ь' && g === 'f') {
    const s = lemma.slice(0, -1);
    put('sg', ['ь', 'и', 'и', 'ь', 'ью', 'и'], s);
    put('pl', ['и', 'ей', 'ям', null, 'ями', 'ях'], s);
  } else if (end === 'а' || end === 'я') {
    const s = lemma.slice(0, -1);
    const soft = end === 'я';
    const ia = soft && last(s) === 'и';
    const sh = HUSHING.includes(last(s)) || last(s) === 'ц';
    const insEnd = soft ? 'ей' : sh && !entry.stressEnd ? 'ей' : 'ой';
    put(
      'sg',
      [
        end,
        soft ? 'и' : 'ы',
        ia ? 'и' : 'е',
        soft ? 'ю' : 'у',
        insEnd,
        ia ? 'и' : 'е',
      ],
      s
    );
    let genPl;
    if (soft) {
      genPl = isVowel(last(s)) ? `${s}й` : `${s}ь`;
    } else {
      genPl = fleeting(s);
    }
    put(
      'pl',
      [
        soft ? 'и' : 'ы',
        null,
        soft ? 'ям' : 'ам',
        null,
        soft ? 'ями' : 'ами',
        soft ? 'ях' : 'ах',
      ],
      s
    );
    out['pl.gen'] = genPl;
  } else if (end === 'о' || end === 'е' || end === 'ё') {
    const s = lemma.slice(0, -1);
    const sh = HUSHING.includes(last(s)) || last(s) === 'ц';
    const soft = end !== 'о' && !sh;
    const ie = soft && last(s) === 'и';
    if (soft) {
      put(
        'sg',
        [end, 'я', 'ю', end, end === 'ё' ? 'ём' : 'ем', ie ? 'и' : 'е'],
        s
      );
      put('pl', ['я', null, 'ям', null, 'ями', 'ях'], s);
      out['pl.gen'] = ie ? `${s}й` : `${s}ей`;
    } else {
      put('sg', [end, 'а', 'у', end, end === 'о' ? 'ом' : 'ем', 'е'], s);
      put('pl', ['а', null, 'ам', null, 'ами', 'ах'], s);
      out['pl.gen'] = last(s) === 'ц' ? s : fleeting(s);
    }
  } else {
    // masculine: consonant, -ь, -й
    let s = entry.stem || lemma;
    let type = 'hard';
    if (end === 'ь') {
      s = entry.stem || lemma.slice(0, -1);
      type = 'soft';
    } else if (end === 'й') {
      s = entry.stem || lemma.slice(0, -1);
      type = 'j';
    }
    const ends = last(s);
    const sh = HUSHING.includes(ends);
    const stressed = entry.stressEnd ?? (sh && syllables(lemma) === 1);
    if (type === 'hard') {
      const ins = (sh || ends === 'ц') && !stressed ? 'ем' : 'ом';
      put('sg', ['', 'а', 'у', null, ins, 'е'], s);
      out['sg.nom'] = lemma;
      const genPl = sh ? 'ей' : ends === 'ц' && !stressed ? 'ев' : 'ов';
      put('pl', ['ы', genPl, 'ам', null, 'ами', 'ах'], s);
    } else if (type === 'soft') {
      put('sg', ['ь', 'я', 'ю', null, stressed ? 'ём' : 'ем', 'е'], s);
      out['sg.nom'] = lemma;
      put('pl', ['и', 'ей', 'ям', null, 'ями', 'ях'], s);
    } else {
      const ii = last(s) === 'и';
      put('sg', ['й', 'я', 'ю', null, 'ем', ii ? 'и' : 'е'], s);
      put('pl', ['и', 'ев', 'ям', null, 'ями', 'ях'], s);
    }
    if (entry.plural === 'a') {
      const soft = type !== 'hard';
      out['pl.nom'] = s + (soft ? 'я' : 'а');
    }
  }
  if (entry.plural === 'ja') {
    pluralStem = pluralStem || (entry.stem || lemma).replace(/[ьй]$/, '');
  }
  if (pluralStem) {
    const p = entry.plural === 'ja' ? `${pluralStem}ь` : pluralStem;
    out['pl.nom'] = `${p}я`;
    out['pl.gen'] = entry.plural === 'ja' ? `${p}ев` : `${p}ей`;
    out['pl.dat'] = `${p}ям`;
    out['pl.ins'] = `${p}ями`;
    out['pl.prep'] = `${p}ях`;
  }
  return applyOverrides(out, entry);
}

/** Fill accusative by animacy, then apply explicit overrides. */
function applyOverrides(out, entry) {
  const g = entry.gender || 'm';
  const animate = Boolean(entry.animate);
  if (!out['sg.acc']) {
    out['sg.acc'] = animate && g === 'm' ? out['sg.gen'] : out['sg.nom'];
  }
  if (!out['pl.acc'] || entry.forms?.['pl.nom'] || entry.forms?.['pl.gen']) {
    const nom = entry.forms?.['pl.nom'] || out['pl.nom'];
    const gen = entry.forms?.['pl.gen'] || out['pl.gen'];
    out['pl.acc'] = animate ? gen : nom;
  }
  for (const [key, value] of Object.entries(entry.forms || {})) {
    out[key] = value;
  }
  if (entry.forms && !entry.forms['sg.acc'] && animate && g === 'm') {
    out['sg.acc'] = out['sg.gen'];
  }
  return out;
}

/**
 * Decline a noun.
 * @param {object} entry
 * @param {string} kase - nom gen dat acc ins prep
 * @param {string} number - sg | pl
 * @returns {string}
 */
export function declineNoun(entry, kase = 'nom', number = 'sg') {
  if (entry.compound) {
    // «домашняя страница»: adjectives agree with the head, a genitive tail
    // («страница товара») stays as it is
    const { adjectives, head, tail } = entry.compound;
    const f = {
      gender: entry.gender,
      number: entry.pluraliaTantum ? 'pl' : number,
      case: kase,
      animate: entry.animate,
    };
    return [
      ...adjectives.map((a) => declineAdjective(a, f)),
      declineNoun({ ...entry, compound: undefined, lemma: head }, kase, number),
      tail,
    ]
      .filter(Boolean)
      .join(' ');
  }
  if (entry.pluraliaTantum) {
    number = 'pl';
    // the lemma of a plurale tantum is already its nominative plural
    if (
      (kase === 'nom' || (kase === 'acc' && !entry.animate)) &&
      !entry.forms?.[`pl.${kase}`]
    ) {
      return entry.lemma;
    }
  }
  return nounParadigm(entry)[`${number}.${kase}`] || entry.lemma;
}

const ADJ_HARD = {
  m: ['ый', 'ого', 'ому', null, 'ым', 'ом'],
  f: ['ая', 'ой', 'ой', 'ую', 'ой', 'ой'],
  n: ['ое', 'ого', 'ому', 'ое', 'ым', 'ом'],
  pl: ['ые', 'ых', 'ым', null, 'ыми', 'ых'],
};
const ADJ_SOFT = {
  m: ['ий', 'его', 'ему', null, 'им', 'ем'],
  f: ['яя', 'ей', 'ей', 'юю', 'ей', 'ей'],
  n: ['ее', 'его', 'ему', 'ее', 'им', 'ем'],
  pl: ['ие', 'их', 'им', null, 'ими', 'их'],
};

/**
 * Decline an adjective (or participle) in long form.
 * @param {string} lemma - masculine nominative singular (`красивый`)
 * @param {{gender?: string, number?: string, case?: string, animate?: boolean}} f
 * @returns {string}
 */
export function declineAdjective(lemma, f = {}) {
  // Fixed prepositional modifiers keep their own case; participial heads agree.
  if (lemma.includes(' ')) {
    if (/^(?:без|только для|с|со) /.test(lemma)) {
      return lemma;
    }
    let agreed = false;
    return lemma
      .split(' ')
      .map((word) => {
        if (!agreed && /(?:ый|ий|ой)(?:ся)?$/.test(word)) {
          agreed = true;
          return declineAdjective(word, f);
        }
        return word;
      })
      .join(' ');
  }
  if (!/(?:ый|ий|ой)(?:ся)?$/.test(lemma)) {
    return lemma;
  }
  const kase = f.case || 'nom';
  const slot = f.number === 'pl' ? 'pl' : f.gender || 'm';
  let reflexive = '';
  let base = lemma;
  if (base.endsWith('ся')) {
    reflexive = 'ся';
    base = base.slice(0, -2);
  }
  const stem = base.slice(0, -2);
  const tail = base.slice(-2);
  const stressed = tail === 'ой';
  const ch = last(stem);
  let endings;
  if (tail === 'ий' && !(VELAR + HUSHING).includes(ch)) {
    endings = ADJ_SOFT[slot];
  } else {
    endings = [...ADJ_HARD[slot]];
    if (HUSHING.includes(ch) && !stressed) {
      endings = endings.map((e) =>
        e === null
          ? null
          : e.replace(/^о(?=[^й]|й$)/, 'е').replace(/^ое$/, 'ее')
      );
      if (slot === 'f') {
        endings = ['ая', 'ей', 'ей', 'ую', 'ей', 'ей'];
      }
    }
    if (slot === 'm' && kase === 'nom') {
      return stem + tail + reflexive;
    }
  }
  let ending = endings[CASES.indexOf(kase)];
  if (ending === null) {
    const animate = Boolean(f.animate);
    ending = animate ? endings[1] : endings[0];
    if (slot === 'm' && !animate) {
      return base + reflexive;
    }
  }
  return stem + fixY(stem, ending) + reflexive;
}

/**
 * Short form of an adjective (`готовый` → `готов`, `готова`, `готово`,
 * `готовы`) for predicates such as "is ready".
 */
export function shortAdjective(lemma, f = {}) {
  const stem = lemma.slice(0, -2);
  if (f.number === 'pl') {
    return stem + fixY(stem, 'ы');
  }
  if (f.gender === 'f') {
    return `${stem}а`;
  }
  if (f.gender === 'n') {
    return `${stem}о`;
  }
  return stem;
}

// ---------------------------------------------------------------- verbs ---

const addReflexive = (form) =>
  isVowel(last(form)) ? `${form}сь` : `${form}ся`;

/** 1st-person-singular consonant alternation for -ить verbs. */
function alternate(stem) {
  if (/ст$/.test(stem)) {
    return `${stem.slice(0, -2)}щ`;
  }
  const map = { д: 'ж', т: 'ч', з: 'ж', с: 'ш' };
  const ch = last(stem);
  if (map[ch]) {
    return stem.slice(0, -1) + map[ch];
  }
  if ('бпвфм'.includes(ch)) {
    return `${stem}л`;
  }
  return stem;
}

/**
 * Derive the [1sg, 2sg] present (or perfective future) forms of a
 * non-reflexive infinitive by the regular classes.
 * @param {string} inf
 * @returns {[string, string]}
 */
export function regularPresent(inf) {
  let m;
  if ((m = /^(.*)(ов|ев)ать$/.exec(inf))) {
    const s = `${m[1]}${m[2] === 'ев' && !HUSHING.includes(last(m[1])) && last(m[1]) !== 'ц' ? 'ю' : 'у'}`;
    return [`${s}ю`, `${s}ешь`];
  }
  if ((m = /^(.*)авать$/.exec(inf)) && !/(ыв|ив)ать$/.test(inf)) {
    return [`${m[1]}аю`, `${m[1]}аёшь`];
  }
  if ((m = /^(.*[аяе])ть$/.exec(inf))) {
    return [`${m[1]}ю`, `${m[1]}ешь`];
  }
  if ((m = /^(.*)ить$/.exec(inf))) {
    const s = m[1];
    const a = alternate(s);
    const first = a + (HUSHING.includes(last(a)) ? 'у' : 'ю');
    return [first, `${s}ишь`];
  }
  if ((m = /^(.*)нуть$/.exec(inf))) {
    return [`${m[1]}ну`, `${m[1]}нешь`];
  }
  if ((m = /^(.*)уть$/.exec(inf))) {
    return [`${m[1]}ую`, `${m[1]}уешь`];
  }
  if ((m = /^(.*)ыть$/.exec(inf))) {
    return [`${m[1]}ою`, `${m[1]}оешь`];
  }
  return [inf, inf];
}

/**
 * Six present-tense (or perfective future) forms from 1sg and 2sg.
 * @param {string} first - 1sg
 * @param {string} second - 2sg
 * @returns {string[]} [1sg, 2sg, 3sg, 1pl, 2pl, 3pl]
 */
export function presentFromKeys(first, second) {
  const m = /^(.*)(ешь|ёшь|ишь)$/.exec(second);
  if (!m) {
    return [first, second, second, second, second, second];
  }
  const s2 = m[1];
  const v = m[2][0];
  const one = first.replace(/[ую]$/, '');
  let third;
  if (v === 'и') {
    third = s2 + (HUSHING.includes(last(s2)) ? 'ат' : 'ят');
  } else {
    third = one + (/ю$/.test(first) ? 'ют' : 'ут');
  }
  return [first, second, `${s2}${v}т`, `${s2}${v}м`, `${s2}${v}те`, third];
}

const PERSON_INDEX = {
  '1sg': 0,
  '2sg': 1,
  '3sg': 2,
  '1pl': 3,
  '2pl': 4,
  '3pl': 5,
};

/**
 * Parse a verb lexicon entry into a ready conjugator.
 * @param {object} entry - `{lemma, aspect, present: [1sg, 2sg] | six forms,
 *   past: [masc, fem], imperative}`
 */
export function verbForms(entry) {
  let inf = entry.lemma;
  const reflexive = /(ся|сь)$/.test(inf);
  if (reflexive) {
    inf = inf.slice(0, -2);
  }
  const bare = (form) =>
    reflexive && form ? form.replace(/(ся|сь)$/, '') : form;
  entry = {
    ...entry,
    present: entry.present?.map(bare),
    past: entry.past?.map(bare),
    imperative: bare(entry.imperative),
  };
  let present;
  if (entry.present && entry.present.length === 6) {
    present = [...entry.present];
  } else {
    const keys =
      entry.present?.length === 2 ? entry.present : regularPresent(inf);
    present = presentFromKeys(keys[0], keys[1]);
  }
  let past;
  if (entry.past && entry.past.length >= 2) {
    const [masc, fem] = entry.past;
    const st = fem.slice(0, -1);
    past = { m: masc, f: fem, n: `${st}о`, pl: `${st}и` };
  } else {
    const st = inf.replace(/ть$/, '');
    past = { m: `${st}л`, f: `${st}ла`, n: `${st}ло`, pl: `${st}ли` };
  }
  let imperative;
  if (entry.imperative) {
    imperative = { sg: entry.imperative, pl: `${entry.imperative}те` };
  } else {
    const p3 = present[5];
    const stem = p3.replace(/(ут|ют|ат|ят)$/, '');
    const sg = isVowel(last(stem)) ? `${stem}й` : `${stem}и`;
    imperative = { sg, pl: `${sg}те` };
  }
  const r = (form) => (reflexive ? addReflexive(form) : form);
  return {
    infinitive: entry.lemma,
    aspect: entry.aspect || 'impf',
    present: present.map(r),
    past: Object.fromEntries(Object.entries(past).map(([k, v]) => [k, r(v)])),
    imperative: { sg: r(imperative.sg), pl: r(imperative.pl) },
  };
}

const BUDU = ['буду', 'будешь', 'будет', 'будем', 'будете', 'будут'];

/**
 * Conjugate a verb.
 * @param {object} entry - verb lexicon entry
 * @param {{tense: string, person?: number, number?: string, gender?: string,
 *   mood?: string}} f - tense: present | past | future
 * @returns {string}
 */
export function conjugate(entry, f) {
  const forms = verbForms(entry);
  const key = `${f.person || 3}${f.number === 'pl' ? 'pl' : 'sg'}`;
  const index = PERSON_INDEX[key];
  if (f.mood === 'imperative') {
    return f.number === 'pl' || f.polite
      ? forms.imperative.pl
      : forms.imperative.sg;
  }
  if (f.mood === 'infinitive') {
    return forms.infinitive;
  }
  if (f.tense === 'past') {
    if (f.number === 'pl') {
      return forms.past.pl;
    }
    return forms.past[f.gender || 'm'];
  }
  if (f.tense === 'future') {
    if (forms.aspect === 'perf') {
      return forms.present[index];
    }
    return `${BUDU[index]} ${forms.infinitive}`;
  }
  return forms.present[index];
}

/**
 * Case and number a noun takes after a cardinal number in nominative or
 * accusative position.
 * @param {number} n
 * @returns {{case: string, number: string}}
 */
export function numeralGovernment(n) {
  const abs = Math.abs(Math.trunc(n));
  if (!Number.isInteger(n)) {
    return { case: 'gen', number: 'sg' };
  }
  const d = abs % 10;
  const dd = abs % 100;
  if (d === 1 && dd !== 11) {
    return { case: 'nom', number: 'sg' };
  }
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) {
    return { case: 'gen', number: 'sg' };
  }
  return { case: 'gen', number: 'pl' };
}
