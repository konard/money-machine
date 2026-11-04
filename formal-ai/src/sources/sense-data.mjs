/** Dictionary-derived evidence shared by the resolver and sense scorer. */
import { matchingDefinition } from './wiktionary.mjs';
import { PREPOSITIONS } from '../english/function-words.mjs';
import { changeOfState } from './reflexive.mjs';
import { topicalLabel } from './label-data.mjs';

export function publicSenses(entries, title, pos) {
  const own = entries.get(title) || [];
  const sub = (entries.get(`${title}/translations`) || []).filter(
    (e) => e.pos === pos
  );
  // a translation subpage has no definitions: match the main page's
  const mainDefinitions = own
    .filter((e) => e.pos === pos)
    .flatMap((e) => e.rawDefinitions || []);
  const subSenses = sub.map((e) => ({
    ...e,
    senses: e.senses.map((x) =>
      x.definition
        ? x
        : { ...x, ...matchingDefinition(x.gloss, mainDefinitions) }
    ),
  }));
  const chunks = [...own.filter((e) => e.pos === pos), ...subSenses];
  // "march" the walk before "March" the month; "january" has only that
  const lower = own.some((e) => !e.capital && e.senses.length);
  // "phone" (the device): its entry's only translations are those of
  // "telephone" — the word's own meaning; "pen" (the feather) with
  // tables of its own and a pointer to "wing" — a side meaning
  return chunks.flatMap((e) => [
    ...e.senses.map((x) => ({
      ...x,
      ...(e.capital && lower ? { side: true } : {}),
      capital: e.capital,
      rare: e.rare || x.rare,
    })),
    ...e.see.flatMap((s) => {
      const senses = (entries.get(s.page) || [])
        .filter((x) => x.pos === pos)
        .flatMap((x) =>
          x.senses
            .filter(
              (sense) =>
                !s.synonym ||
                (s.thesaurus
                  ? sense ===
                    [...x.senses].sort(
                      (a, b) => (b.languages || 0) - (a.languages || 0)
                    )[0]
                  : referenceFits(s.gloss, sense))
            )
            .map((sense) => ({
              ...sense,
              ...(s.synonym
                ? {
                    languages:
                      e.senses.find((own) => own.gloss === s.gloss)
                        ?.languages || 0,
                  }
                : {}),
              ...(s.synonym ||
              x.senses.length === 1 ||
              referenceFits(s.gloss, sense)
                ? matchingDefinition(s.gloss, mainDefinitions)
                : {}),
              rare:
                e.rare ||
                sense.rare ||
                matchingDefinition(s.gloss, mainDefinitions).rare,
              gloss: `${s.gloss}: ${sense.gloss}`,
              seeAlso: true,
              side:
                !s.synonym &&
                e.senses.length > 0 &&
                !(
                  pos === 'adj' &&
                  matchingDefinition(s.gloss, mainDefinitions).definition &&
                  (x.senses.length === 1 || referenceFits(s.gloss, sense))
                ),
              referenceMatch:
                s.synonym ||
                x.senses.length === 1 ||
                referenceFits(s.gloss, sense),
            }))
        );
      return senses.some((sense) => sense.referenceMatch)
        ? senses
        : [
            ...senses,
            {
              gloss: s.gloss,
              russian: [],
              ...matchingDefinition(s.gloss, mainDefinitions),
            },
          ];
    }),
  ]);
}

/** A translation pointer names a meaning, not every homonym of its target. */
export function referenceFits(gloss, sense) {
  const want = glossWords(gloss);
  const have = new Set(glossWords(`${sense.gloss} ${sense.definition || ''}`));
  return (
    want.length > 0 &&
    want.filter((w) => have.has(w)).length / want.length >= 0.75
  );
}

export function genus(definition = '') {
  const words = definition.toLowerCase().match(/[a-z]+/g) || [];
  return words.find((w) => !/^(the|a|an|any|one|some|of|to)$/.test(w));
}

/** Empty tables can inherit a sibling translation with the same genus. */
export function borrowGenus(senses) {
  return senses.map((s) => {
    if (s.russian.length || !s.definition) {
      return s;
    }
    const head = hypernym(s.definition);
    const sibling = senses.find(
      (x) =>
        x !== s &&
        x.russian.length &&
        !x.variant &&
        head &&
        hypernym(x.definition) === head
    );
    return sibling ? { ...s, russian: sibling.russian, borrowed: true } : s;
  });
}

export function usagePenalty(sense) {
  if (
    sense.rare ||
    /^(?:rare|obsolete|archaic|dated):/i.test(sense.gloss || '')
  ) {
    return 1;
  }
  return 0;
}

/**
 * The head noun of a definition: the last word before its first
 * qualifier ("The first month of the Gregorian calendar" → month, "The
 * day after Sunday" → day, "A tool used for writing" → tool).
 */
export function hypernym(text = '') {
  const words = (text.toLowerCase().match(/[a-z]+|[,;.()]/g) || []).filter(
    (w) =>
      !/^(?:the|a|an|any|some|traditionally|usually|typically|often|especially)$/.test(
        w
      )
  );
  const stop = words.findIndex(
    (w, k) =>
      k > 0 &&
      /^(?:of|after|before|in|into|on|onto|at|by|to|that|which|whose|whom|who|for|used|with|from|between|when|where|[,;.(])$/.test(
        w
      )
  );
  const head = (stop < 0 ? words : words.slice(0, stop)).filter((w) =>
    /^[a-z]{3,}$/.test(w)
  );
  const last = head[head.length - 1] || null;
  // "the second of the four seasons", "a kind of tree": the head is the
  // noun after "of"
  if (
    last &&
    words[stop] === 'of' &&
    /^(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|last|one|kind|type|sort|member|part|piece|any)$/.test(
      last
    )
  ) {
    const inner = hypernym(words.slice(stop + 1).join(' '));
    return inner?.replace(/(?<=[^s])s$/, '') || last;
  }
  return last;
}

const TIME_HYPERNYMS = new Set([
  'day',
  'month',
  'season',
  'year',
  'week',
  'period',
  'time',
  'hour',
  'minute',
]);

/**
 * Semantic classes of a dictionary sense from its definition and gloss:
 * the hypernym, and the time classes the grammar uses (a month takes
 * "в январе", a weekday "в понедельник").
 */
export function senseClasses(sense) {
  const text = `${sense.definition || ''} ${sense.gloss || ''}`.toLowerCase();
  const head = hypernym(sense.gloss) || hypernym(sense.definition);
  const classes = head ? [head] : [];
  if (TIME_HYPERNYMS.has(head) || /\bmonth\b|\bday of the week\b/.test(text)) {
    classes.push('time');
  }
  if (
    /\bday of the week\b|^(?:day|the day) (?:after|before) [a-z]+day\b/.test(
      text
    ) ||
    (head === 'day' && /\bweek\b/.test(text))
  ) {
    classes.push('weekday');
  } else if (
    head === 'month' ||
    /\bmonth of the (?:gregorian|julian) calendar\b/.test(text)
  ) {
    classes.push('month');
  } else if (head === 'season') {
    classes.push('season');
  }
  return [...new Set(classes)];
}

const STOP = new Set(
  'the a an of to in on for and or by with from at as is are be that which who someone something one ones its it their used being made having into out up over than such any some other e g etc especially usually typically not nor whether but if then this that these those they them was were has have had can may might will would should must all more most very also only'.split(
    ' '
  )
);
Object.keys(PREPOSITIONS).forEach((word) => STOP.add(word));

/** Labels that say how a word is used, not what field it belongs to. */
const USAGE_LABEL =
  /^(?:transitive|intransitive|ditransitive|catenative|ambitransitive|ergative|reflexive|countable|uncountable|euphemism|euphemistic|vulgar|offensive|derogatory|pejorative|humorous|jocular|sarcastic|ironic|dialectal|nonstandard|proscribed|endearing|literary|poetic|informal|colloquial|slang|figurative(?:ly)?|formal|literal(?:ly)?|idiomatic|attributive|plural|singular|in the plural|by extension|now|often|usually|especially|also|chiefly|mainly|sometimes|rare|obsolete|archaic|dated|US|UK|British|American|Canada|Australia|Ireland|NZ|India|Scotland|with|of|_|and|or)$/i;
/**
 * Field of a sense: a field label of its definition (finance, computing)
 * or the field prefix of its translation gloss ("law: demand for…").
 */
export function senseDomain(sense) {
  const label = (sense.labels || []).find((l) => isField(l));
  if (label) {
    return label.toLowerCase();
  }
  const prefix = /^([a-z][a-z ]{2,20}): /.exec(sense.gloss)?.[1];
  return !sense.seeAlso && prefix && isField(prefix) ? prefix : null;
}

/** Wiktionary's topical label list decides; the pattern only stands in offline. */
function isField(label) {
  const known = topicalLabel(label);
  if (known !== undefined) {
    return Boolean(known);
  }
  return (
    /^[a-z][a-z -]{2,24}$/i.test(label) &&
    !USAGE_LABEL.test(label) &&
    label !== 'distributive' &&
    !/^(?:of|with|in|usually|often|chiefly)\b/i.test(label)
  );
}
/** Content words of a gloss, used as context cues. */
export function glossWords(gloss, headword = '', verb = false) {
  const text = gloss
    .toLowerCase()
    // "… See grammatical person.": a cross-reference, no context
    .replace(/(?:^|[.;(]\s*)see(?: also)? [^.;)]*/g, ' ');
  return [
    ...new Set(
      (verb ? lightVerbNouns(text) : text)
        .split(/[^a-z]+/)
        .filter((w) => w.length > 2 && !STOP.has(w) && w !== headword)
    ),
  ];
}

/**
 * "heed; pay attention; regard": a two-word synonym in a verb's list is a
 * verb and its noun, and the noun carries the meaning ("pay" alone is no
 * cue for this sense of "depend").
 */
export function lightVerbNouns(text) {
  return text.replace(
    /([;,]\s*)(?:to\s+)?[a-z]+\s+([a-z]+)(?=\s*(?:[;,.)]|$))/g,
    '$1$2'
  );
}

/** A conceptual alias is not automatically a fixed phrase in this sentence. */
export function compoundFits(plan, text) {
  const own = new Set(plan.lemma.split(' '));
  const first = plan.lemma.split(' ')[0];
  const local = text
    .split(/[.!?\n]+/)
    .filter((s) =>
      s
        .toLowerCase()
        .split(/[^a-z]+/)
        .includes(first)
    )
    .join(' ');
  const context = new Set(glossWords(local));
  return plan.senses.some((s) =>
    glossWords(s.gloss).some((w) => !own.has(w) && context.has(w))
  );
}

/** Separate object-qualified translations from unrestricted synonyms. */
export function collocationSenses(senses) {
  return senses.flatMap((s) => {
    const ordinary = s.russian.filter((c) => !c.objectLemma);
    const objects = [
      ...new Set(s.russian.map((c) => c.objectLemma).filter(Boolean)),
    ];
    return [
      ...(ordinary.length
        ? [{ ...s, russian: ordinary }]
        : objects.length
          ? []
          : [s]),
      ...objects.map((objectLemma) => ({
        ...s,
        objectLemma,
        russian: s.russian.filter((c) => c.objectLemma === objectLemma),
      })),
    ];
  });
}

/** Link only reflexive counterparts attested for this English predicate. */
export function linkReflexiveSenses(plans, lexicon, attested = () => null) {
  // Evidence comes from English translations or Russian dictionary links.
  for (const plan of plans.filter((p) => p.pos === 'verb')) {
    const frames = plans
      .filter((p) => p.lemma === plan.lemma)
      .flatMap(
        (p) => p.voiceFrames || p.senses?.flatMap((s) => s.frames || []) || []
      );
    const middleOnly = !frames.includes('intransitive');
    // a counterpart known only from the Russian dictionary may be a meaning
    // of its own (платиться "to pay for it"): it needs an English verb whose
    // subject undergoes the event, or a middle use of a transitive-only one
    const undergoes =
      middleOnly || plans.some((p) => p.lemma === plan.lemma && p.ergative);

    const concepts = lexicon
      .lookup('verb', plan.lemma)
      .map((id) => lexicon.get(id));
    for (const c of concepts) {
      if (!c.ru || /с[яь]$/.test(c.ru.lemma)) {
        continue;
      }
      if (
        c.frames?.includes('intransitive') &&
        !c.frames.includes('transitive')
      ) {
        continue;
      }
      const reflexive = concepts.find(
        (other) => other.ru?.lemma === `${c.ru?.lemma}ся`
      );
      const middle =
        c.frames?.includes('transitive') && !c.frames.includes('intransitive');
      const counterpart =
        reflexive?.ru || (undergoes || middle ? attested(c.ru, plan) : null);
      if (counterpart) {
        c.ru.intransitive = counterpart;
        c.ru.intransitiveMiddleOnly = middleOnly || middle;
        c.ru.intransitiveRussian = !reflexive;
        // the same meaning in another voice, or a change of state ("to come
        // to an end"), happens to a thing; a reflexive meaning of its own
        // ("to gather": встречаться) is done by people as well
        c.ru.anticausative =
          !reflexive ||
          reflexive.gloss === c.gloss ||
          changeOfState(reflexive.definition || reflexive.gloss);
      }
    }
  }
}
