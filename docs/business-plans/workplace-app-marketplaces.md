# Atlassian, Figma and Zoom marketplace apps

**Rank #141 · Tier C · Priority score 49/100 · Category: Software & developer monetization**

Build paid apps/plugins for Jira/Confluence (Atlassian Forge), Figma Community, or Zoom, billed through the host's marketplace.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 3/10 |
| Automation after setup | 6/10 |
| Setup effort (1 = trivial) | 7/10 |
| Ongoing effort (1 = none) | 4/10 |
| Income potential | 8/10 |
| AI leverage | 8/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 70% |
| Capital required | $0 |
| Time to first dollar | 60–365 d |
| Typical monthly income (low / median / high) | $0 / $300 / $20,000 |

## Realistic expectations

Most people who try this earn around **$0–$300 per month** in the first year; the high figure of $20,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **3/10**. Expect the first payment after 60–365 d.

## How it works

Teams pay per-user subscriptions for apps that extend tools they already use. Atlassian Marketplace pays partners 100% of the first $1M lifetime Forge revenue (from 1 Jan 2026, Forge-only apps) then 83% (from 1 Oct 2026; Connect apps 75%). Figma Community sells paid plugins via Stripe (commission reported as 15%, not re-confirmed). Zoom App Marketplace takes 15% but monetization is US-only. Slack Marketplace has no native billing (use own Stripe). Payers are businesses on per-seat plans, so ARPU is high.

**Platforms:** Atlassian Marketplace, Figma Community, Zoom App Marketplace, Slack Marketplace

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 150 hours |
| One-time cash | $0 |
| Recurring fixed cost | $20 / month |
| Tools | Atlassian Forge (free tier hosting); Figma plugin API; Zoom/Slack developer accounts; monitoring and small backend (~$20/mo) |
| Skills | JavaScript/TypeScript on Forge/Figma APIs; security and data-residency questionnaires; B2B support and docs |
| Equipment | laptop or desktop; stable internet |
| Accounts | Atlassian Marketplace partner account + payment details; Figma creator + Stripe account; Zoom/Slack developer accounts |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per customer-month |
| Typical price per unit (low / median / high) | $10 / $50 / $500 |
| Direct cost per unit | $2 |
| Platform fee | 0% |
| Gross margin (median case) | 96% |
| Human hours per unit after automation | 0.5 |

Atlassian apps price per user tier, so a small team pays ~$10-$100/month; Forge apps keep 100% of the first $1M lifetime revenue under the 2026 terms (Figma/Zoom fees estimated at ~15%, not confirmed on their help pages); Forge drops to 83% to the partner above $1M from Oct 2026; cost is hosting/support per customer (estimate).

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $20 |
| Units per month to break even | 1 |
| Typical months to break even | 8 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). One customer covers fixed costs, but Atlassian pays only after $500 accrued profit, so cash break-even lags by 1-3 months.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | growing |
| Competition | high |
| Effect of AI | neutral |
| Price pressure | stable |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **10%** |
| Typical net profit at month 12 (low / median / high) | $-20 / $40 / $10,000 |

Partners solving specific admin/reporting gaps in Jira/Confluence win, as companies buy per seat and churn little. Atlassian's Connect-to-Forge migration and 0% Forge share open room for new entrants, while Atlassian Rovo and Figma AI absorb some generic features. Failure mode: long security reviews and enterprise sales cycles before revenue. Median net at month 12 set to $40 to match the 10% profit likelihood.

### Pricing strategy

Use free tier for up to 10 users and price paid tiers just below the category leader; add enterprise data-residency features to justify raising prices later.

### Path to profit

1. Month 0: build Forge MVP for one pain point and pass security self-assessment (cost $0-$20/mo)
2. Month 1-3: list app, free trials; $0-$50
3. Month 3-6: case studies and integrations; $50-$400/month
4. Month 6-12: enterprise tier; $100-$2,000/month for successful apps

_Business-plan sources:_

- <https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/>
- <https://help.figma.com/hc/en-us/articles/12730712101783>
- <https://developers.zoom.us/blog/app-monetization-revenue-stream/>

## Payout path

- **Methods:** Atlassian: bank transfer, Figma: Stripe -> bank, Zoom: bank (US)
- **Minimum payout:** Atlassian: $500 accrued profit; Figma: via Stripe; Zoom: not published
- **Frequency:** monthly
- **Typical delay:** 45 days
- **Notes:** Atlassian pays within 30 days after the end of the month in which you accrue $500+ profit (30-60 days after a sale); Figma sellers must activate Stripe and live in a Stripe-supported country; Zoom monetization limited to US-based developers and US customers, 15% commission, paid to bank.

## Full cycle (setup → earn → bank account)

1. Join Atlassian Marketplace or Figma seller program
2. Build app
3. Pass review
4. List with pricing
5. Customers subscribe
6. Monthly payout

## What can be automated

- AI agent builds Forge/Figma plugin code
- Automated deploys via Forge CLI
- License/entitlement checks via APIs
- AI support triage

## Unavoidable manual steps

- Partner/vendor onboarding
- Security review
- Customer support

## Legality & compliance

Legal B2B software.

- **Compliance requirements:** Marketplace partner agreement; security/privacy requirements (Forge, Cloud Fortified); Stripe KYC (Figma)
- **Platform availability:** Atlassian pays partners broadly; Figma requires a Stripe-supported country and seller approval; Zoom monetization is US-only.

## Risks

- Platform revenue-share changes
- Long enterprise sales cycles
- Figma seller approval may be paused

## Evidence that people get paid

Atlassian's developer docs document the Forge 100%-to-$1M lifetime share, 83%/75% rates from Oct 2026 and the $500 remittance threshold; Zoom's developer blog states the 15% commission and US-only eligibility; Figma help requires Stripe activation.

## Sources

- <https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/>
- <https://help.figma.com/hc/en-us/articles/12730712101783>
- <https://developers.zoom.us/blog/app-monetization-revenue-stream/>

_Tags: b2b, recurring, saas, plugins_

---

_Generated from `data/strategies/software.json` by `npm run build:catalog`. Edit the JSON, not this file._
