/** Offline public-source evidence for ambiguous headings and list items. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { termSenses } from '../../formal-ai/src/sources/terms.mjs';
import { analyze } from '../../formal-ai/src/english/analyze.mjs';

const section = (pos, ru, gender = '') =>
  `===${pos}===\n# A fixture sense.\n{{trans-top|fixture}}\n* Russian: {{t|ru|${ru}|${gender}}}\n{{trans-bottom}}`;
const pages = {
  tax: `==English==\n${section('Noun', 'налог', 'm')}\n${section('Verb', 'истощать')}`,
  reporting: `==English==\n${section('Noun', 'отчётность', 'f')}`,
  threshold: `==English==\n${section('Noun', 'порог', 'm')}`,
  track: `==English==\n${section('Noun', 'дорожка', 'f')}\n${section('Verb', 'отслеживать').replace('# A fixture sense.', '# {{lb|en|transitive}} A fixture sense.')}`,
  verification: `==English==\n${section('Noun', 'проверка', 'f')}`,
  outreach: `==English==\n${section('Noun', 'охват', 'm')}\n${section('Verb', 'превосходить')}`,
  contact: `==English==\n${section('Noun', 'контакт', 'm')}\n${section('Verb', 'связываться')}`,
  support: `==English==\n${section('Noun', 'поддержка', 'f')}\n${section('Verb', 'поддерживать')}`,
  load: `==English==\n${section('Noun', 'нагрузка', 'f')}\n${section('Verb', 'нагружать')}`,
  spam: `==English==\n${section('Noun', 'спам', 'm')}\n${section('Verb', 'спамить')}`,
  ban: `==English==\n${section('Noun', 'блокировка', 'f')}\n${section('Verb', 'запрещать')}`,
  deliver: `==English==\n===Verb===\n# To set free.\n# To bring or transport something to its destination.\n{{trans-top|to set free}}\n* Russian: {{t|ru|освобождать}}\n{{trans-bottom}}\n{{trans-top|to bring or transport something to its destination}}\n* Russian: {{t|ru|доставлять}}\n* French:\n* German:\n{{trans-bottom}}`,
  revise: `==English==\n${section('Verb', 'пересматривать')}`,
  register: `==English==\n${section('Verb', 'регистрировать')}`,
  pass: `==English==\n${section('Verb', 'проходить')}`,
  edit: `==English==\n${section('Verb', 'редактировать')}`,
  ...Object.fromEntries(
    [
      'налог отчётность проверка охват контакт поддержка нагрузка спам блокировка порог дорожка',
      'истощать превосходить связываться поддерживать нагружать спамить запрещать доставлять освобождать пересматривать регистрировать проходить редактировать отслеживать',
    ].flatMap((words, i) =>
      words
        .split(' ')
        .map((word) => [
          word,
          `==Russian==\n===${i ? 'Verb' : 'Noun'}===\n{{ru-${i ? 'verb' : 'noun'}|${word}}}`,
        ])
    )
  ),
};
function fixture(url, options) {
  assert.equal(options.headers['user-agent'], USER_AGENT);
  const p = options.body
    ? new URLSearchParams(options.body)
    : new URL(url).searchParams;
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
    : new URL(url).host === 'ru.wikipedia.org'
      ? { query: { searchinfo: { totalhits: 0 } } }
      : {};
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

test('dictionary noun-first compounds win complete fragment ties, including siblings', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText(
    'tax reporting; verification; outreach contacts; support load; spam bans',
    {
      lexicon,
      words: Object.keys(pages).filter((w) => /^[a-z]+$/.test(w)),
      fetchImpl: fixture,
      cache: false,
    }
  );
  for (const text of [
    'Tax reporting',
    'Tax reporting:',
    'Tax reporting;',
    'verification; tax reporting',
    'verification, tax reporting',
    'verification + tax reporting',
    'Support load',
    'WhatsApp spam bans',
    '100+ outreach contacts',
  ]) {
    const parsed = parseSentence(text, lexicon);
    assert.deepEqual(parsed.leftover, [], text);
    assert.ok(
      parsed.clauses.every((c) => c.type === 'fragment'),
      text
    );
  }
  assert.equal(lexicon.partsOfSpeech.get('tax').order[0], 'noun');
  assert.ok(
    parseSentence('Track bank account verification', lexicon).clauses.some(
      (c) => c.mood === 'imperative'
    )
  );
  assert.equal(
    analyze('life+50', lexicon).some((t) =>
      t.readings.some((r) => r.pos === 'coord')
    ),
    false
  );
  assert.equal(
    translateDocument('Tax reporting thresholds', { lexicon }).text,
    'Пороги отчётности налога'
  );
  assert.match(
    translateDocument('Tax reporting', { lexicon }).text,
    /отчётность/i
  );
  for (const text of [
    '## Tax reporting.',
    '- Tax reporting.',
    '| Tax reporting. |',
  ]) {
    assert.match(
      translateDocument(text, { lexicon }).text,
      /Отчётность налога\./
    );
  }
});

test('a missing noun can use an exact concept label even when its verb is translated', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const fetchImpl = (url, options) => {
    const p = new URL(url).searchParams;
    let body;
    if (p.get('action') === 'wbsearchentities') {
      body = {
        search: [
          { id: 'Qalias', label: 'aid', match: { text: 'outreach' } },
          { id: 'Qexact', label: 'outreach' },
        ],
      };
    } else if (p.get('action') === 'wbgetentities') {
      body = {
        entities: Object.fromEntries(
          ['Qalias', 'Qexact'].map((id) => [
            id,
            {
              labels: {
                en: { value: id === 'Qexact' ? 'outreach' : 'aid' },
                ru: { value: 'охват' },
              },
              aliases: { en: [{ value: 'outreach' }] },
              claims: { P279: [{}] },
            },
          ])
        ),
      };
    } else if (
      p.has('titles') &&
      p.get('titles').split('|').includes('outreach')
    ) {
      const content = `==English==\n===Noun===\n# A scope.\n${section('Verb', 'превосходить')}`;
      body = {
        query: {
          pages: p
            .get('titles')
            .split('|')
            .map((title) =>
              title === 'outreach'
                ? { title, revisions: [{ slots: { main: { content } } }] }
                : { title, missing: true }
            ),
        },
      };
    }
    return body
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
      : fixture(url, options);
  };
  const terms = await termSenses(['outreach'], { fetchImpl, cache: false });
  assert.equal(terms[0].senses.find((s) => s.entity === 'Qalias').side, true);
  assert.equal(terms[0].senses.find((s) => s.entity === 'Qexact').side, false);
  await resolveText('outreach', {
    lexicon,
    fetchImpl,
    cache: false,
  });
  assert.ok(lexicon.lookup('noun', 'outreach').length);
  assert.ok(lexicon.lookup('verb', 'outreach').length);
});

test('dictionary valency constrains existing verb senses with a coordinated object', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const fetchImpl = (url, options) => {
    const p = new URL(url).searchParams;
    if (p.has('titles') && p.get('titles').split('|').includes('run')) {
      const content = `==English==\n===Verb===\n# {{lb|en|intransitive}} To move quickly.\n{{trans-top|to move quickly}}\n* Russian: {{t|ru|бегать}}\n{{trans-bottom}}`;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: p
                .get('titles')
                .split('|')
                .map((title) =>
                  title === 'run'
                    ? { title, revisions: [{ slots: { main: { content } } }] }
                    : { title, missing: true }
                ),
            },
          }),
      });
    }
    return fixture(url, options);
  };
  await resolveText('run', {
    words: ['run'],
    lexicon,
    fetchImpl,
    cache: false,
  });
  const motion = lexicon
    .lookup('verb', 'run')
    .map((id) => lexicon.get(id))
    .find((c) => c.ru.lemma === 'бегать');
  assert.ok(motion.frames.includes('intransitive'));
  assert.equal(
    translateDocument('Run the program + the file.', { lexicon }).text,
    'Запустите программу и файл.'
  );
});

test('explicit requests and real finite clauses survive fragment preference', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('deliver revise register pass edit', {
    lexicon,
    fetchImpl: fixture,
    cache: false,
  });
  for (const text of [
    'Deliver edited files',
    'Register, pass onboarding tests',
    'Run the program.',
    'Open an account and deposit money.',
    'Never buy books.',
    'Deliver + revise',
  ]) {
    const parsed = parseSentence(text, lexicon);
    assert.ok(
      parsed.clauses.some((c) => c.mood === 'imperative'),
      text
    );
  }
  for (const text of ['Dogs sleep', 'The books need money', 'I read books']) {
    assert.ok(
      parseSentence(text, lexicon).clauses.some((c) => c.type === 'clause'),
      text
    );
  }
  assert.equal(
    translateDocument('Deliver + revise', { lexicon }).text,
    'Доставляйте и пересматривайте'
  );
});
