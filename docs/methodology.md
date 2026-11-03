# Scoring methodology

This page explains how every entry in the [business plans catalog](./business-plans/README.md) is screened and ranked. The goal is simple: put the ways of getting paid that are **most likely to pay**, **most automatable**, and **least effortful** at the top, and keep anything illegal out entirely.

## 1. Legality gate (pass/fail)

A strategy is admitted only if it is **legal for residents in at least 80% of the reference countries**: the countries Freedom House rates "Free" or "Partly Free" in its _Freedom on the Net_ report. The list lives in [`docs/legal/reference-countries.md`](./legal/reference-countries.md).

Consequences of this rule:

- **Excluded entirely:** online gambling and betting, prediction markets, adult content, multi-level marketing recruiting, unlicensed financial services, lending to strangers, selling personal data, spam, fake reviews and engagement, account selling, and anything that violates a platform's Terms of Service.
- **Excluded by coverage:** activities such as crypto staking, retail forex/CFD trading or peer-to-peer lending that are banned or heavily restricted in more than 20% of the reference countries. The evidence for each exclusion is in [`docs/legal/excluded-activities.md`](./legal/excluded-activities.md).
- **Not the same as availability.** A platform that simply does not pay out in a country does not make the activity illegal. We track that separately as `platformAvailabilityPercent`.

Income is taxable everywhere. Every plan assumes you declare it.

## 2. Scores (1–10 unless noted)

| Field                         | Meaning                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `paymentProbability`          | Chance a diligent average person who completes setup receives at least one real payout in 6 months. |
| `automation`                  | Share of ongoing work that scripts or AI agents can do after one-time setup. 10 = runs itself.      |
| `setupEffort`                 | 1 = under an hour, 10 = months of work.                                                             |
| `ongoingEffort`               | 1 = near zero hours per week, 10 = a full-time job.                                                 |
| `incomePotential`             | Realistic monthly ceiling for a solo operator after 12 months. 1 = under $50, 5 ≈ $1k, 10 = $20k+.  |
| `aiLeverage`                  | How much current AI can do the actual work.                                                         |
| `legalCoveragePercent`        | 0–100. Share of reference countries where residents may legally do this.                            |
| `platformAvailabilityPercent` | 0–100. Share of reference countries where the main platform actually pays out.                      |

Scores are calibrated, not promotional. Most online income methods have a **low** payment probability for an average person, and the catalog says so.

## 3. Priority score (0–100)

```
priority = 10 × ( 0.25 × paymentProbability
                + 0.10 × profitLikelihoodPercent / 10
                + 0.25 × automation
                + 0.15 × (11 − ongoingEffort)
                + 0.10 × (11 − setupEffort)
                + 0.05 × incomePotential
                + 0.10 × platformAvailabilityPercent / 10 )
         − 5 if the plan needs a physical asset or presence
         − 8 if it needs $100–499 of capital, − 20 if it needs $500 or more
```

The weights encode the project owner's priorities: getting paid at all matters most (payment probability plus the business plan's profit likelihood, which accounts for fees and fixed costs), then running without human labor, then effort, then how big the upside is and how many countries the platform actually pays out in. Plans that need a car, a room or your own shipping are marked `physical` and lose 5 points, because the project prefers plans that are online end to end. Plans that need capital lose 8 points from $100 and 20 points from $500, because the project is zero-capital first: interest on savings pays reliably, but it is a return on money you already have.

| Tier | Score | Reading                                                                                   |
| ---- | ----- | ----------------------------------------------------------------------------------------- |
| S    | 70+   | Start here. Proven payouts, high automation, low effort, and profit odds of at least 25%. |
| A    | 60–69 | Strong second wave.                                                                       |
| B    | 50–59 | Viable, but needs more effort or has lower odds.                                          |
| C    | < 50  | Long shots or labor-heavy. Listed for completeness.                                       |

A plan that scores 70 or more but whose business plan gives it less than a 25% chance of real profit is capped at tier A: it pays reliably, but mostly tiny amounts.

## 4. Business plan and profit likelihood

Beyond the scores, every entry carries a `businessPlan` block so a reader can judge whether it is worth starting:

| Block              | What it answers                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startupResources` | Hours to launch, one-time cash, recurring monthly cost, tools, skills, equipment and accounts needed.                                                                                                                                                                                                                                                                                                                                         |
| `unitEconomics`    | What one unit is (a sale, an hour, 1,000 views), the typical price buyers pay today (low / median / high), direct cost, platform fee, gross margin and human hours per unit after automation.                                                                                                                                                                                                                                                 |
| `breakEven`        | Monthly fixed cost, units per month to cover it, typical months to break even, months to recover the startup cash.                                                                                                                                                                                                                                                                                                                            |
| `marketConditions` | Demand trend, competition, effect of AI, price pressure, and **`profitLikelihoodPercent`**: the share of diligent average starters we estimate reach a real net profit within 12 months: at least $100/month for plans that can pay that much, any net-positive payout for small-but-certain plans such as survey panels whose ceiling is below $100/month. Also a low / median / high net profit at month 12 (`typicalNetProfitMonth12Usd`). |
| `pricingStrategy`  | How to price to win first customers and then raise prices.                                                                                                                                                                                                                                                                                                                                                                                    |
| `profitPath`       | Month-by-month steps from setup to profit.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `sources`          | Links backing the prices, fees and market figures above.                                                                                                                                                                                                                                                                                                                                                                                      |

`profitLikelihoodPercent` is deliberately calibrated against known base rates: survey panels pay almost everyone a tiny amount (~90%), freelance gigs land for roughly a third to a half of persistent starters, affiliate and SEO sites 10–20%, micro-SaaS 10–15%, YouTube and TikTok 5–10%, competitions and bounties a few percent. A plan can have a high payment probability and a low profit likelihood when it carries a monthly fee. These figures are estimates, marked as such in the notes. They enter the priority score with weight 0.10 (as `profitLikelihoodPercent / 10`), and the catalog index also lists the top 30 entries by profit odds on their own.

The cost of becoming a legal business is tracked separately per reference country in [`docs/legal/incorporation-costs.md`](./legal/incorporation-costs.md) (generated from `data/incorporation/*.json`), with cross-border options in the handwritten [`docs/legal/remote-incorporation-options.md`](./legal/remote-incorporation-options.md).

## 5. Evidence standard

Every entry must cite at least one source and a short note explaining why we believe real people get paid: an official payout page, a public earnings report, platform statistics, or widely documented examples. Entries without evidence are rejected by the build script.

## 6. How the catalog is built

```
data/strategies/<category>.json   ← edit these
data/incorporation/*.json         ← edit these
        │
        ▼  npm run build:catalog
data/strategies.json              ← merged, ranked, gated
website/strategies.json           ← served by the website
docs/business-plans/README.md     ← ranked index
docs/business-plans/<id>.md       ← one page per plan, including its business plan
docs/legal/incorporation-costs.md ← incorporation costs per reference country
website/plans/, website/docs/     ← HTML pages for the site (not committed)
```

`tests/catalog.test.js` enforces: at least 100 strategies, unique ids, every score in range, legal coverage ≥ 80%, and at least one source each.

## 7. Updating a score

Open a pull request editing the relevant JSON file. Say what changed in the real world (new payout rule, program closed, new country support) and link the source. Re-run the build so generated files stay in sync.
