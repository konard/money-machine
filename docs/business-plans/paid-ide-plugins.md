# Paid IDE plugins (JetBrains Marketplace, VS Code via license keys)

**Rank #106 · Tier B · Priority score 53/100 · Category: Software & developer monetization**

Sell paid or freemium plugins for JetBrains IDEs through the native marketplace, or VS Code/Cursor extensions unlocked by license keys.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 3/10 |
| Automation after setup | 6/10 |
| Setup effort (1 = trivial) | 5/10 |
| Ongoing effort (1 = none) | 3/10 |
| Income potential | 6/10 |
| AI leverage | 8/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 85% |
| Capital required | $0 |
| Time to first dollar | 30–240 d |
| Typical monthly income (low / median / high) | $0 / $100 / $5,000 |

## Realistic expectations

Most people who try this earn around **$0–$100 per month** in the first year; the high figure of $5,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **3/10**. Expect the first payment after 30–240 d.

## How it works

JetBrains Marketplace supports paid plugins natively: JetBrains handles licensing and billing and keeps a 15% commission. VS Code Marketplace has no built-in payments, so developers ship a free extension that validates a license key sold via Lemon Squeezy/Polar/Paddle. Payers are professional developers and companies buying productivity tooling, who are relatively willing to pay.

**Platforms:** JetBrains Marketplace, Visual Studio Marketplace, Open VSX, Lemon Squeezy/Polar license keys

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 80 hours |
| One-time cash | $0 |
| Recurring fixed cost | $0 / month |
| Tools | JetBrains Marketplace (15% commission); VS Code/Open VSX publisher (free); Lemon Squeezy or Polar for VS Code license keys |
| Skills | Kotlin/Java for IntelliJ Platform or TypeScript for VS Code (AI covers much); developer-tool UX; release maintenance against IDE updates |
| Equipment | laptop or desktop; stable internet |
| Accounts | JetBrains Marketplace vendor profile + payout bank details; Visual Studio Marketplace publisher; MoR account for license keys |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per paying user-month |
| Typical price per unit (low / median / high) | $2 / $5 / $20 |
| Direct cost per unit | $0 |
| Platform fee | 15% |
| Gross margin (median case) | 85% |
| Human hours per unit after automation | 0.05 |

Paid JetBrains plugins commonly cost $2-$10/month for individuals (more for organizations); JetBrains keeps 15% and handles billing.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $0 |
| Units per month to break even | 0 |
| Typical months to break even | 6 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). No fixed costs; JetBrains pays only once the balance exceeds $200 (or every 31 Dec), so cash arrives later than break-even on paper.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | high |
| Effect of AI | headwind |
| Price pressure | falling |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **8%** |
| Typical net profit at month 12 (low / median / high) | $0 / $40 / $3,000 |

Developers will pay for tools that save real time in a specific stack (framework support, database tools, test runners). Since 2025 AI coding agents (Copilot, Cursor, Claude Code, JetBrains AI) absorb many former plugin features, so generic helpers lose value. Failure mode: a narrow user base plus constant API breakage each IDE release.

### Pricing strategy

Offer a free tier and a 30-day trial, price at $3-$5/month for individuals and 2-3x for organizations; raise after adding team features.

### Path to profit

1. Month 0: build plugin, publish free version, set up paid listing (cost $0)
2. Month 1-2: gather installs and feedback; $0-$20
3. Month 3-6: add paid features and org licensing; $20-$150/month
4. Month 6-12: port to the other IDE family; $40-$500/month for top quartile

_Business-plan sources:_

- <https://plugins.jetbrains.com/docs/marketplace/revenue-sharing-and-fees.html>
- <https://plugins.jetbrains.com/docs/marketplace/getting-paid.html>

## Payout path

- **Methods:** JetBrains: bank transfer (USD/EUR), MoR -> bank/PayPal
- **Minimum payout:** JetBrains: $200/EUR200 (or paid every Dec 31)
- **Frequency:** monthly
- **Typical delay:** 45 days
- **Notes:** Official: paid by bank in USD/EUR on a JetBrains self-billing invoice, up to 30 days after month end once balance exceeds $200/EUR200, and every 31 December regardless. Commission is 15% (contractually capped at 25%; custom terms possible for high revenue).

## Full cycle (setup → earn → bank account)

1. Register as JetBrains vendor
2. Build plugin
3. Set pricing
4. Approval
5. Sales
6. Reach $200
7. Bank payout

## What can be automated

- AI agent writes/maintains plugin code against IDE APIs
- CI publishing to Marketplace
- Automated license provisioning via webhooks

## Unavoidable manual steps

- Vendor verification
- Plugin review
- Customer support

## Legality & compliance

Legal software sale.

- **Compliance requirements:** JetBrains vendor agreement and tax info; MoR KYC
- **Platform availability:** JetBrains is a global vendor and pays by bank transfer in most countries outside sanctions; MoRs cover most of the rest.

## Risks

- Narrow market
- IDE API breakages each release
- Free alternatives and AI assistants commoditize features

## Evidence that people get paid

JetBrains help docs describe paid plugin payouts and revenue sharing; JetBrains blog 'One year of paid plugins' reported growing vendor revenue.

## Sources

- <https://plugins.jetbrains.com/docs/marketplace/getting-paid.html>
- <https://plugins.jetbrains.com/docs/marketplace/revenue-sharing-and-fees.html>
- <https://blog.jetbrains.com/platform/2020/07/one-year-of-paid-plugins-on-the-marketplace/>

_Tags: developer-tools, recurring, licensing_

---

_Generated from `data/strategies/software.json` by `npm run build:catalog`. Edit the JSON, not this file._
