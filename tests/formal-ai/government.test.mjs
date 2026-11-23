/** Offline public dictionary argument frames, including argument reversal. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  verbGovernment,
  governmentPages,
  governmentFit,
} from '../../formal-ai/src/sources/government.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const ru = (body) =>
  `==Russian==\n===Verb===\n{{ru-verb|тестировать|impf}}\n${body}\n====Conjugation====\n`;
const frame = (body, lemma = 'help', extra = {}) =>
  verbGovernment(ru(body), '', { lemma, ...extra });
const g = (kase, preposition = null) => ({ preposition, case: kase });

test('bare +obj alternatives, personal controllers, prepositional arguments', () => {
  assert.deepEqual(
    frame('# to [[wait for]] {{+obj|ru|gen|acc}}', 'wait').government,
    g('gen')
  );
  assert.deepEqual(
    frame('# to [[help]] {{+obj|ru|dat<whom>}}').government,
    g('dat')
  );
  assert.deepEqual(
    frame('# to [[use]] {{+obj|ru|ins<something>}}', 'use').government,
    g('ins')
  );
  const contact = frame(
    '# to [[contact]] {{+obj|ru|:с(ins)<with someone>}}',
    'contact'
  );
  assert.deepEqual(contact.government, g('ins', 'с'));
  assert.deepEqual(contact.markerGovernment.with, g('ins', 'с'));
  const send = frame(
    '# to [[send]] {{+obj|ru|dat<someone> + acc<something>}}',
    'send'
  );
  assert.deepEqual(send.government, g('acc'));
  assert.equal(send.recipient, 'dat');
  assert.deepEqual(
    frame('# to [[answer]] {{+obj|ru|:на(acc)<to something>}}', 'answer')
      .government,
    g('acc', 'на')
  );
  assert.deepEqual(
    frame(
      '# to [[allow]] {{+obj|ru|acc<someone> + inf<to do something>}}',
      'allow'
    ).government,
    g('acc')
  );
});

test('case notes remain scoped to the selected Russian meaning', () => {
  const text =
    '# to [[help]] {{+obj|ru|dat<someone>}}\n# to [[thank]] {{+obj|ru|acc<someone>}}';
  assert.deepEqual(frame(text, 'thank').government, g('acc'));
  assert.deepEqual(frame(text, 'help').government, g('dat'));
  assert.deepEqual(frame('# to [[help]] {{q|+ dative}}').government, g('dat'));
  assert.equal(
    frame('# to [[levitate]] {{+obj|ru|ins<something>}}\n# to [[hover]]')
      .government,
    undefined
  );
});

test('only explicit English subject mapping reverses an experiencer', () => {
  const text =
    '# to [[please]] {{+obj|ru|dat<someone>}} {{q|idiomatically translated with {{m+|en|like}} with the dative object as the subject}}';
  assert.equal(frame(text, 'like').experiencer, true);
  assert.equal(frame(text, 'please').experiencer, undefined);
  assert.equal(
    frame('# to [[help]] {{+obj|ru|dat<someone>}}').experiencer,
    undefined
  );
});

test('Russian management sections and case-only usage qualifiers', () => {
  const text =
    '= {{-ru-}} =\n=== Управление ===\nкому, что\n=== Семантические свойства ===\n';
  const result = verbGovernment('', text, { lemma: 'send' });
  assert.deepEqual(result.government, g('acc'));
  assert.equal(result.recipient, 'dat');
  assert.deepEqual(
    verbGovernment('', '= {{-ru-}} =\n=== Управление ===\nна кого-что', {})
      .government,
    g('acc', 'на')
  );
  assert.deepEqual(
    verbGovernment('', '= {{-ru-}} =\n=== Управление ===\nкого-чего', {})
      .government,
    g('gen')
  );
  assert.deepEqual(
    verbGovernment('', '= {{-ru-}} =\n# {{помета|с кем-чем}}', {}).government,
    g('ins', 'с')
  );
  assert.deepEqual(
    verbGovernment('', '= {{-ru-}} =\n# {{помета|кем-чем}}', {}).government,
    g('ins')
  );
  assert.equal(
    verbGovernment('', '= {{-ru-}} =\n# {{помета|иногда с + тв. п.}}', {})
      .government,
    undefined
  );
});

test('receiver evidence does not turn transferred themes into dative objects', () => {
  const text = '= {{-ru-}} =\n# {{пример|Он {{выдел|платил}} ему меньше.}}';
  const payment = verbGovernment('', text, {
    lemma: 'pay',
    definition: 'To give money to in exchange for goods.',
  });
  assert.deepEqual(payment.government, g('dat'));
  const transfer = verbGovernment('', text, {
    lemma: 'send',
    definition: 'To send something.',
  });
  assert.equal(transfer.government, undefined);
  assert.deepEqual(transfer.classGovernment.person, g('dat'));
  assert.equal(transfer.recipient, 'dat');
});

function wiki(pages, requests = []) {
  return (url, options) => {
    assert.equal(options.headers['user-agent'], USER_AGENT);
    requests.push(url);
    const p =
      options.method === 'POST'
        ? new URLSearchParams(options.body)
        : new URL(url).searchParams;
    return {
      ok: true,
      json: () => ({
        query: {
          pages: (p.get('titles') || '').split('|').map((title) => ({
            title,
            ...(pages[title]
              ? {
                  revisions: [{ slots: { main: { content: pages[title] } } }],
                }
              : { missing: true }),
          })),
        },
      }),
    };
  };
}

test('Russian government requests use shared fetch options and raw API responses', async () => {
  const requests = [];
  const pages = await governmentPages(['помогать', 'помогать', 'not Russian'], {
    cache: false,
    fetchImpl: wiki(
      { помогать: '= {{-ru-}} =\n=== Управление ===\nкому' },
      requests
    ),
  });
  assert.equal(pages.size, 1);
  assert.equal(new URL(requests[0]).hostname, 'ru.wiktionary.org');
  assert.equal(new URL(requests[0]).searchParams.get('titles'), 'помогать');
});

test('learned experiencer agrees with its theme; a governed reflexive keeps its frame', async () => {
  const lexicon = loadLexicon({
    fresh: true,
    dir: '/private/tmp/formal-ai-no-government-overrides',
  });
  const english = (lemma, gloss, russian) =>
    `==English==\n===Verb===\n{{en-verb}}\n# {{lb|en|transitive}} ${gloss}\n====Translations====\n{{trans-top|${gloss}}}\n* Russian: ${russian.map((w) => `{{t|ru|${w}|impf}}`).join(', ')}\n{{trans-bottom}}`;
  await resolveText('', {
    lexicon,
    words: ['admire', 'utilize', 'assist'],
    cache: false,
    fetchImpl: wiki({
      admire: english('admire', 'To admire something.', ['нравиться']),
      utilize: english('utilize', 'To utilize something.', [
        'пользоваться',
        'использовать',
      ]),
      assist: english('assist', 'To assist someone.', ['помогать']),
      нравиться: ru(
        '# to [[please]] {{+obj|ru|dat<someone>}} {{q|idiomatically translated with {{m+|en|admire}} with the dative object as the subject}}'
      ).replace('тестировать', 'нравиться'),
      пользоваться: ru('# to [[utilize]] {{+obj|ru|ins<something>}}').replace(
        'тестировать',
        'пользоваться'
      ),
      использовать: ru('# to [[utilize]] something.').replace(
        'тестировать',
        'использовать'
      ),
      помогать: ru('# to [[assist]] {{+obj|ru|dat<someone>}}').replace(
        'тестировать',
        'помогать'
      ),
    }),
  });
  const entry = (w) => lexicon.get(lexicon.lookup('verb', w)[0]).ru;
  assert.equal(entry('admire').experiencer, true);
  assert.equal(entry('admire').transitive, undefined);
  assert.equal(entry('utilize').government.case, 'ins');
  assert.equal(entry('utilize').transitive, undefined);
  assert.match(translateDocument('I admire it.', { lexicon }).text, /^Мне /);
  assert.match(translateDocument('Assist them.', { lexicon }).text, /им/);
  assert.ok(
    governmentFit(entry('utilize'), { frames: ['transitive'] }) >
      governmentFit({}, { frames: ['transitive'] })
  );
});
