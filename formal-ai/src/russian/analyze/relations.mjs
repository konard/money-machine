/** Invert shared relation/government tables, including multiword prepositions. */
import { RELATIONS } from '../words.mjs';
import { lower } from './tokenizer.mjs';
import { nounPhrase } from './phrase.mjs';
const canonical = (word) =>
  ({ во: 'в', со: 'с', ко: 'к', об: 'о', обо: 'о' })[word] || word;
const matches = (tokens, start, prep) =>
  prep
    .split(' ')
    .filter(Boolean)
    .every((word, j) => canonical(tokens[start + j]?.lower) === lower(word));
export function prepositional(tokens, start, ctx, entry = {}) {
  const specs = [];
  for (const [marker, gov] of Object.entries(entry.markerGovernment || {})) {
    specs.push({ relation: `rel.${marker}`, ...gov, priority: 3 });
  }
  if (entry.government?.preposition) {
    specs.push({ object: true, ...entry.government, priority: 4 });
  }
  for (const [kind, gov] of Object.entries(entry.classGovernment || {})) {
    if (gov.preposition) {
      specs.push({
        object: true,
        ...gov,
        requiresClasses: [kind],
        priority: 4,
      });
    }
  }
  // The generator's calendar/time/language/vehicle constructions are
  // selected by dictionary classes; their prepositions come from RELATIONS.
  const calendarPrep = RELATIONS['rel.in'].place[0];
  specs.push(
    {
      relation: 'rel.on',
      preposition: calendarPrep,
      case: 'acc',
      requiresClasses: ['weekday'],
      priority: 1,
    },
    {
      relation: 'rel.in',
      preposition: calendarPrep,
      case: 'prep',
      requiresClasses: ['month'],
      priority: 1,
    },
    {
      relation: 'rel.in',
      preposition: RELATIONS['rel.through'].place[0],
      case: 'acc',
      requiresClasses: ['time'],
      requiresQuantity: true,
      priority: 1,
    },
    {
      relation: 'rel.in',
      preposition: RELATIONS['rel.on'].place[0],
      case: 'prep',
      requiresClasses: ['language'],
      priority: 1,
    },
    {
      relation: 'rel.by',
      preposition: RELATIONS['rel.on'].place[0],
      case: 'prep',
      requiresClasses: ['vehicle'],
      priority: 1,
    }
  );
  for (const [relation, variants] of Object.entries(RELATIONS)) {
    for (const [variant, [preposition, kase, rule]] of Object.entries(
      variants
    )) {
      if (!preposition) {
        continue;
      }
      specs.push({ relation, preposition, case: kase, variant, priority: 0 });
      if (rule) {
        specs.push({
          relation,
          preposition: rule === 'on' ? 'на' : rule.slice(3),
          case: kase,
          variant,
          requiresOn: true,
          priority: 0,
        });
      }
    }
  }
  for (const [id, concept] of ctx.lexicon.concepts) {
    if (concept.ru?.pos === 'prep') {
      specs.push({
        relation: id,
        preposition: concept.ru.lemma,
        case: concept.ru.case || 'gen',
        priority: 1,
      });
    }
  }
  const found = specs
    .filter((s) => s.preposition && matches(tokens, start, s.preposition))
    .flatMap((spec) => {
      const length = spec.preposition.split(' ').length;
      if (tokens.slice(start, start + length).some((t) => ctx.used.has(t))) {
        return [];
      }
      const np = nounPhrase(tokens, start + length, ctx, spec.case);
      if (!np) {
        return [];
      }
      const concept = ctx.lexicon.get(np.entity.concept);
      if (spec.requiresOn && concept?.ru?.at !== 'на') {
        return [];
      }
      const person = np.entity.pronoun || concept?.ru?.animate;
      const classes = concept?.classes || [];
      if (
        spec.requiresClasses &&
        !spec.requiresClasses.some((c) => classes.includes(c))
      ) {
        return [];
      }
      if (spec.requiresQuantity && np.entity.quantity === undefined) {
        return [];
      }
      const fit =
        (spec.variant === 'person' && person) ||
        (spec.variant === 'time' && classes.includes('time')) ||
        (spec.variant === 'goal' && entry.motion) ||
        (spec.variant === 'place' && !person);
      return [
        {
          ...spec,
          np,
          length,
          score: spec.priority * 100 + length * 10 + (fit ? 2 : 0),
        },
      ];
    })
    .sort((a, b) => b.score - a.score);
  if (!found.length) {
    return null;
  }
  const best = found[0];
  const negation =
    tokens[start - 1]?.lower === 'не' && !ctx.used.has(tokens[start - 1])
      ? tokens[start - 1]
      : null;
  const alternatives = [
    ...new Set(
      found
        .filter((f) => f.score === best.score && !f.object)
        .map((f) => f.relation)
    ),
  ];
  return {
    ...best,
    modifier: {
      kind: 'relation',
      relation: best.relation,
      entity: best.np.entity,
      ...(negation ? { polarity: 'negative' } : {}),
      ...(alternatives.length > 1 ? { relationRange: alternatives } : {}),
    },
    consumed: [
      ...(negation ? [negation] : []),
      ...tokens.slice(start, start + best.length),
      ...best.np.consumed,
    ],
    end: best.np.end,
  };
}
