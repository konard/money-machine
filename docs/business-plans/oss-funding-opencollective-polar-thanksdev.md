# Open Collective, Polar.sh and thanks.dev funding for OSS

**Rank #91 · Tier B · Priority score 54/100 · Category: Software & developer monetization**

Collect OSS funding through a fiscal host (Open Collective), Polar.sh donations/subscriptions, or dependency-based corporate funding via thanks.dev, then pay yourself.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 3/10 |
| Automation after setup | 6/10 |
| Setup effort (1 = trivial) | 3/10 |
| Ongoing effort (1 = none) | 3/10 |
| Income potential | 4/10 |
| AI leverage | 7/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 85% |
| Capital required | $0 |
| Time to first dollar | 30–365 d |
| Typical monthly income (low / median / high) | $0 / $20 / $1,500 |

## Realistic expectations

Most people who try this earn around **$0–$20 per month** in the first year; the high figure of $1,500 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **3/10**. Expect the first payment after 30–365 d.

## How it works

Open Collective: a fiscal host holds money transparently and you submit expenses/invoices for your work, paid via PayPal or Wise. Polar.sh: merchant of record that lets you sell sponsorships, paid access, license keys and donations for repos. thanks.dev: companies fund their whole dependency tree; registered maintainers receive an algorithmic share. Payers are companies and users who depend on your code.

**Platforms:** Open Collective, Polar.sh, thanks.dev

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 20 hours |
| One-time cash | $0 |
| Recurring fixed cost | $0 / month |
| Tools | Open Collective via Open Source Collective host; Polar.sh (free account); thanks.dev (free maintainer registration) |
| Skills | maintain an open-source project with real users; write transparent budgets/expense reports; basic invoicing |
| Equipment | laptop or desktop; stable internet |
| Accounts | Open Collective account (fiscal host application); Polar account + Stripe Connect Express KYC; PayPal or Wise for expense reimbursement |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per backer-month |
| Typical price per unit (low / median / high) | $2 / $10 / $500 |
| Direct cost per unit | $0 |
| Platform fee | 13% |
| Gross margin (median case) | 87% |
| Human hours per unit after automation | 0.2 |

Typical backer pledges $2-$25/month, company backers $100-$500; fee approximates a ~10% fiscal-host fee plus ~3% card processing on Open Collective (Polar Starter is 5% + 50c for organisations created after May 27, 2026, +1.5% for non-US cards). Open Collective host fee estimated; its pricing page is bot-blocked.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $0 |
| Units per month to break even | 0 |
| Typical months to break even | 6 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). No fixed costs; break-even equals the month of the first backer or first thanks.dev allocation.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | high |
| Effect of AI | headwind |
| Price pressure | stable |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **5%** |
| Typical net profit at month 12 (low / median / high) | $0 / $15 / $800 |

Collectives with corporate users and visible budgets win; thanks.dev and similar dependency-funding schemes pay small algorithmic shares spread across thousands of packages. The Open Collective Foundation host shut down in 2024 and Polar has refocused on selling products/subscriptions, so maintainers must pick hosts carefully. Failure mode: money sits in the collective balance and is too small to justify expense paperwork.

### Pricing strategy

Publish a concrete budget (e.g. $500/month = 2 days of maintenance) and offer company tiers with logo placement; switch to paid support or license keys on Polar once demand is proven.

### Path to profit

1. Month 0: apply to Open Source Collective, register on thanks.dev, connect Polar (cost $0)
2. Month 1-2: add funding links and a budget page; expected $0-$10
3. Month 3-6: contact companies in your dependents list; expected $10-$50/month
4. Month 6-12: submit monthly expenses to pay yourself and add a paid tier on Polar; $15-$300/month if usage grows

_Business-plan sources:_

- <https://opencollective.com/pricing>
- <https://docs.opencollective.com/help/expenses-and-getting-paid>
- <https://polar.sh/docs/merchant-of-record/supported-countries>
- <https://thanks.dev>
- <https://polar.sh/docs/merchant-of-record/fees>

## Payout path

- **Methods:** PayPal, Wise -> bank, Stripe Connect Express -> bank (Polar)
- **Minimum payout:** Polar: no minimum published; Open Collective: per-expense, no fixed minimum
- **Frequency:** per expense / monthly
- **Typical delay:** 21 days
- **Notes:** Polar pays out via Stripe Connect Express (Stripe payout fees apply); Open Collective hosts may charge a host fee (e.g. ~10%); thanks.dev requires maintainer registration. Polar/Open Collective fee figures not re-confirmed on official pages in Nov 2026.

## Full cycle (setup → earn → bank account)

1. Create collective/Polar org
2. Link repos
3. Promote funding links
4. Receive funds
5. Submit expense or await payout
6. Withdraw to bank

## What can be automated

- Auto-submit monthly expense invoices from a template
- Polar API/webhooks to deliver license keys and gated content
- AI-generated transparency updates and changelogs for backers

## Unavoidable manual steps

- Apply to a fiscal host
- KYC and payout account setup
- Register projects on thanks.dev

## Legality & compliance

Donations and invoices for maintenance work are legal; income taxable. Fiscal host handles some compliance.

- **Compliance requirements:** fiscal host rules; Stripe KYC (Polar); tax reporting
- **Platform availability:** Polar's official list has 119 Stripe Connect Express payout countries, covering 36 of 48 reference countries (missing: Brazil, Nepal, Uganda, Zambia, Malawi, Zimbabwe, Lebanon, Iraq, Libya, Ukraine, Georgia, Kyrgyzstan). Open Collective pays expenses via PayPal/Wise, which covers several of those gaps; thanks.dev payouts route via its partners.

## Risks

- Low and irregular amounts
- Host fees
- Funds may sit at org level (thanks.dev)
- Open Collective Foundation host closed 2024 - pick an active host

## Evidence that people get paid

Open Collective publicly lists transparent ledgers of paid expenses for thousands of collectives; Polar's docs describe Stripe Connect payouts across its supported countries; thanks.dev distributes funds from companies like Sentry to dependency maintainers.

## Sources

- <https://docs.opencollective.com/help/expenses-and-getting-paid>
- <https://polar.sh/docs/merchant-of-record/supported-countries>
- <https://opencollective.com/pricing>
- <https://thanks.dev>

_Tags: open-source, donations, recurring, developer_

---

_Generated from `data/strategies/software.json` by `npm run build:catalog`. Edit the JSON, not this file._
