# Dual-license your open-source library (AGPL/GPL + paid commercial license)

**Rank #164 · Tier C · Priority score 47/100 · Category: Licensing, royalties & rentals**

Publish useful code under a copyleft license and sell commercial licenses to companies that cannot comply with AGPL/GPL obligations.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 2/10 |
| Automation after setup | 7/10 |
| Setup effort (1 = trivial) | 8/10 |
| Ongoing effort (1 = none) | 5/10 |
| Income potential | 8/10 |
| AI leverage | 8/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 85% |
| Capital required | $0 |
| Time to first dollar | 60–540 d |
| Typical monthly income (low / median / high) | $0 / $0 / $10,000 |

## Realistic expectations

Most people who try this earn around **$0–$0 per month** in the first year; the high figure of $10,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **2/10**. Expect the first payment after 60–540 d.

## How it works

You build a library/tool businesses want to embed (PDF, charting, sync engine, CLI), release it under AGPL/GPL and offer a commercial license that removes copyleft obligations, sold with license keys. Companies pay because their legal teams forbid shipping AGPL code in proprietary products. Sell via Polar (merchant of record, automatic license keys) or Stripe plus Keygen for license validation. You must hold copyright to all code, so require a CLA from contributors.

**Platforms:** Polar, Keygen, Stripe, GitHub

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 300 hours |
| One-time cash | $0 |
| Recurring fixed cost | $2 / month |
| Tools | GitHub (free); Polar or Stripe checkout; Keygen license keys (free tier); lawyer-reviewed commercial license template |
| Skills | building a library companies depend on; copyleft licensing and CLA management; B2B sales; AI helps with code and docs |
| Equipment | laptop |
| Accounts | GitHub; Polar/Stripe + KYC; bank account |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per commercial license-year |
| Typical price per unit (low / median / high) | $300 / $1,500 / $15,000 |
| Direct cost per unit | $0 |
| Platform fee | 6% |
| Gross margin (median case) | 94% |
| Human hours per unit after automation | 3 |

Commercial licenses for niche libraries commonly $300-$5,000/year, enterprise more; Polar 5% + $0.50 (+1.5% non-US cards).

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $2 |
| Units per month to break even | 1 |
| Typical months to break even | 12 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). Fixed cost is just a domain (~$2/month).

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | medium |
| Effect of AI | headwind |
| Price pressure | falling |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **3%** |
| Typical net profit at month 12 (low / median / high) | $-2 / $-2 / $8,000 |

Works for projects with real enterprise adoption (PDF, charting, DB drivers) where legal teams avoid AGPL. AI coding assistants now generate permissive alternatives for small libraries, shrinking demand at the low end. Most new projects never gain the adoption that triggers license purchases.

### Pricing strategy

Start with a simple per-company annual price ($500-$1,500) and a free tier for small firms; add per-seat/enterprise tiers once inbound requests arrive.

### Path to profit

1. Month 0-3: publish an AGPL library and grow users
2. Month 3-6: add a commercial license page and CLA
3. Month 6-12: first inbound requests if adoption exists ($0-$1,500)
4. Month 12+: 1-5 licenses/month for the rare successful project

_Business-plan sources:_

- <https://polar.sh/docs/merchant-of-record/fees>
- <https://keygen.sh/pricing/>
- <https://www.gnu.org/philosophy/selling-exceptions.html>

## Payout path

- **Methods:** Stripe Connect -> bank (Polar), Stripe -> bank
- **Minimum payout:** Stripe payout minimums (about $1)
- **Frequency:** weekly/on demand
- **Typical delay:** 7 days
- **Notes:** Polar (merchant of record) fees: Starter 5% + 50c, Pro 3.8% + 40c, Growth 3.6% + 35c, Scale 3.4% + 30c (orgs created before 27 May 2026 keep 4% + 40c), plus 1.5% for non-US cards; Stripe payout costs ($2/month active, 0.25% + $0.25 per payout, 0.25-1% FX) pass through. Keygen has a free Dev tier (100 active licensed users, 10 releases) and a free self-hosted CE.

## Full cycle (setup → earn → bank account)

1. Build library
2. Publish under AGPL + commercial option
3. Gain adoption
4. Companies buy license keys
5. Payout to bank

## What can be automated

- Coding agents build and maintain the library and docs
- Automated license-key issuance on purchase via Polar benefits
- CI checks for license headers and CLA bot
- Automated renewal and dunning emails

## Unavoidable manual steps

- Choosing a valuable niche
- Enterprise sales questions and custom contracts
- Stripe/Polar KYC

## Legality & compliance

Copyright licensing is legal everywhere; Polar as merchant of record handles sales tax/VAT.

- **Compliance requirements:** own copyright to all code (CLA for contributors); clear LICENSE + COMMERCIAL-LICENSE terms; tax reporting; Stripe KYC
- **Platform availability:** Polar/Stripe payouts cover ~45 countries; elsewhere use Paddle/Lemon Squeezy-style MoRs.

## Risks

- Most projects never reach paying adoption
- Copyleft lowers adoption
- Forks of older versions
- Hard to enforce

## Evidence that people get paid

Long-running dual-license businesses: iText (AGPL+commercial), Artifex Ghostscript, Qt, MySQL historically; Sidekiq Pro/Enterprise show developers pay for commercial licenses.

## Sources

- <https://polar.sh/docs/merchant-of-record/fees>
- <https://keygen.sh/pricing/>
- <https://www.gnu.org/philosophy/selling-exceptions.html>

_Tags: developer, recurring, ip_

---

_Generated from `data/strategies/licensing.json` by `npm run build:catalog`. Edit the JSON, not this file._
