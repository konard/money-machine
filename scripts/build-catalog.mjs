#!/usr/bin/env node

/**
 * Build the strategy catalog.
 *
 * Reads every `data/strategies/*.json` file (one array per category),
 * validates each strategy, applies the legality gate, computes a priority
 * score, and writes:
 *
 *   data/strategies.json            merged + ranked catalog (source for tests)
 *   website/strategies.json         copy consumed by the static website
 *   docs/business-plans/README.md   ranked index of all business plans
 *   docs/business-plans/<id>.md     one page per strategy
 *
 * Usage: node scripts/build-catalog.mjs
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { buildWebsite } from './build-website.mjs';
import {
  renderBusinessPlan,
  renderIncorporation,
  validateBusinessPlan,
} from './render-business-plan.mjs';

const ROOT = process.cwd();
const INPUT_DIR = join(ROOT, 'data', 'strategies');
const MERGED_PATH = join(ROOT, 'data', 'strategies.json');
const WEBSITE_DATA_PATH = join(ROOT, 'website', 'strategies.json');
const PLANS_DIR = join(ROOT, 'docs', 'business-plans');
const INCORPORATION_DIR = join(ROOT, 'data', 'incorporation');
const INCORPORATION_MD = join(ROOT, 'docs', 'legal', 'incorporation-costs.md');

/** Minimum share of reference countries where a strategy must be legal. */
export const LEGAL_COVERAGE_THRESHOLD = 80;

/** Weights used to compute the priority score (must sum to 1). */
export const WEIGHTS = {
  paymentProbability: 0.25,
  profitLikelihood: 0.1, // businessPlan.marketConditions.profitLikelihoodPercent / 10
  automation: 0.25,
  ongoingEffort: 0.15, // inverted: lower effort scores higher
  setupEffort: 0.1, // inverted
  incomePotential: 0.05,
  platformAvailability: 0.1, // percent / 10
};

/** Points subtracted when the strategy needs a physical asset or presence. */
export const PHYSICAL_PENALTY = 5;

/**
 * Points subtracted for required capital. The project is zero-capital first:
 * interest on savings is reliable but it is a return on money you already
 * have, not a way to earn from nothing.
 */
export const CAPITAL_PENALTIES = [
  { minUsd: 500, points: 20 },
  { minUsd: 100, points: 8 },
];

/**
 * @param {number} capitalUsd
 * @returns {number}
 */
export function capitalPenalty(capitalUsd) {
  for (const tier of CAPITAL_PENALTIES) {
    if (capitalUsd >= tier.minUsd) {
      return tier.points;
    }
  }
  return 0;
}

const REQUIRED_FIELDS = [
  'id',
  'name',
  'category',
  'summary',
  'howItWorks',
  'platforms',
  'payout',
  'capitalRequiredUsd',
  'timeToFirstDollarDays',
  'typicalMonthlyIncomeUsd',
  'scores',
  'legality',
  'automationPlan',
  'manualSteps',
  'fullCycle',
  'risks',
  'evidence',
  'sources',
];

const REQUIRED_SCORES = [
  'paymentProbability',
  'automation',
  'setupEffort',
  'ongoingEffort',
  'incomePotential',
  'aiLeverage',
  'legalCoveragePercent',
  'platformAvailabilityPercent',
];

const CATEGORY_LABELS = {
  software: 'Software & developer monetization',
  content: 'Content & media',
  'digital-products': 'Digital products',
  marketplaces: 'Marketplaces & e-commerce',
  affiliate: 'Affiliate & performance marketing',
  services: 'Services & freelancing',
  'micro-tasks': 'Micro-tasks & paid research',
  data: 'Data & security work',
  finance: 'Finance & capital-light arbitrage',
  community: 'Community & memberships',
  education: 'Education & tutoring',
  'ai-native': 'AI-native income',
  licensing: 'Licensing, royalties & rentals',
  other: 'Other',
};

/**
 * Compute the 0-100 priority score for a strategy.
 * Higher = more likely to get paid and to turn a real profit, more
 * automatable, less effort.
 * @param {object} s - scores object
 * @param {boolean} [physical]
 * @param {number} [capitalUsd]
 * @param {number|null} [profitLikelihoodPercent] - 0–100 from the business plan
 * @returns {number}
 */
export function computePriorityScore(
  s,
  physical = false,
  capitalUsd = 0,
  profitLikelihoodPercent = null
) {
  // When no business plan exists yet, use payment probability as the proxy.
  const profit =
    typeof profitLikelihoodPercent === 'number'
      ? profitLikelihoodPercent / 10
      : s.paymentProbability;
  const value =
    WEIGHTS.paymentProbability * s.paymentProbability +
    WEIGHTS.profitLikelihood * profit +
    WEIGHTS.automation * s.automation +
    WEIGHTS.ongoingEffort * (11 - s.ongoingEffort) +
    WEIGHTS.setupEffort * (11 - s.setupEffort) +
    WEIGHTS.incomePotential * s.incomePotential +
    WEIGHTS.platformAvailability * (s.platformAvailabilityPercent / 10);
  const score =
    Math.round(value * 10) -
    (physical ? PHYSICAL_PENALTY : 0) -
    capitalPenalty(capitalUsd);
  return Math.max(0, Math.min(100, score));
}

/**
 * True when the strategy needs a physical asset or presence (car, room,
 * shipping done by you). Marked via the `physical` or `physical-step` tag or "(PHYSICAL)" in
 * the name. A physical step done by a third party (print-on-demand
 * fulfilment) does not count.
 * @param {object} s
 * @returns {boolean}
 */
export function isPhysical(s) {
  return (
    /\bPHYSICAL\b/i.test(s.name || '') ||
    (Array.isArray(s.tags) &&
      s.tags.some((t) => t === 'physical' || t === 'physical-step'))
  );
}

/** Tier S additionally requires this profit likelihood (percent). */
export const TIER_S_MIN_PROFIT_LIKELIHOOD = 25;

export function tierFor(score, profitLikelihoodPercent = null) {
  if (
    score >= 70 &&
    (profitLikelihoodPercent === null ||
      profitLikelihoodPercent >= TIER_S_MIN_PROFIT_LIKELIHOOD)
  ) {
    return 'S';
  }
  if (score >= 60) {
    return 'A';
  }
  if (score >= 50) {
    return 'B';
  }
  return 'C';
}

/**
 * Curated shortlists computed from the ranked catalog. Each returns ids.
 * @param {object[]} list - accepted strategies, already ranked
 * @returns {Array<{key: string, title: string, blurb: string, ids: string[]}>}
 */
export function buildShortlists(list) {
  const top = (pred, n = 10) =>
    list
      .filter(pred)
      .slice(0, n)
      .map((s) => s.id);
  return [
    {
      key: 'anyone-anywhere',
      title: 'Anyone, anywhere, $0',
      blurb:
        'Zero capital, pays out in at least 80% of reference countries, payment probability 5+ and no physical step.',
      ids: top(
        (s) =>
          s.capitalRequiredUsd === 0 &&
          s.scores.platformAvailabilityPercent >= 80 &&
          s.scores.paymentProbability >= 5 &&
          !s.physical
      ),
    },
    {
      key: 'most-likely-to-profit',
      title: 'Most likely to actually profit',
      blurb:
        'Highest estimated chance of a real net profit within 12 months, with a median month-12 net profit of at least $10.',
      ids: list
        .filter(
          (s) =>
            typeof s.profitLikelihoodPercent === 'number' &&
            (s.businessPlan?.marketConditions?.typicalNetProfitMonth12Usd
              ?.median ?? 0) >= 10
        )
        .sort(
          (a, b) =>
            b.profitLikelihoodPercent - a.profitLikelihoodPercent ||
            (b.businessPlan.marketConditions.typicalNetProfitMonth12Usd
              .median ?? 0) -
              (a.businessPlan.marketConditions.typicalNetProfitMonth12Usd
                .median ?? 0) ||
            a.rank - b.rank
        )
        .slice(0, 10)
        .map((s) => s.id),
    },
    {
      key: 'most-passive',
      title: 'Most passive after setup',
      blurb: 'Automation 8+ and ongoing effort 2 or less.',
      ids: top((s) => s.scores.automation >= 8 && s.scores.ongoingEffort <= 2),
    },
    {
      key: 'fastest-cash',
      title: 'Fastest first dollar',
      blurb: 'First payout possible within a week and payment probability 6+.',
      ids: top(
        (s) =>
          s.timeToFirstDollarDays.min <= 7 && s.scores.paymentProbability >= 6
      ),
    },
    {
      key: 'highest-upside',
      title: 'Highest upside',
      blurb: 'Income potential 8+ for a solo operator after a year.',
      ids: top((s) => s.scores.incomePotential >= 8),
    },
    {
      key: 'ai-agent-ready',
      title: 'Best for AI agents',
      blurb: 'AI leverage 8+ and automation 7+.',
      ids: top((s) => s.scores.aiLeverage >= 8 && s.scores.automation >= 7),
    },
  ];
}

/**
 * Validate a raw strategy object; returns a list of problems (empty = ok).
 * @param {object} s
 * @returns {string[]}
 */
export function validateStrategy(s) {
  const problems = [];
  for (const f of REQUIRED_FIELDS) {
    if (s[f] === undefined || s[f] === null) {
      problems.push(`missing ${f}`);
    }
  }
  if (s.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) {
    problems.push(`id "${s.id}" must be kebab-case`);
  }
  if (s.scores) {
    for (const k of REQUIRED_SCORES) {
      const v = s.scores[k];
      if (typeof v !== 'number') {
        problems.push(`scores.${k} must be a number`);
      } else if (k.endsWith('Percent') ? v < 0 || v > 100 : v < 1 || v > 10) {
        problems.push(`scores.${k} out of range: ${v}`);
      }
    }
  }
  if (s.category && !CATEGORY_LABELS[s.category]) {
    problems.push(`unknown category "${s.category}"`);
  }
  if (Array.isArray(s.sources) && s.sources.length === 0) {
    problems.push('at least one source is required');
  }
  if (s.businessPlan !== undefined) {
    for (const bpProblem of validateBusinessPlan(s.businessPlan)) {
      problems.push(`businessPlan: ${bpProblem}`);
    }
  }
  return problems;
}

/**
 * Load every category file and return raw strategies with provenance.
 * @returns {Promise<object[]>}
 */
/**
 * Load data/incorporation/*.json (may be empty).
 * @returns {Promise<object[]>}
 */
async function loadIncorporation() {
  let files = [];
  try {
    files = (await readdir(INCORPORATION_DIR)).filter((f) =>
      f.endsWith('.json')
    );
  } catch {
    return [];
  }
  const all = [];
  for (const file of files.sort()) {
    const json = JSON.parse(
      await readFile(join(INCORPORATION_DIR, file), 'utf-8')
    );
    all.push(...json);
  }
  return all;
}

async function loadRaw() {
  const files = (await readdir(INPUT_DIR)).filter((f) => f.endsWith('.json'));
  const all = [];
  for (const file of files.sort()) {
    const json = JSON.parse(await readFile(join(INPUT_DIR, file), 'utf-8'));
    if (!Array.isArray(json)) {
      throw new Error(`${file} must be a JSON array`);
    }
    for (const s of json) {
      all.push({ ...s, sourceFile: file });
    }
  }
  return all;
}

/**
 * Merge, validate, gate and rank the strategies.
 * @param {object[]} raw
 * @returns {{ accepted: object[], rejected: object[] }}
 */
export function buildCatalog(raw) {
  const seen = new Set();
  const accepted = [];
  const rejected = [];

  for (const s of raw) {
    const problems = validateStrategy(s);
    if (seen.has(s.id)) {
      problems.push(`duplicate id "${s.id}"`);
    }
    if (problems.length) {
      rejected.push({ id: s.id, sourceFile: s.sourceFile, problems });
      continue;
    }
    seen.add(s.id);
    const legal = s.scores.legalCoveragePercent >= LEGAL_COVERAGE_THRESHOLD;
    if (!legal) {
      rejected.push({
        id: s.id,
        sourceFile: s.sourceFile,
        problems: [
          `legal coverage ${s.scores.legalCoveragePercent}% < ${LEGAL_COVERAGE_THRESHOLD}%`,
        ],
      });
      continue;
    }
    const physical = isPhysical(s);
    const priorityScore = computePriorityScore(
      s.scores,
      physical,
      s.capitalRequiredUsd,
      s.businessPlan?.marketConditions?.profitLikelihoodPercent ?? null
    );
    accepted.push({
      ...s,
      physical,
      needsVerification:
        Array.isArray(s.tags) && s.tags.includes('needs-verification'),
      startupCashUsd: s.businessPlan?.startupResources?.cashUsd ?? null,
      recurringMonthlyUsd:
        s.businessPlan?.startupResources?.recurringMonthlyUsd ?? null,
      profitLikelihoodPercent:
        s.businessPlan?.marketConditions?.profitLikelihoodPercent ?? null,
      monthsToBreakEven:
        s.businessPlan?.breakEven?.typicalMonthsToBreakEven ?? null,
      priorityScore,
      tier: tierFor(
        priorityScore,
        s.businessPlan?.marketConditions?.profitLikelihoodPercent ?? null
      ),
      categoryLabel: CATEGORY_LABELS[s.category],
    });
  }

  accepted.sort(
    (a, b) =>
      b.priorityScore - a.priorityScore ||
      b.scores.paymentProbability - a.scores.paymentProbability ||
      a.name.localeCompare(b.name)
  );
  accepted.forEach((s, i) => (s.rank = i + 1));
  return { accepted, rejected };
}

const money = (n) =>
  n === null || n === undefined
    ? 'n/a'
    : `$${Number(n).toLocaleString('en-US')}`;
const days = (r) => (r.min === r.max ? `${r.min} d` : `${r.min}–${r.max} d`);

/**
 * Render the ranked index markdown.
 * @param {object[]} list
 * @returns {string}
 */
function renderIndex(list) {
  const lines = [];
  lines.push('# Business plans catalog');
  lines.push('');
  lines.push(
    `${list.length} legal, mostly-online ways to get paid, ranked by **priority score** ` +
      '(0–100). The score rewards a high chance of actually receiving money, high ' +
      'automation after setup, and low effort. Every entry is legal in at least ' +
      `${LEGAL_COVERAGE_THRESHOLD}% of the [reference countries](../legal/reference-countries.md). ` +
      'See [methodology](../methodology.md) for the formula.'
  );
  lines.push('');
  lines.push(
    '> This file is generated by `npm run build:catalog` from `data/strategies/*.json`. ' +
      'Edit the JSON, not this file.'
  );
  lines.push('');
  lines.push(
    `Entries marked ⚠ have at least one payout figure that could not be confirmed on an official page (${list.filter((s) => s.needsVerification).length} of ${list.length}); see the entry's notes.`
  );
  lines.push('');
  lines.push('## Tiers');
  lines.push('');
  lines.push(
    '- **S (70+)** — start here: proven payouts, high automation, low effort.'
  );
  lines.push('- **A (60–69)** — strong second wave.');
  lines.push('- **B (50–59)** — viable, needs more effort or has lower odds.');
  lines.push(
    '- **C (<50)** — long shots or labor-heavy; included for completeness.'
  );
  lines.push('');
  lines.push('## Start here');
  lines.push('');
  const byId = new Map(list.map((s) => [s.id, s]));
  for (const sl of buildShortlists(list)) {
    lines.push(`### ${sl.title}`);
    lines.push('');
    lines.push(`_${sl.blurb}_`);
    lines.push('');
    for (const id of sl.ids) {
      const s = byId.get(id);
      lines.push(
        `- **#${s.rank}** [${s.name}](./${s.id}.md) — median ${money(s.typicalMonthlyIncomeUsd.median)}/mo, pay prob. ${s.scores.paymentProbability}/10, profit odds ${s.profitLikelihoodPercent === null ? 'n/a' : `${s.profitLikelihoodPercent}%`}`
      );
    }
    lines.push('');
  }
  lines.push('## Ranked by chance of real profit');
  lines.push('');
  lines.push(
    '_Top 30 by the estimated share of diligent average starters who reach a real net profit within 12 months (at least $100/month where the plan can pay that much, any net-positive payout for small-but-certain plans). Ties broken by median net profit at month 12. These odds already feed the priority score above with weight 0.10._'
  );
  lines.push('');
  lines.push(
    '| Profit odds | Median net profit, month 12 | Start cash | Fixed cost/mo | Strategy | Priority rank |'
  );
  lines.push('| --- | --- | --- | --- | --- | --- |');
  const byProfit = list
    .filter((s) => typeof s.profitLikelihoodPercent === 'number')
    .sort(
      (a, b) =>
        b.profitLikelihoodPercent - a.profitLikelihoodPercent ||
        b.businessPlan.marketConditions.typicalNetProfitMonth12Usd.median -
          a.businessPlan.marketConditions.typicalNetProfitMonth12Usd.median ||
        a.rank - b.rank
    )
    .slice(0, 30);
  for (const s of byProfit) {
    lines.push(
      `| ${s.profitLikelihoodPercent}% | ${money(s.businessPlan.marketConditions.typicalNetProfitMonth12Usd.median)} | ${money(s.startupCashUsd)} | ${money(s.recurringMonthlyUsd)} | [${s.name}](./${s.id}.md) | #${s.rank} |`
    );
  }
  lines.push('');
  lines.push('## Ranked list');
  lines.push('');
  lines.push(
    '| # | Tier | Score | Strategy | Category | Pay prob. | Profit odds (12 mo) | Automation | Effort (setup/ongoing) | Start cash | Median income | Legal | Pays out | First $ |'
  );
  lines.push(
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  );
  for (const s of list) {
    const sc = s.scores;
    lines.push(
      `| ${s.rank} | ${s.tier} | ${s.priorityScore} | [${s.name}](./${s.id}.md)${s.needsVerification ? ' ⚠' : ''} | ${s.categoryLabel} | ` +
        `${sc.paymentProbability}/10 | ${s.profitLikelihoodPercent === null ? 'n/a' : `${s.profitLikelihoodPercent}%`} | ${sc.automation}/10 | ${sc.setupEffort}/${sc.ongoingEffort} | ` +
        `${money(s.startupCashUsd)} | ${money(s.typicalMonthlyIncomeUsd.median)} | ${sc.legalCoveragePercent}% | ${sc.platformAvailabilityPercent}% | ${days(s.timeToFirstDollarDays)} |`
    );
  }
  lines.push('');
  lines.push('## By category');
  lines.push('');
  const byCat = new Map();
  for (const s of list) {
    if (!byCat.has(s.category)) {
      byCat.set(s.category, []);
    }
    byCat.get(s.category).push(s);
  }
  for (const [cat, items] of [...byCat.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    lines.push(`### ${CATEGORY_LABELS[cat]} (${items.length})`);
    lines.push('');
    for (const s of items) {
      lines.push(
        `- **#${s.rank}** [${s.name}](./${s.id}.md) — ${s.summary} _(score ${s.priorityScore}, tier ${s.tier})_`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Render one strategy page.
 * @param {object} s
 * @returns {string}
 */
function renderStrategy(s) {
  const sc = s.scores;
  const li = (arr) =>
    arr && arr.length ? arr.map((x) => `- ${x}`).join('\n') : '- none listed';
  const inc = s.typicalMonthlyIncomeUsd;
  const lines = [];
  lines.push(`# ${s.name}`);
  lines.push('');
  lines.push(
    `**Rank #${s.rank} · Tier ${s.tier} · Priority score ${s.priorityScore}/100 · Category: ${s.categoryLabel}**`
  );
  lines.push('');
  lines.push(s.summary);
  lines.push('');
  lines.push('## Scores');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | --- |');
  lines.push(
    `| Payment probability (6 months) | ${sc.paymentProbability}/10 |`
  );
  lines.push(`| Automation after setup | ${sc.automation}/10 |`);
  lines.push(`| Setup effort (1 = trivial) | ${sc.setupEffort}/10 |`);
  lines.push(`| Ongoing effort (1 = none) | ${sc.ongoingEffort}/10 |`);
  lines.push(`| Income potential | ${sc.incomePotential}/10 |`);
  lines.push(`| AI leverage | ${sc.aiLeverage}/10 |`);
  lines.push(`| Legal in reference countries | ${sc.legalCoveragePercent}% |`);
  lines.push(
    `| Platform pays out in reference countries | ${sc.platformAvailabilityPercent}% |`
  );
  lines.push(
    `| Capital required | ${money(s.capitalRequiredUsd)}${capitalPenalty(s.capitalRequiredUsd) ? ` (−${capitalPenalty(s.capitalRequiredUsd)} points)` : ''} |`
  );
  lines.push(`| Time to first dollar | ${days(s.timeToFirstDollarDays)} |`);
  lines.push(
    `| Typical monthly income (low / median / high) | ${money(inc.low)} / ${money(inc.median)} / ${money(inc.high)} |`
  );
  lines.push('');
  if (s.needsVerification) {
    lines.push(
      '> ⚠ **Some figures unverified.** At least one payout rule, fee or rate in this entry could not be confirmed on an official page at the time of writing. Check the notes and sources before relying on it.'
    );
    lines.push('');
  }
  lines.push('## Realistic expectations');
  lines.push('');
  lines.push(
    `Most people who try this earn around **${money(inc.low)}–${money(inc.median)} per month** in the first year; ` +
      `the high figure of ${money(inc.high)} is a ceiling for a focused solo operator, not a typical outcome. ` +
      `The chance of receiving at least one real payout within six months is rated **${sc.paymentProbability}/10**. ` +
      `Expect the first payment after ${days(s.timeToFirstDollarDays)}.`
  );
  lines.push('');
  lines.push('## How it works');
  lines.push('');
  lines.push(s.howItWorks);
  lines.push('');
  lines.push(`**Platforms:** ${s.platforms.join(', ')}`);
  lines.push('');
  lines.push(renderBusinessPlan(s.businessPlan));
  lines.push('## Payout path');
  lines.push('');
  lines.push(`- **Methods:** ${(s.payout.methods || []).join(', ')}`);
  lines.push(`- **Minimum payout:** ${s.payout.minimumPayout ?? 'n/a'}`);
  lines.push(`- **Frequency:** ${s.payout.frequency ?? 'n/a'}`);
  lines.push(`- **Typical delay:** ${s.payout.typicalDelayDays ?? 'n/a'} days`);
  if (s.payout.notes) {
    lines.push(`- **Notes:** ${s.payout.notes}`);
  }
  lines.push('');
  lines.push('## Full cycle (setup → earn → bank account)');
  lines.push('');
  lines.push(s.fullCycle.map((step, i) => `${i + 1}. ${step}`).join('\n'));
  lines.push('');
  lines.push('## What can be automated');
  lines.push('');
  lines.push(li(s.automationPlan));
  lines.push('');
  lines.push('## Unavoidable manual steps');
  lines.push('');
  lines.push(li(s.manualSteps));
  lines.push('');
  lines.push('## Legality & compliance');
  lines.push('');
  lines.push(s.legality.notes || 'No special notes.');
  lines.push('');
  if (s.legality.restrictedIn && s.legality.restrictedIn.length) {
    lines.push(
      `- **Restricted or banned in:** ${s.legality.restrictedIn.join(', ')}`
    );
  }
  lines.push(
    `- **Compliance requirements:** ${(s.legality.complianceRequirements || []).join('; ') || 'none listed'}`
  );
  if (s.availability && s.availability.notes) {
    lines.push(`- **Platform availability:** ${s.availability.notes}`);
  }
  lines.push('');
  lines.push('## Risks');
  lines.push('');
  lines.push(li(s.risks));
  lines.push('');
  lines.push('## Evidence that people get paid');
  lines.push('');
  lines.push(s.evidence);
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push(s.sources.map((u) => `- <${u}>`).join('\n'));
  lines.push('');
  if (s.tags && s.tags.length) {
    lines.push(`_Tags: ${s.tags.join(', ')}_`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push(
    `_Generated from \`data/strategies/${
      s.sourceFile
    }\` by \`npm run build:catalog\`. Edit the JSON, not this file._`
  );
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const raw = await loadRaw();
  const { accepted, rejected } = buildCatalog(raw);

  await mkdir(join(ROOT, 'data'), { recursive: true });
  await mkdir(join(ROOT, 'website'), { recursive: true });
  await rm(PLANS_DIR, { recursive: true, force: true });
  await mkdir(PLANS_DIR, { recursive: true });

  const output = {
    legalCoverageThreshold: LEGAL_COVERAGE_THRESHOLD,
    weights: WEIGHTS,
    count: accepted.length,
    shortlists: buildShortlists(accepted),
    strategies: accepted,
  };
  const json = `${JSON.stringify(output, null, 2)}\n`;
  await writeFile(MERGED_PATH, json);
  await writeFile(WEBSITE_DATA_PATH, json);
  await writeFile(join(PLANS_DIR, 'README.md'), `${renderIndex(accepted)}\n`);
  for (const s of accepted) {
    await writeFile(join(PLANS_DIR, `${s.id}.md`), renderStrategy(s));
  }
  const incorporation = await loadIncorporation();
  if (incorporation.length) {
    await writeFile(
      INCORPORATION_MD,
      `${renderIncorporation(incorporation)}\n`
    );
  }
  await buildWebsite({
    root: ROOT,
    strategies: accepted,
    indexMarkdown: renderIndex(accepted),
    renderStrategy,
    hasIncorporation: incorporation.length > 0,
  });

  console.log(
    `Accepted ${accepted.length} strategies, rejected ${rejected.length}.`
  );
  for (const r of rejected) {
    console.log(`  ✗ ${r.sourceFile}:${r.id} — ${r.problems.join('; ')}`);
  }
  const tiers = accepted.reduce(
    (m, s) => ((m[s.tier] = (m[s.tier] || 0) + 1), m),
    {}
  );
  console.log('Tiers:', JSON.stringify(tiers));
  const withPlans = accepted.filter((s) => s.businessPlan).length;
  console.log(
    `Business plans: ${withPlans}/${accepted.length}; incorporation countries: ${incorporation.length}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
