/**
 * Tests for the business-plans catalog (data/strategies.json).
 *
 * These tests enforce the project's catalog requirements:
 * - at least 100 strategies
 * - every strategy legal in >= 80% of reference countries
 * - unique kebab-case ids, scores in range, at least one source each
 * - generated files are in sync with the per-category sources
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildCatalog,
  computePriorityScore,
  tierFor,
  validateStrategy,
  TIER_S_MIN_PROFIT_LIKELIHOOD,
  LEGAL_COVERAGE_THRESHOLD,
  WEIGHTS,
} from '../scripts/build-catalog.mjs';
import { validateBusinessPlan } from '../scripts/render-business-plan.mjs';

const ROOT = process.cwd();
const catalog = JSON.parse(
  await readFile(join(ROOT, 'data', 'strategies.json'), 'utf-8')
);
const { strategies } = catalog;

describe('Catalog', () => {
  it('contains at least 100 strategies', () => {
    assert.ok(
      strategies.length >= 100,
      `expected >= 100 strategies, got ${strategies.length}`
    );
    assert.strictEqual(catalog.count, strategies.length);
  });

  it('has unique kebab-case ids', () => {
    const ids = strategies.map((s) => s.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'duplicate ids');
    for (const id of ids) {
      assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id ${id}`);
    }
  });

  it('every strategy passes schema validation', () => {
    for (const s of strategies) {
      const problems = validateStrategy(s);
      assert.deepStrictEqual(problems, [], `${s.id}: ${problems.join('; ')}`);
    }
  });

  it('every strategy is legal in at least 80% of reference countries', () => {
    assert.strictEqual(LEGAL_COVERAGE_THRESHOLD, 80);
    for (const s of strategies) {
      assert.ok(
        s.scores.legalCoveragePercent >= 80,
        `${s.id} legal coverage ${s.scores.legalCoveragePercent}%`
      );
    }
  });

  it('every strategy cites at least one http(s) source', () => {
    for (const s of strategies) {
      assert.ok(s.sources.length >= 1, `${s.id} has no sources`);
      for (const u of s.sources) {
        assert.match(u, /^https?:\/\//, `${s.id} bad source ${u}`);
      }
    }
  });

  it('every strategy documents a full cycle and payout path', () => {
    for (const s of strategies) {
      assert.ok(s.fullCycle.length >= 3, `${s.id} fullCycle too short`);
      assert.ok(
        Array.isArray(s.payout.methods) && s.payout.methods.length >= 1,
        `${s.id} has no payout methods`
      );
      assert.ok(s.payout.minimumPayout, `${s.id} missing minimumPayout`);
    }
  });

  it('is ranked by priority score with contiguous ranks', () => {
    strategies.forEach((s, i) => {
      assert.strictEqual(s.rank, i + 1, `${s.id} rank`);
      assert.strictEqual(
        s.priorityScore,
        computePriorityScore(
          s.scores,
          s.physical,
          s.capitalRequiredUsd,
          s.profitLikelihoodPercent
        ),
        `${s.id} priorityScore`
      );
      assert.strictEqual(
        s.tier,
        tierFor(s.priorityScore, s.profitLikelihoodPercent),
        `${s.id} tier`
      );
      if (i > 0) {
        assert.ok(
          strategies[i - 1].priorityScore >= s.priorityScore,
          `${s.id} out of order`
        );
      }
    });
  });

  it('covers many categories', () => {
    const cats = new Set(strategies.map((s) => s.category));
    assert.ok(cats.size >= 8, `only ${cats.size} categories`);
  });

  it('matches a fresh build from data/strategies/*.json', async () => {
    const dir = join(ROOT, 'data', 'strategies');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    const raw = [];
    for (const f of files.sort()) {
      const arr = JSON.parse(await readFile(join(dir, f), 'utf-8'));
      for (const s of arr) {
        raw.push({ ...s, sourceFile: f });
      }
    }
    const { accepted } = buildCatalog(raw);
    assert.deepStrictEqual(
      accepted.map((s) => s.id),
      strategies.map((s) => s.id),
      'data/strategies.json is stale — run `npm run build:catalog`'
    );
  });

  it('generated docs exist for every strategy', async () => {
    const dir = join(ROOT, 'docs', 'business-plans');
    const files = new Set(await readdir(dir));
    for (const s of strategies) {
      assert.ok(files.has(`${s.id}.md`), `missing docs for ${s.id}`);
    }
    assert.ok(files.has('README.md'));
  });
});

describe('Business plans', () => {
  it('every strategy has a valid businessPlan', () => {
    const missing = strategies.filter((s) => !s.businessPlan).map((s) => s.id);
    assert.deepStrictEqual(missing, [], `missing businessPlan: ${missing}`);
    for (const s of strategies) {
      const problems = validateBusinessPlan(s.businessPlan);
      assert.deepStrictEqual(problems, [], `${s.id}: ${problems.join('; ')}`);
    }
  });

  it('business-plan figures are consistent with the entry', () => {
    for (const s of strategies) {
      const bp = s.businessPlan;
      assert.strictEqual(
        bp.startupResources.cashUsd,
        s.capitalRequiredUsd,
        `${s.id}: startup cash must equal capitalRequiredUsd`
      );
      const net = bp.marketConditions.typicalNetProfitMonth12Usd;
      assert.ok(
        net.median <= s.typicalMonthlyIncomeUsd.median,
        `${s.id}: month-12 median net profit exceeds median income`
      );
      assert.ok(
        net.high <= s.typicalMonthlyIncomeUsd.high,
        `${s.id}: month-12 high net profit exceeds high income`
      );
      assert.strictEqual(
        s.profitLikelihoodPercent,
        bp.marketConditions.profitLikelihoodPercent
      );
      assert.strictEqual(s.startupCashUsd, bp.startupResources.cashUsd);
      assert.ok(
        bp.marketConditions.profitLikelihoodPercent <=
          s.scores.paymentProbability * 10 + 15,
        `${s.id}: profit likelihood ${bp.marketConditions.profitLikelihoodPercent}% is implausible against payment probability ${s.scores.paymentProbability}/10`
      );
      if (s.recurringMonthlyUsd > 0) {
        assert.ok(
          bp.breakEven.unitsPerMonthToBreakEven > 0,
          `${s.id}: has a fixed monthly cost but no break-even units`
        );
      }
    }
  });

  it('profit likelihood raises the priority score', () => {
    const base = strategies[0].scores;
    assert.ok(
      computePriorityScore(base, false, 0, 90) >
        computePriorityScore(base, false, 0, 10)
    );
  });

  it('exposes a most-likely-to-profit shortlist of real-profit plans', () => {
    const sl = catalog.shortlists.find(
      (x) => x.key === 'most-likely-to-profit'
    );
    assert.ok(sl && sl.ids.length === 10);
    const byId = new Map(strategies.map((s) => [s.id, s]));
    for (const id of sl.ids) {
      const s = byId.get(id);
      assert.ok(s.profitLikelihoodPercent >= 50, `${id} has low profit odds`);
    }
  });

  it('every tier S plan has decent profit odds', () => {
    for (const s of strategies.filter((x) => x.tier === 'S')) {
      assert.ok(
        s.profitLikelihoodPercent >= TIER_S_MIN_PROFIT_LIKELIHOOD,
        `${s.id}: tier S with only ${s.profitLikelihoodPercent}% profit odds`
      );
    }
  });
});

describe('Incorporation costs', () => {
  it('covers every reference country exactly once', async () => {
    const countries = JSON.parse(
      await readFile(join(ROOT, 'data', 'countries.json'), 'utf-8')
    );
    const dir = join(ROOT, 'data', 'incorporation');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    const entries = [];
    for (const f of files) {
      entries.push(...JSON.parse(await readFile(join(dir, f), 'utf-8')));
    }
    const seen = entries.map((e) => e.iso2).sort();
    const expected = Object.keys(countries).sort();
    assert.deepStrictEqual(seen, expected);
    for (const e of entries) {
      assert.ok(e.soleProprietor, `${e.iso2}: soleProprietor missing`);
      assert.ok(e.company, `${e.iso2}: company missing`);
      assert.ok(e.tax, `${e.iso2}: tax missing`);
      assert.ok(
        typeof e.company.typicalAllInFormationCostUsd === 'number',
        `${e.iso2}: company.typicalAllInFormationCostUsd must be a number`
      );
      assert.ok(
        Array.isArray(e.sources) && e.sources.length > 0,
        `${e.iso2}: sources required`
      );
    }
  });

  it('generated incorporation docs exist', async () => {
    for (const f of [
      'docs/legal/incorporation-costs.md',
      'docs/legal/remote-incorporation-options.md',
    ]) {
      await readFile(join(ROOT, f), 'utf-8');
    }
  });
});

describe('Scoring', () => {
  it('weights sum to 1', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  it('rewards payment probability, automation and low effort', () => {
    const base = {
      paymentProbability: 5,
      automation: 5,
      setupEffort: 5,
      ongoingEffort: 5,
      incomePotential: 5,
      platformAvailabilityPercent: 50,
    };
    const s0 = computePriorityScore(base);
    assert.ok(computePriorityScore({ ...base, paymentProbability: 9 }) > s0);
    assert.ok(computePriorityScore({ ...base, automation: 9 }) > s0);
    assert.ok(computePriorityScore({ ...base, ongoingEffort: 1 }) > s0);
    assert.ok(computePriorityScore({ ...base, setupEffort: 9 }) < s0);
    assert.ok(
      computePriorityScore({ ...base, platformAvailabilityPercent: 100 }) > s0
    );
    assert.ok(computePriorityScore(base, true) < s0);
    assert.ok(computePriorityScore(base, false, 50) === s0);
    assert.ok(computePriorityScore(base, false, 500) < s0);
    assert.ok(
      computePriorityScore(base, false, 500) <
        computePriorityScore(base, false, 200)
    );
  });

  it('maps scores to tiers', () => {
    assert.strictEqual(tierFor(85), 'S');
    assert.strictEqual(tierFor(70), 'S');
    assert.strictEqual(tierFor(75, 10), 'A');
    assert.strictEqual(tierFor(75, 25), 'S');
    assert.strictEqual(tierFor(65), 'A');
    assert.strictEqual(tierFor(55), 'B');
    assert.strictEqual(tierFor(49), 'C');
  });
});
