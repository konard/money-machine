/** Offline grammar regressions for parallel facts and reduced passives. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { attestRussian } from './russian-fixture.mjs';
import { sameFormPasts } from '../../formal-ai/src/forms.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const section = (pos, ru, grammar = '') =>
  `===${pos}===\n${grammar}\n# A fixture meaning.\n{{trans-top|fixture meaning}}\n* Russian: {{t|ru|${ru}${pos === 'Noun' ? `|${ru.endsWith('ь') ? 'f' : 'm'}` : ''}}}\n{{trans-bottom}}`;
async function vocabulary() {
  const lexicon = loadLexicon({ fresh: true });
  const pages = attestRussian({
    cost: `==English==\n${section('Noun', 'стоимость')}\n${section('Verb', 'стоить')}`,
    annual: `==English==\n${section('Adjective', 'ежегодный')}\n${section('Noun', 'ежегодник')}`,
    local: `==English==\n${section('Adjective', 'местный')}`,
    director: `==English==\n${section('Noun', 'директор')}`,
    require: `==English==\n${section('Verb', 'требовать')}`,
    required: `==English==\n${section('Adjective', 'обязательный')}`,
    median: `==English==\n${section('Adjective', 'медианный')}`,
    at: `==English==\n${section('Noun', 'собака')}`,
    net: `==English==\n${section('Noun', 'сеть').replaceAll('A fixture meaning.', 'An interconnecting system; a number of interconnections.')}\n${section('Adjective', 'чистый')}\n${section('Adverb', 'нетто')}\n===Noun===\n# The amount remaining after expenses are deducted.\n{{trans-top|amount remaining after expenses are deducted, profit}}\n* French: {{t|fr|net|m}}\n{{trans-bottom}}`,
    profit: `==English==\n${section('Noun', 'прибыль')}`,
    match: `==English==\n${section('Verb', 'соответствовать')}`,
    app: `==English==\n${section('Noun', 'приложение')}`,
    stay: `==English==\n${section('Verb', 'оставаться')}`,
    set: `==English==\n${section('Verb', 'устанавливать', '{{en-verb|sets|setting|~|~}}')}`,
    cut: `==English==\n${section('Verb', 'сокращать', '{{en-verb|cuts|cutting|~|~}}')}`,
    put: `==English==\n${section('Verb', 'класть', '{{en-verb|puts|putting|~|~}}')}`,
    likelihood: `==English==\n${section('Noun', 'вероятность')}`,
  });
  const fetchImpl = (url, options) => {
    assert.equal(options.headers['user-agent'], USER_AGENT);
    const p = options.body
      ? new URLSearchParams(options.body)
      : new URL(url).searchParams;
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          query: {
            pages: (p.get('titles') || '').split('|').map((title) =>
              pages[title]
                ? {
                    title,
                    revisions: [{ slots: { main: { content: pages[title] } } }],
                  }
                : { title, missing: true }
            ),
            searchinfo: { totalhits: 0 },
          },
        }),
    });
  };
  await resolveText('', {
    lexicon,
    words: Object.keys(pages),
    fetchImpl,
    cache: false,
  });
  await sameFormPasts('set cut put', { lexicon, fetchImpl, cache: false });
  return lexicon;
}

test('parallel amounts and colon answers are facts, not commands', async () => {
  const lexicon = await vocabulary();
  for (const text of [
    'Cost $0, annual $0, about 1 days, local director required: no.',
    'Cost about $300, annual $2,500, about 15 days, local director required: yes.',
    'Local director required: no.',
    'Price $5, local director: yes.',
  ]) {
    const p = parseSentence(text, lexicon);
    assert.deepEqual(p.leftover, [], text);
    assert.deepEqual(p.unknown, [], text);
    assert.ok(
      p.clauses.every((c) => c.type === 'fragment'),
      text
    );
    assert.ok(
      p.clauses.some((c) => c.answer),
      text
    );
    const ru = translateDocument(text, { lexicon }).text;
    assert.match(ru, /: (да|нет)\./, text);
    assert.doesNotMatch(ru, /\[|Стойте|ежегодник|потребован/);
  }
  for (const text of [
    'Buy 3 books, read 2 books.',
    'Cost the project carefully.',
    'The price is $5, the books cost $10.',
    'Cost: book the bank account.',
  ]) {
    assert.ok(
      parseSentence(text, lexicon).clauses.some((c) => c.type === 'clause'),
      text
    );
  }
  assert.match(
    translateDocument('The bank pays $3/month net at month 6.', { lexicon })
      .text,
    /нетто/
  );
});

test('headline subjects retain numbered adjuncts and reduced passive purpose clauses', async () => {
  const lexicon = await vocabulary();
  for (const text of [
    'Median net at month 12 set to $40 to buy the book.',
    'Median net at month 12 set to $60 to match the 25% profit likelihood (most new apps stay under $100/month).',
    'Price set to $40 to buy the book.',
    'Price cut by $5.',
    'Money put at the bank.',
    'Money paid to the bank.',
  ]) {
    const p = parseSentence(text, lexicon);
    assert.deepEqual(p.leftover, [], text);
    const c = p.clauses[0];
    assert.equal(c.passive, true, text);
    assert.ok(c.subject.head, text);
    if (text.startsWith('Median')) {
      assert.equal(c.subject.head.lemma, 'net');
      assert.equal(c.subject.pps[0].np.label, '12');
      assert.equal(c.xcomp.purpose, true);
      const ru = translateDocument(text, { lexicon }).text;
      assert.match(ru, /Медианная прибыль.*12.*чтобы/);
      assert.doesNotMatch(ru, /сеть|собак/);
    }
  }
  for (const text of [
    'The bank paid the man.',
    'I cut the book.',
    'Dogs put money at the bank.',
  ]) {
    assert.equal(parseSentence(text, lexicon).clauses[0].passive, false, text);
  }
});
