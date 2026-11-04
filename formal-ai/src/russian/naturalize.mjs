import { renderFragment } from './fragment.mjs';
import { markParenthetic, punctuateParenthetics } from './parenthetic.mjs';
/** Naturalize meta-language statements into Russian, recording decisions. */

import { periodicAdverb } from './periodic-adverb.mjs';
import { degreeForm, quantityWord } from './degree.mjs';
import { frontRelative } from './relative.mjs';
import {
  renderAction,
  renderParticiple,
  purposeClause,
  infinitiveClause,
} from './nonfinite.mjs';
import { conjugatePredicate as conjugate } from '../sources/definition-verbs.mjs';
import {
  CONJUNCTIONS,
  QUESTION_ADVERBS,
  PRONOUN_WORDS,
  euphony,
} from './words.mjs';
import {
  features,
  renderEntity,
  renderRelation,
  nounEntry,
  isPerson,
} from './phrase.mjs';
import { withPartner } from './partner.mjs';
import {
  renderCopula,
  renderPossession,
  renderExistence,
  copulaWord,
  shortFrom,
} from './copula.mjs';

/** Adverbs placed before the verb in Russian. */
const PREVERBAL = new Set(
  'often always never sometimes usually already also still really only soon again'.split(
    ' '
  )
);
/** Adverbs and determiners that make an action habitual (imperfective). */
const HABIT = new Set('often always never sometimes usually again'.split(' '));
/** "often", or an adverb whose gloss repeats ("monthly": every month). */
function habitualAdverb(concept, ctx) {
  return (
    HABIT.has(concept) ||
    /\b(?:every|each|regularly|repeatedly|once an?)\b/.test(
      ctx.lexicon.get(concept)?.gloss || ''
    )
  );
}

export const BYT_PAST = { m: 'был', f: 'была', n: 'было', pl: 'были' };

export const lexEntry = (ctx, id) => ctx.lexicon.get(id);

/** Naturalize formalized statements; return Russian text and decision notes. */
export function naturalizeRussian(
  formal,
  lexicon,
  options = {},
  discourse = { referents: [] }
) {
  const notes = new Set();
  const opts = { you: 'vy', speakerGender: 'm', ...options };
  const statements = formal.statements;
  const future = statements.some(
    (s) => s.type === 'statement' && !s.link && s.tense === 'future'
  );
  const pieces = [];
  statements.forEach((s, i) => {
    const ctx = {
      lexicon,
      options: opts,
      notes,
      discourse,
      renderStatement,
      renderAction,
      renderParticiple,
      renderFragment: (st, c) => renderFragment(st, c, renderModifiers),
    };
    let text;
    if (s.type === 'phrase') {
      text = lexEntry(ctx, s.concept)?.ru?.text || `[${s.concept}]`;
    } else if (s.type === 'fragment') {
      text = renderFragment(s, ctx, renderModifiers);
    } else {
      const adjusted = { ...s };
      if (
        future &&
        s.tense === 'present' &&
        [
          'conj.if',
          'conj.when',
          'conj.before',
          'conj.after',
          'conj.until',
        ].includes(s.link)
      ) {
        adjusted.tense = 'future';
        notes.add(
          `present tense after "${s.link.slice(5)}" with a future main clause rendered as future`
        );
      }
      const habitual = (s.modifiers || []).some(
        (m) =>
          (m.kind === 'time' && m.entity?.determiner === 'det.every') ||
          (m.kind === 'adverb' && HABIT.has(m.concept))
      );
      if (adjusted.tense === 'present past' && habitual) {
        adjusted.tense = 'present';
        notes.add(
          'English verb form is both present and past; chose present because the clause is habitual'
        );
      } else if (adjusted.tense === 'present past') {
        adjusted.tense = discourse.lastTense === 'present' ? 'present' : 'past';
        notes.add(
          `English verb form is both present and past; chose ${adjusted.tense}${discourse.lastTense ? ' from the surrounding text' : ' (narrative default)'}`
        );
      } else if (adjusted.tense) {
        discourse.lastTense = adjusted.tense;
      }
      text = renderStatement(adjusted, ctx);
      remember(s, ctx);
    }
    if (s.separator && i > 0 && s.separator !== '(') {
      pieces.push(s.separator);
    }
    if (s.link === 'conj.whether') {
      if (i > 0 && !s.separator) {
        pieces.push(',');
      }
    } else if (s.link && CONJUNCTIONS[s.link]) {
      const previous = statements[i - 1];
      const named = (e) => e?.name || e?.coordination;
      const contrast =
        s.link === 'conj.while' &&
        previous &&
        s.tense === 'present' &&
        previous.tense === 'present' &&
        s.aspect === 'simple' &&
        previous.aspect === 'simple' &&
        named(s.subject) &&
        named(previous.subject);
      const conj = contrast
        ? { text: 'тогда как', comma: true }
        : CONJUNCTIONS[s.link];
      text = `${conj.text} ${text}`;
      // "откройте файл и прочитайте": no comma between predicates sharing a subject
      const sharedSubject =
        conj.text === 'и' && (s.mood === 'imperative' || s.subject?.implicit);
      if (i > 0 && conj.comma && !sharedSubject && !s.separator) {
        pieces.push(',');
      }
    } else if (i > 0 && !s.separator && statements[i - 1].trailing !== ',') {
      pieces.push(',');
    }
    pieces.push(s.separator === '(' ? `(${text})` : text);
    if (statements[i].type === 'phrase' && i < statements.length - 1) {
      pieces.push(',');
    }
  });
  let text = pieces
    .join(' ')
    .replace(/,?\s+([,;:])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/,$/, '');
  text = punctuateParenthetics(text);
  // "eBay", "iPhone" keep their own capitalization
  if (!/^[a-z]+[A-Z]/.test(text)) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (formal.leftover?.length) {
    text = `${text}${text ? ' ' : ''}[${formal.leftover.join(' ')}]`;
    notes.add(`untranslated: "${formal.leftover.join(' ')}"`);
  }
  // «через 3 сут.» + ".": one period
  text = (text + (formal.punctuation || '')).replace(/(?<!\.)\.\.$/, '.');
  return { text, notes: [...notes] };
}

/** Record inanimate nouns as referents for later "it". */
function remember(s, ctx) {
  const candidates = [s.subject, ...(s.objects || [])].filter(Boolean);
  for (const e of candidates.reverse()) {
    const entry = nounEntry(e, ctx);
    if (entry && !entry.animate && e.number !== 'plural') {
      ctx.discourse.referents.unshift({
        concept: e.concept,
        gender: entry.gender,
      });
      ctx.discourse.referents.length = Math.min(
        ctx.discourse.referents.length,
        8
      );
      return;
    }
  }
}

function renderStatement(s, ctx) {
  if (ctx.relativeGaps?.length) {
    return frontRelative(s, ctx, renderObjects);
  }

  const front = (s.modifiers || []).filter((m) => m.position === 'front');
  if (!front.length) {
    return renderFrame(s, ctx);
  }
  const rest = renderFrame(
    { ...s, modifiers: s.modifiers.filter((m) => m.position !== 'front') },
    ctx
  );
  const mods = renderModifiers(front, ctx, lexEntry(ctx, s.predicate)?.ru);
  return [...mods.before, ...mods.after, rest].filter(Boolean).join(' ');
}

function renderFrame(s, ctx) {
  ctx.subject = s.subject;
  switch (s.frame) {
    case 'copula':
      return renderCopula(s, ctx);
    case 'possession':
      return renderPossession(s, ctx);
    case 'existence':
      return renderExistence(s, ctx);
    default:
      return s.mood === 'imperative'
        ? renderImperative(s, ctx)
        : renderEvent(s, ctx);
  }
}

/** Choose the aspect partner of a verb for a clause. */
export function chooseVerb(entry, s, ctx, role = 'finite') {
  const variant = chooseAspect(entry, s, ctx, role);
  if (role === 'finite') {
    ctx.discourse.lastAspect =
      variant.aspect === 'perf' ||
      (variant !== entry && variant === entry.perfective)
        ? 'perf'
        : 'impf';
  }
  return variant;
}

function chooseAspect(entry, s, ctx, role) {
  const mods = s.modifiers || [];
  const habitual = mods.some(
    (m) =>
      (m.kind === 'adverb' && habitualAdverb(m.concept, ctx)) ||
      (m.kind === 'time' && m.entity?.determiner === 'det.every')
  );
  const objects = s.objects || [];
  const specific = objects.some(
    (o) =>
      o.definiteness === 'definite' ||
      o.quantity !== undefined ||
      o.pronoun ||
      o.name ||
      (o.definiteness === 'indefinite' && o.number === 'singular')
  );
  const hasGoal =
    mods.some(
      (m) =>
        m.kind === 'relation' && ['rel.to', 'rel.into'].includes(m.relation)
    ) ||
    mods.some(
      (m) =>
        m.kind === 'adverb' && ['home.adv', 'there', 'here'].includes(m.concept)
    );
  const duration = lasting(s);
  const pick = (variant, why) => {
    if (variant !== entry && why) {
      ctx.notes.add(`${variant.lemma}: ${why}`);
    }
    return variant;
  };
  if (habitual && entry.habitual) {
    return pick(entry.habitual, 'habitual motion');
  }
  if (!entry.perfective) {
    return entry;
  }
  if (
    s.aspect === 'progressive' ||
    s.aspect === 'perfect-progressive' ||
    habitual ||
    (s.polarity === 'negative' && role !== 'finite')
  ) {
    return entry;
  }
  if (role === 'imperative') {
    return s.polarity === 'negative'
      ? entry
      : objects.length || entry.motion
        ? pick(entry.perfective, 'single completed action requested')
        : entry;
  }
  if (s.aspect === 'perfect') {
    if (duration && s.tense === 'present') {
      return entry;
    }
    return pick(entry.perfective, 'perfect aspect (completed result)');
  }
  if (role === 'finite' && s.tense === 'present') {
    return entry;
  }
  if (
    s.tense === 'past' &&
    entry.motion &&
    hasGoal &&
    entry.habitual &&
    mods.some((m) => m.kind === 'adverb' && m.concept === 'yesterday')
  ) {
    return pick(entry.habitual, 'round trip in the past');
  }
  if (s.polarity === 'negative' || duration) {
    return entry;
  }
  // "opened the door and saw a cat": a chain of completed past actions
  if (
    s.subject?.implicit &&
    s.tense === 'past' &&
    ctx.discourse?.lastAspect === 'perf'
  ) {
    return pick(
      entry.perfective,
      'next action in a sequence of completed actions'
    );
  }
  if (entry.prefer === 'impf') {
    return entry;
  }
  const classes = ctx.lexicon.get(ctx.predicate)?.classes || [];
  const activity = [
    'communication',
    'perception',
    'consumption',
    'art',
    'activity',
  ].some((c) => classes.includes(c));
  if (
    !specific &&
    !entry.motion &&
    !entry.subjectConcept &&
    (entry.perfective.lemma.startsWith('по') || activity)
  ) {
    return entry;
  }
  const why =
    role === 'infinitive'
      ? 'one completed action'
      : s.tense === 'future'
        ? 'single future action'
        : 'completed action';
  return pick(entry.perfective, why);
}

/** "for ten years", "since May": a state that still lasts. */
function lasting(s) {
  return (s.modifiers || []).some(
    (m) =>
      m.kind === 'relation' && ['rel.for', 'rel.since'].includes(m.relation)
  );
}

/** Conjugate the predicate verb (handles future of imperfectives). */
function finiteVerb(variant, s, f, _ctx) {
  // "I have sent" is done: past; "have lived here for ten years": живём
  const tense =
    s.tense === 'future'
      ? 'future'
      : s.tense === 'past' || (s.aspect === 'perfect' && !lasting(s))
        ? 'past'
        : 'present';
  return conjugate(variant, {
    tense,
    person: f.person,
    number: f.number,
    gender: f.number === 'pl' ? undefined : f.gender,
  });
}

/** Object case(s) of a verb entry. */
export function renderObjects(objects, entry, ctx, skip = new Set()) {
  const out = [];
  const gov = entry?.government || { preposition: null, case: 'acc' };
  objects.forEach((o, i) => {
    if (skip.has(o) || (ctx.suppressRelative && o.relativePronoun)) {
      return;
    }
    const concept = lexEntry(ctx, o.concept);
    if (
      concept?.classes.includes('language') &&
      concept.ru?.adverb &&
      ['speak', 'say'].includes(ctx.predicate)
    ) {
      out.push(concept.ru.adverb);
      return;
    }
    const recipient = objects.length > 1 && i === 0;
    if (recipient) {
      out.push(renderEntity(o, entry?.recipient || 'dat', ctx));
      return;
    }
    out.push(governed(o, governmentFor(entry, o, gov, ctx), ctx));
  });
  return out;
}

/** Government for an object, honouring its English preposition. */
function governmentFor(entry, o, fallback, ctx) {
  if (o?.marker && entry?.markerGovernment?.[o.marker]) {
    return withPartner(entry.markerGovernment[o.marker], o.marker, o, ctx);
  }
  const person =
    ctx && (isPerson(o, ctx) || ctx.lexicon.givenNames?.has(o?.name));
  const classes = ctx
    ? [
        ...(o?.concept ? lexEntry(ctx, o.concept)?.classes || [] : []),
        // "pay the fee": a common thing, not a receiver
        ...(person ? ['person'] : o?.concept && !o.name ? ['thing'] : []),
      ]
    : [];
  const byClass = classes.find((c) => entry?.classGovernment?.[c]);
  return byClass ? entry.classGovernment[byClass] : fallback;
}

function governed(o, gov, ctx) {
  const kase =
    ctx.negativeGenitive && gov.case === 'acc' && !gov.preposition
      ? 'acc'
      : gov.case;
  if (gov.preposition) {
    return renderRelationWith(gov.preposition, kase, o, ctx);
  }
  return renderEntity(o, kase, ctx);
}

function renderRelationWith(prep, kase, o, ctx) {
  const np = renderEntity(o, kase, {
    ...ctx,
    afterPrep: true,
    locative: false,
  });
  const first = np.split(' ')[0];
  return `${euphonyLocal(prep, first)} ${np}`;
}

function euphonyLocal(prep, word) {
  if (prep === 'о' && /^[аиоуэ]/i.test(word)) {
    return 'об';
  }
  if (prep === 'о' && /^(мне|всём)$/.test(word)) {
    return 'обо';
  }
  if (prep === 'в' && /^(вс|вт|мн)/.test(word)) {
    return 'во';
  }
  if (
    prep === 'с' &&
    (/^(мн|вс)/.test(word) || /^[сзшж][^аеёиоуыэюя]/.test(word))
  ) {
    return 'со';
  }
  return prep;
}

/** Render modifiers, split into those before and after the verb. */
export function renderModifiers(mods, ctx, entry) {
  const before = [];
  const after = [];
  let negative = false;
  for (const m of mods || []) {
    if (m.kind === 'adverb') {
      const adv = periodicAdverb(lexEntry(ctx, m.concept), ctx.lexicon);
      if (!adv) {
        ctx.notes.add(`no Russian adverb for ${m.concept}`);
        continue;
      }
      if (adv.negative) {
        negative = true;
      }
      let word = m.comparison ? degreeForm(adv, m.comparison, {}) : adv.lemma;
      if (ctx.motion && adv.direction) {
        word = adv.direction;
      }
      const preverbal = PREVERBAL.has(m.concept) || m.position === 'preverbal';
      (preverbal ? before : after).push(markParenthetic(word, adv));
    } else if (m.kind === 'quantity') {
      after.push(quantityWord(m.comparison));
    } else if (m.kind === 'comparison') {
      const word = m.equal ? 'как' : 'чем';
      after.push(`, ${word} ${renderEntity(m.entity, 'nom', ctx)}`);
    } else if (m.kind === 'role') {
      after.push(`как ${renderEntity(m.entity, 'nom', ctx)}`);
    } else if (m.kind === 'time') {
      const e = m.entity;
      const head = lexEntry(ctx, e.concept)?.ru;
      const lastNext = (e.properties || []).find((p) =>
        ['last', 'last.previous', 'next'].includes(p.concept)
      );
      const weekday = lexEntry(ctx, e.concept)?.classes.includes('weekday');
      // next Friday → в следующую пятницу; next summer → следующим летом
      if (weekday && !e.determiner) {
        const np = renderEntity(e, 'acc', ctx);
        after.push(`${euphony('в', np)} ${np}`);
      } else if (lastNext && head?.when && !e.determiner) {
        after.push(renderEntity(e, 'ins', ctx));
      } else if (lastNext && head && !e.determiner) {
        const prep = head.at === 'на' ? 'на' : 'в';
        after.push(
          `${prep} ${renderEntity(e, 'prep', { ...ctx, afterPrep: true, locative: true })}`
        );
      } else {
        after.push(renderEntity(e, 'acc', ctx));
      }
    } else if (m.kind === 'relation') {
      const marker = m.relation?.replace(/^rel\./, '');
      if (
        entry?.markerGovernment?.[marker] &&
        !lexEntry(ctx, m.entity?.concept)?.classes?.includes('time') &&
        // "assumes about $20": an amount keeps the relation's own word
        !/^~?\p{Sc}?\d/u.test(m.entity?.name || '')
      ) {
        const gov = entry.markerGovernment[marker];
        after.push(
          governed(m.entity, withPartner(gov, marker, m.entity, ctx), ctx)
        );
        continue;
      }
      if (
        m.relation === 'rel.to' &&
        entry?.recipient &&
        isPerson(m.entity, ctx) &&
        !entry.motion
      ) {
        after.push(renderEntity(m.entity, entry.recipient, ctx));
        continue;
      }
      const learned = lexEntry(ctx, m.relation)?.ru;
      after.push(
        learned?.pos === 'prep'
          ? renderRelationWith(learned.lemma, learned.case, m.entity, ctx)
          : renderRelation(m, ctx)
      );
    } else if (m.kind === 'conj') {
      after.push({ and: 'и', or: 'или' }[m.conj]);
    }
  }
  return { before, after, negative };
}

function renderEvent(s, ctx) {
  const concept = lexEntry(ctx, s.predicate);
  let entry = concept?.ru;
  if (!entry || entry.pos !== 'verb') {
    ctx.notes.add(`no Russian verb for ${s.predicate}`);
    return `[${s.predicate}]`;
  }
  ctx.predicate = s.predicate;
  ctx.motion = entry.motion;
  ctx.hasObject = (s.objects || []).length > 0;
  ctx.passive = s.voice === 'passive';
  if (
    entry.intransitive &&
    !ctx.hasObject &&
    !s.complementClause &&
    !ctx.passive
  ) {
    entry = entry.intransitive;
  }
  // "like to read" → любить читать
  if (entry.transitive && (s.objects || []).length) {
    entry = entry.transitive;
  }
  if (entry.experiencer && s.complementClause) {
    entry = lexEntry(ctx, 'love').ru;
    ctx.notes.add('"like to" + verb rendered with любить');
  }
  const mods = renderModifiers(s.modifiers, ctx, entry);
  const negative = s.polarity === 'negative' || mods.negative;
  const words = [];
  const whWord = questionWord(s, ctx, entry);
  if (whWord) {
    words.push(whWord);
  }
  // weather verbs: "it rains" → идёт дождь
  if (entry.subjectConcept) {
    const noun = lexEntry(ctx, entry.subjectConcept).ru;
    const variant = chooseVerb(entry, s, ctx);
    const v = finiteVerb(
      variant,
      s,
      { person: 3, number: 'sg', gender: noun.gender },
      ctx
    );
    return [
      ...words,
      ...mods.before,
      negative ? 'не' : '',
      v,
      noun.lemma,
      ...mods.after,
    ]
      .filter(Boolean)
      .join(' ');
  }
  let subjectText;
  let agreement;
  let objects = s.objects || [];
  // "I need money" → мне нужны деньги; "I need to go" → мне нужно идти
  if (
    entry.datPredicate &&
    !s.modality &&
    s.question?.slot !== 'subject' &&
    (objects.length || s.complementClause)
  ) {
    const agree = s.complementClause
      ? { person: 3, number: 'sg', gender: 'n' }
      : { ...features(objects[0], ctx), person: 3 };
    words.push(
      renderEntity(s.subject, 'dat', ctx),
      ...mods.before,
      negative ? 'не' : '',
      copulaWord(s, agree),
      shortFrom({ short: entry.datPredicate }, agree)
    );
    words.push(
      ...(s.complementClause
        ? infinitiveClause(s.complementClause, s, ctx)
        : [
            objects[0].question && !objects[0].concept
              ? ''
              : renderEntity(objects[0], 'nom', { ...ctx, isSubject: true }),
            ...renderObjects(objects.slice(1), entry, ctx),
          ])
    );
    words.push(...mods.after);
    return words.filter(Boolean).join(' ');
  }
  if (entry.experiencer && objects.length) {
    subjectText =
      s.question?.slot === 'subject' ? '' : renderEntity(s.subject, 'dat', ctx);
    const theme = objects[0];
    agreement = features(theme, ctx);
    agreement.person = 3;
    words.push(subjectText);
    words.push(...mods.before);
    if (negative) {
      words.push('не');
    }
    words.push(verbGroup(entry, s, agreement, ctx));
    // the theme is the Russian subject: её работа, not своя работа
    words.push(renderEntity(theme, 'nom', { ...ctx, isSubject: true }));
    objects = objects.slice(1);
    words.push(...renderObjects(objects, entry, ctx), ...mods.after);
    return words.filter(Boolean).join(' ');
  }
  const agent = (s.modifiers || []).find((m) => m.relation === 'rel.by');
  if (s.voice === 'passive' && s.modality && agent?.entity) {
    // A named agent can be the subject of a Russian modal active clause.
    const active = { ...s, voice: undefined };
    const rest = renderModifiers(
      s.modifiers.filter((m) => m !== agent),
      ctx,
      entry
    );
    return [
      ...words,
      renderEntity(s.subject, 'acc', ctx),
      ...rest.before,
      negative ? 'не' : '',
      verbGroup(entry, active, features(agent.entity, ctx), ctx),
      renderEntity(agent.entity, 'nom', { ...ctx, isSubject: true }),
      ...renderObjects(objects, entry, ctx),
      ...rest.after,
    ]
      .filter(Boolean)
      .join(' ');
  }
  const passiveGovernment = governmentFor(
    entry,
    s.subject,
    entry.government || { case: 'acc' },
    ctx
  );
  const hasParticiple = entry.pastPassive || entry.perfective?.pastPassive;
  if (
    s.voice === 'passive' &&
    isPerson(s.subject, ctx) &&
    (passiveGovernment.case === 'dat' || !hasParticiple) &&
    !(s.modifiers || []).some((m) => m.relation === 'rel.by')
  ) {
    // A recipient passive is an indefinite personal clause: "вам платят".
    const active = { ...s, voice: undefined };
    return [
      ...words,
      governed(s.subject, passiveGovernment, ctx),
      ...mods.before,
      negative ? 'не' : '',
      verbGroup(entry, active, { person: 3, number: 'pl' }, ctx),
      ...renderObjects(objects, entry, ctx),
      ...mods.after,
    ]
      .filter(Boolean)
      .join(' ');
  }
  agreement = features(s.labelSubject || s.subject, ctx);
  if (s.question?.slot !== 'subject' || !whWord) {
    subjectText = s.subject?.implicit
      ? ''
      : renderEntity(s.subject, 'nom', { ...ctx, isSubject: true });
  }
  if (s.question?.slot === 'subject' && whWord) {
    agreement = { person: 3, number: 'sg', gender: 'm' };
  }
  const embeddedQuestion = s.link === 'conj.whether';
  if (!embeddedQuestion) {
    words.push(subjectText);
  }
  words.push(...mods.before);
  if (negative) {
    words.push('не');
  }
  const whObject =
    s.question && ['object'].includes(s.question.slot)
      ? objects.find((o) => o.question && !o.concept)
      : null;
  const finite = verbGroup(entry, s, agreement, ctx);
  words.push(embeddedQuestion ? finite.replace(/^(\S+)/, '$1 ли') : finite);
  if (embeddedQuestion) {
    words.push(subjectText);
  }
  const purpose = s.complementClause?.purpose;
  // "ask them to wait": the person asked comes before what they do
  const controlled = !purpose && objects.length > 0;
  if (s.complementClause && !purpose && !controlled) {
    words.push(...infinitiveClause(s.complementClause, s, ctx));
  }
  words.push(
    ...renderObjects(objects, entry, ctx, new Set(whObject ? [whObject] : []))
  );
  if (s.complementClause && controlled) {
    words.push(...infinitiveClause(s.complementClause, s, ctx));
  }
  words.push(...mods.after);
  if (purpose) {
    words.push(...purposeClause(s.complementClause, s, ctx));
  }
  return words.filter(Boolean).join(' ');
}

/** The finite verb, with modal and future auxiliaries. */
function verbGroup(entry, s, f, ctx) {
  // "would buy" → купил бы: the past tense with the conditional particle
  if (s.modality === 'modal.would') {
    const past = { ...s, modality: undefined, tense: 'past', aspect: 'simple' };
    const form = verbGroup(entry, past, f, ctx);
    // был бы опубликован: the particle follows the auxiliary
    return s.sharedModality ? form : form.replace(/^\S+/, '$& бы');
  }
  const role = s.modality ? 'infinitive' : 'finite';
  let variant = chooseVerb(
    entry,
    s.modality ? { ...s, tense: 'future', aspect: 'simple' } : s,
    ctx,
    role
  );
  // "we met" → мы встретились: no object, reciprocal reflexive
  if (
    entry.reflexiveIntransitive &&
    !(s.objects || []).length &&
    !s.complementClause
  ) {
    variant = { ...variant, lemma: `${variant.lemma}ся` };
  }
  if (s.voice === 'passive') {
    const passive = passiveGroup(entry, s, f, ctx);
    if (passive) {
      return passive;
    }
  }
  if (s.modality) {
    const inf = variant.lemma;
    return s.sharedModality ? inf : `${modalWord(s, f, ctx)} ${inf}`;
  }
  return finiteVerb(variant, s, f, ctx);
}

/** Short form of a past passive participle: опубликованный → опубликована. */
export function shortParticiple(long, f) {
  const base = long.replace(/ый$/, '').replace(/нн$/, 'н');
  if (base === long) {
    return null;
  }
  if (f.number === 'pl') {
    return `${base.replace(/ё(?=[^ё]*$)/, 'е')}ы`;
  }
  const ending = { m: '', f: 'а', n: 'о' }[f.gender || 'm'];
  return ending ? `${base.replace(/ё(?=[^ё]*$)/, 'е')}${ending}` : base;
}

/** Passive results use short participles; ongoing processes use reflexives. */
function passiveGroup(entry, s, f, ctx) {
  if (entry.lexicalHead) {
    return [
      passiveGroup(
        { ...entry.lexicalHead, perfective: entry.perfective?.lexicalHead },
        s,
        f,
        ctx
      ),
      entry.definitionTail,
    ]
      .filter(Boolean)
      .join(' ');
  }
  const perfective = entry.aspect === 'perf' ? entry : entry.perfective;
  // an agent or a repetition makes it a process: оплачивается покупателем
  const ongoing =
    (s.generic && s.tense === 'present') ||
    /progressive/.test(s.aspect || '') ||
    (s.tense === 'present' &&
      !/perfect/.test(s.aspect || '') &&
      (s.modifiers || []).some(
        (m) =>
          (m.kind === 'adverb' && habitualAdverb(m.concept, ctx)) ||
          (m.kind === 'relation' && m.relation === 'rel.by')
      ));
  const participle =
    !ongoing && perfective?.pastPassive
      ? shortParticiple(perfective.pastPassive, f)
      : null;
  if (participle) {
    if (s.modality) {
      return `${modalWord(s, f, ctx)} быть ${participle}`;
    }
    return [copulaWord(s, f), participle].filter(Boolean).join(' ');
  }
  const imperfective = entry.aspect === 'perf' ? null : entry;
  if (!imperfective || /с[яь]$/.test(imperfective.lemma)) {
    return null;
  }
  const form = s.modality
    ? `${modalWord(s, f, ctx)} ${imperfective.lemma}`
    : finiteVerb(imperfective, { ...s, tense: s.tense }, f, ctx);
  return form.replace(
    /(\S+)$/,
    (w) => w + (/[аеёиоуыэюя]$/.test(w) ? 'сь' : 'ся')
  );
}

export function modalWord(s, f) {
  const tense =
    s.tense === 'past' ? 'past' : s.tense === 'future' ? 'future' : 'present';
  const gender = f.number === 'pl' ? undefined : f.gender;
  switch (s.modality) {
    case 'modal.can':
    case 'modal.may': {
      const moch = {
        lemma: 'мочь',
        present: ['могу', 'можешь', 'может', 'можем', 'можете', 'могут'],
        past: ['мог', 'могла'],
      };
      return conjugate(moch, {
        tense: tense === 'future' ? 'present' : tense,
        person: f.person,
        number: f.number,
        gender,
      });
    }
    case 'modal.must':
    case 'modal.should': {
      const short =
        f.number === 'pl'
          ? 'должны'
          : { m: 'должен', f: 'должна', n: 'должно' }[f.gender || 'm'];
      if (tense === 'past') {
        return `${short} ${f.number === 'pl' ? 'были' : BYT_PAST[f.gender || 'm']}`;
      }
      return short;
    }
    default:
      return '';
  }
}

/** The fronted question word of a wh-question, already in its case. */
function questionWord(s, ctx, entry) {
  if (!s.question) {
    return '';
  }
  const q = s.question.concept;
  if (QUESTION_ADVERBS[q]) {
    const adv = QUESTION_ADVERBS[q];
    return ctx.motion && adv.to ? adv.to : adv.at;
  }
  if (s.question.slot === 'subject') {
    if (s.subject?.concept) {
      return '';
    }
    return PRONOUN_WORDS[q]?.[0] || '';
  }
  if (s.question.slot === 'object') {
    const o = (s.objects || []).find((x) => x.question);
    if (!o) {
      return '';
    }
    if (o.concept) {
      return governed(
        o,
        governmentFor(entry, o, entry?.government || { case: 'acc' }, ctx),
        ctx
      );
    }
    const gov = governmentFor(
      entry,
      o,
      entry?.government || { preposition: null, case: 'acc' },
      ctx
    );
    if (entry?.experiencer || (entry?.datPredicate && !s.modality)) {
      return PRONOUN_WORDS[q][0];
    }
    const kase = gov.case;
    const word =
      PRONOUN_WORDS[q][
        ['nom', 'gen', 'dat', 'acc', 'ins', 'prep'].indexOf(kase)
      ];
    return gov.preposition
      ? `${euphonyLocal(gov.preposition, word)} ${word}`
      : word;
  }
  return '';
}

function renderImperative(s, ctx) {
  const entry = lexEntry(ctx, s.predicate)?.ru;
  if (!entry || entry.pos !== 'verb') {
    ctx.notes.add(`no Russian verb for ${s.predicate}`);
    return `[${s.predicate}]`;
  }
  ctx.predicate = s.predicate;
  ctx.motion = entry.motion;
  ctx.hasObject = (s.objects || []).length > 0;
  ctx.passive = s.voice === 'passive';
  const mods = renderModifiers(s.modifiers, ctx, entry);
  const words = [];
  if (s.politeness === 'polite') {
    words.push('пожалуйста,');
  }
  if (s.inclusive) {
    const variant = chooseVerb(
      entry,
      { ...s, tense: 'future' },
      ctx,
      'imperative'
    );
    words.push('давайте');
    words.push(
      variant.aspect === 'perf'
        ? conjugate(variant, { tense: 'future', person: 1, number: 'pl' })
        : variant.lemma
    );
  } else {
    const variant = chooseVerb(entry, s, ctx, 'imperative');
    if (s.polarity === 'negative') {
      words.push('не');
    }
    const plural = ctx.options.you !== 'ty';
    words.push(
      conjugate(variant, { mood: 'imperative', number: plural ? 'pl' : 'sg' })
    );
    ctx.notes.add(`imperative addressed with ${plural ? 'вы' : 'ты'}`);
  }
  words.push(...mods.before);
  const purpose = s.complementClause?.purpose;
  const controlled = !purpose && (s.objects || []).length > 0;
  if (s.complementClause && !purpose && !controlled) {
    words.push(...infinitiveClause(s.complementClause, s, ctx));
  }
  words.push(...renderObjects(s.objects || [], entry, ctx));
  if (s.complementClause && controlled) {
    words.push(...infinitiveClause(s.complementClause, s, ctx));
  }
  words.push(...mods.after);
  if (purpose) {
    words.push(...purposeClause(s.complementClause, s, ctx));
  }
  return words.filter(Boolean).join(' ').replace(/,$/, '');
}
