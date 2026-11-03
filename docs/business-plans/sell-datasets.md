# Sell lawfully collected non-personal datasets (Datarade, Snowflake/AWS marketplaces, licensed Hugging Face repos)

**Rank #109 · Tier B · Priority score 53/100 · Category: Data & security work**

Package original or aggregated non-personal data, such as prices, product specs, public statistics or synthetic data, and license it to companies.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 2/10 |
| Automation after setup | 8/10 |
| Setup effort (1 = trivial) | 6/10 |
| Ongoing effort (1 = none) | 3/10 |
| Income potential | 6/10 |
| AI leverage | 7/10 |
| Legal in reference countries | 95% |
| Platform pays out in reference countries | 75% |
| Capital required | $0 |
| Time to first dollar | 60–365 d |
| Typical monthly income (low / median / high) | $0 / $0 / $3,000 |

## Realistic expectations

Most people who try this earn around **$0–$0 per month** in the first year; the high figure of $3,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **2/10**. Expect the first payment after 60–365 d.

## How it works

Buyers pay for clean, documented, regularly updated data they can't easily collect themselves. You compile data from sources whose licence allows commercial reuse (open-government data, your own measurements, synthetic generation), document it, and list it. Datarade's commission-only plan has no fee and takes 30% of facilitated sales. Hugging Face is mainly for free hosting and discovery, so paid access is usually sold through a gated repo plus an external licence/checkout. Kaggle datasets earn nothing. Do not resell personal data.

**Platforms:** Datarade, Hugging Face (gated + external checkout), AWS Data Exchange, Snowflake Marketplace

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 60 hours |
| One-time cash | $0 |
| Recurring fixed cost | $0 / month |
| Tools | Python + GitHub Actions for refresh pipelines (free tier); Hugging Face gated repo (free); Datarade commission-only plan (free); LLM for documentation (free tier) |
| Skills | data engineering; licence review of sources; B2B selling |
| Equipment | laptop |
| Accounts | Datarade provider account; Stripe or Gumroad for direct licences; AWS/Snowflake seller account (needs a company) |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per licence sale |
| Typical price per unit (low / median / high) | $50 / $500 / $5,000 |
| Direct cost per unit | $10 |
| Platform fee | 30% |
| Gross margin (median case) | 68% |
| Human hours per unit after automation | 2 |

Datarade's commission-only plan takes 30%; niche B2B datasets sell for $50-5,000 per licence. $10 covers compute/storage per delivery.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $0 |
| Units per month to break even | 0 |
| Typical months to break even | 9 |
| Months to recover startup cash | 0 |

No fixed costs, so every paid unit is profit; break-even equals the time to the first payout. Free tiers cover hosting; the first sale typically takes 6-12 months of listing and outreach.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | growing |
| Competition | medium |
| Effect of AI | tailwind |
| Price pressure | stable |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **8%** |
| Typical net profit at month 12 (low / median / high) | $0 / $0 / $2,000 |

Demand for licensed, clean data has grown with AI, but large buyers prefer established vendors with legal warranties. AI makes collection and documentation cheap, so generic datasets compete with free open data. Winners own a narrow niche dataset that is refreshed and hard to collect; most listings never sell.

### Pricing strategy

Publish a free sample, price the first licences low ($50-200) to get references, then move to annual subscriptions priced per refresh frequency.

### Path to profit

1. Month 0: pick a niche, verify source licences, build the pipeline (about 60 hours, cost $0)
2. Month 1-3: list on Datarade and a gated Hugging Face repo; likely $0
3. Month 3-9: direct outreach to 50+ potential buyers; first $50-500 licence
4. Month 9-12: convert buyers to subscriptions; $0-2,000/month

_Business-plan sources:_

- <https://providers.datarade.ai/apply>
- <https://datarade.ai/company/blog/data-marketplace>

## Payout path

- **Methods:** bank transfer, Stripe/Gumroad -> bank
- **Minimum payout:** varies by marketplace
- **Frequency:** per sale / monthly
- **Typical delay:** 30 days
- **Notes:** Marketplaces take 15-30% commission.

## Full cycle (setup → earn → bank account)

1. Find a niche gap
2. Build the pipeline
3. Publish a sample
4. List on a marketplace
5. Sell licences -> bank

## What can be automated

- Automated collection/refresh pipelines
- Auto-generated data docs and samples with LLMs
- Scheduled publishing

## Unavoidable manual steps

- Licence review of sources
- Seller onboarding/KYC
- B2B sales conversations

## Legality & compliance

Legal when the data is non-personal and the source licence allows commercial redistribution. Database rights (EU) and scraping ToS still apply.

- **Compliance requirements:** no personal data (GDPR etc.); respect source licences/ToS; B2B invoicing/VAT; report income for tax
- **Platform availability:** Datarade and Gumroad-style checkouts serve most countries. AWS/Snowflake seller programs need a company in supported jurisdictions.

## Risks

- Few buyers for niche data
- Licence/legal disputes
- Data goes stale

## Evidence that people get paid

Datarade's provider pages describe a commission-only seller plan at 30%.

## Sources

- <https://providers.datarade.ai/apply>
- <https://datarade.ai/company/blog/data-marketplace>

_Tags: data, b2b, automatable_

---

_Generated from `data/strategies/micro-tasks.json` by `npm run build:catalog`. Edit the JSON, not this file._
