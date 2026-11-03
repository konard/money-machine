/**
 * Non-finite Russian forms: infinitive and purpose clauses, actions used as
 * entities and long passive participles.
 */

import { declineAdjective } from './morphology.mjs';
import { renderEntity, nounEntry } from './phrase.mjs';
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
  if (e.nominalization && nounEntry(e.nominalization, ctx)) {
    return renderEntity(e.nominalization, kase, ctx);
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
const passiveOf = (entry) =>
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
  const variant =
    aspectual || parent.nominalAction || x.purpose
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
