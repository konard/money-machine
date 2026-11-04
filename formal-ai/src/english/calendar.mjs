/** Calendar dates use dictionary month classes, including learned variants. */
import { head } from './token-readings.mjs';

export function monthReading(token, lexicon) {
  for (const r of token?.readings || []) {
    const concepts = r.concepts.filter((id) =>
      lexicon?.get(id)?.classes?.includes('month')
    );
    if (concepts.length) {
      return { ...r, pos: 'noun', concepts };
    }
  }
  return null;
}

export function calendarAhead(c, offset = 0) {
  return Boolean(parseCalendarProbe(c, offset));
}

/**
 * "the 5th", "the 15th of each month", "the 1st of March": a numeric
 * ordinal standing alone names a day of the month.
 */
function parseOrdinalDay(c, lexicon, parseNP) {
  const k = c.peek?.lower === 'the' ? 1 : 0;
  const o = c.at(k);
  const next = c.at(k + 1);
  if (
    o?.kind !== 'ordinal' ||
    o.value < 1 ||
    o.value > 31 ||
    // "the 1st payment": an ordinal modifying a noun
    (next?.readings || []).some((r) => r.pos === 'noun')
  ) {
    return null;
  }
  c.i += k + 1;
  const np = {
    type: 'np',
    head: null,
    number: 'sg',
    adjs: [],
    def: 'def',
    calendar: { day: String(o.value), ordinal: true },
  };
  if (c.peek?.lower === 'of') {
    const month = monthReading(c.at(1), lexicon);
    if (month) {
      const token = c.at(1);
      const year = /^\d{4}$/.test(c.at(2)?.text || '') ? c.at(2).text : null;
      c.i += year ? 3 : 2;
      return {
        ...np,
        // "the 15th of March" is the date "15 March"
        def: null,
        head: head(token, month),
        calendar: { day: np.calendar.day, year },
      };
    }
    const save = c.i;
    c.i += 1;
    const of = parseNP?.(c);
    if (of) {
      np.of = of;
    } else {
      c.i = save;
    }
  }
  return np;
}

export function parseCalendar(c, lexicon, parseNP) {
  const ordinal = parseOrdinalDay(c, lexicon, parseNP);
  if (ordinal) {
    return ordinal;
  }
  const day =
    /^\d{1,2}$/.test(c.peek?.text || '') &&
    Number(c.peek.text) >= 1 &&
    Number(c.peek.text) <= 31 &&
    monthReading(c.at(1), lexicon)
      ? c.peek.text
      : null;
  const token = c.at(day ? 1 : 0);
  const r = monthReading(token, lexicon);
  if (!r) {
    return null;
  }
  const yearToken = c.at(day ? 2 : 1);
  const year = /^\d{4}$/.test(yearToken?.text || '') ? yearToken.text : null;
  if (!day && !year) {
    return null;
  }
  c.i += (day ? 2 : 1) + (year ? 1 : 0);
  return {
    type: 'np',
    head: head(token, r),
    number: 'sg',
    adjs: [],
    calendar: { day, year },
  };
}

/** A dated third-person predicate is finite even in a parenthetical note. */
export function calendarPredicate(c) {
  for (let k = 1; c.at(k); k += 1) {
    const t = c.at(k);
    if (t.kind === 'punct') {
      break;
    }
    if (
      t.readings?.some((r) => r.pos === 'verb' && r.features.form === '3sg') &&
      parseCalendarProbe(c, k + 1)
    ) {
      return c.i + k;
    }
  }
  return null;
}
function parseCalendarProbe(c, offset) {
  const probe = {
    i: 0,
    at: (k) => c.at(offset + k),
    get peek() {
      return c.at(offset);
    },
  };
  return parseCalendar(probe, c.grammar?.lexicon);
}
