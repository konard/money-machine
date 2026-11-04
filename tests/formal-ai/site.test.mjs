/* global structuredClone */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  proseFields,
  reassemble,
  translateCached,
  translatorHash,
  matchesGlob,
} from '../../formal-ai/scripts/site-memory.mjs';
import {
  translateSite,
  options,
} from '../../formal-ai/scripts/translate-site.mjs';
import { DOC_SOURCES, layout } from '../../scripts/build-website.mjs';
import { localizeApp, languageSwitch } from '../../scripts/site-russian.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'formal-site-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path, text) => {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), text);
  };
  await put('formal-ai/src/version.mjs', 'fixture');
  await put('formal-ai/scripts/version.mjs', 'fixture');
  await put(
    'docs/business-plans/example.md',
    '# A plan\n\nA source sentence.\n'
  );
  await put('docs/business-plans/README.md', '# Plans\n\n[Plan](example.md)\n');
  for (const [path] of DOC_SOURCES) {
    await put(path, '# A document\n\nA source sentence.\n');
  }
  await put(
    'website/strategies.json',
    JSON.stringify({
      count: 1,
      strategies: [
        {
          id: 'example',
          name: 'Example Name',
          summary: 'A source sentence.',
          businessPlan: { notes: 'More source prose.' },
        },
      ],
      shortlists: [{ title: 'A shortlist title', ids: ['example'] }],
    })
  );
  return { root, put };
}

test('site memory invalidates only changed source/version and force; failures are not cached', async () => {
  const memory = {};
  let calls = 0;
  const args = {
    source: 'a.md',
    text: 'Source',
    version: 'v1',
    memory,
    translate: () => ({ text: `ru${++calls}` }),
  };
  assert.equal((await translateCached(args)).cached, false);
  assert.equal((await translateCached(args)).cached, true);
  assert.equal(
    (await translateCached({ ...args, text: 'Changed' })).cached,
    false
  );
  assert.equal(
    (await translateCached({ ...args, version: 'v2' })).cached,
    false
  );
  assert.equal((await translateCached({ ...args, force: true })).cached, false);
  assert.equal(calls, 4);
  assert.ok(Object.keys(memory).every((key) => /^[a-f0-9]{40}$/.test(key)));
  await assert.rejects(
    translateCached({
      ...args,
      text: 'Failure',
      translate: () => {
        throw new Error('fixture');
      },
    })
  );
  assert.equal((await translateCached(args)).cached, true);
});

test('JSON prose reassembly preserves structure, names, URLs, IDs and numbers', () => {
  const data = {
    count: 1,
    strategies: [
      {
        id: 'my-id',
        name: 'Proper Name',
        sourceFile: 'some file.json',
        category: 'technical-category',
        platforms: ['Proper Name'],
        sources: ['https://example.com/a b'],
        tags: ['long tag'],
        rank: 7,
        summary: 'Some prose here.',
        payout: {
          notes: 'Other prose here.',
          methods: ['Bank transfer', 'PayPal', 'check'],
        },
        businessPlan: {
          notes: 'Nested plan prose.',
          price: 12,
          marketConditions: { demandTrend: 'stable', competition: 'low' },
        },
      },
    ],
    shortlists: [{ title: 'Title prose here', ids: ['my-id'] }],
  };
  const before = structuredClone(data);
  const fields = proseFields(data);
  assert.deepEqual(
    fields.map((f) => f.text),
    [
      'Some prose here.',
      'Other prose here.',
      'Bank transfer',
      'Nested plan prose.',
      'Title prose here',
    ]
  );
  const result = reassemble(
    data,
    fields,
    fields.map((_, i) => `перевод ${i}`)
  );
  assert.deepEqual(data, before);
  const restore = reassemble(
    result,
    fields,
    fields.map((f) => f.text)
  );
  assert.deepEqual(restore, data);
  assert.equal(result.strategies[0].name, 'Proper Name');
  assert.equal(result.strategies[0].businessPlan.price, 12);
  assert.equal(
    result.strategies[0].businessPlan.marketConditions.demandTrend,
    'stable'
  );
  assert.equal(
    result.strategies[0].businessPlan.marketConditions.competition,
    'low'
  );
  assert.equal(result.strategies[0].payout.methods[2], 'check');
});

test('site glob filters and option validation', () => {
  assert.ok(matchesGlob('docs/business-plans/a.md', 'docs/**/*.md'));
  assert.ok(matchesGlob('strategies.json#example', 'strategies.json*'));
  assert.ok(
    matchesGlob('docs/legal/a.md', [
      'docs/business-plans/*.md',
      'docs/legal/*.md',
    ])
  );
  assert.ok(!matchesGlob('docs/legal/a.md', 'docs/business-plans/*.md'));
  assert.equal(options(['--limit', '2', '--force']).limit, 2);
  assert.throws(() => options(['--only']));
  assert.throws(() => options(['--timeout', '-1']));
});

test('site memory tracks translator edits between documents', async (t) => {
  const { root, put } = await fixture(t);
  let calls = 0;
  const translate = async (texts) => {
    calls += 1;
    if (calls === 1) {
      await put('formal-ai/src/version.mjs', 'edited while translating');
    }
    return texts.map(() => ({
      text: 'Перевод.',
      sentences: [{ source: 'Source.', text: 'Перевод.', complete: true }],
    }));
  };
  const args = {
    root,
    translate,
    log: () => {},
    only: 'docs/business-plans/*.md',
  };
  const first = await translateSite(args);
  assert.notEqual(
    first.documents[0].translatorVersion,
    first.documents[1].translatorVersion
  );
  assert.equal(first.version, first.documents[1].translatorVersion);
  const second = await translateSite(args);
  assert.equal(calls, 3);
  assert.equal(second.documents[0].cached, false);
  assert.equal(second.documents[1].cached, true);
});

test('site run rejects missing catalog input instead of producing an empty mirror', async (t) => {
  const { root } = await fixture(t);
  await rm(join(root, 'website/strategies.json'));
  await assert.rejects(
    translateSite({
      root,
      log: () => {},
      translate: () => {
        throw new Error('must not translate');
      },
    }),
    { code: 'ENOENT' }
  );
});

test('real offline worker resets Node flags and continues after a lookup failure', async (t) => {
  const { root, put } = await fixture(t);
  const source = '# 123\n\n```js\nconst x = "$&";\n```\n';
  await put('docs/business-plans/example.md', source);
  await put('docs/business-plans/README.md', '# 1\n');
  await put('docs/business-plans/bad.md', 'Quux.');
  const module = new URL(
    '../../formal-ai/scripts/translate-site.mjs',
    import.meta.url
  ).href;
  const code = `import { translateSite } from ${JSON.stringify(module)}; await translateSite({ root: ${JSON.stringify(root)}, only: 'docs/business-plans/*.md', timeout: 5000, log: () => {} });`;
  await promisify(execFile)(
    process.execPath,
    ['--input-type=module', '--eval', code],
    {
      timeout: 15000,
      env: {
        ...process.env,
        FORMAL_AI_OFFLINE: '1',
        FORMAL_AI_CACHE: join(root, 'public-cache'),
      },
    }
  );
  const report = JSON.parse(
    await readFile(join(root, 'formal-ai/.site-ru/report.json'), 'utf8')
  );
  assert.equal(report.failed, 0);
  assert.equal(report.resolutionWarnings, 1);
  assert.match(
    report.documents.find((d) => d.source.endsWith('/bad.md')).resolutionError,
    /offline/
  );
  assert.equal(
    await readFile(
      join(root, 'formal-ai/.site-ru/docs/business-plans/example.md'),
      'utf8'
    ),
    source
  );
});

test('site run persists incremental memory, restores output, and continues after document errors', async (t) => {
  const { root, put } = await fixture(t);
  let calls = 0;
  const translate = (texts) => {
    calls += 1;
    return texts.map((text) => ({
      text: text.replace('source sentence', 'предложение'),
      sentences: [{ source: text, text: 'перевод', complete: true, notes: [] }],
    }));
  };
  const args = {
    root,
    translate,
    log: () => {},
    only: 'docs/business-plans/*.md',
  };
  await translateSite(args);
  assert.equal(calls, 2);
  await rm(join(root, 'formal-ai/.site-ru/docs'), { recursive: true });
  const cached = await translateSite(args);
  assert.equal(calls, 2);
  assert.ok(cached.documents.every((d) => d.cached));
  assert.match(
    await readFile(
      join(root, 'formal-ai/.site-ru/docs/business-plans/example.md'),
      'utf8'
    ),
    /предложение/
  );
  await put('docs/business-plans/example.md', 'Changed source sentence.');
  await translateSite(args);
  assert.equal(calls, 3);
  const oldHash = await translatorHash(join(root, 'formal-ai/src'));
  await put('formal-ai/src/version.mjs', 'new version');
  assert.notEqual(await translatorHash(join(root, 'formal-ai/src')), oldHash);
  const failed = await translateSite({
    ...args,
    translate: (texts) => {
      if (texts[0].startsWith('#')) {
        throw new Error('bad document');
      }
      return translate(texts);
    },
  });
  assert.equal(failed.failed, 1);
  assert.equal(failed.documents.length, 2);
  await translateSite({ ...args, only: 'strategies.json*' });
  const json = JSON.parse(
    await readFile(join(root, 'formal-ai/.site-ru/strategies.json'), 'utf8')
  );
  assert.equal(json.strategies[0].summary, 'A предложение.');
  assert.equal(json.strategies[0].name, 'Example Name');
  json.strategies[0] = {
    id: 'example',
    name: 'Changed Name',
    summary: 'A changed source sentence.',
  };
  await put('website/strategies.json', JSON.stringify(json));
  await translateSite(args);
  const refreshed = JSON.parse(
    await readFile(join(root, 'formal-ai/.site-ru/strategies.json'), 'utf8')
  );
  assert.deepEqual(refreshed.strategies[0], json.strategies[0]);
});

test('Russian build renders a tiny mirror with correct links, code and app identifiers', async (t) => {
  const { root, put } = await fixture(t);
  const here = new URL('../../', import.meta.url);
  for (const path of [
    'formal-ai/ui-ru.json',
    'website/index.html',
    'website/app.js',
    'website/styles.css',
    'scripts/build-website.mjs',
    'scripts/site-russian.mjs',
  ]) {
    await put(path, await readFile(new URL(path, here), 'utf8'));
  }
  const md =
    '# План\n\n[Источник](https://example.com/a?b=1) и `keepCode()`.\n\n[External](https://example.com/reference.md)\n\n```js\nconst x = "$& $$ original";\nconst path = "file.md)";\n```\n';
  await put('formal-ai/.site-ru/docs/business-plans/example.md', md);
  await put(
    'formal-ai/.site-ru/docs/business-plans/README.md',
    '# Рейтинг\n\n[План](example.md)'
  );
  await put(
    'formal-ai/.site-ru/docs/legal/reference-countries.md',
    '# Страны\n\n[Рейтинг](../business-plans/README.md)'
  );
  const mirrorCatalog = JSON.parse(
    await readFile(join(root, 'website/strategies.json'), 'utf8')
  );
  mirrorCatalog.strategies[0].name = 'Automation';
  mirrorCatalog.strategies[0].summary = 'Русское описание.';
  await put(
    'formal-ai/.site-ru/strategies.json',
    JSON.stringify(mirrorCatalog)
  );
  await rm(join(root, 'website/strategies.json'));
  await symlink(
    fileURLToPath(new URL('../../node_modules/', import.meta.url)),
    join(root, 'node_modules'),
    'dir'
  );
  await promisify(execFile)(
    process.execPath,
    [join(root, 'scripts/build-website.mjs'), '--lang=ru'],
    { timeout: 10000, env: { ...process.env, SITE_LANG: 'en' } }
  );
  const plan = await readFile(
    join(root, 'website/ru/plans/example.html'),
    'utf8'
  );
  assert.match(plan, /<html lang="ru">/);
  assert.match(plan, /<title>Automation — Money Machine<\/title>/);
  assert.match(plan, /name="description" content="Русское описание\."/);
  assert.match(plan, /<h1>План<\/h1>/);
  assert.match(plan, /href="https:\/\/example.com\/a\?b=1"/);
  assert.match(plan, /<code>keepCode\(\)<\/code>/);
  assert.match(plan, /const x = &quot;\$&amp; \$\$ original&quot;;/);
  assert.match(plan, /const path = &quot;file\.md\)&quot;;/);
  assert.match(plan, /href="https:\/\/example.com\/reference\.md"/);
  assert.match(plan, /href="\.\.\/\.\.\/plans\/example.html" lang="en"/);
  assert.match(plan, /href="\.\.\/styles.css"/);
  const legal = await readFile(
    join(root, 'website/ru/docs/legal/reference-countries.html'),
    'utf8'
  );
  assert.match(legal, /href="\.\.\/\.\.\/plans\/index.html"/);
  const index = await readFile(join(root, 'website/ru/index.html'), 'utf8');
  assert.match(index, /href="\.\/\.\.\/index.html" lang="en"/);
  assert.match(index, /href="\.\/strategies.json"/);
  assert.match(index, /Все категории/);
  const app = await readFile(join(root, 'website/ru/app.js'), 'utf8');
  new Script(app);
  assert.match(app, /data\.strategies/);
  assert.match(app, /const days =/);
  assert.match(app, /fetch\('\.\/strategies.json'\)/);
  assert.match(app, /Как это работает/);
  assert.match(app, /Что нужно для запуска/);
  const ui = JSON.parse(
    await readFile(join(root, 'formal-ai/ui-ru.json'), 'utf8')
  );
  assert.equal(
    localizeApp("const hours = data.strategies; const s = 'hours';", ui),
    "const hours = data.strategies; const s = 'ч';"
  );
  await promisify(execFile)(
    process.execPath,
    [join(root, 'scripts/build-website.mjs')],
    { timeout: 10000, env: { ...process.env, SITE_LANG: 'ru' } }
  );
  assert.equal(
    await readFile(join(root, 'website/ru/plans/example.html'), 'utf8'),
    plan
  );
  // A JSON-only trial can render the catalog before any markdown exists.
  await rm(join(root, 'formal-ai/.site-ru/docs'), { recursive: true });
  await promisify(execFile)(
    process.execPath,
    [join(root, 'scripts/build-website.mjs'), '--lang=ru'],
    { timeout: 10000 }
  );
  assert.equal(
    await readFile(join(root, 'website/ru/index.html'), 'utf8'),
    index
  );
  const partial = JSON.parse(
    await readFile(join(root, 'website/ru/build-report.json'), 'utf8')
  );
  assert.equal(partial.pages, 0);
  assert.equal(partial.partial, true);
  assert.ok(partial.missingPlans.includes('example'));
});

test('English layout differs only by language switch', () => {
  const html = layout({
    title: 'Title',
    body: '<h1>Body</h1>',
    root: '../',
    path: 'plans/a.html',
  });
  assert.match(html, /<html lang="en">/);
  assert.ok(html.includes(languageSwitch('en', '../', 'plans/a.html')));
  assert.match(html, /<h1>Body<\/h1>/);
});

test('site reports bracket leftovers even when translator flags a sentence complete', async (t) => {
  const { root } = await fixture(t);
  const report = await translateSite({
    root,
    only: 'docs/business-plans/example.md',
    log: () => {},
    translate: (texts) =>
      texts.map(() => ({
        text: 'Текст [leftover].',
        sentences: [
          { source: 'Source.', text: 'Текст [leftover].', complete: true },
        ],
      })),
  });
  assert.equal(report.sentences, 1);
  assert.equal(report.complete, 0);
  assert.equal(report.completion, 0);
  assert.equal(report.documents[0].incomplete[0].source, 'Source.');
});
