/** Render nominal fragments and parallel fact labels. */
import { renderEntity, features } from './phrase.mjs';
import { shortFrom } from './copula.mjs';

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
    text += `${s.valueSeparator || ''} ${value}`;
  }
  return text;
}
