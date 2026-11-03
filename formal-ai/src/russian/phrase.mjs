/**
 * Russian noun phrases and prepositional phrases from meta-language
 * entities: agreement of determiners, possessives, numerals and adjectives
 * with the head noun, case government, animacy, locative-2, euphony.
 */

import {
  declineNoun,
  declineAdjective,
  numeralGovernment,
  CASES,
} from './morphology.mjs';
import {
  PERSONAL,
  afterPreposition,
  POSSESSIVE,
  POSSESSIVE_3,
  DEMONSTRATIVE,
  PRONOUN_WORDS,
  RELATIONS,
  euphony,
  cardinal,
  QUANTIFIERS,
  transliterate,
} from './words.mjs';

const CASE_INDEX = Object.fromEntries(CASES.map((c, i) => [c, i]));
const GENDER = { masculine: 'm', feminine: 'f', neuter: 'n' };
const TIME_CLASSES = new Set(['time', 'season']);

/** Grammatical features of an entity for agreement. */
export function features(e, ctx) {
  if (!e) {
    return { person: 3, number: 'sg', gender: 'n' };
  }
  if (e.coordination) {
    return { person: 3, number: 'pl', gender: 'pl' };
  }
  if (e.pronoun) {
    const key = pronounKey(e.pronoun, ctx);
    const person = Number(key[0]) || 3;
    const number = key.includes('pl') ? 'pl' : 'sg';
    let gender = key.endsWith('f') ? 'f' : key.endsWith('n') ? 'n' : 'm';
    if (person === 1 && number === 'sg') {
      gender = ctx.options.speakerGender || 'm';
    }
    if (person === 2 && number === 'sg') {
      gender = ctx.options.addresseeGender || 'm';
    }
    return { person, number, gender };
  }
  if (e.question === 'q.who' && !e.concept) {
    return { person: 3, number: 'sg', gender: 'm' };
  }
  if ((e.question === 'q.what' && !e.concept) || e.demonstrative) {
    return { person: 3, number: 'sg', gender: 'n' };
  }
  const entry = nounEntry(e, ctx);
  const plural = e.number === 'plural' || entry?.pluraliaTantum;
  if (
    (e.quantity !== undefined && e.quantity !== 1) ||
    (QUANTIFIERS[e.determiner] &&
      (!plural || (entry?.pluraliaTantum && e.number !== 'plural')))
  ) {
    // "пять книг лежит" – counted subjects agree in neuter singular
    return {
      person: 3,
      number: 'sg',
      gender: 'n',
      counted: true,
      animate: entry?.animate,
    };
  }
  return {
    person: 3,
    number: plural ? 'pl' : 'sg',
    gender: entry?.gender || 'm',
    animate: Boolean(entry?.animate),
  };
}

/** Lexicon key for a pronoun: 1sg, 2pl, 3sgf … */
export function pronounKey(p, ctx) {
  if (p.reflexive) {
    return 'refl';
  }
  if (p.person === 1) {
    return p.number === 'plural' ? '1pl' : '1sg';
  }
  if (p.person === 2) {
    if (p.number === 'plural') {
      return '2pl';
    }
    return ctx.options.you === 'ty' ? '2sg' : '2pl';
  }
  if (p.number === 'plural') {
    return '3pl';
  }
  if (p.gender === 'neuter' && ctx.discourse?.referents?.[0]) {
    return `3sg${ctx.discourse.referents[0].gender}`;
  }
  return `3sg${GENDER[p.gender] || 'n'}`;
}

/** The Russian noun entry for an entity, if any. */
export function nounEntry(e, ctx) {
  const ru = e?.concept ? ctx.lexicon.get(e.concept)?.ru : null;
  return ru?.pos === 'noun' ? ru : null;
}

const conceptOf = (ctx, id) => ctx.lexicon.get(id);

/**
 * Render an entity in a case.
 * @param {object} e - meta-language entity
 * @param {string} kase
 * @param {object} ctx - `{lexicon, options, notes, discourse, afterPrep,
 *   locative, subject}`
 * @returns {string}
 */
export function renderEntity(e, kase, ctx) {
  if (!e) {
    return '';
  }
  if (e.coordination) {
    const items = e.items.map((item, i) =>
      renderEntity(item, kase, { ...ctx, afterPrep: ctx.afterPrep && i === 0 })
    );
    return e.coordination === 'conj.or'
      ? items.join(' или ')
      : items.join(' и ');
  }
  if (e.pronoun) {
    const key = pronounKey(e.pronoun, ctx);
    if (e.pronoun.person === 2 && e.pronoun.number === 'singular plural') {
      ctx.notes.add(
        `"you" rendered as ${ctx.options.you === 'ty' ? 'informal ты' : 'polite вы'} (use --you=${ctx.options.you === 'ty' ? 'vy' : 'ty'} to switch)`
      );
    }
    const form = PERSONAL[key][CASE_INDEX[kase]];
    return ctx.afterPrep ? afterPreposition(form) : form;
  }
  if (e.demonstrative) {
    return PRONOUN_WORDS.this[CASE_INDEX[kase]];
  }
  if (e.question && !e.concept) {
    return PRONOUN_WORDS[e.question][CASE_INDEX[kase]];
  }
  if (e.concept?.startsWith('pro.')) {
    return PRONOUN_WORDS[e.concept][CASE_INDEX[kase]];
  }
  const entry = nounEntry(e, ctx);
  if (!entry) {
    if (e.name) {
      if (/^Xp[ch][a-j]+Q$/.test(e.name)) {
        // "the file `notes.md`" → файл `notes.md` (apposition)
        const nouns = (e.modifiers || [])
          .map((m) => conceptOf(ctx, m.concept)?.ru)
          .filter((r) => r?.pos === 'noun');
        return [...nouns.map((r) => declineNoun(r, kase, 'sg')), e.name].join(
          ' '
        );
      }
      ctx.notes.add(
        `unknown name "${e.name}" transliterated as ${transliterate(e.name)}`
      );
      return transliterate(e.name);
    }
    if (e.numeral) {
      return String(e.quantity);
    }
    const label = e.concept || '?';
    ctx.notes.add(`no Russian noun for concept ${label}`);
    return `[${label}]`;
  }
  return renderNoun(e, entry, kase, ctx);
}

function renderNoun(e, entry, kase, ctx) {
  let number = e.number === 'plural' ? 'pl' : 'sg';
  let nounCase = kase;
  let numeral = '';
  let adjCase = kase;
  let adjNumber = number;
  const animate = Boolean(entry.animate);
  if (e.quantity !== undefined && !(e.quantity === 1)) {
    const direct =
      kase === 'nom' || (kase === 'acc' && !(animate && e.quantity <= 4));
    if (direct) {
      const gov = numeralGovernment(e.quantity);
      nounCase = gov.case;
      number = gov.number;
      adjNumber = 'pl';
      adjCase = gov.number === 'sg' && entry.gender === 'f' ? 'nom' : 'gen';
      numeral = cardinal(
        e.quantity,
        kase === 'acc' ? 'acc' : 'nom',
        entry.gender,
        e.digits
      );
    } else {
      number = 'pl';
      adjNumber = 'pl';
      numeral = cardinal(
        e.quantity,
        kase === 'acc' ? 'gen' : kase,
        entry.gender,
        e.digits
      );
      if (kase === 'acc') {
        nounCase = 'gen';
        adjCase = 'gen';
      }
    }
  } else if (e.quantity === 1) {
    numeral = cardinal(1, kase, entry.gender, e.digits);
  }
  const quantifier = QUANTIFIERS[e.determiner];
  let quantifierWord = '';
  if (
    quantifier &&
    (kase === 'nom' || kase === 'acc') &&
    e.quantity === undefined
  ) {
    quantifierWord = quantifier[number];
    nounCase = 'gen';
    adjCase = 'gen';
  }
  const g = adjNumber === 'pl' ? { number: 'pl' } : { gender: entry.gender };
  const agree = { ...g, case: adjCase, animate: animate && adjCase === 'acc' };
  const words = [];
  if (quantifierWord) {
    words.push(quantifierWord);
  }
  const det = determinerWord(e, entry, agree, ctx);
  if (det) {
    words.push(det);
  }
  if (e.possessor?.pronoun) {
    words.push(possessiveWord(e.possessor, entry, agree, ctx));
  }
  if (numeral) {
    words.push(numeral);
  }
  for (const p of e.properties || []) {
    if (p.degree) {
      const d = conceptOf(ctx, p.degree)?.ru;
      if (d) {
        words.push(d.lemma);
      }
    }
    const adj = conceptOf(ctx, p.concept)?.ru;
    if (!adj || adj.pos !== 'adj') {
      ctx.notes.add(`no Russian adjective for ${p.concept}`);
      continue;
    }
    words.push(declineAdjective(adj.lemma, agree));
  }
  if (entry.adjective) {
    words.push(declineAdjective(entry.adjective, agree));
  }
  let head = declineNoun(entry, nounCase, number);
  if (
    ctx.locative &&
    entry.locative &&
    nounCase === 'prep' &&
    number === 'sg'
  ) {
    head = entry.locative;
  }
  words.push(head);
  for (const m of e.modifiers || []) {
    words.push(
      renderEntity(
        { concept: m.concept, name: m.name, number: 'singular' },
        'gen',
        { ...ctx, afterPrep: false }
      )
    );
  }
  if (e.possessor && !e.possessor.pronoun) {
    words.push(
      renderEntity(e.possessor, 'gen', {
        ...ctx,
        afterPrep: false,
        locative: false,
      })
    );
  }
  if (e.of) {
    words.push(
      renderEntity(e.of, 'gen', { ...ctx, afterPrep: false, locative: false })
    );
  }
  return words.join(' ');
}

function determinerWord(e, entry, agree, _ctx) {
  if (e.question === 'q.which') {
    return declineAdjective('какой', agree);
  }
  if (e.question === 'q.whose') {
    return pronominalForm(DEMONSTRATIVE.whose, agree);
  }
  switch (e.determiner) {
    case 'det.this':
    case 'det.that':
      return pronominalForm(DEMONSTRATIVE[e.determiner], agree);
    case 'det.all':
      return pronominalForm(DEMONSTRATIVE.all, agree);
    case 'det.every':
    case 'det.each':
      return declineAdjective('каждый', agree);
    case 'det.another':
    case 'det.other':
      return declineAdjective('другой', agree);
    case 'det.no':
      return declineAdjective('никакой', agree);
    default:
      return '';
  }
}

/** Pick a pronominal-declension form (`этот`, `мой`, `весь`) by agreement. */
export function pronominalForm(paradigm, agree) {
  const slot = agree.number === 'pl' ? 'pl' : agree.gender || 'm';
  const forms = paradigm[slot];
  if (
    agree.case === 'acc' &&
    agree.animate &&
    (slot === 'm' || slot === 'pl')
  ) {
    return forms[1];
  }
  return forms[CASE_INDEX[agree.case]];
}

function possessiveWord(owner, entry, agree, ctx) {
  const p = owner.pronoun;
  const subject = ctx.subject?.pronoun;
  const sameAsSubject =
    subject &&
    subject.person === p.person &&
    subject.number === p.number &&
    (p.person !== 3 || subject.gender === p.gender) &&
    !ctx.isSubject;
  if (sameAsSubject) {
    return pronominalForm(POSSESSIVE.refl, agree);
  }
  if (p.person === 3) {
    return p.number === 'plural'
      ? POSSESSIVE_3.pl
      : POSSESSIVE_3[GENDER[p.gender] || 'm'];
  }
  const key = pronounKey(p, ctx);
  const number = key.endsWith('pl') ? 'pl' : 'sg';
  return pronominalForm(POSSESSIVE[p.person][number], agree);
}

/** Is the entity a person (for к/от/у instead of в/из)? */
export function isPerson(e, ctx) {
  if (!e) {
    return false;
  }
  if (e.pronoun) {
    return e.pronoun.gender !== 'neuter';
  }
  const concept = conceptOf(ctx, e.concept);
  return Boolean(
    concept?.classes.includes('person') ||
    (concept?.ru?.animate && concept?.ru?.pos === 'noun')
  );
}

/**
 * Render a relation modifier (`rel.in` + entity) as a Russian PP.
 * @param {object} m - `{relation, entity, adverb}`
 * @param {object} ctx - plus `motion` (the verb is a motion verb)
 * @returns {string}
 */
export function renderRelation(m, ctx) {
  const e = m.entity;
  if (m.adverb) {
    const adv = conceptOf(ctx, m.adverb)?.ru;
    return adv?.lemma || `[${m.adverb}]`;
  }
  const concept = conceptOf(ctx, e?.concept);
  const entry = nounEntry(e, ctx);
  const rel = m.relation;
  // at home / to home
  if (
    (e?.concept === 'home' || e?.concept === 'home.adv') &&
    ['rel.at', 'rel.in', 'rel.to'].includes(rel) &&
    !e.possessor
  ) {
    return ctx.motion || rel === 'rel.to' ? 'домой' : 'дома';
  }
  // in the morning, at night, in summer
  if (
    entry?.when &&
    ['rel.in', 'rel.at', 'rel.on', 'rel.during'].includes(rel) &&
    !e.properties &&
    e.quantity === undefined &&
    !e.determiner
  ) {
    return entry.when;
  }
  const isTime = concept?.classes.some((c) => TIME_CLASSES.has(c));
  if (isTime && e.quantity !== undefined) {
    if (rel === 'rel.in') {
      return `через ${renderEntity(e, 'acc', ctx)}`;
    }
    if (rel === 'rel.for') {
      return renderEntity(e, 'acc', ctx);
    }
  }
  if (
    e?.numeral &&
    e.quantity >= 1000 &&
    e.quantity <= 2100 &&
    rel === 'rel.in'
  ) {
    return `в ${e.quantity} году`;
  }
  // on Monday → в понедельник; in May → в мае
  const calendar =
    concept?.classes.includes('weekday') && rel === 'rel.on'
      ? 'acc'
      : concept?.classes.includes('month') && rel === 'rel.in'
        ? 'prep'
        : null;
  if (calendar && !e.determiner && e.quantity === undefined) {
    const np = renderEntity(e, calendar, { ...ctx, afterPrep: true });
    return `${euphony('в', np)} ${np}`;
  }
  if (concept?.classes.includes('language') && rel === 'rel.in') {
    return `на ${renderEntity(e, 'prep', { ...ctx, afterPrep: true })}`;
  }
  if (concept?.classes.includes('vehicle') && rel === 'rel.by') {
    return `на ${renderEntity(e, 'prep', { ...ctx, afterPrep: true })}`;
  }
  const spec = RELATIONS[rel];
  if (!spec) {
    ctx.notes.add(`no Russian preposition for ${rel}`);
    return renderEntity(e, 'gen', ctx);
  }
  let variant = spec.place;
  if (isPerson(e, ctx) && spec.person) {
    variant = spec.person;
  } else if (ctx.motion && spec.goal) {
    variant = spec.goal;
  }
  // "run in the park": with a motion verb and no object, "in" is still where
  if (
    rel === 'rel.in' &&
    variant === spec.goal &&
    ctx.motion &&
    !ctx.hasObject
  ) {
    variant = spec.place;
  }
  let [prep] = variant;
  const [, kase, rule] = variant;
  if (rule && entry?.at === 'на') {
    prep = rule === 'on' ? 'на' : rule.slice(3);
  }
  const np = renderEntity(e, kase, {
    ...ctx,
    afterPrep: Boolean(prep),
    locative: kase === 'prep' && (prep === 'в' || prep === 'на'),
  });
  if (!prep) {
    return np;
  }
  const first = np.split(' ')[0] || '';
  return `${euphony(prep, first)} ${np}`;
}
