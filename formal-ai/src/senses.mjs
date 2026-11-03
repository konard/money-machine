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

  /**
   * Topic of the whole document, as word co-occurrence: a sense whose gloss
   * words share sentences with the ambiguous word elsewhere in the
   * document fits its topic ("deposit" next to "bank" and "money" in a
   * text about payouts). Plain frequency would not do: a legal text says
   * "government" often, which says nothing about "capital".
   */
  setTopic(text) {
    this.topic = text
      .toLowerCase()
      .split(/[.!?;,:()\n]+/)
      .map((s) => {
        const set = new Set((s.match(/[a-z]{3,}/g) || []).map(stem));
        // an amount of currency is a mention of money, as in sentence cues
        if (
          /[$€£¥]\s?\d|\d\s?(?:usd|eur|gbp)\b|\b(?:usd|eur|gbp)\s?\d/.test(s)
        ) {
          set.add('money');
        }
        return set;
      })
      .filter((s) => s.size > 1);
    this.cooccur = new Map();
    if (!this.families) {
      this.setField(text);
    }
  }

  /**
   * The field: a larger body of text the document belongs to (the whole
   * site), counted by word family (first five letters) per sentence.
   */
  setField(text) {
    this.families = new Map();
    this.postings = new Map();
    this.lifts = new Map();
    this.fieldSize = 0;
    for (const sentence of text.toLowerCase().split(/[.!?;\n]+/)) {
      const words = sentence.match(/[a-z]{3,}/g) || [];
      if (words.length < 2) {
        continue;
      }
      const id = this.fieldSize;
      this.fieldSize += 1;
      for (const root of new Set(words.map((w) => stem(w).slice(0, 5)))) {
        this.families.set(root, (this.families.get(root) || 0) + 1);
      }
      // co-occurrence needs whole stems: "author" is not "authority"
      for (const root of new Set(words.map(stem))) {
        const list = this.postings.get(root);
        if (list) {
          list.push(id);
        } else {
          this.postings.set(root, [id]);
        }
      }
    }
  }

  /**
   * How much more often a cue's family appears in the field's sentences
   * that contain the word than in the field at all (0…1). "royalties"
   * stands next to "authors" and "sales" on this site, not "royal".
   */
  fieldWeight(cue, word) {
    const root = (w) => stem(w.toLowerCase());
    const a = this.postings?.get(root(word));
    if (!a || a.length < 3 || cue.length <= 3) {
      return this.familyWeight(cue) * 0.5;
    }
    const key = `${root(cue)} ${root(word)}`;
    if (this.lifts.has(key)) {
      return this.lifts.get(key);
    }
    const b = this.postings.get(root(cue)) || [];
    let both = 0;
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
      if (a[i] === b[j]) {
        both += 1;
        i += 1;
        j += 1;
      } else if (a[i] < b[j]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    // a few shared sentences are chance: count one deviation less
    const lift =
      (both - Math.sqrt(both)) / a.length / (b.length / this.fieldSize);
    // the word's own family ("royal" in "royalties") says nothing
    const own =
      root(word).startsWith(root(cue)) || root(cue).startsWith(root(word));
    const weight =
      both >= 3 && !own ? Math.max(0, Math.min(1, Math.log10(lift) / 1.5)) : 0;
    this.lifts.set(key, weight);
    return weight;
  }

  /** How much the document talks about a word's family (0…1). */
  familyWeight(word) {
    const n = word.length > 3 ? this.families?.get(word.slice(0, 5)) || 0 : 0;
    // share of the field's sentences, on a log scale: 1 in 1000 → 0.25,
    // 1 in 30 → 1
    const share = n / Math.max(1, this.fieldSize);
    return n >= 2
      ? Math.max(0, Math.min(1, 1 + Math.log10(share * 30) / 1.5))
      : 0;
  }

  /** Does the document use this word (or a word of this phrase)? */
  mentions(phrase) {
    // a field is mentioned by any word of its family: finance ~ financial
    const roots = phrase
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3)
      .map((w) => stem(w).slice(0, 5));
    return roots.some((root) =>
      this.topic?.some((s) => [...s].some((w) => w.startsWith(root)))
    );
  }

  topicWeight(cue, word) {
    if (!this.topic || !word) {
      return 0;
    }
    const a = stem(cue);
    const b = stem(word);
    if (a === b) {
      return 0;
    }
    const key = `${a} ${b}`;
    if (!this.cooccur.has(key)) {
      this.cooccur.set(
        key,
        this.topic.filter((s) => s.has(a) && s.has(b)).length
      );
    }
    const n = this.cooccur.get(key);
    return n ? Math.min(1, Math.log2(1 + n) / 3) : 0;
  }

  /** Note a noun phrase that a later pronoun may refer to. */
  mention(referent) {
    this.referents.unshift(referent);
    this.referents.length = Math.min(this.referents.length, 8);
  }
}

/** A cue word matches a sentence word or its derivation (pay ~ payment). */
function matchesCue(words, cue) {
  if (words.has(cue)) {
    return true;
  }
  // Productive participial spelling: final -e is lost before -ing/-en,
  // and a final consonant can be doubled (written, driven, taking).
  const participle =
    cue.length > 5 && /(?:ing|en)$/.test(cue)
      ? cue.replace(/(?:ing|en)$/, '').replace(/([^aeiou])\1$/, '$1')
      : null;
  if (
    participle &&
    [...words].some((w) => w.replace(/e$/, '') === participle)
  ) {
    return true;
  }
  const base = cue.match(/^(.{3,}?)(?:ment|ments|er|ers|ance|ence|al)$/)?.[1];
  return Boolean(base && words.has(base));
}

/** Crude English stem for topic counts: payments → payment. */
function stem(word) {
  return word
    .replace(/ies$/, 'y')
    .replace(/(?:ches|shes|sses|xes|zes)$/, (ending) => ending.slice(0, -2))
    .replace(/(?:s|ed|ing|ly)$/, '')
    .replace(/^(.{4,})al$/, '$1');
}

/** Every word form and lemma of a token, for cue matching. */
function tokenWords(token) {
  const out = new Set([token.lower]);
  // inline code kept out of translation still tells us the topic
  if (/^xpc[a-j]+q$/.test(token.lower)) {
    out.add('code');
  }
  // "$8,000", "20%": a quantity is a cue for number senses
  if (token.kind === 'quantity' || token.kind === 'number') {
    ['number', 'numeral', 'digit', 'sum', 'quantity'].forEach((w) =>
      out.add(w)
    );
    // Bare counts can cue numerical values; money/percent/range tokens
    // must not generate repeated generic "value" and "amount" evidence.
    if (token.kind === 'number') {
      out.add('amount');
      out.add('value');
    }
    if (/[$€£]/.test(token.text)) {
      out.add('money');
    }
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
      const word = tokens.find((t) => t.index === node.token)?.lower;
      const scores = {};
      const evidence = {};
      for (const id of node.candidates) {
        const concept = lexicon.get(id);
        let score = 0;
        const why = [];
        const token = tokens.find((t) => t.index === node.token);
        if (concept?.capital && token?.text === token?.lower) {
          score -= 3;
          why.push('capitalized dictionary entry for lowercase token (-3)');
        }
        for (const cue of concept?.cues || []) {
          for (const w of words) {
            if (w.pos === at || !matchesCue(w.words, cue)) {
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
        // the two most topical gloss words, so long glosses don't win
        // just by having more words
        const topical = Math.min(
          1,
          (concept?.cues || [])
            .map((cue) => memory.topicWeight(cue, word))
            .sort((a, b) => b - a)
            .slice(0, 2)
            .reduce((sum, w) => sum + w * 0.5, 0)
        );
        if (topical > 0) {
          score += topical;
          why.push(`document topic (+${topical.toFixed(2)})`);
        }
        // weaker: the sense's words are what the document is about at all
        // (the share of its words, so long definitions don't win by size)
        const field =
          (concept?.cues || [])
            .map((cue) => memory.fieldWeight(cue, word))
            .sort((a, b) => b - a)
            .slice(0, 3)
            .reduce((sum, w) => sum + w, 0) * 0.15;
        if (field > 0) {
          score += field;
          why.push(`document field (+${field.toFixed(2)})`);
        }
        if (concept?.genus) {
          const weight = memory.familyWeight(concept.genus) * 0.2;
          score += weight;
          if (weight) {
            why.push(`definition head in field (+${weight.toFixed(2)})`);
          }
        }
        if (concept?.prior) {
          // the source lists common senses first
          score += concept.prior;
          why.push(
            `listed sense ${concept.id.split(':').pop()} (+${concept.prior.toFixed(2)})`
          );
        }
        if (concept?.related) {
          score -= 0.5;
          why.push('related translation page (-0.50)');
        }
        if (concept?.usagePenalty) {
          score -= concept.usagePenalty;
          why.push(
            `dictionary usage label (-${concept.usagePenalty.toFixed(2)})`
          );
        }
        if (
          node.pos === 'verb' &&
          concept?.objectFrequency &&
          !parsed.leftover?.length &&
          !parsed.unknown?.length
        ) {
          const owner = findVerbOwner(clause, node);
          const object = owner?.passive ? owner.subject : owner?.objects?.[0];
          const lemma = lexicon.get(object?.head?.concept)?.ru?.lemma;
          const count = concept.objectFrequency[lemma];
          if (Number.isFinite(count)) {
            const weight = Math.min(0.3, Math.log10(1 + count) * 0.08);
            score += weight;
            why.push(
              `Russian verb–object corpus (${count}, +${weight.toFixed(2)})`
            );
          }
        }
        const fit = selectionalFit(node, clause, concept, lexicon);
        if (fit.score) {
          score += fit.score;
          why.push(fit.reason);
        }
        // Only the less common tail needs a penalty: among frequent words,
        // lemma frequency cannot decide which English meaning fits the text.
        // An absent lemma is unknown, not evidence that it is archaic.
        if (concept?.ruRank > 8000 && concept.ruRank <= 20000) {
          const common = -0.1 * Math.log10(concept.ruRank / 8000);
          score += common;
          why.push(
            `Russian corpus rank ${concept.ruRank} (${common.toFixed(2)})`
          );
        }
        if (Number.isFinite(concept?.ruFrequency)) {
          // an encyclopedia overcounts some words (орден), so commonness
          // earns little and rarity costs more
          const common = Math.max(
            -0.25,
            Math.min(0.1, 0.1 * (Math.log10(concept.ruFrequency + 1) - 3))
          );
          score += common;
          why.push(
            `${concept.ru.lemma} in ${concept.ruFrequency} ruwiki articles (${common >= 0 ? '+' : ''}${common.toFixed(2)})`
          );
        }
        const valency = valencyFit(
          node,
          clause,
          concept,
          parsed.clauses[parsed.clauses.indexOf(clause) + 1]
        );
        if (valency.score) {
          score += valency.score;
          why.push(valency.reason);
        }
        // a Russian word that translates several senses is the usual one
        const lemma = concept?.ru?.lemma;
        const shared =
          lemma && !domainOf(concept) && !concept.related
            ? node.candidates.filter(
                (other) =>
                  other !== id &&
                  !domainOf(lexicon.get(other)) &&
                  !lexicon.get(other)?.variant &&
                  !lexicon.get(other)?.related &&
                  lexicon.get(other)?.ru?.lemma === lemma
              ).length
            : 0;
        // "chemistry: a number of a reaction": a specialist sense, unlikely
        // unless the document is about that field
        const domain = domainOf(concept);
        if (
          domain &&
          !concept.core &&
          !memory.mentions(domain) &&
          !(memory.familyWeight(domain) >= 0.4)
        ) {
          score -= 0.2;
          why.push(`specialist sense (${domain}) (-0.20)`);
        }
        if (domain && memory.mentions(domain)) {
          score += 0.3;
          why.push(`dictionary field ${domain} in document (+0.30)`);
        }
        if (shared) {
          const bonus = Math.min(0.1, 0.05 * shared);
          score += bonus;
          why.push(
            `${lemma} translates ${shared + 1} senses (+${bonus.toFixed(2)})`
          );
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
        allEvidence: evidence,
      });
    }
  }
  return decisions;
}

/** Field label of a gloss ("law: demand for compensation" → law). */
function domainOf(concept) {
  return concept?.domain || null;
}

/**
 * A verb sense whose gloss names its object ("to put forward something")
 * fits a clause with an object; one without ("to yield to another") fits
 * a clause without.
 */
function valencyFit(node, clause, concept, next) {
  if (node.pos !== 'verb' || !concept) {
    return { score: 0 };
  }
  const owner = findVerbOwner(clause, node);
  if (!owner) {
    return { score: 0 };
  }
  const hasObject = (owner.objects || []).length > 0;
  const frames = concept.frames || [];
  const observed =
    owner.xcomp && !owner.xcomp.purpose
      ? hasObject
        ? 'object-to'
        : 'to'
      : owner.mods?.some((m) => m.prep === 'about') ||
          owner.objects?.some((o) => o.marker === 'about')
        ? 'about'
        : owner === clause && next?.link?.text === 'that'
          ? 'that'
          : owner === clause &&
              (next?.link?.concept === 'conj.whether' ||
                next?.link?.text?.toLowerCase() === 'whether')
            ? 'question'
            : null;
  const compatible =
    observed &&
    (frames.includes(observed) ||
      (observed === 'object-to' && frames.includes('to')));
  if (compatible) {
    return { score: 4, reason: `valency ${observed} (+4)` };
  }
  if (concept.frameOnly) {
    return {
      score: -3,
      reason: 'valency supplement without matching frame (-3)',
    };
  }
  if (
    observed &&
    frames.some((f) =>
      ['object-to', 'to', 'question', 'that', 'about'].includes(f)
    )
  ) {
    return { score: -2, reason: `valency incompatible with ${observed} (-2)` };
  }
  if (
    owner.passive &&
    frames.includes('intransitive') &&
    !frames.includes('transitive')
  ) {
    return { score: -4, reason: 'valency intransitive sense in passive (-4)' };
  }
  if (owner.passive && frames.includes('transitive')) {
    return { score: 0.8, reason: 'valency transitive passive (+0.80)' };
  }
  if (hasObject && frames.includes('transitive') && concept.core) {
    return { score: 0.3, reason: 'dictionary transitive core frame (+0.30)' };
  }
  if (!concept.gloss || concept.objectClasses?.length) {
    return { score: 0 };
  }
  const named =
    /\b(?:something|someone|somebody|anything|one's|oneself|(?:a|an|the) [a-z]+)\b/.test(
      concept.gloss.replace(/^to /, '')
    );
  if (hasObject === named) {
    return {
      score: 0.3,
      reason: hasObject
        ? 'sense takes an object (+0.30)'
        : 'sense has no object (+0.30)',
    };
  }
  return { score: 0 };
}

/** Verb ↔ object class agreement (`object-class`). */
function selectionalFit(node, clause, concept, lexicon) {
  if (
    node.pos !== 'verb' ||
    !(concept?.objectClasses?.length || concept?.objectLemma)
  ) {
    return { score: 0 };
  }
  const owner = findVerbOwner(clause, node);
  const object = owner?.passive
    ? owner.subject || owner.labelSubject
    : owner?.objects?.[0];
  const objectHead = object?.head;
  if (concept.objectLemma) {
    const lemma = lexicon.get(objectHead?.concept)?.ru?.lemma;
    return lemma === concept.objectLemma
      ? { score: 5, reason: 'dictionary verb–object collocation (+5)' }
      : {
          score: -5,
          reason: 'dictionary collocation requires a different object (-5)',
        };
  }
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
