/** Offline transport and schema tests for the opt-in evidence layers. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Lexicon } from '../../formal-ai/src/lexicon.mjs';
import { parseLino, childrenNamed } from '../../formal-ai/src/lino.mjs';
import { parseConcept } from '../../formal-ai/src/links/schema.mjs';
import { writeLino } from '../../formal-ai/src/links/write.mjs';
import { USER_AGENT, getJson } from '../../formal-ai/src/sources/fetch.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import { publicSenses } from '../../formal-ai/src/sources/sense-data.mjs';
import { compactResponse } from '../../formal-ai/src/sources/compact.mjs';
import {
  wikipediaLinks,
  lexemeLinks,
  tatoebaLinks,
  kaikkiLinks,
  loadSourceLinks,
  compareKaikkiCoverage,
} from '../../formal-ai/src/sources/link-adapters.mjs';

function fixture(source, body, check = () => {}) {
  let count = 0;
  return {
    cache: false,
    sources: { [source]: true },
    get count() {
      return count;
    },
    fetchImpl: (url, init) => {
      count += 1;
      assert.equal(init.headers['user-agent'], USER_AGENT);
      check(new URL(url));
      const value = typeof body === 'function' ? body(new URL(url)) : body;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(value),
        text: () => Promise.resolve(value),
      });
    },
  };
}
const roundTrip = (concepts) =>
  assert.deepEqual(
    childrenNamed(parseLino(writeLino(concepts)), 'concept').map(parseConcept),
    concepts
  );

test('Wikipedia emits exact multiword language links and ignores missing articles', async () => {
  const api = fixture(
    'en.wikipedia',
    {
      query: {
        pages: [
          {
            pageid: 1,
            title: 'Value-added tax',
            langlinks: [
              { lang: 'ru', title: 'Налог на добавленную стоимость' },
            ],
          },
          { pageid: -1, missing: true },
        ],
      },
    },
    (url) => {
      assert.equal(url.searchParams.get('lllang'), 'ru');
    }
  );
  const links = await wikipediaLinks('value added tax', api);
  assert.equal(links[0].source, 'en.wikipedia');
  assert.deepEqual(links[0].en[0].words, ['value', 'added', 'tax']);
  assert.equal(links[0].ru.text, 'Налог на добавленную стоимость');
  roundTrip(links);
  assert.deepEqual(await wikipediaLinks('tax', api), []);
  assert.equal(api.count, 1);
});

const claim = (id) => ({
  rank: 'normal',
  mainsnak: { snaktype: 'value', datavalue: { value: { id } } },
});

test('lexeme sense item, translation and field links survive fixture compaction', async () => {
  const entities = {
    L1: {
      id: 'L1',
      language: 'Q1860',
      lexicalCategory: 'Q1084',
      lemmas: { en: { value: 'bank' } },
      claims: { P9488: [claim('Qfinance')] },
      senses: [
        {
          id: 'L1-S1',
          glosses: { en: { value: 'financial institution' } },
          claims: {
            P5137: [claim('Q730038')],
            P5972: [claim('L2-S1')],
            P9488: [claim('Qeconomy')],
          },
        },
      ],
    },
    L2: {
      id: 'L2',
      language: 'Q7737',
      lexicalCategory: 'Q1084',
      lemmas: { ru: { value: 'банк' } },
      senses: [
        { id: 'L2-S1', glosses: { ru: { value: 'финансовое учреждение' } } },
      ],
    },
  };
  const api = fixture('wikidata-lexemes', (url) => {
    const p = url.searchParams;
    return p.get('action') === 'wbsearchentities'
      ? { search: [{ id: 'L1', label: 'bank' }] }
      : compactResponse('wikidata-lexemes', {
          entities: Object.fromEntries(
            p
              .get('ids')
              .split('|')
              .map((id) => [id, entities[id]])
          ),
        });
  });
  const links = await lexemeLinks('bank', api);
  assert.equal(links[0].grounding, 'Q730038');
  assert.deepEqual(links[0].contexts, ['Qfinance', 'Qeconomy']);
  assert.deepEqual(links[0].translations, ['L2-S1']);
  assert.equal(links[0].russianSenses[0].word, 'банк');
  roundTrip(links);
});

test('Tatoeba sentence words remain paired evidence, with required query parameters', async () => {
  const api = fixture(
    'tatoeba',
    {
      data: [
        {
          id: 4,
          lang: 'eng',
          text: 'Read the book.',
          translations: [
            [{ id: 7, lang: 'rus', text: 'Читайте книгу.' }],
            [{ id: 8, lang: 'fra', text: 'Lisez.' }],
          ],
        },
      ],
    },
    (url) => {
      assert.equal(url.searchParams.get('lang'), 'eng');
      assert.equal(url.searchParams.get('trans:lang'), 'rus');
      assert.equal(url.searchParams.get('sort'), 'relevance');
    }
  );
  const links = await tatoebaLinks('book', api);
  assert.deepEqual(links[0].sentencePairs[0].russianWords, [
    'читайте',
    'книгу',
  ]);
  assert.equal(links[0].sentencePairs[0].englishWord, 'book');
  assert.equal(links[0].sentencePairs.length, 1);
  assert.equal(links[0].ru, undefined);
  roundTrip(links);
});

test('Kaikki parses every JSONL record and audits labels against our Wiktionary parser', async () => {
  const rows = [
    {
      word: 'bank',
      pos: 'noun',
      senses: [
        {
          glosses: ['financial institution'],
          topics: ['finance'],
          tags: ['countable'],
        },
      ],
    },
    {
      word: 'bank',
      pos: 'verb',
      senses: [{ glosses: ['deposit'], topics: ['business'] }],
    },
  ];
  const api = fixture(
    'kaikki',
    `${rows.map(JSON.stringify).join('\n')}\n`,
    (url) => {
      assert.equal(url.pathname, '/dictionary/English/meaning/b/ba/bank.jsonl');
    }
  );
  const links = await kaikkiLinks('bank', api);
  assert.equal(links.length, 2);
  const page =
    '==English==\n===Noun===\n# {{lb|en|finance|countable}} A financial institution.\n{{trans-top|financial institution}}\n* Russian: {{t|ru|банк|m}}\n{{trans-bottom}}';
  const own = publicSenses(
    new Map([['bank', englishEntries(page)]]),
    'bank',
    'noun'
  );
  const coverage = compareKaikkiCoverage(links, own);
  assert.ok(coverage.shared.includes('finance'));
  assert.ok(coverage.kaikkiOnly.includes('business'));
  roundTrip(links);
});

test('all evidence adapters respect source switches before making requests', async () => {
  const lexicon = new Lexicon();
  await loadSourceLinks('value added tax', lexicon, {
    cache: false,
    fetchImpl: () => {
      throw new Error('disabled source requested');
    },
    strict: true,
    sources: {
      'wikidata-lexemes': false,
      'en.wikipedia': false,
      tatoeba: false,
      kaikki: false,
    },
  });
  assert.deepEqual(lexicon.links.ids(), []);
  for (const [source, adapter] of Object.entries({
    'en.wikipedia': wikipediaLinks,
    'wikidata-lexemes': lexemeLinks,
    tatoeba: tatoebaLinks,
    kaikki: kaikkiLinks,
  })) {
    assert.deepEqual(
      await adapter('value added tax', {
        cache: false,
        sources: { [source]: false },
        fetchImpl: () => {
          throw new Error('disabled source requested');
        },
      }),
      []
    );
  }
});

test('JSONL travels through the registry bucket cache and can be replayed without fetch', async () => {
  const oldCache = process.env.FORMAL_AI_CACHE;
  const dir = mkdtempSync(join(tmpdir(), 'formal-ai-jsonl-'));
  process.env.FORMAL_AI_CACHE = dir;
  try {
    const api = fixture('kaikki', '{"word":"book","senses":[]}\n');
    const options = { ...api, cache: true, jsonLines: true, bucket: 'kaikki' };
    const url = 'https://kaikki.org/dictionary/English/meaning/b/bo/book.jsonl';
    const expected = await getJson(url, options);
    assert.deepEqual(
      await getJson(url, {
        ...options,
        fetchImpl: () => {
          throw new Error('cache missed');
        },
      }),
      expected
    );
    const bucket = join(dir, 'kaikki');
    const prefix = readdirSync(bucket)[0];
    const file = join(bucket, prefix, readdirSync(join(bucket, prefix))[0]);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), expected);
    assert.equal(api.count, 1);
  } finally {
    process.env.FORMAL_AI_CACHE = oldCache;
  }
});

test('evidence-only concepts are inspectable without changing lexical candidates', async () => {
  const lexicon = new Lexicon();
  const api = fixture('en.wikipedia', {
    query: {
      pages: [{ pageid: 1, langlinks: [{ lang: 'ru', title: 'Налог' }] }],
    },
  });
  await loadSourceLinks('value added tax', lexicon, { ...api, strict: true });
  assert.equal(lexicon.concepts.size, 0);
  assert.equal(lexicon.phrases.length, 0);
  assert.ok(
    lexicon
      .mergedLinks('value added tax')
      .some((link) => link.layer === 'en.wikipedia')
  );
});
