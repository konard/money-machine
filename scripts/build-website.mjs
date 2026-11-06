/**
 * Generate the static GitHub Pages site from the catalog.
 *
 * Called by build-catalog.mjs. Produces:
 *   website/plans/index.html        ranked list (rendered from the markdown index)
 *   website/plans/<id>.html         one page per strategy
 *   website/docs/methodology.html   rendered docs/methodology.md
 *   website/docs/roadmap.html       rendered docs/plans/roadmap.md
 *   website/docs/legal/*.html       rendered docs/legal/*.md
 *   website/docs/platform-rules.html rendered docs/research/platform-rules.md
 *
 * The handwritten website/index.html, app.js and styles.css are left alone.
 */

import { readFile, writeFile, mkdir, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { marked } from 'marked';
import { fileURLToPath } from 'node:url';
import {
  buildRussianWebsite,
  languageSwitch,
  localizeUI,
} from './site-russian.mjs';

const REPO = 'https://github.com/konard/money-machine';

/**
 * Escape text for HTML.
 * @param {string} s
 * @returns {string}
 */
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Wrap rendered body HTML in the shared site layout.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body - inner HTML
 * @param {string} opts.root - relative path to the website root ('./', '../', '../../')
 * @param {string} [opts.description]
 * @returns {string}
 */
export function layout({
  title,
  body,
  root,
  description,
  lang = 'en',
  path = 'index.html',
  ui = {},
}) {
  const nav = [
    ['index.html', 'Catalog'],
    ['plans/index.html', 'Ranked list'],
    ['docs/methodology.html', 'Methodology'],
    ['docs/legal/reference-countries.html', 'Reference countries'],
    ['docs/legal/excluded-activities.html', 'Excluded'],
    ['docs/legal/incorporation-costs.html', 'Incorporation costs'],
    ['docs/platform-rules.html', 'Platform rules'],
    ['docs/roadmap.html', 'Roadmap'],
  ]
    .map(
      ([href, label]) => `<a href="${root}${href}">${ui[label] || label}</a>`
    )
    .join('');
  const html = `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)} — Money Machine</title>
    <meta name="description" content="${esc(description || title)}" />
    <link rel="stylesheet" href="${root}styles.css" />
  </head>
  <body class="doc-page">
    <header class="topbar">
      <div class="wrap">
        <a class="brand" href="${root}index.html">Money Machine</a>
        <nav class="nav">${nav}<a href="${REPO}">GitHub</a>${languageSwitch(lang, root, path)}</nav>
      </div>
    </header>
    <main class="wrap doc">
${body}
    </main>
    <footer class="wrap foot">
      <p>
        Nothing here is financial, legal or tax advice. Income figures are rough
        ranges for a solo operator; most people earn at the low end. Generated
        from <a href="${REPO}/tree/main/data/strategies">data/strategies/*.json</a>
        by <code>npm run build:catalog</code>.
      </p>
    </footer>
  </body>
</html>
`;
  return lang === 'ru' ? localizeUI(html, ui) : html;
}

/**
 * Rewrite relative markdown links for a given target location.
 * @param {string} md
 * @param {Array<[RegExp|string, string]>} rules
 * @returns {string}
 */
function relink(md, rules) {
  let out = md;
  for (const [from, to] of rules) {
    out = out.split(from).join(to);
  }
  return out;
}

/** Link rewrite rules keyed by the source document. */
export const LINK_RULES = {
  index: [
    [
      '../legal/reference-countries.md',
      '../docs/legal/reference-countries.html',
    ],
    ['../methodology.md', '../docs/methodology.html'],
    ['.md)', '.html)'],
  ],
  strategy: [['.md)', '.html)']],
  methodology: [
    ['./business-plans/README.md', '../plans/index.html'],
    ['./legal/reference-countries.md', './legal/reference-countries.html'],
    ['./legal/excluded-activities.md', './legal/excluded-activities.html'],
    ['./legal/incorporation-costs.md', './legal/incorporation-costs.html'],
    [
      './legal/remote-incorporation-options.md',
      './legal/remote-incorporation-options.html',
    ],
  ],
  legal: [
    ['./reference-countries.md', './reference-countries.html'],
    ['./excluded-activities.md', './excluded-activities.html'],
    ['./incorporation-costs.md', './incorporation-costs.html'],
    [
      './remote-incorporation-options.md',
      './remote-incorporation-options.html',
    ],
    ['../business-plans/README.md', '../../plans/index.html'],
    ['../methodology.md', '../methodology.html'],
    ['../research/platform-rules.md', '../platform-rules.html'],
  ],
  roadmap: [
    ['../../REQUIREMENTS.md', `${REPO}/blob/main/REQUIREMENTS.md`],
    ['../business-plans/README.md', '../plans/index.html'],
    ['../methodology.md', './methodology.html'],
  ],
  platformRules: [],
};

export const DOC_SOURCES = [
  [
    'docs/methodology.md',
    'methodology.html',
    'Scoring methodology',
    'methodology',
    '../',
  ],
  ['docs/plans/roadmap.md', 'roadmap.html', 'Roadmap', 'roadmap', '../'],
  [
    'docs/research/platform-rules.md',
    'platform-rules.html',
    'Platform rules',
    'platformRules',
    '../',
  ],
  [
    'docs/legal/reference-countries.md',
    'legal/reference-countries.html',
    'Reference countries',
    'legal',
    '../../',
  ],
  [
    'docs/legal/excluded-activities.md',
    'legal/excluded-activities.html',
    'Excluded activities',
    'legal',
    '../../',
  ],
];

DOC_SOURCES.push(
  [
    'docs/legal/incorporation-costs.md',
    'legal/incorporation-costs.html',
    'Incorporation costs',
    'legal',
    '../../',
  ],
  [
    'docs/legal/remote-incorporation-options.md',
    'legal/remote-incorporation-options.html',
    'Remote incorporation options',
    'legal',
    '../../',
  ]
);

/**
 * Build every generated page.
 * @param {object} args
 * @param {string} args.root - repository root
 * @param {object[]} args.strategies - accepted strategies
 * @param {string} args.indexMarkdown - markdown of the ranked index
 * @param {(s: object) => string} args.renderStrategy - markdown renderer
 */
export async function buildWebsite({
  root,
  strategies,
  indexMarkdown,
  renderStrategy,
  hasIncorporation = false,
  lang = process.argv.find((arg) => arg.startsWith('--lang='))?.slice(7) ||
    process.env.SITE_LANG ||
    'en',
}) {
  if (lang === 'ru') {
    return buildRussianWebsite(root);
  }
  if (lang !== 'en') {
    throw new Error(`Unsupported site language: ${lang}`);
  }
  const site = join(root, 'website');
  const plans = join(site, 'plans');
  const docs = join(site, 'docs');
  await rm(plans, { recursive: true, force: true });
  await rm(docs, { recursive: true, force: true });
  await mkdir(plans, { recursive: true });
  await mkdir(join(docs, 'legal'), { recursive: true });

  const page = (title, md, rules, rel, description, path) =>
    layout({
      title,
      path,
      root: rel,
      description,
      body: marked.parse(relink(md, rules)),
    });

  await writeFile(
    join(plans, 'index.html'),
    page(
      'Ranked list of business plans',
      indexMarkdown,
      LINK_RULES.index,
      '../',
      `${strategies.length} legal ways to get paid online, ranked by priority score.`,
      'plans/index.html'
    )
  );

  for (const s of strategies) {
    const md = renderStrategy(s);
    await writeFile(
      join(plans, `${s.id}.html`),
      page(
        s.name,
        md,
        LINK_RULES.strategy,
        '../',
        s.summary,
        `plans/${s.id}.html`
      )
    );
  }

  const docSources = DOC_SOURCES.filter(
    ([src]) => hasIncorporation || src !== 'docs/legal/incorporation-costs.md'
  );
  for (const [src, out, title, ruleKey, rel] of docSources) {
    const md = await readFile(join(root, src), 'utf-8');
    await writeFile(
      join(docs, out),
      page(title, md, LINK_RULES[ruleKey], rel, title, `docs/${out}`)
    );
  }
}

if (
  process.argv[1] &&
  (await realpath(process.argv[1]).catch(() => null)) ===
    fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const lang =
    process.argv.find((arg) => arg.startsWith('--lang='))?.slice(7) ||
    process.env.SITE_LANG ||
    'en';
  if (lang === 'ru') {
    await buildWebsite({ root, lang });
  } else {
    const { strategies } = JSON.parse(
      await readFile(join(root, 'website/strategies.json'), 'utf8')
    );
    const markdown = new Map(
      await Promise.all(
        strategies.map(async (s) => [
          s.id,
          await readFile(join(root, `docs/business-plans/${s.id}.md`), 'utf8'),
        ])
      )
    );
    await buildWebsite({
      root,
      lang,
      strategies,
      hasIncorporation: await readFile(
        join(root, 'docs/legal/incorporation-costs.md')
      ).then(
        () => true,
        () => false
      ),
      indexMarkdown: await readFile(
        join(root, 'docs/business-plans/README.md'),
        'utf8'
      ),
      renderStrategy: (s) => markdown.get(s.id),
    });
  }
}
