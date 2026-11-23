import { compactResponse } from '../../formal-ai/src/sources/compact.mjs';
/** Offline dictionary evidence for objectless verbs and headline passives. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { senseFrames } from '../../formal-ai/src/sources/verb-frames.mjs';
import {
  reflexiveCounterpart,
  reflexiveOf,
} from '../../formal-ai/src/sources/reflexive.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const verb = (word, labels = 'transitive|intransitive') =>
  `==English==\n===Verb===\n# {{lb|en|${labels}}} To become or make different.\n{{trans-top|become or make different}}\n* Russian: {{t|ru|${word}}}\n{{trans-bottom}}`;
const pages = {
  app: '==English==\n===Noun===\n# A program.\n{{trans-top|program}}\n* Russian: {{t|ru|приложение|n}}\n{{trans-bottom}}',
  automatically:
    '==English==\n===Adverb===\n# Without intervention.\n{{trans-top|without intervention}}\n* Russian: {{t|ru|автоматически}}\n{{trans-bottom}}',
  приложение: '==Russian==\n===Noun===\n{{ru-noun|приложение|n-in}}',
  автоматически: '==Russian==\n===Adverb===\n{{ru-adv|автоматически}}',

  open: verb('открывать'),
  opened:
    '==English==\n===Verb===\n# {{past of|en|open}}\n# {{past participle of|en|open}}',
  increase: verb('увеличивать'),
  increased:
    '==English==\n===Verb===\n# {{past of|en|increase}}\n# {{past participle of|en|increase}}',
  close: verb('закрывать'),
  change: verb('менять'),
  update: verb('обновлять', 'transitive'),
};
for (const word of [
  'открывать',
  'увеличивать',
  'закрывать',
  'менять',
  'обновлять',
]) {
  pages[word] =
    `==Russian==\n===Verb===\n{{ru-verb|${word}|impf}}\n====Derived terms====\n* {{l|ru|${word}ся}}`;
  pages[`${word}ся`] = `==Russian==\n===Verb===\n{{ru-verb|${word}ся|impf}}`;
}
// The source page need not name its reflexive: the reverse page can attest it.
pages.открывать = '==Russian==\n===Verb===\n{{ru-verb|открывать|impf}}';
pages.открываться =
  '= {{-ru-}} =\n{{гл ru 1a-сяНСВ}}\n=== Родственные слова ===\n{{родств-блок|глаголы=открывать}}';
pages.открыться =
  '= {{-ru-}} =\n{{гл ru 12a-сяСВ\n|соотв=открываться\n}}\n=== Родственные слова ===\n{{родств-блок|глаголы=открыть}}';
const requests = [];
function fetchImpl(url, options) {
  assert.equal(options.headers['user-agent'], USER_AGENT);
  const p = options.body
    ? new URLSearchParams(options.body)
    : new URL(url).searchParams;
  requests.push(p.get('titles'));
  const body = p.has('titles')
    ? {
        query: {
          pages: p
            .get('titles')
            .split('|')
            .map((title) =>
              pages[title]
                ? {
                    title,
                    revisions: [{ slots: { main: { content: pages[title] } } }],
                  }
                : { title, missing: true }
            ),
        },
      }
    : p.get('action') === 'parse'
      ? { parse: { text: '' } }
      : { query: { search: [], searchinfo: { totalhits: 0 } }, search: [] };
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

test('compacted Russian pages retain reflexive and aspect evidence', () => {
  const raw =
    '= {{-ru-}} =\n{{гл ru 12a-сяСВ\n|соотв=открываться\n}}\n=== Родственные слова ===\n{{родств-блок|глаголы=открыть}}';
  const body = compactResponse('wiktionary-ru', {
    query: {
      pages: [
        {
          title: 'открыться',
          revisions: [{ slots: { main: { content: raw } } }],
        },
      ],
    },
  });
  const text = body.query.pages[0].revisions[0].slots.main.content;
  assert.equal(reflexiveOf('открыть', text), true);
  assert.match(text, /соотв=открываться/);
});

test('ergative labels attest both argument frames', () => {
  assert.deepEqual(senseFrames('{{lb|en|ergative}} To become different.'), [
    'transitive',
    'intransitive',
  ]);
});

test('a plausible reflexive spelling without a dictionary link is insufficient', () => {
  assert.equal(
    reflexiveCounterpart(
      'открывать',
      '==Russian==\n===Verb===\n{{ru-verb|открывать|impf}}'
    ),
    null
  );
  assert.equal(reflexiveCounterpart('открывать', pages.открывать), null);
  assert.equal(reflexiveOf('открывать', pages.открываться), true);
  assert.equal(
    reflexiveCounterpart(
      'обновлять',
      '= {{-ru-}} =\n=== Родственные слова ===\n{{родств-блок|глаголы=обновляться, обновить}}'
    ),
    'обновляться'
  );
});

test('Russian dictionary counterparts apply to things without objects; people and objects retain active verbs', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const source =
    'The door opened. Prices increased. Registration closes soon. The price changes every month. The app updates automatically. We opened. We opened the door.';
  await resolveText(source, {
    lexicon,
    fetchImpl,
    cache: false,
    words: Object.keys(pages).filter((w) => /^[a-z]+$/.test(w)),
  });
  const cases = [
    ['The door opened.', /дверь открывалась|дверь открылась/i],
    ['Prices increased.', /цены увеличивались/i],
    ['Registration closes soon.', /закрывается/i],
    ['The price changes every month.', /меняется/i],
    ['The app updates automatically.', /обновляется/i],
    ['We opened.', /мы открыли/i],
    ['We opened the door.', /мы открыли дверь/i],
  ];
  for (const [text, expected] of cases) {
    assert.match(translateDocument(text, { lexicon }).text, expected, text);
  }
  assert.ok(requests.some((titles) => titles?.includes('открываться')));
});
