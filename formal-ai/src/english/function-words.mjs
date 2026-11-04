/**
 * Closed-class English words. Content words (nouns, verbs, adjectives,
 * adverbs) live in `data/*.lino`; these classes drive the parser itself.
 */

/** Personal pronouns: concept, person, number, case, gender. */
export const PRONOUNS = {
  i: { person: 1, number: 'sg', case: 'nom' },
  me: { person: 1, number: 'sg', case: 'obj' },
  you: { person: 2, number: 'sg|pl', case: 'any' },
  he: { person: 3, number: 'sg', gender: 'm', case: 'nom' },
  him: { person: 3, number: 'sg', gender: 'm', case: 'obj' },
  she: { person: 3, number: 'sg', gender: 'f', case: 'nom' },
  her: { person: 3, number: 'sg', gender: 'f', case: 'obj' },
  it: { person: 3, number: 'sg', gender: 'n', case: 'any' },
  we: { person: 1, number: 'pl', case: 'nom' },
  us: { person: 1, number: 'pl', case: 'obj' },
  they: { person: 3, number: 'pl', case: 'nom' },
  them: { person: 3, number: 'pl', case: 'obj' },
  myself: { person: 1, number: 'sg', case: 'refl' },
  yourself: { person: 2, number: 'sg', case: 'refl' },
  himself: { person: 3, number: 'sg', gender: 'm', case: 'refl' },
  herself: { person: 3, number: 'sg', gender: 'f', case: 'refl' },
  itself: { person: 3, number: 'sg', gender: 'n', case: 'refl' },
  ourselves: { person: 1, number: 'pl', case: 'refl' },
  themselves: { person: 3, number: 'pl', case: 'refl' },
};

/** Indefinite pronouns that head a noun phrase on their own. */
export const INDEFINITES = {
  others: 'pro.others',
  something: 'pro.something',
  anything: 'pro.anything',
  nothing: 'pro.nothing',
  everything: 'pro.everything',
  someone: 'pro.someone',
  somebody: 'pro.someone',
  anyone: 'pro.anyone',
  anybody: 'pro.anyone',
  nobody: 'pro.nobody',
  'no+one': 'pro.nobody',
  everyone: 'pro.everyone',
  everybody: 'pro.everyone',
};

/** Quantifiers that also stand alone as a pronoun: "both agree". */
export const STANDALONE_DETERMINERS = {
  'det.all': 'pro.everyone',
  'det.many': 'pro.many',
  'det.most': 'pro.most',
  'det.few': 'pro.few',
  'det.several': 'pro.several',
  'det.some': 'pro.some',
  'det.both': 'pro.both',
  'det.each': 'pro.each',
};

/** Possessive determiners, keyed to the owner pronoun. */
export const POSSESSIVES = {
  my: { person: 1, number: 'sg' },
  your: { person: 2, number: 'sg|pl' },
  his: { person: 3, number: 'sg', gender: 'm' },
  her: { person: 3, number: 'sg', gender: 'f' },
  its: { person: 3, number: 'sg', gender: 'n' },
  our: { person: 1, number: 'pl' },
  their: { person: 3, number: 'pl' },
};

/** Determiners and quantifiers. `number` restricts the head noun. */
export const DETERMINERS = {
  the: { def: 'def' },
  a: { def: 'indef', number: 'sg' },
  an: { def: 'indef', number: 'sg' },
  this: { def: 'def', det: 'det.this', number: 'sg' },
  that: { def: 'def', det: 'det.that', number: 'sg' },
  these: { def: 'def', det: 'det.this', number: 'pl' },
  those: { def: 'def', det: 'det.that', number: 'pl' },
  some: { def: 'indef', det: 'det.some' },
  any: { def: 'indef', det: 'det.any' },
  no: { def: 'indef', det: 'det.no' },
  // "neither homepage": not one of the two
  neither: { def: 'def', det: 'det.neither', number: 'sg' },
  every: { def: 'def', det: 'det.every', number: 'sg' },
  each: { def: 'def', det: 'det.each', number: 'sg' },
  all: { def: 'def', det: 'det.all', number: 'pl' },
  many: { def: 'indef', det: 'det.many', number: 'pl' },
  most: { def: 'indef', det: 'det.most', number: 'pl' },
  much: { def: 'indef', det: 'det.much', number: 'sg' },
  few: { def: 'indef', det: 'det.few', number: 'pl' },
  several: { def: 'indef', det: 'det.several', number: 'pl' },
  another: { def: 'indef', det: 'det.another', number: 'sg' },
  other: { def: 'indef', det: 'det.other' },
  both: { def: 'def', det: 'det.both', number: 'pl' },
};

/** Cardinal numbers in words. */
export const NUMBERS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
};

/** Prepositions with their relation concept. */
export const PREPOSITIONS = {
  in: 'rel.in',
  into: 'rel.into',
  inside: 'rel.in',
  on: 'rel.on',
  onto: 'rel.onto',
  at: 'rel.at',
  to: 'rel.to',
  from: 'rel.from',
  with: 'rel.with',
  without: 'rel.without',
  for: 'rel.for',
  about: 'rel.about',
  of: 'rel.of',
  by: 'rel.by',
  near: 'rel.near',
  under: 'rel.under',
  over: 'rel.over',
  above: 'rel.over',
  behind: 'rel.behind',
  between: 'rel.between',
  after: 'rel.after',
  before: 'rel.before',
  during: 'rel.during',
  through: 'rel.through',
  across: 'rel.across',
  along: 'rel.along',
  around: 'rel.around',
  against: 'rel.against',
  among: 'rel.among',
  since: 'rel.since',
  until: 'rel.until',
  till: 'rel.until',
  like: 'rel.like',
  towards: 'rel.towards',
  toward: 'rel.towards',
  out_of: 'rel.out-of',
  in_front_of: 'rel.in-front-of',
  next_to: 'rel.next-to',
  per: 'rel.per',
  via: 'rel.through',
  within: 'rel.within',
  including: 'rel.including',
  plus: 'rel.plus',
  versus: 'rel.versus',
  vs: 'rel.versus',
  despite: 'rel.despite',
  beyond: 'rel.beyond',
  except: 'rel.except',
  up_to: 'rel.until',
  due_to: 'rel.because-of',
  because_of: 'rel.because-of',
  according_to: 'rel.according-to',
  instead_of: 'rel.instead-of',
  rather_than: 'rel.instead-of',
};

/** Multi-word prepositions, longest first. */
export const COMPLEX_PREPOSITIONS = [
  ['in', 'front', 'of'],
  ['according', 'to'],
  ['because', 'of'],
  ['instead', 'of'],
  ['rather', 'than'],
  ['next', 'to'],
  ['out', 'of'],
  ['up', 'to'],
  ['due', 'to'],
];

/** Clause-linking conjunctions. */
export const SUBORDINATORS = {
  because: 'conj.because',
  if: 'conj.if',
  whether: 'conj.whether',
  when: 'conj.when',
  while: 'conj.while',
  although: 'conj.although',
  though: 'conj.although',
  before: 'conj.before',
  after: 'conj.after',
  until: 'conj.until',
  since: 'conj.since',
  so: 'conj.so',
  that: 'conj.that',
  where: 'conj.where',
  as: 'conj.as',
};

export const COORDINATORS = {
  and: 'conj.and',
  but: 'conj.but',
  or: 'conj.or',
  nor: 'conj.nor',
};

/** Question words and the role they question. */
export const WH_WORDS = {
  what: { concept: 'q.what', role: 'thing' },
  who: { concept: 'q.who', role: 'person' },
  whom: { concept: 'q.who', role: 'person' },
  where: { concept: 'q.where', role: 'place' },
  when: { concept: 'q.when', role: 'time' },
  why: { concept: 'q.why', role: 'reason' },
  how: { concept: 'q.how', role: 'manner' },
  which: { concept: 'q.which', role: 'determiner' },
  whose: { concept: 'q.whose', role: 'determiner' },
};

/** Forms of be, have and do with tense, person and number. */
export const BE = {
  be: { form: 'inf' },
  am: { tense: 'present', person: 1, number: 'sg' },
  is: { tense: 'present', person: 3, number: 'sg' },
  are: { tense: 'present', number: 'pl' },
  was: { tense: 'past', number: 'sg' },
  were: { tense: 'past', number: 'pl' },
  been: { form: 'pp' },
  being: { form: 'ing' },
  "'m": { tense: 'present', person: 1, number: 'sg' },
  "'re": { tense: 'present', number: 'pl' },
};

export const HAVE = {
  have: { tense: 'present' },
  has: { tense: 'present', person: 3, number: 'sg' },
  had: { tense: 'past' },
  having: { form: 'ing' },
  "'ve": { tense: 'present' },
};

export const DO = {
  do: { tense: 'present' },
  does: { tense: 'present', person: 3, number: 'sg' },
  did: { tense: 'past' },
};

/** Modal verbs and the modality concept they carry. */
export const MODALS = {
  can: { modal: 'modal.can', tense: 'present' },
  could: { modal: 'modal.can', tense: 'past' },
  must: { modal: 'modal.must', tense: 'present' },
  should: { modal: 'modal.should', tense: 'present' },
  may: { modal: 'modal.may', tense: 'present' },
  might: { modal: 'modal.may', tense: 'present' },
  will: { modal: null, tense: 'future' },
  would: { modal: 'modal.would', tense: 'present' },
  shall: { modal: null, tense: 'future' },
  "'ll": { modal: null, tense: 'future' },
  "'d": { modal: 'modal.would', tense: 'present' },
};

/** Words that negate the clause. */
export const NEGATORS = new Set(['not', "n't", 'never']);

/** Contractions split by the tokenizer. */
export const CONTRACTIONS = {
  "can't": ['can', "n't"],
  cannot: ['can', "n't"],
  "won't": ['will', "n't"],
  "shan't": ['shall', "n't"],
  "ain't": ['is', "n't"],
  "let's": ['let', 'us'],
};
