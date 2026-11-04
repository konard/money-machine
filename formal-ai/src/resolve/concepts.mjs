import { roundTripEvidence } from '../round-trip.mjs';
import { reflexiveAspect, reflexivePartner } from '../sources/reflexive.mjs';
import { predicateEvidence } from '../english/participle-evidence.mjs';
import {
  translationSenses,
  translationSyntax,
} from '../sources/translation-senses.mjs';
import { learnPhrases } from '../public-expressions.mjs';
import { russianFrequencies } from '../sources/frequency.mjs';
import {
  linkReflexiveSenses,
  hypernym,
  senseClasses,
  usagePenalty,
  senseDomain,
  glossWords,
} from '../sources/sense-data.mjs';
import {
  russianCorpusRanks,
  normalizeLemma,
} from '../sources/rnc-frequency.mjs';
import { governmentResolver } from '../sources/government.mjs';
import { POS_RU } from './word-classes.mjs';

/**
 * Phase 4: each sense with a usable Russian entry becomes a concept in the
 * lexicon, with its evidence (frames, cues, field, prior, round trip).
 */
export async function learnConcepts(run) {
  const { lexicon, options, entries, plans, voicePlans, sensesOf } = run;
  const { phrases, ruPages, government, reflexives, russian } = run;
  const roundTrip = await roundTripEvidence(
    plans,
    entries,
    government,
    options
  );
  const { choose, finish: finishVerb } = governmentResolver({
    russian,
    ruPages,
    government,
    lexicon,
  });
  const resolved = learnPhrases(phrases, entries, sensesOf, lexicon);
  for (const plan of plans) {
    let rank = 0;
    const ownSenses = plan.senses.some(
      (s) => !s.variant && !s.side && s.russian.length
    );
    // the most widely translated of the word's own senses
    const most = Math.max(
      0,
      ...plan.senses
        .filter((s) => !s.variant && !s.side)
        .map((s) => s.languages || 0)
    );
    translationSenses(plan, ruPages).forEach((s, i) => {
      const sense = { ...s, lemma: plan.lemma };
      const ru = choose(s.russian, POS_RU[plan.pos], sense);
      if (!ru) {
        return;
      }
      if (s.passiveForms) {
        Object.assign(ru, {
          passive: true,
          predicateShort: true,
          shortForms: s.passiveForms,
        });
      }
      if (ru.pos === 'verb') {
        finishVerb(ru, sense);
        // a -ся verb takes no direct object: keep a transitive
        // alternative for clauses with one ("try this" → пробовать)
        if (
          /ся$/.test(ru.lemma) &&
          !ru.experiencer &&
          !ru.government.preposition &&
          ru.government.case === 'acc'
        ) {
          const transitive = s.russian
            .map((c) => russian(c.word, 'verb'))
            .find(
              (x) =>
                x && !/ся$/.test(x.lemma) && x.lemma !== ru.perfective?.lemma
            );
          if (transitive) {
            ru.transitive = finishVerb(transitive, sense);
          }
        }
      }
      const id = `wikt:${plan.lemma}:${plan.pos}:${i + 1}`;
      if (lexicon.get(id)) {
        return;
      }
      lexicon.add({
        id,
        roundTrip: roundTrip.meaning(s, plan, ru),
        englishRange: roundTrip.range(plan, ru),
        gloss: s.gloss,
        definition: s.definition,
        examples: s.examples,
        labels: s.labels,
        predicateEvidence: predicateEvidence(entries, plan),
        synonymAlternative: s.synonymAlternative,
        frames: s.frames,
        objectLemma: s.objectLemma,
        frameOnly: s.frameOnly,
        related: s.side || undefined,
        grounding: null,
        excludedGroundings: [],
        classes: plan.pos === 'noun' ? senseClasses(s) : [],
        genus:
          plan.pos === 'noun'
            ? hypernym(s.reverseDefinition || s.definition || s.gloss)
            : undefined,
        cues: glossWords(
          `${s.gloss} ${s.definition || ''} ${s.context || ''} ${(s.labels || []).join(' ')}`,
          plan.lemma,
          plan.pos === 'verb'
        ),
        capital: s.capital || undefined,
        usagePenalty: usagePenalty(s),
        // the most widely translated sense is the word's core meaning even
        // under a field label ("telephone", labelled telephony)
        domain: senseDomain(s),
        core: Boolean(most && (s.languages || 0) >= most),
        objectClasses: s.objectClasses || [],
        syntax: translationSyntax(plan, s, ru, ruPages),
        takes: [],
        // Prefer widely translated own senses over historical order and variants.
        prior:
          (s.variant || s.side ? (ownSenses ? 0.05 : 0.15) : 0.3) *
          (most
            ? 0.4 / Math.sqrt(rank + 1) +
              0.6 * Math.sqrt(Math.min(1, (s.languages || 0) / most))
            : 1 / Math.sqrt(rank + 1)) *
          (s.rare && !(most && (s.languages || 0) >= most) ? 0.3 : 1),
        variant: s.variant || undefined,
        en: [
          {
            pos: plan.pos,
            lemma: plan.lemma,
            words: plan.lemma.toLowerCase().split(/\s+/),
          },
        ],
        ru,
        source: s.source || 'wiktionary',
      });
      rank += s.synonymAlternative ? 0 : 1;
      resolved.push(id);
    });
  }
  linkReflexiveSenses(voicePlans, lexicon, (entry, plan) => {
    const word =
      reflexives.get(entry.lemma) || reflexives.get(entry.perfective?.lemma);
    const ru =
      word &&
      russian(word, 'verb', {
        word,
        attested: true,
        aspect: reflexiveAspect(government.get(word)),
      });
    if (!ru) {
      return null;
    }
    const partner = reflexivePartner(government.get(word));
    if (ru.aspect === 'perf' && partner) {
      const imperfective = russian(partner, 'verb', {
        word: partner,
        attested: true,
      });
      if (imperfective) {
        return { ...imperfective, perfective: ru };
      }
    }
    const perfectiveWord = reflexives.get(entry.perfective?.lemma) || partner;
    if (ru.aspect === 'impf' && perfectiveWord) {
      ru.perfective = russian(perfectiveWord, 'verb', {
        word: perfectiveWord,
        attested: true,
        aspect: 'pf',
      });
    }
    return finishVerb(ru, { lemma: plan.lemma, gloss: '' });
  });
  return resolved;
}

/** How common each Russian lemma is: ruwiki hits and RNC ranks. */
export async function corpusEvidence(resolved, plans, lexicon, options) {
  // how common each candidate translation is, where a word has several
  const ambiguous = resolved
    .map((id) => lexicon.get(id))
    .filter((c) => c?.ru?.lemma && plans.length);
  const lemmas = ambiguous
    .map((c) => c.ru.lemma)
    .filter((w) => !w.includes(' '));
  const frequency = await russianFrequencies(lemmas, options);
  for (const c of ambiguous) {
    if (frequency.has(c.ru.lemma)) {
      c.ruFrequency = frequency.get(c.ru.lemma);
    }
  }
  const corpus = await russianCorpusRanks(options).catch(() => null);
  if (corpus) {
    for (const c of lexicon.concepts.values()) {
      // A phrase's head cannot be inferred safely from word order alone.
      if (!c.ru?.lemma || /\s/.test(c.ru.lemma)) {
        continue;
      }
      const entry = corpus.get(normalizeLemma(c.ru.lemma));
      c.ruRank = entry?.rank;
    }
  }
}
