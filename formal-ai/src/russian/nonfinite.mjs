/**
 * Non-finite Russian forms: infinitive and purpose clauses, actions used as
 * entities and long passive participles.
 */

import { declineNoun, declineAdjective } from './morphology.mjs';
import { regularEntry } from '../russian-entry.mjs';
import { actionNounEntry } from './phrase.mjs';
import {
  chooseVerb,
  lexEntry,
  renderModifiers,
  renderObjects,
} from './naturalize.mjs';

/** Actions used as entities have no tense and default to an activity infinitive. */
export function renderAction(e, kase, ctx) {
  if (ctx.adverbialAction) {
    return infinitiveClause(
      e.action,
      { nominalAction: true, adverbial: true },
      ctx
    ).join(' ');
  }
  const governor = lexEntry(ctx, ctx.predicate)?.ru;
  const infinitive =
    !ctx.afterPrep && (governor?.infinitiveComplement || governor?.experiencer);
  const noun = actionNounEntry(e, ctx);
  if (noun && !infinitive && !e.action.complementClause) {
    const verb = lexEntry(ctx, e.action.predicate)?.ru;
    const mods = renderModifiers(e.action.modifiers, { ...ctx }, verb);
    // "manual invoicing" → ручное выставление счёта
    const adjectives = (e.properties || []).map((p) => {
      const adj = lexEntry(ctx, p.concept)?.ru;
      return adj?.pos === 'adj'
        ? declineAdjective(adj.lemma, {
            case: kase,
            number: 'sg',
            gender: noun.gender || 'n',
          })
        : `[${p.concept}]`;
    });
    const tail = noun.tail && regularEntry('noun', { word: noun.tail });
    return [
      ...mods.before,
      ...adjectives,
      declineNoun(noun, kase),
      tail ? declineNoun(tail, 'gen') : noun.tail,
      ...renderObjects(
        e.action.objects || [],
        {
          ...verb,
          classGovernment: undefined,
          government:
            verb?.government?.preposition ||
            (verb?.government && verb.government.case !== 'acc')
              ? verb.government
              : { case: 'gen' },
        },
        { ...ctx, afterPrep: false, predicate: e.action.predicate }
      ),
      ...mods.after,
    ]
      .filter(Boolean)
      .join(' ');
  }
  for (const p of e.properties || []) {
    ctx.notes.add(`no Russian action noun to describe as ${p.concept}`);
  }
  const text = infinitiveClause(
    e.action,
    { nominalAction: true, polarity: 'positive' },
    { ...ctx }
  ).join(' ');
  if (ctx.afterPrep) {
    const demonstrative = {
      gen: 'того',
      dat: 'тому',
      acc: 'то',
      ins: 'тем',
      prep: 'том',
    };
    return `${demonstrative[kase] || 'то'}, чтобы ${text}`;
  }
  return text;
}

/** Long passive participles share the noun's case, number and gender. */
// a past passive participle is normally perfective: введённый, not
// the rare imperfective ввожённый
export const passiveOf = (entry) =>
  entry?.perfective?.pastPassive ||
  (entry?.aspect !== 'impf' || !entry?.perfective
    ? entry?.pastPassive
    : null) ||
  entry?.transitive?.perfective?.pastPassive ||
  regularPastPassive(entry?.perfective?.lemma || entry?.lemma);

/**
 * The past passive participle of a perfective -ать/-ять/-овать verb is
 * regular (заказать → заказанный, сформировать → сформированный); other
 * classes alternate consonants and need the dictionary.
 */
function regularPastPassive(lemma = '') {
  const m = /^(.*(?:а|я))ть$/.exec(lemma);
  return m && !/ся$/.test(lemma) ? `${m[1]}нный` : null;
}

export function renderParticiple(p, agree, ctx) {
  const concept = lexEntry(ctx, p.predicate || p.concept);
  let entry = concept?.ru;
  let form = passiveOf(entry);
  if (!form) {
    // a passive participle needs a transitive sense: "a bank account
    // entered at withdrawal time" is введённый, not the sense «войти»
    const lemma = concept?.en?.[0]?.lemma;
    const other = (lemma ? ctx.lexicon.lookup('verb', lemma) : [])
      .map((id) => lexEntry(ctx, id)?.ru)
      .find((ru) => ru?.pos === 'verb' && passiveOf(ru));
    entry = other || entry;
    form = passiveOf(other);
  }
  if (!form) {
    if (
      entry?.pos === 'verb' &&
      ctx.renderStatement &&
      ctx.participleAntecedent
    ) {
      // A missing dictionary participle does not preclude an ordinary finite
      // relative: "products restricted" → "продукты, которые ограничивают".
      // Reuse object government, including dative recipients ("которым платят").
      const gap = {
        relativePronoun: true,
        antecedent: ctx.participleAntecedent,
        concept: ctx.participleAntecedent.concept,
      };
      const agent = (p.modifiers || []).find((m) => m.relation === 'rel.by');
      return ctx.renderStatement(
        {
          predicate: p.predicate || p.concept,
          frame: 'event',
          mood: 'declarative',
          tense: entry.aspect === 'perf' ? 'past' : 'present',
          aspect: 'simple',
          polarity: 'positive',
          subject: agent?.entity || {
            pronoun: { person: 3, number: 'plural' },
            implicit: true,
          },
          objects: [gap, ...(p.objects || [])],
          modifiers: (p.modifiers || []).filter((m) => m !== agent),
          complementClause: p.complementClause,
        },
        { ...ctx, afterPrep: false, relativeGaps: [gap], passive: false }
      );
    }
    ctx.notes.add(`no Russian participle for ${p.predicate || p.concept}`);
    return `[${p.predicate || p.concept}]`;
  }
  const mods = renderModifiers(p.modifiers, { ...ctx, passive: true }, entry);
  return [...mods.before, declineAdjective(form, agree), ...mods.after]
    .filter(Boolean)
    .join(' ');
}

/** "build ratings to get offers": «…, чтобы получить предложения». */
export function purposeClause(x, parent, ctx) {
  // the goal is one event, whatever the tense of the main clause
  const words = infinitiveClause(x, { ...parent, polarity: 'positive' }, ctx);
  return [',', 'чтобы', ...words];
}

/** "want to read the book" → прочитать книгу. */
export function infinitiveClause(x, parent, ctx) {
  const concept = lexEntry(ctx, x.predicate);
  const entry = concept?.ru;
  if (!entry || entry.pos !== 'verb') {
    ctx.notes.add(`no Russian verb for ${x.predicate}`);
    return [`[${x.predicate}]`];
  }
  if (x.voice === 'passive' && x.subject) {
    return [
      ',',
      'чтобы',
      ctx.renderStatement(
        {
          ...x,
          mood: 'declarative',
          tense: 'past',
          aspect: 'simple',
          polarity: 'positive',
        },
        { ...ctx }
      ),
    ];
  }
  const parentEntry = lexEntry(ctx, parent.predicate)?.ru;
  const aspectual = lexEntry(ctx, parent.predicate)?.classes.includes(
    'aspectual'
  );
  const pseudo = {
    ...x,
    polarity: parent.polarity,
    tense: 'future',
    aspect: 'simple',
    modifiers: x.modifiers,
  };
  const savedPredicate = ctx.predicate;
  ctx.predicate = x.predicate;
  const variant = x.russianAspect
    ? x.russianAspect === 'perf'
      ? entry.perfective || entry
      : entry
    : aspectual || parent.nominalAction || x.purpose
      ? entry
      : parent.mood === 'imperative' && parent.polarity !== 'negative'
        ? entry.perfective || entry
        : chooseVerb(entry, pseudo, ctx, 'infinitive');
  const saved = {
    predicate: savedPredicate,
    motion: ctx.motion,
    hasObject: ctx.hasObject,
  };
  ctx.predicate = x.predicate;
  ctx.motion = entry.motion;
  ctx.hasObject = (x.objects || []).length > 0;
  const mods = renderModifiers(x.modifiers, ctx, entry);
  const out = [
    ...mods.before,
    parent.adverbial
      ? variant.converb ||
        (variant.aspect === 'impf' && /[ая]ть$/.test(variant.lemma)
          ? variant.lemma.replace(/ть$/, 'я')
          : `тем, чтобы ${variant.lemma}`)
      : variant.lemma,
    ...renderObjects(x.objects || [], entry, ctx),
    ...mods.after,
  ];
  if (x.complementClause) {
    out.push(
      ...infinitiveClause(
        x.complementClause,
        { ...parent, predicate: x.predicate },
        ctx
      )
    );
  }
  Object.assign(ctx, saved);
  void parentEntry;
  return out;
}
