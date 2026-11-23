/** Public evidence for recurring lexical ambiguities; all API responses are offline. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { englishEntries } from '../../formal-ai/src/sources/wiktionary.mjs';
import { publicSenses } from '../../formal-ai/src/sources/sense-data.mjs';
import { predicateEvidence } from '../../formal-ai/src/english/participle-evidence.mjs';
import { completeDerivations } from '../../formal-ai/src/sources/productive-definitions.mjs';
import { supplementTerms } from '../../formal-ai/src/sources/terms.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';
import { rememberPartsOfSpeech } from '../../formal-ai/src/english/nominal-evidence.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { resolveSenses } from '../../formal-ai/src/senses.mjs';

function fixture(pages = {}, entities = {}) {
  return {
    cache: false,
    fetchImpl: (url, options) => {
      assert.equal(options.headers['user-agent'], USER_AGENT);
      const u = new URL(url);
      const p =
        options.method === 'POST'
          ? new URLSearchParams(options.body)
          : u.searchParams;
      let body;
      if (p.get('titles')) {
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
      } else if (p.get('action') === 'parse') {
        body = {
          parse: {
            text: '<span class="Cyrl form-of lang-ru short|n|s-form-of">широко</span>',
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
      } else {
        throw new Error(`Unexpected request ${url}`);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    },
  };
}
const table = (pos, gloss, ru) =>
  `==English==\n===${pos}===\n# ${gloss}\n{{trans-top|${gloss}}}\n* Russian: {{t|ru|${ru}}}\n{{trans-bottom}}`;

test('all labelled adjective definitions support passive evidence, including domain labels', () => {
  const entries = new Map([
    [
      'rated',
      [
        {
          pos: 'adj',
          rawDefinitions: [
            '{{lb|en|now|_|rare}} Scolded.',
            '{{lb|en|engineering}} Maximum load.',
            '{{lb|en|in combinations}} Having a rating.',
          ],
        },
      ],
    ],
  ]);
  assert.equal(
    predicateEvidence(entries, { pos: 'adj', lemma: 'rated' }).restricted,
    true
  );
  entries.get('rated')[0].rawDefinitions.push('Ordinary state.');
  assert.equal(
    predicateEvidence(entries, { pos: 'adj', lemma: 'rated' }).restricted,
    false
  );
});

test('a head noun in a qualified definition is not an alternative form', () => {
  const [e] = englishEntries(
    '==English==\n===Noun===\n# {{lb|en|finance}} A [[measure]] implemented by a government.'
  );
  assert.deepEqual(e.formOf, []);
  const [synonym] = englishEntries(
    '==English==\n===Noun===\n# A [[document]].'
  );
  assert.equal(synonym.formOf[0].lemma, 'document');
});

test('historical section labels survive inherited translation pointers', () => {
  const source = englishEntries(
    '==English==\n===Verb===\n# {{lb|en|obsolete}} To [[berate]], [[scold]].\n{{trans-see|berate}}'
  );
  const target = englishEntries(table('Verb', 'chide vehemently', 'ругать'));
  const senses = publicSenses(
    new Map([
      ['rate', source],
      ['berate', target],
    ]),
    'rate',
    'verb'
  );
  assert.ok(senses.some((s) => s.russian.length));
  assert.ok(senses.filter((s) => s.russian.length).every((s) => s.rare));
});

test('rare senses cannot win over living senses even with a larger prior', () => {
  const lexicon = loadLexicon({ fresh: true });
  for (const [id, usagePenalty, prior] of [
    ['ordinary', 0, 0.1],
    ['rare', 1, 100],
  ]) {
    lexicon.add({
      id: `fixture.${id}`,
      en: [{ pos: 'noun', lemma: 'widget', words: ['widget'] }],
      ru: { pos: 'noun', lemma: 'прибор', gender: 'm' },
      usagePenalty,
      prior,
    });
  }
  const parsed = parseSentence('I see a widget.', lexicon);
  const decisions = resolveSenses(parsed, lexicon);
  assert.equal(
    decisions.find((d) => d.word === 'widget').chosen,
    'fixture.ordinary'
  );
});

test('manner adverbs follow adjective translation pointers and public short neuter morphology', async () => {
  const pages = {
    broadly: '==English==\n===Adverb===\n# In a wide manner.',
    broad: '==English==\n===Adjective===\n# Wide.\n{{trans-see|wide}}',
    wide: table('Adjective', 'wide', 'широкий'),
    широкий: '==Russian==\n===Adjective===\n{{ru-adj|широ́кий}}',
  };
  const plans = [];
  await completeDerivations(
    plans,
    new Map([['broadly', englishEntries(pages.broadly)]]),
    fixture(pages),
    { words: ['broadly'] }
  );
  assert.equal(
    plans.find((p) => p.pos === 'adv').senses[0].russian[0].word,
    'широко'
  );
});

test('an inflected missing noun can resolve an exact public concept', async () => {
  const entities = {
    Qcharge: {
      labels: {
        en: { value: 'chargeback' },
        ru: { value: 'возвратный платёж' },
      },
      claims: { P279: [{}] },
    },
  };
  const plans = await supplementTerms('', {
    entries: new Map([
      [
        'chargeback',
        englishEntries(
          '==English==\n===Noun===\n# A reversal of an accounting entry.'
        ),
      ],
    ]),
    plans: [],
    lexicon: loadLexicon({ fresh: true }),
    words: ['chargebacks'],
    forms: [
      { form: 'chargebacks', lemma: 'chargeback', kind: 'plural', pos: 'noun' },
    ],
    options: fixture({}, entities),
  });
  assert.equal(plans[0].senses[0].russian[0].word, 'возвратный платёж');
});

test('a noun-first relational homonym remains a compound modifier', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.country.noun',
    en: [{ pos: 'noun', lemma: 'country', words: ['country'] }],
    ru: { pos: 'noun', lemma: 'страна', gender: 'f' },
  });
  lexicon.add({
    id: 'fixture.country.adj',
    en: [{ pos: 'adj', lemma: 'country', words: ['country'] }],
    ru: { pos: 'adj', lemma: 'деревенский' },
  });
  rememberPartsOfSpeech(
    new Map([
      [
        'country',
        englishEntries(
          '==English==\n===Noun===\n# A nation.\n===Adjective===\n# From the countryside.'
        ),
      ],
    ]),
    lexicon
  );
  const np = parseSentence('Country books.', lexicon).clauses[0].np;
  assert.equal(np.modifiers[0].pos, 'noun');
});

test('a matching final finite form coordinates a predicate after a prepositional object', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.quit.noun',
    en: [{ pos: 'noun', lemma: 'quit', words: ['quit'] }],
    ru: { pos: 'noun', lemma: 'увольнение', gender: 'n' },
  });
  lexicon.add({
    id: 'fixture.quit.verb',
    en: [{ pos: 'verb', lemma: 'quit', words: ['quit'] }],
    ru: { pos: 'verb', lemma: 'бросать' },
  });
  const parsed = parseSentence('They work on books and quit.', lexicon);
  assert.equal(parsed.clauses.length, 2);
  assert.equal(parsed.clauses[1].verb.lemma, 'quit');
});

test('noun gerunds after a colon retain nominal syntax and preceding focus', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.reading',
    en: [{ pos: 'noun', lemma: 'reading', words: ['reading'] }],
    ru: { pos: 'noun', lemma: 'чтение', gender: 'n' },
  });
  const parsed = parseSentence('Books: reading only.', lexicon);
  assert.equal(parsed.clauses.length, 1);
  assert.equal(parsed.clauses[0].factValue.head.pos, 'noun');
  assert.equal(parsed.clauses[0].factFocus.lemma, 'only');
});

test('a secondary noun cannot absorb a headline predicate adjective', () => {
  const lexicon = loadLexicon({ fresh: true });
  lexicon.add({
    id: 'fixture.reachable.noun',
    related: true,
    en: [{ pos: 'noun', lemma: 'reachable', words: ['reachable'] }],
    ru: { pos: 'noun', lemma: 'доступ', gender: 'm' },
  });
  lexicon.add({
    id: 'fixture.reachable.adj',
    en: [{ pos: 'adj', lemma: 'reachable', words: ['reachable'] }],
    ru: { pos: 'adj', lemma: 'доступный' },
  });
  lexicon.add({
    id: 'fixture.platform',
    en: [{ pos: 'noun', lemma: 'platform', words: ['platform'] }],
    ru: { pos: 'noun', lemma: 'платформа', gender: 'f' },
  });
  const parsed = parseSentence('Platform reachable in countries.', lexicon);
  assert.equal(parsed.clauses[0].frame, 'copula');
  assert.equal(parsed.clauses[0].complement.lemma, 'reachable');
});

import { completeRestrictedDefinitions } from '../../formal-ai/src/sources/restricted-definitions.mjs';
import { compoundCandidates } from '../../formal-ai/src/compounds.mjs';
import { contextFrequencies } from '../../formal-ai/src/sources/context-frequency.mjs';

test('inflected dictionary forms produce singular multiword lookup titles', () => {
  const lexicon = loadLexicon({ fresh: true });
  const titles = compoundCandidates('Capital controls', lexicon, [
    { form: 'controls', lemma: 'control', kind: 'plural', pos: 'noun' },
  ]);
  assert.ok(titles.includes('capital control'));
});

test('restricted verb definitions inherit only object-compatible public equivalents', async () => {
  const sense = {
    gloss: 'to waste',
    definition: 'To waste time, money or other resources.',
    russian: [],
  };
  const plans = [{ lemma: 'burn', pos: 'verb', senses: [sense] }];
  await completeRestrictedDefinitions(
    plans,
    fixture({ waste: table('Verb', 'To spend money wastefully.', 'тратить') })
  );
  assert.equal(sense.russian[0].word, 'тратить');
  assert.ok(sense.objectClasses.includes('money'));
  assert.ok(sense.frames.includes('transitive'));
});

test('an attested gerund noun is not suppressed by the same spelling as a verb form', async () => {
  const entities = {
    Qreport: {
      labels: { en: { value: 'reporting' }, ru: { value: 'отчётность' } },
      claims: {},
    },
  };
  const plans = await supplementTerms('', {
    entries: new Map([
      [
        'reporting',
        englishEntries('==English==\n===Noun===\n# The creation of reports.'),
      ],
    ]),
    plans: [],
    lexicon: loadLexicon({ fresh: true }),
    words: ['reporting'],
    forms: [
      {
        form: 'reporting',
        lemma: 'report',
        kind: 'present participle',
        pos: 'verb',
      },
    ],
    options: fixture({}, entities),
  });
  assert.equal(plans[0].senses[0].russian[0].word, 'отчётность');
});

test('public noun–predicate corpus counts retain the predicate association', async () => {
  const lexicon = loadLexicon({ fresh: true });
  for (const [id, lemma] of [
    ['one', 'платформа'],
    ['two', 'помост'],
  ]) {
    lexicon.add({
      id: `fixture.${id}`,
      en: [{ pos: 'noun', lemma: 'widget', words: ['widget'] }],
      ru: { pos: 'noun', lemma, gender: 'f' },
    });
  }
  lexicon.add({
    id: 'fixture.reach',
    en: [{ pos: 'adj', lemma: 'reachable', words: ['reachable'] }],
    ru: { pos: 'adj', lemma: 'доступный' },
  });
  const fetchImpl = (url, options) => {
    assert.equal(options.headers['user-agent'], USER_AGENT);
    assert.equal(new URL(url).hostname, 'ru.wikipedia.org');
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ query: { searchinfo: { totalhits: 21 } } }),
    });
  };
  await contextFrequencies('The widget is reachable.', lexicon, {
    cache: false,
    fetchImpl,
  });
  assert.equal(lexicon.get('fixture.one').propertyFrequency['доступный'], 21);
  assert.equal(lexicon.get('fixture.two').propertyFrequency['доступный'], 21);
});

import { compactWikitext } from '../../formal-ai/src/sources/compact.mjs';
test('foreign-only public entries retain language metadata in offline fixtures', () => {
  const compact = compactWikitext(
    '==Italian==\n===Pronoun===\n# A foreign possessive.'
  );
  assert.match(compact, /^==Italian==/);
  assert.doesNotMatch(compact, /possessive/);
});
