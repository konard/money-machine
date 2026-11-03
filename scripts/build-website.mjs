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

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { marked } from 'marked';

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
export function layout({ title, body, root, description }) {
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
    .map(([href, label]) => `<a href="${root}${href}">${label}</a>`)
    .join('');
  return `<!doctype html>
<html lang="en">
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
        <nav class="nav">${nav}<a href="${REPO}">GitHub</a></nav>
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
const LINK_RULES = {
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
}) {
  const site = join(root, 'website');
  const plans = join(site, 'plans');
  const docs = join(site, 'docs');
  await rm(plans, { recursive: true, force: true });
  await rm(docs, { recursive: true, force: true });
  await mkdir(plans, { recursive: true });
  await mkdir(join(docs, 'legal'), { recursive: true });

  const page = (title, md, rules, rel, description) =>
    layout({
      title,
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
      `${strategies.length} legal ways to get paid online, ranked by priority score.`
    )
  );

  for (const s of strategies) {
    const md = renderStrategy(s);
    await writeFile(
      join(plans, `${s.id}.html`),
      page(s.name, md, LINK_RULES.strategy, '../', s.summary)
    );
  }

  const docSources = [
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
  if (hasIncorporation) {
    docSources.push([
      'docs/legal/incorporation-costs.md',
      'legal/incorporation-costs.html',
      'Incorporation costs',
      'legal',
      '../../',
    ]);
  }
  docSources.push([
    'docs/legal/remote-incorporation-options.md',
    'legal/remote-incorporation-options.html',
    'Remote incorporation options',
    'legal',
    '../../',
  ]);
  for (const [src, out, title, ruleKey, rel] of docSources) {
    const md = await readFile(join(root, src), 'utf-8');
    await writeFile(
      join(docs, out),
      page(title, md, LINK_RULES[ruleKey], rel, title)
    );
  }
}
