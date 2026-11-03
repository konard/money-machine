/** Offline Wiktionary snippets: frames select senses and Russian controllers. */
import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { parseSentence } from '../../formal-ai/src/english/clause.mjs';
import { resolveSenses } from '../../formal-ai/src/senses.mjs';
import { translateDocument } from '../../formal-ai/src/document.mjs';
import {
  englishEntries,
  russianTemplates,
} from '../../formal-ai/src/sources/wiktionary.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

const table = (gloss, ru) =>
  `{{trans-top|${gloss}}}\n* Russian: {{t|ru|${ru}}}\n{{trans-bottom}}`;
const en = (pos, definitions, tables) =>
  `==English==\n===${pos}===\n${definitions}\n====Translations====\n${tables}`;
const ask = en(
  'Verb',
  `# To [[request]] or [[petition]].
## {{lb|en|transitive|intransitive}} To {{l|en|request}} (information, or an [[answer]] to a [[question]]).
##: {{ux|en|Did you '''ask''' about Mother?}}
## {{lb|en|transitive}} To request (someone to do something).
##: {{ux|en|Emma '''asked''' Jim to close his eyes.}}`,
  `${table('request an answer', 'спрашивать')}\n${table('make a request', 'просить')}`
);
const allow = en(
  'Verb',
  `# {{lb|en|transitive|catenative}} To [[permit]], to give [[permission]] to.
#: {{ux|en|I will '''allow''' my son to be absent.}}
# {{lb|en|transitive}} To make an [[allowance]], to take into [[account]] when making plans.`,
  `${table('give permission', 'позволять')}\n${table('make allowance', 'учитывать')}`
);
const ru = (lemma, obj, partner) =>
  `==Russian==\n===Verb===\n{{ru-verb|${lemma}|impf|pf=${partner}}}\n# A fixture. {{+obj|ru|${obj}<someone> + inf<to do something>}}`;
const pages = {
  ask,
  allow,
  спрашивать: ru('спрашивать', 'acc', 'спросить'),
  спросить: '==Russian==\n===Verb===\n{{ru-verb|спросить|pf}}',
  просить: ru('просить', 'acc', 'попросить'),
  позволять: ru('позволять', 'dat', 'позволить'),
  попросить: '==Russian==\n===Verb===\n{{ru-verb|попросить|pf}}',
  позволить: '==Russian==\n===Verb===\n{{ru-verb|позволить|pf}}',
};
const imperative = {
  попросить: 'попроси',
  позволить: 'позволь',
  спросить: 'спроси',
};
const fetchImpl = (url, options) => {
  assert.equal(options.headers['user-agent'], USER_AGENT);
  const p = options.body
    ? new URLSearchParams(options.body)
    : new URL(url).searchParams;
  let body = {};
  if (p.has('titles')) {
    body = {
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
    };
  } else if (p.get('action') === 'parse') {
    body = {
      parse: {
        text: imperative[p.get('title')]
          ? `<span class="Cyrl form-of lang-ru 2|s|imp-form-of">${imperative[p.get('title')]}</span>`
          : '',
        wikitext: { '*': '' },
      },
    };
  } else if (new URL(url).host === 'ru.wikipedia.org') {
    body = { query: { searchinfo: { totalhits: 0 } } };
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};

test('nested definitions keep frame evidence with the matching translation table', () => {
  const [entry] = englishEntries(ask);
  assert.ok(entry.senses[1].frames.includes('object-to'));
  assert.ok(!entry.senses[0].frames.includes('object-to'));
  assert.ok(entry.senses[0].frames.includes('about'));
  assert.equal(
    entry.senses[0].definition,
    'To request (information, or an answer to a question).'
  );
  assert.deepEqual(russianTemplates(pages.позволять)[0].government, {
    preposition: null,
    case: 'dat',
  });
  assert.deepEqual(russianTemplates(pages.просить)[0].government, {
    preposition: null,
    case: 'acc',
  });
});

test('existing verbs gain frame senses; object control uses the selected Russian case', async () => {
  const lexicon = loadLexicon({ fresh: true });
  await resolveText('Ask them to wait. Allow them to wait.', {
    lexicon,
    fetchImpl,
    cache: false,
  });
  assert.equal(
    translateDocument('Ask them to wait.', { lexicon }).text,
    'Попросите их подождать.'
  );
  assert.equal(
    translateDocument('Allow them to wait.', { lexicon }).text,
    'Позвольте им подождать.'
  );
  assert.match(
    translateDocument('Ask them about work.', { lexicon }).text,
    /^Спросите их о/
  );
  const parsed = parseSentence('Allow them to wait.', lexicon);
  const decisions = resolveSenses(parsed, lexicon);
  assert.ok(
    decisions
      .find((d) => d.word === 'Allow')
      .evidence.includes('valency object-to (+4)')
  );
});

test('frame labels distinguish arbitrary verb senses with that/whether complements and passives', () => {
  for (const [frame, tail] of [
    ['that', { link: { text: 'that' } }],
    ['question', { link: { text: 'whether' } }],
    ['about', null],
  ]) {
    const lexicon = loadLexicon({ fresh: true });
    for (const kind of ['that', 'question', 'about']) {
      lexicon.add({
        id: `fixture.${kind}`,
        source: 'fixture',
        en: [],
        gloss: 'fixture',
        frames: [kind],
        classes: [],
        cues: [],
        ru: { pos: 'verb', lemma: 'делать' },
      });
    }
    const verb = {
      pos: 'verb',
      token: 0,
      text: 'fixture',
      candidates: ['fixture.that', 'fixture.question', 'fixture.about'],
    };
    const clause = {
      verb,
      objects: [],
      mods: frame === 'about' ? [{ prep: 'about' }] : [],
    };
    resolveSenses(
      {
        tokens: [{ index: 0, lower: 'fixture' }],
        clauses: tail ? [clause, tail] : [clause],
      },
      lexicon
    );
    assert.equal(verb.concept, `fixture.${frame}`);
  }
  const lexicon = loadLexicon({ fresh: true });
  for (const [id, frames] of [
    ['intr', ['intransitive']],
    ['tr', ['transitive']],
  ]) {
    lexicon.add({
      id,
      en: [],
      frames,
      gloss: 'fixture',
      classes: [],
      cues: [],
      ru: { pos: 'verb', lemma: 'делать' },
    });
  }
  const verb = { token: 0, pos: 'verb', candidates: ['intr', 'tr'] };
  resolveSenses(
    {
      tokens: [{ index: 0, lower: 'fixture' }],
      clauses: [{ verb, passive: true }],
    },
    lexicon
  );
  assert.equal(verb.concept, 'tr');
});

test('recurring passives and purpose infinitives retain their clause frames', () => {
  const lexicon = loadLexicon({ fresh: true });
  for (const [word, pos, ru, extra] of [
    ['set', 'verb', 'устанавливать', { past: 'set', participle: 'set' }],
    ['set', 'adj', 'устойчивый', {}],
    ['weekly', 'adv', 'еженедельно', {}],
    ['app', 'noun', 'приложение', {}],
    ['track', 'verb', 'отслеживать', {}],
    ['track', 'noun', 'след', {}],
    ['sale', 'noun', 'продажа', { plural: 'sales' }],
  ]) {
    lexicon.add({
      id: `fixture.${word}.${pos}`,
      source: 'fixture',
      en: [{ pos, lemma: word, words: [word], ...extra }],
      ru: { pos, lemma: ru },
      gloss: word,
      cues: [],
      classes: [],
    });
  }
  const passive = parseSentence('Prices are set weekly.', lexicon).clauses[0];
  assert.equal(passive.passive, true);
  assert.equal(passive.verb.lemma, 'set');
  const purpose = parseSentence('Use the app to track sales.', lexicon)
    .clauses[0];
  assert.equal(purpose.xcomp.purpose, true);
  assert.equal(purpose.xcomp.verb.lemma, 'track');
  assert.equal(purpose.xcomp.objects[0].head.lemma, 'sale');
});
