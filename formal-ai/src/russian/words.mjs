/**
 * Russian closed-class words: pronouns, determiners, numerals, question
 * words, prepositions and conjunctions. Each table is indexed by case in the
 * order of `CASES` (nom gen dat acc ins prep).
 */

const table = (s) => s.split(' ');

/** Personal pronouns. Oblique 3rd-person forms take н- after prepositions. */
export const PERSONAL = {
  '1sg': table('я меня мне меня мной мне'),
  '2sg': table('ты тебя тебе тебя тобой тебе'),
  '2pl': table('вы вас вам вас вами вас'),
  '3sgm': table('он его ему его им нём'),
  '3sgn': table('оно его ему его им нём'),
  '3sgf': table('она её ей её ей ней'),
  '1pl': table('мы нас нам нас нами нас'),
  '3pl': table('они их им их ими них'),
  refl: table('себя себя себе себя собой себе'),
};

/** Add н- to oblique 3rd-person pronouns after a preposition. */
export function afterPreposition(form) {
  return /^(его|ему|им|её|ей|их|ими)$/.test(form)
    ? `н${form.replace(/^е/, 'е')}`
    : form;
}

/** Pronominal declension: m f n pl, each six cases (acc: inanimate). */
const pronominal = (m, f, n, pl) => ({
  m: table(m),
  f: table(f),
  n: table(n),
  pl: table(pl),
});

export const POSSESSIVE = {
  1: {
    sg: pronominal(
      'мой моего моему мой моим моём',
      'моя моей моей мою моей моей',
      'моё моего моему моё моим моём',
      'мои моих моим мои моими моих'
    ),
  },
  2: {
    sg: pronominal(
      'твой твоего твоему твой твоим твоём',
      'твоя твоей твоей твою твоей твоей',
      'твоё твоего твоему твоё твоим твоём',
      'твои твоих твоим твои твоими твоих'
    ),
    pl: pronominal(
      'ваш вашего вашему ваш вашим вашем',
      'ваша вашей вашей вашу вашей вашей',
      'ваше вашего вашему ваше вашим вашем',
      'ваши ваших вашим ваши вашими ваших'
    ),
  },
  refl: pronominal(
    'свой своего своему свой своим своём',
    'своя своей своей свою своей своей',
    'своё своего своему своё своим своём',
    'свои своих своим свои своими своих'
  ),
};
POSSESSIVE[1].pl = pronominal(
  'наш нашего нашему наш нашим нашем',
  'наша нашей нашей нашу нашей нашей',
  'наше нашего нашему наше нашим нашем',
  'наши наших нашим наши нашими наших'
);

/** Invariable 3rd-person possessives. */
export const POSSESSIVE_3 = { m: 'его', n: 'его', f: 'её', pl: 'их' };

export const DEMONSTRATIVE = {
  'det.this': pronominal(
    'этот этого этому этот этим этом',
    'эта этой этой эту этой этой',
    'это этого этому это этим этом',
    'эти этих этим эти этими этих'
  ),
  'det.that': pronominal(
    'тот того тому тот тем том',
    'та той той ту той той',
    'то того тому то тем том',
    'те тех тем те теми тех'
  ),
  all: pronominal(
    'весь всего всему весь всем всём',
    'вся всей всей всю всей всей',
    'всё всего всему всё всем всём',
    'все всех всем все всеми всех'
  ),
  one: pronominal(
    'один одного одному один одним одном',
    'одна одной одной одну одной одной',
    'одно одного одному одно одним одном',
    'одни одних одним одни одними одних'
  ),
  whose: pronominal(
    'чей чьего чьему чей чьим чьём',
    'чья чьей чьей чью чьей чьей',
    'чьё чьего чьему чьё чьим чьём',
    'чьи чьих чьим чьи чьими чьих'
  ),
};

/** Question and indefinite pronouns. */
export const PRONOUN_WORDS = {
  'q.who': table('кто кого кому кого кем ком'),
  'q.what': table('что чего чему что чем чём'),
  'pro.something': table('что-то чего-то чему-то что-то чем-то чём-то'),
  'pro.anything': table(
    'что-нибудь чего-нибудь чему-нибудь что-нибудь чем-нибудь чём-нибудь'
  ),
  'pro.nothing': table('ничего ничего ничему ничего ничем ничём'),
  'pro.everything': table('всё всего всему всё всем всём'),
  'pro.someone': table('кто-то кого-то кому-то кого-то кем-то ком-то'),
  'pro.anyone': table(
    'кто-нибудь кого-нибудь кому-нибудь кого-нибудь кем-нибудь ком-нибудь'
  ),
  'pro.nobody': table('никто никого никому никого никем ком'),
  'pro.everyone': table('все всех всем всех всеми всех'),
  this: table('это этого этому это этим этом'),
};

/** Question adverbs; `to` is the direction form used with motion verbs. */
export const QUESTION_ADVERBS = {
  'q.where': { at: 'где', to: 'куда' },
  'q.when': { at: 'когда' },
  'q.why': { at: 'почему' },
  'q.how': { at: 'как' },
};

/** Cardinals: nominative (m, f) and the remaining cases. */
const CARDINALS = {
  2: { m: 'два', f: 'две', cases: table('два двух двум два двумя двух') },
  3: { cases: table('три трёх трём три тремя трёх') },
  4: { cases: table('четыре четырёх четырём четыре четырьмя четырёх') },
  5: { cases: table('пять пяти пяти пять пятью пяти') },
  6: { cases: table('шесть шести шести шесть шестью шести') },
  7: { cases: table('семь семи семи семь семью семи') },
  8: { cases: table('восемь восьми восьми восемь восемью восьми') },
  9: { cases: table('девять девяти девяти девять девятью девяти') },
  10: { cases: table('десять десяти десяти десять десятью десяти') },
  11: {
    cases: table(
      'одиннадцать одиннадцати одиннадцати одиннадцать одиннадцатью одиннадцати'
    ),
  },
  12: {
    cases: table(
      'двенадцать двенадцати двенадцати двенадцать двенадцатью двенадцати'
    ),
  },
  15: {
    cases: table(
      'пятнадцать пятнадцати пятнадцати пятнадцать пятнадцатью пятнадцати'
    ),
  },
  20: {
    cases: table('двадцать двадцати двадцати двадцать двадцатью двадцати'),
  },
  30: {
    cases: table('тридцать тридцати тридцати тридцать тридцатью тридцати'),
  },
  100: { cases: table('сто ста ста сто ста ста') },
};

const CASE_INDEX = { nom: 0, gen: 1, dat: 2, acc: 3, ins: 4, prep: 5 };

/**
 * A cardinal number in words, or as digits when not tabulated.
 * @param {number} n
 * @param {string} kase
 * @param {string} gender - of the counted noun
 * @param {boolean} digits - the source used digits
 */
export function cardinal(n, kase, gender, digits) {
  if (n === 1) {
    const forms =
      DEMONSTRATIVE.one[gender === 'f' ? 'f' : gender === 'n' ? 'n' : 'm'];
    return digits ? '1' : forms[CASE_INDEX[kase]];
  }
  const entry = CARDINALS[n];
  if (digits || !entry) {
    return String(n);
  }
  if ((kase === 'nom' || kase === 'acc') && n === 2) {
    return gender === 'f' ? entry.f : entry.m;
  }
  return entry.cases[CASE_INDEX[kase]];
}

/**
 * Prepositions for relation concepts. `place` is the location reading,
 * `goal` the direction reading after motion verbs, `person` the reading
 * with an animate object. `on` means "use на for at:на nouns".
 */
export const RELATIONS = {
  'rel.in': { place: ['в', 'prep', 'on'], goal: ['в', 'acc', 'on'] },
  'rel.into': { place: ['в', 'acc', 'on'], goal: ['в', 'acc', 'on'] },
  'rel.on': { place: ['на', 'prep'], goal: ['на', 'acc'] },
  'rel.onto': { place: ['на', 'acc'], goal: ['на', 'acc'] },
  'rel.at': {
    place: ['в', 'prep', 'on'],
    goal: ['в', 'acc', 'on'],
    person: ['у', 'gen'],
  },
  'rel.to': {
    place: ['в', 'acc', 'on'],
    goal: ['в', 'acc', 'on'],
    person: ['к', 'dat'],
  },
  'rel.towards': { place: ['к', 'dat'], goal: ['к', 'dat'] },
  'rel.from': {
    place: ['из', 'gen', 'on:с'],
    goal: ['из', 'gen', 'on:с'],
    person: ['от', 'gen'],
  },
  'rel.out-of': { place: ['из', 'gen'], goal: ['из', 'gen'] },
  'rel.with': { place: ['с', 'ins'] },
  'rel.without': { place: ['без', 'gen'] },
  'rel.for': { place: ['для', 'gen'] },
  'rel.about': { place: ['о', 'prep'] },
  'rel.by': { place: ['у', 'gen'], person: ['', 'ins'] },
  'rel.near': { place: ['рядом с', 'ins'] },
  'rel.next-to': { place: ['рядом с', 'ins'] },
  'rel.under': { place: ['под', 'ins'], goal: ['под', 'acc'] },
  'rel.over': { place: ['над', 'ins'] },
  'rel.behind': { place: ['за', 'ins'], goal: ['за', 'acc'] },
  'rel.in-front-of': { place: ['перед', 'ins'] },
  'rel.between': { place: ['между', 'ins'] },
  'rel.after': { place: ['после', 'gen'] },
  'rel.before': { place: ['до', 'gen'] },
  'rel.during': { place: ['во время', 'gen'] },
  'rel.through': { place: ['через', 'acc'] },
  'rel.across': { place: ['через', 'acc'] },
  'rel.along': { place: ['по', 'dat'] },
  'rel.around': { place: ['вокруг', 'gen'] },
  'rel.against': { place: ['против', 'gen'] },
  'rel.among': { place: ['среди', 'gen'] },
  'rel.since': { place: ['с', 'gen'] },
  'rel.until': { place: ['до', 'gen'] },
  'rel.like': { place: ['как', 'nom'] },
  'rel.of': { place: ['', 'gen'] },
};

/**
 * Euphonic variants: во/со/ко/об/обо.
 * @param {string} prep
 * @param {string} next - the following word
 */
export function euphony(prep, next) {
  const w = next.toLowerCase();
  if (
    prep === 'в' &&
    (/^(вс|вт|вв|мн|фл)/.test(w) || /^в[^аеёиоуыэюя]/.test(w))
  ) {
    return 'во';
  }
  if (prep === 'с' && (/^(мн|вс)/.test(w) || /^[сзшж][^аеёиоуыэюя]/.test(w))) {
    return 'со';
  }
  if (prep === 'к' && /^(мн|вс)/.test(w)) {
    return 'ко';
  }
  if (prep === 'о') {
    if (/^(мне|всём|всей|всех)$/.test(w)) {
      return 'обо';
    }
    if (/^[аиоуэ]/.test(w)) {
      return 'об';
    }
  }
  return prep;
}

/** Conjunctions linking clauses. `comma` places a comma before them. */
export const CONJUNCTIONS = {
  'conj.and': { text: 'и', comma: true },
  'conj.but': { text: 'но', comma: true },
  'conj.or': { text: 'или', comma: false },
  'conj.because': { text: 'потому что', comma: true },
  'conj.if': { text: 'если', comma: true },
  'conj.when': { text: 'когда', comma: true },
  'conj.while': { text: 'пока', comma: true },
  'conj.although': { text: 'хотя', comma: true },
  'conj.before': { text: 'прежде чем', comma: true },
  'conj.after': { text: 'после того как', comma: true },
  'conj.until': { text: 'пока не', comma: true },
  'conj.since': { text: 'с тех пор как', comma: true },
  'conj.so': { text: 'поэтому', comma: true },
  'conj.that': { text: 'что', comma: true },
  'conj.where': { text: 'где', comma: true },
};

/** Quantifying determiners that take a genitive noun. */
export const QUANTIFIERS = {
  'det.many': { pl: 'много', sg: 'много' },
  'det.much': { sg: 'много', pl: 'много' },
  'det.few': { pl: 'мало', sg: 'мало' },
  'det.several': { pl: 'несколько', sg: 'несколько' },
  'det.some': { pl: 'несколько', sg: 'немного' },
};

/** Latin → Cyrillic transliteration for unknown proper names. */
export function transliterate(name) {
  const pairs = [
    ['sch', 'ш'],
    ['sh', 'ш'],
    ['ch', 'ч'],
    ['th', 'т'],
    ['ph', 'ф'],
    ['kh', 'х'],
    ['zh', 'ж'],
    ['ts', 'ц'],
    ['oo', 'у'],
    ['ee', 'и'],
    ['ya', 'я'],
    ['yu', 'ю'],
    ['a', 'а'],
    ['b', 'б'],
    ['c', 'к'],
    ['d', 'д'],
    ['e', 'е'],
    ['f', 'ф'],
    ['g', 'г'],
    ['h', 'х'],
    ['i', 'и'],
    ['j', 'дж'],
    ['k', 'к'],
    ['l', 'л'],
    ['m', 'м'],
    ['n', 'н'],
    ['o', 'о'],
    ['p', 'п'],
    ['q', 'к'],
    ['r', 'р'],
    ['s', 'с'],
    ['t', 'т'],
    ['u', 'у'],
    ['v', 'в'],
    ['w', 'у'],
    ['x', 'кс'],
    ['y', 'и'],
    ['z', 'з'],
  ];
  let out = '';
  let rest = name.toLowerCase();
  while (rest) {
    const pair = pairs.find(([lat]) => rest.startsWith(lat));
    if (pair) {
      out += pair[1];
      rest = rest.slice(pair[0].length);
    } else {
      out += rest[0];
      rest = rest.slice(1);
    }
  }
  return out ? out[0].toUpperCase() + out.slice(1) : name;
}
