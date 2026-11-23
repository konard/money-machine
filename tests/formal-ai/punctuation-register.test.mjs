import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  russianEntry,
  russianParenthetic,
} from '../../formal-ai/src/russian-entry.mjs';
import {
  markParenthetic,
  punctuateParenthetics,
} from '../../formal-ai/src/russian/parenthetic.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import { publicSenses } from '../../formal-ai/src/sources/sense-data.mjs';

test('Russian parenthetic marks are dictionary data, including multiword and ruwiki marks', () => {
  for (const mark of [
    '{{gloss|parenthetic word}}',
    '{{lb|ru|parenthetical}}',
    '{{gloss|parenthetical}}',
  ]) {
    assert.equal(
      russianEntry(
        'adv',
        'например',
        { forms: new Map() },
        null,
        `==Russian==\n===Adverb===\n{{ru-adv|наприме́р}} ${mark}`
      ).parenthetic,
      true
    );
  }
  for (const mark of ['вводное слово', '{{помета|вводн.}}']) {
    assert.equal(russianParenthetic(`={{-ru-}}=\n# ${mark}`), true);
  }
  assert.equal(
    russianParenthetic(
      '==English==\n{{gloss|parenthetical}}\n==Russian==\n===Adverb===\n# Ordinary adverb.'
    ),
    false
  );
  const mark = (text) =>
    text.replace(/(?<!\p{L})(например|как правило)(?!\p{L})/giu, (word) =>
      markParenthetic(word, { parenthetic: true })
    );
  for (const [input, output] of [
    ['Например Canva', 'Например, Canva'],
    ['Инструменты, например Canva.', 'Инструменты, например, Canva.'],
    ['Инструменты например Canva.', 'Инструменты, например, Canva.'],
    ['(например eBay)', '(например, eBay)'],
    ['(например)', '(например)'],
    ['«Например Canva»', '«Например, Canva»'],
    ['например как правило Canva', 'например, как правило, Canva'],
    ['как правило, это работает', 'как правило, это работает'],
    ['Это, например, работает.', 'Это, например, работает.'],
    ['Напримеры', 'Напримеры'],
    ['Например, 7,5%.', 'Например, 7,5%.'],
  ]) {
    assert.equal(punctuateParenthetics(mark(input)), output);
    assert.equal(punctuateParenthetics(mark(output)), output);
  }
  assert.equal(punctuateParenthetics('Это возможно.'), 'Это возможно.');
  assert.equal(
    punctuateParenthetics(
      `${markParenthetic('Возможно', { parenthetic: true })} это возможно.`
    ),
    'Возможно, это возможно.'
  );
});

function vocabulary() {
  const lexicon = loadLexicon({ fresh: true });
  const add = (id, pos, word, ru, cues = []) =>
    lexicon.add({
      id: `register:${id}`,
      source: 'fixture',
      en: [{ pos, lemma: word, words: [word] }],
      ru,
      cues,
      classes: [],
    });
  add('remark', 'adj', 'optional', {
    pos: 'adj',
    lemma: 'необязательный',
    shortForms: { m: 'необязателен', n: 'необязательно' },
  });
  add('earnings', 'noun', 'income', {
    pos: 'noun',
    lemma: 'доход',
    gender: 'm',
  });
  add('middle', 'adj', 'median', { pos: 'adj', lemma: 'медианный' });
  add('liberty', 'adj', 'free', { pos: 'adj', lemma: 'свободный' }, [
    'unconstrained',
  ]);
  add('price', 'adj', 'free', { pos: 'adj', lemma: 'бесплатный' }, ['payment']);
  add('tariff', 'noun', 'plan', { pos: 'noun', lemma: 'план', gender: 'm' });
  add('release', 'verb', 'free', { pos: 'verb', lemma: 'освобождать' });
  add('level', 'noun', 'tier', { pos: 'noun', lemma: 'ярус', gender: 'm' });
  add('obtainable', 'adj', 'available', {
    pos: 'adj',
    lemma: 'доступный',
    short: 'доступен',
    shortForms: { m: 'доступен' },
  });
  add(
    'access',
    'noun',
    'subscription',
    { pos: 'noun', lemma: 'подписка', gender: 'f' },
    ['payment']
  );
  return lexicon;
}

test('final adjective remarks after names use attested short forms; noun lists agree', () => {
  const lexicon = vocabulary();
  assert.equal(
    translateDocument('Pay via PayPal (optional).', { lexicon }).text,
    'Платите через PayPal (необязательно).'
  );
  assert.equal(
    translateDocument('Income (low, median, high).', { lexicon }).text,
    'Доход (низкий, медианный, высокий).'
  );
});

test('head definitions select adjective senses without domain labels or word rules', () => {
  const lexicon = vocabulary();
  assert.equal(
    translateDocument('A free subscription.', { lexicon }).text,
    'Бесплатная подписка.'
  );
  assert.equal(
    translateDocument('A free plan.', {
      lexicon,
      topic: 'The plan requires payment. The plan has a payment.',
    }).text,
    'Бесплатный план.'
  );
});

test('an explicitly defined sense keeps its status when translations live on another page', () => {
  const entries = new Map([
    [
      'free',
      englishEntries(
        '==English==\n===Adjective===\n# Not imprisoned.\n# Obtainable without any payment.\n{{trans-top|not imprisoned}}\n* Russian: {{t|ru|свободный}}\n{{trans-bottom}}\n{{trans-see|obtainable without payment|free of charge}}'
      ),
    ],
    [
      'free of charge',
      englishEntries(
        '==English==\n===Adjective===\n# Not requiring any payment.\n{{trans-top|not requiring any payment}}\n* Russian: {{t|ru|бесплатный}}\n{{trans-bottom}}'
      ),
    ],
  ]);
  const sense = publicSenses(entries, 'free', 'adj').find((s) =>
    s.russian.some((r) => r.word === 'бесплатный')
  );
  assert.equal(sense.side, false);
  assert.match(sense.definition, /payment/);
});

test('a complete headline with omitted copula outranks an incomplete imperative', () => {
  const lexicon = vocabulary();
  const result = translateDocument('Free tier available.', {
    lexicon,
    topic: 'The tier requires payment. The tier has a payment.',
  });
  assert.equal(result.text, 'Бесплатный ярус доступен.');
  assert.equal(result.stats.incomplete, 0);
});

test('resolveText preserves Russian parenthetic annotations from fetched pages', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const pages = {
    illustratively:
      '==English==\n===Adverb===\n# For example.\n{{trans-top|for example}}\n* Russian: {{t|ru|например}}\n{{trans-bottom}}',
    например:
      '==Russian==\n===Adverb===\n{{ru-adv|наприме́р}} {{gloss|parenthetic word}}\n# For example.',
    customarily:
      '==English==\n===Adverb===\n# As a rule.\n{{trans-top|as a rule}}\n* Russian: {{t|ru|как правило}}\n{{trans-bottom}}',
    'как правило':
      '==Russian==\n===Adverb===\n{{ru-adv|как пра́вило}} {{lb|ru|parenthetical}}\n# As a rule.',
  };
  await resolveText('', {
    words: ['illustratively', 'customarily'],
    lexicon,
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const u = new URL(url);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : u.searchParams;
      const titles = p.get('titles');
      const body = titles
        ? {
            query: {
              pages: titles.split('|').map((title) =>
                pages[title]
                  ? {
                      title,
                      revisions: [
                        { slots: { main: { content: pages[title] } } },
                      ],
                    }
                  : { title, missing: true }
              ),
            },
          }
        : p.get('action') === 'parse'
          ? { parse: { text: '' } }
          : { query: { searchinfo: { totalhits: 0 } }, search: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  });
  assert.equal(
    lexicon.get(lexicon.lookup('adv', 'illustratively')[0]).ru.parenthetic,
    true
  );
  assert.equal(
    lexicon.get(lexicon.lookup('adv', 'customarily')[0]).ru.parenthetic,
    true
  );
  assert.equal(
    translateDocument('(illustratively eBay).', { lexicon }).text,
    '(например, eBay).'
  );
});
