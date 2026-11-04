/** Statistical and positional evidence over the same dictionary domain types. */
import { analyze } from './english/analyze.mjs';
import { parseSentence } from './english/clause.mjs';
import { methodWeight } from './methods.mjs';

const CONTENT = new Set(['noun', 'verb', 'adj', 'adv', 'propn']);

/** A sense cannot provide its own statistical corroboration. */
export function sentenceContext(tokens, lexicon, memory, excluding) {
  const words = tokens
    .filter((t) => t.index !== excluding)
    .map((t) => ({
      candidates: (t.readings || [])
        .filter((r) => CONTENT.has(r.pos))
        .flatMap((r) => r.concepts || []),
    }));
  return (
    rankContexts(words, lexicon)[0] ||
    memory.contextRanking?.find((r) => r.count > 1)
  );
}

/** Parse first so an impossible part of speech cannot make a branch coherent. */
export function contextHeads(text, lexicon) {
  const out = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    if (value.candidates?.length) {
      out.push({ token: value.token, candidates: value.candidates });
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'candidates') {
        visit(child);
      }
    }
  };
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    visit(parseSentence(sentence, lexicon).clauses);
  }
  return out;
}

export function contextWords(text, lexicon) {
  return analyze(text, lexicon).flatMap((token) => {
    const ids = new Set(
      (token.readings || [])
        .filter((r) => CONTENT.has(r.pos))
        .flatMap((r) => r.concepts || [])
    );
    return ids.size ? [{ token: token.index, candidates: [...ids] }] : [];
  });
}

/** Each content token votes once per context, regardless of sense count. */
export function rankContexts(words, lexicon, { coherent = false } = {}) {
  const network = lexicon.contextNetwork;
  if (!network) {
    return [];
  }
  const counts = new Map();
  const choices = words.map(({ candidates }) =>
    candidates.map((id) => network.contextsOf(lexicon.get(id)))
  );
  for (const senses of choices) {
    for (const context of new Set(senses.flatMap((s) => [...s]))) {
      counts.set(context, (counts.get(context) || 0) + 1);
    }
  }
  return [...counts]
    .filter(
      ([context]) =>
        !coherent ||
        choices.every((senses) => senses.some((s) => !s.size || s.has(context)))
    )
    .map(([context, count]) => ({
      context,
      count,
      depth: network.depth(context),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.depth - a.depth ||
        a.context.localeCompare(b.context)
    );
}

function pathTo(root, target, path = []) {
  if (root === target) {
    return path;
  }
  if (!root || typeof root !== 'object') {
    return null;
  }
  for (const [key, value] of Object.entries(root)) {
    if (key === 'candidates') {
      continue;
    }
    const found = pathTo(value, target, [...path, root]);
    if (found) {
      return found;
    }
  }
  return null;
}

/** Only a word whose EVERY meaning identifies one compatible field can vote. */
export function positionalContext(node, heads, clause, lexicon) {
  const network = lexicon.contextNetwork;
  if (!network) {
    return;
  }
  const target = pathTo(clause, node) || [];
  const indicators = [];
  for (const { node: other } of heads) {
    if (other === node || other.token === node.token) {
      continue;
    }
    const senses = other.candidates.map((id) =>
      network.contextsOf(lexicon.get(id))
    );
    if (!senses.length || senses.some((s) => !s.size)) {
      continue;
    }
    const common = [...senses[0]].filter((c) => senses.every((s) => s.has(c)));
    const specific = common.filter(
      (c) =>
        !common.some((d) => d !== c && network.isA(d, c) && !network.isA(c, d))
    );
    if (specific.length !== 1) {
      continue;
    }
    if (
      !node.candidates.some((id) =>
        network.contextsOf(lexicon.get(id)).has(specific[0])
      )
    ) {
      continue;
    }
    const path = pathTo(clause, other) || [];
    let shared = 0;
    while (
      shared < Math.min(path.length, target.length) &&
      path[shared] === target[shared]
    ) {
      shared += 1;
    }
    // Same noun phrase, or a predicate and its direct argument.
    const partner =
      shared > 1 ||
      ((node.pos === 'verb' || other.pos === 'verb') &&
        path.length + target.length - 2 * shared <= 3);
    indicators.push({
      context: specific[0],
      partner,
      distance: Math.abs(other.token - node.token),
      token: other.token,
    });
  }
  indicators.sort(
    (a, b) =>
      Number(b.partner) - Number(a.partner) ||
      a.distance - b.distance ||
      a.token - b.token
  );
  return indicators[0];
}

export function contextEvidence(
  concept,
  lexicon,
  memory,
  statistical,
  positional
) {
  const network = lexicon.contextNetwork;
  if (!network) {
    return [];
  }
  const contexts = network.contextsOf(concept);
  const evidence = [];
  const add = (name, context, amount) => {
    if (!context || !contexts.has(network.id(context))) {
      return;
    }
    const weight = amount * methodWeight(memory.methods, name);
    if (weight) {
      evidence.push({
        weight,
        reason: `${name} ${context} (+${weight.toFixed(2)})`,
      });
    }
  };
  add('statisticalContext', statistical?.context, 0.6);
  add('positionalContext', positional?.context, 4);
  add('explicitContext', memory.explicitContext, 12);
  return evidence;
}

/** Context views restrict candidates before grammatical ranking. */
export function contextCandidates(candidates, lexicon, context) {
  if (!context || !lexicon.contextNetwork) {
    return candidates;
  }
  const network = lexicon.contextNetwork;
  return candidates.filter((id) => {
    const contexts = network.contextsOf(lexicon.get(id));
    return !contexts.size || contexts.has(network.id(context));
  });
}
