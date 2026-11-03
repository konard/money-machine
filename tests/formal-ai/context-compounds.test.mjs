/** Offline public-API fixtures for context and productive compound modifiers. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveNames, resolveText } from '../../formal-ai/src/resolve.mjs';
import { analyze } from '../../formal-ai/src/english/analyze.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { declineNoun } from '../../formal-ai/src/russian/morphology.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const entry = (pos, ru, gender = '') =>
  `==English==\n===${pos}===\n# A fixture.\n{{trans-top|fixture}}\n* Russian: {{t|ru|${ru}|${gender}}}\n{{trans-bottom}}`;
function fixture(pages = {}, entities = {}) {
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
      let body;
      if (p.get('action') === 'wbsearchentities') {
        body = {
          search: Object.keys(entities)
            .filter((id) => id !== 'Qtype')
            .map((id) => ({ id, label: p.get('search') })),
        };
      } else if (p.get('action') === 'wbgetentities') {
        body = {
          entities: Object.fromEntries(
            p
              .get('ids')
              .split('|')
              .map((id) => [id, entities[id]])
          ),
        };
      } else if (p.get('action') === 'parse') {
        body = {
          parse: {
            text:
              p.get('title') === 'пересылать'
                ? '<span class="Cyrl form-of lang-ru past|pass|part-form-of">пересланный</span>'
                : '',
          },
        };
      } else if (p.get('titles')) {
        body = {
          query: {
            pages: p
              .get('titles')
              .split('|')
              .map((title) =>
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
        };
      } else if (u.host === 'ru.wikipedia.org') {
        body = { query: { searchinfo: { totalhits: 0 } } };
      } else {
        throw Object.assign(new Error(`Unexpected request ${url}`), {
          fatal: true,
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}

const entities = {
  Qmedical: {
    labels: { ru: { value: 'иммуногистохимическое исследование' } },
    descriptions: { en: { value: 'medical laboratory tissue testing' } },
    sitelinks: { enwiki: {}, ruwiki: {}, dewiki: {} },
  },
  Qbusiness: {
    labels: { ru: { value: 'Торговая палата' } },
    descriptions: { en: { value: 'German organization' } },
    aliases: { en: [{ value: 'chamber of commerce' }] },
    claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Qtype' } } } }] },
    sitelinks: { dewiki: {} },
  },
  Qtype: { labels: { en: { value: 'company registration authority' } } },
};

test('entity descriptions, aliases and instance labels outrank sitelinks; no context retains popularity', async () => {
  for (const [topic, expected] of [
    ['', 'Qmedical'],
    ['German commerce', 'Qbusiness'],
    ['company registration', 'Qbusiness'],
    ['medical tissue testing', 'Qmedical'],
  ]) {
    const lexicon = loadLexicon({ fresh: true });
    const api = fixture({}, entities);
    const hits = await resolveNames(['IHK'], { lexicon, topic, ...api });
    assert.equal(hits.get('IHK'), expected, topic);
    assert.ok(api.requests.some((r) => r.props?.includes('descriptions')));
  }
});

test('resolveText forwards the document topic to name resolution', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('Register with the IHK.', {
    lexicon,
    topic: 'German company registration commerce',
    ...fixture({}, entities),
  });
  assert.equal(lexicon.nameLabel('IHK'), 'Торговая палата');
});

test('hyphenated modifiers prefer whole and spaced dictionary entries before composing parts', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const pages = {
    'all-in': entry('Adjective', 'полный'),
    'royalty free': entry('Adjective', 'бесплатный'),
    high: entry('Adjective', 'высокий'),
    yield: entry('Noun', 'доход', 'm'),
    print: entry('Noun', 'печать', 'f'),
    demand: entry('Noun', 'требование', 'n'),
    pay: entry('Adjective', 'платный'),
    click: entry('Noun', 'щелчок', 'm'),
    service: entry('Noun', 'услуга', 'f'),
    royalty: entry('Noun', 'выплата', 'f'),
    fee: entry('Noun', 'плата', 'f'),
    charge: entry('Verb', 'взимать'),
    charging: '==English==\n===Verb===\n# {{present participle of|en|charge}}',
    login: entry('Noun', 'вход', 'm'),
    token: entry('Noun', 'жетон', 'm'),
    forward: entry('Verb', 'пересылать'),
    forwarded: '==English==\n===Verb===\n# {{past participle of|en|forward}}',
    пересылать: '==Russian==\n===Verb===\n{{ru-verb|пересылать|impf}}',
    // Russian entries attest candidates; endings alone are no longer enough.
    ...Object.fromEntries(
      [
        ['Adjective', 'adj', 'полный бесплатный высокий платный'],
        [
          'Noun',
          'noun',
          'доход печать требование щелчок услуга выплата плата вход жетон',
        ],
        ['Verb', 'verb', 'взимать'],
      ].flatMap(([pos, template, words]) =>
        words
          .split(' ')
          .map((word) => [
            word,
            `==Russian==\n===${pos}===\n{{ru-${template}|${word}}}`,
          ])
      )
    ),
    sponsorship: entry('Noun', 'спонсорство', 'n'),
    спонсорство: '==Russian==\n===Noun===\n{{ru-noun|спонсорство|n}}',
  };
  const api = fixture(pages);
  const words = [
    'fee-charging',
    'login-only',
    'token-free',
    'royalty-free',
    'all-in',
    'sponsorship',
    'service',
    'auto-forwarded',
    'high-yield',
    'print-on-demand',
    'pay-per-click',
  ];
  await resolveText('', { words, lexicon, ...api });
  const adjective = (word) =>
    lexicon.get(lexicon.lookup('adj', word)[0])?.ru.lemma;
  assert.equal(adjective('fee-charging'), 'взимающий плату');
  assert.equal(adjective('login-only'), 'только для входа');
  assert.equal(adjective('token-free'), 'без жетона');
  assert.equal(adjective('royalty-free'), 'бесплатный');
  assert.equal(adjective('all-in'), 'полный');
  assert.equal(adjective('auto-forwarded'), 'автоматически пересланный');
  assert.equal(adjective('high-yield'), 'с высоким доходом');
  assert.equal(adjective('print-on-demand'), 'с печатью по требованию');
  assert.equal(adjective('pay-per-click'), 'платный за щелчок');
  assert.equal(
    declineNoun(
      lexicon.get(lexicon.lookup('noun', 'sponsorship')[0]).ru,
      'gen'
    ),
    'спонсорства'
  );
  assert.ok(api.requests.some((r) => r.titles?.includes('fee-charging')));
  assert.ok(api.requests.some((r) => r.titles?.includes('fee charging')));
  assert.equal(analyze('fee-charging', lexicon)[0].readings[0].pos, 'adj');
  assert.equal(
    translateDocument('I use fee-charging services.', { lexicon }).text,
    'Я использую взимающие плату услуги.'
  );
  assert.equal(
    translateDocument('I use token-free services.', { lexicon }).text,
    'Я использую услуги без жетона.'
  );
});
