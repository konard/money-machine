/**
 * Copula, possession and existence frames: "X is Y", "I have X",
 * "there is X". Split from naturalize.mjs to keep files small.
 */

import { degreeForm } from './degree.mjs';
import { shortAdjective, declineAdjective } from './morphology.mjs';
import { CONJUNCTIONS, QUESTION_ADVERBS, PRONOUN_WORDS } from './words.mjs';
import {
  features,
  renderEntity,
  renderRelation,
  pronounKey,
} from './phrase.mjs';
import { BYT_PAST, lexEntry, renderModifiers } from './naturalize.mjs';
import { infinitiveClause } from './nonfinite.mjs';

const BYT_FUTURE = ['буду', 'будешь', 'будет', 'будем', 'будете', 'будут'];
const PERSON_INDEX = {
  '1sg': 0,
  '2sg': 1,
  '3sg': 2,
  '1pl': 3,
  '2pl': 4,
  '3pl': 5,
};
const WEATHER = new Set(['cold', 'hot.weather', 'warm']);

/** Person/number key for conjugation. */
function agreementKey(f) {
  return `${f.person}${f.number}`;
}

/** был/была/было/были or буду… for past and future copulas. */
export function copulaWord(s, f) {
  if (s.tense === 'past') {
    return f.number === 'pl' ? BYT_PAST.pl : BYT_PAST[f.gender || 'm'];
  }
  if (s.tense === 'future') {
    return BYT_FUTURE[PERSON_INDEX[agreementKey(f)]];
  }
  return '';
}

export function renderCopula(s, ctx) {
  const c = s.complement;
  const mods = renderModifiers(s.modifiers, ctx);
  const negative = s.polarity === 'negative';
  const subj = s.subject;
  // "my name is Anna" → меня зовут Анна; "what is your name?" → как вас зовут?
  if (
    subj?.concept === 'name' &&
    subj.possessor &&
    c?.kind === 'entity' &&
    !subj.properties
  ) {
    const who = renderEntity(subj.possessor, 'acc', ctx);
    const verb =
      s.tense === 'past'
        ? 'звали'
        : s.tense === 'future'
          ? 'будут звать'
          : 'зовут';
    if (c.entity?.question) {
      return ['как', who, negative ? 'не' : '', verb].filter(Boolean).join(' ');
    }
    return [
      ...mods.before,
      who,
      negative ? 'не' : '',
      verb,
      renderEntity(c.entity, 'nom', ctx),
      ...mods.after,
    ]
      .filter(Boolean)
      .join(' ');
  }
  const tough = adjectiveInfinitive(s, mods, ctx);
  if (tough) {
    return tough;
  }
  // impersonal "it is cold"
  if (
    ((subj?.action && !subj.nominalization) ||
      (subj?.pronoun?.gender === 'neuter' && subj.pronoun.person === 3)) &&
    c?.kind === 'property' &&
    !lexEntry(ctx, c.concept)?.ru?.passive &&
    (WEATHER.has(c.concept) || !ctx.discourse.referents.length)
  ) {
    const adj = lexEntry(ctx, c.concept)?.ru;
    const predicative = adj ? predicativeAdverb(adj.lemma) : `[${c.concept}]`;
    const be =
      s.tense === 'past' ? 'было' : s.tense === 'future' ? 'будет' : '';
    return [
      subj?.action ? renderEntity(subj, 'nom', ctx) : '',
      ...mods.before,
      ...mods.after,
      negative ? 'не' : '',
      be,
      degreeWord(c, ctx),
      predicative,
    ]
      .filter(Boolean)
      .join(' ');
  }
  const whWord = s.question ? copulaQuestion(s, ctx) : '';
  const subjectText =
    subj?.pronoun?.gender === 'neuter' &&
    !ctx.discourse.referents.length &&
    c?.kind === 'entity'
      ? 'это'
      : renderEntity(subj, 'nom', { ...ctx, isSubject: true });
  // "это был мой брат": after presentational это the verb agrees with the
  // complement, which stays in the nominative
  const presentational =
    subjectText === 'это' && c?.kind === 'entity' && !c.entity?.question;
  const f = presentational ? features(c.entity, ctx) : features(subj, ctx);
  const be = copulaWord(s, f);
  const embedded = s.link === 'conj.whether';
  const words = [whWord, embedded ? '' : subjectText, ...mods.before];
  if (negative) {
    words.push('не');
  }
  if (be) {
    words.push(be);
    if (embedded) {
      words.push('ли', subjectText);
    }
  }
  if (
    !c ||
    s.question?.slot === 'complement' ||
    (s.question && QUESTION_ADVERBS[s.question.concept] && !c)
  ) {
    return [...words, ...mods.after].filter(Boolean).join(' ');
  }
  if (c.kind === 'property') {
    // "cheap, fast and safe" → дешёва, быстра и безопасна
    words.push(...coordinated(c, ctx, (a) => predicateAdjective(a, f, ctx)));
    // "I am happy to help" → я рад помочь
    if (s.complementClause) {
      words.push(...infinitiveClause(s.complementClause, positive(s), ctx));
    }
  } else if (c.kind === 'entity') {
    const nominalSubject =
      subj && !subj.pronoun && !subj.demonstrative && !subj.question;
    if (!be && !negative && nominalSubject && !s.question && !embedded) {
      words.push('—');
    }
    words.push(
      renderEntity(c.entity, be && !presentational ? 'ins' : 'nom', ctx)
    );
  } else if (c.kind === 'relation') {
    words.push(renderRelation(c, ctx));
  }
  if (embedded && !be) {
    words.push('ли', subjectText);
  }
  words.push(...mods.after);
  return words.filter(Boolean).join(' ');
}

const positive = (s) => ({ ...s, polarity: 'positive' });

/** A property and the ones coordinated with it, each rendered by `one`. */
function coordinated(c, ctx, one) {
  const words = one(c).filter(Boolean);
  for (const x of c.also || []) {
    const link = x.link ? CONJUNCTIONS[x.link] : null;
    if (!['и', 'или'].includes(link?.text)) {
      words[words.length - 1] += ',';
    }
    words.push(...[link?.text, ...one(x)].filter(Boolean));
  }
  return words;
}

/** A predicate adjective agreeing with the subject: short when it has one. */
function predicateAdjective(c, f, ctx) {
  const adj = lexEntry(ctx, c.concept)?.ru;
  if (!adj || adj.pos !== 'adj') {
    ctx.notes.add(`no Russian adjective for ${c.concept}`);
    return [`[${c.concept}]`];
  }
  const agree = f.number === 'pl' ? { number: 'pl' } : { gender: f.gender };
  if (c.comparison || c.comparative) {
    return [
      degreeWord(c, ctx),
      degreeForm(adj, c.comparison || 'greater', { ...agree, case: 'nom' }),
    ];
  }
  if (adj.predicateShort || adj.short) {
    return [
      degreeWord(c, ctx),
      f.number !== 'pl' && f.gender === 'm' && adj.short
        ? adj.short
        : shortFrom(adj, agree),
    ];
  }
  return [
    degreeWord(c, ctx),
    declineAdjective(adj.lemma, { ...agree, case: 'nom' }),
  ];
}

/**
 * An adjective with an infinitive is predicative: "it is easy to read" →
 * легко читать; a lifeless subject the infinitive lacks becomes its
 * object: "the book is easy to read" → книгу легко читать.
 */
function adjectiveInfinitive(s, mods, ctx) {
  const [c, x, subj] = [s.complement, s.complementClause, s.subject];
  if (!x || c?.kind !== 'property' || s.question || !lexEntry(ctx, c.concept)) {
    return undefined;
  }
  const dummy =
    !subj || (subj.pronoun?.gender === 'neuter' && subj.pronoun.person === 3);
  const lifeless =
    !subj?.pronoun && !x.objects.length && !features(subj, ctx).animate;
  if (!dummy && !lifeless) {
    return undefined;
  }
  const adj = lexEntry(ctx, c.concept).ru;
  if (adj?.pos !== 'adj') {
    return undefined;
  }
  return [
    dummy ? '' : renderEntity(subj, 'acc', ctx),
    ...mods.before,
    s.polarity === 'negative' ? 'не' : '',
    s.tense === 'past' ? 'было' : s.tense === 'future' ? 'будет' : '',
    ...coordinated(c, ctx, (a) => [
      degreeWord(a, ctx),
      predicativeAdverb(
        lexEntry(ctx, a.concept)?.ru?.lemma || `[${a.concept}]`
      ),
    ]),
    ...infinitiveClause(x, positive(s), ctx),
    ...mods.after,
  ]
    .filter(Boolean)
    .join(' ');
}

export function shortFrom(adj, agree) {
  // all four short forms from the source: редок, редка, редко, редки
  if (adj.shortForms) {
    const key = agree.number === 'pl' ? 'p' : agree.gender || 'm';
    if (adj.shortForms[key]) {
      return adj.shortForms[key];
    }
  }
  if (adj.short && agree.gender === 'm') {
    return adj.short;
  }
  if (adj.short && agree.number !== 'pl') {
    const stem = adj.short.replace(/е(?=н$)/, '');
    return stem + (agree.gender === 'f' ? 'а' : 'о');
  }
  if (adj.short && agree.number === 'pl') {
    return `${adj.short.replace(/е(?=н$)/, '')}ы`;
  }
  return shortAdjective(adj.lemma, agree);
}

function degreeWord(c, ctx) {
  return c.degree ? lexEntry(ctx, c.degree)?.ru?.lemma || '' : '';
}

/** холодный → холодно, тёплый → тепло. */
function predicativeAdverb(lemma) {
  return lemma
    .replace(/(ый|ий|ой)$/, 'о')
    .replace(/^тёпло$/, 'тепло')
    .replace(/^лёгко$/, 'легко')
    .replace(/^жаркo$/, 'жарко');
}

function copulaQuestion(s, _ctx) {
  const q = s.question.concept;
  if (QUESTION_ADVERBS[q]) {
    return QUESTION_ADVERBS[q].at;
  }
  if (s.question.slot === 'complement') {
    return PRONOUN_WORDS[q]?.[0] || '';
  }
  return '';
}

/** "I have a dog" → у меня есть собака. */
export function renderPossession(s, ctx) {
  const owner = s.subject;
  const theme = s.objects?.[0];
  const mods = renderModifiers(s.modifiers, ctx);
  const ownerText =
    s.question?.slot === 'subject'
      ? 'у кого'
      : `у ${renderEntity(owner, 'gen', { ...ctx, afterPrep: true })}`;
  const words = [ownerText, ...mods.before];
  const negative = s.polarity === 'negative' || theme?.determiner === 'det.no';
  const themeEntity =
    theme && theme.determiner === 'det.no'
      ? { ...theme, determiner: undefined }
      : theme;
  words.push(...existencePredicate(s, themeEntity, negative, ctx));
  words.push(...mods.after);
  return words.filter(Boolean).join(' ');
}

/** есть / нет / был / не было + theme. */
function existencePredicate(s, theme, negative, ctx) {
  if (!theme) {
    return [negative ? 'нет' : 'есть'];
  }
  if (negative) {
    const verb =
      s.tense === 'past'
        ? 'не было'
        : s.tense === 'future'
          ? 'не будет'
          : 'нет';
    const plain =
      theme.determiner === 'det.any'
        ? { ...theme, determiner: undefined }
        : theme;
    return [verb, renderEntity(plain, 'gen', ctx)];
  }
  const f = features(theme, ctx);
  const verb =
    s.tense === 'past'
      ? f.number === 'pl'
        ? 'были'
        : BYT_PAST[f.gender]
      : s.tense === 'future'
        ? f.number === 'pl'
          ? 'будут'
          : 'будет'
        : 'есть';
  const plain =
    theme.determiner === 'det.any'
      ? { ...theme, determiner: undefined }
      : theme;
  return [verb, renderEntity(plain, 'nom', ctx)];
}

/** "There is a cat in the garden" → в саду есть кошка. */
export function renderExistence(s, ctx) {
  const mods = renderModifiers(s.modifiers, ctx);
  const negative =
    s.polarity === 'negative' || s.subject?.determiner === 'det.no';
  const theme =
    s.subject?.determiner === 'det.no'
      ? { ...s.subject, determiner: undefined }
      : s.subject;
  const words = [...mods.after, ...mods.before];
  words.push(...existencePredicate(s, theme, negative, ctx));
  return words.filter(Boolean).join(' ');
}

export { pronounKey };
