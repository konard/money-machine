/** Render nominal fragments and parallel fact labels. */
import { renderEntity, features } from './phrase.mjs';
import { shortFrom } from './copula.mjs';
import { shortParticiple } from './passive.mjs';
import { declineAdjective } from './morphology.mjs';

export function renderFragment(s, ctx, renderModifiers) {
  // a heading or list item: the noun phrase and its modifiers
  const all = s.modifiers || [];
  const mods = renderModifiers(
    all.filter((m) => m.position !== 'front'),
    ctx,
    null
  );
  // "e.g. eBay" → например eBay: a fronted adverb stays in front
  const front = renderModifiers(
    all.filter((m) => m.position === 'front'),
    ctx,
    null
  );
  // "Etsy $0 weekly" → Etsy $0 еженедельно: the value's own adverb follows it
  const ofValue = s.factValue ? [...mods.before, ...mods.after] : [];
  if (s.factValue) {
    mods.before = [];
    mods.after = [];
  }
  mods.before = [...front.before, ...front.after, ...mods.before];
  const absent = s.entity?.determiner === 'det.no';
  const propertyConcept = s.property && ctx.lexicon.get(s.property.concept);
  const property = propertyConcept?.ru;
  const periodic =
    s.factValue &&
    !s.valueSeparator &&
    /\b(?:each|every|once an?)\b/.test(propertyConcept?.gloss || '');
  const entity = absent ? { ...s.entity, determiner: undefined } : s.entity;
  let text = [
    ...mods.before,
    s.negative ? 'не' : '',
    property
      ? // "… (optional)" → (необязательно): a remark on the clause
        s.negative ||
        periodic ||
        (s.separator === '(' && !s.entity && property.shortForms?.n)
        ? shortFrom(property, { gender: 'n' })
        : property.lemma
      : '',
    absent
      ? `без ${renderEntity(entity, 'gen', ctx)}`
      : renderEntity(entity, 'nom', ctx),
    ...mods.after,
  ]
    .filter(Boolean)
    .join(' ');
  if (s.factProperty) {
    // "Confidence: high" → Уверенность: высокая; "…: estimated" → оценена
    const value = factPropertyWord(s.factProperty, features(entity, ctx), ctx);
    if (value) {
      return `${text}${s.valueSeparator || ':'} ${value}`;
    }
  }
  if (s.answer || s.factValue) {
    if (s.labelProperty) {
      const adjective = ctx.lexicon.get(s.labelProperty.concept)?.ru;
      text = `${renderEntity(entity, 'nom', ctx)} ${shortFrom(adjective, features(entity, ctx))}`;
    }
    if (s.entity?.participles?.length === 1) {
      const { participles, ...subject } = s.entity;
      text = ctx.renderStatement(
        {
          ...participles[0],
          subject,
          mood: 'declarative',
          frame: 'event',
          voice: 'passive',
          tense: 'present',
          aspect: 'perfect',
          polarity: 'positive',
        },
        ctx
      );
    }
    const value = s.answer
      ? { yes: 'да', no: 'нет' }[s.answer]
      : renderEntity(s.factValue, 'nom', ctx);
    const focus =
      s.factFocus && ctx.lexicon.get(s.factFocus.concept)?.ru?.lemma;
    text += `${s.valueSeparator || ''} ${focus ? `${focus} ` : ''}${[value, ...ofValue].join(' ')}`;
  }
  return text;
}

/** A label's value agrees with the label: высокая, оценена. */
function factPropertyWord(p, agree, ctx) {
  const ru = ctx.lexicon.get(p.concept)?.ru;
  if (p.participle) {
    const perfective = ru?.aspect === 'perf' ? ru : ru?.perfective;
    return perfective?.pastPassive
      ? shortParticiple(perfective.pastPassive, agree)
      : ctx.renderParticiple?.(p, agree, ctx) || null;
  }
  return ru?.pos === 'adj' ? declineAdjective(ru.lemma, agree) : null;
}
