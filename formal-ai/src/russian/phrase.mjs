/**
 * Russian noun phrases and prepositional phrases from meta-language
 * entities: agreement of determiners, possessives, numerals and adjectives
 * with the head noun, case government, animacy, locative-2, euphony.
 */

import { degreeForm, quantityWord } from './degree.mjs';
import { bindRelative } from './relative.mjs';
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
  QUESTION_ADVERBS,
  RELATIONS,
  euphony,
  cardinal,
  QUANTIFIERS,
  QUANTIFIER_CASES,
} from './words.mjs';

const CASE_INDEX = Object.fromEntries(CASES.map((c, i) => [c, i]));
const GENDER = { masculine: 'm', feminine: 'f', neuter: 'n' };
const TIME_CLASSES = new Set(['time', 'season']);

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

/** Grammatical features of an entity for agreement. */
export function features(e, ctx) {
  if (!e) {
    return { person: 3, number: 'sg', gender: 'n' };
  }
  if (e.action) {
    return e.nominalization
      ? features(e.nominalization, ctx)
      : { person: 3, number: 'sg', gender: 'n' };
  }
  if (e.coordination) {
    return { person: 3, number: 'pl', gender: 'pl' };
  }
  if (e.indefinite || e.concept === 'pro.everything') {
    // все/многие/оба agree in the plural; большинство is a neuter noun;
    // кто-то, никто and каждый are masculine
    if (
      (e.number === 'plural' && e.concept !== 'pro.most') ||
      e.concept === 'pro.everyone'
    ) {
      return { person: 3, number: 'pl', gender: 'pl' };
    }
    const person = /^pro\.(?:(?:some|any|no)(?:one|body)|each)$/.test(
      e.concept
    );
    return { person: 3, number: 'sg', gender: person ? 'm' : 'n' };
  }
  if (e.relativePronoun) {
    return e.antecedent
      ? { ...features(e.antecedent, ctx), person: 3 }
      : { person: 3, number: 'sg', gender: 'm' };
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
  if (e.name && !e.concept) {
    // a person's name agrees with the person's sex: «Мэри пришла»
    const gender =
      ctx.lexicon.nameGenders?.get(e.name) ||
      ctx.lexicon.nameEntry?.(e.name)?.gender ||
      'm';
    return { person: 3, number: 'sg', gender, animate: true };
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
  // "the tax/fee" → налог/плату
  if (e.alternative) {
    const { alternative, ...rest } = e;
    const other = renderEntity({ ...alternative, number: e.number }, kase, ctx);
    return `${renderEntity(rest, kase, ctx)}/${other}`;
  }
  if (e.emphatic && e.name && !e.concept) {
    const f = features(e, ctx);
    const word = emphaticWord({ ...f, number: f.number, case: kase });
    return `${word} ${renderEntity({ ...e, emphatic: false }, kase, ctx)}`;
  }
  if (e.bound) {
    const { bound, rangeFrom, ...rest } = e;
    // примерно/почти keep the phrase's own case
    const near = { approximate: 'примерно', almost: 'почти' }[bound];
    if (near) {
      return `${near} ${renderEntity(rest, kase, ctx)}`;
    }
    const upper = renderEntity(rest, 'gen', ctx);
    if (bound === 'range') {
      const lower = cardinal(
        rangeFrom,
        'gen',
        nounEntry(rest, ctx)?.gender,
        rest.digits
      );
      return `от ${lower} до ${upper}`;
    }
    return `${{ upper: 'до', lower: 'не менее', above: 'более', below: 'менее' }[bound]} ${upper}`;
  }
  if (e.amount) {
    const { amount, ...rest } = e;
    return `${localizeQuantity(amount)} ${renderEntity(rest, 'gen', ctx)}`;
  }
  if (e.quantifier) {
    const { quantifier, ...rest } = e;
    return `${quantityWord(quantifier)} ${renderEntity(rest, 'gen', ctx)}`;
  }
  if (e.partitive) {
    const { of, partitive: _partitive, ...rest } = e;
    return `${renderEntity(rest, kase, { ...ctx, numeralGender: nounEntry(of, ctx)?.gender })} из ${renderEntity(of, 'gen', ctx)}`;
  }
  if (e.action && ctx.renderAction) {
    return ctx.renderAction(e, kase, ctx);
  }
  if (e.participles && ctx.renderParticiple) {
    const { participles, ...rest } = e;
    const agree = { ...features(e, ctx), case: kase };
    return `${renderEntity(rest, kase, ctx)}, ${participles.map((p) => ctx.renderParticiple(p, agree, ctx)).join(', ')},`;
  }
  if (e.relativePronoun) {
    if (ctx.suppressRelative) {
      return '';
    }
    if (e.antecedent?.concept === 'pro.everything') {
      return PRONOUN_WORDS['q.what'][CASE_INDEX[kase]];
    }
    // который agrees with its noun in gender and number, takes its own case
    const f = features(e, ctx);
    return declineAdjective('который', {
      case: kase,
      number: f.number,
      gender: f.gender,
      animate: f.animate,
    });
  }
  if (e.parenthetical && ctx.renderStatement) {
    const { parenthetical, ...rest } = e;
    // "income (low, median, high)": adjectives agree with the head noun
    const f = features(rest, ctx);
    const agree = f.number === 'pl' ? { number: 'pl' } : { gender: f.gender };
    const adjective = (st) => {
      const ru = conceptOf(ctx, st.property.concept)?.ru;
      return ru?.pos === 'adj'
        ? declineAdjective(ru.lemma, { ...agree, case: 'nom' })
        : `[${st.property.text || st.property.concept}]`;
    };
    const inside = parenthetical
      .map((st) =>
        st.type === 'fragment'
          ? st.property && !st.entity
            ? adjective(st)
            : renderEntity(st.entity, 'nom', { ...ctx, afterPrep: false })
          : ctx.renderStatement(st, { ...ctx, afterPrep: false })
      )
      .join(', ');
    return `${renderEntity(rest, kase, ctx)} (${inside})`;
  }
  if (e.relative && ctx.renderStatement) {
    const { relative, ...antecedent } = e;
    const head = renderEntity(antecedent, kase, ctx);
    const bound = bindRelative(relative, antecedent);
    const gaps = (bound.objects || []).filter((o) => o.relativePronoun);
    // Russian puts the relative phrase first, including governed prepositions.
    const text = ctx.renderStatement(bound, {
      ...ctx,
      afterPrep: false,
      relativeGaps: gaps,
    });
    // the closing comma is dropped before sentence punctuation later
    return `${head}, ${text},`;
  }
  if (e.coordination) {
    const items = e.items.map((item, i) =>
      renderEntity(item, kase, { ...ctx, afterPrep: ctx.afterPrep && i === 0 })
    );
    // "A, B и C": commas between all but the last two
    const word = e.coordination === 'conj.or' ? 'или' : 'и';
    return items.length > 2
      ? `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`
      : items.join(` ${word} `);
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
    // "when"/"how" used as a noun phrase: the adverb does not decline
    return (
      PRONOUN_WORDS[e.question]?.[CASE_INDEX[kase]] ??
      QUESTION_ADVERBS[e.question]?.at ??
      PRONOUN_WORDS['q.what'][CASE_INDEX[kase]]
    );
  }
  if (e.concept?.startsWith('pro.')) {
    return PRONOUN_WORDS[e.concept][CASE_INDEX[kase]];
  }
  const entry = nounEntry(e, ctx);
  if (!entry && e.name && e.of) {
    // "70% of the price" → «70% цены»
    const { of, ...rest } = e;
    const own = renderEntity(rest, kase, ctx);
    return `${own} ${renderEntity(of, 'gen', { ...ctx, afterPrep: false, locative: false })}`;
  }
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
      if (/^~?\p{Sc}?\d/u.test(e.name)) {
        return localizeQuantity(e.name);
      }
      // a name keeps its Russian label from Wikidata; without one it stays
      // in Latin script, as brands do in Russian text (PayPal, Shopify)
      const label = ctx.lexicon.nameLabel?.(e.name);
      if (label) {
        ctx.notes.add(`name "${e.name}" → ${label} (Wikidata label)`);
        const entry = ctx.lexicon.nameEntry?.(e.name);
        return entry ? declineNoun(entry, kase, 'sg') : label;
      }
      return e.name;
    }
    if (e.numeral) {
      return cardinal(e.quantity, kase, ctx.numeralGender || 'm', e.digits);
    }
    const label = e.concept || e.untranslated || '?';
    ctx.notes.add(`no Russian noun for concept ${label}`);
    return `[${label}]`;
  }
  return renderNoun(e, entry, kase, ctx);
}

function renderNoun(e, entry, kase, ctx) {
  // "several hundred books" → «несколько сотен книг»: the round numeral is
  // the counted noun (its own dictionary entry), the items its genitive
  const scale = { 100: 'hundred', 1000: 'thousand', 1e6: 'million' }[
    e.quantity
  ];
  const unit = scale && !e.digits && QUANTIFIERS[e.determiner];
  const unitId = unit && ctx.lexicon.lookup?.('noun', scale)?.[0];
  if (unitId && conceptOf(ctx, unitId)?.ru?.pos === 'noun') {
    const { quantity: _q, quantityText: _t, determiner, ...items } = e;
    const counted = renderEntity(
      { concept: unitId, determiner, number: 'plural' },
      kase,
      ctx
    );
    const of = renderEntity({ ...items, number: 'plural' }, 'gen', {
      ...ctx,
      afterPrep: false,
    });
    return `${counted} ${of}`;
  }
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
      adjNumber = gov.case === 'nom' ? 'sg' : 'pl';
      adjCase =
        gov.case === 'nom'
          ? kase
          : gov.number === 'sg' && entry.gender === 'f'
            ? 'nom'
            : 'gen';
      numeral = cardinal(
        e.quantity,
        kase === 'acc' ? 'acc' : 'nom',
        entry.gender,
        e.digits
      );
    } else {
      number = e.quantity % 10 === 1 && e.quantity % 100 !== 11 ? 'sg' : 'pl';
      adjNumber = number;
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
    number = 'sg';
    adjNumber = 'sg';
    numeral = cardinal(1, kase, entry.gender, e.digits);
  }
  // "~190 markets", "50K plays": the amount as written, Russian style
  if (e.quantityText && numeral) {
    numeral = localizeQuantity(e.quantityText);
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
  } else if (quantifier && e.quantity === undefined) {
    // «нескольких дней», «многим людям», «большинству пользователей»;
    // «некоторому времени»
    const forms = QUANTIFIER_CASES[e.determiner];
    if (forms) {
      quantifierWord = forms[CASE_INDEX[kase]];
      number = 'pl';
      adjNumber = 'pl';
      if (forms.gen) {
        nounCase = 'gen';
        adjCase = 'gen';
      }
    } else if (e.determiner === 'det.some') {
      quantifierWord = declineAdjective('некоторый', {
        ...(number === 'pl' ? { number } : { gender: entry.gender }),
        case: kase,
      });
    }
  }
  // «установленные расходы»: a plurale tantum takes plural adjectives
  const g =
    adjNumber === 'pl' || (entry.pluraliaTantum && e.quantity === undefined)
      ? { number: 'pl' }
      : { gender: entry.gender };
  const agree = { ...g, case: adjCase, animate: animate && adjCase === 'acc' };
  const words = [];
  if (e.emphatic) {
    words.push(emphaticWord(agree));
  }
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
  const postproperties = [];
  for (const p of e.properties || []) {
    // "low/medium", "raw or unpublished": an alternative property
    const alt = p.alternative && propertyWord(p.alternative, agree, ctx);
    const joined = (word) =>
      alt
        ? `${word}${p.alternative.join ? ` ${p.alternative.join === 'conj.and' ? 'и' : 'или'} ` : '/'}${alt}`
        : word;
    if (p.participle && ctx.renderParticiple) {
      words.push(joined(ctx.renderParticiple(p, agree, ctx)));
      continue;
    }
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
    if (p.comparison || p.comparative) {
      words.push(
        degreeForm(adj, p.comparison || 'greater', {
          ...agree,
          attributive: true,
        })
      );
      continue;
    }
    if (p.superlative) {
      words.push(declineAdjective('самый', agree));
    }
    (adj.postpositive ? postproperties : words).push(
      joined(declineAdjective(adj.lemma, agree))
    );
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
  words.push(head, ...postproperties);
  if (e.label) {
    words.push(localizeQuantity(e.label));
  }
  const modifiers = e.modifiers || [];
  for (const m of modifiers.some((x) => x.concept)
    ? [...modifiers].reverse()
    : modifiers) {
    // English compounds branch to the right: bank account verification →
    // проверка счёта банка, with the nearest head's modifier first.
    // "tax/payment setup" → установка налога/платежа
    words.push(
      [m, ...(m.alternative ? [m.alternative] : [])]
        .map((x) =>
          renderEntity(
            {
              concept: x.concept,
              name: x.name,
              number: m.number || 'singular',
            },
            'gen',
            { ...ctx, afterPrep: false }
          )
        )
        .join('/')
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
  // "деньги от продаж": a noun's own prepositional phrases
  for (const m of e.relations || []) {
    words.push(
      renderRelation(m, { ...ctx, afterPrep: false, locative: false })
    );
  }
  return words.join(' ');
}

/** One plain property word: an adjective or a participle. */
function propertyWord(p, agree, ctx) {
  if (p.participle && ctx.renderParticiple) {
    return ctx.renderParticiple(p, agree, ctx);
  }
  const adj = conceptOf(ctx, p.concept)?.ru;
  return adj?.pos === 'adj' ? declineAdjective(adj.lemma, agree) : null;
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
  // "in about 4 days" → «примерно через 4 дня»: the approximation
  // goes before the preposition
  const near = { approximate: 'примерно', almost: 'почти' }[e?.bound];
  if (near) {
    const { bound: _bound, ...rest } = e;
    return `${near} ${renderRelation({ ...m, entity: rest }, ctx)}`;
  }
  if (m.adverb) {
    const adv = conceptOf(ctx, m.adverb)?.ru;
    return adv?.lemma || `[${m.adverb}]`;
  }
  if (m.postposition) {
    // "two days ago" → «два дня назад»: the measure stays in the accusative
    const word = conceptOf(ctx, m.relation)?.ru?.lemma;
    return `${renderEntity(e, 'acc', ctx)} ${word || `[${m.relation}]`}`;
  }
  const concept = conceptOf(ctx, e?.concept);
  const entry = nounEntry(e, ctx);
  const rel = m.relation;
  if (rel === 'rel.by' && e?.action && ctx.renderAction) {
    return `, ${ctx.renderAction(e, 'ins', { ...ctx, adverbialAction: true })}`;
  }
  // "before relying on it": a clause conjunction with an infinitive
  if (
    rel === 'rel.before' &&
    e?.action &&
    !e.nominalization &&
    ctx.renderAction
  ) {
    const text = ctx.renderAction(e, 'nom', { ...ctx, afterPrep: false });
    return `, прежде чем ${text}`;
  }
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
    e.number !== 'plural' &&
    !e.properties &&
    e.quantity === undefined &&
    !e.determiner
  ) {
    return entry.when;
  }
  const isTime = concept?.classes.some((c) => TIME_CLASSES.has(c));
  // "on Sundays", "in the mornings": a repeated time is по + dative plural
  if (
    e?.number === 'plural' &&
    ['rel.in', 'rel.at', 'rel.on'].includes(rel) &&
    (isTime || entry?.when || concept?.classes.includes('weekday')) &&
    !e.properties &&
    !e.determiner &&
    !e.possessor &&
    e.quantity === undefined
  ) {
    return `по ${renderEntity(e, 'dat', { ...ctx, afterPrep: true })}`;
  }
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
  // from Monday to Friday → с понедельника по пятницу (a calendar range)
  const calendarDay = ['weekday', 'month'].some((k) =>
    concept?.classes.includes(k)
  );
  if (
    calendarDay &&
    ['rel.from', 'rel.to'].includes(rel) &&
    !e.determiner &&
    e.quantity === undefined
  ) {
    const kase = rel === 'rel.from' ? 'gen' : 'acc';
    const np = renderEntity(e, kase, { ...ctx, afterPrep: true });
    return rel === 'rel.from' ? `${euphony('с', np)} ${np}` : `по ${np}`;
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
  const amount = /^~?\p{Sc}?\d/u.test(e.name || '') || (e.numeral && !concept);
  if (amount && spec.amount) {
    // "around $600" → около $600, "for $20" → за $20
    variant = spec.amount;
  } else if (isPerson(e, ctx) && spec.person) {
    variant = spec.person;
  } else if (
    spec.location &&
    (concept?.classes.includes('place') ||
      (!ctx.passive && e.definiteness === 'definite' && concept))
  ) {
    // "by the window": a definite thing next to an action is where
    variant = spec.location;
  } else if (spec.time && concept?.classes.includes('time')) {
    variant = spec.time;
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

// «сам платёж», «сама плата»: the emphatic pronoun, a closed paradigm
const SAM = {
  m: ['сам', 'самого', 'самому', 'сам', 'самим', 'самом'],
  f: ['сама', 'самой', 'самой', 'саму', 'самой', 'самой'],
  n: ['само', 'самого', 'самому', 'само', 'самим', 'самом'],
  pl: ['сами', 'самих', 'самим', 'сами', 'самими', 'самих'],
};
function emphaticWord(agree) {
  const forms = SAM[agree.number === 'pl' ? 'pl' : agree.gender || 'm'];
  const i = ['nom', 'gen', 'dat', 'acc', 'ins', 'prep'].indexOf(agree.case);
  if (agree.case === 'acc' && agree.animate && forms !== SAM.f) {
    return forms[1];
  }
  return forms[Math.max(i, 0)];
}
