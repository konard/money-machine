/** Names and identifiers use token shape, document evidence and public data. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import {
  resolveText,
  resolveNames,
  unknownWords,
  nameCandidates,
} from '../../formal-ai/src/resolve.mjs';
import { analyze, tokenize } from '../../formal-ai/src/english/analyze.mjs';
import {
  documentNames,
  documentWords,
  translateDocument,
} from '../../formal-ai/src/document.mjs';
import { verbGovernment } from '../../formal-ai/src/sources/government.mjs';
import { membershipContext } from '../../formal-ai/src/sense-context.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { attestRussian } from './russian-fixture.mjs';

const entry = (pos, gloss, ru, gender = '') =>
  `==English==\n===${pos}===\n# ${gloss}\n{{trans-top|${gloss}}}\n* Russian: {{t|ru|${ru}|${gender}}}\n{{trans-bottom}}`;
function fixture(pages = {}, entities = {}) {
  attestRussian(pages);
  return {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const u = new URL(url);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : u.searchParams;
      const body = {};
      if (p.get('action') === 'wbsearchentities') {
        const name = p.get('search');
        body.search = Object.entries(entities)
          .filter(
            ([, e]) =>
              e.labels?.en?.value === name ||
              e.aliases?.en?.some((a) => a.value === name)
          )
          .map(([id]) => ({ id, label: name }));
      } else if (p.get('action') === 'wbgetentities') {
        body.entities = Object.fromEntries(
          p
            .get('ids')
            .split('|')
            .map((id) => [id, entities[id]])
        );
      } else if (p.get('titles')) {
        body.query = {
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
        };
      } else if (u.host === 'ru.wikipedia.org') {
        body.query = { searchinfo: { totalhits: 0 } };
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}

const instance = (id) => ({
  P31: [{ mainsnak: { datavalue: { value: { id } } } }],
});

test('identifiers survive grammar and never enter dictionary/name lookup queues', () => {
  const lexicon = loadLexicon({ fresh: true });
  for (const code of [
    'W-8BEN',
    'W-9',
    '1099-K',
    'PA-API',
    'T2125',
    'T1',
    'ISO 3166',
    'ZX-42N',
    'AB12/CD34',
  ]) {
    const tokens = tokenize(code);
    assert.equal(tokens.length, 1, code);
    assert.equal(analyze(code, lexicon)[0].readings[0].pos, 'propn', code);
    assert.deepEqual(unknownWords(code, lexicon), [], code);
    assert.deepEqual(nameCandidates(code, lexicon), [], code);
    assert.equal(translateDocument(code, { lexicon }).text, code);
  }
  assert.equal(
    translateDocument('W-8BEN/tax interview', { lexicon }).text.includes(
      'W-8BEN'
    ),
    true
  );
  assert.deepEqual(
    tokenize('US/UK').map((t) => t.text),
    ['US', 'or', 'UK']
  );
  assert.equal(tokenize('30 d')[0].kind, 'number');
});

test('site-wide capitalization identifies a sentence-opening common-word brand', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    lexicon,
    words: ['discord'],
    ...fixture({ discord: entry('Noun', 'disagreement', 'разногласие', 'n') }),
  });
  const field = 'Payments via Discord. Sellers use Discord.';
  assert.ok(documentNames(field).has('Discord'));
  assert.ok(documentNames(`${field} https://discord.com`).has('Discord'));
  assert.ok(
    documentNames(`${field} We use Discord; the word discord.`).has('Discord')
  );
  assert.ok(
    !documentNames('We see Discord and discord and discord.').has('Discord')
  );
  assert.ok(!documentWords('PayPal Discord SRL semplificata').has('discord'));
  const ru = translateDocument('Discord works.', {
    lexicon,
    topic: 'Discord works.',
    field,
  });
  assert.equal(ru.text, 'Discord работает.');
  translateDocument('Discord works.', { lexicon, topic: 'There is discord.' });
  assert.ok(
    analyze('Discord works.', lexicon)[0].readings.some((r) => r.pos === 'noun')
  );
  assert.ok(
    !analyze('Discord works.', lexicon)[0].readings.some(
      (r) => r.pos === 'propn'
    )
  );
});

test('single-word human aliases cannot supply a full-name person label; countries still translate', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const person = {
    labels: { en: { value: 'Fabrice Morvan' }, ru: { value: 'Фабрис Морван' } },
    aliases: { en: [{ value: 'Fab' }] },
    claims: instance('Q5'),
  };
  const country = {
    labels: { en: { value: 'India' }, ru: { value: 'Индия' } },
    claims: instance('Q6256'),
  };
  const hits = await resolveNames(['Fab', 'Fabrice Morvan', 'India'], {
    lexicon,
    topic: 'AI-content disclosure on Fab. India balances.',
    ...fixture({}, { Qperson: person, Qcountry: country }),
  });
  assert.ok(!hits.has('Fab'));
  assert.equal(lexicon.nameLabel('Fab'), undefined);
  assert.equal(lexicon.nameLabel('Fabrice Morvan'), 'Фабрис Морван');
  assert.equal(lexicon.nameLabel('India'), 'Индия');
  assert.match(
    translateDocument('India bank accounts', { lexicon }).text,
    /Индии/
  );
});

test('dictionary-attested foreign words and abbreviation aliases form one proper name', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    lexicon,
    words: ['semplificata', 'limitata'],
    ...fixture({
      semplificata: '==Italian==\n===Adjective===\n# simplified',
      limitata: '==Italian==\n===Adjective===\n# limited',
    }),
  });
  for (const name of [
    'SRL semplificata (SRLS) / SRL',
    'ABC limitata (ABCL) / ABC',
  ]) {
    const r = translateDocument(name, { lexicon });
    assert.equal(r.text, name);
    assert.equal(r.stats.incomplete, 0);
  }
});

test('passive object complements preserve the country modifier, adverbs and destination', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('', {
    lexicon,
    words: ['require'],
    ...fixture({ require: entry('Verb', 'To demand something', 'требовать') }),
  });
  lexicon.setNameLabel('India', 'Индия');
  lexicon.setNameEntry('India', { pos: 'noun', lemma: 'Индия', gender: 'f' });
  lexicon.get('send').ru.perfective.pastPassive = 'отправленный';
  const r = translateDocument(
    'Acme requires India books to be sent to a bank.',
    { lexicon }
  );
  assert.equal(r.stats.incomplete, 0, r.text);
  assert.match(
    r.text,
    /^Acme требует, чтобы книги Индии были отправлены в банк\.$/
  );
});

test('floating quantifiers stay with the coordinated subject and named present-simple comparisons are contrastive', () => {
  const lexicon = loadLexicon({ fresh: true });
  const r = translateDocument('Acme works, while Beta and Gamma all work.', {
    lexicon,
  });
  assert.equal(r.text, 'Acme работает, тогда как Beta и Gamma все работают.');
  assert.match(
    translateDocument('I read while you work.', { lexicon }).text,
    /пока/
  );
});

test('membership senses select collective objects from public entity descriptions', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.nameEntities = new Map([
    [
      'Acme',
      { descriptions: { en: { value: 'online marketplace platform' } } },
    ],
  ]);
  const owner = { objects: [{ name: 'Acme' }] };
  assert.equal(
    membershipContext({ gloss: 'to become a member of' }, owner, lexicon),
    3
  );
  assert.equal(
    membershipContext({ gloss: 'to put together' }, owner, lexicon),
    0
  );
  assert.equal(
    membershipContext(
      { gloss: 'to become a member of' },
      { objects: [] },
      lexicon
    ),
    0
  );
});

test('bilingual sense alignment derives membership government only from its own Russian example', () => {
  const page =
    '= {{-ru-}} =\n==== Значение ====\n# [[становиться]] [[член]]ом, участником чего-либо {{пример|Многие вступали в партию.}}\n=== Перевод ===\n{{перев-блок|становиться членом|\n|en=[[join]], [[become a member]] (of)\n}}';
  assert.deepEqual(
    verbGovernment('', page, { lemma: 'join', gloss: 'to become a member of' })
      .government,
    { case: 'acc', preposition: 'в' }
  );
  assert.equal(
    verbGovernment('', page, { lemma: 'join', gloss: 'to put together' })
      .government,
    undefined
  );
});

test('generic instance descriptions cannot ground a country as an unrelated taxon', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const entities = {
    Qcountry: {
      labels: { en: { value: 'India' }, ru: { value: 'Индия' } },
      descriptions: { en: { value: 'country in South Asia' } },
      sitelinks: { enwiki: {}, ruwiki: {}, dewiki: {} },
    },
    Qtaxon: {
      labels: { en: { value: 'India' }, ru: { value: 'India' } },
      descriptions: { en: { value: 'genus of plants' } },
      claims: instance('Qtype'),
      sitelinks: { enwiki: {} },
    },
    Qtype: {
      labels: { en: { value: 'taxon' } },
      descriptions: { en: { value: 'group with a common name' } },
    },
  };
  const hits = await resolveNames(['India'], {
    lexicon,
    topic: 'India country balances. Groups use a common name.',
    ...fixture({}, entities),
  });
  assert.equal(hits.get('India'), 'Qcountry');
  assert.equal(lexicon.nameLabel('India'), 'Индия');
});

test('an acronym never expands to a label naming a narrower subtype', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveNames(['XYZ'], {
    lexicon,
    ...fixture(
      {},
      {
        Qsubtype: {
          labels: { en: { value: 'XYZ tracker' }, ru: { value: 'XYZ-трекер' } },
          aliases: { en: [{ value: 'XYZ' }] },
        },
      }
    ),
  });
  assert.equal(lexicon.nameLabel('XYZ'), 'XYZ');
});
