/** Russian calendar dates: «3 ноября 2026 г.», «5-го числа каждого месяца». */
import { declineNoun } from './morphology.mjs';

/** The day of a month is named with the noun число: «15-го числа». */
const DAY_OF_MONTH = { lemma: 'число', gender: 'n' };
/** Case endings written after an ordinal in digits: 5-го, 5-му, 5-м. */
const ORDINAL_ENDINGS = {
  nom: 'е',
  acc: 'е',
  gen: 'го',
  dat: 'му',
  ins: 'м',
  prep: 'м',
};

/** Is the entity, or each item of a pair, a day of a month? */
export const isCalendarDay = (e) =>
  Boolean(e?.calendar?.day || e?.items?.every((x) => x.calendar?.day));

export function renderCalendar(e, kase, ctx, renderEntity) {
  const { calendar, ...month } = e;
  if (calendar.ordinal) {
    return [
      `${calendar.day}-${ORDINAL_ENDINGS[kase]}`,
      declineNoun(DAY_OF_MONTH, kase),
      month.of && renderEntity(month.of, 'gen', ctx),
    ]
      .filter(Boolean)
      .join(' ');
  }
  const word = renderEntity(month, calendar.day ? 'gen' : kase, ctx);
  return [calendar.day, word, calendar.year && `${calendar.year} г.`]
    .filter(Boolean)
    .join(' ');
}

/** "on the 15th" → 15-го числа; "by the 15th" → к 15-му числу. */
export function calendarRelation(e, rel, ctx, renderEntity) {
  if (!isCalendarDay(e)) {
    return null;
  }
  if (rel === 'rel.by') {
    return `к ${renderEntity(e, 'dat', ctx)}`;
  }
  return ['rel.in', 'rel.on', 'rel.at'].includes(rel)
    ? renderEntity(e, 'gen', ctx)
    : null;
}
