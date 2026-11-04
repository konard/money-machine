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

export function calendarAhead(c) {
  return Boolean(parseCalendarProbe(c, 0));
}

export function parseCalendar(c, lexicon) {
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
