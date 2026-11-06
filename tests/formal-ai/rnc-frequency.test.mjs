import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseRanks,
  russianCorpusRanks,
  RNC_TITLE,
} from '../../formal-ai/src/sources/rnc-frequency.mjs';
import { Lexicon } from '../../formal-ai/src/lexicon.mjs';
import { resolveText } from '../../formal-ai/src/resolve.mjs';
import { resolveSenses } from '../../formal-ai/src/senses.mjs';
import { USER_AGENT } from '../../formal-ai/src/sources/fetch.mjs';

test('RNC formats normalize stress/ё and count homonyms without collapsing ranks', () => {
  const rows = parseRanks(
    '# [[всё]] (spro)\n# [[всё]] (part)\n# зака́з, s\n# {{l|ru|платформа|pos=s}}\n## not a ranked row',
    1000
  );
  assert.deepEqual(rows, [
    ['все', { rank: 1001, pos: 'spro' }],
    ['все', { rank: 1002, pos: 'part' }],
    ['заказ', { rank: 1003, pos: 's' }],
    ['платформа', { rank: 1004, pos: 's' }],
  ]);
});

test('RNC listing continuation, overlapping page offsets and persistent cache', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'formal-ai-rnc-'));
  const previous = process.env.FORMAL_AI_CACHE;
  process.env.FORMAL_AI_CACHE = directory;
  let calls = 0;
  const fetchImpl = (url, options) => {
    calls += 1;
    assert.equal(options.headers['user-agent'], USER_AGENT);
    const p = new URL(url).searchParams;
    let body;
    if (p.get('list') === 'allpages') {
      assert.equal(p.get('apnamespace'), '100');
      assert.equal(p.get('apprefix'), RNC_TITLE.slice(9));
      body = p.has('apcontinue')
        ? { query: { allpages: [{ title: `${RNC_TITLE}/2` }] } }
        : {
            continue: { apcontinue: 'next', continue: '-||' },
            query: {
              allpages: ['/10', '/1B', '/1A', '/1'].map((s) => ({
                title: RNC_TITLE + s,
              })),
            },
          };
    } else {
      assert.equal(p.get('action'), 'parse');
      assert.equal(p.get('prop'), 'wikitext');
      const suffix = p.get('page').slice(RNC_TITLE.length);
      const texts = {
        '': '# [[и]] (conj)\n# [[что]] (conj)\n# [[что]] (spro)\n# [[заказ]] (s)',
        '/1': '# и, conj\n# заказ, s',
        '/1A': '# {{l|ru|и|pos=conj}}',
        '/1B': '# {{l|ru|граница|pos=s}}',
        '/2': '# комиссия, s',
        '/10': '# помост, s',
      };
      body = { parse: { wikitext: { '*': texts[suffix] } } };
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
  try {
    const ranks = await russianCorpusRanks({ fetchImpl });
    assert.deepEqual(ranks.get('заказ'), { rank: 4, pos: 's' });
    assert.equal(ranks.get('что').rank, 2);
    assert.equal(ranks.get('граница').rank, 251);
    assert.equal(ranks.get('комиссия').rank, 1001);
    assert.equal(ranks.get('помост').rank, 9001);
    const before = calls;
    assert.deepEqual(await russianCorpusRanks({ fetchImpl }), ranks);
    assert.equal(calls, before);
    await russianCorpusRanks({ fetchImpl, cache: false });
    assert.ok(calls > before);
  } finally {
    if (previous === undefined) {
      delete process.env.FORMAL_AI_CACHE;
    } else {
      process.env.FORMAL_AI_CACHE = previous;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

test('resolveText attaches corpus ranks; rarity breaks ties but contextual cues win', async () => {
  const lexicon = new Lexicon();
  for (const [id, lemma, prior, cues] of [
    ['stage', 'помост', 0.22, ['wooden']],
    ['platform', 'платформа', 0.21, []],
    ['absent', 'неизвестное', 0, []],
    ['phrase', 'королевская семья', 0, []],
  ]) {
    lexicon.add({ id, source: 'fixture', en: [], ru: { lemma }, prior, cues });
  }
  const fetchImpl = (url) => {
    const p = new URL(url).searchParams;
    let body;
    if (p.get('list') === 'allpages') {
      body = {
        query: {
          allpages: ['/5', '/16'].map((s) => ({ title: RNC_TITLE + s })),
        },
      };
    } else {
      assert.equal(p.get('action'), 'parse');
      const suffix = p.get('page').slice(RNC_TITLE.length);
      body = {
        parse: {
          wikitext: {
            '*': { '': '', '/5': '# платформа, s', '/16': '# помост, s' }[
              suffix
            ],
          },
        },
      };
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  };
  await resolveText('', { lexicon, words: [], cache: false, fetchImpl });
  assert.equal(lexicon.get('stage').ruRank, 15001);
  assert.equal(lexicon.get('platform').ruRank, 4001);
  assert.equal(lexicon.get('absent').ruRank, undefined);
  assert.equal(lexicon.get('phrase').ruRank, undefined);
  const choose = (context = false) => {
    const node = {
      pos: 'noun',
      token: 0,
      text: 'platform',
      candidates: ['stage', 'platform'],
    };
    const tokens = [{ index: 0, kind: 'word', lower: 'platform' }];
    if (context) {
      tokens.push({ index: 1, kind: 'word', lower: 'wooden' });
    }
    return resolveSenses(
      { tokens, clauses: [{ subject: { head: node } }] },
      lexicon
    )[0];
  };
  assert.equal(choose().chosen, 'platform');
  assert.match(choose().allEvidence.stage.join(' '), /corpus rank 15001/);
  assert.equal(choose(true).chosen, 'stage');
  delete lexicon.get('stage').ruRank;
  assert.equal(
    choose().chosen,
    'stage',
    'missing corpus preserves the existing scoring'
  );
});
