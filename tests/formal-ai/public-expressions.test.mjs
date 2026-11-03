import { attestRussian } from './russian-fixture.mjs';
/** Offline public-data fixtures; no hand-written production vocabulary. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { analyze } from '../../formal-ai/src/english/analyze.mjs';
import { declineNoun } from '../../formal-ai/src/russian/morphology.mjs';
import { phraseCandidates } from '../../formal-ai/src/public-expressions.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const table = (ru, languages = 1) =>
  `{{trans-top|fixture}}\n* Russian: {{t|ru|${ru}}}\n${Array.from({ length: languages - 1 }, (_, i) => `* L${i}: {{t|x${i}|fixture}}`).join('\n')}\n{{trans-bottom}}`;
const entry = (pos, ru, definition = 'A fixture.') =>
  `==English==\n===${pos}===\n# ${definition}\n${table(ru)}`;

function wiki(pages, entities = {}) {
  attestRussian(pages);
  const requests = [];
  return {
    requests,
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : new URL(url).searchParams;
      requests.push(Object.fromEntries(p));
      let body = {};
      if (p.get('titles')) {
        const titles = p.get('titles').split('|');
        assert.ok(titles.length <= 50);
        body = {
          query: {
            pages: titles.map((title) =>
              pages[title]
                ? {
                    title,
                    revisions: [{ slots: { main: { content: pages[title] } } }],
                  }
                : { title, missing: true }
            ),
          },
        };
      } else if (p.get('action') === 'wbsearchentities') {
        body = {
          search: Object.entries(entities)
            .filter(([, e]) => e.labels.en.value === p.get('search'))
            .map(([id, e]) => ({ id, label: e.labels.en.value })),
        };
      } else if (p.get('action') === 'wbgetentities') {
        body = { entities };
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}

test('phrase candidates put whole sentences first, expand contractions, and respect boundaries', () => {
  const titles = phraseCandidates(
    "You're welcome! Good morning. ' \n alpha beta gamma delta epsilon zeta."
  );
  assert.equal(titles[0], 'you are welcome');
  assert.ok(titles.includes("you're welcome"));
  assert.ok(titles.includes('alpha beta gamma delta epsilon zeta'));
  assert.ok(titles.includes('beta gamma delta epsilon zeta'));
  assert.ok(!titles.includes('welcome good'));
  assert.ok(!titles.includes(''));
});

test('public interjections, proverbs, translation subpages and breadth become phrases', async () => {
  const lexicon = new Lexicon();
  const api = wiki({
    'thank you very much': `${entry('Interjection', 'благодарю!')}\n${table('большое спасибо!', 8)}`,
    'good morning':
      '==English==\n===Interjection===\n# Greeting.\n{{see translation subpage|Interjection}}',
    'good morning/translations': entry('Interjection', 'доброе утро'),
    hello: entry('Interjection', 'здравствуйте'),
    'time flies': entry('Proverb', 'время летит'),
    'you are welcome': entry('Phrase', 'пожалуйста'),
    "I'm sorry": entry('Phrase', 'прошу прощения'),
    'good luck': `${entry('Noun', 'удача')}\n===Interjection===\n# A wish.\n${table('удачи!')}`,
    'red car': entry('Noun', 'красная машина'),
    no: '==English==\n===Particle===\n# A response.\n{{see translation subpage|Particle}}',
    'no/translations': entry('Particle', 'нет!'),
    'excuse me': `==English==\n===Phrase===\n# {{n-g|A request for attention.}}\n===Noun===\n# A dance.\n${table('простите').replace('trans-top|fixture', 'trans-top|request for attention')}`,
  });
  await resolveText(
    'Thank you very much. Good morning! Hello, you are welcome! Time flies. Red car. No! Excuse me! Good luck! I am sorry.',
    { lexicon, ...api }
  );
  assert.equal(
    translateDocument('Thank you very much.', { lexicon }).text,
    'Большое спасибо.'
  );
  assert.equal(
    translateDocument('Good morning!', { lexicon }).text,
    'Доброе утро!'
  );
  assert.equal(
    translateDocument("You're welcome!", { lexicon }).text,
    'Пожалуйста!'
  );
  assert.equal(
    translateDocument('Time flies.', { lexicon }).text,
    'Время летит.'
  );
  assert.equal(translateDocument('No!', { lexicon }).text, 'Нет!');
  assert.equal(translateDocument('Good luck!', { lexicon }).text, 'Удачи!');
  assert.equal(
    translateDocument('I am sorry.', { lexicon }).text,
    'Прошу прощения.'
  );
  assert.equal(translateDocument('Excuse me!', { lexicon }).text, 'Простите!');
  assert.ok(!lexicon.phrases.some((p) => p.words.join(' ') === 'red car'));
  assert.ok(
    api.requests.some((p) => p.titles?.includes('good morning/translations'))
  );
  const size = lexicon.phrases.length;
  await resolveText('Thank you very much.', { lexicon, ...api });
  assert.equal(lexicon.phrases.length, size);
});

test('dictionary given names override common homonyms only when capitalized, including sentence start', async () => {
  const lexicon = new Lexicon();
  await resolveText('Tom helps. I help Tom. Mary helps. Water flows.', {
    lexicon,
    ...wiki({
      tom: entry('Noun', 'кот'),
      Tom: entry('Proper noun', 'Том', '{{given name|en|male}}'),
      Mary: entry('Proper noun', 'Мария', '{{given name|en|female}}').replace(
        '{{t|ru|Мария}}',
        '{{q|cognate}} {{t|ru|Мария}}; {{q|transliteration}} {{t|ru|Мэри}}'
      ),
      water: entry('Noun', 'вода'),
      Water: entry('Proper noun', 'Вода', 'A surname.'),
    }),
  });
  assert.equal(analyze('Tom helps.', lexicon)[0].readings[0].pos, 'propn');
  assert.equal(analyze('tom helps.', lexicon)[0].readings[0].pos, 'noun');
  assert.equal(analyze('Water flows.', lexicon)[0].readings[0].pos, 'noun');
  assert.equal(lexicon.nameLabel('Mary'), 'Мэри');
  assert.equal(declineNoun(lexicon.nameEntry('Tom'), 'dat'), 'Тому');
  assert.equal(declineNoun(lexicon.nameEntry('Tom'), 'acc'), 'Тома');
});

test('phrase candidates retain ordinary readings needed by dictionary dependencies', async () => {
  const lexicon = new Lexicon();
  await resolveText('Yonder, there.', {
    lexicon,
    ...wiki({
      yonder:
        '==English==\n===Adverb===\n# At a distance.\n{{trans-see|there}}',
      there: entry('Adverb', 'далеко'),
    }),
  });
  assert.ok(lexicon.lookup('adv', 'there').length);
  assert.ok(lexicon.lookup('adv', 'yonder').length);
});

test('Wikidata given-name instances outrank people and do not turn initial common words into names', async () => {
  const lexicon = new Lexicon();
  const entity = (en, ru, type, links = {}) => ({
    labels: { en: { value: en }, ru: { value: ru } },
    sitelinks: links,
    claims: { P31: [{ mainsnak: { datavalue: { value: { id: type } } } }] },
  });
  await resolveText('Tom helps. Water flows.', {
    lexicon,
    ...wiki(
      { tom: entry('Noun', 'кот'), water: entry('Noun', 'вода') },
      {
        Qperson: entity('Tom', 'Том Актёр', 'Q5', { enwiki: {}, ruwiki: {} }),
        Qname: entity('Tom', 'Том', 'Q12308941'),
        Qwater: entity('Water', 'Вода', 'Qthing'),
      }
    ),
  });
  assert.equal(lexicon.nameLabel('Tom'), 'Том');
  assert.equal(lexicon.nameLabel('Water'), undefined);
  assert.equal(analyze('Tom helps.', lexicon)[0].readings[0].pos, 'propn');
  assert.equal(analyze('Water flows.', lexicon)[0].readings[0].pos, 'noun');
});
