/** Offline dictionary abbreviations, calendar grammar and P498 amount evidence. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import { currencyPlans } from '../../formal-ai/src/sources/currencies.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const en = (pos, gloss, ru) =>
  `==English==\n===${pos}===\n# ${gloss}\n{{trans-top|${gloss}}}\n* Russian: {{t|ru|${ru}}}\n{{trans-bottom}}`;
const pages = {
  Jan: '==English==\n===Proper noun===\n# {{abbreviation of|en|January<id:Q108>}}.',
  Nov: '==English==\n===Proper noun===\n# {{abbr of|en|November}}.',
  Sept: '==English==\n===Proper noun===\n# {{alt form|en|Sep}}: {{abbreviation of|en|September}}.',
  January: en(
    'Proper noun',
    'The first month of the Gregorian calendar',
    'январь'
  ),
  November: en(
    'Proper noun',
    'The eleventh month of the Gregorian calendar',
    'ноябрь'
  ),
  September: en(
    'Proper noun',
    'The ninth month of the Gregorian calendar',
    'сентябрь'
  ),
  offer: `${en(
    'Noun',
    'An offer',
    'предложение'
  )}\n===Verb===\n# To offer\n{{trans-top|To offer}}\n* Russian: {{t|ru|предлагать}}\n{{trans-bottom}}`,
  end: `${en(
    'Verb',
    'To cease',
    'заканчиваться'
  )}\n===Noun===\n# An end\n{{trans-top|An end}}\n* Russian: {{t|ru|конец|m}}\n{{trans-bottom}}`,
  ends: '==English==\n===Verb===\n# {{inflection of|en|end||s-verb-form}}\n===Noun===\n# {{plural of|en|end}}',
  заканчиваться: '==Russian==\n===Verb===\n{{ru-verb|заканчиваться|impf}}',
  конец: '==Russian==\n===Noun===\n{{ru-noun|конец|m}}',
  example: en('Noun', 'An example', 'пример'),
  examples: '==English==\n===Noun===\n# {{plural of|en|example}}',
  check: en('Verb', 'To verify', 'проверять'),
  checked: '==English==\n===Verb===\n# {{past participle of|en|check}}',
  ...Object.fromEntries(
    ['январь', 'ноябрь', 'сентябрь', 'предложение', 'пример', 'талер'].map(
      (w) => [w, `==Russian==\n===Noun===\n{{ru-noun|${w}|m}}`]
    )
  ),
  проверять: '==Russian==\n===Verb===\n{{ru-verb|проверять|impf|pf=проверить}}',
  проверить: '==Russian==\n===Verb===\n{{ru-verb|проверить|pf|impf=проверять}}',
  предлагать: '==Russian==\n===Verb===\n{{ru-verb|предлагать|impf}}',
};
function api() {
  const requests = [];
  return {
    cache: false,
    requests,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const u = new URL(url);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : u.searchParams;
      requests.push(Object.fromEntries(p));
      let body = {};
      if (p.get('titles')) {
        body = {
          query: {
            pages: p
              .get('titles')
              .split('|')
              .map((title) => ({
                title,
                ...(pages[title]
                  ? {
                      revisions: [
                        { slots: { main: { content: pages[title] } } },
                      ],
                    }
                  : { missing: true }),
              })),
          },
        };
      } else if (p.get('action') === 'wbsearchentities') {
        body = { search: [{ id: 'Qfixture' }] };
      } else if (p.get('action') === 'wbgetentities') {
        body = {
          entities: {
            Qfixture: {
              labels: {
                en: { value: 'fixture currency' },
                ru: { value: 'талер' },
              },
              claims: { P498: [{ mainsnak: { datavalue: { value: 'XYZ' } } }] },
            },
          },
        };
      } else if (p.get('action') === 'parse') {
        body = {
          parse: {
            text:
              p.get('title') === 'проверить'
                ? '<span class="Cyrl form-of lang-ru past|pass|part-form-of">проверенный</span>'
                : '',
          },
        };
      } else if (p.get('list') === 'search') {
        body = { query: { search: [], searchinfo: { totalhits: 0 } } };
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}

test('variant templates retain all attested expansions, including short template aliases', () => {
  assert.deepEqual(
    englishEntries(pages.Sept)[0].formOf.map((f) => f.lemma),
    ['Sep', 'September']
  );
  assert.equal(englishEntries(pages.Nov)[0].formOf[0].lemma, 'November');
});

test('capital abbreviation variants inherit month senses and calendar cases', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('in Nov 2026; 27 Jan 2027; in Sept 2026', {
    lexicon,
    ...api(),
  });
  for (const [text, expected] of [
    ['27 Jan 2027', '27 января 2027 г.'],
    ['Nov 2026', 'Ноябрь 2026 г.'],
    ['in Nov 2026', 'В ноябре 2026 г.'],
    ['January 2026', 'Январь 2026 г.'],
    ['on 3 March', '3 марта'],
    ['in Sept 2026', 'В сентябре 2026 г.'],
  ]) {
    assert.equal(translateDocument(text, { lexicon }).text, expected, text);
  }
});

test('ISO claim verification rejects unrelated acronyms and translates either amount order', async () => {
  const fixture = api();
  assert.equal(
    (await currencyPlans('XYZ 300; 200 XYZ; ABC 10', fixture)).length,
    1
  );
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('XYZ 300', { lexicon, ...fixture });
  for (const [text, expected] of [
    ['XYZ 300', '300 талеров'],
    ['300 XYZ', '300 талеров'],
    ['up to XYZ 300', 'До 300 талеров'],
    ['XYZ 175-300', 'От 175 до 300 талеров'],
  ]) {
    assert.equal(translateDocument(text, { lexicon }).text, expected, text);
  }
  assert.ok(fixture.requests.some((p) => p.props?.includes('claims')));
});

test('a dated finite predicate stays a clause inside parentheses', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('(offer ends 27 Jan 2027)', { lexicon, ...api() });
  assert.equal(
    translateDocument('(offer ends 27 Jan 2027)', { lexicon }).text,
    '(предложение заканчивается 27 января 2027 г.)'
  );
});

test('a reduced participle keeps its bare date as a temporal adjunct', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('Examples checked Nov 2026: good.', { lexicon, ...api() });
  const result = translateDocument('Examples checked Nov 2026: good.', {
    lexicon,
  });
  assert.match(result.text, /Примеры, проверенные в ноябре 2026 г\./);
});
