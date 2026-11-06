/** Recording must work with cold, disk and memory caches without changing data. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { getJson, USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import {
  compactResponse,
  compactWikitext,
} from '../../formal-ai/src/sources/compact.mjs';
import {
  englishEntries,
  fetchPages,
  russianTemplates,
  renderRussian,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import { parseRanks } from '../../formal-ai/src/sources/rnc-frequency.mjs';
import { claimIds } from '../../formal-ai/src/sources/lexemes.mjs';
import { publicEntries } from '../../formal-ai/src/public-expressions.mjs';
import { verbGovernment } from '../../formal-ai/src/sources/government.mjs';

const wikitext = `==French==
===Noun===
# Unrelated.
==English==
===Verb===
# {{lb|en|transitive}} To assist someone.
#* {{ux|en|'''assist''' someone to work}}
#: {{ux|en|'''assist''' with work}}
{{trans-top|assist someone}}
* French: {{t|fr|aider}}
*: Canadian French: {{t|fr|aider}}
* Russian: {{t|ru|помогать|impf}}
{{trans-bottom}}
{{see translation subpage|Verb}}
==Russian==
===Verb===
{{ru-verb|помога́ть|impf}}
# [[help]] {{+obj|ru|dat<someone>}}
{{ru-conj|1a|помога́ть}}
==Spanish==
===Noun===
# Unrelated.
`;
const response = {
  query: {
    normalized: [{ from: 'Assist', to: 'assist' }],
    pages: [
      {
        title: 'assist',
        revisions: [{ slots: { main: { content: wikitext } } }],
      },
    ],
  },
};

test('compacted dictionary sections retain senses, frames, government and subpages', () => {
  const compacted = compactWikitext(wikitext);
  assert.ok(compacted.length < wikitext.length);
  for (const parse of [englishEntries, publicEntries]) {
    const select = (text) =>
      parse(text).map(({ rawDefinitions: _raw, ...entry }) => entry);
    assert.deepEqual(select(compacted), select(wikitext));
  }
  assert.deepEqual(russianTemplates(compacted), russianTemplates(wikitext));
  assert.deepEqual(
    verbGovernment(compacted, '', { lemma: 'help' }),
    verbGovernment(wikitext, '', { lemma: 'help' })
  );
  const subpage = wikitext.replace(
    '{{see translation subpage|Verb}}',
    '{{trans-see|assist|aid}}'
  );
  assert.deepEqual(
    englishEntries(compactWikitext(subpage))[0].see,
    englishEntries(subpage)[0].see
  );
  // Translation subpages and ru.wiktionary language headings can lack ==English==.
  assert.equal(
    compactWikitext(
      '{{trans-top|help}}\n* Russian: {{t|ru|помощь}}\n{{trans-bottom}}'
    ),
    '{{trans-top|help}}\n* Russian: {{t|ru|помощь}}\n{{trans-bottom}}'
  );
});

test('record compact fixtures on network, disk and memory hits; never overwrite', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'formal-ai-recording-'));
  const names = [
    'FORMAL_AI_CACHE',
    'FORMAL_AI_FIXTURES',
    'FORMAL_AI_RECORD',
    'FORMAL_AI_OFFLINE',
  ];
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]])
  );
  t.after(() => {
    for (const name of names) {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    }
    rmSync(root, { recursive: true, force: true });
  });
  Object.assign(process.env, {
    FORMAL_AI_CACHE: join(root, 'cache'),
    FORMAL_AI_FIXTURES: join(root, 'fixtures'),
    FORMAL_AI_RECORD: '1',
    FORMAL_AI_OFFLINE: '1',
  });
  const path = (dir, url, body = '') => {
    const key = createHash('sha1').update(`${url}\n${body}`).digest('hex');
    return join(root, dir, 'wiktionary', key.slice(0, 2), `${key}.json`);
  };
  let calls = 0;
  const fetchImpl = (_url, init) => {
    calls += 1;
    assert.equal(init.headers['user-agent'], USER_AGENT);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
  };
  for (const mode of ['network', 'disk', 'memory']) {
    const url = `https://example.invalid/${mode}`;
    const options = { bucket: 'wiktionary', fetchImpl };
    if (mode === 'disk') {
      const disk = path('cache', url);
      mkdirSync(dirname(disk), { recursive: true });
      writeFileSync(disk, JSON.stringify(response));
    }
    if (mode === 'memory') {
      process.env.FORMAL_AI_RECORD = '';
      await getJson(url, options);
      rmSync(path('cache', url));
      assert.ok(!existsSync(path('fixtures', url)));
      process.env.FORMAL_AI_RECORD = '1';
    }
    assert.deepEqual(await getJson(url, options), response);
    const fixture = path('fixtures', url);
    assert.equal(
      readFileSync(fixture, 'utf8'),
      JSON.stringify(compactResponse('wiktionary', response))
    );
    writeFileSync(fixture, '{"existing":true}');
    await getJson(url, options);
    assert.equal(readFileSync(fixture, 'utf8'), '{"existing":true}');
  }
  assert.equal(calls, 2);
  // A new cache scope replays the fixture, never the old full memory response.
  process.env.FORMAL_AI_CACHE = join(root, 'empty');
  assert.deepEqual(
    await getJson('https://example.invalid/network', { bucket: 'wiktionary' }),
    { existing: true }
  );
  await assert.rejects(getJson('https://example.invalid/missing'), {
    offline: true,
  });
});

test('other public buckets retain all consumer data and input stays unchanged', () => {
  for (const bucket of ['http', 'tatoeba']) {
    const value = {
      query: {
        searchinfo: { totalhits: 42 },
        allpages: [{ title: 'Appendix:test' }],
        pages: response.query.pages,
      },
      continue: { apcontinue: 'next' },
      parse: {
        wikitext: { '*': '# [[слово]] (s)' },
        text: '<abbr title="animate">an</abbr>',
      },
    };
    assert.deepEqual(compactResponse(bucket, value), value);
  }
  const original = JSON.stringify(response);
  compactResponse('wiktionary', response);
  assert.equal(JSON.stringify(response), original);
});

test('compacted render HTML produces identical Russian forms and features', async () => {
  const full = {
    parse: {
      text: `<style>unused layout</style>
<span class="Cyrl form-of lang-ru nom|s-form-of"><a href="/wiki/test">сло́во</a></span>
<span class="Cyrl form-of lang-ru gen|p-form-of">слов</span>
<span class="Cyrl form-of lang-ru gen|p-form-of">словес</span>
<abbr class="gender" title="neuter gender">n</abbr>
<abbr title="inanimate">in</abbr>
<abbr title="plural number">p</abbr>
<a href="/wiki/Appendix:Russian_nouns" title="Appendix:Russian nouns">inan neut-form</a>
<p>indeclinable</p>`,
    },
  };
  const compacted = compactResponse('wiktionary-render', full);
  assert.ok(JSON.stringify(compacted).length < JSON.stringify(full).length);
  const render = (value) =>
    renderRussian(
      'слово',
      { source: '{{ru-noun|слово|n}}' },
      {
        cache: false,
        fetchImpl: () =>
          Promise.resolve({ ok: true, json: () => Promise.resolve(value) }),
      }
    );
  assert.deepEqual(await render(compacted), await render(full));
  assert.deepEqual(compactResponse('wiktionary-render', compacted), compacted);
});

test('RNC ranks, continuation listings and Russian Wikipedia hit counts survive compaction', () => {
  const full = {
    parse: {
      wikitext: {
        '*': 'Introduction\n# [[сло́во]] (s)\n# [[говорить]] (v)\nfooter',
      },
    },
  };
  const compacted = compactResponse('rnc-frequency', full);
  assert.deepEqual(
    parseRanks(compacted.parse.wikitext, 1000),
    parseRanks(full.parse.wikitext['*'], 1000)
  );
  const listing = {
    continue: { apcontinue: 'next' },
    query: { allpages: [{ title: 'Appendix:test' }] },
  };
  assert.deepEqual(compactResponse('rnc-frequency', listing), listing);
  for (const bucket of ['ruwiki-frequency', 'ruwiki-context']) {
    const value = {
      query: { searchinfo: { totalhits: 42 }, search: [{ title: 'Unused' }] },
    };
    assert.equal(compactResponse(bucket, value).query.searchinfo.totalhits, 42);
  }
});

test('Wikidata compaction preserves multilingual names, claims, lexeme forms and sitelink counts', () => {
  const claim = {
    rank: 'preferred',
    mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q5' } } },
    references: [{ unused: true }],
  };
  const full = {
    entities: {
      Q1: {
        id: 'Q1',
        labels: {
          ru: { language: 'ru', value: 'Имя' },
          de: { language: 'de', value: 'Name' },
        },
        aliases: { ru: [{ language: 'ru', value: 'ИМЯ' }] },
        descriptions: { en: { value: 'a given name' } },
        claims: { P31: [claim] },
        sitelinks: {
          enwiki: { title: 'Name', badges: [] },
          dewiki: { title: 'Name' },
        },
        senses: [
          {
            id: 'L1-S1',
            glosses: { en: { value: 'test' } },
            claims: { P5137: [claim] },
          },
        ],
        forms: [
          {
            id: 'L1-F1',
            representations: { ru: { value: 'имя' } },
            grammaticalFeatures: ['Q5'],
            claims: { P31: [claim] },
          },
        ],
      },
    },
  };
  const before = JSON.stringify(full);
  const entity = compactResponse('wikidata', full).entities.Q1;
  assert.equal(entity.labels.de.value, 'Name');
  assert.equal(entity.aliases.ru[0].value, 'ИМЯ');
  assert.equal(entity.descriptions.en.value, 'a given name');
  assert.deepEqual(claimIds(entity, 'P31'), claimIds(full.entities.Q1, 'P31'));
  assert.deepEqual(claimIds(entity.senses[0], 'P5137'), ['Q5']);
  assert.deepEqual(entity.forms[0].grammaticalFeatures, ['Q5']);
  assert.equal(entity.forms[0].representations.ru.value, 'имя');
  assert.equal(Object.keys(entity.sitelinks).length, 2);
  assert.equal(entity.sitelinks.enwiki.title, 'Name');
  assert.equal(JSON.stringify(full), before);
});

test('Russian Wiktionary compaction preserves management, homonyms and recipient examples', () => {
  const text = `= {{-ru-}} =
== {{з|I}} ==
{{помета|кому, чем}}
{{помета|на кого-что}}
{{пример|Он {{выдел|сказал}} ему правду.}}
=== Управление ===
кому, твор. п.
=== Значение ===
Unused definition and citation text.
== {{з|II}} ==
{{помета|кого}}
= {{-uk-}} =
Unrelated language.
`;
  const full = {
    query: {
      pages: [
        {
          title: 'говорить',
          revisions: [{ slots: { main: { content: text } } }],
        },
      ],
    },
  };
  const compacted = compactResponse('wiktionary-ru', full).query.pages[0]
    .revisions[0].slots.main.content;
  assert.ok(compacted.length < text.length);
  for (const sense of [
    { lemma: 'speak' },
    { lemma: 'give', definition: 'to offer something to' },
  ]) {
    assert.deepEqual(
      verbGovernment('', compacted, sense),
      verbGovernment('', text, sense)
    );
  }
});

test('parallel public searches produce identical batches regardless of completion order', async () => {
  const { resolveNames } = await import('../../formal-ai/src/resolve.mjs');
  const { loadLexicon } = await import('../../formal-ai/src/lexicon.mjs');
  const { termSenses } = await import('../../formal-ai/src/sources/terms.mjs');
  for (const reader of [resolveNames, termSenses]) {
    const batches = [];
    for (const firstDelay of [400, 0]) {
      const requests = [];
      const result = await reader(['Beta', 'Alpha'], {
        cache: false,
        lexicon: loadLexicon({
          dir: new URL('../../formal-ai/data/overrides', import.meta.url)
            .pathname,
        }),
        fetchImpl: async (url) => {
          const params = new URL(url).searchParams;
          let value;
          if (params.get('action') === 'wbsearchentities') {
            const name = params.get('search');
            await new Promise((resolve) =>
              setTimeout(resolve, name === 'Beta' ? firstDelay : 0)
            );
            value = { search: [{ id: `Q${name}`, label: name }] };
          } else {
            requests.push(params.get('ids'));
            value = {
              entities: Object.fromEntries(
                ['Alpha', 'Beta'].map((name) => [
                  `Q${name}`,
                  { labels: { en: { value: name } }, sitelinks: {} },
                ])
              ),
            };
          }
          return { ok: true, json: () => Promise.resolve(value) };
        },
      });
      if (result instanceof Map) {
        assert.deepEqual([...result.keys()], ['Alpha', 'Beta']);
      }
      batches.push(requests);
    }
    assert.deepEqual(batches[0], batches[1]);
  }
});

test('foreign-only pages retain lookup presence and insertion order', async () => {
  const full = {
    query: {
      pages: [
        {
          title: 'Foreign',
          revisions: [
            {
              slots: {
                main: {
                  content: '==French==\n===Noun===\n# A foreign-only page.',
                },
              },
            },
          ],
        },
      ],
    },
  };
  for (const value of [full, compactResponse('wiktionary', full)]) {
    const pages = await fetchPages(['Foreign'], {
      cache: false,
      fetchImpl: () =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(value) }),
    });
    assert.ok(pages.has('Foreign'));
    assert.deepEqual(publicEntries(pages.get('Foreign')), []);
  }
});
