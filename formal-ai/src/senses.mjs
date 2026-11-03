/**
 * Context-based sense selection.
 *
 * New in this copy. Upstream Formal AI picks the first lexeme whose surface
 * matches. Here each candidate concept is scored by evidence from its
 * context, and the evidence is kept so a wrong choice can be traced to its
 * cause:
 *
 * - cue words near the ambiguous word, weighted by distance (the nearest
 *   words count most): weight = 1 + 2 / distance;
 * - selectional fit between a verb and its object (`object-class`);
 * - syntactic position for adverbs (`syntax degree` before an adjective);
 * - document memory: cue words from earlier sentences, decayed per sentence.
 */

/** Words seen in earlier sentences, with decaying weights. */
export class DocumentMemory {
  constructor(decay = 0.6) {
    this.decay = decay;
    this.weights = new Map();
    this.referents = [];
  }

  /** Age the memory by one sentence and add this sentence's words. */
  remember(words) {
    for (const [w, v] of this.weights) {
      const next = v * this.decay;
      if (next < 0.05) {
        this.weights.delete(w);
      } else {
        this.weights.set(w, next);
      }
    }
    for (const w of words) {
      this.weights.set(w, Math.min(1, (this.weights.get(w) || 0) + 1));
    }
  }

  weight(word) {
    return this.weights.get(word) || 0;
  }

  /** Note a noun phrase that a later pronoun may refer to. */
  mention(referent) {
    this.referents.unshift(referent);
    this.referents.length = Math.min(this.referents.length, 8);
  }
}

/** Every word form and lemma of a token, for cue matching. */
function tokenWords(token) {
  const out = new Set([token.lower]);
  // inline code kept out of translation still tells us the topic
  if (/^xpc[a-j]+q$/.test(token.lower)) {
    out.add('code');
  }
  for (const r of token.readings || []) {
    if (r.lemma) {
      out.add(String(r.lemma).toLowerCase());
    }
    for (const id of r.concepts || []) {
      out.add(id.split('.')[0]);
    }
  }
  return out;
}

/** Collect every head with candidate concepts in a clause tree. */
export function collectHeads(node, out = [], role = null, parent = null) {
  if (!node || typeof node !== 'object') {
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectHeads(n, out, role, parent));
    return out;
  }
  if (Array.isArray(node.candidates) && node.candidates.length > 0) {
    out.push({ node, role, parent });
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'candidates') {
      continue;
    }
    collectHeads(value, out, key, node);
  }
  return out;
}

/**
 * Choose a concept for every ambiguous head in the parsed sentence.
 * @param {object} parsed - result of `parseSentence`
 * @param {import('./lexicon.mjs').Lexicon} lexicon
 * @param {DocumentMemory} [memory]
 * @returns {object[]} decisions with scores and evidence
 */
export function resolveSenses(parsed, lexicon, memory = new DocumentMemory()) {
  const tokens = parsed.tokens;
  const positions = new Map(
    tokens.map((t) => [t.index, t.position ?? t.index])
  );
  const words = tokens.map((t) => ({
    pos: t.position ?? t.index,
    words: tokenWords(t),
    token: t,
  }));
  const decisions = [];
  for (const clause of parsed.clauses) {
    const heads = collectHeads(clause);
    // verbs last, so their objects are resolved first
    heads.sort((a, b) => (a.node.pos === 'verb') - (b.node.pos === 'verb'));
    for (const { node } of heads) {
      if (node.candidates.length < 2) {
        node.concept = node.candidates[0];
        continue;
      }
      const at = positions.get(node.token);
      const scores = {};
      const evidence = {};
      for (const id of node.candidates) {
        const concept = lexicon.get(id);
        let score = 0;
        const why = [];
        for (const cue of concept?.cues || []) {
          for (const w of words) {
            if (w.pos === at || !w.words.has(cue)) {
              continue;
            }
            const distance = Math.abs(w.pos - at);
            const weight = 1 + 2 / distance;
            score += weight;
            why.push(
              `cue "${cue}" at distance ${distance} (+${weight.toFixed(2)})`
            );
          }
          const remembered = memory.weight(cue);
          if (remembered > 0) {
            score += remembered * 0.8;
            why.push(
              `document memory "${cue}" (+${(remembered * 0.8).toFixed(2)})`
            );
          }
        }
        const fit = selectionalFit(node, clause, concept, lexicon);
        if (fit.score) {
          score += fit.score;
          why.push(fit.reason);
        }
        const position = positionalFit(node, concept, tokens, at);
        if (position.score) {
          score += position.score;
          why.push(position.reason);
        }
        scores[id] = Number(score.toFixed(2));
        evidence[id] = why;
      }
      const ranked = [...node.candidates].sort((a, b) => scores[b] - scores[a]);
      node.concept = ranked[0];
      node.ambiguous = scores[ranked[0]] === scores[ranked[1]];
      decisions.push({
        word: node.text,
        chosen: ranked[0],
        ambiguous: node.ambiguous,
        scores,
        evidence: evidence[ranked[0]],
      });
    }
  }
  return decisions;
}

/** Verb ↔ object class agreement (`object-class`). */
function selectionalFit(node, clause, concept, lexicon) {
  if (node.pos !== 'verb' || !concept?.objectClasses?.length) {
    return { score: 0 };
  }
  const owner = findVerbOwner(clause, node);
  const object = owner?.objects?.[0];
  const objectHead = object?.head;
  if (!objectHead) {
    return { score: -0.5, reason: 'expects an object but has none (-0.50)' };
  }
  const objectConcepts = objectHead.concept
    ? [objectHead.concept]
    : objectHead.candidates || [];
  if (!objectConcepts.length) {
    // a name, placeholder or unknown word says nothing about the class
    return { score: 0 };
  }
  const classes = objectConcepts.flatMap(
    (id) => lexicon.get(id)?.classes || []
  );
  const match = concept.objectClasses.find((c) => classes.includes(c));
  if (match) {
    return { score: 4, reason: `object "${objectHead.text}" is ${match} (+4)` };
  }
  return {
    score: -3,
    reason: `object "${objectHead.text}" is not ${concept.objectClasses.join('/')} (-3)`,
  };
}

function findVerbOwner(clause, verbNode) {
  if (clause.verb === verbNode) {
    return clause;
  }
  if (clause.xcomp) {
    return findVerbOwner(clause.xcomp, verbNode);
  }
  return null;
}

/** `syntax degree` adverbs modify a following adjective or adverb. */
function positionalFit(node, concept, tokens, at) {
  if (node.pos !== 'adv' || !concept?.syntax) {
    return { score: 0 };
  }
  const next = tokens.find((t) => (t.position ?? t.index) === at + 1);
  const modifies = next?.readings.some(
    (r) => r.pos === 'adj' || (r.pos === 'adv' && r.lemma !== node.lemma)
  );
  if (concept.syntax === 'degree') {
    return modifies
      ? { score: 5, reason: 'precedes an adjective or adverb (+5)' }
      : { score: -2, reason: 'nothing to intensify (-2)' };
  }
  if (concept.syntax === 'clause') {
    return modifies
      ? { score: 0 }
      : { score: 2, reason: 'clause-level position (+2)' };
  }
  return { score: 0 };
}

/** Words of a sentence to feed into document memory. */
export function sentenceWords(parsed) {
  return parsed.tokens
    .filter((t) => t.kind === 'word')
    .flatMap((t) => [...tokenWords(t)]);
}
