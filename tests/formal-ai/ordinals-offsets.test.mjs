/** Days of the month by ordinal ("the 15th") and time offsets ("2 days after"). */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../formal-ai/src/english/analyze.mjs';
import { Cursor } from '../../formal-ai/src/english/cursor.mjs';
import { offsetModifier } from '../../formal-ai/src/english/time-phrase.mjs';
import {
  calendarRelation,
  renderCalendar,
} from '../../formal-ai/src/russian/calendar.mjs';

test('"15th," is one ordinal token with its number', () => {
  const tokens = tokenize('on the 15th, paid');
  const ordinal = tokens.find((t) => t.kind === 'ordinal');
  assert.equal(ordinal.text, '15th');
  assert.equal(ordinal.value, 15);
  assert.ok(tokens.some((t) => t.text === ','));
});

const month = (kase) => `[month.${kase}]`;
const day = (n, extra = {}) => ({
  calendar: { day: n, ordinal: true },
  ...extra,
});

test('an ordinal day is «N-го числа», declined in the case asked', () => {
  assert.equal(renderCalendar(day('5'), 'gen', {}, month), '5-го числа');
  assert.equal(renderCalendar(day('15'), 'dat', {}, month), '15-му числу');
  assert.equal(renderCalendar(day('1'), 'ins', {}, month), '1-м числом');
  assert.equal(
    renderCalendar(day('15', { of: {} }), 'gen', {}, (_, kase) => `[${kase}]`),
    '15-го числа [gen]'
  );
});

test('"on the 15th" is the genitive, "by the 15th" a deadline with к', () => {
  const render = (e, kase) => renderCalendar(e, kase, {}, month);
  assert.equal(
    calendarRelation(day('15'), 'rel.on', {}, render),
    '15-го числа'
  );
  assert.equal(
    calendarRelation(day('15'), 'rel.by', {}, render),
    'к 15-му числу'
  );
  assert.equal(calendarRelation(day('15'), 'rel.for', {}, render), null);
  assert.equal(calendarRelation({ concept: 'x' }, 'rel.on', {}, render), null);
});

test('a counted time span before after/before is an offset', () => {
  const after = { readings: [{ pos: 'prep', concepts: ['rel.after'] }] };
  const into = { readings: [{ pos: 'prep', concepts: ['rel.in'] }] };
  const days = { head: { lemma: 'day', candidates: [] }, quantity: 2 };
  const pens = { head: { lemma: 'pen', candidates: [] }, quantity: 2 };
  assert.deepEqual(offsetModifier(new Cursor([after]), days), {
    type: 'pp',
    relation: 'rel.after',
    offset: true,
    np: days,
  });
  assert.equal(offsetModifier(new Cursor([into]), days), null);
  assert.equal(offsetModifier(new Cursor([after]), pens), null);
  assert.equal(
    offsetModifier(new Cursor([after]), { ...days, quantity: undefined }),
    null
  );
});
