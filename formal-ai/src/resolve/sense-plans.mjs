import {
  voiceDictionary,
  englishErgative,
  englishVoiceFrames,
} from '../sources/reflexive.mjs';
import { currencyPlans } from '../sources/currencies.mjs';
import { rememberPartsOfSpeech } from '../english/nominal-evidence.mjs';
import { hasComplementFrame } from '../sources/infinitive-frames.mjs';
import { completeDefinitions } from '../sources/definition-translations.mjs';
import { supplementTerms } from '../sources/terms.mjs';
import { readings, tokenize } from '../english/analyze.mjs';
import {
  borrowGenus,
  collocationSenses,
  senseClasses,
  publicSenses,
} from '../sources/sense-data.mjs';
import { POS_RU, FEATURE } from './word-classes.mjs';

/**
 * Phase 2: one plan per (lemma, part of speech) — its English senses with
 * their Russian candidates — plus voice plans for verbs already known.
 */
export async function sensePlans(run) {
  const { text, lexicon, options, words, only, entries, forms } = run;
  const { capitalOf, timeOnly, phraseOnly } = run;
  rememberPartsOfSpeech(entries, lexicon);
  // English sense → Russian candidates
  const plans = only ? [] : await currencyPlans(text, options);
  const sensesOf = (title, pos) => publicSenses(entries, title, pos);
  // one plan per (lemma, pos): the word's own senses first, then those of
  // words it is a variant of ("fee" the payment before "fee" ← "fief")
  const own = new Map();
  const variant = new Map();
  const append = (map, key, senses) =>
    map.set(key, [...(map.get(key) || []), ...senses]);
  for (const [title, list] of entries) {
    if (title.endsWith('/translations')) {
      continue;
    }
    for (const e of list) {
      if (
        !POS_RU[e.pos] ||
        phraseOnly.has(title) ||
        e.rare ||
        (e.pos !== 'verb' && lexicon.lookup(e.pos, title).length)
      ) {
        continue;
      }
      // Inflections use the base's senses rather than a lexicalized homonym
      // — unless the homonym is a mass noun ("data" the information, not
      // only the plural of "datum"): a plural is never uncountable
      const mass =
        !e.formOf.some((f) => FEATURE[f.kind]) &&
        e.rawDefinitions?.some((d) =>
          /\{\{(?:lb|lbl|label)\|en\|[^}]*\b(?:collective|uncountable)\b/.test(
            d
          )
        );
      if (
        !mass &&
        list.some(
          (x) =>
            x.pos === e.pos &&
            // "read": past of itself; its own senses still count
            x.formOf.some(
              (f) =>
                FEATURE[f.kind] &&
                f.lemma !== title &&
                // a base nobody translates ("run" ← Scots "rin") does not
                // displace the word's own senses
                (lexicon.lookup(e.pos, f.lemma).length > 0 ||
                  sensesOf(f.lemma, e.pos).some((z) => z.russian?.length))
            )
        )
      ) {
        continue;
      }
      const known = lexicon.lookup(e.pos, title).length > 0;
      own.set(
        `${e.pos}:${title}`,
        sensesOf(title, e.pos)
          .filter(
            (s) =>
              !timeOnly.has(title) ||
              (e.pos === 'noun' && senseClasses(s).includes('time'))
          )
          .filter((s) => !known || hasComplementFrame(s))
          .map((s) => ({ ...s, frameOnly: known }))
      );
      // "earn" the verb is no spelling of "erne" (eagle) as another POS
      const ownElsewhere = list.some(
        (x) => x.pos !== e.pos && !x.rare && x.senses.length
      );
      if (ownElsewhere && !sensesOf(title, e.pos).length) {
        own.delete(`${e.pos}:${title}`);
        continue;
      }
      // a misspelling ("lets" for "let's") is never what the writer meant
      for (const f of e.formOf.filter(
        (x) =>
          /alternative|spelling|form$/.test(x.kind) &&
          !/misspelling/.test(x.kind) &&
          !FEATURE[x.kind]
      )) {
        // "e.g." (adverb) ← "for example" (prepositional phrase)
        const pos = e.pos === 'adv' && / /.test(f.lemma) ? 'prep' : e.pos;
        const target = capitalOf.get(f.lemma) || f.lemma;
        const same = sensesOf(target, e.pos);
        append(
          variant,
          `${e.pos}:${title}`,
          (same.length ? same : sensesOf(target, pos)).filter(
            (s) => !timeOnly.has(title) || senseClasses(s).includes('time')
          )
        );
      }
    }
  }
  for (const key of new Set([...own.keys(), ...variant.keys()])) {
    const [pos, ...rest] = key.split(':');
    const seen = new Set();
    const senses = [
      ...(own.get(key) || []),
      // a variant's senses are less likely than the word's own
      ...(variant.get(key) || []).map((x) => ({ ...x, variant: true })),
    ].filter((x) => !seen.has(x.gloss) && seen.add(x.gloss));
    if (senses.length) {
      const expanded = collocationSenses(borrowGenus(senses));
      const lemma = rest.join(':');
      const pluralOnly = (entries.get(lemma) || []).some(
        (e) => e.pos === pos && e.pluralOnly
      );
      plans.push({
        lemma,
        pos,
        senses: expanded,
        ...(pluralOnly ? { pluralOnly } : {}),
      });
    }
  }
  if (!only) {
    plans.push(
      ...(await supplementTerms(text, {
        entries,
        plans,
        lexicon,
        words,
        forms,
        options,
      }))
    );
  }
  await completeDefinitions(plans, options, entries, { words, forms, lexicon });
  // Seed entries still need voice evidence from their public dictionary pages.
  const voicePlans = [...plans];
  const voiceLemmas = new Set([
    ...entries.keys(),
    ...tokenize(text).flatMap((token) =>
      readings(token, lexicon)
        .filter((r) => r.pos === 'verb')
        .map((r) => r.lemma)
    ),
  ]);
  for (const title of voiceLemmas) {
    if (title && lexicon.lookup('verb', title).length) {
      voicePlans.push({
        lemma: title,
        pos: 'verb',
        senses: [
          {
            russian: lexicon.lookup('verb', title).flatMap((id) => {
              const ru = lexicon.get(id)?.ru;
              return [ru?.lemma, ru?.perfective?.lemma]
                .filter(Boolean)
                .map((word) => ({ word }));
            }),
          },
        ],
      });
    }
  }
  const voiceEvidence = await voiceDictionary(
    voiceLemmas,
    entries,
    lexicon,
    options
  );
  for (const plan of voicePlans) {
    plan.voiceFrames = englishVoiceFrames(voiceEvidence, plan.lemma);
    plan.ergative = englishErgative(voiceEvidence, plan.lemma);
  }
  return { plans, voicePlans, sensesOf };
}
