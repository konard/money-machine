/** Offline Wiktionary parsing, word resolution, names and missing forms. */

import './setup.mjs';
import { rncFixture } from './rnc-fixture.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lexicon, loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { getJson } from '../../formal-ai/src/sources/fetch.mjs';
import {
  englishEntries,
  fetchPages,
  russianTemplates,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import { resolveNames, resolveText } from '../../formal-ai/src/resolve.mjs';
import { completeForms } from '../../formal-ai/src/forms.mjs';

const WIKTIONARY = 'en.wiktionary.org';
const WIKIDATA = 'www.wikidata.org';
const english = `==English==
===Noun===
# A small [[marsupial]].
====Translations====
{{trans-top|small marsupial}}
* Russian: {{t+|ru|кво́кка|f-an}}, {{t|fr|quokka|m}}
{{trans-bottom}}
`;
const russian = `==Russian==
===Noun===
{{ru-noun|кво́кка|f-an}}
# A quokka.
====Declension====
{{ru-noun-table|кво́кка|a=an}}
`;

/** Strict request/response script: unexpected requests never use real fetch. */
function stub(steps) {
  let next = 0;
  const fetchImpl = (url, options) => {
    try {
      const request = new URL(url);
      if (
        request.host === 'ru.wikipedia.org' &&
        request.searchParams.get('list') === 'search'
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ query: { searchinfo: { totalhits: 0 } } }),
        });
      }
      // Wiktionary's topical label list: absent, so the offline pattern decides.
      if (request.searchParams.get('titles') === 'Module:labels/data/topical') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ query: { pages: [] } }),
        });
      }
      const corpus = rncFixture(request.searchParams);
      if (corpus) {
        return corpus;
      }
      const step = steps[next++];
      assert.ok(step, `unexpected request: ${url}`);
      const parsed = new URL(url);
      assert.equal(parsed.host, step.host);
      assert.equal(parsed.pathname, '/w/api.php');
      assert.equal(options.method, step.method || 'GET');
      const params =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : parsed.searchParams;
      assert.deepEqual(Object.fromEntries(params), step.params);
      if (options.method === 'POST') {
        assert.equal(parsed.search, '');
        assert.equal(
          options.headers['content-type'],
          'application/x-www-form-urlencoded'
        );
      } else {
        assert.equal(options.body, undefined);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(step.response),
      });
    } catch (error) {
      // getJson retries nonfatal errors; a mismatched fixture should fail fast.
      throw Object.assign(error, { fatal: true });
    }
  };
  return { fetchImpl, done: () => assert.equal(next, steps.length) };
}

function pageRequest(title, content, requestedTitles = title) {
  return {
    host: WIKTIONARY,
    params: {
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      titles: requestedTitles,
    },
    response: {
      query: {
        pages: [{ title, revisions: [{ slots: { main: { content } } }] }],
      },
    },
  };
}

function renderRequest(title, text, html) {
  return {
    host: WIKTIONARY,
    method: 'POST',
    params: {
      action: 'parse',
      format: 'json',
      formatversion: '2',
      prop: 'text',
      title,
      text,
      disablelimitreport: '1',
    },
    response: { parse: { text: html } },
  };
}

test('englishEntries parses definitions, inflections and Russian translations', () => {
  const entries = englishEntries(`${english}
===Verb===
# {{past participle of|en|dispatch}}
${russian}`);
  assert.deepEqual(entries, [
    {
      pos: 'noun',
      rare: false,
      definitions: ['A small marsupial.'],
      rawDefinitions: ['A small [[marsupial]].'],
      formOf: [],
      senses: [
        {
          gloss: 'small marsupial',
          definition: 'A small marsupial.',
          labels: [],
          languages: 1,
          rare: false,
          russian: [
            {
              word: 'квокка',
              gender: 'f',
              plural: false,
              aspect: undefined,
              animate: true,
            },
          ],
        },
      ],
      see: [],
      subpage: false,
    },
    {
      pos: 'verb',
      rare: false,
      definitions: [],
      rawDefinitions: ['{{past participle of|en|dispatch}}'],
      formOf: [{ kind: 'past participle', lemma: 'dispatch' }],
      senses: [],
      see: [],
      subpage: false,
    },
  ]);
});

test('russianTemplates extracts headwords, tables and form-of lemmas', () => {
  assert.deepEqual(
    russianTemplates(`${english}${russian}
===Adjective===
# {{inflection of|ru|самостоя́тельный||short|n|s}}
==French==
===Noun===
{{ru-noun|ignored}}
`),
    [
      {
        pos: 'noun',
        headword: {
          name: 'ru-noun',
          positional: ['кво́кка', 'f-an'],
          named: {},
        },
        table: '{{ru-noun-table|кво́кка|a=an}}',
        source: '{{ru-noun|кво́кка|f-an}}',
        lemma: null,
      },
      {
        pos: 'adj',
        headword: null,
        table: null,
        source: '',
        lemma: 'самостоятельный',
      },
    ]
  );
});

test('getJson with cache:false fetches again instead of reusing memory', async () => {
  const request = {
    host: WIKTIONARY,
    params: {
      action: 'parse',
      prop: 'wikitext',
      page: 'quokka',
      format: 'json',
    },
  };
  const api = stub([
    { ...request, response: { parse: { wikitext: { '*': english } } } },
    { ...request, response: { parse: { wikitext: { '*': russian } } } },
  ]);
  const url = `https://${WIKTIONARY}/w/api.php?${new URLSearchParams(request.params)}`;
  const options = { fetchImpl: api.fetchImpl, cache: false };
  assert.deepEqual(await getJson(url, options), {
    parse: { wikitext: { '*': english } },
  });
  assert.deepEqual(await getJson(url, options), {
    parse: { wikitext: { '*': russian } },
  });
  api.done();
});

test('fetchPages follows normalized titles and redirects', async () => {
  const request = pageRequest('Quokkas', english);
  request.response.query = {
    normalized: [{ from: 'QUOKKAS', to: 'Quokkas' }],
    redirects: [{ from: 'Quokkas', to: 'quokka' }],
    pages: [
      {
        title: 'quokka',
        revisions: [{ slots: { main: { content: english } } }],
      },
    ],
  };
  request.params.titles = 'QUOKKAS';
  const api = stub([request]);
  const pages = await fetchPages(['QUOKKAS', 'QUOKKAS'], {
    fetchImpl: api.fetchImpl,
    cache: false,
  });
  // only what was asked for: a cached run reads exactly like a fresh one
  assert.deepEqual([...pages.keys()], ['QUOKKAS']);
  assert.equal(pages.get('QUOKKAS'), english);
  api.done();
});

test('resolveText follows an English inflection and learns rendered Russian forms', async () => {
  const lexicon = new Lexicon();
  const api = stub([
    pageRequest(
      'quokkas',
      '==English==\n===Noun===\n# {{plural of|en|quokka}}',
      'quokkas|Quokkas'
    ),
    pageRequest('quokka', english),
    pageRequest('квокка', russian),
    renderRequest(
      'квокка',
      '{{ru-noun|кво́кка|f-an}}\n\n{{ru-noun-table|кво́кка|a=an}}',
      '<abbr title="feminine gender">f</abbr><abbr title="animate">an</abbr>' +
        '<table><tr><td><span class="Cyrl form-of lang-ru gen|s-form-of">кво́кки</span></td></tr></table>'
    ),
  ]);
  assert.deepEqual(
    await resolveText('quokkas', {
      lexicon,
      fetchImpl: api.fetchImpl,
      cache: false,
    }),
    { words: 1, resolved: ['wikt:quokka:noun:1'], missing: [] }
  );
  const [id] = lexicon.lookup('noun', 'quokka');
  assert.equal(id, 'wikt:quokka:noun:1');
  assert.equal(lexicon.get(id).gloss, 'small marsupial');
  assert.equal(lexicon.get(id).ru.lemma, 'квокка');
  assert.equal(lexicon.get(id).ru.gender, 'f');
  assert.equal(lexicon.get(id).ru.animate, true);
  assert.equal(lexicon.get(id).ru.forms['sg.gen'], 'квокки');
  assert.deepEqual(lexicon.irregular('quokkas'), [
    { pos: 'noun', lemma: 'quokka', feature: 'plural' },
  ]);
  assert.ok(lexicon.asked('quokkas'));
  assert.ok(lexicon.asked('quokka'));
  api.done();
});

test('resolveNames chooses the exact match with most sitelinks and sets a Cyrillic label', async () => {
  const lexicon = new Lexicon();
  const api = stub([
    {
      host: WIKIDATA,
      params: {
        action: 'wbsearchentities',
        format: 'json',
        search: 'UK',
        language: 'en',
        uselang: 'en',
        type: 'item',
        limit: '5',
      },
      response: {
        search: [
          { id: 'Q1499', label: 'UK' },
          { id: 'Q145', label: 'United Kingdom', match: { text: 'UK' } },
          { id: 'Q999', label: 'UK magazine', match: { text: 'UK magazine' } },
        ],
      },
    },
    {
      host: WIKIDATA,
      params: {
        action: 'wbgetentities',
        format: 'json',
        ids: 'Q1499|Q145|Q999',
        props: 'labels|aliases|sitelinks|descriptions|claims',
        languages: 'ru|en|mul',
      },
      response: {
        entities: {
          Q1499: {
            labels: { ru: { value: 'Уттаракханд' } },
            sitelinks: { enwiki: {} },
          },
          Q145: {
            labels: { ru: { value: 'Великобритания' } },
            sitelinks: { enwiki: {}, ruwiki: {} },
          },
        },
      },
    },
    {
      ...pageRequest('Великобритания', ''),
      response: {
        query: { pages: [{ title: 'Великобритания', missing: true }] },
      },
    },
  ]);
  const hits = await resolveNames(['UK'], {
    lexicon,
    fetchImpl: api.fetchImpl,
    cache: false,
  });
  assert.deepEqual([...hits], [['UK', 'Q145']]);
  assert.equal(lexicon.nameLabel('UK'), 'Великобритания');
  assert.equal(lexicon.nameEntry('UK').lemma, 'Великобритания');
  api.done();
});

test('completeForms fills pastPassive from a rendered participle and skips completed entries', async () => {
  const lexicon = loadLexicon({ fresh: true });
  const verb = lexicon.get('send').ru.perfective;
  delete verb.pastPassive;
  const api = stub([
    pageRequest(
      'отправить',
      '==Russian==\n===Verb===\n{{ru-verb|отпра́вить|pf}}\n====Conjugation====\n{{ru-conj|pf|4a|отпра́вить}}'
    ),
    renderRequest(
      'отправить',
      '{{ru-verb|отпра́вить|pf}}\n\n{{ru-conj|pf|4a|отпра́вить}}',
      '<table><tr><td><span class="Cyrl form-of lang-ru past|act|part-form-of">отпра́вивший</span></td>' +
        '<td><span class="Cyrl form-of lang-ru past|pass|part-form-of"><a href="/wiki/отправленный">отпра́вленный, отпра́вленый</a></span></td></tr></table>'
    ),
  ]);
  const options = { lexicon, fetchImpl: api.fetchImpl, cache: false };
  assert.equal(await completeForms('sent', options), 1);
  assert.equal(verb.pastPassive, 'отправленный');
  assert.equal(await completeForms('sent', options), 0);
  assert.equal(await completeForms('we send', options), 0);
  api.done();
});

test('completeForms fills the imperative of a verb opening a sentence', async () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.get('send').ru.imperative = 'отправляй';
  const verb = lexicon.get('send').ru.perfective;
  delete verb.imperative;
  const api = stub([
    pageRequest(
      'отправить',
      '==Russian==\n===Verb===\n{{ru-verb|отпра́вить|pf}}\n====Conjugation====\n{{ru-conj|pf|4a|отпра́вить}}'
    ),
    renderRequest(
      'отправить',
      '{{ru-verb|отпра́вить|pf}}\n\n{{ru-conj|pf|4a|отпра́вить}}',
      '<table><tr><td><span class="Cyrl form-of lang-ru 2|s|imp-form-of">отпра́вь</span></td></tr></table>'
    ),
  ]);
  const options = { lexicon, fetchImpl: api.fetchImpl, cache: false };
  await completeForms('Send it.', options);
  assert.equal(verb.imperative, 'отправь');
});
