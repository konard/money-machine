import { stateSense } from './english/object-complement.mjs';
import { scoreRanges } from './meaning-ranges.mjs';
import { methodEvidence } from './sense-methods.mjs';
/** Context-based sense selection with traceable dictionary and corpus evidence. */
import { methodWeight } from './methods.mjs';
import {
  sentenceContext,
  positionalContext,
  contextEvidence,
  contextCandidates,
} from './context-ranking.mjs';
import {
  dictionaryContext,
  nounObjectContext,
  membershipContext,
} from './sense-context.mjs';
import { attachmentContext } from './attachment-context.mjs';
import { cognateShare } from './cognates.mjs';
import { cueRarity, documentTopicContext } from './topic-context.mjs';
import { DocumentMemory, stem } from './document-memory.mjs';

export { DocumentMemory };
import { alternativeTokens } from './english/coordination-context.mjs';
import { translationHead } from './sources/translation-morphology.mjs';
import { definingVerbs } from './sources/sense-data.mjs';
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
  const adjectival = cue
    .match(/^(.{3,}?)(?:ic|ical)$/)?.[1]
    ?.replace(/([^aeiou])\1$/, '$1');
  if (adjectival && words.has(adjectival)) {
    return true;
  }
  const base = cue.match(/^(.{3,}?)(?:ment|ments|er|ers|ance|ence|al)$/)?.[1];
  return Boolean(
    (base && words.has(base)) ||
    [...words].some(
      (w) =>
        w.match(/^(.{3,}?)(?:ment|ments|er|ers|ance|ence|al)$/)?.[1] === cue
    )
  );
}

/** Every word form and lemma of a token, for cue matching. */
function tokenWords(token) {
  const out = new Set([token.lower]);
  // inline code kept out of translation still tells us the topic
  if (/^xpc[a-j]+q$/.test(token.lower)) {
    out.add('code');
  }
  // Measured quantities do not independently describe digits or numerals.
  if (token.kind === 'quantity' || token.kind === 'number') {
    const numeric =
      token.kind === 'number'
        ? ['number', 'numeral', 'digit', 'sum', 'quantity']
        : ['sum', 'quantity'];
    numeric.forEach((w) => out.add(w));
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

/** Choose each ambiguous head's meaning and retain scores and evidence. */
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
  // A word shared by coordinated clauses ("AI agent triages issues, drafts
  // fixes…") is one entity: decided once, in its own clause, and it does
  // not stretch a later clause's span back to its position.
  const decided = new Set();
  for (const clause of parsed.clauses) {
    const heads = collectHeads(clause).filter(({ node }) => !decided.has(node));
    heads.forEach(({ node }) => decided.add(node));
    const localPositions = heads
      .map(({ node }) => positions.get(node.token))
      .filter(Number.isFinite);
    const localWords =
      parsed.clauses.length > 1 &&
      clause.type !== 'fragment' &&
      localPositions.length
        ? words.filter(
            (w) =>
              w.pos >= Math.min(...localPositions) &&
              w.pos <= Math.max(...localPositions)
          )
        : words;
    const local = new Set(localWords.map((w) => w.pos));
    // verbs last, so their objects are resolved first
    heads.sort((a, b) => (a.node.pos === 'verb') - (b.node.pos === 'verb'));
    for (const { node, parent, role } of heads) {
      // An independently attested adjective has its own lexical meaning;
      // a productive participle is only the fallback for an attributive form.
      if (node.participle === 'past-passive') {
        const token = tokens.find((t) => t.index === node.token);
        const adjectives = lexicon.lookup('adj', token?.lower);
        if (adjectives.length) {
          node.candidates = adjectives;
          node.pos = 'adj';
          delete node.participle;
        }
      }
      node.candidates = contextCandidates(
        node.candidates,
        lexicon,
        memory.optionContext
      );
      if (node.candidates.length < 2) {
        node.concept = node.candidates[0];
        continue;
      }
      const at = positions.get(node.token);
      const word = tokens.find((t) => t.index === node.token)?.lower;
      const alternatives = node.uncounted
        ? alternativeTokens(clause, node)
        : new Set();
      const scores = {};
      const evidence = {};
      const statistical = sentenceContext(tokens, lexicon, memory, node.token);
      const positional = positionalContext(node, heads, clause, lexicon);
      for (const id of node.candidates) {
        const concept = lexicon.get(id);
        let score = 0;
        const why = [];
        const contextReasons = contextEvidence(
          concept,
          lexicon,
          memory,
          statistical,
          positional
        );
        for (const reason of contextReasons) {
          score += reason.weight;
          why.push(reason.reason);
        }
        const typedContext = contextReasons.some((r) => r.weight > 0);
        if (
          node.pos === 'noun' &&
          node.uncounted &&
          concept?.labels?.includes('uncountable')
        ) {
          score += 0.6;
          why.push('uncounted shared noun modifier (+0.60)');
        }
        // "It is legal" → законно: a relational adjective (юридический), with
        // no short forms, describes no state a predicate can assert
        const ru = concept?.ru;
        if (
          role === 'complement' &&
          ru?.pos === 'adj' &&
          ru.shortForms &&
          !Object.keys(ru.shortForms).length &&
          !ru.short
        ) {
          score -= 0.4;
          why.push('no Russian short form for a predicate (-0.40)');
        }
        if (node.pos === 'noun' && concept?.labels?.includes('distributive')) {
          const rate = tokens.some(
            (t) => (t.position ?? t.index) === at - 1 && t.lower === 'per'
          );
          score += rate ? 1 : -3;
          why.push(
            rate
              ? 'functional unit after distributive per (+1)'
              : 'functional unit outside distributive phrase (-3)'
          );
        }
        if (concept?.synonymAlternative) {
          const owner = node.pos === 'verb' && findVerbOwner(clause, node);
          const object = owner?.passive ? owner.subject : owner?.objects?.[0];
          const compound = lexicon.get(object?.head?.concept)?.ru?.compound;
          const penalty = compound ? 0.1 : 0.25;
          score -= penalty;
          why.push(
            `alternative synonym requires context (-${penalty.toFixed(2)})`
          );
        }
        const association = nounObjectContext(node, concept, heads, lexicon);
        if (association) {
          score += association;
          why.push(`Russian object association (+${association.toFixed(2)})`);
        }
        const attached =
          parsed.leftover?.length || parsed.unknown?.length
            ? 0
            : attachmentContext(node, concept, clause, lexicon) *
              methodWeight(memory.methods, 'partners');
        if (attached) {
          score += attached;
          why.push(`grammatical partner evidence (+${attached.toFixed(2)})`);
        }
        const semantic = dictionaryContext(node, concept, heads, lexicon);
        const topic =
          parsed.leftover?.length || parsed.unknown?.length
            ? 0
            : documentTopicContext(node, concept, lexicon, memory) *
              methodWeight(memory.methods, 'documentTopic');
        score += topic;
        if (topic) {
          why.push(`distinctive document definitions (+${topic.toFixed(2)})`);
        }
        if (node.pos === 'verb') {
          const membership = membershipContext(
            concept,
            findVerbOwner(clause, node),
            lexicon
          );
          if (membership) {
            score += membership;
            why.push(`collective membership argument (+${membership})`);
          }
        }
        // When the source explicitly has a direct object, prefer an attested
        // accusative alternative over a reflexive infinitive-controller.
        if (
          node.pos === 'verb' &&
          /(?:ся|сь)$/.test(concept?.ru?.lemma || '') &&
          !parsed.leftover?.length &&
          !parsed.unknown?.length &&
          !concept.ru.experiencer &&
          concept.infinitiveComplement &&
          !concept.frameOnly &&
          !concept.frames?.includes('intransitive') &&
          !concept.frames?.includes('transitive') &&
          !findVerbOwner(clause, node)?.xcomp &&
          findVerbOwner(clause, node)?.objects?.some((o) => !o.marker) &&
          node.candidates.some((other) => {
            const c = lexicon.get(other);
            return (
              !c?.related &&
              !/(?:ся|сь)$/.test(c?.ru?.lemma || '') &&
              c?.ru?.government?.case === 'acc' &&
              !c.ru.government.preposition
            );
          })
        ) {
          score -= 0.5;
          why.push('direct-object alternative to reflexive controller (-0.50)');
        }
        if (semantic) {
          score += semantic;
          why.push(`dictionary meanings in context (+${semantic.toFixed(2)})`);
        }
        if (
          node.pos === 'noun' &&
          role === 'head' &&
          concept?.labels?.includes('uncountable') &&
          !concept.labels.includes('countable') &&
          (parent?.quantity !== undefined || parent?.number === 'pl')
        ) {
          score -= 1;
          why.push('uncountable sense in a counted phrase (-1)');
        }
        const token = tokens.find((t) => t.index === node.token);
        if (concept?.capital && token?.text === token?.lower) {
          score -= 3;
          why.push('capitalized dictionary entry for lowercase token (-3)');
        } else if (concept?.capital && /^\p{Lu}\p{Ll}/u.test(token?.text)) {
          // "China is large": the capitalized page names the country
          score += 1;
          why.push('capitalized dictionary entry for capitalized token (+1)');
        }
        const defining = definingVerbs(concept);
        for (const cue of concept?.cues || []) {
          for (const w of words) {
            if (
              w.pos === at ||
              defining.has(cue) ||
              alternatives.has(w.token.index) ||
              !matchesCue(w.words, cue)
            ) {
              continue;
            }
            const distance = Math.abs(w.pos - at);
            // A reverse definition qualifies a Russian synonym; incidental
            // notes in it are weaker than the English sense's own cues.
            const reverseOnly =
              concept?.synonymAlternative &&
              node.candidates.some((other) => {
                const primary = lexicon.get(other);
                return (
                  !primary?.synonymAlternative &&
                  primary?.gloss === concept.gloss &&
                  !primary?.cues?.includes(cue)
                );
              });
            const weight =
              (1 + 2 / distance) *
              (local.has(w.pos) ? 1 : 0.1) *
              (words.some(
                (t) =>
                  t.token.lower === 'than' &&
                  t.pos > Math.min(at, w.pos) &&
                  t.pos < Math.max(at, w.pos)
              )
                ? 0.1
                : 1) *
              (reverseOnly ? 0.2 : 1) *
              cueRarity(cue, lexicon) *
              // another page's definition says nothing of this word's context
              (concept?.related ? 0.2 : 1);
            score += weight;
            why.push(
              `${local.has(w.pos) ? 'cue' : 'other clause cue'} "${cue}" at distance ${distance} (+${weight.toFixed(2)})`
            );
          }
          // The same document occurrence cannot vote again through recency.
          const remembered =
            topic && memory.profile.has(stem(cue)) ? 0 : memory.weight(cue);
          if (remembered > 0) {
            score += remembered * 0.8;
            why.push(
              `document memory "${cue}" (+${(remembered * 0.8).toFixed(2)})`
            );
          }
        }
        // the two most topical gloss words, so long glosses don't win
        // just by having more words
        const topical = node.uncounted
          ? 0
          : Math.min(
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
        if (concept?.genus && stem(concept.genus) !== stem(word || '')) {
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
          // another page's meaning is a fallback for a word without its own
          const own =
            !concept.capital &&
            node.candidates.some((c) => !lexicon.get(c)?.related);
          score -= own ? 2 : 0.5;
          why.push(`related translation page (-${own ? 2 : 0.5})`);
        }
        if (
          concept?.variant &&
          concept.domain &&
          node.candidates.some((other) => {
            const ordinary = lexicon.get(other);
            return (
              !ordinary?.variant &&
              ordinary?.core &&
              ordinary.domain === concept.domain
            );
          })
        ) {
          score -= 2;
          why.push(
            'secondary clipping competes with core sense in same field (-2)'
          );
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
          (parsed.clauses.length > 1 ||
            (!parsed.leftover?.length && !parsed.unknown?.length))
        ) {
          const owner = findVerbOwner(clause, node);
          const object = owner?.passive ? owner.subject : owner?.objects?.[0];
          const ru = lexicon.get(object?.head?.concept)?.ru;
          const lemma = translationHead(ru);
          const count = concept.objectFrequency[lemma];
          if (Number.isFinite(count)) {
            const synonyms = node.candidates
              .map((other) => lexicon.get(other))
              .filter((other) => other?.gloss === concept.gloss);
            const comparable =
              ru?.compound &&
              synonyms.some((other) => other.synonymAlternative) &&
              synonyms.every(
                (other) =>
                  Number.isFinite(other.ruFrequency) &&
                  Number.isFinite(other.objectFrequency?.[lemma])
              );
            const supported = Math.max(0, count - Math.sqrt(count));
            const weight =
              comparable && Number.isFinite(concept.ruFrequency)
                ? Math.min(
                    1.2,
                    0.6 *
                      Math.log10(
                        1 +
                          (1000 * supported) /
                            Math.max(1, count, concept.ruFrequency)
                      )
                  )
                : Math.min(0.3, Math.log10(1 + count) * 0.08);
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
        // кантри is the loan, страна the word: a loan far rarer than the
        // alternatives has only its narrow borrowed meaning
        const commonest = Math.max(
          ...node.candidates.map((c) => lexicon.get(c)?.ruFrequency || 0)
        );
        const cognate =
          (concept?.ruFrequency || 0) * 20 >= commonest
            ? 0.5 * cognateShare(node.lemma, concept?.ru?.lemma)
            : 0;
        if (cognate) {
          score += cognate;
          why.push(`international word (+${cognate.toFixed(2)})`);
        }
        if (Number.isFinite(concept?.ruFrequency)) {
          // Russian frequency supplies only a small default preference;
          // rarity costs more, while English context decides the meaning.
          const common =
            Math.max(
              node.pos === 'noun' && concept.core && association ? 0 : -0.25,
              Math.min(0.03, 0.1 * (Math.log10(concept.ruFrequency + 1) - 3))
            ) * methodWeight(memory.methods, 'ruwikiFrequency');
          score += common;
          why.push(
            `${concept.ru.lemma} in ${concept.ruFrequency} ruwiki articles (${common >= 0 ? '+' : ''}${common.toFixed(2)})`
          );
        }
        if (node === clause.subject?.head && concept?.propertyFrequency) {
          const adjectives = (clause.complement?.candidates || []).map(
            (id) => lexicon.get(id)?.ru?.lemma
          );
          const count = Math.max(
            0,
            ...adjectives.map((lemma) => concept.propertyFrequency[lemma] || 0)
          );
          const weight = Math.min(0.6, 0.15 * Math.log10(1 + count));
          score += weight;
          if (weight) {
            why.push(
              `Russian noun–predicate corpus (${count}, +${weight.toFixed(2)})`
            );
          }
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
                  !lexicon.get(other)?.synonymAlternative &&
                  lexicon.get(other)?.gloss !== concept.gloss &&
                  !domainOf(lexicon.get(other)) &&
                  !lexicon.get(other)?.variant &&
                  !lexicon.get(other)?.related &&
                  lexicon.get(other)?.ru?.lemma === lemma
              ).length
            : 0;
        for (const item of methodEvidence(
          typedContext ? { ...concept, domain: null } : concept,
          memory,
          word,
          semantic,
          topic
        )) {
          score += item.score;
          if (item.score) {
            why.push(item.reason);
          }
        }
        if (shared && !node.uncounted) {
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
      scoreRanges(node, clause, lexicon, scores, evidence, memory.methods);
      // A restricted historical reading cannot displace a living dictionary sense.
      const ranked = [...node.candidates].sort(
        (a, b) =>
          Number(Boolean(lexicon.get(a)?.usagePenalty)) -
            Number(Boolean(lexicon.get(b)?.usagePenalty)) ||
          scores[b] - scores[a]
      );
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
  const hasObject = (owner.objects || []).some((o) => !o.marker);
  const frames = concept.frames || [];
  if (
    hasObject &&
    frames.includes('intransitive') &&
    !frames.includes('transitive')
  ) {
    return { score: -4, reason: 'intransitive sense with direct object (-4)' };
  }
  // "keep repos active": the object complement asks for the state sense
  if (owner.complement?.object && stateSense(concept)) {
    return { score: 1.5, reason: 'state sense with object complement (+1.5)' };
  }
  // "let it run", "make them write": a bare verb after the object
  const observed = owner.xcomp?.bare
    ? 'bare-infinitive'
    : owner.xcomp && !owner.xcomp.purpose
      ? hasObject
        ? 'object-to'
        : 'to-infinitive'
      : owner.mods?.some((m) => m.prep === 'about') ||
          owner.objects?.some((o) => o.marker === 'about')
        ? 'about'
        : owner === clause &&
            (next?.link?.text === 'that' || clause.finiteLink === 'that')
          ? 'that'
          : owner === clause &&
              (next?.link?.concept === 'conj.whether' ||
                next?.link?.text?.toLowerCase() === 'whether')
            ? 'question'
            : null;
  const compatible =
    observed &&
    (frames.includes(observed) ||
      (observed === 'bare-infinitive' && concept.bareInfinitive) ||
      (observed === 'object-to' && frames.includes('to-infinitive')));
  if (compatible) {
    return { score: 4, reason: `valency ${observed} (+4)` };
  }
  if (concept.frameOnly) {
    return {
      score: -3,
      reason: 'valency supplement without matching frame (-3)',
    };
  }
  const markers = [
    ...(owner.mods || []).map((m) => m.prep),
    ...(owner.objects || []).map((o) => o.marker),
  ];
  const governed = markers.find(
    (marker) =>
      frames.includes(`prep:${marker}`) &&
      concept.ru?.markerGovernment?.[marker]
  );
  if (governed) {
    return { score: 0.8, reason: `attested ${governed} argument (+0.80)` };
  }
  if (
    observed &&
    frames.some((f) =>
      ['object-to', 'to-infinitive', 'question', 'that', 'about'].includes(f)
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
  if (!hasObject && frames.includes('intransitive')) {
    return { score: 0.3, reason: 'dictionary intransitive frame (+0.30)' };
  }
  if (
    !hasObject &&
    !owner.mods?.length &&
    !owner.complement &&
    !owner.xcomp &&
    owner.mood === 'imperative' &&
    (owner.link?.concept === 'conj.and' || next?.mood === 'imperative')
  ) {
    return {
      score: concept.core && !concept.related && !concept.variant ? 0.1 : 0,
      reason: 'core sense with an omitted list-item object (+0.10)',
    };
  }
  if (!concept.gloss || concept.objectClasses?.length) {
    return { score: 0 };
  }
  const named =
    /\b(?:something|someone|somebody|anything|one's|oneself|(?:a|an|the) [a-z]+)\b/.test(
      concept.gloss.replace(/^to /, '')
    );
  // "take on a position" is a verb and the object it names: "assumes $20"
  // is no position
  const specific = /^[a-z]+(?: [a-z]+)? (?:a|an|the) ([a-z]+)$/.exec(
    concept.gloss.replace(/^to /, '')
  )?.[1];
  const objectLemma = owner.objects?.[0]?.head?.concept?.split(':')[1];
  if (
    hasObject &&
    specific &&
    !/^(?:thing|object|person|one)$/.test(specific) &&
    objectLemma !== specific
  ) {
    return { score: 0 };
  }
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
  const objectHead = object?.head || object?.items?.[0]?.head;
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
  const classes = [
    objectHead.lemma,
    ...objectConcepts.flatMap((id) => lexicon.get(id)?.classes || []),
  ];
  const match = concept.objectClasses.find((c) => classes.includes(c));
  if (match) {
    return { score: 4, reason: `object "${objectHead.text}" is ${match} (+4)` };
  }
  const described = concept.objectClasses.find((c) =>
    objectConcepts.some((id) => lexicon.get(id)?.cues?.includes(c))
  );
  if (described) {
    return { score: 1, reason: `object definition mentions ${described} (+1)` };
  }
  // A dictionary cue explicitly naming this object is stronger than an
  // incomplete hypernym inventory. Its contextual bonus is counted above.
  if (concept.cues?.includes(objectHead.lemma)) {
    return { score: 0 };
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
  if (clause.np?.purpose) {
    return findVerbOwner(clause.np.purpose, verbNode);
  }
  return null;
}

/** `syntax degree` adverbs modify a following adjective or adverb. */
function positionalFit(node, concept, tokens, at) {
  if (node.pos !== 'adv' || !concept?.syntax) {
    return { score: 0 };
  }
  const next = tokens.find((t) => (t.position ?? t.index) === at + 1);
  const modifies = next?.readings?.some(
    (r) => r.pos === 'adj' || (r.pos === 'adv' && r.lemma !== node.lemma)
  );
  if (concept.syntax === 'parenthetical') {
    return next?.text === ','
      ? { score: 0.3, reason: 'parenthetical punctuation (+0.30)' }
      : { score: -2, reason: 'parenthetical adverb without punctuation (-2)' };
  }
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
