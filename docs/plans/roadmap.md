# Roadmap

Money Machine's goal is a universal, legal, automation-first toolkit that lets anyone on the planet get paid online. The catalog answers "which ways exist and which are worth doing first"; the code answers "how do we run them with as little human effort as possible".

## Phase 0 — Catalog (done in this release)

- [x] 100+ legal ways to get paid, each with scores, payout path, full cycle, risks and sources
- [x] Legality gate: legal in at least 80% of countries with relatively free internet
- [x] Priority score that favors high probability of payment, high automation and low effort
- [x] Generated markdown catalog (`docs/business-plans/`) and static website (`website/`)
- [x] Tests that enforce the catalog requirements
- [x] A resourced business plan on every entry: startup needs, unit economics and typical price, break-even, market conditions and a calibrated profit likelihood
- [x] Incorporation costs for all 50 reference countries (`docs/legal/incorporation-costs.md`) and remote options

## Phase 1 — Pick the first wave

Implement strategy modules (see [`REQUIREMENTS.md`](../../REQUIREMENTS.md)) for the top-tier entries where **payment probability ≥ 6**, **automation ≥ 7** and **capital = $0**. Each module must:

- ship a `getExecutionGuide()` with every manual step (KYC, bank linking) spelled out
- run its automated steps from a single GitHub Actions "Run workflow" button
- return verification data proving money was earned and paid out

Candidate order (from the catalog ranking; re-check after each rebuild):

1. The highest-scored passive or near-passive entries (ad-supported sites, marketplace listings, API/actor marketplaces, cashback-style programs)
2. Platform-paid programs with low thresholds and fast payouts (micro-task and data-labeling platforms, bounties)
3. Recurring-revenue entries (memberships, micro-SaaS, affiliate recurring commissions)

## Phase 2 — Automation runtime

- Scheduler-driven execution of multiple strategies in one GitHub Actions workflow
- Secrets checklist generator: given a set of strategies, print every token and account needed
- Earnings ledger: one JSON/SQLite ledger that every strategy appends to, with payout reconciliation
- Compliance engine rules loaded from `docs/research/platform-rules.md` as data, not prose

## Phase 3 — Agent operation

- An AI agent loop that reads the catalog, picks the next best strategy for the user's country and skills, and executes the automated steps
- Country-aware filtering using `data/countries.json` (platform availability, payout rails)
- Weekly re-scoring job that re-verifies payout rules and flags closed programs
- Re-verify the figures marked _estimated_ in the business plans and incorporation table against official pages, and turn the price and fee estimates into fetched facts

## Phase 4 — Community

- Contribution guide for adding or re-scoring strategies (JSON only; docs are generated)
- Public earnings reports from real runs, so scores converge on reality rather than opinion

## Non-goals

- Anything illegal in more than 20% of the reference countries, or against any platform's Terms of Service
- Gambling, adult content, MLM, unlicensed financial services, crypto-only payout schemes
- "Guaranteed" income claims; the catalog reports calibrated odds, not promises
