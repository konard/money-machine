/** Parallel label/value items, distinguished by syntax rather than vocabulary. */
import { Cursor, parseNP, has, head, reading } from './parser.mjs';
import { countAhead } from './quantity.mjs';

function nominal(tokens, ctx) {
  if (
    tokens.length === 1 &&
    has(tokens[0], 'adj') &&
    !reading(tokens[0], 'noun')?.concepts.some(
      (id) => ctx.lexicon?.get(id)?.ru?.animate
    )
  ) {
    return { property: head(tokens[0], reading(tokens[0], 'adj')) };
  }
  const c = new Cursor(tokens);
  c.grammar = ctx;
  const np = parseNP(c, { fragment: true, relative: false, nominal: true });
  if (np && c.done) {
    return { np };
  }
  if (tokens.length === 1) {
    const t = tokens[0];
    if (has(t, 'adj')) {
      return { property: head(t, reading(t, 'adj')) };
    }
    if (has(t, 'adv')) {
      return { mods: [{ type: 'adv', ...head(t, reading(t, 'adv')) }] };
    }
  }
  return null;
}

/** "$0 weekly": an amount, with a closing adverb of how often or how. */
function measured(tokens, ctx) {
  const whole = nominal(tokens, ctx);
  const last = tokens.at(-1);
  // "$0 weekly" is not a kind of "weekly" named "$0"
  const amount = (np) => np && (np.quantity !== undefined || np.name);
  if (amount(whole?.np) || tokens.length < 2 || !has(last, 'adv')) {
    return whole;
  }
  const shorter = nominal(tokens.slice(0, -1), ctx);
  return amount(shorter?.np)
    ? {
        ...shorter,
        mods: [{ type: 'adv', ...head(last, reading(last, 'adv')) }],
      }
    : whole;
}

function fact(tokens, ctx) {
  const colon = tokens.findIndex((t) => t.text === ':');
  if (colon > 0) {
    const label = nominal(tokens.slice(0, colon), ctx);
    let value = tokens.slice(colon + 1);
    const focus =
      value.at(-1)?.lower === 'only'
        ? head(value.at(-1), reading(value.at(-1), 'adv'))
        : undefined;
    if (focus) {
      value = value.slice(0, -1);
    }
    if (!label || !value.length) {
      return null;
    }
    const participle = label.np?.participles?.[0];
    const token =
      participle && tokens.find((t) => t.index === participle.verb.token);
    // With no agent or event adjunct, an attested adjective states a label's
    // property; it does not report a completed demand or other past event.
    if (
      label.np?.participles?.length === 1 &&
      has(token, 'adj') &&
      !participle.objects.length &&
      !participle.mods.length &&
      !participle.xcomp
    ) {
      label.labelProperty = head(token, reading(token, 'adj'));
      delete label.np.participles;
    }
    const answer =
      value.length === 1 && ['yes', 'no'].includes(value[0].lower)
        ? value[0].lower
        : undefined;
    if (
      !answer &&
      value.length > 1 &&
      !countAhead(value[0]) &&
      !countAhead(value[1]) &&
      !focus &&
      !value.some((t) => has(t, 'coord') || t.text === ',')
    ) {
      return null;
    }
    const parsed = answer ? {} : nominal(value, ctx);
    return (
      parsed &&
      (answer || parsed.np) && {
        type: 'fragment',
        ...label,
        factValue: parsed.np,
        factFocus: focus,
        answer,
        valueSeparator: ':',
      }
    );
  }
  // Split before a measured value, including its approximation operator.
  for (let k = 1; k < tokens.length; k += 1) {
    if (!countAhead(tokens[k]) && !countAhead(tokens[k + 1])) {
      continue;
    }
    const label = nominal(tokens.slice(0, k), ctx);
    const value = measured(tokens.slice(k), ctx);
    if (
      label &&
      value?.np &&
      (value.np.quantity !== undefined || value.np.name)
    ) {
      return {
        type: 'fragment',
        ...label,
        factValue: value.np,
        ...(value.mods ? { mods: [...(label.mods || []), ...value.mods] } : {}),
      };
    }
  }
  // A duration without a label is parallel to the labelled amounts.
  const value = nominal(tokens, ctx);
  return value?.np?.bound && { type: 'fragment', ...value };
}

export function parseFactList(tokens, ctx) {
  if (tokens.filter((t) => t.text === ':').length === 1) {
    const whole = fact(tokens, ctx);
    if (whole?.factValue) {
      return { list: [whole], leftover: [] };
    }
  }
  const items = [[]];
  for (const t of tokens) {
    if (t.text === ',') {
      items.push([]);
    } else {
      items.at(-1).push(t);
    }
  }
  const list = items.map((item) => fact(item, ctx));
  if (
    list.some((item) => !item) ||
    (list.length === 1 && !list[0].valueSeparator)
  ) {
    return null;
  }
  list.forEach((item, i) => {
    if (i) {
      item.link = { separator: ',' };
    }
  });
  return { list, leftover: [] };
}

/** Answer particles are grammar even without a dictionary verb/interjection. */
export function unknownFactWords(unknown, clauses) {
  const answers = new Set(clauses.map((c) => c.answer).filter(Boolean));
  return unknown.filter((word) => !answers.has(word.toLowerCase()));
}

/** "Per platform: Etsy $0, Gumroad $100": a heading, then labelled amounts. */
export function labelledFacts(tokens, ctx, parseClauses) {
  const colon = tokens.findIndex((t) => t.text === ':');
  if (colon < 1 || tokens.slice(colon + 1).some((t) => t.text === ':')) {
    return null;
  }
  const rest = tokens.slice(colon + 1);
  const listed = parseFactList(rest, ctx);
  const facts = listed?.list.every((item) => item.factValue)
    ? listed
    : parseClauses(rest, ctx);
  if (facts.leftover.length || !facts.list.some((item) => item.factValue)) {
    return null;
  }
  const heading = parseClauses(tokens.slice(0, colon), {
    ...ctx,
    fragments: true,
  });
  if (heading.leftover.length || !heading.list.length) {
    return null;
  }
  facts.list[0].link = { separator: ':' };
  return { list: [...heading.list, ...facts.list], leftover: [] };
}
