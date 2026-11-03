# GitHub Sponsors for open-source maintainers

**Rank #123 · Tier B · Priority score 51/100 · Category: Software & developer monetization**

Recurring and one-time donations from users and companies of your open-source projects via GitHub's built-in sponsorship.

## Scores

| Metric | Value |
| --- | --- |
| Payment probability (6 months) | 3/10 |
| Automation after setup | 6/10 |
| Setup effort (1 = trivial) | 3/10 |
| Ongoing effort (1 = none) | 4/10 |
| Income potential | 5/10 |
| AI leverage | 7/10 |
| Legal in reference countries | 100% |
| Platform pays out in reference countries | 75% |
| Capital required | $0 |
| Time to first dollar | 30–365 d |
| Typical monthly income (low / median / high) | $0 / $15 / $2,000 |

## Realistic expectations

Most people who try this earn around **$0–$15 per month** in the first year; the high figure of $2,000 is a ceiling for a focused solo operator, not a typical outcome. The chance of receiving at least one real payout within six months is rated **3/10**. Expect the first payment after 30–365 d.

## How it works

Publish genuinely useful open-source libraries/CLIs, enable a Sponsors profile with tiers (e.g. $5/$25/$250 with perks like priority issues or logo in README), and add FUNDING.yml so a Sponsor button appears on every repo. Individuals and companies that depend on your code pay to keep it maintained. Sponsorships from personal accounts carry 0% GitHub fee; org sponsorships carry up to 6%. Income tracks adoption, so it is slow and concentrated in popular maintainers.

**Platforms:** GitHub Sponsors

## Resources & business plan

### What you need to start

| Resource | Amount |
| --- | --- |
| Time to launch | 40 hours |
| One-time cash | $0 |
| Recurring fixed cost | $0 / month |
| Tools | GitHub (free); GitHub Sponsors (0% fee on personal sponsorships); AI coding assistant (optional, free tier) |
| Skills | build and maintain a library/CLI other developers depend on; write clear docs and READMEs (AI helps); handle issues and community politely |
| Equipment | laptop or desktop; stable internet |
| Accounts | GitHub account with 2FA; GitHub Sponsors profile + Stripe Connect KYC; bank account in a supported region |

### How the money is made (unit economics)

| Metric | Value |
| --- | --- |
| Unit | per sponsor-month |
| Typical price per unit (low / median / high) | $1 / $5 / $100 |
| Direct cost per unit | $0 |
| Platform fee | 0% |
| Gross margin (median case) | 100% |
| Human hours per unit after automation | 0.2 |

Typical GitHub Sponsors tiers are $1-$10 for individuals and $50-$250+ for companies; personal sponsorships carry 0% GitHub fee (orgs up to 6%), and GitHub covers card processing for personal sponsors.

### Break-even

| Metric | Value |
| --- | --- |
| Monthly fixed cost | $0 |
| Units per month to break even | 0 |
| Typical months to break even | 6 |
| Months to recover startup cash | 0 |

Fixed cost = recurringMonthlyUsd only (startup cash not amortised). No fixed costs, so the break-even month is simply the month of the first sponsor; with an already-used project this takes 3-12 months.

### Market conditions (Nov 2026)

| Factor | Assessment |
| --- | --- |
| Demand trend | stable |
| Competition | high |
| Effect of AI | headwind |
| Price pressure | stable |
| **Chance of real net profit within 12 months** (≥ $100/month where the plan can pay that much) | **5%** |
| Typical net profit at month 12 (low / median / high) | $0 / $10 / $1,000 |

Money concentrates in maintainers of widely used projects and those with corporate users; most profiles earn $0-$50/month. Since 2025 AI coding assistants have cut visits to docs and repos, which reduces Sponsor-button exposure (Tailwind Labs publicly blamed AI for falling revenue in early 2026). Failure mode: a niche project with few dependents earns nothing however good it is.

### Pricing strategy

Offer a $5 personal tier and a visible $100-$250/month company tier with a logo in the README and priority issue triage; add one-time options. Raise company tiers once you have a few logos to show.

### Path to profit

1. Month 0: polish one useful repo, add FUNDING.yml, create tiers and finish Stripe KYC (cost $0)
2. Month 1-2: announce in release notes and README; expected $0-$10
3. Month 3-6: ship features asked for by company users and pitch them the logo tier directly; expected $5-$50/month
4. Month 6-12: add more dependents (plugins, integrations) and a sponsor-only roadmap call; $10-$200/month if adoption grows

_Business-plan sources:_

- <https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors>
- <https://docs.github.com/en/sponsors/sponsoring-open-source-contributors/about-sponsorships-fees-and-taxes>

## Payout path

- **Methods:** Stripe Connect -> bank account
- **Minimum payout:** No published minimum
- **Frequency:** monthly
- **Typical delay:** 30 days
- **Notes:** Region of residence must match bank region; 103 supported regions as of 2026 docs. Payouts follow monthly cycle after Stripe onboarding.

## Full cycle (setup → earn → bank account)

1. Create GitHub account
2. Ship useful OSS project
3. Apply to Sponsors and set tiers
4. Add FUNDING.yml
5. Grow users
6. Receive sponsorships
7. Monthly Stripe payout to bank

## What can be automated

- AI agent triages issues, drafts fixes and release notes to keep repos active
- Auto-generate sponsor shout-outs/README sponsor blocks via GitHub Actions
- Scheduled newsletter of changelog to sponsors

## Unavoidable manual steps

- Stripe KYC and bank linking
- Tax form
- Community engagement and responding to sponsors

## Legality & compliance

Receiving donations/sponsorship is legal across the reference set; taxable income.

- **Compliance requirements:** Stripe KYC; tax reporting (W-8BEN/W-9 for US tax forms)
- **Platform availability:** GitHub lists 103 supported regions (incl. US, CA, UK, EU, JP, AU, IN, BR, KE). Non-supported regions can use a fiscal host such as Open Collective.

## Risks

- Most maintainers earn $0-$50/month
- Depends on project popularity
- Burnout from maintenance expectations

## Evidence that people get paid

GitHub docs state 0% fees on personal sponsorships and list 103 payout regions; GitHub/Stripe case study reports the program scaling to 100+ countries with thousands of paid maintainers.

## Sources

- <https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors>
- <https://stripe.com/customers/github>

_Tags: recurring, developer, open-source, donations_

---

_Generated from `data/strategies/software.json` by `npm run build:catalog`. Edit the JSON, not this file._
