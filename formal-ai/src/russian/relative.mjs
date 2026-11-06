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

/** "бот, который обобщает каналы или управляет играми,": a relative clause. */
export function renderRelative(e, kase, ctx) {
  const { relative, ...antecedent } = e;
  const head = renderEntity(antecedent, kase, ctx);
  const bound = bindRelative(relative, antecedent);
  const gaps = (bound.objects || []).filter((o) => o.relativePronoun);
  // Russian puts the relative phrase first, including governed prepositions.
  const inner = { ...ctx, afterPrep: false };
  const series = [
    ctx.renderStatement(bound, { ...inner, relativeGaps: gaps }),
    ...(relative.coordinated || []).map((s) =>
      ctx.renderStatement(bindRelative({ ...s, link: null }, antecedent), inner)
    ),
  ];
  const word = relative.coordinated?.at(-1).link === 'conj.or' ? 'или' : 'и';
  const text =
    series.length > 1
      ? `${series.slice(0, -1).join(', ')} ${word} ${series.at(-1)}`
      : series[0];
  // the closing comma is dropped before sentence punctuation later
  return `${head}, ${text},`;
}
