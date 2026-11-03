/** Bind English relative gaps and place their Russian phrases before the subject. */
import { renderEntity } from './phrase.mjs';

export function bindRelative(value, antecedent) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (value.relativePronoun) {
    return { ...value, antecedent };
  }
  if (Array.isArray(value)) {
    return value.map((v) => bindRelative(v, antecedent));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key, bindRelative(v, antecedent)])
  );
}

export function frontRelative(s, ctx, renderObjects) {
  const gaps = ctx.relativeGaps;
  const entry = ctx.lexicon.get(s.predicate)?.ru;
  const inner = { ...ctx, relativeGaps: null };
  const prefix =
    entry?.datPredicate || entry?.experiencer
      ? gaps.map((o) => renderEntity(o, 'nom', inner))
      : renderObjects(gaps, entry, inner);
  return [
    ...prefix,
    ctx.renderStatement(s, { ...inner, suppressRelative: true }),
  ]
    .filter(Boolean)
    .join(' ');
}
