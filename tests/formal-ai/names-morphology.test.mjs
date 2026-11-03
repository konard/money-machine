/** Public-data fixtures: names, brand boundaries and noun declension. */
import { rncFixture } from './rnc-fixture.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { analyze, tokenize } from '../../formal-ai/src/english/analyze.mjs';
import { mergeMultiwords } from '../../formal-ai/src/english/multiword.mjs';
import {
  nameCandidates,
  regularEntry,
  resolveText,
} from '../../formal-ai/src/resolve.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import {
  declineNoun,
  nounParadigm,
} from '../../formal-ai/src/russian/morphology.mjs';
import {
  renderRussian,
  russianTemplates,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import { indeclinableNoun } from '../../formal-ai/src/sources/indeclinable.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const names = {
  'Latin America': ['Q12585', 'Латинская Америка'],
  'Costa Rica': ['Q800', 'Коста-Рика'],
  'United Kingdom': ['Q145', 'Великобритания'],
  'Hong Kong': ['Q8646', 'Гонконг'],
  EU: ['Q458', 'Европейский союз'],
  IHK: ['Qtest', 'IHK'],
};
const forms = {
  'Латинская Америка': 'Латинской Америке',
  'Коста-Рика': 'Коста-Рике',
  Великобритания: 'Великобритании',
  Гонконг: 'Гонконге',
};
const vocabulary = {
  royalty: ['роялти', null],
  cafe: ['кафе', '{{ru-noun|кафе́|n-in|-}}'],
  euro: ['евро', '{{ru-noun+|е́вро|$|g=m-in}}'],
};

function fixture() {
  const requests = [];
  const fetchImpl = (url, options) => {
    const parsed = new URL(url);
    const p =
      options.method === 'POST'
        ? new URLSearchParams(options.body)
        : parsed.searchParams;
    const corpus = rncFixture(p);
    if (corpus) {
      return corpus;
    }
    requests.push({ host: parsed.host, params: Object.fromEntries(p) });
    assert.equal(options.headers['user-agent'], USER_AGENT);
    let body;
    if (
      parsed.host === 'www.wikidata.org' &&
      p.get('action') === 'wbsearchentities'
    ) {
      const name = p.get('search');
      const found = names[name];
      // EU deliberately has no exact search-result match: only its entity
      // aliases can prove it is the requested acronym.
      body = {
        search: found
          ? [{ id: found[0], label: name === 'EU' ? 'European Union' : name }]
          : [],
      };
    } else if (
      parsed.host === 'www.wikidata.org' &&
      p.get('action') === 'wbgetentities'
    ) {
      body = {
        entities: Object.fromEntries(
          Object.entries(names)
            .filter(([, [id]]) => p.get('ids').split('|').includes(id))
            .map(([en, [id, ru]]) => [
              id,
              {
                labels: { ru: { value: ru } },
                aliases: {
                  mul: [{ value: en }],
                  ru: en === 'EU' ? [{ value: 'ЕС' }] : [],
                },
                sitelinks: { enwiki: {}, ruwiki: {} },
              },
            ])
        ),
      };
    } else if (
      parsed.host === 'ru.wikipedia.org' &&
      p.get('list') === 'search'
    ) {
      body = { query: { searchinfo: { totalhits: 0 } } };
    } else if (parsed.host === 'ru.wiktionary.org') {
      assert.equal(p.get('action'), 'query');
      body = {
        query: {
          pages: p
            .get('titles')
            .split('|')
            .map((title) => ({
              title,
              revisions: [
                {
                  slots: {
                    main: {
                      content: '= {{-ru-}} =\n{{сущ ru n ina 0|основа=ро́ялти}}',
                    },
                  },
                },
              ],
            })),
        },
      };
    } else if (
      parsed.host === 'en.wiktionary.org' &&
      p.get('action') === 'query'
    ) {
      body = {
        query: {
          pages: p
            .get('titles')
            .split('|')
            .map((title) => {
              let content;
              if (forms[title]) {
                content = `==Russian==\n===Proper noun===\n{{ru-proper noun+|${title}}}\n{{ru-noun-table|${title}}}`;
              } else if (vocabulary[title]) {
                content = `==English==\n===Noun===\n# A test noun.\n{{trans-top|test noun}}\n* Russian: {{t|ru|${vocabulary[title][0]}|n}}\n{{trans-bottom}}`;
              } else {
                const head = Object.values(vocabulary).find(
                  ([ru]) => ru === title
                )?.[1];
                if (head) {
                  content = `==Russian==\n===Noun===\n${head}`;
                }
              }
              return content
                ? { title, revisions: [{ slots: { main: { content } } }] }
                : { title, missing: true };
            }),
        },
      };
    } else if (
      parsed.host === 'en.wiktionary.org' &&
      p.get('action') === 'parse'
    ) {
      const title = p.get('title');
      body = {
        parse: {
          text: forms[title]
            ? `<span class="Cyrl form-of lang-ru pre|s-form-of">${forms[title]}</span>`
            : '<abbr title="neuter gender">n</abbr>',
        },
      };
    } else {
      throw Object.assign(new Error(`Unexpected request: ${url}`), {
        fatal: true,
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
  return { fetchImpl, requests, cache: false };
}

test('dotted and hyphenated names retain boundaries and possessive clitics', () => {
  assert.deepEqual(
    tokenize("Tensor.Art, Ko-fi; Gumroad's PayPal’s.").map((t) => t.text),
    ['Tensor.Art', ',', 'Ko-fi', ';', 'Gumroad', "'s", 'PayPal', "'s", '.']
  );
  assert.deepEqual(
    tokenize('Hello. Next.').map((t) => t.text),
    ['Hello', '.', 'Next', '.']
  );
});

test('candidate spans include maximal names and shorter spans after initial verbs', () => {
  const candidates = nameCandidates(
    'Visit Latin America and Hong Kong.',
    loadLexicon({ fresh: true })
  );
  assert.ok(candidates.includes('Visit Latin America'));
  assert.ok(candidates.includes('Latin America'));
  assert.ok(candidates.includes('Hong Kong'));
  assert.ok(!candidates.some((n) => n.includes('and')));
});

test('exact entities merge longest names before parsing and use Russian case forms', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const api = fixture();
  const text =
    'I work in Latin America. I work in Costa Rica. I work in the United Kingdom. I work in Hong Kong.';
  await resolveText(text, { lexicon, ...api });
  assert.equal(
    translateDocument(text, { lexicon }).text,
    'Я работаю в Латинской Америке. Я работаю в Коста-Рике. Я работаю в Великобритании. Я работаю в Гонконге.'
  );
  const tokens = mergeMultiwords(analyze('Latin America', lexicon), lexicon);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].readings[0].pos, 'propn');
  // A known shorter entity must not win over a longer exact entity.
  lexicon.setNameLabel('Latin', 'Латынь');
  assert.equal(
    mergeMultiwords(analyze('Latin America', lexicon), lexicon)[0].text,
    'Latin America'
  );
  assert.equal(lexicon.nameLabel('America and'), undefined);
});

test('acronym aliases translate when verified; unknown Latin acronyms remain invariable', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const api = fixture();
  const text = 'I work in the EU. I work in IHK. I work in LLC.';
  await resolveText(text, { lexicon, ...api });
  assert.equal(
    translateDocument(text, { lexicon }).text,
    'Я работаю в ЕС. Я работаю в IHK. Я работаю в LLC.'
  );
  assert.equal(lexicon.nameLabel('EU'), 'ЕС');
  assert.equal(lexicon.nameEntry('EU'), undefined);
  for (const lemma of ['IHK', 'LLC', 'VAT', 'PayPal', 'Tensor.Art']) {
    assert.deepEqual(
      new Set(
        Object.values(nounParadigm({ lemma, forms: { 'pl.gen': 'bad' } }))
      ),
      new Set([lemma])
    );
  }
});

test('brand possessors use genitive without appending Russian endings', () => {
  const lexicon = loadLexicon({ fresh: true });
  for (const name of ['Gumroad', 'PayPal', 'Tensor.Art', 'Ko-fi']) {
    const translated = translateDocument(`I use ${name}'s account.`, {
      lexicon,
    }).text;
    assert.ok(
      translated.includes(`счёт ${name}`) ||
        translated.includes(`Счёт ${name}`),
      translated
    );
    assert.ok(!translated.includes('['), translated);
  }
});

test('explicit indeclinability survives both Wiktionaries through lexicon resolution', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const api = fixture();
  await resolveText('', { lexicon, ...api, words: Object.keys(vocabulary) });
  for (const [en, [ru]] of Object.entries(vocabulary)) {
    const entry = lexicon.get(lexicon.lookup('noun', en)[0]).ru;
    assert.equal(entry.indeclinable, true, en);
    for (const number of ['sg', 'pl']) {
      for (const kase of ['nom', 'gen', 'dat', 'acc', 'ins', 'prep']) {
        assert.equal(declineNoun(entry, kase, number), ru);
      }
    }
  }
  assert.ok(
    api.requests.some(
      (r) => r.host === 'ru.wiktionary.org' && r.params.titles === 'роялти'
    )
  );
  assert.equal(
    translateDocument('I use royalty.', { lexicon }).text,
    'Я использую роялти.'
  );
});

test('indeclinable tables and rendered markers are recognized without assuming empty tables prove it', async () => {
  for (const [head, table, html, expected] of [
    ['{{ru-noun+|ро́ялти|$}}', '{{ru-noun-table|ро́ялти|indecl}}', '', true],
    ['{{ru-noun|кафе́|n-in|-}}', '', '', true],
    ['{{ru-noun+|кафе́}}', '', 'несклоняемое', true],
    ['{{ru-noun+|сло́во}}', '', '', undefined],
  ]) {
    const [entry] = russianTemplates(
      `==Russian==\n===Noun===\n${head}\n${table}`
    );
    const result = await renderRussian('test', entry, {
      cache: false,
      fetchImpl: () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ parse: { text: html } }),
        }),
    });
    assert.equal(result.indeclinable, expected);
  }
  assert.equal(
    indeclinableNoun('= {{-ru-}} =\n{{сущ ru n ina 0|основа=роялти}}', 'роялти')
      .indeclinable,
    true
  );
  assert.equal(
    indeclinableNoun('= {{-ru-}} =\n{{сущ ru n ina 1a|основа=слово}}', 'слово'),
    null
  );
});

test('regular fallback rejects ambiguous foreign endings without public morphology', () => {
  for (const word of ['роялти', 'какаду', 'меню', 'евро']) {
    assert.equal(regularEntry('noun', { word, gender: 'n' }), null);
    assert.equal(
      regularEntry('noun', { word, indeclinable: true }).indeclinable,
      true
    );
  }
  assert.equal(
    declineNoun(regularEntry('noun', { word: 'банк' }), 'gen'),
    'банка'
  );
  assert.equal(declineNoun({ lemma: 'окно', gender: 'n' }, 'gen'), 'окна');
  assert.equal(
    declineNoun(
      { lemma: 'роялти', indeclinable: true, forms: { 'pl.nom': 'роялтиы' } },
      'nom',
      'pl'
    ),
    'роялти'
  );
});
