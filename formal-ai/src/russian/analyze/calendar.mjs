import { readOrdinalDay } from '../calendar.mjs';
import { nounPhrase } from './phrase.mjs';

function dayOfMonth(tokens, start, ctx, kase) {
  const day = readOrdinalDay(
    tokens[start]?.lower,
    tokens[start + 1]?.lower,
    kase
  );
  if (!day || ctx.used.has(tokens[start]) || ctx.used.has(tokens[start + 1])) {
    return null;
  }
  const of = nounPhrase(tokens, start + 2, ctx, 'gen');
  const hasMonth = of?.readings.some((r) => {
    const concept = ctx.lexicon.get(r.concept);
    return (
      concept?.classes?.includes('month') ||
      concept?.en?.some(
        (en) => en.pos === 'noun' && en.words?.join(' ') === 'month'
      )
    );
  });
  return {
    entity: {
      number: 'singular',
      definiteness: 'definite',
      calendar: { day, ordinal: true },
      ...(hasMonth ? { of: of.entity } : {}),
    },
    end: hasMonth ? of.end : start + 2,
  };
}

export function calendarModifier(tokens, start, ctx) {
  const by = ['к', 'ко'].includes(tokens[start].lower);
  const kase = by ? 'dat' : 'gen';
  const first = dayOfMonth(tokens, start + Number(by), ctx, kase);
  if (first) {
    const second =
      tokens[first.end]?.lower === 'и'
        ? dayOfMonth(tokens, first.end + 1, ctx, kase)
        : null;
    return {
      kind: 'relation',
      relation: by ? 'rel.by' : 'rel.on',
      entity: second
        ? {
            coordination: 'conj.and',
            items: [first.entity, second.entity],
            number: 'plural',
          }
        : first.entity,
      end: second?.end ?? first.end,
    };
  }
  const day = tokens[start].lower;
  if (!/^([1-9]|[12]\d|3[01])$/.test(day)) {
    return null;
  }
  const month = nounPhrase(tokens, start + 1, ctx, 'gen');
  const candidates = [
    ...new Set(
      month?.readings
        .filter((r) => ctx.lexicon.get(r.concept)?.classes?.includes('month'))
        .map((r) => r.concept)
    ),
  ];
  if (!candidates.length || month.end !== start + 2) {
    return null;
  }
  const year = /^\d{4}$/.test(tokens[month.end]?.lower)
    ? tokens[month.end].lower
    : null;
  const end =
    month.end + (year ? (tokens[month.end + 1]?.lower === 'г' ? 2 : 1) : 0);
  return {
    kind: 'time',
    entity: {
      concept: candidates[0],
      candidates,
      number: 'singular',
      calendar: { day, year },
    },
    end,
  };
}
